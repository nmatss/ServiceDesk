/**
 * Ticket Followers API
 *
 * Manage users following a ticket for updates.
 *
 * @module app/api/tickets/[id]/followers/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: Promise<{ id: string }>;
}

// ========================================
// GET - Get all followers of a ticket
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
    const ticket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
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

    // Get followers with user details
    const followers = await executeQuery(`
      SELECT
        tf.id as follower_id,
        tf.created_at as followed_at,
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        u.role
      FROM ticket_followers tf
      JOIN users u ON tf.user_id = u.id AND u.tenant_id = ?
      WHERE tf.ticket_id = ?
      ORDER BY tf.created_at DESC
    `, [tenantContext.id, ticketId]);

    return NextResponse.json({
      ticketId,
      followers,
      count: followers.length,
    });
  } catch (error) {
    logger.error('Error fetching ticket followers', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket followers' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Follow a ticket
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
    const { userId } = body;

    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    const targetUserId = typeof userId === 'number' ? userId : userContext.id
    if (!isElevatedRole && targetUserId !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verify ticket exists
    const ticket = await executeQueryOne<{ id: number; ticket_number: string; user_id: number }>(
      'SELECT id, ticket_number, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verify user exists
    const user = await executeQueryOne<{ id: number; name: string }>(
      'SELECT id, name FROM users WHERE id = ? AND tenant_id = ?',
      [targetUserId, tenantContext.id]
    );
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already following
    const existing = await executeQueryOne<{ id: number }>(`
      SELECT id FROM ticket_followers WHERE ticket_id = ? AND user_id = ?
    `, [ticketId, targetUserId]);

    if (existing) {
      return NextResponse.json(
        { error: 'User is already following this ticket' },
        { status: 409 }
      );
    }

    // Add follower
    let createdFollowerId: number | undefined;
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO ticket_followers (ticket_id, user_id)
        VALUES (?, ?)
        RETURNING id
      `, [ticketId, targetUserId]);
      createdFollowerId = inserted?.id;
    } catch {
      const result = await executeRun(`
        INSERT INTO ticket_followers (ticket_id, user_id)
        VALUES (?, ?)
      `, [ticketId, targetUserId]);
      if (typeof result.lastInsertRowid === 'number') {
        createdFollowerId = result.lastInsertRowid;
      }
    }

    // Log activity
    await executeRun(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description)
      VALUES (?, ?, 'follower_added', ?)
    `, [ticketId, userContext.id, `${user.name} started following this ticket`]);

    return NextResponse.json({
      id: createdFollowerId,
      ticketId,
      userId: targetUserId,
      message: `Now following ticket #${ticket.ticket_number}`,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error following ticket', error);
    return NextResponse.json(
      { error: 'Failed to follow ticket' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Unfollow a ticket
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
    const queryUserId = searchParams.get('userId');
    const targetUserId = queryUserId ? parseInt(queryUserId, 10) : userContext.id
    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)

    if (!isElevatedRole && targetUserId !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const ticket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    );
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    if (!isElevatedRole && ticket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verify following relationship exists
    const existing = await executeQueryOne<{ id: number; name: string }>(`
      SELECT tf.id, u.name FROM ticket_followers tf
      JOIN users u ON tf.user_id = u.id AND u.tenant_id = ?
      WHERE tf.ticket_id = ? AND tf.user_id = ?
    `, [tenantContext.id, ticketId, targetUserId]);

    if (!existing) {
      return NextResponse.json(
        { error: 'User is not following this ticket' },
        { status: 404 }
      );
    }

    // Remove follower
    await executeRun(`
      DELETE FROM ticket_followers WHERE ticket_id = ? AND user_id = ?
    `, [ticketId, targetUserId]);

    // Log activity
    await executeRun(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description)
      VALUES (?, ?, 'follower_removed', ?)
    `, [ticketId, userContext.id, `${existing.name} stopped following this ticket`]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error unfollowing ticket', error);
    return NextResponse.json(
      { error: 'Failed to unfollow ticket' },
      { status: 500 }
    );
  }
}
