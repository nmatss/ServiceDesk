/**
 * Problem Statistics API Route
 * GET: Get problem and known error statistics
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import problemQueries from '@/lib/db/queries/problem-queries';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

/**
 * GET /api/problems/statistics
 * Get problem and known error statistics
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    // Only agents and admins can view statistics
    if (auth.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Fetch statistics
    const [problemStats, knownErrorStats] = await Promise.all([
      problemQueries.getProblemStatistics(auth.organizationId),
      problemQueries.getKnownErrorStatistics(auth.organizationId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        problems: problemStats,
        known_errors: knownErrorStats,
      },
    });
  } catch (error) {
    logger.error('Error fetching problem statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
