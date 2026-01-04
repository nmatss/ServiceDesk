import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

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
    // Buscar notificações não lidas do usuário
    // Note: user_id already provides tenant isolation since users belong to specific organizations
    const notifications = db.prepare(`
      SELECT
        id,
        type,
        title,
        message,
        data,
        is_read,
        created_at,
        CASE
          WHEN type = 'ticket_assigned' THEN 'info'
          WHEN type = 'ticket_updated' THEN 'warning'
          WHEN type = 'ticket_resolved' THEN 'success'
          WHEN type = 'ticket_escalated' THEN 'error'
          WHEN type = 'sla_warning' THEN 'warning'
          WHEN type = 'sla_breach' THEN 'error'
          WHEN type = 'comment_added' THEN 'info'
          WHEN type = 'system_alert' THEN 'error'
          ELSE 'info'
        END as severity,
        CASE
          WHEN created_at > datetime('now', '-5 minutes') THEN 'new'
          WHEN created_at > datetime('now', '-1 hour') THEN 'recent'
          ELSE 'old'
        END as urgency
      FROM notifications
      WHERE user_id = ? AND is_read = 0
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userContext.id)

    // Contar total de não lidas
    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userContext.id)

    // Contar por tipo
    const countByType = db.prepare(`
      SELECT
        type,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
      GROUP BY type
    `).all(userContext.id)

    // Formatar notificações
    const formattedNotifications = notifications.map((notification: any) => {
      let data = {}
      try {
        data = notification.data ? JSON.parse(notification.data) : {}
      } catch (e) {
        data = {}
      }

      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data,
        severity: notification.severity,
        urgency: notification.urgency,
        isRead: Boolean(notification.is_read),
        createdAt: notification.created_at,
        // Gerar URL baseada no tipo
        actionUrl: generateActionUrl(notification.type, data),
        // Gerar ícone baseado no tipo
        icon: getNotificationIcon(notification.type)
      }
    })

    // Agrupar por urgência
    const groupedByUrgency = {
      new: formattedNotifications.filter((n: any) => n.urgency === 'new'),
      recent: formattedNotifications.filter((n: any) => n.urgency === 'recent'),
      old: formattedNotifications.filter((n: any) => n.urgency === 'old')
    }

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      groupedByUrgency,
      unreadCount: (unreadCount as any)?.count || 0,
      countByType: countByType.reduce((acc: any, item: any) => {
        acc[item.type] = item.count
        return acc
      }, {} as Record<string, number>),
      summary: {
        total: formattedNotifications.length,
        high: formattedNotifications.filter((n: any) => n.severity === 'error').length,
        medium: formattedNotifications.filter((n: any) => n.severity === 'warning').length,
        low: formattedNotifications.filter((n: any) => n.severity === 'info').length
      }
    })

  } catch (error) {
    logger.error('Error fetching unread notifications', error)
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

    const { notificationIds, markAll = false } = await request.json()
    if (markAll) {
      // Marcar todas como lidas
      const result = db.prepare(`
        UPDATE notifications
        SET is_read = 1, updated_at = datetime('now')
        WHERE user_id = ? AND is_read = 0
      `).run(userContext.id)

      return NextResponse.json({
        success: true,
        message: 'Todas as notificações foram marcadas como lidas',
        updatedCount: result.changes
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Marcar notificações específicas como lidas
      const placeholders = notificationIds.map(() => '?').join(',')
      const result = db.prepare(`
        UPDATE notifications
        SET is_read = 1, updated_at = datetime('now')
        WHERE id IN (${placeholders}) AND user_id = ?
      `).run(...notificationIds, userContext.id)

      return NextResponse.json({
        success: true,
        message: `${result.changes} notificações marcadas como lidas`,
        updatedCount: result.changes
      })
    } else {
      return NextResponse.json(
        { error: 'notificationIds deve ser um array ou markAll deve ser true' },
        { status: 400 }
      )
    }

  } catch (error) {
    logger.error('Error marking notifications as read', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Funções auxiliares
function generateActionUrl(type: string, data: any): string {
  switch (type) {
    case 'ticket_assigned':
    case 'ticket_updated':
    case 'ticket_resolved':
    case 'comment_added':
      return data.ticketId ? `/tickets/${data.ticketId}` : '/tickets'
    case 'ticket_escalated':
      return data.ticketId ? `/tickets/${data.ticketId}` : '/admin/tickets'
    case 'sla_warning':
    case 'sla_breach':
      return '/admin/sla'
    case 'system_alert':
      return '/admin/settings'
    default:
      return '/dashboard'
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'ticket_assigned':
      return 'UserIcon'
    case 'ticket_updated':
      return 'PencilIcon'
    case 'ticket_resolved':
      return 'CheckCircleIcon'
    case 'ticket_escalated':
      return 'ExclamationTriangleIcon'
    case 'comment_added':
      return 'ChatBubbleLeftIcon'
    case 'sla_warning':
      return 'ClockIcon'
    case 'sla_breach':
      return 'ExclamationCircleIcon'
    case 'system_alert':
      return 'BellAlertIcon'
    default:
      return 'InformationCircleIcon'
  }
}