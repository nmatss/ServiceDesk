import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context';
import { getCachedStats, cacheStats } from '@/lib/cache';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const DB_TYPE = getDatabaseType();
const IS_POSTGRES = DB_TYPE === 'postgresql';
const RESOLUTION_HOURS_SQL = IS_POSTGRES
  ? 'EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600.0'
  : '(julianday(t.resolved_at) - julianday(t.created_at)) * 24';
const NOW_MINUS_1_HOUR = IS_POSTGRES ? "CURRENT_TIMESTAMP - INTERVAL '1 hour'" : "datetime('now', '-1 hour')";
const NOW_MINUS_24_HOURS = IS_POSTGRES ? "CURRENT_TIMESTAMP - INTERVAL '24 hours'" : "datetime('now', '-24 hours')";
const FALSE_SQL = IS_POSTGRES ? 'FALSE' : '0';
const TRUE_SQL = IS_POSTGRES ? 'TRUE' : '1';
const IS_FINAL_FALSE_OR_NULL_SQL = IS_POSTGRES
  ? '(s.is_final = FALSE OR s.is_final IS NULL)'
  : '(s.is_final = 0 OR s.is_final IS NULL)';
const IS_FINAL_TRUE_SQL = IS_POSTGRES
  ? '(s.is_final = TRUE)'
  : '(s.is_final = 1)';

