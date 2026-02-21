/**
 * Push Notification Subscription API Route
 * Handles push notification subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

interface SubscriptionRequest {
  subscription: PushSubscriptionJSON;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    language?: string;
  };
}

/**
 * Subscribe to push notifications
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const user = { id: guard.auth!.userId };

    const body: SubscriptionRequest = await request.json();
    const { subscription, deviceInfo } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    // Check if subscription already exists
    const existing = await executeQueryOne(
        `SELECT id FROM push_subscriptions
         WHERE user_id = ? AND endpoint = ?`,
      [user.id, subscription.endpoint]);

    if (existing) {
      // Update existing subscription
      await executeRun(`UPDATE push_subscriptions
         SET subscription_data = ?,
             device_info = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND endpoint = ?`, [JSON.stringify(subscription),
        JSON.stringify(deviceInfo),
        user.id,
        subscription.endpoint]);

      logger.info('Push subscription updated', {
        userId: user.id,
        endpoint: subscription.endpoint.substring(0, 50),
      });
    } else {
      // Create new subscription
      await executeRun(`INSERT INTO push_subscriptions
         (user_id, endpoint, subscription_data, device_info)
         VALUES (?, ?, ?, ?)`, [user.id,
        subscription.endpoint,
        JSON.stringify(subscription),
        JSON.stringify(deviceInfo)]);

      logger.info('New push subscription created', {
        userId: user.id,
        endpoint: subscription.endpoint.substring(0, 50),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription saved successfully',
    });
  } catch (error) {
    logger.error('Failed to save push subscription', error);

    return NextResponse.json(
      {
        error: 'Failed to save subscription',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Get user's push subscriptions
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardGet = requireTenantUserContext(request);
    if (guardGet.response) return guardGet.response;
    const userGet = { id: guardGet.auth!.userId };

    const subscriptions = await executeQuery(
        `SELECT id, endpoint, device_info, created_at, updated_at
         FROM push_subscriptions
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      [userGet.id]);

    return NextResponse.json({ subscriptions });
  } catch (error) {
    logger.error('Failed to retrieve push subscriptions', error);

    return NextResponse.json(
      {
        error: 'Failed to retrieve subscriptions',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardDel = requireTenantUserContext(request);
    if (guardDel.response) return guardDel.response;
    const userDel = { id: guardDel.auth!.userId };

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      // Delete specific subscription
      await executeRun(`DELETE FROM push_subscriptions
         WHERE user_id = ? AND endpoint = ?`, [userDel.id, endpoint]);

      logger.info('Push subscription deleted', {
        userId: userDel.id,
        endpoint: endpoint.substring(0, 50),
      });
    } else {
      // Delete all subscriptions for user
      await executeRun(`DELETE FROM push_subscriptions WHERE user_id = ?`, [userDel.id]);

      logger.info('All push subscriptions deleted', { userId: userDel.id });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription removed successfully',
    });
  } catch (error) {
    logger.error('Failed to delete push subscription', error);

    return NextResponse.json(
      {
        error: 'Failed to delete subscription',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
