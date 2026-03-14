/**
 * PWA Sync API Route
 * Handles offline data synchronization
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

interface SyncAction {
  id: number;
  type: 'CREATE_TICKET' | 'UPDATE_TICKET' | 'ADD_COMMENT' | 'UPDATE_STATUS' | 'UPLOAD_ATTACHMENT';
  data: Record<string, unknown>;
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
    const conflicts: Array<Record<string, unknown>> = [];

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
    const sinceDate = new Date(lastSyncTime).toISOString();

    const updates = {
      tickets: await executeQueryOne(`SELECT COUNT(*) as count FROM tickets
           WHERE (user_id = ? OR assigned_to = ?)
           AND updated_at > ?`, [String(userGet.id), String(userGet.id), sinceDate]),

      comments: await executeQueryOne(`SELECT COUNT(*) as count FROM comments c
           INNER JOIN tickets t ON c.ticket_id = t.id
           WHERE (t.user_id = ? OR t.assigned_to = ?)
           AND c.created_at > ?`, [String(userGet.id), String(userGet.id), sinceDate]),

      notifications: await executeQueryOne(`SELECT COUNT(*) as count FROM notifications
           WHERE user_id = ?
           AND created_at > ?`, [String(userGet.id), sinceDate]),
    };

    return NextResponse.json({
      hasUpdates: Object.values(updates).some((u) => (u as { count: number } | undefined)?.count ? (u as { count: number }).count > 0 : false),
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

type SyncActionData = Record<string, unknown>;

async function syncCreateTicket(_db: unknown, userId: string, data: SyncActionData): Promise<number> {
  const result = await executeRun(
      `INSERT INTO tickets (title, description, priority, category_id, user_id)
       VALUES (?, ?, ?, ?, ?)`,
    [
      data.title as string,
      data.description as string,
      (data.priority as string) || 'medium',
      data.category_id as number,
      userId
    ]);

  return result.lastInsertRowid as number;
}

async function syncAddComment(_db: unknown, userId: string, data: SyncActionData): Promise<number> {
  const result = await executeRun(
      `INSERT INTO comments (ticket_id, user_id, content, is_internal)
       VALUES (?, ?, ?, ?)`,
    [data.ticketId as number, userId, data.content as string, (data.isInternal as boolean) || false]);

  return result.lastInsertRowid as number;
}

async function syncUpdateTicket(
  _db: unknown,
  _userId: string,
  data: SyncActionData
): Promise<{ id: number; conflict?: Record<string, unknown> }> {
  // Check for conflicts
  const current = await executeQueryOne<{ updated_at: string }>(
    'SELECT updated_at FROM tickets WHERE id = ?',
    [data.id as number]);

  if (current && data.lastKnownUpdate) {
    const currentTime = new Date(current.updated_at).getTime();
    const clientTime = data.lastKnownUpdate as number;

    if (currentTime > clientTime) {
      return {
        id: data.id as number,
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
  const updateValues: (string | number | boolean | null | undefined)[] = [];

  if (data.title !== undefined) {
    updateFields.push('title = ?');
    updateValues.push(data.title as string);
  }
  if (data.description !== undefined) {
    updateFields.push('description = ?');
    updateValues.push(data.description as string);
  }
  if (data.priority !== undefined) {
    updateFields.push('priority = ?');
    updateValues.push(data.priority as string);
  }
  if (data.status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(data.status as string);
  }

  if (updateFields.length > 0) {
    updateValues.push(data.id as number);
    await executeRun(`UPDATE tickets SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, updateValues);
  }

  return { id: data.id as number };
}

async function syncUpdateStatus(_db: unknown, _userId: string, data: SyncActionData): Promise<number> {
  await executeRun(`UPDATE tickets
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`, [data.status as string, data.ticketId as number]);

  return data.ticketId as number;
}

async function getUpdatedData(_db: unknown, userId: string, lastSyncTime: number) {
  const sinceDate = new Date(lastSyncTime).toISOString();

  const tickets = await executeQuery(
      `SELECT * FROM tickets
       WHERE (user_id = ? OR assigned_to = ?)
       AND updated_at > ?
       LIMIT 100`,
    [userId, userId, sinceDate]);

  const notifications = await executeQuery(
      `SELECT * FROM notifications
       WHERE user_id = ?
       AND created_at > ?
       ORDER BY created_at DESC
       LIMIT 100`,
    [userId, sinceDate]);

  return {
    tickets,
    notifications,
  };
}
