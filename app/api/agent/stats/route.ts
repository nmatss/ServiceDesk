/**
 * Agent Statistics API
 *
 * Provides real-time statistics for the agent workspace.
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server'
import { executeQueryOne } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId } = guard.auth!
const today = new Date().toISOString().split('T')[0]

    // Agent's assigned open tickets
    const assignedOpen = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status IN ('open', 'in_progress')
    `, [userId, organizationId]) || { count: 0 }

    // Agent's pending tickets
    const assignedPending = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status = 'pending'
    `, [userId, organizationId]) || { count: 0 }

    // Resolved today by agent
    const resolvedToday = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status IN ('resolved', 'closed')
      AND date(resolved_at) = date('now')
    `, [userId, organizationId]) || { count: 0 }

    // Average response time (last 30 days)
    const avgResponse = await executeQueryOne<{ avg_minutes: number | null }>(`
      SELECT AVG(
        (julianday(first_response_at) - julianday(created_at)) * 24 * 60
      ) as avg_minutes
      FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND first_response_at IS NOT NULL
      AND created_at >= date('now', '-30 days')
    `, [userId, organizationId]) || { avg_minutes: null }

    // SLA compliance (last 30 days)
    const slaMetrics = await executeQueryOne<{ total: number; met: number }>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN response_breach = 0 AND resolution_breach = 0 THEN 1 ELSE 0 END) as met
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.assigned_to = ? AND t.organization_id = ?
      AND st.created_at >= date('now', '-30 days')
    `, [userId, organizationId]) || { total: 0, met: 0 }

    const slaCompliance = slaMetrics.total > 0
      ? Math.round((slaMetrics.met / slaMetrics.total) * 100)
      : 100

    // Queue stats
    const unassigned = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND assigned_to IS NULL
      AND status IN ('open', 'in_progress')
    `, [organizationId]) || { count: 0 }

    const myQueue = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status IN ('open', 'in_progress', 'pending')
    `, [userId, organizationId]) || { count: 0 }

    // SLA at risk (within 30 minutes of deadline)
    const slaAtRisk = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ?
      AND t.status IN ('open', 'in_progress')
      AND (
        (st.response_deadline IS NOT NULL AND st.response_deadline <= datetime('now', '+30 minutes') AND st.response_breach = 0)
        OR (st.resolution_deadline IS NOT NULL AND st.resolution_deadline <= datetime('now', '+30 minutes') AND st.resolution_breach = 0)
      )
    `, [organizationId]) || { count: 0 }

    // Breached SLA
    const breached = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ?
      AND t.status IN ('open', 'in_progress')
      AND (st.response_breach = 1 OR st.resolution_breach = 1)
    `, [organizationId]) || { count: 0 }

    return NextResponse.json({
      success: true,
      agent_stats: {
        assigned_open: assignedOpen.count,
        assigned_pending: assignedPending.count,
        resolved_today: resolvedToday.count,
        avg_response_time: Math.round(avgResponse.avg_minutes || 0),
        sla_compliance: slaCompliance,
        csat_score: 4.2 // Placeholder - would calculate from feedback
      },
      queue_stats: {
        unassigned: unassigned.count,
        my_queue: myQueue.count,
        team_queue: 0, // Would need team assignment
        sla_at_risk: slaAtRisk.count,
        breached: breached.count
      }
    })
  } catch (error) {
    logger.error('Error fetching agent stats:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
