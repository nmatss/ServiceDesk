import { getDb } from '@/lib/db'
import { cookies } from 'next/headers'
import { logger } from '../monitoring/logger';

interface Tenant {
  id: number
  name: string
  slug: string
  domain?: string
  subdomain?: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  subscription_plan: 'basic' | 'professional' | 'enterprise'
  max_users: number
  max_tickets_per_month: number
  features: string[]
  settings: Record<string, any>
  billing_email?: string
  technical_contact_email?: string
  is_active: boolean
  trial_ends_at?: string
  subscription_ends_at?: string
  created_at: string
  updated_at: string
}

interface Team {
  id: number
  tenant_id: number
  name: string
  slug: string
  description?: string
  team_type: 'technical' | 'business' | 'support' | 'management'
  specializations: string[]
  capabilities: string[]
  icon: string
  color: string
  manager_id?: number
  parent_team_id?: number
  escalation_team_id?: number
  business_hours?: Record<string, any>
  contact_email?: string
  contact_phone?: string
  sla_response_time?: number
  max_concurrent_tickets: number
  auto_assignment_enabled: boolean
  assignment_algorithm: 'round_robin' | 'least_loaded' | 'skill_based'
  is_active: boolean
  created_at: string
  updated_at: string
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

export class TenantManager {
  private db = getDb()

  // ========================================
  // TENANT MANAGEMENT
  // ========================================

  /**
   * Get tenant by slug or domain
   */
  getTenantByIdentifier(identifier: string): Tenant | null {
    try {
      const tenant = this.db.prepare(`
        SELECT * FROM tenants
        WHERE (slug = ? OR domain = ? OR subdomain = ?)
        AND is_active = 1
      `).get(identifier, identifier, identifier) as Tenant | undefined

      if (!tenant) return null

      // Parse JSON fields
      tenant.features = tenant.features ? JSON.parse(tenant.features) : []
      tenant.settings = tenant.settings ? JSON.parse(tenant.settings) : {}

      return tenant
    } catch (error) {
      logger.error('Error getting tenant', error)
      return null
    }
  }

  /**
   * Get tenant by ID
   */
  getTenantById(id: number): Tenant | null {
    try {
      const tenant = this.db.prepare(`
        SELECT * FROM tenants WHERE id = ? AND is_active = 1
      `).get(id) as Tenant | undefined

      if (!tenant) return null

      // Parse JSON fields
      tenant.features = tenant.features ? JSON.parse(tenant.features) : []
      tenant.settings = tenant.settings ? JSON.parse(tenant.settings) : {}

      return tenant
    } catch (error) {
      logger.error('Error getting tenant by ID', error)
      return null
    }
  }

