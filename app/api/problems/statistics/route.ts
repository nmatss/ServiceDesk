/**
 * Problem Statistics API Route
 * GET: Get problem and known error statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { resolveTenantFromRequest } from '@/lib/tenant/resolver';
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
    // Authenticate via httpOnly cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Only agents and admins can view statistics
    if (payload.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Resolve tenant
    const tenant = await resolveTenantFromRequest(request);
    if (!tenant?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 400 }
      );
    }

    // Fetch statistics
    const [problemStats, knownErrorStats] = await Promise.all([
      problemQueries.getProblemStatistics(tenant.organizationId),
      problemQueries.getKnownErrorStatistics(tenant.organizationId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        problems: problemStats,
        known_errors: knownErrorStats,
      },
    });
  } catch (error) {
    console.error('Error fetching problem statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
