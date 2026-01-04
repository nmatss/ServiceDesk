/**
 * Push Notification Subscription API Route
 * Handles push notification subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { verifyAuthToken } from '@/lib/auth/sqlite-auth';
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authResult = await verifyAuthToken(authHeader.replace('Bearer ', ''));
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = authResult.user;

    const body: SubscriptionRequest = await request.json();
    const { subscription, deviceInfo } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    // Check if subscription already exists
    const existing = db
      .prepare(
        `SELECT id FROM push_subscriptions
         WHERE user_id = ? AND endpoint = ?`
      )
      .get(user.id, subscription.endpoint);

    if (existing) {
      // Update existing subscription
      db.prepare(
        `UPDATE push_subscriptions
         SET subscription_data = ?,
             device_info = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND endpoint = ?`
      ).run(
        JSON.stringify(subscription),
        JSON.stringify(deviceInfo),
        user.id,
        subscription.endpoint
      );

      logger.info('Push subscription updated', {
        userId: user.id,
        endpoint: subscription.endpoint.substring(0, 50),
      });
    } else {
      // Create new subscription
      db.prepare(
        `INSERT INTO push_subscriptions
         (user_id, endpoint, subscription_data, device_info)
         VALUES (?, ?, ?, ?)`
      ).run(
        user.id,
        subscription.endpoint,
        JSON.stringify(subscription),
        JSON.stringify(deviceInfo)
      );

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
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authResult = await verifyAuthToken(authHeader.replace('Bearer ', ''));
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = authResult.user;

    const subscriptions = db
      .prepare(
        `SELECT id, endpoint, device_info, created_at, updated_at
         FROM push_subscriptions
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(user.id);

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
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authResult = await verifyAuthToken(authHeader.replace('Bearer ', ''));
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = authResult.user;

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint) {
      // Delete specific subscription
      db.prepare(
        `DELETE FROM push_subscriptions
         WHERE user_id = ? AND endpoint = ?`
      ).run(user.id, endpoint);

      logger.info('Push subscription deleted', {
        userId: user.id,
        endpoint: endpoint.substring(0, 50),
      });
    } else {
      // Delete all subscriptions for user
      db.prepare(
        `DELETE FROM push_subscriptions WHERE user_id = ?`
      ).run(user.id);

      logger.info('All push subscriptions deleted', { userId: user.id });
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
