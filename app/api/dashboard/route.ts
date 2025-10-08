import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context';
import { getCachedStats, cacheStats } from '@/lib/cache';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

// GET - Dashboard analytics
export async function GET(request: NextRequest) {
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
    const days = parseInt(period);

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

    const overview = db.prepare(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN s.is_final = 0 THEN 1 END) as open_tickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as tickets_period,
        COUNT(CASE WHEN t.assigned_to IS NULL THEN 1 END) as unassigned_tickets,
        AVG(CASE
          WHEN t.resolved_at IS NOT NULL
          THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
          ELSE NULL
        END) as avg_resolution_hours
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      ${whereClause}
    `).get(...params, startDate.toISOString(), tenant.id) as any;

    // Estatísticas de usuários (apenas para admin do tenant)
    let userStats = null;
    if (['super_admin', 'tenant_admin'].includes(user.role)) {
      userStats = db.prepare(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as end_users,
          COUNT(CASE WHEN role = 'agent' THEN 1 END) as agents,
          COUNT(CASE WHEN role = 'tenant_admin' THEN 1 END) as admins
        FROM users
        WHERE tenant_id = ?
      `).get(tenant.id) as any;
    }

    return {
      tickets: {
        total: overview.total_tickets,
        open: overview.open_tickets,
        closed: overview.closed_tickets,
        period: overview.tickets_period,
        unassigned: overview.unassigned_tickets,
        avg_resolution_hours: overview.avg_resolution_hours ? Math.round(overview.avg_resolution_hours * 10) / 10 : 0
      },
      users: userStats
    };
  } catch (error) {
    logger.error('Error getting system overview', error);
    return {};
  }
}

async function getTicketMetrics(user: any, tenant: any, startDate: Date) {
  try {
    let whereClause = 'WHERE t.tenant_id = ?';
    const params: any[] = [tenant.id];

    if (user.role === 'user') {
      whereClause += ' AND t.user_id = ?';
      params.push(user.id);
    }

    // Tickets por status
    const statusStats = db.prepare(`
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
    `).all(tenant.id, tenant.id, ...(user.role === 'user' ? [user.id] : [])) as any[];

    // Tickets criados por dia
    const dailyTickets = db.prepare(`
      SELECT
        DATE(t.created_at) as date,
        COUNT(*) as count
      FROM tickets t
      WHERE t.tenant_id = ? AND t.created_at >= ? ${user.role === 'user' ? 'AND t.user_id = ?' : ''}
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `).all(tenant.id, startDate.toISOString(), ...(user.role === 'user' ? [user.id] : [])) as any[];

    // Tickets resolvidos por dia
    const dailyResolved = db.prepare(`
      SELECT
        DATE(t.resolved_at) as date,
        COUNT(*) as count
      FROM tickets t
      WHERE t.tenant_id = ? AND t.resolved_at >= ? ${user.role === 'user' ? 'AND t.user_id = ?' : ''}
      GROUP BY DATE(t.resolved_at)
      ORDER BY date ASC
    `).all(tenant.id, startDate.toISOString(), ...(user.role === 'user' ? [user.id] : [])) as any[];

    return {
      by_status: statusStats,
      daily_created: dailyTickets,
      daily_resolved: dailyResolved
    };
  } catch (error) {
    logger.error('Error getting ticket metrics', error);
    return {};
  }
}

