/**
 * Tag by ID API
 *
 * Operations on a specific tag.
 *
 * @module app/api/tags/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

interface RouteParams {
  params: { id: string };
}

// ========================================
// GET - Get tag by ID
// ========================================

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const tagId = parseInt(params.id);

    const tag = db.prepare(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM ticket_tags tt WHERE tt.tag_id = t.id) as ticket_count
      FROM tags t
      WHERE t.id = ?
    `).get(tagId);

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag' },
      { status: 500 }
    );
  }
}

// ========================================
// PUT - Update tag
// ========================================

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const tagId = parseInt(params.id);
    const body = await request.json();
    const { name, color, description } = body;

    // Check if tag exists
    const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Tag not found' },
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
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
      return NextResponse.json(tag);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(tagId);

    db.prepare(`
      UPDATE tags SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Delete tag
// ========================================

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const tagId = parseInt(params.id);

    // Check if tag exists
    const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Delete tag (ticket_tags will be cascade deleted)
    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
