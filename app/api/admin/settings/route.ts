/**
 * System Settings Admin API
 * Endpoint for managing system configuration settings
 *
 * GET /api/admin/settings - List all settings
 * POST /api/admin/settings - Update settings
 * DELETE /api/admin/settings/:key - Delete a setting
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import {
  systemSettingsQueries,
  getSystemSetting,
  setSystemSetting
} from '@/lib/db/queries';
import logger from '@/lib/monitoring/structured-logger';

/**
 * GET /api/admin/settings
 * Retrieve all system settings
 *
 * Query params:
 * - organizationId: Optional organization ID for tenant-specific settings
 * - includeEncrypted: Include encrypted values (false by default for security)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de acesso requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId')
      ? parseInt(searchParams.get('organizationId')!)
      : undefined;
    const includeEncrypted = searchParams.get('includeEncrypted') === 'true';

    // Get all settings with metadata
    const settings = systemSettingsQueries.getAllSettingsWithMetadata(organizationId);

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
      userId: user.id,
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
  try {
    // Verify authentication and admin role
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de acesso requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

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

    for (const setting of settings) {
      const { key, value, organizationId } = setting;

      if (!key || value === undefined) {
        errors.push({ key, error: 'Missing key or value' });
        continue;
      }

      try {
        const success = setSystemSetting(
          key,
          value,
          organizationId,
          user.id
        );

        results.push({ key, success });

        logger.info('System setting updated', {
          key,
          userId: user.id,
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
  try {
    // Verify authentication and admin role
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de acesso requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, organizationId } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, value' },
        { status: 400 }
      );
    }

    const success = setSystemSetting(
      key,
      value,
      organizationId,
      user.id
    );

    if (success) {
      logger.info('System setting updated', {
        key,
        userId: user.id,
        organizationId
      });

      // Get the updated value to return
      const updatedValue = getSystemSetting(key, organizationId);

      return NextResponse.json({
        success: true,
        key,
        value: updatedValue
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to update setting' },
        { status: 500 }
      );
    }

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
  try {
    // Verify authentication and admin role
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de acesso requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const organizationId = searchParams.get('organizationId')
      ? parseInt(searchParams.get('organizationId')!)
      : undefined;

    if (!key) {
      return NextResponse.json(
        { error: 'Missing required parameter: key' },
        { status: 400 }
      );
    }

    const deleted = systemSettingsQueries.deleteSystemSetting(key, organizationId);

    if (deleted) {
      logger.info('System setting deleted', {
        key,
        userId: user.id,
        organizationId
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
