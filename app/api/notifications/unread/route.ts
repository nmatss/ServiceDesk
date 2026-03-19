import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun, sqlNow, sqlDatetimeSubMinutes, sqlDatetimeSubHours, sqlFalse, sqlTrue } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse
    // Buscar notificações não lidas do usuário
    // Note: user_id already provides tenant isolation since users belong to specific organizations
    const notifications = await executeQuery(`
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
          WHEN created_at > ${sqlDatetimeSubMinutes(5)} THEN 'new'
          WHEN created_at > ${sqlDatetimeSubHours(1)} THEN 'recent'
          ELSE 'old'
        END as urgency
      FROM notifications
      WHERE user_id = ? AND is_read = ${sqlFalse()}
      ORDER BY created_at DESC
      LIMIT 50
    `, [auth.userId])

    // Contar total de não lidas
    const unreadCount = await executeQueryOne(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = ${sqlFalse()}
    `, [auth.userId])

    // Contar por tipo
    const countByType = await executeQuery(`
      SELECT
        type,
        COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = ${sqlFalse()}
      GROUP BY type
    `, [auth.userId])

    // Formatar notificações
    interface NotificationRow { id: number; type: string; title: string; message: string; data: string | null; severity: string; urgency: string; is_read: boolean | number; created_at: string }
    interface FormattedNotification { id: number; type: string; title: string; message: string; data: Record<string, unknown>; severity: string; urgency: string; isRead: boolean; createdAt: string; actionUrl: string; icon: string }
    const formattedNotifications: FormattedNotification[] = notifications.map((notification: NotificationRow) => {
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
      new: formattedNotifications.filter((n) => n.urgency === 'new'),
      recent: formattedNotifications.filter((n) => n.urgency === 'recent'),
      old: formattedNotifications.filter((n) => n.urgency === 'old')
    }

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      groupedByUrgency,
      unreadCount: (unreadCount as { count?: number } | undefined)?.count || 0,
      countByType: countByType.reduce((acc: Record<string, number>, item: { type: string; count: number }) => {
        acc[item.type] = item.count
        return acc
      }, {} as Record<string, number>),
      summary: {
        total: formattedNotifications.length,
        high: formattedNotifications.filter((n) => n.severity === 'error').length,
        medium: formattedNotifications.filter((n) => n.severity === 'warning').length,
        low: formattedNotifications.filter((n) => n.severity === 'info').length
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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse

    const { notificationIds, markAll = false } = await request.json()
    if (markAll) {
      // Marcar todas como lidas
      const result = await executeRun(`
        UPDATE notifications
        SET is_read = ${sqlTrue()}, updated_at = ${sqlNow()}
        WHERE user_id = ? AND is_read = ${sqlFalse()}
      `, [auth.userId])

      return NextResponse.json({
        success: true,
        message: 'Todas as notificações foram marcadas como lidas',
        updatedCount: result.changes
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Marcar notificações específicas como lidas
      const placeholders = notificationIds.map(() => '?').join(',')
      const result = await executeRun(`
        UPDATE notifications
        SET is_read = ${sqlTrue()}, updated_at = ${sqlNow()}
        WHERE id IN (${placeholders}) AND user_id = ?
      `, [...notificationIds, auth.userId])

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
function generateActionUrl(type: string, data: Record<string, unknown>): string {
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