import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticketId = parseInt(id)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: 'ID do ticket inválido' },
        { status: 400 }
      )
    }

    // Get ticket details
    const ticket = db.prepare(`
      SELECT
        t.id,
        t.ticket_number,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        t.sla_due_at,
        t.response_due_at,
        s.name as status,
        s.color as status_color,
        s.category as status_category,
        p.name as priority,
        p.color as priority_color,
        p.level as priority_level,
        u.name as customer_name,
        u.email as customer_email,
        assigned.name as assigned_to_name,
        assigned.email as assigned_to_email,
        c.name as category_name,
        tt.name as ticket_type_name,
        tt.workflow_type,
        tenant.name as tenant_name,
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
      LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
      LEFT JOIN tenants tenant ON t.tenant_id = tenant.id
      WHERE t.id = ?
    `).get(ticketId)

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket não encontrado' },
        { status: 404 }
      )
    }

    // Get ticket comments (only public comments for portal)
    const comments = db.prepare(`
      SELECT
        c.id,
        c.content,
        c.created_at,
        c.is_internal,
        u.name as author_name,
        u.email as author_email,
        u.role as author_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ? AND c.is_internal = 0
      ORDER BY c.created_at ASC
    `).all(ticketId)

    // Get ticket files/attachments
    const attachments = db.prepare(`
      SELECT
        f.id,
        f.filename,
        f.original_filename,
        f.file_size,
        f.mime_type,
        f.uploaded_at,
        u.name as uploaded_by
      FROM file_storage f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.entity_type = 'ticket' AND f.entity_id = ?
      ORDER BY f.uploaded_at DESC
    `).all(ticketId)

    // Get SLA information
    const slaInfo = db.prepare(`
      SELECT
        sp.name as sla_policy_name,
        sp.response_time_hours,
        sp.resolution_time_hours,
        sp.description as sla_description
      FROM tickets t
      LEFT JOIN sla_policies sp ON t.sla_policy_id = sp.id
      WHERE t.id = ?
    `).get(ticketId)

    // Calculate time metrics
    const timeMetrics = {
      created_hours_ago: 0,
      response_time_remaining: null,
      resolution_time_remaining: null,
      is_response_overdue: false,
      is_resolution_overdue: false
    }

    if (ticket.created_at) {
      const createdAt = new Date(ticket.created_at)
      const now = new Date()
      timeMetrics.created_hours_ago = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60))

      // Calculate response time remaining
      if (ticket.response_due_at) {
        const responseDue = new Date(ticket.response_due_at)
        const responseTimeRemaining = Math.floor((responseDue.getTime() - now.getTime()) / (1000 * 60 * 60))
        timeMetrics.response_time_remaining = responseTimeRemaining
        timeMetrics.is_response_overdue = responseTimeRemaining < 0
      }

      // Calculate resolution time remaining
      if (ticket.sla_due_at) {
        const resolutionDue = new Date(ticket.sla_due_at)
        const resolutionTimeRemaining = Math.floor((resolutionDue.getTime() - now.getTime()) / (1000 * 60 * 60))
        timeMetrics.resolution_time_remaining = resolutionTimeRemaining
        timeMetrics.is_resolution_overdue = resolutionTimeRemaining < 0
      }
    }

    // Get ticket history/audit trail (public events only)
    const history = db.prepare(`
      SELECT
        al.id,
        al.action,
        al.details,
        al.created_at,
        u.name as user_name,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'ticket'
        AND al.entity_id = ?
        AND al.action NOT LIKE '%internal%'
      ORDER BY al.created_at DESC
      LIMIT 20
    `).all(ticketId)

    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        time_metrics: timeMetrics,
        sla_info: slaInfo
      },
      comments,
      attachments,
      history
    })

  } catch (error) {
    console.error('Error fetching ticket details:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST method for adding customer comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticketId = parseInt(id)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: 'ID do ticket inválido' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content, customer_name, customer_email } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Conteúdo do comentário é obrigatório' },
        { status: 400 }
      )
    }

    // Verify ticket exists
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId)
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket não encontrado' },
        { status: 404 }
      )
    }

    // Add comment (from customer perspective, so user_id might be null)
    const result = db.prepare(`
      INSERT INTO comments (
        ticket_id,
        content,
        is_internal,
        created_at,
        user_id
      ) VALUES (?, ?, 0, datetime('now'), NULL)
    `).run(ticketId, content.trim())

    // Update ticket's updated_at timestamp
    db.prepare(`
      UPDATE tickets
      SET updated_at = datetime('now')
      WHERE id = ?
    `).run(ticketId)

    // Log the action
    db.prepare(`
      INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        details,
        created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(
      'ticket',
      ticketId,
      'comment_added',
      JSON.stringify({
        comment_id: result.lastInsertRowid,
        author: customer_name || 'Cliente',
        email: customer_email || 'N/A',
        content_preview: content.substring(0, 100)
      })
    )

    return NextResponse.json({
      success: true,
      message: 'Comentário adicionado com sucesso',
      comment_id: result.lastInsertRowid
    })

  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}