// GET - Dashboard analytics
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const days = parseInt(period, 10);

    if (isNaN(days) || days < 1) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    }

    // Chave de cache baseada no tenant, período e role do usuário
    const cacheKey = `dashboard_t${tenantContext.id}_${userContext.role}_${days}d`;

    // Tentar buscar do cache primeiro
    let dashboardData = getCachedStats(cacheKey);

    if (!dashboardData) {
      // Calcular dados do dashboard
      dashboardData = await calculateDashboardData(userContext, tenantContext, days);

      // Cachear por 5 minutos
      cacheStats(cacheKey, dashboardData, 300);
    }

    return NextResponse.json({
      success: true,
      period: days,
      user_role: userContext.role,
      tenant_id: tenantContext.id,
      data: dashboardData,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erro ao buscar dados do dashboard', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

async function calculateDashboardData(user: any, tenant: any, days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Dados básicos do sistema
  const systemOverview = await getSystemOverview(user, tenant, startDate);

  // Métricas de tickets
  const ticketMetrics = await getTicketMetrics(user, tenant, startDate);

  // Performance de agentes (apenas para admin/agent)
  const agentPerformance = ['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(user.role)
    ? await getAgentPerformance(tenant, startDate)
    : null;

  // Dados de SLA
  const slaData = await getSLAData(user, tenant, startDate);

  // Atividade recente
  const recentActivity = await getRecentActivity(user, tenant, 10);

  // Trends e analytics
  const trends = await getTrendAnalytics(user, tenant, startDate, days);

  // Top categorias e prioridades
  const categoryStats = await getCategoryStats(user, tenant, startDate);
  const priorityStats = await getPriorityStats(user, tenant, startDate);

  // Dados específicos por role
  const roleSpecificData = await getRoleSpecificData(user, tenant, startDate);

  return {
    overview: systemOverview,
    tickets: ticketMetrics,
    agent_performance: agentPerformance,
    sla: slaData,
    recent_activity: recentActivity,
    trends: trends,
    categories: categoryStats,
    priorities: priorityStats,
    ...roleSpecificData
  };
}

async function getSystemOverview(user: any, tenant: any, startDate: Date) {
  try {
    let whereClause = 'WHERE t.tenant_id = ?';
    const params: any[] = [tenant.id];

    // Filtrar por usuário se for role 'user'
    if (user.role === 'user') {
      whereClause += ' AND t.user_id = ?';
      params.push(user.id);
    }

    const overview = await executeQueryOne<any>(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN ${IS_FINAL_FALSE_OR_NULL_SQL} THEN 1 END) as open_tickets,
        COUNT(CASE WHEN ${IS_FINAL_TRUE_SQL} THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as tickets_period,
        COUNT(CASE WHEN t.assigned_to IS NULL THEN 1 END) as unassigned_tickets,
        AVG(CASE
          WHEN t.resolved_at IS NOT NULL
          THEN ${RESOLUTION_HOURS_SQL}
          ELSE NULL
        END) as avg_resolution_hours
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      ${whereClause}
    `, [startDate.toISOString(), tenant.id, ...params]);

    // Estatísticas de usuários (apenas para admin do tenant)
    let userStats = null;
    if (['super_admin', 'tenant_admin'].includes(user.role)) {
      userStats = await executeQueryOne<any>(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as end_users,
          COUNT(CASE WHEN role = 'agent' THEN 1 END) as agents,
          COUNT(CASE WHEN role = 'tenant_admin' THEN 1 END) as admins
        FROM users
        WHERE tenant_id = ?
      `, [tenant.id]);
    }

    return {
      tickets: {
        total: overview?.total_tickets || 0,
        open: overview?.open_tickets || 0,
        closed: overview?.closed_tickets || 0,
        period: overview?.tickets_period || 0,
        unassigned: overview?.unassigned_tickets || 0,
        avg_resolution_hours: overview?.avg_resolution_hours ? Math.round(overview.avg_resolution_hours * 10) / 10 : 0
      },
      users: userStats
    };
  } catch (error) {
    logger.error('Error getting system overview', error);
    return {
      tickets: {
        total: 0,
        open: 0,
        closed: 0,
        period: 0,
        unassigned: 0,
        avg_resolution_hours: 0
      },
      users: null
    };
  }
}

async function getTicketMetrics(user: any, tenant: any, startDate: Date) {
  try {
    // Tickets por status
    const statusStats = await executeQuery<any>(`
      SELECT
        s.name,
        s.color,
        s.is_final,
        COUNT(t.id) as count
      FROM statuses s
      LEFT JOIN tickets t ON s.id = t.status_id AND t.tenant_id = ?
      WHERE s.tenant_id = ? ${user.role === 'user' ? 'AND (t.user_id = ? OR t.user_id IS NULL)' : ''}
      GROUP BY s.id, s.name, s.color, s.is_final
      ORDER BY count DESC
    `, [tenant.id, tenant.id, ...(user.role === 'user' ? [user.id] : [])]);

    // Tickets criados por dia
    const dailyTickets = await executeQuery<any>(`
      SELECT
        DATE(t.created_at) as date,
        COUNT(*) as count
      FROM tickets t
      WHERE t.tenant_id = ? AND t.created_at >= ? ${user.role === 'user' ? 'AND t.user_id = ?' : ''}
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `, [tenant.id, startDate.toISOString(), ...(user.role === 'user' ? [user.id] : [])]);

    // Tickets resolvidos por dia
    const dailyResolved = await executeQuery<any>(`
      SELECT
        DATE(t.resolved_at) as date,
        COUNT(*) as count
      FROM tickets t
      WHERE t.tenant_id = ? AND t.resolved_at >= ? ${user.role === 'user' ? 'AND t.user_id = ?' : ''}
      GROUP BY DATE(t.resolved_at)
      ORDER BY date ASC
    `, [tenant.id, startDate.toISOString(), ...(user.role === 'user' ? [user.id] : [])]);

    return {
      by_status: statusStats,
      daily_created: dailyTickets,
      daily_resolved: dailyResolved
    };
  } catch (error) {
    logger.error('Error getting ticket metrics', error);
    return {
      by_status: [],
      daily_created: [],
      daily_resolved: []
    };
  }
}

async function getAgentPerformance(tenant: any, startDate: Date) {
  try {
    const performance = await executeQuery<any>(`
      SELECT
        u.id,
        u.name,
        COUNT(t.id) as tickets_assigned,
        COUNT(CASE WHEN ${IS_FINAL_TRUE_SQL} THEN 1 END) as tickets_resolved,
        AVG(CASE
          WHEN t.resolved_at IS NOT NULL
          THEN ${RESOLUTION_HOURS_SQL}
          ELSE NULL
        END) as avg_resolution_hours,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as tickets_period
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to AND t.tenant_id = ?
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE u.tenant_id = ? AND u.role IN ('agent', 'tenant_admin', 'team_manager')
      GROUP BY u.id, u.name
      ORDER BY tickets_resolved DESC, avg_resolution_hours ASC
    `, [startDate.toISOString(), tenant.id, tenant.id, tenant.id]);

    return performance.map(agent => ({
      ...agent,
      avg_resolution_hours: agent.avg_resolution_hours ? Math.round(agent.avg_resolution_hours * 10) / 10 : 0,
      resolution_rate: agent.tickets_assigned > 0 ? Math.round((agent.tickets_resolved / agent.tickets_assigned) * 100) : 0
    }));
  } catch (error) {
    logger.error('Error getting agent performance', error);
    return [];
  }
}

async function ticketColumnExists(columnName: string): Promise<boolean> {
  if (IS_POSTGRES) {
    const row = await executeQueryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = ?
      ) as exists`,
      [columnName]
    );
    return Boolean(row?.exists);
  }

  const tableInfo = await executeQuery<{ name: string }>('PRAGMA table_info(tickets)');
  return tableInfo.some((col) => col.name === columnName);
}

async function getSLAData(user: any, tenant: any, startDate: Date) {
  try {
    let whereClause = 'AND t.tenant_id = ?';
    const params: any[] = [tenant.id];

    if (user.role === 'user') {
      whereClause += ' AND t.user_id = ?';
      params.push(user.id);
    }

    // Check if required columns exist
    const [hasResponseBreached, hasResolutionBreached] = await Promise.all([
      ticketColumnExists('response_breached'),
      ticketColumnExists('resolution_breached')
    ]);

    if (!hasResponseBreached || !hasResolutionBreached) {
      return {
        total_tracked: 0,
        response_compliance: 100,
        resolution_compliance: 100,
        response_compliant: 0,
        resolution_compliant: 0
      };
    }

    const slaStats = await executeQueryOne<any>(`
      SELECT
        COUNT(*) as total_with_sla,
        COUNT(CASE WHEN t.response_breached IN (${FALSE_SQL}) OR t.response_breached IS NULL THEN 1 END) as response_compliant,
        COUNT(CASE WHEN t.resolution_breached IN (${FALSE_SQL}) OR t.resolution_breached IS NULL THEN 1 END) as resolution_compliant,
        COALESCE(AVG(CASE WHEN t.response_breached IN (${FALSE_SQL}) OR t.response_breached IS NULL THEN 1.0 ELSE 0.0 END) * 100, 100) as response_compliance_rate,
        COALESCE(AVG(CASE WHEN t.resolution_breached IN (${FALSE_SQL}) OR t.resolution_breached IS NULL THEN 1.0 ELSE 0.0 END) * 100, 100) as resolution_compliance_rate
      FROM tickets t
      WHERE t.created_at >= ? ${whereClause}
    `, [startDate.toISOString(), ...params]);

    return {
      total_tracked: slaStats?.total_with_sla || 0,
      response_compliance: Math.round((slaStats?.response_compliance_rate || 0) * 10) / 10,
      resolution_compliance: Math.round((slaStats?.resolution_compliance_rate || 0) * 10) / 10,
      response_compliant: slaStats?.response_compliant || 0,
      resolution_compliant: slaStats?.resolution_compliant || 0
    };
  } catch (error) {
    logger.error('Error getting SLA data', error);
    return {
      total_tracked: 0,
      response_compliance: 0,
      resolution_compliance: 0,
      response_compliant: 0,
      resolution_compliant: 0
    };
  }
}

async function getRecentActivity(user: any, tenant: any, limit: number) {
  try {
    let whereClause = 'WHERE t.tenant_id = ?';
    const params: any[] = [tenant.id];

    if (user.role === 'user') {
      whereClause += ' AND t.user_id = ?';
      params.push(user.id);
    }

    const recentTickets = await executeQuery<any>(`
      SELECT
        t.id,
        t.title,
        t.created_at,
        t.updated_at,
        u.name as user_name,
        s.name as status_name,
        s.color as status_color,
        p.name as priority_name,
        p.color as priority_color,
        c.name as category_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
      JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
      ${whereClause}
      ORDER BY t.updated_at DESC
      LIMIT ?
    `, [tenant.id, tenant.id, tenant.id, tenant.id, ...params, limit]);

    return recentTickets;
  } catch (error) {
    logger.error('Error getting recent activity', error);
    return [];
  }
}

async function getTrendAnalytics(user: any, tenant: any, startDate: Date, days: number) {
  try {
    let whereClause = 'AND t.tenant_id = ?';
    const params: any[] = [tenant.id];

    if (user.role === 'user') {
      whereClause += ' AND t.user_id = ?';
      params.push(user.id);
    }

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    const currentPeriod = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM tickets t
      WHERE t.created_at >= ? ${whereClause}
    `, [startDate.toISOString(), ...params]);

    const previousPeriod = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM tickets t
      WHERE t.created_at >= ? AND t.created_at < ? ${whereClause}
    `, [previousStartDate.toISOString(), startDate.toISOString(), ...params]);

    const currentCount = currentPeriod?.count || 0;
    const previousCount = previousPeriod?.count || 0;
    const change = previousCount > 0
      ? ((currentCount - previousCount) / previousCount) * 100
      : 0;

    return {
      current_period: currentCount,
      previous_period: previousCount,
      change_percentage: Math.round(change * 10) / 10,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  } catch (error) {
    logger.error('Error getting trend analytics', error);
    return {
      current_period: 0,
      previous_period: 0,
      change_percentage: 0,
      trend: 'stable' as const
    };
  }
}

async function getCategoryStats(user: any, tenant: any, startDate: Date) {
  try {
    let additionalWhere = '';
    const additionalParams: any[] = [];

    if (user.role === 'user') {
      additionalWhere = 'AND t.user_id = ?';
      additionalParams.push(user.id);
    }

    return await executeQuery<any>(`
      SELECT
        c.name,
        c.color,
        COUNT(t.id) as count,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as count_period
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id AND t.tenant_id = ? ${additionalWhere}
      WHERE c.tenant_id = ?
      GROUP BY c.id, c.name, c.color
      ORDER BY count DESC
    `, [startDate.toISOString(), tenant.id, ...additionalParams, tenant.id]);
  } catch (error) {
    logger.error('Error getting category stats', error);
    return [];
  }
}

async function getPriorityStats(user: any, tenant: any, startDate: Date) {
  try {
    let additionalWhere = '';
    const additionalParams: any[] = [];

    if (user.role === 'user') {
      additionalWhere = 'AND t.user_id = ?';
      additionalParams.push(user.id);
    }

    return await executeQuery<any>(`
      SELECT
        p.name,
        p.color,
        p.level,
        COUNT(t.id) as count,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as count_period
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id AND t.tenant_id = ? ${additionalWhere}
      WHERE p.tenant_id = ?
      GROUP BY p.id, p.name, p.color, p.level
      ORDER BY p.level DESC, count DESC
    `, [startDate.toISOString(), tenant.id, ...additionalParams, tenant.id]);
  } catch (error) {
    logger.error('Error getting priority stats', error);
    return [];
  }
}

async function getRoleSpecificData(user: any, tenant: any, startDate: Date) {
  try {
    const data: any = {};

    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'tenant_admin') {
      data.system_health = await getSystemHealthData(tenant);
      data.user_activity = await getUserActivityData(tenant, startDate);
    } else if (user.role === 'agent' || user.role === 'team_manager') {
      data.my_assignments = await getAgentAssignments(user.id, tenant);
      data.workload = await getAgentWorkload(user.id, tenant);
    } else if (user.role === 'user') {
      data.my_tickets = await getUserTicketsSummary(user.id, tenant, startDate);
    }

    return data;
  } catch (error) {
    logger.error('Error getting role specific data', error);
    return {
      system_health: null,
      user_activity: null,
      my_assignments: null,
      my_workload: null,
      my_tickets: null
    };
  }
}

async function getSystemHealthData(tenant: any) {
  try {
    return await executeQueryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM tickets WHERE tenant_id = ? AND created_at >= ${NOW_MINUS_1_HOUR}) as tickets_last_hour,
        (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND created_at >= ${NOW_MINUS_24_HOURS}) as new_users_today,
        (SELECT COUNT(*) FROM notifications WHERE tenant_id = ? AND created_at >= ${NOW_MINUS_1_HOUR} AND is_read = ${FALSE_SQL}) as unread_notifications,
        (SELECT COUNT(*) FROM sla_tracking st JOIN tickets t ON st.ticket_id = t.id WHERE t.tenant_id = ? AND st.resolution_breached = ${TRUE_SQL}) as sla_breaches
    `, [tenant.id, tenant.id, tenant.id, tenant.id]);
  } catch (error) {
    logger.error('Error getting system health data', error);
    return {
      tickets_last_hour: 0,
      new_users_today: 0,
      unread_notifications: 0,
      sla_breaches: 0
    };
  }
}

