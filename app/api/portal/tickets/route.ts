import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // For now, we'll return mock data since this is a portal endpoint
    // In a real implementation, this would filter by customer/tenant based on authentication

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
      WHERE 1=1
    `

    const params: any[] = []

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

    const tickets = db.prepare(query).all(...params)

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      WHERE 1=1
    `

    const countParams: any[] = []

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

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number }

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