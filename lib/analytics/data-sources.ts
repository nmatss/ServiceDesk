/**
 * Data Sources Module
 *
 * Provides connectors for various data sources to power dashboard widgets
 */

import db from '@/lib/db/connection';
import logger from '../monitoring/structured-logger';

export interface DataSource {
  id: string;
  name: string;
  type: 'sql' | 'api' | 'computed' | 'static';
  category: 'tickets' | 'sla' | 'agents' | 'customers' | 'custom';
  description: string;
  parameters?: DataSourceParameter[];
  requiredPermissions?: string[];
}

export interface DataSourceParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  default?: any;
  description?: string;
  options?: any[];
}

export interface QueryOptions {
  startDate?: Date;
  endDate?: Date;
  categoryId?: number;
  priorityId?: number;
  statusId?: number;
  assignedTo?: number;
  limit?: number;
  offset?: number;
  groupBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

// ============================================================================
// Ticket Data Sources
// ============================================================================

export const ticketDataSources = {
  /**
   * Get ticket volume over time
   */
  getTicketVolume: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      groupBy = 'day'
    } = options;

    const groupByFormat = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'week' ? '%Y-W%W' : '%Y-%m';

    const query = `
      SELECT
        strftime('${groupByFormat}', created_at) as date,
        COUNT(*) as created,
        SUM(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'resolved') THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN priority_id = (SELECT id FROM priorities WHERE level = 4) THEN 1 ELSE 0 END) as high_priority
      FROM tickets
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY strftime('${groupByFormat}', created_at)
      ORDER BY date ASC
    `;

    try {
      const rows = db.prepare(query).all(startDate.toISOString(), endDate.toISOString());
      return rows;
    } catch (error) {
      logger.error('Error fetching ticket volume', error);
      return [];
    }
  },

  /**
   * Get ticket distribution by category
   */
  getTicketsByCategory: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = options;

    const query = `
      SELECT
        c.name as category,
        c.color,
        COUNT(t.id) as count,
        ROUND(COUNT(t.id) * 100.0 / (SELECT COUNT(*) FROM tickets WHERE created_at >= ? AND created_at <= ?), 2) as percentage
      FROM categories c
      LEFT JOIN tickets t ON t.category_id = c.id
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY c.id, c.name, c.color
      HAVING count > 0
      ORDER BY count DESC
    `;

    try {
      const rows = db.prepare(query).all(
        startDate.toISOString(),
        endDate.toISOString(),
        startDate.toISOString(),
        endDate.toISOString()
      );
      return rows;
    } catch (error) {
      logger.error('Error fetching tickets by category', error);
      return [];
    }
  },

  /**
   * Get ticket distribution by priority
   */
  getTicketsByPriority: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = options;

    const query = `
      SELECT
        p.name as priority,
        p.level,
        p.color,
        COUNT(t.id) as count,
        ROUND(AVG(CAST((julianday(COALESCE(t.resolved_at, datetime('now'))) - julianday(t.created_at)) * 24 AS INTEGER)), 2) as avg_resolution_time
      FROM priorities p
      LEFT JOIN tickets t ON t.priority_id = p.id
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY p.id, p.name, p.level, p.color
      HAVING count > 0
      ORDER BY p.level DESC
    `;

    try {
      const rows = db.prepare(query).all(startDate.toISOString(), endDate.toISOString());
      return rows;
    } catch (error) {
      logger.error('Error fetching tickets by priority', error);
      return [];
    }
  },

  /**
   * Get ticket status distribution
   */
  getTicketsByStatus: async (_options: QueryOptions = {}) => {
    const query = `
      SELECT
        s.name as status,
        s.color,
        COUNT(t.id) as count
      FROM statuses s
      LEFT JOIN tickets t ON t.status_id = s.id
      GROUP BY s.id, s.name, s.color
      HAVING count > 0
      ORDER BY count DESC
    `;

    try {
      const rows = db.prepare(query).all();
      return rows;
    } catch (error) {
      logger.error('Error fetching tickets by status', error);
      return [];
    }
  }
};

// ============================================================================
// SLA Data Sources
// ============================================================================

