/**
 * Tags API
 *
 * CRUD operations for ticket tags.
 *
 * @module app/api/tags/route
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

// ========================================
// GET - List all tags
// ========================================

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication and use tenant from JWT, never from query params
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const organizationId = guard.auth!.organizationId;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let query = `
      SELECT
        t.*,
        (SELECT COUNT(*) FROM ticket_tags tt WHERE tt.tag_id = t.id) as ticket_count
      FROM tags t
      WHERE t.organization_id = ?
    `;
    const params: (string | number)[] = [organizationId];

    if (search) {
      query += ` AND t.name LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY t.usage_count DESC, t.name ASC`;

    const tags = await executeQuery(query, params);

    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Create a new tag
// ========================================

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication and derive org from JWT
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const organizationId = guard.auth!.organizationId;
    const userId = guard.auth!.userId;

    const body = await request.json();
    const { name, color, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if tag already exists
    const existing = await executeQueryOne(`
      SELECT id FROM tags WHERE organization_id = ? AND name = ?
    `, [organizationId, name]);

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Tag with this name already exists' },
        { status: 409 }
      );
    }

    const result = await executeRun(`
      INSERT INTO tags (organization_id, name, color, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [organizationId, name, color || '#6B7280', description, userId]);

    const tag = await executeQueryOne('SELECT * FROM tags WHERE id = ?', [result.lastInsertRowid]);

    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    logger.error('Error creating tag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}
