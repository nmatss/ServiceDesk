import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';
import webpush from 'web-push';

/**
 * POST /api/push/send
 * Send push notification to user(s)
 * Admin/Agent only
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and agents can send push notifications
    if (authResult.user.role !== 'admin' && authResult.user.role !== 'agent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, userIds, title, body: messageBody, data, tag, icon, requireInteraction } = body;

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Configure web-push with VAPID keys
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@servicedesk.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      logger.error('VAPID keys not configured');
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    const db = getDB();

    // Determine target users
    let targetUserIds: number[] = [];
    if (userId) {
      targetUserIds = [userId];
    } else if (userIds && Array.isArray(userIds)) {
      targetUserIds = userIds;
    } else {
      return NextResponse.json(
        { error: 'userId or userIds is required' },
        { status: 400 }
      );
    }

    // Get active push subscriptions for target users
    const placeholders = targetUserIds.map(() => '?').join(',');
    const subscriptions = db.prepare(`
      SELECT
        id,
        user_id,
        endpoint,
        p256dh_key,
        auth_key
      FROM push_subscriptions
      WHERE user_id IN (${placeholders})
        AND is_active = 1
    `).all(...targetUserIds) as Array<{
      id: number;
      user_id: number;
      endpoint: string;
      p256dh_key: string;
      auth_key: string;
    }>;

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscriptions found',
        sent: 0,
      });
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon: icon || '/icon-192.png',
      badge: '/icon-96.png',
      tag: tag || 'servicedesk-notification',
      data: data || {},
      requireInteraction: requireInteraction || false,
      timestamp: Date.now(),
    });

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          };

          await webpush.sendNotification(pushSubscription, payload);

          // Update last_used_at
          db.prepare(`
            UPDATE push_subscriptions
            SET last_used_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(subscription.id);

          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          logger.error(`Failed to send push notification to subscription ${subscription.id}`, error);

          // If subscription is invalid (410 Gone), mark as inactive
          if (error.statusCode === 410) {
            db.prepare(`
              UPDATE push_subscriptions
              SET is_active = 0,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(subscription.id);
          }

          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info(`Push notifications sent: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    logger.error('Send push notification error', error);
    return NextResponse.json(
      { error: 'Failed to send push notifications' },
      { status: 500 }
    );
  }
}
