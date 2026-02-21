/**
 * Ticket Relationships API
 *
 * Manage relationships between tickets (parent/child, related, duplicates, blocks/blocked by).
 *
 * @module app/api/tickets/[id]/relationships/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: Promise<{ id: string }>;
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

    // Get relationships where this ticket is the source
    let outgoing: any[];
    let incoming: any[];
    try {
      outgoing = await executeQuery<any>(`
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
        LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
        LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
        WHERE tr.source_ticket_id = ?
        AND t.tenant_id = ?
        ORDER BY tr.created_at DESC
      `, [tenantContext.id, tenantContext.id, ticketId, tenantContext.id]);

      // Get relationships where this ticket is the target
      incoming = await executeQuery<any>(`
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
        LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
        LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
        WHERE tr.target_ticket_id = ?
        AND t.tenant_id = ?
        ORDER BY tr.created_at DESC
      `, [tenantContext.id, tenantContext.id, ticketId, tenantContext.id]);
    } catch {
      outgoing = await executeQuery<any>(`
        SELECT
          tr.id as relationship_id,
          tr.relationship_type,
          tr.created_at,
          t.id,
          CAST(t.id AS TEXT) as ticket_number,
          t.title,
          t.status_id,
          s.name as status_name,
          t.priority_id,
          p.name as priority_name
        FROM ticket_relationships tr
        JOIN tickets t ON tr.target_ticket_id = t.id
        LEFT JOIN statuses s ON t.status_id = s.id AND s.organization_id = ?
        LEFT JOIN priorities p ON t.priority_id = p.id AND p.organization_id = ?
        WHERE tr.source_ticket_id = ?
        AND t.organization_id = ?
        ORDER BY tr.created_at DESC
      `, [tenantContext.id, tenantContext.id, ticketId, tenantContext.id]);

      incoming = await executeQuery<any>(`
        SELECT
          tr.id as relationship_id,
          tr.relationship_type,
          tr.created_at,
          t.id,
          CAST(t.id AS TEXT) as ticket_number,
          t.title,
          t.status_id,
          s.name as status_name,
          t.priority_id,
          p.name as priority_name
        FROM ticket_relationships tr
        JOIN tickets t ON tr.source_ticket_id = t.id
        LEFT JOIN statuses s ON t.status_id = s.id AND s.organization_id = ?
        LEFT JOIN priorities p ON t.priority_id = p.id AND p.organization_id = ?
        WHERE tr.target_ticket_id = ?
        AND t.organization_id = ?
        ORDER BY tr.created_at DESC
      `, [tenantContext.id, tenantContext.id, ticketId, tenantContext.id]);
    }

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
    logger.error('Error fetching ticket relationships', error);
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
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);
    const body = await request.json();
    const { targetTicketId, relationshipType } = body;

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

    // Verify source ticket exists
    let sourceTicket: { id: number; user_id: number } | undefined;
    try {
      sourceTicket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
        [ticketId, tenantContext.id]
      );
    } catch {
      sourceTicket = await executeQueryOne<{ id: number; user_id: number }>(
        'SELECT id, user_id FROM tickets WHERE id = ? AND organization_id = ?',
        [ticketId, tenantContext.id]
      );
    }
    if (!sourceTicket) {
      return NextResponse.json(
        { error: 'Source ticket not found' },
        { status: 404 }
      );
    }

    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && sourceTicket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verify target ticket exists
    let targetTicket: { id: number } | undefined;
    try {
      targetTicket = await executeQueryOne<{ id: number }>(
        'SELECT id FROM tickets WHERE id = ? AND tenant_id = ?',
        [targetTicketId, tenantContext.id]
      );
    } catch {
      targetTicket = await executeQueryOne<{ id: number }>(
        'SELECT id FROM tickets WHERE id = ? AND organization_id = ?',
        [targetTicketId, tenantContext.id]
      );
    }
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
    const existing = await executeQueryOne<{ id: number }>(`
      SELECT id FROM ticket_relationships
      WHERE (source_ticket_id = ? AND target_ticket_id = ?)
         OR (source_ticket_id = ? AND target_ticket_id = ?)
    `, [ticketId, targetTicketId, targetTicketId, ticketId]);

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
    let createdRelationshipId: number | undefined;
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO ticket_relationships (source_ticket_id, target_ticket_id, relationship_type, created_by)
        VALUES (?, ?, ?, ?)
        RETURNING id
      `, [sourceId, targetId, normalizedType, userContext.id]);
      createdRelationshipId = inserted?.id;
    } catch {
      const result = await executeRun(`
        INSERT INTO ticket_relationships (source_ticket_id, target_ticket_id, relationship_type, created_by)
        VALUES (?, ?, ?, ?)
      `, [sourceId, targetId, normalizedType, userContext.id]);
      if (typeof result.lastInsertRowid === 'number') {
        createdRelationshipId = result.lastInsertRowid;
      }
    }

    // Log activity
    await executeRun(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
      VALUES (?, ?, 'relationship_added', ?, ?)
    `, [
      ticketId,
      userContext.id,
      `Added ${relationshipType} relationship with ticket #${targetTicketId}`,
      JSON.stringify({ targetTicketId, relationshipType })
    ]);

    // Also log on the target ticket
    await executeRun(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
      VALUES (?, ?, 'relationship_added', ?, ?)
    `, [
      targetTicketId,
      userContext.id,
      `Added ${getInverseRelationType(relationshipType)} relationship with ticket #${ticketId}`,
      JSON.stringify({ sourceTicketId: ticketId, relationshipType: getInverseRelationType(relationshipType) })
    ]);

    return NextResponse.json({
      id: createdRelationshipId,
      sourceTicketId: sourceId,
      targetTicketId: targetId,
      relationshipType: normalizedType,
      createdBy: userContext.id,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating ticket relationship', error);
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
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params;
    const ticketId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const relationshipId = searchParams.get('relationshipId');

    if (!relationshipId) {
      return NextResponse.json(
        { error: 'Relationship ID is required' },
        { status: 400 }
      );
    }

    const sourceTicket = await executeQueryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM tickets WHERE id = ? AND tenant_id = ?',
      [ticketId, tenantContext.id]
    )
    if (!sourceTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!isElevatedRole && sourceTicket.user_id !== userContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Verify relationship exists and involves this ticket
    const relationship = await executeQueryOne<Relationship>(`
      SELECT tr.*
      FROM ticket_relationships tr
      JOIN tickets ts ON tr.source_ticket_id = ts.id AND ts.tenant_id = ?
      JOIN tickets tt ON tr.target_ticket_id = tt.id AND tt.tenant_id = ?
      WHERE id = ? AND (source_ticket_id = ? OR target_ticket_id = ?)
    `, [tenantContext.id, tenantContext.id, parseInt(relationshipId, 10), ticketId, ticketId]);

    if (!relationship) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Delete relationship
    await executeRun('DELETE FROM ticket_relationships WHERE id = ?', [parseInt(relationshipId, 10)]);

    // Log activity on both tickets
    const otherTicketId = relationship.source_ticket_id === ticketId
      ? relationship.target_ticket_id
      : relationship.source_ticket_id;

    await executeRun(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
      VALUES (?, ?, 'relationship_removed', ?, ?)
    `, [
      ticketId,
      userContext.id,
      `Removed ${relationship.relationship_type} relationship with ticket #${otherTicketId}`,
      JSON.stringify({ otherTicketId, relationshipType: relationship.relationship_type })
    ]);

    await executeRun(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, metadata)
      VALUES (?, ?, 'relationship_removed', ?, ?)
    `, [
      otherTicketId,
      userContext.id,
      `Removed ${getInverseRelationType(relationship.relationship_type)} relationship with ticket #${ticketId}`,
      JSON.stringify({ sourceTicketId: ticketId, relationshipType: getInverseRelationType(relationship.relationship_type) })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting ticket relationship', error);
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
