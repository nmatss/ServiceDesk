import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticket_id')

    if (!ticketId) {
      return NextResponse.json(
        { error: 'ticket_id é obrigatório' },
        { status: 400 }
      )
    }

    // Verify ticket exists and user has access to it
    let ticketQuery = 'SELECT id FROM tickets WHERE id = ? AND tenant_id = ?'
    let ticketParams = [parseInt(ticketId), tenantContext.id]

    // If not admin, check if user owns the ticket
    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
      ticketQuery += ' AND user_id = ?'
      ticketParams.push(userContext.id)
    }

    const ticket = db.prepare(ticketQuery).get(...ticketParams)

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // Get comments with user information
    const comments = db.prepare(`
      SELECT
        c.id,
        c.content,
        c.is_internal,
        c.created_at,
        c.updated_at,
        c.comment_type,
        c.time_spent_minutes,
        c.visibility,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = ?
      WHERE c.ticket_id = ? AND c.tenant_id = ?
      ORDER BY c.created_at ASC
    `).all(tenantContext.id, parseInt(ticketId), tenantContext.id)

    return NextResponse.json({
      success: true,
      comments
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const { ticket_id, content, is_internal, comment_type, time_spent_minutes, visibility } = await request.json()

    if (!ticket_id || !content) {
      return NextResponse.json(
        { error: 'ticket_id e content são obrigatórios' },
        { status: 400 }
      )
    }

    // Verify ticket exists and user has access to it
    let ticketQuery = 'SELECT id FROM tickets WHERE id = ? AND tenant_id = ?'
    let ticketParams = [ticket_id, tenantContext.id]

    // If not admin, check if user owns the ticket
    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
      ticketQuery += ' AND user_id = ?'
      ticketParams.push(userContext.id)
    }

    const ticket = db.prepare(ticketQuery).get(...ticketParams)

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // Create comment
    const result = db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal,
                           comment_type, time_spent_minutes, visibility, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticket_id,
      userContext.id,
      content,
      (is_internal || false) ? 1 : 0,
      comment_type || 'comment',
      time_spent_minutes || null,
      visibility || 'all',
      tenantContext.id
    )

    // Get created comment with user info
    const newComment = db.prepare(`
      SELECT
        c.id,
        c.content,
        c.is_internal,
        c.created_at,
        c.updated_at,
        c.comment_type,
        c.time_spent_minutes,
        c.visibility,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = ?
      WHERE c.id = ?
    `).get(tenantContext.id, result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      comment: newComment
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}