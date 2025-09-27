import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantId } from '@/lib/tenant/manager'
import { getWorkflowManager } from '@/lib/workflow/manager'
import { getDb } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const tenantId = getCurrentTenantId()
    const workflowManager = getWorkflowManager()
    const db = getDb()
    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.description || !data.ticket_type_id || !data.category_id || !data.priority_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: title, description, ticket_type_id, category_id, priority_id'
        },
        { status: 400 }
      )
    }

    // Validate ticket type belongs to tenant
    const ticketType = db.prepare(`
      SELECT * FROM ticket_types
      WHERE id = ? AND tenant_id = ? AND is_active = 1
    `).get(data.ticket_type_id, tenantId)

    if (!ticketType) {
      return NextResponse.json(
        { success: false, error: 'Invalid ticket type' },
        { status: 400 }
      )
    }

    // Validate category belongs to tenant
    const category = db.prepare(`
      SELECT * FROM categories
      WHERE id = ? AND tenant_id = ? AND is_active = 1
    `).get(data.category_id, tenantId)

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Validate priority belongs to tenant
    const priority = db.prepare(`
      SELECT * FROM priorities
      WHERE id = ? AND tenant_id = ? AND is_active = 1
    `).get(data.priority_id, tenantId)

    if (!priority) {
      return NextResponse.json(
        { success: false, error: 'Invalid priority' },
        { status: 400 }
      )
    }

    // Prepare ticket data for workflow processing
    const ticketData = {
      tenant_id: tenantId,
      title: data.title,
      description: data.description,
      ticket_type_id: data.ticket_type_id,
      user_id: data.user_id || 1, // TODO: Get from authenticated user
      category_id: data.category_id,
      priority_id: data.priority_id,
      impact: data.impact || 3,
      urgency: data.urgency || 3,
      affected_users_count: data.affected_users_count || 1,
      business_service: data.business_service,
      location: data.location
    }

    // Process through workflow manager
    const workflowResult = await workflowManager.processTicketCreation(ticketData)

    if (!workflowResult.success) {
      return NextResponse.json(
        { success: false, error: workflowResult.error },
        { status: 400 }
      )
    }

    // Create ticket in database
    const insertTicket = db.prepare(`
      INSERT INTO tickets (
        tenant_id, title, description, ticket_type_id, user_id, category_id,
        priority_id, status_id, assigned_to, assigned_team_id, impact, urgency,
        affected_users_count, business_service, location, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertTicket.run(
      tenantId,
      data.title,
      data.description,
      data.ticket_type_id,
      ticketData.user_id,
      data.category_id,
      data.priority_id,
      workflowResult.initial_status_id,
      workflowResult.assigned_to || null,
      workflowResult.assigned_team_id || null,
      data.impact || 3,
      data.urgency || 3,
      data.affected_users_count || 1,
      data.business_service || null,
      data.location || null,
      data.source || 'web'
    )

    const ticketId = result.lastInsertRowid as number

    // Handle approval workflow if required
    if (workflowResult.approval_required) {
      await this.createApprovalWorkflow(ticketId, tenantId, ticketType)
    }

    // Get the created ticket with all relations
    const createdTicket = db.prepare(`
      SELECT
        t.*,
        tt.name as ticket_type_name,
        tt.workflow_type,
        tt.color as ticket_type_color,
        c.name as category_name,
        p.name as priority_name,
        p.level as priority_level,
        s.name as status_name,
        s.color as status_color,
        u.name as creator_name,
        a.name as assignee_name,
        team.name as team_name
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN categories c ON t.category_id = c.id
      JOIN priorities p ON t.priority_id = p.id
      JOIN statuses s ON t.status_id = s.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN teams team ON t.assigned_team_id = team.id
      WHERE t.id = ?
    `).get(ticketId)

    // Log ticket creation for analytics
    db.prepare(`
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values)
      VALUES (?, ?, 'ticket', ?, 'create', ?)
    `).run(
      tenantId,
      ticketData.user_id,
      ticketId,
      JSON.stringify({
        ticket_type: ticketType.workflow_type,
        category: category.name,
        priority: priority.name,
        workflow_result: workflowResult.message
      })
    )

    // Send notifications based on workflow type
    await this.sendWorkflowNotifications(createdTicket, workflowResult, ticketType)

    return NextResponse.json({
      success: true,
      ticket: createdTicket,
      workflow_result: {
        message: workflowResult.message,
        approval_required: workflowResult.approval_required,
        assigned_team: workflowResult.assigned_team_id ? 'auto-assigned' : 'pending assignment'
      },
      message: `${ticketType.name} created successfully`
    })

  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create ticket' },
      { status: 500 }
    )
  }

  // Helper method to create approval workflow
  async createApprovalWorkflow(ticketId: number, tenantId: number, ticketType: any) {
    const db = getDb()

    // Find approval workflow for this ticket type
    const workflow = db.prepare(`
      SELECT * FROM approval_workflows
      WHERE tenant_id = ? AND (ticket_type_id = ? OR ticket_type_id IS NULL)
      AND is_active = 1
      ORDER BY ticket_type_id IS NOT NULL DESC
      LIMIT 1
    `).get(tenantId, ticketType.id)

    if (workflow) {
      const approvalSteps = JSON.parse(workflow.approval_steps)

      // Create approval requests for each step
      for (let i = 0; i < approvalSteps.length; i++) {
        const step = approvalSteps[i]
        db.prepare(`
          INSERT INTO approval_requests (tenant_id, ticket_id, workflow_id, step_number, approver_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(tenantId, ticketId, workflow.id, i + 1, step.approver_id)
      }
    }
  }

  // Helper method to send workflow-specific notifications
  async sendWorkflowNotifications(ticket: any, workflowResult: any, ticketType: any) {
    // Implementation would depend on your notification system
    // This is where you'd send different notifications based on workflow type

    switch (ticketType.workflow_type) {
      case 'incident':
        // Send urgent incident notifications
        break
      case 'request':
        // Send service request notifications
        break
      case 'change':
        // Send change management notifications
        break
      case 'problem':
        // Send problem management notifications
        break
    }
  }
}