/**
 * WhatsApp Statistics API
 * Get WhatsApp integration statistics and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
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
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'manager', 'agent'] });
    if (guard.response) return guard.response;

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
