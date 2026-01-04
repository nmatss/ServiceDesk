import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

// GET - Buscar notificações do usuário
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE n.user_id = ? AND n.tenant_id = ?';
    const params = [userContext.id, tenantContext.id];

    if (unreadOnly) {
      whereClause += ' AND n.is_read = 0';
    }

    const notifications = db.prepare(`
      SELECT
        n.*,
        t.title as ticket_title,
        t.id as ticket_number
      FROM notifications n
      LEFT JOIN tickets t ON n.ticket_id = t.id AND t.tenant_id = ?
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(tenantContext.id, ...params, limit, offset);

    // Contar total de notificações
    const totalQuery = db.prepare(`
      SELECT COUNT(*) as total
      FROM notifications n
      ${whereClause}
    `);
    const { total } = totalQuery.get(...params) as { total: number };

    // Contar não lidas
    const unreadQuery = db.prepare(`
      SELECT COUNT(*) as unread
      FROM notifications n
      WHERE n.user_id = ? AND n.tenant_id = ? AND n.is_read = 0
    `);
    const { unread } = unreadQuery.get(userContext.id, tenantContext.id) as { unread: number };

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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    // Verificar se usuário tem permissão para criar notificações
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, title, message, type = 'info', data } = body;

    // Validar dados
    if (!user_id || !title || !message) {
      return NextResponse.json({ error: 'user_id, title e message são obrigatórios' }, { status: 400 });
    }

    // Verificar se o usuário existe e pertence ao mesmo tenant
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(user_id, tenantContext.id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado ou não pertence ao tenant' }, { status: 404 });
    }

    // Criar notificação com tenant_id
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, data, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(user_id, title, message, type, data ? JSON.stringify(data) : null, tenantContext.id);

    return NextResponse.json({
      id: result.lastInsertRowid,
      message: 'Notificação criada com sucesso'
    }, { status: 201 });
  } catch (error) {
    logger.error('Erro ao criar notificação', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    if (mark_all_read) {
      // Marcar todas as notificações do usuário como lidas (apenas do tenant)
      const stmt = db.prepare(`
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = ? AND tenant_id = ? AND is_read = FALSE
      `);
      const result = stmt.run(userContext.id, tenantContext.id);

      return NextResponse.json({
        message: `${result.changes} notificações marcadas como lidas`
      });
    } else if (notification_id) {
      // Marcar notificação específica como lida (verificando tenant)
      const stmt = db.prepare(`
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = ? AND user_id = ? AND tenant_id = ?
      `);
      const result = stmt.run(notification_id, userContext.id, tenantContext.id);

      if (result.changes === 0) {
        return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Notificação marcada como lida'
      });
    } else {
      return NextResponse.json({ error: 'notification_id ou mark_all_read é obrigatório' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Erro ao atualizar notificação', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
