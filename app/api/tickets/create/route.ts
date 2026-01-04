import type { NextRequest } from 'next/server'
import {
  apiHandler,
  getUserFromRequest,
  getTenantFromRequest,
  parseJSONBody,
} from '@/lib/api/api-helpers'
import { NotFoundError, ConflictError } from '@/lib/errors/error-handler'
import { ticketSchemas } from '@/lib/validation/schemas'
import { safeQuery, safeTransaction } from '@/lib/db/safe-queries'
import { getWorkflowManager } from '@/lib/workflow/manager'
import db from '@/lib/db/connection'
import { createRateLimitMiddleware } from '@/lib/rate-limit'
import { cacheInvalidation } from '@/lib/api/cache'
import { sanitizeRequestBody } from '@/lib/api/sanitize-middleware'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Rate limiting moderado para criação de tickets (100 requests em 15 minutos)
const createTicketRateLimit = createRateLimitMiddleware('api')

/**
 * POST /api/tickets/create
 * Create a new ticket with workflow processing
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Aplicar rate limiting
  const rateLimitResult = await createTicketRateLimit(request, '/api/tickets/create')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limit exceeded
  }
  // 1. Extract authenticated user and tenant
  const user = getUserFromRequest(request)
  const tenant = getTenantFromRequest(request)

  // 2. Validate and parse request body with Zod schema
  const createTicketSchema = ticketSchemas.create.extend({
    ticket_type_id: ticketSchemas.create.shape.category_id,
    impact: ticketSchemas.create.shape.priority_id.optional(),
    urgency: ticketSchemas.create.shape.priority_id.optional(),
    affected_users_count: ticketSchemas.create.shape.priority_id.optional(),
    business_service: ticketSchemas.create.shape.title.optional(),
    location: ticketSchemas.create.shape.title.optional(),
    source: ticketSchemas.create.shape.title.optional(),
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
  // 3. Validate ticket type belongs to tenant (with safe query)
  const ticketTypeResult = safeQuery(
    () => db.prepare(`
      SELECT * FROM ticket_types
      WHERE id = ? AND tenant_id = ? AND is_active = 1
    `).get(data.ticket_type_id, tenantId),
    'get ticket type'
  )

  if (!ticketTypeResult.success || !ticketTypeResult.data) {
    throw new NotFoundError('Ticket type')
  }

  const ticketType = ticketTypeResult.data

  // 4. Validate category belongs to tenant
  const categoryResult = safeQuery(
    () => db.prepare(`
      SELECT * FROM categories
      WHERE id = ? AND tenant_id = ? AND is_active = 1
    `).get(data.category_id, tenantId),
    'get category'
  )

  if (!categoryResult.success || !categoryResult.data) {
    throw new NotFoundError('Category')
  }

  const category = categoryResult.data

  // 5. Validate priority belongs to tenant
  const priorityResult = safeQuery(
    () => db.prepare(`
      SELECT * FROM priorities
      WHERE id = ? AND tenant_id = ? AND is_active = 1
    `).get(data.priority_id, tenantId),
    'get priority'
  )

  if (!priorityResult.success || !priorityResult.data) {
    throw new NotFoundError('Priority')
  }

  const priority = priorityResult.data

  // 6. Prepare ticket data for workflow processing
  const ticketData = {
    tenant_id: tenantId,
    title: data.title,
    description: data.description,
    ticket_type_id: data.ticket_type_id,
    user_id: user.id, // ✅ From authenticated user (not hardcoded!)
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

  // 8. Create ticket in database with transaction
  const transactionResult = safeTransaction(db, (db) => {
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
      workflowResult.initial_status_id ?? 0,
      workflowResult.assigned_to || null,
      workflowResult.assigned_team_id || null,
      data.impact || 3,
      data.urgency || 3,
      data.affected_users_count || 1,
      data.business_service || null,
      data.location || null,
      data.source || 'web'
    )

    return result.lastInsertRowid as number
  }, 'create ticket')

  if (!transactionResult.success) {
    throw new Error(transactionResult.error)
  }

  const ticketId = transactionResult.data

  // 9. Handle approval workflow if required
  if (workflowResult.approval_required && ticketId !== undefined) {
    await createApprovalWorkflow(ticketId, tenantId, ticketType)
  }

  // 10. Get the created ticket with all relations
  const createdTicketResult = safeQuery(
    () => db.prepare(`
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
    `).get(ticketId),
    'get created ticket'
  )

  if (!createdTicketResult.success || !createdTicketResult.data) {
    throw new Error('Failed to retrieve created ticket')
  }

  const createdTicket = createdTicketResult.data

  // 11. Log ticket creation for analytics
  safeQuery(
    () => db.prepare(`
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values)
      VALUES (?, ?, 'ticket', ?, 'create', ?)
    `).run(
      tenantId,
      ticketData.user_id,
      ticketId,
      JSON.stringify({
        ticket_type: (ticketType as any).workflow_type,
        category: (category as any).name,
        priority: (priority as any).name,
        workflow_result: workflowResult.message
      })
    ),
    'log ticket creation'
  )

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
    const workflow = db.prepare(`
      SELECT * FROM approval_workflows
      WHERE tenant_id = ? AND (ticket_type_id = ? OR ticket_type_id IS NULL)
      AND is_active = 1
      ORDER BY ticket_type_id IS NOT NULL DESC
      LIMIT 1
    `).get(tenantId, ticketType.id)

    if (workflow) {
      const approvalSteps = JSON.parse((workflow as any).approval_steps)

      // Create approval requests for each step
      for (let i = 0; i < approvalSteps.length; i++) {
        const step = approvalSteps[i]
        db.prepare(`
          INSERT INTO approval_requests (tenant_id, ticket_id, workflow_id, step_number, approver_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(tenantId, ticketId, (workflow as any).id, i + 1, step.approver_id)
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