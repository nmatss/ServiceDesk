import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/dashboard/list
 * List all dashboards accessible to the user
 */
export async function GET(req: NextRequest) {
  try {
    const guard = requireTenantUserContext(req);
    if (guard.response) return guard.response;
    const { userId } = guard.auth!;

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const includeShared = searchParams.get('includeShared') !== 'false';
    const includeDefault = searchParams.get('includeDefault') !== 'false';

    // Build query
    let query = `
      SELECT
        id,
        name,
        description,
        user_id,
        is_default,
        is_shared,
        created_at,
        updated_at
      FROM dashboards
      WHERE user_id = ?
    `;

    const params: Array<number> = [userId];

    if (includeShared) {
      query += ` OR is_shared = 1`;
    }

    query += ` ORDER BY is_default DESC, updated_at DESC`;

    const dashboards = await executeQuery<{
      id: number
      name: string
      description: string | null
      user_id: number
      is_default: number | boolean
      is_shared: number | boolean
      created_at: string
      updated_at: string
    }>(query, params);

    // Filter based on options
    let filteredDashboards = dashboards;

    if (!includeDefault) {
      filteredDashboards = filteredDashboards.filter((d) => !d.is_default);
    }

    return NextResponse.json({
      success: true,
      dashboards: filteredDashboards.map((dashboard) => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        user_id: dashboard.user_id,
        is_default: Boolean(dashboard.is_default),
        is_shared: Boolean(dashboard.is_shared),
        created_at: dashboard.created_at,
        updated_at: dashboard.updated_at,
        is_owner: dashboard.user_id === userId
      }))
    });
  } catch (error) {
    logger.error('Error listing dashboards', error);
    return NextResponse.json(
      { error: 'Failed to list dashboards' },
      { status: 500 }
    );
  }
}