async function getAgentPerformance(tenant: any, startDate: Date) {
  try {
    const performance = db.prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(t.id) as tickets_assigned,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as tickets_resolved,
        AVG(CASE
          WHEN t.resolved_at IS NOT NULL
          THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
          ELSE NULL
        END) as avg_resolution_hours,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as tickets_period
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to AND t.tenant_id = ?
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE u.tenant_id = ? AND u.role IN ('agent', 'tenant_admin', 'team_manager')
      GROUP BY u.id, u.name
      ORDER BY tickets_resolved DESC, avg_resolution_hours ASC
    `).all(startDate.toISOString(), tenant.id, tenant.id, tenant.id) as any[];

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

async function getSLAData(user: any, tenant: any, startDate: Date) {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (user.role === 'user') {
      whereClause = 'AND t.user_id = ?';
      params.push(user.id);
    }

    // Check if required columns exist
    const tableInfo = db.prepare("PRAGMA table_info(tickets)").all() as any[];
    const hasResponseBreached = tableInfo.some(col => col.name === 'response_breached');
    const hasResolutionBreached = tableInfo.some(col => col.name === 'resolution_breached');

    if (!hasResponseBreached || !hasResolutionBreached) {
      // Return mock SLA data if columns don't exist
      return {
        total_with_sla: 0,
        response_compliant: 0,
        resolution_compliant: 0,
        response_compliance_rate: 100,
        resolution_compliance_rate: 100
      };
    }

    const slaStats = db.prepare(`
      SELECT
        COUNT(*) as total_with_sla,
        COUNT(CASE WHEN t.response_breached = 0 OR t.response_breached IS NULL THEN 1 END) as response_compliant,
        COUNT(CASE WHEN t.resolution_breached = 0 OR t.resolution_breached IS NULL THEN 1 END) as resolution_compliant,
        COALESCE(AVG(CASE WHEN t.response_breached = 0 OR t.response_breached IS NULL THEN 1.0 ELSE 0.0 END) * 100, 100) as response_compliance_rate,
        COALESCE(AVG(CASE WHEN t.resolution_breached = 0 OR t.resolution_breached IS NULL THEN 1.0 ELSE 0.0 END) * 100, 100) as resolution_compliance_rate
      FROM tickets t
      WHERE t.created_at >= ? ${whereClause}
    `).get(startDate.toISOString(), ...params) as any;

    return {
      total_tracked: slaStats?.total_with_sla || 0,
      response_compliance: Math.round((slaStats?.response_compliance_rate || 0) * 10) / 10,
      resolution_compliance: Math.round((slaStats?.resolution_compliance_rate || 0) * 10) / 10,
      response_compliant: slaStats?.response_compliant || 0,
      resolution_compliant: slaStats?.resolution_compliant || 0
    };
  } catch (error) {
    logger.error('Error getting SLA data', error);
    return {};
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

    const recentTickets = db.prepare(`
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
    `).all(tenant.id, tenant.id, tenant.id, tenant.id, ...params, limit) as any[];

    return recentTickets;
  } catch (error) {
    logger.error('Error getting recent activity', error);
    return [];
  }
}

async function getTrendAnalytics(user: any, startDate: Date, days: number) {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (user.role === 'user') {
      whereClause = 'AND t.user_id = ?';
      params.push(user.id);
    }

    // Comparar com período anterior
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    const currentPeriod = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets t
      WHERE t.created_at >= ? ${whereClause}
    `).get(startDate.toISOString(), ...params) as { count: number };

    const previousPeriod = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets t
      WHERE t.created_at >= ? AND t.created_at < ? ${whereClause}
    `).get(previousStartDate.toISOString(), startDate.toISOString(), ...params) as { count: number };

    const change = previousPeriod.count > 0
      ? ((currentPeriod.count - previousPeriod.count) / previousPeriod.count) * 100
      : 0;

    return {
      current_period: currentPeriod.count,
      previous_period: previousPeriod.count,
      change_percentage: Math.round(change * 10) / 10,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  } catch (error) {
    logger.error('Error getting trend analytics', error);
    return {};
  }
}

async function getCategoryStats(user: any, startDate: Date) {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (user.role === 'user') {
      whereClause = 'WHERE t.user_id = ?';
      params.push(user.id);
    }

    return db.prepare(`
      SELECT
        c.name,
        c.color,
        COUNT(t.id) as count,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as count_period
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id ${whereClause ? (whereClause.includes('WHERE') ? 'AND' : 'WHERE') + ' t.user_id = ?' : ''}
      GROUP BY c.id, c.name, c.color
      ORDER BY count DESC
    `).all(startDate.toISOString(), ...(user.role === 'user' ? [user.id] : [])) as any[];
  } catch (error) {
    logger.error('Error getting category stats', error);
    return [];
  }
}

async function getPriorityStats(user: any, startDate: Date) {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (user.role === 'user') {
      whereClause = 'WHERE t.user_id = ?';
      params.push(user.id);
    }

    return db.prepare(`
      SELECT
        p.name,
        p.color,
        p.level,
        COUNT(t.id) as count,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as count_period
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id ${whereClause ? (whereClause.includes('WHERE') ? 'AND' : 'WHERE') + ' t.user_id = ?' : ''}
      GROUP BY p.id, p.name, p.color, p.level
      ORDER BY p.level DESC, count DESC
    `).all(startDate.toISOString(), ...(user.role === 'user' ? [user.id] : [])) as any[];
  } catch (error) {
    logger.error('Error getting priority stats', error);
    return [];
  }
}

async function getRoleSpecificData(user: any, startDate: Date) {
  try {
    const data: any = {};

    if (user.role === 'admin') {
      // Dados específicos para admin
      data.system_health = await getSystemHealthData();
      data.user_activity = await getUserActivityData(startDate);
    } else if (user.role === 'agent') {
      // Dados específicos para agente
      data.my_assignments = await getAgentAssignments(user.id);
      data.workload = await getAgentWorkload(user.id);
    } else if (user.role === 'user') {
      // Dados específicos para usuário final
      data.my_tickets = await getUserTicketsSummary(user.id, startDate);
    }

    return data;
  } catch (error) {
    logger.error('Error getting role specific data', error);
    return {};
  }
}

async function getSystemHealthData() {
  try {
    const health = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM tickets WHERE created_at >= datetime('now', '-1 hour')) as tickets_last_hour,
        (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-24 hours')) as new_users_today,
        (SELECT COUNT(*) FROM notifications WHERE created_at >= datetime('now', '-1 hour') AND is_read = 0) as unread_notifications,
        (SELECT COUNT(*) FROM sla_tracking WHERE resolution_breached = 1) as sla_breaches
    `).get() as any;

    return health;
  } catch (error) {
    logger.error('Error getting system health data', error);
    return {};
  }
}