async function getUserActivityData(tenant: any, startDate: Date) {
  try {
    return await executeQuery<any>(`
      SELECT
        u.name,
        u.role,
        COUNT(t.id) as tickets_created
      FROM users u
      LEFT JOIN tickets t ON u.id = t.user_id AND t.tenant_id = ? AND t.created_at >= ?
      WHERE u.tenant_id = ? AND u.role = 'user'
      GROUP BY u.id, u.name, u.role
      HAVING COUNT(t.id) > 0
      ORDER BY tickets_created DESC
      LIMIT 10
    `, [tenant.id, startDate.toISOString(), tenant.id]);
  } catch (error) {
    logger.error('Error getting user activity data', error);
    return [];
  }
}

async function getAgentAssignments(agentId: number, tenant: any) {
  try {
    return await executeQuery<any>(`
      SELECT
        t.id,
        t.title,
        t.created_at,
        p.name as priority_name,
        p.color as priority_color,
        s.name as status_name
      FROM tickets t
      JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE t.tenant_id = ? AND t.assigned_to = ? AND ${IS_FINAL_FALSE_OR_NULL_SQL}
      ORDER BY p.level DESC, t.created_at ASC
      LIMIT 10
    `, [tenant.id, tenant.id, tenant.id, agentId]);
  } catch (error) {
    logger.error('Error getting agent assignments', error);
    return [];
  }
}

