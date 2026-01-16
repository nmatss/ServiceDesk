/**
 * Ticket Relationships API
 *
 * Manage relationships between tickets (parent/child, related, duplicates, blocks/blocked by).
 *
 * @module app/api/tickets/[id]/relationships/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: { id: string };
}

type RelationshipType = 'parent' | 'child' | 'related' | 'duplicate' | 'blocks' | 'blocked_by';

interface Relationship {
  id: number;
  source_ticket_id: number;
  target_ticket_id: number;
  relationship_type: RelationshipType;
  created_by: number;
  created_at: string;
}

interface RelatedTicket {
  id: number;
  ticket_number: string;
  title: string;
  status_id: number;
  status_name?: string;
  priority_id: number;
  priority_name?: string;
  relationship_type: RelationshipType;
  relationship_id: number;
}

// ========================================
// GET - Get all relationships for a ticket
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

    // Get relationships where this ticket is the source
    const outgoing = db.prepare(`
      SELECT
        tr.id as relationship_id,
        tr.relationship_type,
        tr.created_at,
        t.id,
        t.ticket_number,
        t.title,
        t.status_id,
        s.name as status_name,
        t.priority_id,
        p.name as priority_name
      FROM ticket_relationships tr
      JOIN tickets t ON tr.target_ticket_id = t.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      WHERE tr.source_ticket_id = ?
      ORDER BY tr.created_at DESC
    `).all(ticketId) as any[];

    // Get relationships where this ticket is the target
    const incoming = db.prepare(`
      SELECT
        tr.id as relationship_id,
        tr.relationship_type,
        tr.created_at,
        t.id,
        t.ticket_number,
        t.title,
        t.status_id,
        s.name as status_name,
        t.priority_id,
        p.name as priority_name
      FROM ticket_relationships tr
      JOIN tickets t ON tr.source_ticket_id = t.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      WHERE tr.target_ticket_id = ?
      ORDER BY tr.created_at DESC
    `).all(ticketId) as any[];

    // Transform incoming relationships to inverse types
    const transformedIncoming = incoming.map(rel => ({
      ...rel,
      relationship_type: getInverseRelationType(rel.relationship_type),
    }));

    // Group relationships by type
    const grouped: Record<RelationshipType, RelatedTicket[]> = {
      parent: [],
      child: [],
      related: [],
      duplicate: [],
      blocks: [],
      blocked_by: [],
    };

    [...outgoing, ...transformedIncoming].forEach(rel => {
      const relatedTicket: RelatedTicket = {
        id: rel.id,
        ticket_number: rel.ticket_number,
        title: rel.title,
        status_id: rel.status_id,
        status_name: rel.status_name,
        priority_id: rel.priority_id,
        priority_name: rel.priority_name,
        relationship_type: rel.relationship_type,
        relationship_id: rel.relationship_id,
      };

      if (grouped[rel.relationship_type as RelationshipType]) {
        grouped[rel.relationship_type as RelationshipType].push(relatedTicket);
      }
    });

    // Get counts
    const counts = {
      parents: grouped.parent.length,
      children: grouped.child.length,
      related: grouped.related.length,
      duplicates: grouped.duplicate.length,
      blocking: grouped.blocks.length,
      blockedBy: grouped.blocked_by.length,
      total: outgoing.length + incoming.length,
    };

    return NextResponse.json({
      ticketId,
      relationships: grouped,
      counts,
    });
  } catch (error) {
    console.error('Error fetching ticket relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket relationships' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Create a new relationship
// ========================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const ticketId = parseInt(params.id);
    const body = await request.json();
    const { targetTicketId, relationshipType, userId } = body;

    // Validate inputs
    if (!targetTicketId) {
      return NextResponse.json(
        { error: 'Target ticket ID is required' },
        { status: 400 }
      );
    }

    if (!relationshipType) {
      return NextResponse.json(
        { error: 'Relationship type is required' },
        { status: 400 }
      );
    }

    const validTypes: RelationshipType[] = ['parent', 'child', 'related', 'duplicate', 'blocks', 'blocked_by'];
    if (!validTypes.includes(relationshipType)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify source ticket exists
    const sourceTicket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (!sourceTicket) {
      return NextResponse.json(
        { error: 'Source ticket not found' },
        { status: 404 }
      );
    }

    // Verify target ticket exists
    const targetTicket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(targetTicketId);
    if (!targetTicket) {
      return NextResponse.json(
        { error: 'Target ticket not found' },
        { status: 404 }
      );
    }

    // Prevent self-relationship
    if (ticketId === targetTicketId) {
      return NextResponse.json(
        { error: 'Cannot create relationship with the same ticket' },
        { status: 400 }
      );
    }

    // Check for existing relationship
    const existing = db.prepare(`
      SELECT id FROM ticket_relationships
      WHERE (source_ticket_id = ? AND target_ticket_id = ?)
         OR (source_ticket_id = ? AND target_ticket_id = ?)
    `).get(ticketId, targetTicketId, targetTicketId, ticketId);

    if (existing) {
      return NextResponse.json(
        { error: 'Relationship already exists between these tickets' },
        { status: 409 }
      );
    }

    // Normalize relationship direction
    let sourceId = ticketId;
    let targetId = targetTicketId;
    let normalizedType = relationshipType;

    // For inverse types, swap source and target
    if (relationshipType === 'child') {
      sourceId = targetTicketId;
      targetId = ticketId;
      normalizedType = 'parent';
    } else if (relationshipType === 'blocked_by') {
      sourceId = targetTicketId;
      targetId = ticketId;
      normalizedType = 'blocks';
    }

    // Create relationship
    const result = db.prepare(`
      INSERT INTO ticket_relationships (source_ticket_id, target_ticket_id, relationship_type, created_by)
      VALUES (?, ?, ?, ?)
    `).run(sourceId, targetId, normalizedType, userId);

    // Log activity
    db.prepare(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
      VALUES (?, ?, 'relationship_added', ?, ?)
    `).run(
      ticketId,
      userId,
      `Added ${relationshipType} relationship with ticket #${targetTicketId}`,
      JSON.stringify({ targetTicketId, relationshipType })
    );

    // Also log on the target ticket
    db.prepare(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
      VALUES (?, ?, 'relationship_added', ?, ?)
    `).run(
      targetTicketId,
      userId,
      `Added ${getInverseRelationType(relationshipType)} relationship with ticket #${ticketId}`,
      JSON.stringify({ sourceTicketId: ticketId, relationshipType: getInverseRelationType(relationshipType) })
    );

    return NextResponse.json({
      id: result.lastInsertRowid,
      sourceTicketId: sourceId,
      targetTicketId: targetId,
      relationshipType: normalizedType,
      createdBy: userId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket relationship' },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Remove a relationship
// ========================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const ticketId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const relationshipId = searchParams.get('relationshipId');
    const userId = searchParams.get('userId');

    if (!relationshipId) {
      return NextResponse.json(
        { error: 'Relationship ID is required' },
        { status: 400 }
      );
    }

    // Verify relationship exists and involves this ticket
    const relationship = db.prepare(`
      SELECT * FROM ticket_relationships
      WHERE id = ? AND (source_ticket_id = ? OR target_ticket_id = ?)
    `).get(parseInt(relationshipId), ticketId, ticketId) as Relationship | undefined;

    if (!relationship) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Delete relationship
    db.prepare('DELETE FROM ticket_relationships WHERE id = ?').run(parseInt(relationshipId));

    // Log activity on both tickets
    if (userId) {
      const otherTicketId = relationship.source_ticket_id === ticketId
        ? relationship.target_ticket_id
        : relationship.source_ticket_id;

      db.prepare(`
        INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
        VALUES (?, ?, 'relationship_removed', ?, ?)
      `).run(
        ticketId,
        parseInt(userId),
        `Removed ${relationship.relationship_type} relationship with ticket #${otherTicketId}`,
        JSON.stringify({ otherTicketId, relationshipType: relationship.relationship_type })
      );

      db.prepare(`
        INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
        VALUES (?, ?, 'relationship_removed', ?, ?)
      `).run(
        otherTicketId,
        parseInt(userId),
        `Removed ${getInverseRelationType(relationship.relationship_type)} relationship with ticket #${ticketId}`,
        JSON.stringify({ sourceTicketId: ticketId, relationshipType: getInverseRelationType(relationship.relationship_type) })
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket relationship:', error);
    return NextResponse.json(
      { error: 'Failed to delete ticket relationship' },
      { status: 500 }
    );
  }
}

// ========================================
// Helper Functions
// ========================================

function getInverseRelationType(type: string): RelationshipType {
  const inverseMap: Record<string, RelationshipType> = {
    parent: 'child',
    child: 'parent',
    related: 'related',
    duplicate: 'duplicate',
    blocks: 'blocked_by',
    blocked_by: 'blocks',
  };
  return inverseMap[type] || 'related';
}
