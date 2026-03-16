/**
 * Self-Healing History API
 *
 * GET: List self-healing events with pagination and filters.
 * Queries from tickets tagged 'auto-healing' + audit_logs.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin } from '@/lib/auth/roles';
import { executeQuery, type SqlParam } from '@/lib/db/adapter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

interface HistoryEvent {
  id: number;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: number;
  action: string;
  details: string;
  created_at: string;
  user_id: number;
}

/**
 * GET /api/self-healing/history
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { organizationId, role } = guard.auth!;

  if (!isAdmin(role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
    const offset = (page - 1) * limit;
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const status = searchParams.get('status');

    // Build conditions
    const conditions: string[] = ['t.organization_id = ?'];
    const params: SqlParam[] = [organizationId];

    // Filter by auto-healing tag
    conditions.push(
      "t.id IN (SELECT tt.ticket_id FROM ticket_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tg.name = 'auto-healing')"
    );

    if (dateFrom) {
      conditions.push('t.created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('t.created_at <= ?');
      params.push(dateTo);
    }
    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    // Count total
    const countResult = await executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM tickets t WHERE ${whereClause}`,
      params
    );
    const total = countResult[0]?.count || 0;

    // Fetch events (tickets)
    const events = await executeQuery<HistoryEvent>(
      `SELECT
        t.id,
        t.ticket_number,
        t.title,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at
      FROM tickets t
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Fetch related audit log entries for these events
    const auditEntries: AuditEntry[] = [];
    if (events.length > 0) {
      const auditRows = await executeQuery<AuditEntry>(
        `SELECT id, action, details, created_at, user_id
         FROM audit_logs
         WHERE organization_id = ?
           AND action LIKE 'self_healing_%'
         ORDER BY created_at DESC
         LIMIT 100`,
        [organizationId]
      );
      auditEntries.push(...auditRows);
    }

    // Enrich events with parsed audit data
    const enrichedEvents = events.map((event) => {
      // Find runbook execution details from audit
      const runbookStart = auditEntries.find((a) => {
        if (a.action !== 'self_healing_runbook_start') return false;
        try {
          const details = JSON.parse(a.details);
          return details.alert_id && event.title.includes('[Auto-Healing]');
        } catch {
          return false;
        }
      });

      const runbookEnd = auditEntries.find((a) => {
        if (a.action !== 'self_healing_runbook_end') return false;
        try {
          const details = JSON.parse(a.details);
          return details.alert_id && event.title.includes('[Auto-Healing]');
        } catch {
          return false;
        }
      });

      let runbook_name = null;
      let runbook_success = null;
      let duration_ms = null;

      if (runbookEnd) {
        try {
          const details = JSON.parse(runbookEnd.details);
          runbook_name = details.runbook_name;
          runbook_success = details.success;
          duration_ms = details.duration_ms;
        } catch {
          // ignore
        }
      } else if (runbookStart) {
        try {
          const details = JSON.parse(runbookStart.details);
          runbook_name = details.runbook_name;
        } catch {
          // ignore
        }
      }

      return {
        ...event,
        runbook_name,
        runbook_success,
        duration_ms,
        result: event.status === 'resolved'
          ? 'success'
          : event.status === 'open'
          ? 'escalated'
          : 'in_progress',
      };
    });

    // Stats
    const statsResult = await executeQuery<{ status: string; count: number }>(
      `SELECT t.status, COUNT(*) as count
       FROM tickets t
       WHERE t.organization_id = ?
         AND t.id IN (SELECT tt.ticket_id FROM ticket_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tg.name = 'auto-healing')
       GROUP BY t.status`,
      [organizationId]
    );

    const stats: Record<string, number> = {};
    for (const row of statsResult) {
      stats[row.status] = row.count;
    }

    return apiSuccess(
      {
        events: enrichedEvents,
        stats,
      },
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Error fetching history: ${errMsg}`);
    return apiError(`Erro ao buscar historico: ${errMsg}`, 500);
  }
}
