/**
 * WhatsApp Statistics API
 * Get WhatsApp integration statistics and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { getWhatsAppStats } from '@/lib/integrations/whatsapp/storage';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET - Get WhatsApp statistics
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !['admin', 'manager', 'agent'].includes(authResult.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const stats = await getWhatsAppStats(days);

    return NextResponse.json({
      stats,
      period: {
        days,
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp stats', { error });
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
