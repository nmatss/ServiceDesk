/**
 * Macro by ID API
 *
 * Operations on a specific macro.
 *
 * @module app/api/macros/[id]/route
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ========================================
// GET - Get macro by ID
// ========================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication and scope by organization
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const organizationId = guard.auth!.organizationId;

    const { id } = await params;
    const macroId = parseInt(id);

    const macro = await executeQueryOne(`
      SELECT
        m.*,
        u.name as created_by_name,
        c.name as category_name
      FROM macros m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = ? AND m.organization_id = ?
    `, [macroId, organizationId]);

    if (!macro) {
      return NextResponse.json(
        { error: 'Macro not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...macro,
      actions: (macro as any).actions ? JSON.parse((macro as any).actions) : [],
    });
  } catch (error) {
    logger.error('Error fetching macro:', error);
    return NextResponse.json(
      { error: 'Failed to fetch macro' },
      { status: 500 }
    );
  }
}

// ========================================
// PUT - Update macro
// ========================================

export async function PUT(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    // SECURITY: Require authentication and scope by organization
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const organizationId = guard.auth!.organizationId;

    const { id } = await params;
    const macroId = parseInt(id);
    const body = await request.json();
    const { name, description, content, actions, categoryId, isShared, isActive } = body;

    // Check if macro exists and belongs to organization
    const existing = await executeQueryOne('SELECT id FROM macros WHERE id = ? AND organization_id = ?', [macroId, organizationId]);
    if (!existing) {
      return NextResponse.json(
        { error: 'Macro not found' },
        { status: 404 }
      );
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (content !== undefined) {
      fields.push('content = ?');
      values.push(content);
    }
    if (actions !== undefined) {
      fields.push('actions = ?');
      values.push(JSON.stringify(actions));
    }
    if (categoryId !== undefined) {
      fields.push('category_id = ?');
      values.push(categoryId);
    }
    if (isShared !== undefined) {
      fields.push('is_shared = ?');
      values.push(isShared ? 1 : 0);
    }
    if (isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (fields.length === 0) {
      const macro = await executeQueryOne<any>('SELECT * FROM macros WHERE id = ?', [macroId]);
      if (!macro) {
        return NextResponse.json(
          { error: 'Macro not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ...macro,
        actions: macro.actions ? JSON.parse(macro.actions) : [],
      });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(macroId);

    await executeRun(`
      UPDATE macros SET ${fields.join(', ')} WHERE id = ?
    `, values);

    const macro = await executeQueryOne<any>(`
      SELECT
        m.*,
        u.name as created_by_name,
        c.name as category_name
      FROM macros m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = ?
    `, [macroId]);

    if (!macro) {
      return NextResponse.json(
        { error: 'Macro not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...macro,
      actions: (macro as any).actions ? JSON.parse((macro as any).actions) : [],
    });
  } catch (error) {
    logger.error('Error updating macro:', error);
    return NextResponse.json(
      { error: 'Failed to update macro' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Delete macro
// ========================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication and scope by organization
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const organizationId = guard.auth!.organizationId;

    const { id } = await params;
    const macroId = parseInt(id);

    // Check if macro exists and belongs to organization
    const existing = await executeQueryOne('SELECT id FROM macros WHERE id = ? AND organization_id = ?', [macroId, organizationId]);
    if (!existing) {
      return NextResponse.json(
        { error: 'Macro not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting is_active to false
    await executeRun('UPDATE macros SET is_active = 0 WHERE id = ? AND organization_id = ?', [macroId, organizationId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting macro:', error);
    return NextResponse.json(
      { error: 'Failed to delete macro' },
      { status: 500 }
    );
  }
}