async function getAgentWorkload(agentId: number, tenant: any) {
  try {
    return await executeQueryOne<any>(`
      SELECT
        COUNT(*) as total_assigned,
        COUNT(CASE WHEN ${IS_FINAL_FALSE_OR_NULL_SQL} THEN 1 END) as open_tickets,
        COUNT(CASE WHEN p.level = 4 THEN 1 END) as critical_tickets,
        COUNT(CASE WHEN st.response_due_at < CURRENT_TIMESTAMP AND st.first_response_at IS NULL THEN 1 END) as overdue_response
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.tenant_id = ? AND t.assigned_to = ?
    `, [tenant.id, tenant.id, tenant.id, agentId]);
  } catch (error) {
    logger.error('Error getting agent workload', error);
    return {
      total_assigned: 0,
      open_tickets: 0,
      critical_tickets: 0,
      overdue_response: 0
    };
  }
}

async function getUserTicketsSummary(userId: number, tenant: any, startDate: Date) {
  try {
    return await executeQueryOne<any>(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN ${IS_FINAL_FALSE_OR_NULL_SQL} THEN 1 END) as open_tickets,
        COUNT(CASE WHEN ${IS_FINAL_TRUE_SQL} THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as tickets_period,
        AVG(CASE
          WHEN t.resolved_at IS NOT NULL
          THEN ${RESOLUTION_HOURS_SQL}
          ELSE NULL
        END) as avg_resolution_hours
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE t.tenant_id = ? AND t.user_id = ?
    `, [startDate.toISOString(), tenant.id, tenant.id, userId]);
  } catch (error) {
    logger.error('Error getting user tickets summary', error);
    return {
      total_tickets: 0,
      open_tickets: 0,
      closed_tickets: 0,
      tickets_period: 0,
      avg_resolution_hours: 0
    };
  }
}
