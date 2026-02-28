/**
 * System Settings Admin API
 * Endpoint for managing system configuration settings
 *
 * GET /api/admin/settings - List all settings
 * POST /api/admin/settings - Update settings
 * DELETE /api/admin/settings/:key - Delete a setting
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/admin/settings
 * Retrieve all system settings
 *
 * Query params:
 * - organizationId: Optional organization ID for tenant-specific settings
 * - includeEncrypted: Include encrypted values (false by default for security)
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication and admin role
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;

    // SECURITY: Use organizationId from auth context, never from request params
    const organizationId = guard.auth.organizationId;
    const { searchParams } = new URL(request.url);
    const includeEncrypted = searchParams.get('includeEncrypted') === 'true';

    // Get all settings with metadata
    let settings: Array<{
      id: number;
      key: string;
      value: string;
      description: string | null;
      type: string;
      is_public: boolean;
      is_encrypted: boolean;
      organization_id: number | null;
      updated_by: number | null;
      created_at: string;
      updated_at: string;
    }>;

    settings = await executeQuery(
      `SELECT * FROM system_settings WHERE organization_id = ? OR organization_id IS NULL ORDER BY key`,
      [organizationId]
    );

    // Filter out encrypted values unless explicitly requested
    const filteredSettings = settings.map(setting => {
      if (setting.is_encrypted && !includeEncrypted) {
        return {
          ...setting,
          value: '***encrypted***'
        };
      }
      return setting;
    });

    logger.info('System settings retrieved', {
      userId: guard.auth.userId,
      organizationId,
      settingsCount: filteredSettings.length
    });

    return NextResponse.json({
      success: true,
      settings: filteredSettings,
      count: filteredSettings.length
    });

  } catch (error) {
    logger.error('Error retrieving system settings', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve system settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings
 * Create or update system settings
 *
 * Body:
 * {
 *   settings: [
 *     { key: string, value: string, organizationId?: number }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication and admin role
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;

    const body = await request.json();
    const { settings } = body;

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected array of settings.' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // SECURITY: Use organizationId from auth context, never from request body
    const organizationId = guard.auth.organizationId;

    for (const setting of settings) {
      const { key, value } = setting;

      if (!key || value === undefined) {
        errors.push({ key, error: 'Missing key or value' });
        continue;
      }

      try {
        await executeRun(
          `INSERT INTO system_settings (key, value, organization_id, updated_by, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key, organization_id) DO UPDATE SET
            value = excluded.value,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
          [key, value, organizationId, guard.auth.userId]
        );

        results.push({ key, success: true });

        logger.info('System setting updated', {
          key,
          userId: guard.auth.userId,
          organizationId
        });
      } catch (err) {
        errors.push({ key, error: String(err) });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated: results.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    logger.error('Error updating system settings', { error });
    return NextResponse.json(
      { error: 'Failed to update system settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 * Update a single system setting
 *
 * Body:
 * {
 *   key: string,
 *   value: string,
 *   organizationId?: number
 * }
 */
export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication and admin role
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, value' },
        { status: 400 }
      );
    }

    // SECURITY: Use organizationId from auth context, never from request body
    const organizationId = guard.auth.organizationId;

    await executeRun(
      `INSERT INTO system_settings (key, value, organization_id, updated_by, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key, organization_id) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP`,
      [key, value, organizationId, guard.auth.userId]
    );

    logger.info('System setting updated', {
      key,
      userId: guard.auth.userId,
      organizationId
    });

    // Get the updated value to return
    const updatedSetting = await executeQueryOne<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = ? AND organization_id = ? LIMIT 1`,
      [key, organizationId]
    );

    return NextResponse.json({
      success: true,
      key,
      value: updatedSetting?.value ?? value
    });

  } catch (error) {
    logger.error('Error updating system setting', { error });
    return NextResponse.json(
      { error: 'Failed to update system setting' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/settings
 * Delete a system setting
 *
 * Query params:
 * - key: Setting key to delete
 * - organizationId: Optional organization ID
 */
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication and admin role
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Missing required parameter: key' },
        { status: 400 }
      );
    }

    // SECURITY: Use organizationId from auth context, never from request params
    const organizationId = guard.auth.organizationId;

    const result = await executeRun(
      `DELETE FROM system_settings
      WHERE key = ? AND organization_id = ?`,
      [key, organizationId]
    );

    if (result.changes > 0) {
      logger.info('System setting deleted', {
        key,
        userId: guard.auth.userId,
        organizationId: guard.auth.organizationId
      });

      return NextResponse.json({
        success: true,
        key
      });
    } else {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    logger.error('Error deleting system setting', { error });
    return NextResponse.json(
      { error: 'Failed to delete system setting' },
      { status: 500 }
    );
  }
}