  /**
   * Create new tenant
   */
  createTenant(data: {
    name: string
    slug: string
    domain?: string
    subdomain?: string
    subscription_plan?: 'basic' | 'professional' | 'enterprise'
    max_users?: number
    max_tickets_per_month?: number
    features?: string[]
    billing_email?: string
    technical_contact_email?: string
  }): number {
    try {
      const result = this.db.prepare(`
        INSERT INTO tenants (
          name, slug, domain, subdomain, subscription_plan, max_users,
          max_tickets_per_month, features, billing_email, technical_contact_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.name,
        data.slug,
        data.domain || null,
        data.subdomain || null,
        data.subscription_plan || 'basic',
        data.max_users || 50,
        data.max_tickets_per_month || 1000,
        JSON.stringify(data.features || ['incidents', 'requests', 'knowledge_base']),
        data.billing_email || null,
        data.technical_contact_email || null
      )

      const tenantId = result.lastInsertRowid as number

      // Create default ticket types for new tenant
      this.createDefaultTicketTypes(tenantId)

      // Create default teams for new tenant
      this.createDefaultTeams(tenantId)

      return tenantId
    } catch (error) {
      logger.error('Error creating tenant', error)
      throw error
    }
  }

  /**
   * Get current tenant from request context
   */
  getCurrentTenant(): Tenant | null {
    try {
      // Try to get tenant from subdomain or domain first
      // This would be handled by middleware in a real implementation

      // For now, return the default tenant
      return this.getTenantById(1)
    } catch (error) {
      logger.error('Error getting current tenant', error)
      return null
    }
  }

  // ========================================
  // TEAM MANAGEMENT
  // ========================================

  /**
   * Get teams for a tenant
   */
  getTeamsByTenant(tenantId: number): Team[] {
    try {
      const teams = this.db.prepare(`
        SELECT t.*, u.name as manager_name
        FROM teams t
        LEFT JOIN users u ON t.manager_id = u.id
        WHERE t.tenant_id = ? AND t.is_active = 1
        ORDER BY t.sort_order, t.name
      `).all(tenantId) as any[]

      return teams.map(team => ({
        ...team,
        specializations: team.specializations ? JSON.parse(team.specializations) : [],
        capabilities: team.capabilities ? JSON.parse(team.capabilities) : [],
        business_hours: team.business_hours ? JSON.parse(team.business_hours) : null
      }))
    } catch (error) {
      logger.error('Error getting teams', error)
      return []
    }
  }

  /**
   * Get team by ID
   */
  getTeamById(teamId: number, tenantId: number): Team | null {
    try {
      const team = this.db.prepare(`
        SELECT t.*, u.name as manager_name
        FROM teams t
        LEFT JOIN users u ON t.manager_id = u.id
        WHERE t.id = ? AND t.tenant_id = ? AND t.is_active = 1
      `).get(teamId, tenantId) as any

      if (!team) return null

      return {
        ...team,
        specializations: team.specializations ? JSON.parse(team.specializations) : [],
        capabilities: team.capabilities ? JSON.parse(team.capabilities) : [],
        business_hours: team.business_hours ? JSON.parse(team.business_hours) : null
      }
    } catch (error) {
      logger.error('Error getting team', error)
      return null
    }
  }

  /**
   * Create team
   */
  createTeam(data: {
    tenant_id: number
    name: string
    slug: string
    description?: string
    team_type: 'technical' | 'business' | 'support' | 'management'
    specializations?: string[]
    capabilities?: string[]
    icon?: string
    color?: string
    manager_id?: number
    sla_response_time?: number
  }): number {
    try {
      const result = this.db.prepare(`
        INSERT INTO teams (
          tenant_id, name, slug, description, team_type, specializations,
          capabilities, icon, color, manager_id, sla_response_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.tenant_id,
        data.name,
        data.slug,
        data.description || null,
        data.team_type,
        JSON.stringify(data.specializations || []),
        JSON.stringify(data.capabilities || []),
        data.icon || 'UsersIcon',
        data.color || '#3B82F6',
        data.manager_id || null,
        data.sla_response_time || null
      )

      return result.lastInsertRowid as number
    } catch (error) {
      logger.error('Error creating team', error)
      throw error
    }
  }

  /**
   * Add user to team
   */
  addUserToTeam(teamId: number, userId: number, role: string = 'member'): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO team_members (team_id, user_id, role)
        VALUES (?, ?, ?)
      `).run(teamId, userId, role)
    } catch (error) {
      logger.error('Error adding user to team', error)
      throw error
    }
  }

  /**
   * Get team members
   */
  getTeamMembers(teamId: number): any[] {
    try {
      return this.db.prepare(`
        SELECT tm.*, u.name, u.email, u.job_title
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND tm.is_active = 1
        ORDER BY
          CASE tm.role
            WHEN 'manager' THEN 1
            WHEN 'lead' THEN 2
            WHEN 'senior' THEN 3
            WHEN 'member' THEN 4
            WHEN 'trainee' THEN 5
          END,
          u.name
      `).all(teamId)
    } catch (error) {
      logger.error('Error getting team members', error)
      return []
    }
  }

  // ========================================
  // TICKET TYPE MANAGEMENT
  // ========================================

  /**
   * Get ticket types for tenant
   */
  getTicketTypesByTenant(tenantId: number): TicketType[] {
    try {
      return this.db.prepare(`
        SELECT * FROM ticket_types
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY sort_order, name
      `).all(tenantId) as TicketType[]
    } catch (error) {
      logger.error('Error getting ticket types', error)
      return []
    }
  }

  /**
   * Get customer-visible ticket types (for landing page)
   */
  getCustomerTicketTypes(tenantId: number): TicketType[] {
    try {
      return this.db.prepare(`
        SELECT * FROM ticket_types
        WHERE tenant_id = ? AND is_active = 1 AND customer_visible = 1
        ORDER BY sort_order, name
      `).all(tenantId) as TicketType[]
    } catch (error) {
      logger.error('Error getting customer ticket types', error)
      return []
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private createDefaultTicketTypes(tenantId: number): void {
    const defaultTypes = [
      {
        name: 'Incidente',
        slug: 'incident',
        description: 'Problemas que afetam serviços em produção',
        icon: 'ExclamationTriangleIcon',
        color: '#EF4444',
        workflow_type: 'incident',
        sort_order: 1
      },
      {
        name: 'Requisição de Serviço',
        slug: 'service-request',
        description: 'Solicitações de novos serviços ou recursos',
        icon: 'PlusCircleIcon',
        color: '#10B981',
        workflow_type: 'request',
        sort_order: 2
      },
      {
        name: 'Requisição de Mudança',
        slug: 'change-request',
        description: 'Solicitações de mudanças em sistemas',
        icon: 'ArrowPathIcon',
        color: '#F59E0B',
        workflow_type: 'change',
        customer_visible: false,
        sort_order: 3
      },
      {
        name: 'Problema',
        slug: 'problem',
        description: 'Investigação de causa raiz de incidentes recorrentes',
        icon: 'MagnifyingGlassIcon',
        color: '#8B5CF6',
        workflow_type: 'problem',
        customer_visible: false,
        sort_order: 4
      }
    ]

    for (const type of defaultTypes) {
      this.db.prepare(`
        INSERT INTO ticket_types (
          tenant_id, name, slug, description, icon, color, workflow_type,
          sla_required, customer_visible, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        tenantId,
        type.name,
        type.slug,
        type.description,
        type.icon,
        type.color,
        type.workflow_type,
        type.customer_visible !== false ? 1 : 0,
        type.sort_order
      )
    }
  }

