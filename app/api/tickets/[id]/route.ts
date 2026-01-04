import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// GET single ticket
export async function GET(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: Promise<{ id: string }> }
) {
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

    // Query single ticket with tenant isolation
    let query = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
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
    `

    const params_array = [
      tenantContext.id, // statuses tenant_id
      tenantContext.id, // priorities tenant_id
      tenantContext.id, // categories tenant_id
      tenantContext.id, // users tenant_id
      ticketId,
      tenantContext.id  // tickets tenant_id
    ]

    // If not admin, check if user owns the ticket
    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
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
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: Promise<{ id: string }> }
) {
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

    // Verify ticket exists and belongs to tenant
    let ticketQuery = 'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?'
    let ticketParams = [ticketId, tenantContext.id]

    // If not admin, check if user owns the ticket
    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
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

    // Build update query dynamically
    const updates = []
    const updateParams = []

    if (status_id !== undefined) {
      // Verify status exists and belongs to tenant
      const status = db.prepare('SELECT id FROM statuses WHERE id = ? AND tenant_id = ?').get(status_id, tenantContext.id)
      if (!status) {
        return NextResponse.json(
          { error: 'Status inválido' },
          { status: 400 }
        )
      }
      updates.push('status_id = ?')
      updateParams.push(status_id)
    }

    if (priority_id !== undefined) {
      // Verify priority exists and belongs to tenant
      const priority = db.prepare('SELECT id FROM priorities WHERE id = ? AND tenant_id = ?').get(priority_id, tenantContext.id)
      if (!priority) {
        return NextResponse.json(
          { error: 'Prioridade inválida' },
          { status: 400 }
        )
      }
      updates.push('priority_id = ?')
      updateParams.push(priority_id)
    }

    if (category_id !== undefined) {
      // Verify category exists and belongs to tenant
      const category = db.prepare('SELECT id FROM categories WHERE id = ? AND tenant_id = ?').get(category_id, tenantContext.id)
      if (!category) {
        return NextResponse.json(
          { error: 'Categoria inválida' },
          { status: 400 }
        )
      }
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

    // Get updated ticket
    const updatedTicket = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
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
    `).get(tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id, ticketId, tenantContext.id)

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

