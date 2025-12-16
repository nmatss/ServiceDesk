import { getDb } from '@/lib/db'
import logger from '../monitoring/structured-logger';

interface TicketData {
  id?: number
  tenant_id: number
  title: string
  description: string
  ticket_type_id: number
  user_id: number
  category_id: number
  priority_id: number
  impact?: number
  urgency?: number
  affected_users_count?: number
  business_service?: string
  location?: string
}

interface TicketType {
  id: number
  tenant_id: number
  name: string
  slug: string
  description?: string
  icon: string
  color: string
  workflow_type: 'incident' | 'request' | 'change' | 'problem'
  sla_required: boolean
  approval_required: boolean
  escalation_enabled: boolean
  auto_assignment_enabled: boolean
  customer_visible: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Status {
  id: number
  tenant_id?: number
  name?: string
  status_type?: string
  is_initial?: number
  is_active?: number
  sort_order?: number
}

interface Category {
  id: number
  tenant_id?: number
  name?: string
  default_team_id?: number
  requires_approval?: number
}

interface Team {
  id: number
  tenant_id?: number
  name?: string
  slug?: string
  team_type?: string
  capabilities?: string
}

interface TeamMember {
  user_id: number
  team_id?: number
  workload_percentage?: number
  is_active?: number
  availability_status?: string
}

interface EscalationRule {
  condition: string
  action: string
  threshold_minutes: number
}

interface WorkflowResult {
  success: boolean
  ticket_id?: number
  assigned_team_id?: number | null
  assigned_to?: number | null
  initial_status_id?: number
  approval_required?: boolean
  sla_policy_id?: number
  escalation_rules?: EscalationRule[]
  message?: string
  error?: string
}

export class WorkflowManager {
  private db = getDb()

  /**
   * Process ticket creation based on workflow type
   */
  async processTicketCreation(ticketData: TicketData): Promise<WorkflowResult> {
    try {
      // Get ticket type information
      const ticketType = this.db.prepare(`
        SELECT * FROM ticket_types
        WHERE id = ? AND tenant_id = ? AND is_active = 1
      `).get(ticketData.ticket_type_id, ticketData.tenant_id) as TicketType | undefined

      if (!ticketType) {
        return { success: false, error: 'Invalid ticket type' }
      }

      // Route to appropriate workflow handler
      switch (ticketType.workflow_type) {
        case 'incident':
          return await this.processIncidentWorkflow(ticketData, ticketType)
        case 'request':
          return await this.processRequestWorkflow(ticketData, ticketType)
        case 'change':
          return await this.processChangeWorkflow(ticketData, ticketType)
        case 'problem':
          return await this.processProblemWorkflow(ticketData, ticketType)
        default:
          return await this.processDefaultWorkflow(ticketData, ticketType)
      }
    } catch (error) {
      logger.error('Error processing ticket workflow', error)
      return { success: false, error: 'Failed to process ticket workflow' }
    }
  }

  /**
   * Incident workflow - Focus on rapid response and resolution
   */
  private async processIncidentWorkflow(ticketData: TicketData, ticketType: TicketType): Promise<WorkflowResult> {
    // Calculate priority based on impact and urgency for incidents
    this.calculateIncidentPriority(
      ticketData.impact || 3,
      ticketData.urgency || 3
    )

    // Get initial status for incidents (usually "Open" or "New")
    const initialStatus = this.db.prepare(`
      SELECT id FROM statuses
      WHERE tenant_id = ? AND (status_type = 'open' OR is_initial = 1) AND is_active = 1
      ORDER BY is_initial DESC, sort_order
      LIMIT 1
    `).get(ticketData.tenant_id) as Status | undefined

    // Auto-assign to appropriate team based on category
    const assignmentResult = await this.autoAssignIncident(ticketData)

    // Check if immediate escalation is needed for high-impact incidents
    const escalationRules = this.getEscalationRules(ticketData, ticketType)

    return {
      success: true,
      assigned_team_id: assignmentResult.team_id,
      assigned_to: assignmentResult.agent_id,
      initial_status_id: initialStatus?.id,
      approval_required: false, // Incidents typically don't require approval
      escalation_rules: escalationRules,
      message: 'Incident workflow processed - prioritized for rapid response'
    }
  }

