import db from '../db/connection';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  priorityId?: number;
  statusId?: number;
  assignedTo?: number;
  userId?: number;
}

export interface TicketMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResolutionTime: number;
  avgResponseTime: number;
  slaCompliance: number;
}

export interface AgentPerformance {
  agentId: number;
  agentName: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  avgResolutionTime: number;
  avgResponseTime: number;
  slaCompliance: number;
  satisfactionRating: number;
}

export interface CategoryStats {
  categoryId: number;
  categoryName: string;
  totalTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  slaCompliance: number;
}

export interface PriorityDistribution {
  priorityId: number;
  priorityName: string;
  priorityLevel: number;
  ticketCount: number;
  percentage: number;
  avgResolutionTime: number;
}

export interface SatisfactionMetrics {
  totalSurveys: number;
  avgRating: number;
  avgAgentRating: number;
  avgResolutionSpeedRating: number;
  avgCommunicationRating: number;
  ratingDistribution: { rating: number; count: number }[];
}

/**
 * Constrói cláusula WHERE baseada nos filtros
 */
function buildWhereClause(filters: ReportFilters, tableAlias: string = 't'): { whereClause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.startDate) {
    conditions.push(`${tableAlias}.created_at >= ?`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`${tableAlias}.created_at <= ?`);
    params.push(filters.endDate);
  }

  if (filters.categoryId) {
    conditions.push(`${tableAlias}.category_id = ?`);
    params.push(filters.categoryId);
  }

  if (filters.priorityId) {
    conditions.push(`${tableAlias}.priority_id = ?`);
    params.push(filters.priorityId);
  }

  if (filters.statusId) {
    conditions.push(`${tableAlias}.status_id = ?`);
    params.push(filters.statusId);
  }

  if (filters.assignedTo) {
    conditions.push(`${tableAlias}.assigned_to = ?`);
    params.push(filters.assignedTo);
  }

  if (filters.userId) {
    conditions.push(`${tableAlias}.user_id = ?`);
    params.push(filters.userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

/**
 * Relatório de métricas gerais de tickets
 */
export function getTicketMetrics(filters: ReportFilters = {}): TicketMetrics {
  try {
    const { whereClause, params } = buildWhereClause(filters);

    const query = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN s.name IN ('Novo', 'Aberto') THEN 1 END) as open,
        COUNT(CASE WHEN s.name = 'Em Andamento' THEN 1 END) as inProgress,
        COUNT(CASE WHEN s.name = 'Resolvido' THEN 1 END) as resolved,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as closed,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime,
        AVG(CASE WHEN st.response_met = 1 THEN st.response_time_minutes END) as avgResponseTime,
        (COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) * 100.0 / COUNT(*)) as slaCompliance
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      ${whereClause}
    `);

    const result = query.get(...params) as any;

    return {
      total: result.total || 0,
      open: result.open || 0,
      inProgress: result.inProgress || 0,
      resolved: result.resolved || 0,
      closed: result.closed || 0,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0),
      avgResponseTime: Math.round(result.avgResponseTime || 0),
      slaCompliance: Math.round((result.slaCompliance || 0) * 100) / 100
    };
  } catch (error) {
    console.error('Error getting ticket metrics:', error);
    return {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      avgResolutionTime: 0,
      avgResponseTime: 0,
      slaCompliance: 0
    };
  }
}

/**
 * Relatório de performance de agentes
 */
export function getAgentPerformance(filters: ReportFilters = {}): AgentPerformance[] {
  try {
    const { whereClause, params } = buildWhereClause(filters);

    const query = db.prepare(`
      SELECT
        u.id as agentId,
        u.name as agentName,
        COUNT(t.id) as ticketsAssigned,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as ticketsResolved,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime,
        AVG(CASE WHEN st.response_met = 1 THEN st.response_time_minutes END) as avgResponseTime,
        (COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) * 100.0 / COUNT(t.id)) as slaCompliance,
        AVG(ss.agent_rating) as satisfactionRating
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      WHERE u.role IN ('admin', 'agent')
      ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
      GROUP BY u.id, u.name
      HAVING COUNT(t.id) > 0
      ORDER BY ticketsAssigned DESC
    `);

    const results = query.all(...params) as any[];

    return results.map(result => ({
      agentId: result.agentId,
      agentName: result.agentName,
      ticketsAssigned: result.ticketsAssigned || 0,
      ticketsResolved: result.ticketsResolved || 0,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0),
      avgResponseTime: Math.round(result.avgResponseTime || 0),
      slaCompliance: Math.round((result.slaCompliance || 0) * 100) / 100,
      satisfactionRating: Math.round((result.satisfactionRating || 0) * 100) / 100
    }));
  } catch (error) {
    console.error('Error getting agent performance:', error);
    return [];
  }
}

/**
 * Relatório de estatísticas por categoria
 */
export function getCategoryStats(filters: ReportFilters = {}): CategoryStats[] {
  try {
    const { whereClause, params } = buildWhereClause(filters);

    const query = db.prepare(`
      SELECT
        c.id as categoryId,
        c.name as categoryName,
        COUNT(t.id) as totalTickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as resolvedTickets,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime,
        (COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) * 100.0 / COUNT(t.id)) as slaCompliance
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      ${whereClause ? whereClause.replace('WHERE', 'WHERE') : ''}
      GROUP BY c.id, c.name
      HAVING COUNT(t.id) > 0
      ORDER BY totalTickets DESC
    `);

    const results = query.all(...params) as any[];

    return results.map(result => ({
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      totalTickets: result.totalTickets || 0,
      resolvedTickets: result.resolvedTickets || 0,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0),
      slaCompliance: Math.round((result.slaCompliance || 0) * 100) / 100
    }));
  } catch (error) {
    console.error('Error getting category stats:', error);
    return [];
  }
}

/**
 * Distribuição por prioridade
 */
export function getPriorityDistribution(filters: ReportFilters = {}): PriorityDistribution[] {
  try {
    const { whereClause, params } = buildWhereClause(filters);

    // Primeiro, obter o total de tickets para calcular percentuais
    const totalQuery = db.prepare(`
      SELECT COUNT(*) as total
      FROM tickets t
      ${whereClause}
    `);
    const { total } = totalQuery.get(...params) as { total: number };

    if (total === 0) return [];

    const query = db.prepare(`
      SELECT
        p.id as priorityId,
        p.name as priorityName,
        p.level as priorityLevel,
        COUNT(t.id) as ticketCount,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      ${whereClause ? whereClause.replace('WHERE', 'WHERE') : ''}
      GROUP BY p.id, p.name, p.level
      HAVING COUNT(t.id) > 0
      ORDER BY p.level DESC
    `);

    const results = query.all(...params) as any[];

    return results.map(result => ({
      priorityId: result.priorityId,
      priorityName: result.priorityName,
      priorityLevel: result.priorityLevel,
      ticketCount: result.ticketCount || 0,
      percentage: Math.round(((result.ticketCount || 0) / total) * 10000) / 100,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0)
    }));
  } catch (error) {
    console.error('Error getting priority distribution:', error);
    return [];
  }
}

/**
 * Métricas de satisfação
 */
export function getSatisfactionMetrics(filters: ReportFilters = {}): SatisfactionMetrics {
  try {
    const { whereClause, params } = buildWhereClause(filters, 't');

    const query = db.prepare(`
      SELECT
        COUNT(ss.id) as totalSurveys,
        AVG(ss.rating) as avgRating,
        AVG(ss.agent_rating) as avgAgentRating,
        AVG(ss.resolution_speed_rating) as avgResolutionSpeedRating,
        AVG(ss.communication_rating) as avgCommunicationRating
      FROM satisfaction_surveys ss
      JOIN tickets t ON ss.ticket_id = t.id
      ${whereClause}
    `);

    const result = query.get(...params) as any;

    // Distribuição de ratings
    const distributionQuery = db.prepare(`
      SELECT
        ss.rating,
        COUNT(*) as count
      FROM satisfaction_surveys ss
      JOIN tickets t ON ss.ticket_id = t.id
      ${whereClause}
      GROUP BY ss.rating
      ORDER BY ss.rating
    `);

    const distribution = distributionQuery.all(...params) as { rating: number; count: number }[];

    return {
      totalSurveys: result.totalSurveys || 0,
      avgRating: Math.round((result.avgRating || 0) * 100) / 100,
      avgAgentRating: Math.round((result.avgAgentRating || 0) * 100) / 100,
      avgResolutionSpeedRating: Math.round((result.avgResolutionSpeedRating || 0) * 100) / 100,
      avgCommunicationRating: Math.round((result.avgCommunicationRating || 0) * 100) / 100,
      ratingDistribution: distribution
    };
  } catch (error) {
    console.error('Error getting satisfaction metrics:', error);
    return {
      totalSurveys: 0,
      avgRating: 0,
      avgAgentRating: 0,
      avgResolutionSpeedRating: 0,
      avgCommunicationRating: 0,
      ratingDistribution: []
    };
  }
}

/**
 * Relatório de tendências (dados por período)
 */
export function getTrendData(filters: ReportFilters = {}, groupBy: 'day' | 'week' | 'month' = 'day'): any[] {
  try {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = "strftime('%Y-W%W', t.created_at)";
        break;
      case 'month':
        dateFormat = "strftime('%Y-%m', t.created_at)";
        break;
      default:
        dateFormat = "strftime('%Y-%m-%d', t.created_at)";
    }

    const { whereClause, params } = buildWhereClause(filters);

    const query = db.prepare(`
      SELECT
        ${dateFormat} as period,
        COUNT(*) as ticketsCreated,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as ticketsResolved,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      ${whereClause}
      GROUP BY ${dateFormat}
      ORDER BY period
    `);

    const results = query.all(...params) as any[];

    return results.map(result => ({
      period: result.period,
      ticketsCreated: result.ticketsCreated || 0,
      ticketsResolved: result.ticketsResolved || 0,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0)
    }));
  } catch (error) {
    console.error('Error getting trend data:', error);
    return [];
  }
}

/**
 * Relatório de SLA
 */
export function getSLAReport(filters: ReportFilters = {}): any {
  try {
    const { whereClause, params } = buildWhereClause(filters);

    const query = db.prepare(`
      SELECT
        sp.name as slaName,
        COUNT(st.id) as totalTickets,
        COUNT(CASE WHEN st.response_met = 1 THEN 1 END) as responseMet,
        COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) as resolutionMet,
        COUNT(CASE WHEN st.response_due_at < CURRENT_TIMESTAMP AND st.response_met = 0 THEN 1 END) as responseBreaches,
        COUNT(CASE WHEN st.resolution_due_at < CURRENT_TIMESTAMP AND st.resolution_met = 0 THEN 1 END) as resolutionBreaches,
        AVG(st.response_time_minutes) as avgResponseTime,
        AVG(st.resolution_time_minutes) as avgResolutionTime
      FROM sla_tracking st
      JOIN sla_policies sp ON st.sla_policy_id = sp.id
      JOIN tickets t ON st.ticket_id = t.id
      ${whereClause}
      GROUP BY sp.id, sp.name
      ORDER BY totalTickets DESC
    `);

    const results = query.all(...params) as any[];

    return results.map(result => ({
      slaName: result.slaName,
      totalTickets: result.totalTickets || 0,
      responseCompliance: result.totalTickets > 0 ? Math.round((result.responseMet / result.totalTickets) * 10000) / 100 : 0,
      resolutionCompliance: result.totalTickets > 0 ? Math.round((result.resolutionMet / result.totalTickets) * 10000) / 100 : 0,
      responseBreaches: result.responseBreaches || 0,
      resolutionBreaches: result.resolutionBreaches || 0,
      avgResponseTime: Math.round(result.avgResponseTime || 0),
      avgResolutionTime: Math.round(result.avgResolutionTime || 0)
    }));
  } catch (error) {
    console.error('Error getting SLA report:', error);
    return [];
  }
}

/**
 * Dashboard executivo com métricas principais
 */
export function getExecutiveDashboard(filters: ReportFilters = {}): any {
  try {
    const ticketMetrics = getTicketMetrics(filters);
    const agentPerformance = getAgentPerformance(filters);
    const categoryStats = getCategoryStats(filters);
    const satisfactionMetrics = getSatisfactionMetrics(filters);
    const trendData = getTrendData(filters, 'week');

    return {
      summary: {
        totalTickets: ticketMetrics.total,
        openTickets: ticketMetrics.open,
        slaCompliance: ticketMetrics.slaCompliance,
        avgResolutionTime: ticketMetrics.avgResolutionTime,
        satisfactionRating: satisfactionMetrics.avgRating
      },
      agents: {
        totalAgents: agentPerformance.length,
        topPerformer: agentPerformance[0]?.agentName || 'N/A',
        avgTicketsPerAgent: agentPerformance.length > 0 ? Math.round(agentPerformance.reduce((sum, agent) => sum + agent.ticketsAssigned, 0) / agentPerformance.length) : 0
      },
      categories: categoryStats.slice(0, 5), // Top 5 categorias
      satisfaction: satisfactionMetrics,
      trends: trendData.slice(-8) // Últimas 8 semanas
    };
  } catch (error) {
    console.error('Error getting executive dashboard:', error);
    return null;
  }
}

/**
 * Exporta dados de relatório em formato CSV
 */
export function exportToCSV(data: any[], filename: string): string {
  try {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape aspas duplas e envolve em aspas se contém vírgula
          const stringValue = String(value || '');
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return '';
  }
}