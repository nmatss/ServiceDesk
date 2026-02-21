import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
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

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticket_id')
    const commentId = searchParams.get('comment_id')

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

    const ticket = await executeQueryOne(ticketQuery, ticketParams)

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // Build query for attachments
    let attachmentsQuery = `
      SELECT
        a.id,
        a.filename,
        a.original_name,
        a.mime_type,
        a.size,
        a.created_at,
        a.file_path,
        a.is_public,
        u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id AND u.tenant_id = ?
      WHERE a.ticket_id = ? AND a.tenant_id = ?
    `
    const queryParams = [tenantContext.id, parseInt(ticketId), tenantContext.id]

    if (commentId) {
      attachmentsQuery += ' AND a.comment_id = ?'
      queryParams.push(parseInt(commentId))
    }

    attachmentsQuery += ' ORDER BY a.created_at ASC'

    const attachments = await executeQuery(attachmentsQuery, queryParams)

    return NextResponse.json({
      success: true,
      attachments
    })
  } catch (error) {
    logger.error('Error fetching attachments', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
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

    const {
      ticket_id,
      filename,
      original_name,
      mime_type,
      size,
      file_path,
      comment_id,
      is_public
    } = await request.json()

    if (!ticket_id || !filename || !original_name || !mime_type || !size) {
      return NextResponse.json(
        { error: 'ticket_id, filename, original_name, mime_type e size são obrigatórios' },
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

    const ticket = await executeQueryOne(ticketQuery, ticketParams)

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    // If comment_id is provided, verify it exists and belongs to the ticket
    if (comment_id) {
      const comment = await executeQueryOne('SELECT id FROM comments WHERE id = ? AND ticket_id = ? AND tenant_id = ?', [comment_id, ticket_id, tenantContext.id])

      if (!comment) {
        return NextResponse.json(
          { error: 'Comentário não encontrado' },
          { status: 404 }
        )
      }
    }

    // Create attachment record
    const result = await executeRun(`
      INSERT INTO attachments (ticket_id, filename, original_name, mime_type,
                              size, uploaded_by, file_path, comment_id,
                              is_public, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [ticket_id,
      filename,
      original_name,
      mime_type,
      size,
      userContext.id,
      file_path || null,
      comment_id || null,
      (is_public || false) ? 1 : 0,
      tenantContext.id])

    // Get created attachment with user info
    const newAttachment = await executeQueryOne(`
      SELECT
        a.id,
        a.filename,
        a.original_name,
        a.mime_type,
        a.size,
        a.created_at,
        a.file_path,
        a.is_public,
        u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id AND u.tenant_id = ?
      WHERE a.id = ?
    `, [tenantContext.id, result.lastInsertRowid])

    return NextResponse.json({
      success: true,
      attachment: newAttachment
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating attachment', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}