export const slaDataSources = {
  /**
   * Get SLA compliance metrics
   */
  getSLACompliance: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = options;

    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN is_violated = 0 THEN 1 ELSE 0 END) as response_met,
        SUM(CASE WHEN is_violated = 1 THEN 1 ELSE 0 END) as response_violated,
        ROUND(AVG(CAST((julianday(first_response_at) - julianday(created_at)) * 24 * 60 AS INTEGER)), 2) as avg_response_time,
        ROUND(AVG(CAST((julianday(resolved_at) - julianday(created_at)) * 24 * 60 AS INTEGER)), 2) as avg_resolution_time
      FROM sla_tracking
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    try {
      const rows = db.prepare(query).all(startDate.toISOString(), endDate.toISOString());
      return rows.map((row: any) => ({
        ...row,
        response_sla_rate: row.total_tickets > 0 ? (row.response_met / row.total_tickets) * 100 : 0,
        resolution_sla_rate: row.total_tickets > 0 ? (row.response_met / row.total_tickets) * 100 : 0
      }));
    } catch (error) {
      logger.error('Error fetching SLA compliance', error);
      return [];
    }
  },

  /**
   * Get SLA performance by priority
   */
  getSLAByPriority: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = options;

    const query = `
      SELECT
        p.name as priority,
        p.color,
        COUNT(st.id) as total,
        SUM(CASE WHEN st.is_violated = 0 THEN 1 ELSE 0 END) as met,
        ROUND(AVG(CAST((julianday(st.first_response_at) - julianday(st.created_at)) * 24 * 60 AS INTEGER)), 2) as avg_response_time,
        sp.response_time_minutes as target_response_time
      FROM sla_tracking st
      JOIN tickets t ON st.ticket_id = t.id
      JOIN priorities p ON t.priority_id = p.id
      JOIN sla_policies sp ON st.sla_policy_id = sp.id
      WHERE st.created_at >= ? AND st.created_at <= ?
      GROUP BY p.id, p.name, p.color, sp.response_time_minutes
      ORDER BY p.level DESC
    `;

    try {
      const rows = db.prepare(query).all(startDate.toISOString(), endDate.toISOString());
      return rows.map((row: any) => ({
        ...row,
        compliance_rate: row.total > 0 ? (row.met / row.total) * 100 : 0
      }));
    } catch (error) {
      logger.error('Error fetching SLA by priority', error);
      return [];
    }
  }
};

// ============================================================================
// Agent Data Sources
// ============================================================================

