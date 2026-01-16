/**
 * Ticket Activities API
 *
 * Get activity history for a ticket.
 *
 * @module app/api/tickets/[id]/activities/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: { id: string };
}

// ========================================
// GET - Get activity history for a ticket
// ========================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const ticketId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const activityTypes = searchParams.get('types')?.split(',');

    // Verify ticket exists
    const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(ticketId) as any;
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
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
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE ta.ticket_id = ?
    `;
    const queryParams: (number | string)[] = [ticketId];

    // Filter by activity types
    if (activityTypes && activityTypes.length > 0) {
      query += ` AND ta.activity_type IN (${activityTypes.map(() => '?').join(',')})`;
      queryParams.push(...activityTypes);
    }

    query += ` ORDER BY ta.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const activities = db.prepare(query).all(...queryParams) as any[];

    // Parse metadata JSON
    const parsedActivities = activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }));

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM ticket_activities WHERE ticket_id = ?`;
    const countParams: (number | string)[] = [ticketId];

    if (activityTypes && activityTypes.length > 0) {
      countQuery += ` AND activity_type IN (${activityTypes.map(() => '?').join(',')})`;
      countParams.push(...activityTypes);
    }

    const totalResult = db.prepare(countQuery).get(...countParams) as any;

    // Get activity type summary
    const typeSummary = db.prepare(`
      SELECT activity_type, COUNT(*) as count
      FROM ticket_activities
      WHERE ticket_id = ?
      GROUP BY activity_type
      ORDER BY count DESC
    `).all(ticketId) as any[];

    return NextResponse.json({
      ticketId,
      ticketNumber: ticket.ticket_number,
      activities: parsedActivities,
      pagination: {
        total: totalResult.count,
        limit,
        offset,
        hasMore: offset + limit < totalResult.count,
      },
      summary: {
        total: totalResult.count,
        byType: typeSummary.reduce((acc: Record<string, number>, item: any) => {
          acc[item.activity_type] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('Error fetching ticket activities:', error);
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
    const ticketId = parseInt(params.id);
    const body = await request.json();
    const { activityType, description, userId, oldValue, newValue, metadata } = body;

    // Verify ticket exists
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
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

    const result = db.prepare(`
      INSERT INTO ticket_activities (
        ticket_id, user_id, activity_type, description,
        old_value, new_value, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      userId || null,
      activityType,
      description,
      oldValue || null,
      newValue || null,
      metadata ? JSON.stringify(metadata) : null
    );

    return NextResponse.json({
      id: result.lastInsertRowid,
      ticketId,
      activityType,
      description,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket activity:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket activity' },
      { status: 500 }
    );
  }
}
