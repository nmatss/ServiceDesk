/**
 * Apply Macro API
 *
 * Apply a macro to a ticket.
 *
 * @module app/api/macros/[id]/apply/route
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isPrivileged } from '@/lib/auth/roles';
import { apiError } from '@/lib/api/api-helpers';

// ========================================
// POST - Apply macro to ticket
// ========================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Only agents and admins can apply macros
    if (!isPrivileged(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const resolvedParams = await params;
    const macroId = parseInt(resolvedParams.id);
    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    // Get macro scoped to organization
    const macro = await executeQueryOne<any>('SELECT * FROM macros WHERE id = ? AND is_active = 1 AND organization_id = ?', [macroId, auth.organizationId]);
    if (!macro) {
      return NextResponse.json(
        { error: 'Macro not found' },
        { status: 404 }
      );
    }

    // Check if ticket exists and belongs to tenant
    const ticket = await executeQueryOne('SELECT * FROM tickets WHERE id = ? AND tenant_id = ?', [ticketId, auth.organizationId]);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Parse actions
    const actions = macro.actions ? JSON.parse(macro.actions) : [];

    // Execute actions
    const executedActions: string[] = [];

    for (const action of actions) {
      switch (action.type) {
        case 'set_status':
          await executeRun('UPDATE tickets SET status_id = ? WHERE id = ?', [action.value, ticketId]);
          executedActions.push(`Status updated to ${action.value}`);
          break;

        case 'set_priority':
          await executeRun('UPDATE tickets SET priority_id = ? WHERE id = ?', [action.value, ticketId]);
          executedActions.push(`Priority updated to ${action.value}`);
          break;

        case 'assign':
          await executeRun('UPDATE tickets SET assigned_to = ? WHERE id = ?', [action.value, ticketId]);
          executedActions.push(`Assigned to user ${action.value}`);
          break;

        case 'add_tag':
          // Check if tag exists
          const tag = await executeQueryOne<any>('SELECT id FROM tags WHERE name = ?', [action.value]);
          if (tag) {
            // Check if not already added
            const existingTag = await executeQueryOne('SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?', [ticketId, tag.id]);
            if (!existingTag) {
              await executeRun('INSERT INTO ticket_tags (ticket_id, tag_id, added_by) VALUES (?, ?, ?)', [ticketId, tag.id, auth.userId]);
              executedActions.push(`Tag "${action.value}" added`);
            }
          }
          break;

        case 'remove_tag':
          const tagToRemove = await executeQueryOne<any>('SELECT id FROM tags WHERE name = ?', [action.value]);
          if (tagToRemove) {
            await executeRun('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?', [ticketId, tagToRemove.id]);
            executedActions.push(`Tag "${action.value}" removed`);
          }
          break;

        case 'add_comment':
          const isInternal = action.is_internal ?? false;
          await executeRun(`
            INSERT INTO comments (ticket_id, user_id, content, is_internal)
            VALUES (?, ?, ?, ?)
          `, [ticketId, auth.userId, macro.content, isInternal ? 1 : 0]);
          executedActions.push('Comment added');
          break;
      }
    }

    // If no add_comment action but macro has content, add as comment
    if (!actions.some((a: any) => a.type === 'add_comment') && macro.content) {
      await executeRun(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal)
        VALUES (?, ?, ?, 0)
      `, [ticketId, auth.userId, macro.content]);
      executedActions.push('Comment added');
    }

    // Record macro usage
    await executeRun(`
      INSERT INTO macro_usage (macro_id, ticket_id, used_by)
      VALUES (?, ?, ?)
    `, [macroId, ticketId, auth.userId]);

    // Update ticket timestamp
    await executeRun('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);

    return NextResponse.json({
      success: true,
      macroId,
      ticketId,
      content: macro.content,
      executedActions,
    });
  } catch (error) {
    logger.error('Error applying macro:', error);
    return apiError('Failed to apply macro', 500);
  }
}