export const agentDataSources = {
  /**
   * Get agent performance metrics
   */
  getAgentPerformance: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 10
    } = options;

    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT t.id) as assigned_tickets,
        SUM(CASE WHEN t.status_id = (SELECT id FROM statuses WHERE name = 'resolved') THEN 1 ELSE 0 END) as resolved_tickets,
        ROUND(AVG(CASE
          WHEN t.status_id = (SELECT id FROM statuses WHERE name = 'resolved')
          THEN CAST((julianday(t.resolved_at) - julianday(t.created_at)) * 24 AS INTEGER)
          ELSE NULL
        END), 2) as avg_resolution_time,
        ROUND(AVG(CASE
          WHEN st.first_response_at IS NOT NULL
          THEN CAST((julianday(st.first_response_at) - julianday(st.created_at)) * 24 AS INTEGER)
          ELSE NULL
        END), 2) as avg_response_time,
        COUNT(DISTINCT CASE WHEN st.is_violated = 0 THEN st.id END) as sla_met,
        COUNT(DISTINCT st.id) as total_sla
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
        AND t.created_at >= ? AND t.created_at <= ?
      LEFT JOIN sla_tracking st ON st.ticket_id = t.id
      WHERE u.role IN ('admin', 'agent')
        AND u.is_active = 1
      GROUP BY u.id, u.name, u.email
      HAVING assigned_tickets > 0
      ORDER BY resolved_tickets DESC
      LIMIT ?
    `;

    try {
      const rows = db.prepare(query).all(
        startDate.toISOString(),
        endDate.toISOString(),
        limit
      );

      return rows.map((row: any) => ({
        ...row,
        resolution_rate: row.assigned_tickets > 0 ? (row.resolved_tickets / row.assigned_tickets) * 100 : 0,
        sla_compliance_rate: row.total_sla > 0 ? (row.sla_met / row.total_sla) * 100 : 0,
        efficiency_score: calculateEfficiencyScore(row),
        workload_status: getWorkloadStatus(row.assigned_tickets)
      }));
    } catch (error) {
      logger.error('Error fetching agent performance', error);
      return [];
    }
  },

  /**
   * Get agent workload distribution
   */
  getAgentWorkload: async () => {
    const query = `
      SELECT
        u.id,
        u.name,
        COUNT(t.id) as active_tickets,
        SUM(CASE WHEN p.level = 4 THEN 1 ELSE 0 END) as high_priority_tickets,
        SUM(CASE WHEN p.level = 3 THEN 1 ELSE 0 END) as medium_priority_tickets,
        SUM(CASE WHEN p.level <= 2 THEN 1 ELSE 0 END) as low_priority_tickets
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
        AND t.status_id IN (SELECT id FROM statuses WHERE name IN ('open', 'in_progress'))
      LEFT JOIN priorities p ON t.priority_id = p.id
      WHERE u.role IN ('admin', 'agent')
        AND u.is_active = 1
      GROUP BY u.id, u.name
      ORDER BY active_tickets DESC
    `;

    try {
      const rows = db.prepare(query).all();
      return rows.map((row: any) => ({
        ...row,
        workload_score: calculateWorkloadScore(row),
        status: getWorkloadStatus(row.active_tickets)
      }));
    } catch (error) {
      logger.error('Error fetching agent workload', error);
      return [];
    }
  }
};

// ============================================================================
// Customer Data Sources
// ============================================================================

export const customerDataSources = {
  /**
   * Get customer satisfaction metrics
   */
  getCustomerSatisfaction: async (_options: QueryOptions = {}) => {
    // Mock implementation - would integrate with actual CSAT survey data
    const mockData = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      score: 4.0 + Math.random() * 0.8,
      responses: Math.floor(Math.random() * 50) + 10
    }));

    return mockData;
  },

  /**
   * Get customer activity
   */
  getCustomerActivity: async (options: QueryOptions = {}) => {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 10
    } = options;

    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT t.id) as total_tickets,
        COUNT(DISTINCT CASE WHEN t.status_id = (SELECT id FROM statuses WHERE name = 'resolved') THEN t.id END) as resolved_tickets,
        COUNT(DISTINCT c.id) as total_comments,
        MAX(t.created_at) as last_ticket_date
      FROM users u
      LEFT JOIN tickets t ON t.user_id = u.id
        AND t.created_at >= ? AND t.created_at <= ?
      LEFT JOIN comments c ON c.user_id = u.id
        AND c.created_at >= ? AND c.created_at <= ?
      WHERE u.role = 'user'
      GROUP BY u.id, u.name, u.email
      HAVING total_tickets > 0
      ORDER BY total_tickets DESC
      LIMIT ?
    `;

    try {
      const rows = db.prepare(query).all(
        startDate.toISOString(),
        endDate.toISOString(),
        startDate.toISOString(),
        endDate.toISOString(),
        limit
      );
      return rows;
    } catch (error) {
      logger.error('Error fetching customer activity', error);
      return [];
    }
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateEfficiencyScore(agentData: any): number {
  const resolutionRate = agentData.assigned_tickets > 0
    ? (agentData.resolved_tickets / agentData.assigned_tickets) * 100
    : 0;

  const slaCompliance = agentData.total_sla > 0
    ? (agentData.sla_met / agentData.total_sla) * 100
    : 0;

  // Weighted score: 50% resolution rate, 50% SLA compliance
  return (resolutionRate * 0.5 + slaCompliance * 0.5);
}

function getWorkloadStatus(activeTickets: number): 'underutilized' | 'optimal' | 'overloaded' {
  if (activeTickets < 5) return 'underutilized';
  if (activeTickets > 20) return 'overloaded';
  return 'optimal';
}

