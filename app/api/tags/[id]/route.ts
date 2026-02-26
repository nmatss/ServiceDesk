/**
 * Tag by ID API
 *
 * Operations on a specific tag.
 *
 * @module app/api/tags/[id]/route
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
// GET - Get tag by ID
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
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 });
    }

    const tag = await executeQueryOne(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM ticket_tags tt WHERE tt.tag_id = t.id) as ticket_count
      FROM tags t
      WHERE t.id = ? AND t.organization_id = ?
    `, [tagId, organizationId]);

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    logger.error('Error fetching tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tag' },
      { status: 500 }
    );
  }
}

// ========================================
// PUT - Update tag
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
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, color, description } = body;

    // Check if tag exists and belongs to same organization
    const existing = await executeQueryOne('SELECT id FROM tags WHERE id = ? AND organization_id = ?', [tagId, organizationId]);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (color !== undefined) {
      fields.push('color = ?');
      values.push(color);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }

    if (fields.length === 0) {
      const tag = await executeQueryOne('SELECT * FROM tags WHERE id = ? AND organization_id = ?', [tagId, organizationId]);
      return NextResponse.json({ success: true, data: tag });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(tagId, organizationId);

    await executeRun(`
      UPDATE tags SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?
    `, values);

    const tag = await executeQueryOne('SELECT * FROM tags WHERE id = ? AND organization_id = ?', [tagId, organizationId]);

    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    logger.error('Error updating tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Delete tag
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
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 });
    }

    // Check if tag exists and belongs to same organization
    const existing = await executeQueryOne('SELECT id FROM tags WHERE id = ? AND organization_id = ?', [tagId, organizationId]);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Delete tag scoped to organization (ticket_tags will be cascade deleted)
    await executeRun('DELETE FROM tags WHERE id = ? AND organization_id = ?', [tagId, organizationId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