  private createDefaultTeams(tenantId: number): void {
    const defaultTeams = [
      {
        name: 'Infraestrutura',
        slug: 'infrastructure',
        description: 'Equipe responsável por servidores, redes e infraestrutura',
        team_type: 'technical',
        specializations: ['servers', 'networking', 'storage', 'virtualization', 'cloud'],
        capabilities: ['incident_response', 'monitoring', 'capacity_planning', 'disaster_recovery'],
        icon: 'ServerIcon',
        color: '#3B82F6',
        sla_response_time: 30
      },
      {
        name: 'Desenvolvimento',
        slug: 'development',
        description: 'Equipe de desenvolvimento de software',
        team_type: 'technical',
        specializations: ['web_development', 'mobile_development', 'apis', 'databases', 'devops'],
        capabilities: ['bug_fixes', 'feature_development', 'code_review', 'deployment'],
        icon: 'CodeBracketIcon',
        color: '#10B981',
        sla_response_time: 60
      },
      {
        name: 'Suporte Técnico',
        slug: 'technical-support',
        description: 'Equipe de suporte técnico aos usuários',
        team_type: 'support',
        specializations: ['user_support', 'troubleshooting', 'training', 'documentation'],
        capabilities: ['incident_resolution', 'user_assistance', 'knowledge_base', 'training'],
        icon: 'UserGroupIcon',
        color: '#F59E0B',
        sla_response_time: 15
      },
      {
        name: 'Segurança',
        slug: 'security',
        description: 'Equipe de segurança da informação',
        team_type: 'technical',
        specializations: ['cybersecurity', 'compliance', 'risk_assessment', 'incident_response'],
        capabilities: ['security_monitoring', 'threat_analysis', 'policy_enforcement', 'audit'],
        icon: 'ShieldCheckIcon',
        color: '#EF4444',
        sla_response_time: 15
      }
    ]

    for (const team of defaultTeams) {
      this.createTeam({
        tenant_id: tenantId,
        ...team
      })
    }
  }
}

// Singleton instance
let tenantManager: TenantManager | null = null

export function getTenantManager(): TenantManager {
  if (!tenantManager) {
    tenantManager = new TenantManager()
  }
  return tenantManager
}

// Utility functions for getting current context
export function getCurrentTenant(): Tenant | null {
  return getTenantManager().getCurrentTenant()
}

export function getCurrentTenantId(): number {
  const tenant = getCurrentTenant()
  return tenant?.id || 1 // Default to tenant 1
}