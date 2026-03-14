import { executeQuery, executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import logger from '../monitoring/structured-logger';

export interface ReportFilters {
  tenantId: number; // REQUIRED - Multi-tenant security: always filter by tenant
  startDate?: string;
  endDate?: string;
  period?: string;
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
 * Constroi clausula WHERE baseada nos filtros
 * SECURITY: tenant_id filter is ALWAYS applied first for multi-tenant isolation
 */
function buildWhereClause(filters: ReportFilters, tableAlias: string = 't'): { whereClause: string; params: SqlParam[] } {
  const conditions: string[] = [];
  const params: SqlParam[] = [];

  // SECURITY: ALWAYS filter by tenant_id first - this is mandatory for multi-tenant security
  if (!filters.tenantId || filters.tenantId <= 0) {
    throw new Error('Security violation: tenantId is required for all report queries');
  }
  conditions.push(`${tableAlias}.tenant_id = ?`);
  params.push(filters.tenantId);

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

  // Always have at least tenant_id condition, so WHERE is always present
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  return { whereClause, params };
}

/**
 * Relatorio de metricas gerais de tickets
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getTicketMetrics(filters: ReportFilters): Promise<TicketMetrics> {
  try {
    const { whereClause, params } = buildWhereClause(filters);

    const result = await executeQueryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN s.name IN ('Novo', 'Aberto') THEN 1 END) as open,
        COUNT(CASE WHEN s.name = 'Em Andamento' THEN 1 END) as inProgress,
        COUNT(CASE WHEN s.name = 'Resolvido' THEN 1 END) as resolved,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as closed,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime,
        AVG(CASE WHEN st.response_met = 1 THEN st.response_time_minutes END) as avgResponseTime,
        (COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) as slaCompliance
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      ${whereClause}
    `, params);

    return {
      total: result?.total || 0,
      open: result?.open || 0,
      inProgress: result?.inProgress || 0,
      resolved: result?.resolved || 0,
      closed: result?.closed || 0,
      avgResolutionTime: Math.round(result?.avgResolutionTime || 0),
      avgResponseTime: Math.round(result?.avgResponseTime || 0),
      slaCompliance: Math.round((result?.slaCompliance || 0) * 100) / 100
    };
  } catch (error) {
    logger.error('Error getting ticket metrics', error);
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
 * Relatorio de performance de agentes
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getAgentPerformance(filters: ReportFilters): Promise<AgentPerformance[]> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for agent performance report');
    }

    const { whereClause, params } = buildWhereClause(filters);

    const results = await executeQuery(`
      SELECT
        u.id as agentId,
        u.name as agentName,
        COUNT(t.id) as ticketsAssigned,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as ticketsResolved,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime,
        AVG(CASE WHEN st.response_met = 1 THEN st.response_time_minutes END) as avgResponseTime,
        (COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0)) as slaCompliance,
        AVG(ss.agent_rating) as satisfactionRating
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to AND t.tenant_id = ?
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      WHERE u.role IN ('admin', 'agent')
      AND u.organization_id = ?
      ${whereClause.replace('WHERE', 'AND')}
      GROUP BY u.id, u.name
      HAVING COUNT(t.id) > 0
      ORDER BY ticketsAssigned DESC
    `, [filters.tenantId, filters.tenantId, ...params]);

    return results.map((result: any) => ({
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
    logger.error('Error getting agent performance', error);
    return [];
  }
}

/**
 * Relatorio de estatisticas por categoria
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getCategoryStats(filters: ReportFilters): Promise<CategoryStats[]> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for category stats report');
    }

    const { whereClause, params } = buildWhereClause(filters);

    const results = await executeQuery(`
      SELECT
        c.id as categoryId,
        c.name as categoryName,
        COUNT(t.id) as totalTickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as resolvedTickets,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime,
        (COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0)) as slaCompliance
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id AND t.tenant_id = ?
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE c.tenant_id = ?
      ${whereClause.replace('WHERE', 'AND')}
      GROUP BY c.id, c.name
      HAVING COUNT(t.id) > 0
      ORDER BY totalTickets DESC
    `, [filters.tenantId, filters.tenantId, ...params]);

    return results.map((result: any) => ({
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      totalTickets: result.totalTickets || 0,
      resolvedTickets: result.resolvedTickets || 0,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0),
      slaCompliance: Math.round((result.slaCompliance || 0) * 100) / 100
    }));
  } catch (error) {
    logger.error('Error getting category stats', error);
    return [];
  }
}

/**
 * Distribuicao por prioridade
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getPriorityDistribution(filters: ReportFilters): Promise<PriorityDistribution[]> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for priority distribution report');
    }

    const { whereClause, params } = buildWhereClause(filters);

    const totalResult = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM tickets t
      ${whereClause}
    `, params);
    const total = totalResult?.total || 0;

    if (total === 0) return [];

    const results = await executeQuery(`
      SELECT
        p.id as priorityId,
        p.name as priorityName,
        p.level as priorityLevel,
        COUNT(t.id) as ticketCount,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avgResolutionTime
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id AND t.tenant_id = ?
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE p.tenant_id = ?
      ${whereClause.replace('WHERE', 'AND')}
      GROUP BY p.id, p.name, p.level
      HAVING COUNT(t.id) > 0
      ORDER BY p.level DESC
    `, [filters.tenantId, filters.tenantId, ...params]);

    return results.map((result: any) => ({
      priorityId: result.priorityId,
      priorityName: result.priorityName,
      priorityLevel: result.priorityLevel,
      ticketCount: result.ticketCount || 0,
      percentage: Math.round(((result.ticketCount || 0) / total) * 10000) / 100,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0)
    }));
  } catch (error) {
    logger.error('Error getting priority distribution', error);
    return [];
  }
}

/**
 * Metricas de satisfacao
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getSatisfactionMetrics(filters: ReportFilters): Promise<SatisfactionMetrics> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for satisfaction metrics report');
    }

    const { whereClause, params } = buildWhereClause(filters, 't');

    const result = await executeQueryOne(`
      SELECT
        COUNT(ss.id) as totalSurveys,
        AVG(ss.rating) as avgRating,
        AVG(ss.agent_rating) as avgAgentRating,
        AVG(ss.resolution_speed_rating) as avgResolutionSpeedRating,
        AVG(ss.communication_rating) as avgCommunicationRating
      FROM satisfaction_surveys ss
      JOIN tickets t ON ss.ticket_id = t.id
      ${whereClause}
    `, params);

    const distribution = await executeQuery<{ rating: number; count: number }>(`
      SELECT
        ss.rating,
        COUNT(*) as count
      FROM satisfaction_surveys ss
      JOIN tickets t ON ss.ticket_id = t.id
      ${whereClause}
      GROUP BY ss.rating
      ORDER BY ss.rating
    `, params);

    return {
      totalSurveys: result?.totalSurveys || 0,
      avgRating: Math.round((result?.avgRating || 0) * 100) / 100,
      avgAgentRating: Math.round((result?.avgAgentRating || 0) * 100) / 100,
      avgResolutionSpeedRating: Math.round((result?.avgResolutionSpeedRating || 0) * 100) / 100,
      avgCommunicationRating: Math.round((result?.avgCommunicationRating || 0) * 100) / 100,
      ratingDistribution: distribution
    };
  } catch (error) {
    logger.error('Error getting satisfaction metrics', error);
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
 * Relatorio de tendencias (dados por periodo)
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getTrendData(filters: ReportFilters, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<any[]> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for trend data report');
    }

    const isPostgres = getDatabaseType() === 'postgresql';
    let dateFormat: string;

    if (isPostgres) {
      switch (groupBy) {
        case 'week':
          dateFormat = "to_char(t.created_at, 'IYYY-\"W\"IW')";
          break;
        case 'month':
          dateFormat = "to_char(t.created_at, 'YYYY-MM')";
          break;
        default:
          dateFormat = "to_char(t.created_at, 'YYYY-MM-DD')";
      }
    } else {
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
    }

    const { whereClause, params } = buildWhereClause(filters);

    const results = await executeQuery(`
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
    `, params);

    return results.map((result: any) => ({
      period: result.period,
      ticketsCreated: result.ticketsCreated || 0,
      ticketsResolved: result.ticketsResolved || 0,
      avgResolutionTime: Math.round(result.avgResolutionTime || 0)
    }));
  } catch (error) {
    logger.error('Error getting trend data', error);
    return [];
  }
}

/**
 * Relatorio de SLA
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getSLAReport(filters: ReportFilters): Promise<any> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for SLA report');
    }

    const { whereClause, params } = buildWhereClause(filters);

    const results = await executeQuery(`
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
      JOIN sla_policies sp ON st.sla_policy_id = sp.id AND sp.tenant_id = ?
      JOIN tickets t ON st.ticket_id = t.id
      ${whereClause}
      GROUP BY sp.id, sp.name
      ORDER BY totalTickets DESC
    `, [filters.tenantId, ...params]);

    return results.map((result: any) => ({
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
    logger.error('Error getting SLA report', error);
    return [];
  }
}

/**
 * Dashboard executivo com metricas principais
 * SECURITY: Requires tenantId in filters for multi-tenant isolation
 */
export async function getExecutiveDashboard(filters: ReportFilters): Promise<any> {
  try {
    if (!filters.tenantId || filters.tenantId <= 0) {
      throw new Error('Security violation: tenantId is required for executive dashboard');
    }

    const ticketMetricsData = await getTicketMetrics(filters);
    const agentPerformance = await getAgentPerformance(filters);
    const categoryStats = await getCategoryStats(filters);
    const satisfactionMetricsData = await getSatisfactionMetrics(filters);
    const trendData = await getTrendData(filters, 'week');

    return {
      summary: {
        totalTickets: ticketMetricsData.total,
        openTickets: ticketMetricsData.open,
        slaCompliance: ticketMetricsData.slaCompliance,
        avgResolutionTime: ticketMetricsData.avgResolutionTime,
        satisfactionRating: satisfactionMetricsData.avgRating
      },
      agents: {
        totalAgents: agentPerformance.length,
        topPerformer: agentPerformance[0]?.agentName || 'N/A',
        avgTicketsPerAgent: agentPerformance.length > 0 ? Math.round(agentPerformance.reduce((sum, agent) => sum + agent.ticketsAssigned, 0) / agentPerformance.length) : 0
      },
      categories: categoryStats.slice(0, 5),
      satisfaction: satisfactionMetricsData,
      trends: trendData.slice(-8)
    };
  } catch (error) {
    logger.error('Error getting executive dashboard', error);
    return null;
  }
}

/**
 * Exporta dados de relatorio em formato CSV
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
    logger.error('Error exporting to CSV', error);
    return '';
  }
}
