import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { sanitizeRequestBody } from '@/lib/api/sanitize-middleware';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_COMMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let comments: Array<Record<string, unknown>> = []
    try {
      comments = await executeQuery<Record<string, unknown>>(`
        SELECT
          c.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = ? AND c.tenant_id = ?
        ORDER BY c.created_at ASC
      `, [ticketId, tenantContext.id])
    } catch {
      comments = await executeQuery<Record<string, unknown>>(`
        SELECT
          c.*,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = ? AND c.ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
        ORDER BY c.created_at ASC
      `, [ticketId, tenantContext.id])
    }

    return NextResponse.json({ comments });
  } catch (error) {
    logger.error('Erro ao buscar comentários', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_COMMENT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário tem acesso ao ticket
    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();

    // Sanitizar entrada do usuário para prevenir XSS
    const sanitized = await sanitizeRequestBody(body, {
      htmlFields: ['content'], // Permitir HTML básico em comentários
    });

    const { content, is_internal } = sanitized;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Conteúdo do comentário é obrigatório' }, { status: 400 });
    }

    // Apenas agentes e admins podem fazer comentários internos
    const internalComment = Boolean(is_internal) && ['agent', 'admin', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role);

    let commentId: number | undefined
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO comments (tenant_id, ticket_id, user_id, content, is_internal)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
      `, [tenantContext.id, ticketId, userContext.id, content.trim(), internalComment ? 1 : 0])
      commentId = inserted?.id
    } catch {
      const result = await executeRun(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal)
        VALUES (?, ?, ?, ?)
      `, [ticketId, userContext.id, content.trim(), internalComment ? 1 : 0])
      if (typeof result.lastInsertRowid === 'number') {
        commentId = result.lastInsertRowid
      }
    }

    const comment = commentId
      ? await executeQueryOne<Record<string, unknown>>('SELECT * FROM comments WHERE id = ?', [commentId])
      : null

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    logger.error('Erro ao criar comentário', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
