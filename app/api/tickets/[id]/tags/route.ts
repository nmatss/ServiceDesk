/**
 * Ticket Tags API
 *
 * Manage tags on a specific ticket.
 *
 * @module app/api/tickets/[id]/tags/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: { id: string };
}

// ========================================
// GET - Get all tags for a ticket
// ========================================

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ticketId = parseInt(params.id);

    // Verify ticket exists
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Get tags
    const tags = db.prepare(`
      SELECT
        t.id,
        t.name,
        t.color,
        t.description,
        tt.added_at,
        u.name as added_by_name
      FROM ticket_tags tt
      JOIN tags t ON tt.tag_id = t.id
      LEFT JOIN users u ON tt.added_by = u.id
      WHERE tt.ticket_id = ?
      ORDER BY tt.added_at DESC
    `).all(ticketId);

    return NextResponse.json({
      ticketId,
      tags,
      count: tags.length,
    });
  } catch (error) {
    console.error('Error fetching ticket tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket tags' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Add tags to a ticket
// ========================================

export async function POST(request: NextRequest, {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: RouteParams) {
  try {
    const ticketId = parseInt(params.id);
    const body = await request.json();
    const { tagIds, tagNames, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = db.prepare('SELECT id, organization_id FROM tickets WHERE id = ?').get(ticketId) as any;
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    const addedTags: any[] = [];
    const errors: string[] = [];

    // Add tags by ID
    if (tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        try {
          const tag = db.prepare('SELECT id, name FROM tags WHERE id = ?').get(tagId) as any;
          if (!tag) {
            errors.push(`Tag with ID ${tagId} not found`);
            continue;
          }

          // Check if already added
          const existing = db.prepare(`
            SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
          `).get(ticketId, tagId);

          if (existing) {
            errors.push(`Tag "${tag.name}" is already on this ticket`);
            continue;
          }

          // Add tag
          db.prepare(`
            INSERT INTO ticket_tags (ticket_id, tag_id, added_by)
            VALUES (?, ?, ?)
          `).run(ticketId, tagId, userId);

          // Update tag usage count
          db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?').run(tagId);

          addedTags.push(tag);
        } catch (err) {
          errors.push(`Error adding tag ${tagId}`);
        }
      }
    }

    // Add tags by name (create if not exists)
    if (tagNames && Array.isArray(tagNames)) {
      for (const tagName of tagNames) {
        try {
          let tag = db.prepare(`
            SELECT id, name FROM tags WHERE organization_id = ? AND LOWER(name) = LOWER(?)
          `).get(ticket.organization_id, tagName) as any;

          // Create tag if not exists
          if (!tag) {
            const result = db.prepare(`
              INSERT INTO tags (organization_id, name, color, created_by)
              VALUES (?, ?, ?, ?)
            `).run(ticket.organization_id, tagName, getRandomTagColor(), userId);

            tag = { id: result.lastInsertRowid, name: tagName };
          }

          // Check if already added
          const existing = db.prepare(`
            SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
          `).get(ticketId, tag.id);

          if (existing) {
            errors.push(`Tag "${tag.name}" is already on this ticket`);
            continue;
          }

          // Add tag
          db.prepare(`
            INSERT INTO ticket_tags (ticket_id, tag_id, added_by)
            VALUES (?, ?, ?)
          `).run(ticketId, tag.id, userId);

          // Update tag usage count
          db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?').run(tag.id);

          addedTags.push(tag);
        } catch (err) {
          errors.push(`Error adding tag "${tagName}"`);
        }
      }
    }

    // Log activity if any tags were added
    if (addedTags.length > 0) {
      const tagNamesList = addedTags.map(t => t.name).join(', ');
      db.prepare(`
        INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
        VALUES (?, ?, 'tags_added', ?, ?)
      `).run(
        ticketId,
        userId,
        `Added tags: ${tagNamesList}`,
        JSON.stringify({ addedTags: addedTags.map(t => ({ id: t.id, name: t.name })) })
      );

      // Update ticket timestamp
      db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);
    }

    return NextResponse.json({
      addedTags,
      errors: errors.length > 0 ? errors : undefined,
      addedCount: addedTags.length,
    }, { status: addedTags.length > 0 ? 201 : 200 });
  } catch (error) {
    console.error('Error adding tags to ticket:', error);
    return NextResponse.json(
      { error: 'Failed to add tags to ticket' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Remove a tag from a ticket
// ========================================

export async function DELETE(request: NextRequest, {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: RouteParams) {
  try {
    const ticketId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');
    const userId = searchParams.get('userId');

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Get tag info for activity log
    const tag = db.prepare('SELECT name FROM tags WHERE id = ?').get(parseInt(tagId)) as any;

    // Verify tag is on ticket
    const existing = db.prepare(`
      SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
    `).get(ticketId, parseInt(tagId));

    if (!existing) {
      return NextResponse.json(
        { error: 'Tag is not on this ticket' },
        { status: 404 }
      );
    }

    // Remove tag
    db.prepare(`
      DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
    `).run(ticketId, parseInt(tagId));

    // Update tag usage count
    db.prepare('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?').run(parseInt(tagId));

    // Log activity
    if (userId && tag) {
      db.prepare(`
        INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
        VALUES (?, ?, 'tag_removed', ?, ?)
      `).run(
        ticketId,
        parseInt(userId),
        `Removed tag: ${tag.name}`,
        JSON.stringify({ tagId: parseInt(tagId), tagName: tag.name })
      );

      // Update ticket timestamp
      db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tag from ticket:', error);
    return NextResponse.json(
      { error: 'Failed to remove tag from ticket' },
      { status: 500 }
    );
  }
}

// ========================================
// Helper Functions
// ========================================

function getRandomTagColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#6366f1', // indigo
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
