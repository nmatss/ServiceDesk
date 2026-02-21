import { NextRequest } from 'next/server'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

// Poll interval for checking new notifications (ms)
const POLL_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_CONNECTION_TIME = 1800000; // 30 minutes (much longer than before)

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  ticket_id?: number;
  created_at: string;
  is_read: boolean;
}

/**
 * Fetch real notifications from database for user
 */
async function fetchUserNotifications(userId: number, tenantId: number, since: string): Promise<Notification[]> {
  try {
    // Check if notifications table exists
    const tableExists = await executeQueryOne(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='notifications'
    `);

    if (!tableExists) {
      return [];
    }

    const notifications = await executeQuery<Notification>(`
      SELECT id, type, title, message, ticket_id, created_at, is_read
      FROM notifications
      WHERE user_id = ?
        AND tenant_id = ?
        AND created_at > ?
        AND is_read = 0
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId, tenantId, since]);

    return notifications;
  } catch (error) {
    logger.error('Error fetching notifications', error);
    return [];
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId: number, tenantId: number): Promise<number> {
  try {
    const tableExists = await executeQueryOne(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='notifications'
    `);

    if (!tableExists) {
      return 0;
    }

    const result = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND tenant_id = ? AND is_read = 0
    `, [userId, tenantId]) || { count: 0 };

    return result.count;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting (use a more lenient limit for SSE)
  const rateLimitResponse = await applyRateLimit(request, {
    ...RATE_LIMITS.DEFAULT,
    max: 10, // Max 10 SSE connections per minute per user
    keyPrefix: 'sse:notifications'
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return new Response('Tenant não encontrado', { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return new Response('Usuário não autenticado', { status: 401 })
    }

    const encoder = new TextEncoder()
    let lastCheck = new Date().toISOString()

    const customReadable = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        // Heartbeat to keep connection alive
        const keepAlive = setInterval(() => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(': heartbeat\n\n'))
            } catch {
              cleanup();
            }
          }
        }, HEARTBEAT_INTERVAL)

        // Send notification helper
        const sendNotification = (data: unknown) => {
          if (isClosed) return;
          try {
            const message = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(message))
          } catch {
            cleanup();
          }
        }

        // Send initial connection message with unread count
        const unreadCount = await getUnreadCount(userContext.id, tenantContext.id);
        sendNotification({
          id: Date.now(),
          type: 'connection',
          message: 'Conectado ao sistema de notificações',
          timestamp: new Date().toISOString(),
          unread_count: unreadCount
        })

        // Poll for real notifications
        const pollNotifications = setInterval(async () => {
          if (isClosed) return;

          const notifications = await fetchUserNotifications(
            userContext.id,
            tenantContext.id,
            lastCheck
          );

          if (notifications.length > 0) {
            lastCheck = new Date().toISOString();

            // Send each notification
            for (const notification of notifications) {
              sendNotification({
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                ticket_id: notification.ticket_id,
                timestamp: notification.created_at,
                is_read: notification.is_read
              });
            }

            // Send updated unread count
            const newUnreadCount = await getUnreadCount(userContext.id, tenantContext.id);
            sendNotification({
              type: 'unread_count',
              count: newUnreadCount,
              timestamp: new Date().toISOString()
            });
          }
        }, POLL_INTERVAL)

        // Cleanup function
        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(keepAlive);
          clearInterval(pollNotifications);
          try {
            controller.close();
          } catch {
            // Connection already closed
          }
        }

        // Listen for abort signal
        request.signal.addEventListener('abort', cleanup)

        // Auto cleanup after max connection time (30 min - client should reconnect)
        setTimeout(cleanup, MAX_CONNECTION_TIME)
      }
    })

    const origin = request.headers.get('origin') || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization, X-Tenant-ID',
        'Access-Control-Allow-Credentials': 'true',
      },
    })
  } catch (error) {
    logger.error('Error in notifications SSE', error)
    return new Response('Erro interno do servidor', { status: 500 })
  }
}