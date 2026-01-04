import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger'
import { validateTicketAccessToken, recordTokenUsage } from '@/lib/db/queries'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schemas
const ticketIdSchema = z.coerce.number().int().min(1).max(2147483647)
const tokenSchema = z.string().uuid()

/**
 * GET /api/portal/tickets/[id]?token=xxx
 *
 * PUBLIC ENDPOINT: Allows unauthenticated access via secure UUID token
 * Fetches ticket details for portal users without requiring login
 *
 * SECURITY:
 * - Requires valid UUID token in query parameter
 * - Token must not be expired or revoked
 * - Token must match the requested ticket ID
 * - Only public data is returned (no internal comments)
 *
 * @param id - The ticket ID
 * @param token - UUID v4 access token (query parameter)
 * @returns Ticket details with comments and attachments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Rate limiting
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
    if (rateLimitResponse) return rateLimitResponse;
    // 1. VALIDATE TICKET ID
    const { id } = await params
    const ticketIdResult = ticketIdSchema.safeParse(id)

    if (!ticketIdResult.success) {
      logger.warn('Invalid ticket ID in portal request', { id })
      return NextResponse.json(
        { success: false, error: 'ID do ticket inválido' },
        { status: 400 }
      )
    }

    const ticketId = ticketIdResult.data

    // 2. VALIDATE ACCESS TOKEN
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      logger.warn('Missing access token in portal ticket request', { ticketId })
      return NextResponse.json(
        { success: false, error: 'Token de acesso obrigatório' },
        { status: 401 }
      )
    }

    // 3. VALIDATE TOKEN FORMAT
    const tokenResult = tokenSchema.safeParse(token)
    if (!tokenResult.success) {
      logger.warn('Invalid token format', { token: token.substring(0, 8) })
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // 4. VERIFY TOKEN IS VALID AND MATCHES TICKET
    const tokenData = validateTicketAccessToken(token, ticketId)

    if (!tokenData) {
      logger.warn('Invalid or expired token', {
        ticketId,
        token: token.substring(0, 8)
      })
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 403 }
      )
    }

    // 5. RECORD TOKEN USAGE
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    recordTokenUsage(tokenData.id, {
      ip: clientIp,
      userAgent,
      timestamp: new Date().toISOString()
    })

    // 6. GET TICKET DETAILS
    // Note: We verify ticket_id matches token to prevent token reuse for other tickets
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
    `).get(ticketId) as { created_at?: string; response_due_at?: string; sla_due_at?: string } | undefined

    if (!ticket) {
      logger.warn('Ticket not found for valid token', { ticketId })
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
    `).get(ticketId) as Record<string, unknown> | undefined

    // Calculate time metrics
    const timeMetrics: {
      created_hours_ago: number
      response_time_remaining: number | null
      resolution_time_remaining: number | null
      is_response_overdue: boolean
      is_resolution_overdue: boolean
    } = {
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
    logger.error('Error fetching ticket details', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/portal/tickets/[id]?token=xxx
 *
 * PUBLIC ENDPOINT: Allows customers to add comments via token
 * Adds a public comment to a ticket without requiring authentication
 *
 * SECURITY:
 * - Requires valid UUID token in query parameter
 * - Token must not be expired or revoked
 * - Token must match the requested ticket ID
 * - Comments are always marked as public (is_internal = 0)
 *
 * @param id - The ticket ID
 * @param token - UUID v4 access token (query parameter)
 * @param content - Comment content (required)
 * @returns Success message with comment ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Rate limiting
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
    if (rateLimitResponse) return rateLimitResponse;
    // 1. VALIDATE TICKET ID
    const { id } = await params
    const ticketIdResult = ticketIdSchema.safeParse(id)

    if (!ticketIdResult.success) {
      logger.warn('Invalid ticket ID in portal comment request', { id })
      return NextResponse.json(
        { success: false, error: 'ID do ticket inválido' },
        { status: 400 }
      )
    }

    const ticketId = ticketIdResult.data

    // 2. VALIDATE ACCESS TOKEN
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      logger.warn('Missing access token in portal comment request', { ticketId })
      return NextResponse.json(
        { success: false, error: 'Token de acesso obrigatório' },
        { status: 401 }
      )
    }

    // 3. VALIDATE TOKEN FORMAT
    const tokenResult = tokenSchema.safeParse(token)
    if (!tokenResult.success) {
      logger.warn('Invalid token format in comment request', { token: token.substring(0, 8) })
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // 4. VERIFY TOKEN IS VALID AND MATCHES TICKET
    const tokenData = validateTicketAccessToken(token, ticketId)

    if (!tokenData) {
      logger.warn('Invalid or expired token in comment request', {
        ticketId,
        token: token.substring(0, 8)
      })
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 403 }
      )
    }

    // 5. VALIDATE REQUEST BODY
    const body = await request.json()
    const { content, customer_name, customer_email } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Conteúdo do comentário é obrigatório' },
        { status: 400 }
      )
    }

    // 6. VERIFY TICKET EXISTS
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId) as { id: number } | undefined
    if (!ticket) {
      logger.warn('Ticket not found for comment', { ticketId })
      return NextResponse.json(
        { success: false, error: 'Ticket não encontrado' },
        { status: 404 }
      )
    }

    // 7. ADD COMMENT (public comment, no user_id)
    // SECURITY: Comment is always public (is_internal = 0) for portal access
    const result = db.prepare(`
      INSERT INTO comments (
        ticket_id,
        content,
        is_internal,
        created_at,
        user_id
      ) VALUES (?, ?, 0, datetime('now'), NULL)
    `).run(ticketId, content.trim())

    // 8. UPDATE TICKET TIMESTAMP
    db.prepare(`
      UPDATE tickets
      SET updated_at = datetime('now')
      WHERE id = ?
    `).run(ticketId)

    // 9. LOG THE ACTION
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
        content_preview: content.substring(0, 100),
        via: 'portal_token'
      })
    )

    // 10. RECORD TOKEN USAGE FOR COMMENT
    recordTokenUsage(tokenData.id, {
      action: 'comment_added',
      comment_id: result.lastInsertRowid
    })

    logger.info('Portal comment added successfully', {
      ticketId,
      commentId: result.lastInsertRowid,
      customerName: customer_name || 'Unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Comentário adicionado com sucesso',
      comment_id: result.lastInsertRowid
    })

  } catch (error) {
    logger.error('Error adding comment', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}