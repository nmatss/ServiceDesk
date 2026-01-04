/**
 * Agent Statistics API
 *
 * Provides real-time statistics for the agent workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]

    // Agent's assigned open tickets
    const assignedOpen = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status IN ('open', 'in_progress')
    `).get(auth.user.id, auth.user.organization_id) as { count: number }

    // Agent's pending tickets
    const assignedPending = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status = 'pending'
    `).get(auth.user.id, auth.user.organization_id) as { count: number }

    // Resolved today by agent
    const resolvedToday = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status IN ('resolved', 'closed')
      AND date(resolved_at) = date('now')
    `).get(auth.user.id, auth.user.organization_id) as { count: number }

    // Average response time (last 30 days)
    const avgResponse = db.prepare(`
      SELECT AVG(
        (julianday(first_response_at) - julianday(created_at)) * 24 * 60
      ) as avg_minutes
      FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND first_response_at IS NOT NULL
      AND created_at >= date('now', '-30 days')
    `).get(auth.user.id, auth.user.organization_id) as { avg_minutes: number | null }

    // SLA compliance (last 30 days)
    const slaMetrics = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN response_breach = 0 AND resolution_breach = 0 THEN 1 ELSE 0 END) as met
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.assigned_to = ? AND t.organization_id = ?
      AND st.created_at >= date('now', '-30 days')
    `).get(auth.user.id, auth.user.organization_id) as { total: number; met: number }

    const slaCompliance = slaMetrics.total > 0
      ? Math.round((slaMetrics.met / slaMetrics.total) * 100)
      : 100

    // Queue stats
    const unassigned = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND assigned_to IS NULL
      AND status IN ('open', 'in_progress')
    `).get(auth.user.organization_id) as { count: number }

    const myQueue = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND organization_id = ?
      AND status IN ('open', 'in_progress', 'pending')
    `).get(auth.user.id, auth.user.organization_id) as { count: number }

    // SLA at risk (within 30 minutes of deadline)
    const slaAtRisk = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ?
      AND t.status IN ('open', 'in_progress')
      AND (
        (st.response_deadline IS NOT NULL AND st.response_deadline <= datetime('now', '+30 minutes') AND st.response_breach = 0)
        OR (st.resolution_deadline IS NOT NULL AND st.resolution_deadline <= datetime('now', '+30 minutes') AND st.resolution_breach = 0)
      )
    `).get(auth.user.organization_id) as { count: number }

    // Breached SLA
    const breached = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ?
      AND t.status IN ('open', 'in_progress')
      AND (st.response_breach = 1 OR st.resolution_breach = 1)
    `).get(auth.user.organization_id) as { count: number }

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
    console.error('Error fetching agent stats:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
