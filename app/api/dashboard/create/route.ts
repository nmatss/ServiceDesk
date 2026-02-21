import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * POST /api/dashboard/create
 * Create a new dashboard configuration
 */
export async function POST(req: NextRequest) {
  try {
    const guard = requireTenantUserContext(req);
    if (guard.response) return guard.response;
    const { userId } = guard.auth!;

    const body = await req.json();
    const {
      name,
      description,
      config,
      is_default = false,
      is_shared = false
    } = body;

    if (!name || !config) {
      return NextResponse.json(
        { error: 'Name and config are required' },
        { status: 400 }
      );
    }

    // Validate config structure
    if (!config.widgets || !Array.isArray(config.widgets)) {
      return NextResponse.json(
        { error: 'Invalid config structure: widgets array is required' },
        { status: 400 }
      );
    }

    // If setting as default, unset any existing default for this user
    if (is_default) {
      await executeRun(`
        UPDATE dashboards
        SET is_default = 0
        WHERE user_id = ? AND is_default = 1
      `, [userId]);
    }

    // Create dashboard
    let createdDashboardId: number | undefined;
    const configJson = JSON.stringify(config);
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO dashboards (
          name,
          description,
          config,
          user_id,
          is_default,
          is_shared,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [
        name,
        description || null,
        configJson,
        userId,
        is_default ? 1 : 0,
        is_shared ? 1 : 0
      ]);
      createdDashboardId = inserted?.id;
    } catch {
      const result = await executeRun(`
        INSERT INTO dashboards (
          name,
          description,
          config,
          user_id,
          is_default,
          is_shared,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        name,
        description || null,
        configJson,
        userId,
        is_default ? 1 : 0,
        is_shared ? 1 : 0
      ]);
      if (typeof result.lastInsertRowid === 'number') {
        createdDashboardId = result.lastInsertRowid;
      }
    }

    if (!createdDashboardId) {
      return NextResponse.json(
        { error: 'Failed to create dashboard' },
        { status: 500 }
      );
    }

    // Fetch created dashboard
    const dashboard = await executeQueryOne<{
      id: number
      name: string
      description: string | null
      config: string
      user_id: number
      is_default: number | boolean
      is_shared: number | boolean
      created_at: string
      updated_at: string
    }>(`
      SELECT * FROM dashboards WHERE id = ?
    `, [createdDashboardId]);

    if (!dashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found after creation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dashboard: {
        ...dashboard,
        config: JSON.parse(dashboard.config)
      }
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating dashboard', error);
    return NextResponse.json(
      { error: 'Failed to create dashboard' },
      { status: 500 }
    );
  }
}
