import { NextRequest, NextResponse } from 'next/server';
import dbConnection from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * POST /api/push/subscribe
 * Subscribe user to push notifications
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys, deviceInfo } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required subscription data' },
        { status: 400 }
      );
    }

    const db = dbConnection;

    // Create push_subscriptions table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh_key TEXT NOT NULL,
        auth_key TEXT NOT NULL,
        user_agent TEXT,
        platform TEXT,
        language TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
    `);

    // Check if subscription already exists
    const existingSubscription = db.prepare(`
      SELECT id FROM push_subscriptions WHERE endpoint = ?
    `).get(endpoint);

    if (existingSubscription) {
      // Update existing subscription
      db.prepare(`
        UPDATE push_subscriptions
        SET user_id = ?,
            p256dh_key = ?,
            auth_key = ?,
            user_agent = ?,
            platform = ?,
            language = ?,
            updated_at = CURRENT_TIMESTAMP,
            is_active = 1
        WHERE endpoint = ?
      `).run(
        authResult.user.id,
        keys.p256dh,
        keys.auth,
        deviceInfo?.userAgent || null,
        deviceInfo?.platform || null,
        deviceInfo?.language || null,
        endpoint
      );

      logger.info(`Push subscription updated for user ${authResult.user.id}`);

      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully',
      });
    } else {
      // Insert new subscription
      const result = db.prepare(`
        INSERT INTO push_subscriptions (
          user_id, endpoint, p256dh_key, auth_key,
          user_agent, platform, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        authResult.user.id,
        endpoint,
        keys.p256dh,
        keys.auth,
        deviceInfo?.userAgent || null,
        deviceInfo?.platform || null,
        deviceInfo?.language || null
      );

      logger.info(`Push subscription created for user ${authResult.user.id}`);

      return NextResponse.json({
        success: true,
        message: 'Subscription created successfully',
        subscriptionId: result.lastInsertRowid,
      });
    }
  } catch (error) {
    logger.error('Push subscription error', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/push/subscribe
 * Get user's push subscriptions
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = dbConnection;

    const subscriptions = db.prepare(`
      SELECT
        id,
        endpoint,
        platform,
        language,
        created_at,
        last_used_at,
        is_active
      FROM push_subscriptions
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `).all(authResult.user.id);

    return NextResponse.json({
      subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    logger.error('Get push subscriptions error', error);
    return NextResponse.json(
      { error: 'Failed to get subscriptions' },
      { status: 500 }
    );
  }
}
