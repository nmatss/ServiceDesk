import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';
import { verifyAuth } from '@/lib/auth/sqlite-auth';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * POST /api/dashboard/create
 * Create a new dashboard configuration
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);

    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      db.prepare(`
        UPDATE dashboards
        SET is_default = 0
        WHERE user_id = ? AND is_default = 1
      `).run(authResult.user.id);
    }

    // Create dashboard
    const result = db.prepare(`
      INSERT INTO dashboards (
        name,
        description,
        config,
        user_id,
        is_default,
        is_shared,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      name,
      description || null,
      JSON.stringify(config),
      authResult.user.id,
      is_default ? 1 : 0,
      is_shared ? 1 : 0
    );

    // Fetch created dashboard
    const dashboard = db.prepare(`
      SELECT * FROM dashboards WHERE id = ?
    `).get(result.lastInsertRowid) as any;

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
