/**
 * Apply Macro API
 *
 * Apply a macro to a ticket.
 *
 * @module app/api/macros/[id]/apply/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

interface RouteParams {
  params: { id: string };
}

// ========================================
// POST - Apply macro to ticket
// ========================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const macroId = parseInt(params.id);
    const body = await request.json();
    const { ticketId, userId } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get macro
    const macro = db.prepare('SELECT * FROM macros WHERE id = ? AND is_active = 1').get(macroId) as any;
    if (!macro) {
      return NextResponse.json(
        { error: 'Macro not found' },
        { status: 404 }
      );
    }

    // Check if ticket exists
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
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
          db.prepare('UPDATE tickets SET status_id = ? WHERE id = ?').run(action.value, ticketId);
          executedActions.push(`Status updated to ${action.value}`);
          break;

        case 'set_priority':
          db.prepare('UPDATE tickets SET priority_id = ? WHERE id = ?').run(action.value, ticketId);
          executedActions.push(`Priority updated to ${action.value}`);
          break;

        case 'assign':
          db.prepare('UPDATE tickets SET assigned_to = ? WHERE id = ?').run(action.value, ticketId);
          executedActions.push(`Assigned to user ${action.value}`);
          break;

        case 'add_tag':
          // Check if tag exists
          const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(action.value) as any;
          if (tag) {
            // Check if not already added
            const existingTag = db.prepare('SELECT id FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?').get(ticketId, tag.id);
            if (!existingTag) {
              db.prepare('INSERT INTO ticket_tags (ticket_id, tag_id, added_by) VALUES (?, ?, ?)').run(ticketId, tag.id, userId);
              executedActions.push(`Tag "${action.value}" added`);
            }
          }
          break;

        case 'remove_tag':
          const tagToRemove = db.prepare('SELECT id FROM tags WHERE name = ?').get(action.value) as any;
          if (tagToRemove) {
            db.prepare('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?').run(ticketId, tagToRemove.id);
            executedActions.push(`Tag "${action.value}" removed`);
          }
          break;

        case 'add_comment':
          const isInternal = action.is_internal ?? false;
          db.prepare(`
            INSERT INTO comments (ticket_id, user_id, content, is_internal)
            VALUES (?, ?, ?, ?)
          `).run(ticketId, userId, macro.content, isInternal ? 1 : 0);
          executedActions.push('Comment added');
          break;
      }
    }

    // If no add_comment action but macro has content, add as comment
    if (!actions.some((a: any) => a.type === 'add_comment') && macro.content) {
      db.prepare(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal)
        VALUES (?, ?, ?, 0)
      `).run(ticketId, userId, macro.content);
      executedActions.push('Comment added');
    }

    // Record macro usage
    db.prepare(`
      INSERT INTO macro_usage (macro_id, ticket_id, used_by)
      VALUES (?, ?, ?)
    `).run(macroId, ticketId, userId);

    // Update ticket timestamp
    db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ticketId);

    return NextResponse.json({
      success: true,
      macroId,
      ticketId,
      content: macro.content,
      executedActions,
    });
  } catch (error) {
    console.error('Error applying macro:', error);
    return NextResponse.json(
      { error: 'Failed to apply macro' },
      { status: 500 }
    );
  }
}
