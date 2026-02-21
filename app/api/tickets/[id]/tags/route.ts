/**
 * Ticket Tags API
 *
 * Manage tags on a specific ticket.
 *
 * @module app/api/tickets/[id]/tags/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: Promise<{ id: string }>;
}

interface TenantTag {
  id: number;
  name: string;
  color?: string | null;
  description?: string | null;
}

async function findTagByIdForTenant(tagId: number, tenantId: number): Promise<TenantTag | null> {
  try {
    return (await executeQueryOne<TenantTag>(
      'SELECT id, name, color, description FROM tags WHERE id = ? AND tenant_id = ?',
      [tagId, tenantId]
    )) ?? null;
  } catch {
    try {
      return (await executeQueryOne<TenantTag>(
        'SELECT id, name, color, description FROM tags WHERE id = ? AND organization_id = ?',
        [tagId, tenantId]
      )) ?? null;
    } catch {
      return null;
    }
  }
}

async function findTagByNameForTenant(tagName: string, tenantId: number): Promise<TenantTag | null> {
  try {
    return (await executeQueryOne<TenantTag>(
      'SELECT id, name, color, description FROM tags WHERE tenant_id = ? AND LOWER(name) = LOWER(?)',
      [tenantId, tagName]
    )) ?? null;
  } catch {
    try {
      return (await executeQueryOne<TenantTag>(
        'SELECT id, name, color, description FROM tags WHERE organization_id = ? AND LOWER(name) = LOWER(?)',
        [tenantId, tagName]
      )) ?? null;
    } catch {
      return null;
    }
  }
}

async function createTagForTenant(tagName: string, tenantId: number, userId: number): Promise<number | undefined> {
  const color = getRandomTagColor();
  try {
    const inserted = await executeQueryOne<{ id: number }>(`
      INSERT INTO tags (tenant_id, name, color, created_by)
      VALUES (?, ?, ?, ?)
      RETURNING id
    `, [tenantId, tagName, color, userId]);
    return inserted?.id;
  } catch {
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO tags (organization_id, name, color, created_by)
        VALUES (?, ?, ?, ?)
        RETURNING id
      `, [tenantId, tagName, color, userId]);
      return inserted?.id;
    } catch {
      try {
        const result = await executeRun(`
          INSERT INTO tags (tenant_id, name, color, created_by)
          VALUES (?, ?, ?, ?)
        `, [tenantId, tagName, color, userId]);
        if (typeof result.lastInsertRowid === 'number') {
          return result.lastInsertRowid;
        }
      } catch {
        const result = await executeRun(`
          INSERT INTO tags (organization_id, name, color, created_by)
          VALUES (?, ?, ?, ?)
        `, [tenantId, tagName, color, userId]);
        if (typeof result.lastInsertRowid === 'number') {
          return result.lastInsertRowid;
        }
      }
    }
  }

  return undefined;
}

// ========================================
// GET - Get all tags for a ticket
// ========================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);

    // Verify ticket exists
    let ticket: { id: number; user_id: number } | undefined;
    try {
      ticket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
        [ticketId, tenantContext.id]
      );
    } catch {
      ticket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND organization_id = ?',
        [ticketId, tenantContext.id]
      );
    }
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Get tags
    let tags: any[] = [];
    try {
      tags = await executeQuery(`
        SELECT
          t.id,
          t.name,
          t.color,
          t.description,
          tt.added_at,
          u.name as added_by_name
        FROM ticket_tags tt
        JOIN tags t ON tt.tag_id = t.id AND t.tenant_id = ?
        LEFT JOIN users u ON tt.added_by = u.id AND u.tenant_id = ?
        WHERE tt.ticket_id = ?
        ORDER BY tt.added_at DESC
      `, [tenantContext.id, tenantContext.id, ticketId]);
    } catch {
      tags = await executeQuery(`
        SELECT
          t.id,
          t.name,
          t.color,
          t.description,
          tt.added_at,
          u.name as added_by_name
        FROM ticket_tags tt
        JOIN tags t ON tt.tag_id = t.id AND t.organization_id = ?
        LEFT JOIN users u ON tt.added_by = u.id AND u.tenant_id = ?
        WHERE tt.ticket_id = ?
        ORDER BY tt.added_at DESC
      `, [tenantContext.id, tenantContext.id, ticketId]);
    }

    return NextResponse.json({
      ticketId,
      tags,
      count: tags.length,
    });
  } catch (error) {
    logger.error('Error fetching ticket tags', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket tags' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Add tags to a ticket
// ========================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);
    const body = await request.json();
    const { tagIds, tagNames } = body;

    // Verify ticket exists
    let ticket: { id: number; user_id: number } | undefined;
    try {
      ticket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
        [ticketId, tenantContext.id]
      );
    } catch {
      ticket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND organization_id = ?',
        [ticketId, tenantContext.id]
      );
    }
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const addedTags: any[] = [];
    const errors: string[] = [];

    // Add tags by ID
    if (tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        try {
          const tag = await findTagByIdForTenant(tagId, tenantContext.id);
          if (!tag) {
            errors.push(`Tag with ID ${tagId} not found`);
            continue;
          }

          // Check if already added
          const existing = await executeQueryOne<{ id: number }>(`
            SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
          `, [ticketId, tagId]);

          if (existing) {
            errors.push(`Tag "${tag.name}" is already on this ticket`);
            continue;
          }

          // Add tag
          await executeRun(`
            INSERT INTO ticket_tags (ticket_id, tag_id, added_by)
            VALUES (?, ?, ?)
          `, [ticketId, tagId, userContext.id]);

          // Update tag usage count
          await executeRun('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?', [tagId]);

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
          let tag = await findTagByNameForTenant(tagName, tenantContext.id);

          // Create tag if not exists
          if (!tag) {
            const createdTagId = await createTagForTenant(tagName, tenantContext.id, userContext.id);

            if (!createdTagId) {
              errors.push(`Error creating tag \"${tagName}\"`);
              continue;
            }

            tag = { id: createdTagId, name: tagName };
          }

          // Check if already added
          const existing = await executeQueryOne<{ id: number }>(`
            SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
          `, [ticketId, tag.id]);

          if (existing) {
            errors.push(`Tag "${tag.name}" is already on this ticket`);
            continue;
          }

          // Add tag
          await executeRun(`
            INSERT INTO ticket_tags (ticket_id, tag_id, added_by)
            VALUES (?, ?, ?)
          `, [ticketId, tag.id, userContext.id]);

          // Update tag usage count
          await executeRun('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?', [tag.id]);

          addedTags.push(tag);
        } catch (err) {
          errors.push(`Error adding tag "${tagName}"`);
        }
      }
    }

    // Log activity if any tags were added
    if (addedTags.length > 0) {
      const tagNamesList = addedTags.map(t => t.name).join(', ');
      await executeRun(`
        INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
        VALUES (?, ?, 'tags_added', ?, ?)
      `, [
        ticketId,
        userContext.id,
        `Added tags: ${tagNamesList}`,
        JSON.stringify({ addedTags: addedTags.map(t => ({ id: t.id, name: t.name })) })
      ]);

      // Update ticket timestamp
      await executeRun('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
    }

    return NextResponse.json({
      addedTags,
      errors: errors.length > 0 ? errors : undefined,
      addedCount: addedTags.length,
    }, { status: addedTags.length > 0 ? 201 : 200 });
  } catch (error) {
    logger.error('Error adding tags to ticket', error);
    return NextResponse.json(
      { error: 'Failed to add tags to ticket' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Remove a tag from a ticket
// ========================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Verify ticket exists
    let ticket: { id: number; user_id: number } | undefined;
    try {
      ticket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
        [ticketId, tenantContext.id]
      );
    } catch {
      ticket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND organization_id = ?',
        [ticketId, tenantContext.id]
      );
    }
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Get tag info for activity log
    const parsedTagId = parseInt(tagId, 10);
    const tag = await findTagByIdForTenant(parsedTagId, tenantContext.id);
    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Verify tag is on ticket
    const existing = await executeQueryOne<{ id: number }>(`
      SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
    `, [ticketId, parsedTagId]);

    if (!existing) {
      return NextResponse.json(
        { error: 'Tag is not on this ticket' },
        { status: 404 }
      );
    }

    // Remove tag
    await executeRun(`
      DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?
    `, [ticketId, parsedTagId]);

    // Update tag usage count
    await executeRun('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?', [parsedTagId]);

    // Log activity
    if (tag) {
      await executeRun(`
        INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
        VALUES (?, ?, 'tag_removed', ?, ?)
      `, [
        ticketId,
        userContext.id,
        `Removed tag: ${tag.name}`,
        JSON.stringify({ tagId: parsedTagId, tagName: tag.name })
      ]);

      // Update ticket timestamp
      await executeRun('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error removing tag from ticket', error);
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
