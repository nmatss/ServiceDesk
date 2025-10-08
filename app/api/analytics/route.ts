import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { analyticsQueries, slaQueries, dashboardQueries } from '@/lib/db/queries'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Only allow admin users to access analytics
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 1y
    const metricType = searchParams.get('type') || 'overview'

    // Handle new advanced analytics endpoints
    if (metricType === 'advanced-kpis') {
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getRealTimeKPIs()
      });
    }

    if (metricType === 'sla-analytics') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getSLAAnalytics(periodMap[period] || 'month')
      });
    }

    if (metricType === 'agent-performance') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getAgentPerformance(periodMap[period] || 'month')
      });
    }

    if (metricType === 'category-analytics') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getCategoryAnalytics(periodMap[period] || 'month')
      });
    }

    if (metricType === 'priority-distribution') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getPriorityDistribution(periodMap[period] || 'month')
      });
    }

    if (metricType === 'volume-trends') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getTicketVolumeTrends(periodMap[period] || 'month')
      });
    }

    if (metricType === 'response-time-analytics') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getResponseTimeAnalytics(periodMap[period] || 'month')
      });
    }

    if (metricType === 'satisfaction-trends') {
      const periodMap: Record<string, 'week' | 'month' | 'quarter'> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'quarter'
      };
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getSatisfactionTrends(periodMap[period] || 'month')
      });
    }

    if (metricType === 'sla-breaches') {
      return NextResponse.json({
        success: true,
        data: slaQueries.getBreachedSLAs()
      });
    }

    if (metricType === 'upcoming-breaches') {
      return NextResponse.json({
        success: true,
        data: slaQueries.getUpcomingSLABreaches()
      });
    }

    if (metricType === 'anomaly-detection') {
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getAnomalyDetectionData()
      });
    }

    if (metricType === 'knowledge-base-stats') {
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getKnowledgeBaseAnalytics()
      });
    }

    if (metricType === 'comparative') {
      const compareBy = searchParams.get('compareBy') as 'category' | 'agent' | 'priority' || 'category';
      const periods = searchParams.get('periods')?.split(',') || [];
      return NextResponse.json({
        success: true,
        data: analyticsQueries.getComparativeAnalytics(compareBy, periods)
      });
    }

    let getDateFilter = (tableAlias = '') => {
      const alias = tableAlias ? `${tableAlias}.` : ''
      switch (period) {
        case '7d':
          return `AND ${alias}created_at >= datetime('now', '-7 days')`
        case '30d':
          return `AND ${alias}created_at >= datetime('now', '-30 days')`
        case '90d':
          return `AND ${alias}created_at >= datetime('now', '-90 days')`
        case '1y':
          return `AND ${alias}created_at >= datetime('now', '-1 year')`
        default:
          return `AND ${alias}created_at >= datetime('now', '-30 days')`
      }
    }

    const analytics: any = {}

    if (metricType === 'overview' || metricType === 'all') {
      // Overview metrics
      analytics.overview = {
        totalTickets: db.prepare(`
          SELECT COUNT(*) as count FROM tickets
          WHERE tenant_id = ? ${getDateFilter()}
        `).get(tenantContext.id)?.count || 0,

        openTickets: db.prepare(`
          SELECT COUNT(*) as count FROM tickets t
          LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
          WHERE t.tenant_id = ? AND s.is_final = 0 ${getDateFilter('t')}
        `).get(tenantContext.id, tenantContext.id)?.count || 0,

        closedTickets: db.prepare(`
          SELECT COUNT(*) as count FROM tickets t
          LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
          WHERE t.tenant_id = ? AND s.is_final = 1 ${getDateFilter('t')}
        `).get(tenantContext.id, tenantContext.id)?.count || 0,

        avgResolutionTime: db.prepare(`
          SELECT
            AVG(
              CASE
                WHEN s.is_final = 1 THEN
                  ROUND((julianday(t.updated_at) - julianday(t.created_at)) * 24, 2)
                ELSE NULL
              END
            ) as avg_hours
          FROM tickets t
          LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
          WHERE t.tenant_id = ? ${getDateFilter('t')}
        `).get(tenantContext.id, tenantContext.id)?.avg_hours || 0
      }
    }

    if (metricType === 'tickets' || metricType === 'all') {
      // Tickets by status
      analytics.ticketsByStatus = db.prepare(`
        SELECT
          s.name as status,
          s.color,
          COUNT(*) as count
        FROM tickets t
        LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
        WHERE t.tenant_id = ? ${getDateFilter('t')}
        GROUP BY s.id, s.name, s.color
        ORDER BY count DESC
      `).all(tenantContext.id, tenantContext.id)

      // Tickets by priority
      analytics.ticketsByPriority = db.prepare(`
        SELECT
          p.name as priority,
          p.level,
          p.color,
          COUNT(*) as count
        FROM tickets t
        LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
        WHERE t.tenant_id = ? ${getDateFilter('t')}
        GROUP BY p.id, p.name, p.level, p.color
        ORDER BY p.level DESC
      `).all(tenantContext.id, tenantContext.id)

      // Tickets by category
      analytics.ticketsByCategory = db.prepare(`
        SELECT
          c.name as category,
          c.color,
          COUNT(*) as count
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
        WHERE t.tenant_id = ? ${getDateFilter('t')}
        GROUP BY c.id, c.name, c.color
        ORDER BY count DESC
      `).all(tenantContext.id, tenantContext.id)
    }

    if (metricType === 'trends' || metricType === 'all') {
      // Daily ticket creation trend
      analytics.dailyTicketTrend = db.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM tickets
        WHERE tenant_id = ? ${getDateFilter()}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all(tenantContext.id)

      // Resolution trend
      analytics.resolutionTrend = db.prepare(`
        SELECT
          DATE(t.updated_at) as date,
          COUNT(*) as resolved_count,
          AVG(
            ROUND((julianday(t.updated_at) - julianday(t.created_at)) * 24, 2)
          ) as avg_resolution_hours
        FROM tickets t
        LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
        WHERE t.tenant_id = ? AND s.is_final = 1 ${getDateFilter('t')}
        GROUP BY DATE(t.updated_at)
        ORDER BY date ASC
      `).all(tenantContext.id, tenantContext.id)
    }

    if (metricType === 'users' || metricType === 'all') {
      // Top users by tickets created
      analytics.topTicketCreators = db.prepare(`
        SELECT
          u.name as user_name,
          u.role,
          COUNT(*) as ticket_count
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
        WHERE t.tenant_id = ? ${getDateFilter('t')}
        GROUP BY u.id, u.name, u.role
        ORDER BY ticket_count DESC
        LIMIT 10
      `).all(tenantContext.id, tenantContext.id)

      // Most active commenters
      analytics.topCommenters = db.prepare(`
        SELECT
          u.name as user_name,
          u.role,
          COUNT(*) as comment_count
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id AND u.tenant_id = ?
        WHERE c.tenant_id = ? ${getDateFilter('c')}
        GROUP BY u.id, u.name, u.role
        ORDER BY comment_count DESC
        LIMIT 10
      `).all(tenantContext.id, tenantContext.id)
    }

    if (metricType === 'performance' || metricType === 'all') {
      // SLA performance (if columns exist)
      try {
        analytics.slaPerformance = {
          responseTimeBreaches: db.prepare(`
            SELECT COUNT(*) as count FROM tickets
            WHERE tenant_id = ? AND response_breached = 1 ${getDateFilter()}
          `).get(tenantContext.id).count,

          resolutionTimeBreaches: db.prepare(`
            SELECT COUNT(*) as count FROM tickets
            WHERE tenant_id = ? AND resolution_breached = 1 ${getDateFilter()}
          `).get(tenantContext.id).count,

          onTimeResolutions: db.prepare(`
            SELECT COUNT(*) as count FROM tickets t
            LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
            WHERE t.tenant_id = ? AND s.is_final = 1
            AND (t.resolution_breached = 0 OR t.resolution_breached IS NULL) ${getDateFilter('t')}
          `).get(tenantContext.id, tenantContext.id).count
        }
      } catch (error) {
        // SLA columns don't exist yet
        analytics.slaPerformance = {
          responseTimeBreaches: 0,
          resolutionTimeBreaches: 0,
          onTimeResolutions: 0
        }
      }
    }

    return NextResponse.json({
      success: true,
      period,
      analytics
    })
  } catch (error) {
    logger.error('Error fetching analytics', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}