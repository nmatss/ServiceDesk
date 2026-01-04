/**
 * Ticket Followers API
 *
 * Manage users following a ticket for updates.
 *
 * @module app/api/tickets/[id]/followers/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: { id: string };
}

// ========================================
// GET - Get all followers of a ticket
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

    // Get followers with user details
    const followers = db.prepare(`
      SELECT
        tf.id as follower_id,
        tf.created_at as followed_at,
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        u.role
      FROM ticket_followers tf
      JOIN users u ON tf.user_id = u.id
      WHERE tf.ticket_id = ?
      ORDER BY tf.created_at DESC
    `).all(ticketId);

    return NextResponse.json({
      ticketId,
      followers,
      count: followers.length,
    });
  } catch (error) {
    console.error('Error fetching ticket followers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket followers' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Follow a ticket
// ========================================

export async function POST(request: NextRequest, {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: RouteParams) {
  try {
    const ticketId = parseInt(params.id);
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(ticketId) as any;
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Verify user exists
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already following
    const existing = db.prepare(`
      SELECT id FROM ticket_followers WHERE ticket_id = ? AND user_id = ?
    `).get(ticketId, userId);

    if (existing) {
      return NextResponse.json(
        { error: 'User is already following this ticket' },
        { status: 409 }
      );
    }

    // Add follower
    const result = db.prepare(`
      INSERT INTO ticket_followers (ticket_id, user_id)
      VALUES (?, ?)
    `).run(ticketId, userId);

    // Log activity
    db.prepare(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description)
      VALUES (?, ?, 'follower_added', ?)
    `).run(ticketId, userId, `${user.name} started following this ticket`);

    return NextResponse.json({
      id: result.lastInsertRowid,
      ticketId,
      userId,
      message: `Now following ticket #${ticket.ticket_number}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error following ticket:', error);
    return NextResponse.json(
      { error: 'Failed to follow ticket' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Unfollow a ticket
// ========================================

export async function DELETE(request: NextRequest, {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: RouteParams) {
  try {
    const ticketId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify following relationship exists
    const existing = db.prepare(`
      SELECT tf.id, u.name FROM ticket_followers tf
      JOIN users u ON tf.user_id = u.id
      WHERE tf.ticket_id = ? AND tf.user_id = ?
    `).get(ticketId, parseInt(userId)) as any;

    if (!existing) {
      return NextResponse.json(
        { error: 'User is not following this ticket' },
        { status: 404 }
      );
    }

    // Remove follower
    db.prepare(`
      DELETE FROM ticket_followers WHERE ticket_id = ? AND user_id = ?
    `).run(ticketId, parseInt(userId));

    // Log activity
    db.prepare(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description)
      VALUES (?, ?, 'follower_removed', ?)
    `).run(ticketId, parseInt(userId), `${existing.name} stopped following this ticket`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unfollowing ticket:', error);
    return NextResponse.json(
      { error: 'Failed to unfollow ticket' },
      { status: 500 }
    );
  }
}
