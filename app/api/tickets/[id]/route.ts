import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';
import { getFromCache, setCache, invalidateTicketCache } from '@/lib/cache/lru-cache';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

// Shared query for getting ticket with relations - eliminates code duplication
const TICKET_SELECT_QUERY = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.created_at,
    t.updated_at,
    t.user_id,
    s.name as status,
    s.id as status_id,
    s.color as status_color,
    p.name as priority,
    p.id as priority_id,
    c.name as category,
    c.id as category_id,
    u.name as user_name
  FROM tickets t
  LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
  LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
  LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
  LEFT JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
  WHERE t.id = ? AND t.tenant_id = ?
`;

// GET single ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const ticketId = parseInt(id)

    // Check cache first
    const cacheKey = `tenant:${tenantContext.id}:ticket:${ticketId}`
    const cached = getFromCache<Record<string, unknown>>(cacheKey, 'tickets')

    if (cached) {
      // Verify user has access to cached ticket
      const isAdmin = ['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)
      if (isAdmin || cached.user_id === userContext.id) {
        return NextResponse.json({
          success: true,
          ticket: cached,
          cached: true
        })
      }
    }

    const params_array: (number | string)[] = [
      tenantContext.id,
      tenantContext.id,
      tenantContext.id,
      tenantContext.id,
      ticketId,
      tenantContext.id
    ]

    let query = TICKET_SELECT_QUERY

    // If not admin, check if user owns the ticket
    const isAdmin = ['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)
    if (!isAdmin) {
      query += ' AND t.user_id = ?'
      params_array.push(userContext.id)
    }

    const ticket = db.prepare(query).get(...params_array)

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket não encontrado' },
        { status: 404 }
      )
    }

    // Cache the result
    setCache(cacheKey, ticket, 300, 'tickets')

    return NextResponse.json({
      success: true,
      ticket
    })
  } catch (error) {
    logger.error('Error fetching ticket', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PATCH ticket (for updates like status change)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const ticketId = parseInt(id)
    const { status_id, priority_id, category_id, title, description } = await request.json()

    const isAdmin = ['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)

    // Verify ticket exists and belongs to tenant
    let ticketQuery = 'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?'
    const ticketParams: (number | string)[] = [ticketId, tenantContext.id]

    if (!isAdmin) {
      ticketQuery += ' AND user_id = ?'
      ticketParams.push(userContext.id)
    }

    const existingTicket = db.prepare(ticketQuery).get(...ticketParams)

    if (!existingTicket) {
      return NextResponse.json(
        { error: 'Ticket não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // OPTIMIZED: Single query to validate all foreign keys at once
    // Instead of 3 separate queries, we do 1 query that returns validation results
    const validationIds = {
      status: status_id,
      priority: priority_id,
      category: category_id
    }

    const idsToValidate = Object.entries(validationIds).filter(([, v]) => v !== undefined)

    if (idsToValidate.length > 0) {
      const validationQuery = `
        SELECT
          ${status_id !== undefined ? `(SELECT id FROM statuses WHERE id = ? AND tenant_id = ?) as valid_status,` : ''}
          ${priority_id !== undefined ? `(SELECT id FROM priorities WHERE id = ? AND tenant_id = ?) as valid_priority,` : ''}
          ${category_id !== undefined ? `(SELECT id FROM categories WHERE id = ? AND tenant_id = ?) as valid_category,` : ''}
          1 as dummy
      `.replace(/,\s*1 as dummy/, ', 1 as dummy')

      const validationParams: (number | string)[] = []
      if (status_id !== undefined) validationParams.push(status_id, tenantContext.id)
      if (priority_id !== undefined) validationParams.push(priority_id, tenantContext.id)
      if (category_id !== undefined) validationParams.push(category_id, tenantContext.id)

      const validation = db.prepare(validationQuery).get(...validationParams) as Record<string, number | null>

      if (status_id !== undefined && !validation.valid_status) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
      }
      if (priority_id !== undefined && !validation.valid_priority) {
        return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 })
      }
      if (category_id !== undefined && !validation.valid_category) {
        return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    const updateParams: (number | string)[] = []

    if (status_id !== undefined) {
      updates.push('status_id = ?')
      updateParams.push(status_id)
    }

    if (priority_id !== undefined) {
      updates.push('priority_id = ?')
      updateParams.push(priority_id)
    }

    if (category_id !== undefined) {
      updates.push('category_id = ?')
      updateParams.push(category_id)
    }

    if (title !== undefined) {
      updates.push('title = ?')
      updateParams.push(title)
    }

    if (description !== undefined) {
      updates.push('description = ?')
      updateParams.push(description)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar' },
        { status: 400 }
      )
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')

    // Execute update
    const updateQuery = `UPDATE tickets SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    updateParams.push(ticketId, tenantContext.id)

    db.prepare(updateQuery).run(...updateParams)

    // Get updated ticket using shared query
    const updatedTicket = db.prepare(TICKET_SELECT_QUERY).get(
      tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id,
      ticketId, tenantContext.id
    )

    // Invalidate caches (targeted, not global)
    invalidateTicketCache(tenantContext.id, ticketId)

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    })
  } catch (error) {
    logger.error('Error updating ticket', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