function calculateWorkloadScore(workloadData: any): number {
  const { high_priority_tickets = 0, medium_priority_tickets = 0, low_priority_tickets = 0 } = workloadData;

  // Weighted score based on priority
  return (high_priority_tickets * 3) + (medium_priority_tickets * 2) + (low_priority_tickets * 1);
}

// ============================================================================
// Data Source Registry
// ============================================================================

export const dataSourceRegistry: Record<string, DataSource> = {
  'tickets.volume': {
    id: 'tickets.volume',
    name: 'Ticket Volume',
    type: 'sql',
    category: 'tickets',
    description: 'Get ticket volume over time',
    parameters: [
      { name: 'startDate', type: 'date', required: false, description: 'Start date for the query' },
      { name: 'endDate', type: 'date', required: false, description: 'End date for the query' },
      { name: 'groupBy', type: 'string', required: false, default: 'day', options: ['day', 'week', 'month'] }
    ]
  },
  'tickets.by_category': {
    id: 'tickets.by_category',
    name: 'Tickets by Category',
    type: 'sql',
    category: 'tickets',
    description: 'Get ticket distribution by category'
  },
  'tickets.by_priority': {
    id: 'tickets.by_priority',
    name: 'Tickets by Priority',
    type: 'sql',
    category: 'tickets',
    description: 'Get ticket distribution by priority'
  },
  'tickets.by_status': {
    id: 'tickets.by_status',
    name: 'Tickets by Status',
    type: 'sql',
    category: 'tickets',
    description: 'Get ticket distribution by status'
  },
  'sla.compliance': {
    id: 'sla.compliance',
    name: 'SLA Compliance',
    type: 'sql',
    category: 'sla',
    description: 'Get SLA compliance metrics over time'
  },
  'sla.by_priority': {
    id: 'sla.by_priority',
    name: 'SLA by Priority',
    type: 'sql',
    category: 'sla',
    description: 'Get SLA performance broken down by priority'
  },
  'agents.performance': {
    id: 'agents.performance',
    name: 'Agent Performance',
    type: 'sql',
    category: 'agents',
    description: 'Get agent performance metrics',
    requiredPermissions: ['admin', 'manager']
  },
  'agents.workload': {
    id: 'agents.workload',
    name: 'Agent Workload',
    type: 'sql',
    category: 'agents',
    description: 'Get current agent workload distribution',
    requiredPermissions: ['admin', 'manager']
  },
  'customers.satisfaction': {
    id: 'customers.satisfaction',
    name: 'Customer Satisfaction',
    type: 'computed',
    category: 'customers',
    description: 'Get customer satisfaction metrics'
  },
  'customers.activity': {
    id: 'customers.activity',
    name: 'Customer Activity',
    type: 'sql',
    category: 'customers',
    description: 'Get customer activity metrics'
  }
};

/**
 * Execute a data source query
 */
export async function executeDataSource(
  dataSourceId: string,
  options: QueryOptions = {}
): Promise<any[]> {
  const dataSource = dataSourceRegistry[dataSourceId];

  if (!dataSource) {
    throw new Error(`Data source not found: ${dataSourceId}`);
  }

  try {
    switch (dataSourceId) {
      case 'tickets.volume':
        return await ticketDataSources.getTicketVolume(options);
      case 'tickets.by_category':
        return await ticketDataSources.getTicketsByCategory(options);
      case 'tickets.by_priority':
        return await ticketDataSources.getTicketsByPriority(options);
      case 'tickets.by_status':
        return await ticketDataSources.getTicketsByStatus(options);
      case 'sla.compliance':
        return await slaDataSources.getSLACompliance(options);
      case 'sla.by_priority':
        return await slaDataSources.getSLAByPriority(options);
      case 'agents.performance':
        return await agentDataSources.getAgentPerformance(options);
      case 'agents.workload':
        return await agentDataSources.getAgentWorkload();
      case 'customers.satisfaction':
        return await customerDataSources.getCustomerSatisfaction(options);
      case 'customers.activity':
        return await customerDataSources.getCustomerActivity(options);
      default:
        throw new Error(`Data source not implemented: ${dataSourceId}`);
    }
  } catch (error) {
    logger.error(`Error executing data source ${dataSourceId}`, error);
    throw error;
  }
}
