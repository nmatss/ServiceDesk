/**
 * Ticket Activities API
 *
 * Get activity history for a ticket.
 *
 * @module app/api/tickets/[id]/activities/route
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: Promise<{ id: string }>;
}

// ========================================
// GET - Get activity history for a ticket
// ========================================

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    if (Number.isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Ticket ID inválido' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const activityTypes = searchParams.get('types')?.split(',');

    // Verify ticket exists
    let ticket: { id: number; ticket_number: string | null; user_id: number } | undefined;
    try {
      ticket = await executeQueryOne<{ id: number; ticket_number: string | null; user_id: number }>(
        "SELECT id, COALESCE(ticket_number, CAST(id AS TEXT)) as ticket_number, user_id FROM tickets WHERE id = ? AND tenant_id = ?",
        [ticketId, tenantContext.id]
      );
    } catch {
      ticket = await executeQueryOne<{ id: number; ticket_number: string | null; user_id: number }>(
        "SELECT id, CAST(id AS TEXT) as ticket_number, user_id FROM tickets WHERE id = ? AND organization_id = ?",
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

    // Build query
    let query = `
      SELECT
        ta.id,
        ta.activity_type,
        ta.description,
        ta.old_value,
        ta.new_value,
        ta.metadata,
        ta.created_at,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar
      FROM ticket_activities ta
      LEFT JOIN users u ON ta.user_id = u.id AND u.tenant_id = ?
      WHERE ta.ticket_id = ?
        AND (ta.user_id IS NULL OR u.id IS NOT NULL)
    `;
    const queryParams: (number | string)[] = [tenantContext.id, ticketId];

    // Filter by activity types
    if (activityTypes && activityTypes.length > 0) {
      query += ` AND ta.activity_type IN (${activityTypes.map(() => '?').join(',')})`;
      queryParams.push(...activityTypes);
    }

    query += ` ORDER BY ta.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const activities = await executeQuery<any>(query, queryParams);

    // Parse metadata JSON
    const parsedActivities = activities.map((activity) => {
      let parsedMetadata: unknown = null
      if (activity.metadata) {
        try {
          parsedMetadata = JSON.parse(activity.metadata)
        } catch {
          parsedMetadata = null
        }
      }

      return {
        ...activity,
        metadata: parsedMetadata,
      }
    });

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM ticket_activities ta
      LEFT JOIN users u ON ta.user_id = u.id AND u.tenant_id = ?
      WHERE ta.ticket_id = ?
        AND (ta.user_id IS NULL OR u.id IS NOT NULL)
    `;
    const countParams: (number | string)[] = [tenantContext.id, ticketId];

    if (activityTypes && activityTypes.length > 0) {
      countQuery += ` AND activity_type IN (${activityTypes.map(() => '?').join(',')})`;
      countParams.push(...activityTypes);
    }

    const totalResult = await executeQueryOne<{ count: number }>(countQuery, countParams);

    // Get activity type summary
    const typeSummary = await executeQuery<{ activity_type: string; count: number }>(`
      SELECT ta.activity_type, COUNT(*) as count
      FROM ticket_activities ta
      LEFT JOIN users u ON ta.user_id = u.id AND u.tenant_id = ?
      WHERE ta.ticket_id = ?
        AND (ta.user_id IS NULL OR u.id IS NOT NULL)
      GROUP BY ta.activity_type
      ORDER BY count DESC
    `, [tenantContext.id, ticketId]);

    const totalCount = totalResult?.count ?? 0;

    return NextResponse.json({
      ticketId,
      ticketNumber: ticket.ticket_number,
      activities: parsedActivities,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      summary: {
        total: totalCount,
        byType: typeSummary.reduce((acc: Record<string, number>, item: any) => {
          acc[item.activity_type] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    logger.error('Error fetching ticket activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket activities' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Add a custom activity (for integrations)
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
    if (Number.isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Ticket ID inválido' },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { activityType, description, oldValue, newValue, metadata } = body;

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

    if (!activityType || !description) {
      return NextResponse.json(
        { error: 'Activity type and description are required' },
        { status: 400 }
      );
    }

    // Validate activity type
    const validTypes = [
      'created',
      'status_changed',
      'priority_changed',
      'assigned',
      'unassigned',
      'comment_added',
      'comment_edited',
      'comment_deleted',
      'attachment_added',
      'attachment_removed',
      'tags_added',
      'tag_removed',
      'relationship_added',
      'relationship_removed',
      'follower_added',
      'follower_removed',
      'sla_updated',
      'merged',
      'split',
      'custom',
    ];

    if (!validTypes.includes(activityType)) {
      return NextResponse.json(
        { error: `Invalid activity type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    let createdActivityId: number | undefined;
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO ticket_activities (
          tenant_id, ticket_id, user_id, activity_type, description,
          old_value, new_value, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `, [
        tenantContext.id,
        ticketId,
        userContext.id,
        activityType,
        description,
        oldValue || null,
        newValue || null,
        metadata ? JSON.stringify(metadata) : null
      ]);
      createdActivityId = inserted?.id;
    } catch {
      try {
        const inserted = await executeQueryOne<{ id: number }>(`
          INSERT INTO ticket_activities (
            organization_id, ticket_id, user_id, activity_type, description,
            old_value, new_value, metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `, [
          tenantContext.id,
          ticketId,
          userContext.id,
          activityType,
          description,
          oldValue || null,
          newValue || null,
          metadata ? JSON.stringify(metadata) : null
        ]);
        createdActivityId = inserted?.id;
      } catch {
        const result = await executeRun(`
          INSERT INTO ticket_activities (
            ticket_id, user_id, activity_type, description,
            old_value, new_value, metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          ticketId,
          userContext.id,
          activityType,
          description,
          oldValue || null,
          newValue || null,
          metadata ? JSON.stringify(metadata) : null
        ]);
        if (typeof result.lastInsertRowid === 'number') {
          createdActivityId = result.lastInsertRowid;
        }
      }
    }

    return NextResponse.json({
      id: createdActivityId,
      ticketId,
      activityType,
      description,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating ticket activity:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket activity' },
      { status: 500 }
    );
  }
}