async function getUserActivityData(startDate: Date) {
  try {
    return db.prepare(`
      SELECT
        u.name,
        u.role,
        COUNT(t.id) as tickets_created
      FROM users u
      LEFT JOIN tickets t ON u.id = t.user_id AND t.created_at >= ?
      WHERE u.role = 'user'
      GROUP BY u.id, u.name, u.role
      HAVING tickets_created > 0
      ORDER BY tickets_created DESC
      LIMIT 10
    `).all(startDate.toISOString()) as any[];
  } catch (error) {
    logger.error('Error getting user activity data', error);
    return [];
  }
}

async function getAgentAssignments(agentId: number) {
  try {
    return db.prepare(`
      SELECT
        t.id,
        t.title,
        t.created_at,
        p.name as priority_name,
        p.color as priority_color,
        s.name as status_name
      FROM tickets t
      JOIN priorities p ON t.priority_id = p.id
      JOIN statuses s ON t.status_id = s.id
      WHERE t.assigned_to = ? AND s.is_final = 0
      ORDER BY p.level DESC, t.created_at ASC
      LIMIT 10
    `).all(agentId) as any[];
  } catch (error) {
    logger.error('Error getting agent assignments', error);
    return [];
  }
}

async function getAgentWorkload(agentId: number) {
  try {
    return db.prepare(`
      SELECT
        COUNT(*) as total_assigned,
        COUNT(CASE WHEN s.is_final = 0 THEN 1 END) as open_tickets,
        COUNT(CASE WHEN p.level = 4 THEN 1 END) as critical_tickets,
        COUNT(CASE WHEN st.response_due_at < datetime('now') AND st.first_response_at IS NULL THEN 1 END) as overdue_response
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.assigned_to = ?
    `).get(agentId) as any;
  } catch (error) {
    logger.error('Error getting agent workload', error);
    return {};
  }
}

async function getUserTicketsSummary(userId: number, startDate: Date) {
  try {
    return db.prepare(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN s.is_final = 0 THEN 1 END) as open_tickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN t.created_at >= ? THEN 1 END) as tickets_period,
        AVG(CASE
          WHEN t.resolved_at IS NOT NULL
          THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
          ELSE NULL
        END) as avg_resolution_hours
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.user_id = ?
    `).get(startDate.toISOString(), userId) as any;
  } catch (error) {
    logger.error('Error getting user tickets summary', error);
    return {};
  }
}