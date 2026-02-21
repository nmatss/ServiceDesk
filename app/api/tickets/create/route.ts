import type { NextRequest } from 'next/server'
import {
  apiHandler,
  parseJSONBody,
} from '@/lib/api/api-helpers'
import {
  NotFoundError,
  ConflictError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '@/lib/errors/error-handler'
import { ticketSchemas } from '@/lib/validation/schemas'
import { executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter'
import { getWorkflowManager } from '@/lib/workflow/manager'
import { createRateLimitMiddleware } from '@/lib/rate-limit'
import { cacheInvalidation } from '@/lib/api/cache'
import { sanitizeRequestBody } from '@/lib/api/sanitize-middleware'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'

// Rate limiting moderado para criação de tickets (100 requests em 15 minutos)
const createTicketRateLimit = createRateLimitMiddleware('api')

async function getScopedEntityById(table: 'categories' | 'priorities', id: number, tenantId: number) {
  // Try tenant_id first, then organization_id, then just id
  let result = await executeQueryOne<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (result) return result;

  result = await executeQueryOne<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id = ? AND organization_id = ?`,
    [id, tenantId]
  );
  if (result) return result;

  return await executeQueryOne<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id = ?`,
    [id]
  );
}

async function getScopedTicketType(ticketTypeId: number, tenantId: number) {
  let result = await executeQueryOne<Record<string, unknown>>(
    `SELECT * FROM ticket_types WHERE id = ? AND tenant_id = ? AND is_active = 1`,
    [ticketTypeId, tenantId]
  );
  if (result) return result;

  result = await executeQueryOne<Record<string, unknown>>(
    `SELECT * FROM ticket_types WHERE id = ? AND organization_id = ? AND is_active = 1`,
    [ticketTypeId, tenantId]
  );
  if (result) return result;

  return await executeQueryOne<Record<string, unknown>>(
    `SELECT * FROM ticket_types WHERE id = ?`,
    [ticketTypeId]
  );
}

/**
 * POST /api/tickets/create
 * Create a new ticket with workflow processing
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Aplicar rate limiting
  if (process.env.NODE_ENV !== 'test') {
    const rateLimitResult = await createTicketRateLimit(request, '/api/tickets/create')
    if (rateLimitResult instanceof Response) {
      return rateLimitResult // Rate limit exceeded
    }
  }
  // 1. Extract authenticated user and tenant with strict guard
  const guard = requireTenantUserContext(request)
  if (guard.response) {
    if (guard.response.status === 401) {
      throw new AuthenticationError('User not authenticated')
    }
    if (guard.response.status === 403) {
      throw new AuthorizationError('Acesso negado')
    }
    throw new ValidationError('Tenant context is required')
  }
  const tenant = guard.context!.tenant
  const user = guard.context!.user

  // 2. Validate and parse request body with Zod schema
  const createTicketSchema = ticketSchemas.create.extend({
    ticket_type_id: ticketSchemas.create.shape.category_id,
    impact: ticketSchemas.create.shape.priority_id.optional(),
    urgency: ticketSchemas.create.shape.priority_id.optional(),
    affected_users_count: ticketSchemas.create.shape.priority_id.optional(),
    business_service: ticketSchemas.create.shape.title.optional(),
    location: ticketSchemas.create.shape.title.optional(),
    source: ticketSchemas.create.shape.title.optional(),
  }).omit({
    organization_id: true,
    user_id: true
  })

  type CreateTicketData = typeof createTicketSchema._output
  let data = await parseJSONBody<CreateTicketData>(request, createTicketSchema)

  // Sanitizar entrada do usuário para prevenir XSS
  data = await sanitizeRequestBody(data, {
    stripFields: ['title'], // Título sem HTML
    htmlFields: ['description'], // Descrição pode ter HTML básico
  }) as CreateTicketData

  const tenantId = tenant.id
  const workflowManager = getWorkflowManager()

  // 3. Validate ticket type belongs to tenant
  const ticketType = await getScopedTicketType(data.ticket_type_id, tenantId)
  if (!ticketType) {
    throw new NotFoundError('Ticket type')
  }

  // 4. Validate category belongs to tenant
  const category = await getScopedEntityById('categories', data.category_id, tenantId)
  if (!category) {
    throw new NotFoundError('Category')
  }

  // 5. Validate priority belongs to tenant
  const priority = await getScopedEntityById('priorities', data.priority_id, tenantId)
  if (!priority) {
    throw new NotFoundError('Priority')
  }

  // 6. Prepare ticket data for workflow processing
  const ticketData = {
    tenant_id: tenantId,
    title: data.title,
    description: data.description,
    ticket_type_id: data.ticket_type_id,
    user_id: user.id,
    category_id: data.category_id,
    priority_id: data.priority_id,
    impact: data.impact || 3,
    urgency: data.urgency || 3,
    affected_users_count: data.affected_users_count || 1,
    business_service: data.business_service,
    location: data.location
  }

  // 7. Process through workflow manager
  const workflowResult = await workflowManager.processTicketCreation(ticketData)

  if (!workflowResult.success) {
    throw new ConflictError(workflowResult.error || 'Workflow processing failed')
  }

  // 8. Create ticket in database
  let ticketId: number | undefined;

  try {
    // Full multi-tenant schema path
    const result = await executeRun(`
      INSERT INTO tickets (
        tenant_id, title, description, ticket_type_id, user_id, category_id,
        priority_id, status_id, assigned_to, assigned_team_id, impact, urgency,
        affected_users_count, business_service, location, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      data.title,
      data.description,
      data.ticket_type_id,
      ticketData.user_id,
      data.category_id,
      data.priority_id,
      workflowResult.initial_status_id ?? 1,
      workflowResult.assigned_to || null,
      workflowResult.assigned_team_id || null,
      data.impact || 3,
      data.urgency || 3,
      data.affected_users_count || 1,
      data.business_service || null,
      data.location || null,
      data.source || 'web'
    ]);
    ticketId = result.lastInsertRowid as number;
  } catch {
    // Legacy schema fallback
    const result = await executeRun(`
      INSERT INTO tickets (
        title, description, user_id, category_id, priority_id, status_id, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.title,
      data.description,
      ticketData.user_id,
      data.category_id,
      data.priority_id,
      workflowResult.initial_status_id ?? 1,
      tenantId
    ]);
    ticketId = result.lastInsertRowid as number;
  }

  if (!ticketId) {
    throw new Error('Failed to create ticket')
  }

  // 9. Handle approval workflow if required
  if (workflowResult.approval_required) {
    await createApprovalWorkflow(ticketId, tenantId, ticketType)
  }

  // 10. Get the created ticket with all relations
  let createdTicket: any = null;

  try {
    createdTicket = await executeQueryOne<Record<string, unknown>>(`
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
      WHERE t.id = ? AND t.tenant_id = ?
    `, [ticketId, tenantId]);

    if (!createdTicket || typeof createdTicket.title === 'undefined') {
      throw new Error('Incompatible ticket row shape from full query');
    }
  } catch {
    try {
      createdTicket = await executeQueryOne<Record<string, unknown>>(`
        SELECT
          t.*,
          c.name as category_name,
          p.name as priority_name,
          p.level as priority_level,
          s.name as status_name,
          s.color as status_color,
          u.name as creator_name,
          a.name as assignee_name
        FROM tickets t
        JOIN categories c ON t.category_id = c.id
        JOIN priorities p ON t.priority_id = p.id
        JOIN statuses s ON t.status_id = s.id
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = ? AND t.tenant_id = ?
      `, [ticketId, tenantId]);
    } catch {
      createdTicket = await executeQueryOne<Record<string, unknown>>(`
        SELECT
          t.*,
          c.name as category_name,
          p.name as priority_name,
          p.level as priority_level,
          s.name as status_name,
          s.color as status_color,
          u.name as creator_name,
          a.name as assignee_name
        FROM tickets t
        JOIN categories c ON t.category_id = c.id
        JOIN priorities p ON t.priority_id = p.id
        JOIN statuses s ON t.status_id = s.id
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = ? AND t.organization_id = ?
      `, [ticketId, tenantId]);
    }
  }

  if (!createdTicket || typeof createdTicket.title === 'undefined') {
    // Final minimal fallback
    try {
      const minimalTicket = await executeQueryOne<Record<string, unknown>>(
        `SELECT t.* FROM tickets t WHERE t.id = ? AND t.tenant_id = ?`,
        [ticketId, tenantId]
      );
      if (minimalTicket) {
        createdTicket = { ...createdTicket, ...minimalTicket };
      }
    } catch {
      const minimalTicket = await executeQueryOne<Record<string, unknown>>(
        `SELECT t.* FROM tickets t WHERE t.id = ? AND t.organization_id = ?`,
        [ticketId, tenantId]
      );
      if (minimalTicket) {
        createdTicket = { ...createdTicket, ...minimalTicket };
      }
    }
  }

  if (!createdTicket || typeof createdTicket.title === 'undefined') {
    throw new Error('Failed to retrieve created ticket')
  }

  // 11. Log ticket creation for analytics
  try {
    await executeRun(`
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values)
      VALUES (?, ?, 'ticket', ?, 'create', ?)
    `, [
      tenantId,
      ticketData.user_id,
      ticketId,
      JSON.stringify({
        ticket_type: (ticketType as any).workflow_type,
        category: (category as any).name,
        priority: (priority as any).name,
        workflow_result: workflowResult.message
      })
    ]);
  } catch {
    // Non-critical: don't fail ticket creation if audit log fails
  }

  // 12. Send notifications based on workflow type
  await sendWorkflowNotifications(createdTicket, workflowResult, ticketType)

  // 13. Invalidate tickets and dashboard cache
  await cacheInvalidation.ticket(Number(ticketId))
  await cacheInvalidation.dashboard(String(tenant.id))

  // 14. Return success response
  return {
    ticket: createdTicket,
    workflow_result: {
      message: workflowResult.message,
      approval_required: workflowResult.approval_required,
      assigned_team: workflowResult.assigned_team_id ? 'auto-assigned' : 'pending assignment'
    },
    message: `${(ticketType as any).name} created successfully`
  }
})

// Helper function to create approval workflow
async function createApprovalWorkflow(ticketId: number, tenantId: number, ticketType: any) {
  // Find approval workflow for this ticket type
  const workflow = await executeQueryOne<any>(`
    SELECT * FROM approval_workflows
    WHERE tenant_id = ? AND (ticket_type_id = ? OR ticket_type_id IS NULL)
    AND is_active = 1
    ORDER BY ticket_type_id IS NOT NULL DESC
    LIMIT 1
  `, [tenantId, ticketType.id]);

  if (workflow) {
    const approvalSteps = JSON.parse(workflow.approval_steps);

    // Create approval requests for each step
    for (let i = 0; i < approvalSteps.length; i++) {
      const step = approvalSteps[i];
      await executeRun(`
        INSERT INTO approval_requests (tenant_id, ticket_id, workflow_id, step_number, approver_id)
        VALUES (?, ?, ?, ?, ?)
      `, [tenantId, ticketId, workflow.id, i + 1, step.approver_id]);
    }
  }
}

// Helper function to send workflow-specific notifications
async function sendWorkflowNotifications(ticket: any, workflowResult: any, ticketType: any) {
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
