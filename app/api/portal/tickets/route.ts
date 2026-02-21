import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  // SECURITY: Tenant isolation and authentication
  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { auth } = guard;

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        t.id,
        t.ticket_number,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        t.sla_due_at,
        s.name as status,
        s.color as status_color,
        p.name as priority,
        p.color as priority_color,
        p.level as priority_level,
        u.name as customer_name,
        assigned.name as assigned_to_name,
        c.name as category_name,
        CASE
          WHEN t.sla_due_at < datetime('now') THEN 1
          ELSE 0
        END as is_overdue
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.organization_id = ? AND t.user_id = ?
    `

    const params: any[] = [auth.organizationId, auth.userId]

    // Add search filter
    if (search) {
      query += ` AND (
        t.title LIKE ? OR
        t.description LIKE ? OR
        t.ticket_number LIKE ?
      )`
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    // Add status filter
    if (status && status !== 'all') {
      query += ` AND s.name = ?`
      params.push(status)
    }

    // Add priority filter
    if (priority && priority !== 'all') {
      query += ` AND p.name = ?`
      params.push(priority)
    }

    // Add sorting
    const validSortFields = ['created_at', 'updated_at', 'priority', 'status']
    const validSortOrders = ['asc', 'desc']

    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
      if (sortBy === 'priority') {
        query += ` ORDER BY p.level ${sortOrder}`
      } else {
        query += ` ORDER BY t.${sortBy} ${sortOrder}`
      }
    }

    // Add pagination
    query += ` LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const tickets = await executeQuery(query, params)

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      WHERE t.organization_id = ? AND t.user_id = ?
    `

    const countParams: any[] = [auth.organizationId, auth.userId]

    if (search) {
      countQuery += ` AND (
        t.title LIKE ? OR
        t.description LIKE ? OR
        t.ticket_number LIKE ?
      )`
      const searchTerm = `%${search}%`
      countParams.push(searchTerm, searchTerm, searchTerm)
    }

    if (status && status !== 'all') {
      countQuery += ` AND s.name = ?`
      countParams.push(status)
    }

    if (priority && priority !== 'all') {
      countQuery += ` AND p.name = ?`
      countParams.push(priority)
    }

    const { total } = await executeQueryOne<{ total: number }>(countQuery, countParams) || { total: 0 }

    return NextResponse.json({
      success: true,
      tickets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    logger.error('Error fetching portal tickets', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}