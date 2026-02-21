/**
 * PWA Sync API Route
 * Handles offline data synchronization
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

interface SyncAction {
  id: number;
  type: 'CREATE_TICKET' | 'UPDATE_TICKET' | 'ADD_COMMENT' | 'UPDATE_STATUS' | 'UPLOAD_ATTACHMENT';
  data: any;
  timestamp: number;
}

interface SyncRequest {
  actions: SyncAction[];
  lastSyncTime?: number;
}

interface SyncResult {
  actionId: number;
  success: boolean;
  serverId?: string | number;
  error?: string;
}

/**
 * Sync offline actions
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const user = { id: guard.auth!.userId };

    const body: SyncRequest = await request.json();
    const { actions, lastSyncTime } = body;

    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json(
        { error: 'Invalid sync data' },
        { status: 400 }
      );
    }

    const results: SyncResult[] = [];
    const conflicts: any[] = [];

    // Process each action
    for (const action of actions) {
      try {
        let serverId: string | number | undefined;

        switch (action.type) {
          case 'CREATE_TICKET':
            serverId = await syncCreateTicket(null, String(user.id), action.data);
            break;

          case 'ADD_COMMENT':
            serverId = await syncAddComment(null, String(user.id), action.data);
            break;

          case 'UPDATE_TICKET':
            const updateResult = await syncUpdateTicket(null, String(user.id), action.data);
            serverId = updateResult.id;
            if (updateResult.conflict) {
              conflicts.push({
                actionId: action.id,
                type: 'ticket_update',
                ...updateResult.conflict,
              });
            }
            break;

          case 'UPDATE_STATUS':
            serverId = await syncUpdateStatus(null, String(user.id), action.data);
            break;

          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }

        results.push({
          actionId: action.id,
          success: true,
          serverId,
        });

        logger.info('Sync action processed', {
          userId: user.id,
          actionType: action.type,
          actionId: action.id,
        });
      } catch (error) {
        results.push({
          actionId: action.id,
          success: false,
          error: String(error),
        });

        logger.error('Sync action failed', {
          userId: user.id,
          actionType: action.type,
          actionId: action.id,
          error,
        });
      }
    }

    // Get updated data if requested
    const updatedData = lastSyncTime
      ? await getUpdatedData(null, String(user.id), lastSyncTime)
      : null;

    return NextResponse.json({
      success: true,
      results,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      updatedData,
      syncTime: Date.now(),
    });
  } catch (error) {
    logger.error('Sync request failed', error);

    return NextResponse.json(
      {
        error: 'Sync failed',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Get sync status
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardGet = requireTenantUserContext(request);
    if (guardGet.response) return guardGet.response;
    const userGet = { id: guardGet.auth!.userId };

    const { searchParams } = new URL(request.url);
    const lastSyncTime = parseInt(searchParams.get('lastSync') || '0', 10);

    // Get counts of updated items since last sync
    const updates = {
      tickets: await executeQueryOne(`SELECT COUNT(*) as count FROM tickets
           WHERE (created_by = ? OR assigned_to = ?)
           AND updated_at > datetime(?, 'unixepoch', 'localtime')`, [String(userGet.id), String(userGet.id), lastSyncTime / 1000]),

      comments: await executeQueryOne(`SELECT COUNT(*) as count FROM comments c
           INNER JOIN tickets t ON c.ticket_id = t.id
           WHERE (t.created_by = ? OR t.assigned_to = ?)
           AND c.created_at > datetime(?, 'unixepoch', 'localtime')`, [String(userGet.id), String(userGet.id), lastSyncTime / 1000]),

      notifications: await executeQueryOne(`SELECT COUNT(*) as count FROM notifications
           WHERE user_id = ?
           AND created_at > datetime(?, 'unixepoch', 'localtime')`, [String(userGet.id), lastSyncTime / 1000]),
    };

    return NextResponse.json({
      hasUpdates: Object.values(updates).some((u: any) => u.count > 0),
      updates,
      serverTime: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get sync status', error);

    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function syncCreateTicket(_db: any, userId: string, data: any): Promise<number> {
  const result = await executeRun(
      `INSERT INTO tickets (title, description, priority, category_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
    [
      data.title,
      data.description,
      data.priority || 'medium',
      data.category_id,
      userId
    ]);

  return result.lastInsertRowid as number;
}

async function syncAddComment(_db: any, userId: string, data: any): Promise<number> {
  const result = await executeRun(
      `INSERT INTO comments (ticket_id, user_id, content, is_internal)
       VALUES (?, ?, ?, ?)`,
    [data.ticketId, userId, data.content, data.isInternal || false]);

  return result.lastInsertRowid as number;
}

async function syncUpdateTicket(
  _db: any,
  _userId: string,
  data: any
): Promise<{ id: number; conflict?: any }> {
  // Check for conflicts
  const current = await executeQueryOne<{ updated_at: string }>(
    'SELECT updated_at FROM tickets WHERE id = ?',
    [data.id]);

  if (current && data.lastKnownUpdate) {
    const currentTime = new Date(current.updated_at).getTime();
    const clientTime = data.lastKnownUpdate;

    if (currentTime > clientTime) {
      return {
        id: data.id,
        conflict: {
          current,
          attempted: data,
          message: 'Ticket was modified by another user',
        },
      };
    }
  }

  // Update ticket
  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (data.title !== undefined) {
    updateFields.push('title = ?');
    updateValues.push(data.title);
  }
  if (data.description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(data.description);
  }
  if (data.priority !== undefined) {
    updateFields.push('priority = ?');
    updateValues.push(data.priority);
  }
  if (data.status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(data.status);
  }

  if (updateFields.length > 0) {
    updateValues.push(data.id);
    await executeRun(`UPDATE tickets SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, updateValues);
  }

  return { id: data.id };
}

async function syncUpdateStatus(_db: any, _userId: string, data: any): Promise<number> {
  await executeRun(`UPDATE tickets
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`, [data.status, data.ticketId]);

  return data.ticketId;
}

async function getUpdatedData(_db: any, userId: string, lastSyncTime: number) {
  const sinceDate = new Date(lastSyncTime).toISOString();

  const tickets = await executeQuery(
      `SELECT * FROM tickets
       WHERE (created_by = ? OR assigned_to = ?)
       AND updated_at > ?
       LIMIT 50`,
    [userId, userId, sinceDate]);

  const notifications = await executeQuery(
      `SELECT * FROM notifications
       WHERE user_id = ?
       AND created_at > ?
       ORDER BY created_at DESC
       LIMIT 20`,
    [userId, sinceDate]);

  return {
    tickets,
    notifications,
  };
}
