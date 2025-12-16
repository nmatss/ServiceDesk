import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';
import { verifyAuth } from '@/lib/auth/sqlite-auth';

/**
 * GET /api/dashboard/list
 * List all dashboards accessible to the user
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);

    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const params: any[] = [authResult.user.id];

    if (includeShared) {
      query += ` OR is_shared = 1`;
    }

    query += ` ORDER BY is_default DESC, updated_at DESC`;

    const dashboards = db.prepare(query).all(...params);

    // Filter based on options
    let filteredDashboards = dashboards;

    if (!includeDefault) {
      filteredDashboards = filteredDashboards.filter((d: any) => !d.is_default);
    }

    return NextResponse.json({
      success: true,
      dashboards: filteredDashboards.map((dashboard: any) => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        user_id: dashboard.user_id,
        is_default: Boolean(dashboard.is_default),
        is_shared: Boolean(dashboard.is_shared),
        created_at: dashboard.created_at,
        updated_at: dashboard.updated_at,
        is_owner: dashboard.user_id === authResult.user!.id
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
