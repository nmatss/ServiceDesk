import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQuery, executeQueryOne, executeRun, sqlFalse } from '@/lib/db/adapter';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

// GET - Buscar notificações do usuário
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response } = requireTenantUserContext(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 100);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    let whereClause = 'WHERE n.user_id = ? AND n.tenant_id = ?';
    const params = [auth.userId, context.tenant.id];

    if (unreadOnly) {
      whereClause += ` AND n.is_read = ${sqlFalse()}`;
    }

    // Run all queries in parallel
    const [notifications, countResult] = await Promise.all([
      executeQuery(`
        SELECT
          n.*,
          t.title as ticket_title,
          t.id as ticket_number
        FROM notifications n
        LEFT JOIN tickets t ON n.ticket_id = t.id AND t.tenant_id = ?
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `, [context.tenant.id, ...params, limit, offset]),
      executeQueryOne<{ total: number; unread: number }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN n.is_read = ${sqlFalse()} THEN 1 ELSE 0 END) as unread
        FROM notifications n
        ${whereClause}
      `, params),
    ]);

    const total = countResult?.total || 0;
    const unread = countResult?.unread || 0;

    return NextResponse.json({
      success: true,
      notifications,
      pagination: {
        total,
        unread,
        limit,
        offset,
        hasMore: (offset + limit) < total
      }
    });
  } catch (error) {
    logger.error('Error getting notifications', error);
    return apiError('Erro interno do servidor', 500);
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response } = requireTenantUserContext(request);
    if (response) return response;

    // Verificar se usuário tem permissão para criar notificações
    if (!['super_admin', 'admin', 'tenant_admin', 'team_manager'].includes(auth.role)) {
      return apiError('Permissão insuficiente', 403);
    }

    const body = await request.json();
    const { user_id, title, message, type = 'info', data } = body;

    // Validar dados
    if (!user_id || !title || !message) {
      return apiError('user_id, title e message são obrigatórios', 400);
    }

    // Verificar se o usuário existe e pertence ao mesmo tenant
    const targetUser = await executeQueryOne('SELECT id FROM users WHERE id = ? AND tenant_id = ?', [user_id, context.tenant.id]);
    if (!targetUser) {
      return apiError('Usuário não encontrado ou não pertence ao tenant', 404);
    }

    const result = await executeRun(`
      INSERT INTO notifications (user_id, title, message, type, data, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user_id, title, message, type, data ? JSON.stringify(data) : null, context.tenant.id]);

    return NextResponse.json({
      id: result.lastInsertRowid,
      message: 'Notificação criada com sucesso'
    }, { status: 201 });
  } catch (error) {
    logger.error('Erro ao criar notificação', error);
    return apiError('Erro interno do servidor', 500);
  }
}

export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response } = requireTenantUserContext(request);
    if (response) return response;

    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    if (mark_all_read) {
      // Marcar todas as notificações do usuário como lidas (apenas do tenant)
      const result = await executeRun(`
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = ? AND tenant_id = ? AND is_read = FALSE
      `, [auth.userId, context.tenant.id]);

      return NextResponse.json({
        message: `${result.changes} notificações marcadas como lidas`
      });
    } else if (notification_id) {
      // Marcar notificação específica como lida (verificando tenant)
      const result = await executeRun(`
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = ? AND user_id = ? AND tenant_id = ?
      `, [notification_id, auth.userId, context.tenant.id]);

      if (result.changes === 0) {
        return apiError('Notificação não encontrada', 404);
      }

      return NextResponse.json({
        message: 'Notificação marcada como lida'
      });
    } else {
      return apiError('notification_id ou mark_all_read é obrigatório', 400);
    }
  } catch (error) {
    logger.error('Erro ao atualizar notificação', error);
    return apiError('Erro interno do servidor', 500);
  }
}