  /**
   * Service Request workflow - Focus on fulfillment and approval
   */
  private async processRequestWorkflow(ticketData: TicketData, ticketType: TicketType): Promise<WorkflowResult> {
    // Check if approval is required
    const approvalRequired = ticketType.approval_required || await this.requiresApproval(ticketData)

    // Get appropriate initial status
    const initialStatusType = approvalRequired ? 'waiting' : 'open'
    const initialStatus = this.db.prepare(`
      SELECT id FROM statuses
      WHERE tenant_id = ? AND status_type = ? AND is_active = 1
      ORDER BY sort_order
      LIMIT 1
    `).get(ticketData.tenant_id, initialStatusType) as Status | undefined

    // For requests, assignment might be delayed until approval
    let assignmentResult: { team_id: number | null; agent_id: number | null } = { team_id: null, agent_id: null }
    if (!approvalRequired || ticketType.auto_assignment_enabled) {
      assignmentResult = await this.autoAssignRequest(ticketData)
    }

    return {
      success: true,
      assigned_team_id: assignmentResult.team_id,
      assigned_to: assignmentResult.agent_id,
      initial_status_id: initialStatus?.id,
      approval_required: approvalRequired,
      escalation_rules: [],
      message: approvalRequired
        ? 'Service request created - pending approval'
        : 'Service request workflow processed'
    }
  }

  /**
   * Change Request workflow - Focus on planning and approval
   */
  private async processChangeWorkflow(ticketData: TicketData, ticketType: TicketType): Promise<WorkflowResult> {
    // Changes always require approval unless specifically configured otherwise
    const approvalRequired = ticketType.approval_required !== false

    // Get CAB (Change Advisory Board) team or change management team
    const changeTeam = this.db.prepare(`
      SELECT id FROM teams
      WHERE tenant_id = ? AND (slug = 'change-management' OR team_type = 'management')
      ORDER BY slug = 'change-management' DESC
      LIMIT 1
    `).get(ticketData.tenant_id) as Team | undefined

    const initialStatus = this.db.prepare(`
      SELECT id FROM statuses
      WHERE tenant_id = ? AND status_type = 'waiting' AND is_active = 1
      ORDER BY sort_order
      LIMIT 1
    `).get(ticketData.tenant_id) as Status | undefined

    return {
      success: true,
      assigned_team_id: changeTeam?.id,
      assigned_to: null, // Will be assigned after approval
      initial_status_id: initialStatus?.id,
      approval_required: approvalRequired,
      escalation_rules: [],
      message: 'Change request created - routing to Change Advisory Board'
    }
  }

  /**
   * Problem workflow - Focus on investigation and root cause analysis
   */
  private async processProblemWorkflow(ticketData: TicketData, _ticketType: TicketType): Promise<WorkflowResult> {
    // Assign to senior technical team or problem management team
    const problemTeam = this.db.prepare(`
      SELECT id FROM teams
      WHERE tenant_id = ? AND (
        JSON_EXTRACT(capabilities, '$') LIKE '%problem_analysis%' OR
        team_type = 'technical'
      )
      ORDER BY JSON_EXTRACT(capabilities, '$') LIKE '%problem_analysis%' DESC
      LIMIT 1
    `).get(ticketData.tenant_id) as Team | undefined

    const initialStatus = this.db.prepare(`
      SELECT id FROM statuses
      WHERE tenant_id = ? AND status_type = 'in_progress' AND is_active = 1
      ORDER BY sort_order
      LIMIT 1
    `).get(ticketData.tenant_id) as Status | undefined

    return {
      success: true,
      assigned_team_id: problemTeam?.id,
      assigned_to: null, // Will be assigned to senior team member
      initial_status_id: initialStatus?.id,
      approval_required: false,
      escalation_rules: [],
      message: 'Problem record created - assigned to technical investigation team'
    }
  }

