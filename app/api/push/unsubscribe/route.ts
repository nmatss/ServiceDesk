import { NextRequest, NextResponse } from 'next/server';
import dbConnection from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

/**
 * POST /api/push/unsubscribe
 * Unsubscribe from push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    const db = dbConnection;

    // Soft delete - mark as inactive
    const result = db.prepare(`
      UPDATE push_subscriptions
      SET is_active = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE endpoint = ? AND user_id = ?
    `).run(endpoint, authResult.user.id);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    logger.info(`Push subscription removed for user ${authResult.user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed successfully',
    });
  } catch (error) {
    logger.error('Push unsubscribe error', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
