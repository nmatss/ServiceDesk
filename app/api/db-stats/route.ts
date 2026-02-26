/**
 * Database Performance Statistics API
 * Exposes query performance metrics, cache stats, and pool stats
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require admin authentication
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;
    // Database table row counts
    const tables = ['tickets', 'users', 'comments', 'notifications', 'sla_tracking'];
    const dbStats: Record<string, { count: number }> = {};

    for (const table of tables) {
      try {
        const result = await executeQuery<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`,
          []
        );
        dbStats[table] = { count: result[0]?.count || 0 };
      } catch {
        dbStats[table] = { count: 0 };
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: {
        tables: dbStats,
      },
      health: {
        status: 'healthy',
      },
    });
  } catch (error) {
    logger.error('Failed to fetch database stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database statistics' },
      { status: 500 }
    );
  }
}