  /**
   * Default workflow for unspecified types
   */
  private async processDefaultWorkflow(ticketData: TicketData, _ticketType: TicketType): Promise<WorkflowResult> {
    const initialStatus = this.db.prepare(`
      SELECT id FROM statuses
      WHERE tenant_id = ? AND (status_type = 'open' OR is_initial = 1) AND is_active = 1
      ORDER BY is_initial DESC, sort_order
      LIMIT 1
    `).get(ticketData.tenant_id) as Status | undefined

    return {
      success: true,
      assigned_team_id: null,
      assigned_to: null,
      initial_status_id: initialStatus?.id,
      approval_required: false,
      escalation_rules: [],
      message: 'Ticket created with default workflow'
    }
  }

  /**
   * Calculate incident priority based on impact and urgency matrix
   */
  private calculateIncidentPriority(impact: number, urgency: number): number {
    // Priority matrix (lower number = higher priority)
    // Impact: 1=Critical, 2=High, 3=Medium, 4=Low, 5=Minimal
    // Urgency: 1=Critical, 2=High, 3=Medium, 4=Low, 5=Minimal

    const priorityMatrix: number[][] = [
      [1, 1, 2, 3, 4], // Critical Impact
      [1, 2, 2, 3, 4], // High Impact
      [2, 2, 3, 4, 4], // Medium Impact
      [3, 3, 4, 4, 5], // Low Impact
      [4, 4, 4, 5, 5]  // Minimal Impact
    ]

    const impactIndex = Math.min(Math.max(impact - 1, 0), 4)
    const urgencyIndex = Math.min(Math.max(urgency - 1, 0), 4)

    return priorityMatrix[impactIndex]?.[urgencyIndex] ?? 3
  }

  /**
   * Auto-assign incident to appropriate team and agent
   */
  private async autoAssignIncident(ticketData: TicketData): Promise<{team_id: number | null, agent_id: number | null}> {
    // Get category's default team
    const category = this.db.prepare(`
      SELECT default_team_id FROM categories
      WHERE id = ? AND tenant_id = ?
    `).get(ticketData.category_id, ticketData.tenant_id) as Category | undefined

    if (!category?.default_team_id) {
      return { team_id: null, agent_id: null }
    }

    // Get available team members
    const availableAgents = this.db.prepare(`
      SELECT tm.user_id, tm.workload_percentage, u.name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND tm.is_active = 1 AND tm.availability_status = 'available'
      AND u.role IN ('agent', 'team_manager', 'tenant_admin')
      ORDER BY tm.workload_percentage ASC, RANDOM()
      LIMIT 1
    `).get(category.default_team_id) as TeamMember | undefined

    return {
      team_id: category.default_team_id,
      agent_id: availableAgents?.user_id || null
    }
  }

  /**
   * Auto-assign service request
   */
  private async autoAssignRequest(ticketData: TicketData): Promise<{team_id: number | null, agent_id: number | null}> {
    // For requests, we might use different logic - perhaps based on skills
    return await this.autoAssignIncident(ticketData) // Use same logic for now
  }

  /**
   * Check if request requires approval
   */
  private async requiresApproval(ticketData: TicketData): Promise<boolean> {
    // Check category settings
    const category = this.db.prepare(`
      SELECT requires_approval FROM categories
      WHERE id = ? AND tenant_id = ?
    `).get(ticketData.category_id, ticketData.tenant_id) as Category | undefined

    return category?.requires_approval === 1
  }

  /**
   * Get escalation rules for ticket
   */
  private getEscalationRules(ticketData: TicketData, ticketType: TicketType): EscalationRule[] {
    if (!ticketType.escalation_enabled) {
      return []
    }

    // Define escalation rules based on impact/urgency
    const rules: EscalationRule[] = []

    if (ticketData.impact && ticketData.impact <= 2 || ticketData.urgency && ticketData.urgency <= 2) {
      rules.push({
        condition: 'sla_breach_warning',
        action: 'escalate_to_manager',
        threshold_minutes: 15
      })
    }

    if (ticketData.impact === 1) {
      rules.push({
        condition: 'no_response',
        action: 'escalate_to_senior_management',
        threshold_minutes: 30
      })
    }

    return rules
  }
}

// Singleton instance
let workflowManager: WorkflowManager | null = null

export function getWorkflowManager(): WorkflowManager {
  if (!workflowManager) {
    workflowManager = new WorkflowManager()
  }
  return workflowManager
}