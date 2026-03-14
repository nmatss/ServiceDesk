import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, sqlNow, sqlDatetimeSub, sqlDatetimeSubYears } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { isAdmin } from '@/lib/auth/roles';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;
  const user = auth;

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 1y
    // Calcular data de início baseada no período
    let dateFilter = ''
    switch (period) {
      case '7d':
        dateFilter = sqlDatetimeSub(7)
        break
      case '90d':
        dateFilter = sqlDatetimeSub(90)
        break
      case '1y':
        dateFilter = sqlDatetimeSubYears(1)
        break
      default: // 30d
        dateFilter = sqlDatetimeSub(30)
    }

    const organizationId = auth.organizationId;

    // Métricas gerais
    const totalTickets = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND created_at >= ${dateFilter}
    `, [organizationId]) || { count: 0 }

    const resolvedTickets = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND resolved_at IS NOT NULL AND resolved_at >= ${dateFilter}
    `, [organizationId]) || { count: 0 }

    const openTickets = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets t
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE t.organization_id = ? AND s.is_final = 0
    `, [organizationId]) || { count: 0 }

    const overdueTickets = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets t
      INNER JOIN sla_tracking sla ON t.id = sla.ticket_id
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE t.organization_id = ? AND s.is_final = 0
      AND (
        (sla.response_due_at < ${sqlNow()} AND sla.response_met = 0)
        OR (sla.resolution_due_at < ${sqlNow()} AND sla.resolution_met = 0)
      )
    `, [organizationId]) || { count: 0 }

    // Taxa de resolução
    const resolutionRate = totalTickets.count > 0
      ? Math.round((resolvedTickets.count / totalTickets.count) * 100)
      : 0

    // Tempo médio de primeira resposta (em horas)
    const avgFirstResponseTime = await executeQueryOne<{ avg_time: number }>(`
      SELECT AVG(st.response_time_minutes) as avg_time
      FROM sla_tracking st
      JOIN tickets t ON st.ticket_id = t.id
      WHERE t.organization_id = ? AND st.response_met = 1 AND st.created_at >= ${dateFilter}
    `, [organizationId]) || { avg_time: 0 }

    // Tempo médio de resolução (em horas)
    const avgResolutionTime = await executeQueryOne<{ avg_time: number }>(`
      SELECT AVG(st.resolution_time_minutes) as avg_time
      FROM sla_tracking st
      JOIN tickets t ON st.ticket_id = t.id
      WHERE t.organization_id = ? AND st.resolution_met = 1 AND st.created_at >= ${dateFilter}
    `, [organizationId]) || { avg_time: 0 }

    // Tickets por status
    const ticketsByStatus = await executeQuery(`
      SELECT
        s.name as status,
        s.color,
        COUNT(t.id) as count
      FROM statuses s
      LEFT JOIN tickets t ON s.id = t.status_id AND t.organization_id = ?
      WHERE t.created_at >= ${dateFilter} OR t.id IS NULL
      GROUP BY s.id, s.name, s.color
      ORDER BY count DESC
    `, [organizationId])

    // Tickets por categoria
    const ticketsByCategory = await executeQuery(`
      SELECT
        c.name as category,
        c.color,
        COUNT(t.id) as count
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id AND t.organization_id = ? AND t.created_at >= ${dateFilter}
      GROUP BY c.id, c.name, c.color
      ORDER BY count DESC
    `, [organizationId])

    // Tickets por prioridade
    const ticketsByPriority = await executeQuery(`
      SELECT
        p.name as priority,
        p.level,
        p.color,
        COUNT(t.id) as count
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id AND t.organization_id = ? AND t.created_at >= ${dateFilter}
      GROUP BY p.id, p.name, p.level, p.color
      ORDER BY p.level DESC
    `, [organizationId])

    // Tendência de tickets (últimos 14 dias)
    const ticketTrend = await executeQuery(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as created,
        (
          SELECT COUNT(*)
          FROM tickets t2
          WHERE t2.organization_id = ? AND DATE(t2.resolved_at) = DATE(t1.created_at)
        ) as resolved
      FROM tickets t1
      WHERE t1.organization_id = ? AND created_at >= ${sqlDatetimeSub(14)}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [organizationId, organizationId])

    // Performance dos agentes (apenas para admins)
    let agentPerformance: any[] = []
    if (isAdmin(user.role)) {
      agentPerformance = await executeQuery(`
        SELECT
          u.name as agent_name,
          COUNT(t.id) as tickets_assigned,
          COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END) as tickets_resolved,
          AVG(CASE WHEN sla.response_met = 1 THEN sla.response_time_minutes END) as avg_response_time,
          AVG(CASE WHEN sla.resolution_met = 1 THEN sla.resolution_time_minutes END) as avg_resolution_time
        FROM users u
        LEFT JOIN tickets t ON u.id = t.assigned_to AND t.created_at >= ${dateFilter}
        LEFT JOIN sla_tracking sla ON t.id = sla.ticket_id
        WHERE u.organization_id = ? AND u.role IN ('agent', 'admin')
        GROUP BY u.id, u.name
        ORDER BY tickets_resolved DESC
        LIMIT 10
      `, [organizationId])
    }

    // SLA Performance
    const slaPerformance = await executeQueryOne<any>(`
      SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN st.response_met = 1 THEN 1 ELSE 0 END) as response_met,
        SUM(CASE WHEN st.resolution_met = 1 THEN 1 ELSE 0 END) as resolution_met,
        AVG(st.response_time_minutes) as avg_response_time,
        AVG(st.resolution_time_minutes) as avg_resolution_time
      FROM sla_tracking st
      JOIN tickets t ON st.ticket_id = t.id
      WHERE t.organization_id = ? AND st.created_at >= ${dateFilter}
    `, [organizationId])

    const responseCompliance = slaPerformance.total_tickets > 0
      ? Math.round((slaPerformance.response_met / slaPerformance.total_tickets) * 100)
      : 0

    const resolutionCompliance = slaPerformance.total_tickets > 0
      ? Math.round((slaPerformance.resolution_met / slaPerformance.total_tickets) * 100)
      : 0

    // Customer satisfaction from satisfaction_surveys table
    const customerSatisfaction = await executeQueryOne<{ avg_rating: number; total_surveys: number }>(`
      SELECT
        AVG(rating) as avg_rating,
        COUNT(*) as total_surveys
      FROM satisfaction_surveys
      WHERE organization_id = ? AND created_at >= ${dateFilter}
    `, [organizationId]) || { avg_rating: 0, total_surveys: 0 }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalTickets: totalTickets.count,
          resolvedTickets: resolvedTickets.count,
          openTickets: openTickets.count,
          overdueTickets: overdueTickets.count,
          resolutionRate,
          avgFirstResponseTime: avgFirstResponseTime.avg_time
            ? Math.round(avgFirstResponseTime.avg_time / 60 * 10) / 10 // Convert to hours
            : 0,
          avgResolutionTime: avgResolutionTime.avg_time
            ? Math.round(avgResolutionTime.avg_time / 60 * 10) / 10 // Convert to hours
            : 0
        },
        distributions: {
          byStatus: ticketsByStatus,
          byCategory: ticketsByCategory,
          byPriority: ticketsByPriority
        },
        trends: {
          ticketTrend: ticketTrend.map((item: any) => ({
            date: item.date,
            created: item.created,
            resolved: item.resolved
          }))
        },
        sla: {
          responseCompliance,
          resolutionCompliance,
          avgResponseTime: slaPerformance.avg_response_time
            ? Math.round(slaPerformance.avg_response_time / 60 * 10) / 10
            : 0,
          avgResolutionTime: slaPerformance.avg_resolution_time
            ? Math.round(slaPerformance.avg_resolution_time / 60 * 10) / 10
            : 0
        },
        satisfaction: {
          avgRating: customerSatisfaction.avg_rating || 0,
          totalSurveys: customerSatisfaction.total_surveys || 0
        },
        ...(isAdmin(user.role) && { agentPerformance })
      },
      period
    })

  } catch (error) {
    logger.error('Error fetching analytics overview', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}