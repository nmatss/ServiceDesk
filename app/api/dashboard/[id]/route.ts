import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/dashboard/[id]
 * Load a specific dashboard configuration
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = requireTenantUserContext(req);
    if (guard.response) return guard.response;
    const { userId } = guard.auth!;

    const dashboardId = params.id;

    // Fetch dashboard from database
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
      SELECT
        id,
        name,
        description,
        config,
        user_id,
        is_default,
        is_shared,
        created_at,
        updated_at
      FROM dashboards
      WHERE id = ? AND (user_id = ? OR is_shared = 1)
    `, [dashboardId, userId]);

    if (!dashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      dashboard: {
        ...dashboard,
        config: JSON.parse(dashboard.config)
      }
    });
  } catch (error) {
    logger.error('Error loading dashboard', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dashboard/[id]
 * Update a dashboard configuration
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = requireTenantUserContext(req);
    if (guard.response) return guard.response;
    const { userId, role } = guard.auth!;

    const dashboardId = params.id;
    const body = await req.json();
    const { name, description, config, is_shared } = body;

    // Verify ownership
    const existingDashboard = await executeQueryOne<{ user_id: number }>(`
      SELECT user_id FROM dashboards WHERE id = ?
    `, [dashboardId]);

    if (!existingDashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      );
    }

    if (existingDashboard.user_id !== userId && role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this dashboard' },
        { status: 403 }
      );
    }

    // Update dashboard
    await executeRun(`
      UPDATE dashboards
      SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        config = COALESCE(?, config),
        is_shared = COALESCE(?, is_shared),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name || null,
      description || null,
      config ? JSON.stringify(config) : null,
      is_shared !== undefined ? (is_shared ? 1 : 0) : null,
      dashboardId
    ]);

    // Fetch updated dashboard
    const updatedDashboard = await executeQueryOne<{
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
    `, [dashboardId]);

    if (!updatedDashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      dashboard: {
        ...updatedDashboard,
        config: JSON.parse(updatedDashboard.config)
      }
    });
  } catch (error) {
    logger.error('Error updating dashboard', error);
    return NextResponse.json(
      { error: 'Failed to update dashboard' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/[id]
 * Delete a dashboard
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = requireTenantUserContext(req);
    if (guard.response) return guard.response;
    const { userId, role } = guard.auth!;

    const dashboardId = params.id;

    // Verify ownership
    const existingDashboard = await executeQueryOne<{ user_id: number; is_default: number | boolean }>(`
      SELECT user_id, is_default FROM dashboards WHERE id = ?
    `, [dashboardId]);

    if (!existingDashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      );
    }

    if (existingDashboard.user_id !== userId && role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this dashboard' },
        { status: 403 }
      );
    }

    if (existingDashboard.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete default dashboard' },
        { status: 400 }
      );
    }

    // Delete dashboard
    await executeRun(`DELETE FROM dashboards WHERE id = ?`, [dashboardId]);

    return NextResponse.json({
      success: true,
      message: 'Dashboard deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting dashboard', error);
    return NextResponse.json(
      { error: 'Failed to delete dashboard' },
      { status: 500 }
    );
  }
}
