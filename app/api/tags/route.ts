/**
 * Tags API
 *
 * CRUD operations for ticket tags.
 *
 * @module app/api/tags/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// ========================================
// GET - List all tags
// ========================================

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = parseInt(searchParams.get('organizationId') || '1');
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

    const tags = db.prepare(query).all(...params);

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
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
    const body = await request.json();
    const { name, color, description, organizationId = 1, createdBy } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if tag already exists
    const existing = db.prepare(`
      SELECT id FROM tags WHERE organization_id = ? AND name = ?
    `).get(organizationId, name);

    if (existing) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 409 }
      );
    }

    const result = db.prepare(`
      INSERT INTO tags (organization_id, name, color, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(organizationId, name, color || '#6B7280', description, createdBy);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}
