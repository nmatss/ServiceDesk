import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 1y

    const db = getDb()

    // Calcular data de início baseada no período
    let dateFilter = ''
    switch (period) {
      case '7d':
        dateFilter = "datetime('now', '-7 days')"
        break
      case '90d':
        dateFilter = "datetime('now', '-90 days')"
        break
      case '1y':
        dateFilter = "datetime('now', '-1 year')"
        break
      default: // 30d
        dateFilter = "datetime('now', '-30 days')"
    }

    // Métricas gerais
    const totalTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE created_at >= ${dateFilter}
    `).get() as { count: number }

    const resolvedTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE resolved_at IS NOT NULL AND resolved_at >= ${dateFilter}
    `).get() as { count: number }

    const openTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE s.is_final = 0
    `).get() as { count: number }

    const overdueTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      INNER JOIN sla_tracking sla ON t.id = sla.ticket_id
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE s.is_final = 0
      AND (
        (sla.response_due_at < datetime('now') AND sla.response_met = 0)
        OR (sla.resolution_due_at < datetime('now') AND sla.resolution_met = 0)
      )
    `).get() as { count: number }

    // Taxa de resolução
    const resolutionRate = totalTickets.count > 0
      ? Math.round((resolvedTickets.count / totalTickets.count) * 100)
      : 0

    // Tempo médio de primeira resposta (em horas)
    const avgFirstResponseTime = db.prepare(`
      SELECT AVG(response_time_minutes) as avg_time
      FROM sla_tracking
      WHERE response_met = 1 AND created_at >= ${dateFilter}
    `).get() as { avg_time: number }

    // Tempo médio de resolução (em horas)
    const avgResolutionTime = db.prepare(`
      SELECT AVG(resolution_time_minutes) as avg_time
      FROM sla_tracking
      WHERE resolution_met = 1 AND created_at >= ${dateFilter}
    `).get() as { avg_time: number }

    // Tickets por status
    const ticketsByStatus = db.prepare(`
      SELECT
        s.name as status,
        s.color,
        COUNT(t.id) as count
      FROM statuses s
      LEFT JOIN tickets t ON s.id = t.status_id
      WHERE t.created_at >= ${dateFilter} OR t.id IS NULL
      GROUP BY s.id, s.name, s.color
      ORDER BY count DESC
    `).all()

    // Tickets por categoria
    const ticketsByCategory = db.prepare(`
      SELECT
        c.name as category,
        c.color,
        COUNT(t.id) as count
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id AND t.created_at >= ${dateFilter}
      GROUP BY c.id, c.name, c.color
      ORDER BY count DESC
    `).all()

    // Tickets por prioridade
    const ticketsByPriority = db.prepare(`
      SELECT
        p.name as priority,
        p.level,
        p.color,
        COUNT(t.id) as count
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id AND t.created_at >= ${dateFilter}
      GROUP BY p.id, p.name, p.level, p.color
      ORDER BY p.level DESC
    `).all()

    // Tendência de tickets (últimos 14 dias)
    const ticketTrend = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as created,
        (
          SELECT COUNT(*)
          FROM tickets t2
          WHERE DATE(t2.resolved_at) = DATE(t1.created_at)
        ) as resolved
      FROM tickets t1
      WHERE created_at >= datetime('now', '-14 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all()

    // Performance dos agentes (apenas para admins)
    let agentPerformance = []
    if (user.role === 'admin') {
      agentPerformance = db.prepare(`
        SELECT
          u.name as agent_name,
          COUNT(t.id) as tickets_assigned,
          COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END) as tickets_resolved,
          AVG(CASE WHEN sla.response_met = 1 THEN sla.response_time_minutes END) as avg_response_time,
          AVG(CASE WHEN sla.resolution_met = 1 THEN sla.resolution_time_minutes END) as avg_resolution_time
        FROM users u
        LEFT JOIN tickets t ON u.id = t.assigned_to AND t.created_at >= ${dateFilter}
        LEFT JOIN sla_tracking sla ON t.id = sla.ticket_id
        WHERE u.role IN ('agent', 'admin')
        GROUP BY u.id, u.name
        ORDER BY tickets_resolved DESC
        LIMIT 10
      `).all()
    }

    // SLA Performance
    const slaPerformance = db.prepare(`
      SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN response_met = 1 THEN 1 ELSE 0 END) as response_met,
        SUM(CASE WHEN resolution_met = 1 THEN 1 ELSE 0 END) as resolution_met,
        AVG(response_time_minutes) as avg_response_time,
        AVG(resolution_time_minutes) as avg_resolution_time
      FROM sla_tracking
      WHERE created_at >= ${dateFilter}
    `).get()

    const responseCompliance = slaPerformance.total_tickets > 0
      ? Math.round((slaPerformance.response_met / slaPerformance.total_tickets) * 100)
      : 0

    const resolutionCompliance = slaPerformance.total_tickets > 0
      ? Math.round((slaPerformance.resolution_met / slaPerformance.total_tickets) * 100)
      : 0

    // Satisfação do cliente (mock por enquanto)
    const customerSatisfaction = db.prepare(`
      SELECT
        AVG(rating) as avg_rating,
        COUNT(*) as total_surveys
      FROM satisfaction_surveys
      WHERE created_at >= ${dateFilter}
    `).get() as { avg_rating: number; total_surveys: number }

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
          ticketTrend: ticketTrend.map(item => ({
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
        ...(user.role === 'admin' && { agentPerformance })
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