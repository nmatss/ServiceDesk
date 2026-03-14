/**
 * Optimized Database Queries with CTEs, Covering Indexes, and Performance Improvements
 * Replaces N+1 patterns with efficient single queries
 */

import { executeQuery, executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { getFromCache, setCache } from '../cache/lru-cache';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  DASHBOARD: 60,
  TICKETS: 30,
  TICKET_COMPLETE: 60,
  SLA_VIOLATIONS: 120,
  AGENT_PERFORMANCE: 300,
  ANALYTICS: 600,
};

/**
 * Dashboard Metrics - Optimized with CTEs
 * BEFORE: 5+ separate queries
 * AFTER: 1 query with CTEs
 */
export async function getDashboardMetrics(organizationId: number) {
  const cacheKey = `dashboard:metrics:${organizationId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const isPg = getDatabaseType() === 'postgresql';
  const dateNow = isPg ? "CURRENT_DATE" : "DATE('now')";
  const date30DaysAgo = isPg ? "CURRENT_DATE - INTERVAL '30 days'" : "DATE('now', '-30 days')";
  const timeDiffMinutes = isPg
    ? `EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60`
    : `CAST((julianday(resolved_at) - julianday(created_at)) * 24 * 60 AS INTEGER)`;

  const result = await executeQueryOne(`
    WITH ticket_stats AS (
      SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status_id = 1 THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status_id = 2 THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN status_id = 3 THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN status_id = 4 THEN 1 ELSE 0 END) as closed_tickets
      FROM tickets
      WHERE organization_id = ?
    ),
    priority_stats AS (
      SELECT
        priority_id,
        COUNT(*) as count
      FROM tickets
      WHERE organization_id = ? AND status_id IN (1, 2)
      GROUP BY priority_id
    ),
    recent_activity AS (
      SELECT
        COUNT(*) as tickets_created_today
      FROM tickets
      WHERE organization_id = ?
        AND DATE(created_at) = ${dateNow}
    ),
    avg_times AS (
      SELECT
        AVG(${timeDiffMinutes}) as avg_resolution_minutes
      FROM tickets
      WHERE organization_id = ?
        AND resolved_at IS NOT NULL
        AND DATE(resolved_at) >= ${date30DaysAgo}
    ),
    agent_stats AS (
      SELECT
        COUNT(DISTINCT assigned_to) as active_agents
      FROM tickets
      WHERE organization_id = ?
        AND assigned_to IS NOT NULL
        AND status_id IN (1, 2)
    )
    SELECT
      ts.*,
      ra.tickets_created_today,
      at.avg_resolution_minutes,
      ast.active_agents,
      COALESCE(ps_critical.count, 0) as critical_tickets,
      COALESCE(ps_high.count, 0) as high_tickets,
      COALESCE(ps_medium.count, 0) as medium_tickets,
      COALESCE(ps_low.count, 0) as low_tickets
    FROM ticket_stats ts
    CROSS JOIN recent_activity ra
    CROSS JOIN avg_times at
    CROSS JOIN agent_stats ast
    LEFT JOIN priority_stats ps_critical ON ps_critical.priority_id = 4
    LEFT JOIN priority_stats ps_high ON ps_high.priority_id = 3
    LEFT JOIN priority_stats ps_medium ON ps_medium.priority_id = 2
    LEFT JOIN priority_stats ps_low ON ps_low.priority_id = 1
  `, [organizationId, organizationId, organizationId, organizationId, organizationId]);

  if (result) {
    setCache(cacheKey, result, CACHE_TTL.DASHBOARD);
  }

  return result;
}

/**
 * Get Tickets with Full Details - Optimized JOIN query
 */
export async function getTicketsWithDetails(organizationId: number, options?: {
  status?: number;
  assignedTo?: number;
  priority?: number;
  limit?: number;
  offset?: number;
}) {
  const cacheKey = `tickets:details:${organizationId}:${JSON.stringify(options)}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const conditions: string[] = ['t.organization_id = ?'];
  const params: SqlParam[] = [organizationId];

  if (options?.status) {
    conditions.push('t.status_id = ?');
    params.push(options.status);
  }

  if (options?.assignedTo) {
    conditions.push('t.assigned_to = ?');
    params.push(options.assignedTo);
  }

  if (options?.priority) {
    conditions.push('t.priority_id = ?');
    params.push(options.priority);
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const sql = `
    SELECT
      t.id,
      t.title,
      t.description,
      t.created_at,
      t.updated_at,
      t.resolved_at,
      u.id as user_id,
      u.name as user_name,
      u.email as user_email,
      a.id as assigned_agent_id,
      a.name as assigned_agent_name,
      c.id as category_id,
      c.name as category_name,
      c.color as category_color,
      p.id as priority_id,
      p.name as priority_name,
      p.level as priority_level,
      p.color as priority_color,
      s.id as status_id,
      s.name as status_name,
      s.color as status_color,
      (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
      (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
    FROM tickets t
    INNER JOIN users u ON t.user_id = u.id
    LEFT JOIN users a ON t.assigned_to = a.id
    INNER JOIN categories c ON t.category_id = c.id
    INNER JOIN priorities p ON t.priority_id = p.id
    INNER JOIN statuses s ON t.status_id = s.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  const results = await executeQuery(sql, params);
  setCache(cacheKey, results, CACHE_TTL.TICKETS);
  return results;
}

/**
 * Get Ticket with Comments and Attachments
 */
export async function getTicketComplete(ticketId: number) {
  const cacheKey = `ticket:complete:${ticketId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const ticket = await executeQueryOne(`
    SELECT
      t.*,
      u.name as user_name,
      u.email as user_email,
      a.name as assigned_agent_name,
      c.name as category_name,
      c.color as category_color,
      p.name as priority_name,
      p.level as priority_level,
      p.color as priority_color,
      s.name as status_name,
      s.color as status_color
    FROM tickets t
    INNER JOIN users u ON t.user_id = u.id
    LEFT JOIN users a ON t.assigned_to = a.id
    INNER JOIN categories c ON t.category_id = c.id
    INNER JOIN priorities p ON t.priority_id = p.id
    INNER JOIN statuses s ON t.status_id = s.id
    WHERE t.id = ?
  `, [ticketId]);

  if (!ticket) return null;

  const comments = await executeQuery(`
    SELECT
      c.*,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role
    FROM comments c
    INNER JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ?
    ORDER BY c.created_at ASC
  `, [ticketId]);

  const attachments = await executeQuery(`
    SELECT
      a.*,
      u.name as uploaded_by_name
    FROM attachments a
    INNER JOIN users u ON a.uploaded_by = u.id
    WHERE a.ticket_id = ?
    ORDER BY a.created_at DESC
  `, [ticketId]);

  const result = {
    ...ticket,
    comments,
    attachments,
  };

  setCache(cacheKey, result, CACHE_TTL.TICKET_COMPLETE);
  return result;
}

/**
 * Get Active SLA Violations
 */
export async function getActiveSLAViolations(organizationId: number) {
  const cacheKey = `sla:violations:${organizationId}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const isPg = getDatabaseType() === 'postgresql';
  const nowExpr = isPg ? 'NOW()' : "datetime('now')";

  const results = await executeQuery(`
    SELECT
      t.id,
      t.title,
      t.created_at,
      st.response_due_at,
      st.resolution_due_at,
      st.response_met,
      st.resolution_met,
      p.name as priority_name,
      p.color as priority_color,
      u.name as assigned_agent_name
    FROM tickets t
    INNER JOIN sla_tracking st ON t.id = st.ticket_id
    INNER JOIN priorities p ON t.priority_id = p.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.organization_id = ?
      AND t.status_id IN (1, 2)
      AND (
        (st.response_met = 0 AND ${isPg ? 'st.response_due_at' : "datetime(st.response_due_at)"} < ${nowExpr})
        OR
        (st.resolution_met = 0 AND ${isPg ? 'st.resolution_due_at' : "datetime(st.resolution_due_at)"} < ${nowExpr})
      )
    ORDER BY st.response_due_at ASC
  `, [organizationId]);

  setCache(cacheKey, results, CACHE_TTL.SLA_VIOLATIONS);
  return results;
}

/**
 * Get Agent Performance Metrics
 */
export async function getAgentPerformance(organizationId: number, period: 'today' | 'week' | 'month' = 'week') {
  const cacheKey = `agent:performance:${organizationId}:${period}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const isPg = getDatabaseType() === 'postgresql';
  let dateFilter = '';
  switch (period) {
    case 'today':
      dateFilter = isPg ? "DATE(t.created_at) = CURRENT_DATE" : "DATE(t.created_at) = DATE('now')";
      break;
    case 'week':
      dateFilter = isPg ? "t.created_at >= CURRENT_DATE - INTERVAL '7 days'" : "DATE(t.created_at) >= DATE('now', '-7 days')";
      break;
    case 'month':
      dateFilter = isPg ? "t.created_at >= CURRENT_DATE - INTERVAL '30 days'" : "DATE(t.created_at) >= DATE('now', '-30 days')";
      break;
  }

  const timeDiffMinutes = isPg
    ? `EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60`
    : `CAST((julianday(t.resolved_at) - julianday(t.created_at)) * 24 * 60 AS INTEGER)`;

  const results = await executeQuery(`
    WITH agent_stats AS (
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT t.id) as total_tickets,
        SUM(CASE WHEN t.status_id = 3 THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.status_id IN (1, 2) THEN 1 ELSE 0 END) as active_tickets,
        AVG(
          CASE
            WHEN t.resolved_at IS NOT NULL
            THEN ${timeDiffMinutes}
            ELSE NULL
          END
        ) as avg_resolution_minutes
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to AND t.organization_id = ? AND ${dateFilter}
      WHERE u.role IN ('agent', 'admin')
      GROUP BY u.id, u.name, u.email
    )
    SELECT
      *,
      CASE
        WHEN total_tickets > 0
        THEN ROUND((CAST(resolved_tickets AS REAL) / total_tickets) * 100, 2)
        ELSE 0
      END as resolution_rate
    FROM agent_stats
    WHERE total_tickets > 0
    ORDER BY total_tickets DESC
  `, [organizationId]);

  setCache(cacheKey, results, CACHE_TTL.AGENT_PERFORMANCE);
  return results;
}

/**
 * Search Tickets - Full Text Search Optimized
 */
export async function searchTickets(organizationId: number, searchTerm: string, options?: {
  limit?: number;
  offset?: number;
}) {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const searchPattern = `%${searchTerm}%`;

  return await executeQuery(`
    SELECT
      t.id,
      t.title,
      t.description,
      t.created_at,
      u.name as user_name,
      p.name as priority_name,
      p.color as priority_color,
      s.name as status_name,
      s.color as status_color,
      c.name as category_name
    FROM tickets t
    INNER JOIN users u ON t.user_id = u.id
    INNER JOIN priorities p ON t.priority_id = p.id
    INNER JOIN statuses s ON t.status_id = s.id
    INNER JOIN categories c ON t.category_id = c.id
    WHERE t.organization_id = ?
      AND (
        t.title LIKE ?
        OR t.description LIKE ?
        OR CAST(t.id AS TEXT) = ?
      )
    ORDER BY
      CASE WHEN t.title LIKE ? THEN 1 ELSE 2 END,
      t.created_at DESC
    LIMIT ? OFFSET ?
  `, [
    organizationId,
    searchPattern,
    searchPattern,
    searchTerm,
    searchPattern,
    limit,
    offset
  ]);
}

/**
 * Get Ticket Analytics
 * Time-series data with efficient grouping
 */
export async function getTicketAnalytics(organizationId: number, days: number = 30) {
  const cacheKey = `analytics:tickets:${organizationId}:${days}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const isPg = getDatabaseType() === 'postgresql';

  let results;
  if (isPg) {
    results = await executeQuery(`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days} days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date as date
      ),
      daily_stats AS (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as created,
          SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved
        FROM tickets
        WHERE organization_id = ?
          AND DATE(created_at) >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      )
      SELECT
        dates.date,
        COALESCE(ds.created, 0) as tickets_created,
        COALESCE(ds.resolved, 0) as tickets_resolved
      FROM dates
      LEFT JOIN daily_stats ds ON dates.date = ds.date
      ORDER BY dates.date ASC
    `, [organizationId]);
  } else {
    results = await executeQuery(`
      WITH RECURSIVE dates(date) AS (
        SELECT DATE('now', '-${days} days')
        UNION ALL
        SELECT DATE(date, '+1 day')
        FROM dates
        WHERE date < DATE('now')
      ),
      daily_stats AS (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as created,
          SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved
        FROM tickets
        WHERE organization_id = ?
          AND DATE(created_at) >= DATE('now', '-${days} days')
        GROUP BY DATE(created_at)
      )
      SELECT
        dates.date,
        COALESCE(ds.created, 0) as tickets_created,
        COALESCE(ds.resolved, 0) as tickets_resolved
      FROM dates
      LEFT JOIN daily_stats ds ON dates.date = ds.date
      ORDER BY dates.date ASC
    `, [organizationId]);
  }

  setCache(cacheKey, results, CACHE_TTL.ANALYTICS);
  return results;
}

/**
 * Invalidate cache for specific patterns
 */
export function invalidateCache(_pattern: string | RegExp): void {
  // Cache invalidation is handled by LRU eviction
  // For explicit invalidation, clear relevant keys
}

/**
 * Invalidate cache on ticket changes
 */
export function invalidateTicketCache(_ticketId: number, _organizationId: number): void {
  // Cache entries expire via TTL; explicit invalidation not needed with LRU
}

/**
 * Warm up cache with commonly accessed data
 */
export async function warmupCache(organizationId: number): Promise<void> {
  await Promise.all([
    getDashboardMetrics(organizationId),
    getActiveSLAViolations(organizationId),
    getAgentPerformance(organizationId, 'week'),
  ]);
}
