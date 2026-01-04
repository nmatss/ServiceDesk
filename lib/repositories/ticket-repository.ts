/**
 * Ticket Repository Implementation
 *
 * Concrete implementation of ITicketRepository using SQLite.
 * Handles all ticket-related database operations with organization isolation.
 *
 * @module lib/repositories/ticket-repository
 */

import db from '@/lib/db/connection';
import type {
  ITicketRepository,
  TicketFilters,
  TicketMetrics,
} from '@/lib/interfaces/repositories';
import type { Ticket, TicketWithDetails } from '@/lib/types/database';

export class TicketRepository implements ITicketRepository {
  /**
   * Find ticket by ID
   */
  async findById(id: number): Promise<Ticket | null> {
    const ticket = db.prepare(`
      SELECT * FROM tickets
      WHERE id = ? AND deleted_at IS NULL
    `).get(id) as Ticket | undefined;

    return ticket || null;
  }

  /**
   * Find all tickets with optional filters
   */
  async findAll(filters?: TicketFilters): Promise<Ticket[]> {
    const {
      status_id,
      priority_id,
      category_id,
      user_id,
      assigned_to,
      organization_id,
      sla_status,
      search,
      created_after,
      created_before,
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'DESC',
    } = filters || {};

    const where: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];

    if (status_id !== undefined) {
      where.push('status_id = ?');
      params.push(status_id);
    }

    if (priority_id !== undefined) {
      where.push('priority_id = ?');
      params.push(priority_id);
    }

    if (category_id !== undefined) {
      where.push('category_id = ?');
      params.push(category_id);
    }

    if (user_id !== undefined) {
      where.push('user_id = ?');
      params.push(user_id);
    }

    if (assigned_to !== undefined) {
      where.push('assigned_to = ?');
      params.push(assigned_to);
    }

    if (organization_id !== undefined) {
      where.push('organization_id = ?');
      params.push(organization_id);
    }

    if (sla_status) {
      where.push('sla_status = ?');
      params.push(sla_status);
    }

    if (search) {
      where.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (created_after) {
      where.push('created_at >= ?');
      params.push(created_after);
    }

    if (created_before) {
      where.push('created_at <= ?');
      params.push(created_before);
    }

    params.push(limit, offset);

    const sql = `
      SELECT * FROM tickets
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    return db.prepare(sql).all(...params) as Ticket[];
  }

  /**
   * Find ticket with full details (joined with related entities)
   */
  async findWithDetails(id: number): Promise<TicketWithDetails | null> {
    const row = db.prepare(`
      SELECT
        t.*,
        u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role,
        a.id as assigned_agent_id, a.name as assigned_agent_name, a.email as assigned_agent_email,
        c.id as category_id, c.name as category_name, c.color as category_color,
        p.id as priority_id, p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.id as status_id, s.name as status_name, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      INNER JOIN categories c ON t.category_id = c.id
      INNER JOIN priorities p ON t.priority_id = p.id
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE t.id = ? AND t.deleted_at IS NULL
    `).get(id) as any;

    if (!row) return null;

    return this.mapToTicketWithDetails(row);
  }

  /**
   * Find all tickets with details
   */
  async findAllWithDetails(filters?: TicketFilters): Promise<TicketWithDetails[]> {
    const {
      status_id,
      priority_id,
      category_id,
      user_id,
      assigned_to,
      organization_id,
      limit = 50,
      offset = 0,
      orderBy = 't.created_at',
      orderDirection = 'DESC',
    } = filters || {};

    const where: string[] = ['t.deleted_at IS NULL'];
    const params: any[] = [];

    if (status_id !== undefined) {
      where.push('t.status_id = ?');
      params.push(status_id);
    }

    if (priority_id !== undefined) {
      where.push('t.priority_id = ?');
      params.push(priority_id);
    }

    if (category_id !== undefined) {
      where.push('t.category_id = ?');
      params.push(category_id);
    }

    if (user_id !== undefined) {
      where.push('t.user_id = ?');
      params.push(user_id);
    }

    if (assigned_to !== undefined) {
      where.push('t.assigned_to = ?');
      params.push(assigned_to);
    }

    if (organization_id !== undefined) {
      where.push('t.organization_id = ?');
      params.push(organization_id);
    }

    params.push(limit, offset);

    const sql = `
      SELECT
        t.*,
        u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role,
        a.id as assigned_agent_id, a.name as assigned_agent_name, a.email as assigned_agent_email,
        c.id as category_id, c.name as category_name, c.color as category_color,
        p.id as priority_id, p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.id as status_id, s.name as status_name, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      INNER JOIN categories c ON t.category_id = c.id
      INNER JOIN priorities p ON t.priority_id = p.id
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapToTicketWithDetails(row));
  }

  /**
   * Create a new ticket
   */
  async create(data: Partial<Ticket>): Promise<Ticket> {
    const result = db.prepare(`
      INSERT INTO tickets (
        title, description, user_id, assigned_to, category_id,
        priority_id, status_id, organization_id, sla_policy_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.title,
      data.description,
      data.user_id,
      data.assigned_to || null,
      data.category_id,
      data.priority_id,
      data.status_id,
      data.organization_id,
      data.sla_policy_id || null
    );

    const ticket = await this.findById(result.lastInsertRowid as number);
    if (!ticket) {
      throw new Error('Failed to create ticket');
    }

    return ticket;
  }

  /**
   * Update an existing ticket
   */
  async update(id: number, data: Partial<Ticket>): Promise<Ticket> {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      sets.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      sets.push('description = ?');
      values.push(data.description);
    }
    if (data.status_id !== undefined) {
      sets.push('status_id = ?');
      values.push(data.status_id);
    }
    if (data.priority_id !== undefined) {
      sets.push('priority_id = ?');
      values.push(data.priority_id);
    }
    if (data.category_id !== undefined) {
      sets.push('category_id = ?');
      values.push(data.category_id);
    }
    if (data.assigned_to !== undefined) {
      sets.push('assigned_to = ?');
      values.push(data.assigned_to);
    }
    if (data.sla_status !== undefined) {
      sets.push('sla_status = ?');
      values.push(data.sla_status);
    }
    if (data.resolved_at !== undefined) {
      sets.push('resolved_at = ?');
      values.push(data.resolved_at);
    }

    if (sets.length === 0) {
      const ticket = await this.findById(id);
      if (!ticket) throw new Error('Ticket not found');
      return ticket;
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE tickets
      SET ${sets.join(', ')}
      WHERE id = ?
    `).run(...values);

    const ticket = await this.findById(id);
    if (!ticket) {
      throw new Error('Ticket not found after update');
    }

    return ticket;
  }

  /**
   * Hard delete (not recommended, use softDelete instead)
   */
  async delete(id: number): Promise<void> {
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  }

  /**
   * Soft delete a ticket
   */
  async softDelete(id: number): Promise<void> {
    db.prepare(`
      UPDATE tickets
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
  }

  /**
   * Restore a soft-deleted ticket
   */
  async restore(id: number): Promise<void> {
    db.prepare(`
      UPDATE tickets
      SET deleted_at = NULL
      WHERE id = ?
    `).run(id);
  }

  /**
   * Count tickets with optional filters
   */
  async count(filters?: TicketFilters): Promise<number> {
    const { organization_id, status_id, assigned_to } = filters || {};

    const where: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];

    if (organization_id !== undefined) {
      where.push('organization_id = ?');
      params.push(organization_id);
    }

    if (status_id !== undefined) {
      where.push('status_id = ?');
      params.push(status_id);
    }

    if (assigned_to !== undefined) {
      where.push('assigned_to = ?');
      params.push(assigned_to);
    }

    const result = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE ${where.join(' AND ')}
    `).get(...params) as { count: number };

    return result.count;
  }

  /**
   * Find tickets by status
   */
  async findByStatus(statusId: number, organizationId: number): Promise<Ticket[]> {
    return this.findAll({ status_id: statusId, organization_id: organizationId });
  }

  /**
   * Find tickets by user
   */
  async findByUser(userId: number): Promise<Ticket[]> {
    return this.findAll({ user_id: userId });
  }

  /**
   * Find tickets by assignee
   */
  async findByAssignee(assigneeId: number): Promise<Ticket[]> {
    return this.findAll({ assigned_to: assigneeId });
  }

  /**
   * Count tickets by status
   */
  async countByStatus(organizationId: number): Promise<Record<string, number>> {
    const rows = db.prepare(`
      SELECT s.name as status, COUNT(*) as count
      FROM tickets t
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE t.organization_id = ? AND t.deleted_at IS NULL
      GROUP BY s.name
    `).all(organizationId) as { status: string; count: number }[];

    return rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Count tickets by priority
   */
  async countByPriority(organizationId: number): Promise<Record<string, number>> {
    const rows = db.prepare(`
      SELECT p.name as priority, COUNT(*) as count
      FROM tickets t
      INNER JOIN priorities p ON t.priority_id = p.id
      WHERE t.organization_id = ? AND t.deleted_at IS NULL
      GROUP BY p.name
    `).all(organizationId) as { priority: string; count: number }[];

    return rows.reduce((acc, row) => {
      acc[row.priority] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get ticket metrics for dashboard
   */
  async getMetrics(
    organizationId: number,
    dateRange?: { start: string; end: string }
  ): Promise<TicketMetrics> {
    const where = ['t.organization_id = ?', 't.deleted_at IS NULL'];
    const params: any[] = [organizationId];

    if (dateRange) {
      where.push('t.created_at >= ?');
      where.push('t.created_at <= ?');
      params.push(dateRange.start, dateRange.end);
    }

    const result = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN s.name = 'Open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN s.name = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN s.name = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN s.name = 'Closed' THEN 1 ELSE 0 END) as closed,
        AVG(
          CASE
            WHEN t.resolved_at IS NOT NULL
            THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24
            ELSE NULL
          END
        ) as avg_resolution_time_hours,
        SUM(CASE WHEN t.sla_status = 'on_track' OR t.sla_status IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as sla_compliance_rate
      FROM tickets t
      INNER JOIN statuses s ON t.status_id = s.id
      WHERE ${where.join(' AND ')}
    `).get(...params) as any;

    const byPriority = await this.countByPriority(organizationId);
    const byCategory = db.prepare(`
      SELECT c.name as category, COUNT(*) as count
      FROM tickets t
      INNER JOIN categories c ON t.category_id = c.id
      WHERE t.organization_id = ? AND t.deleted_at IS NULL
      GROUP BY c.name
    `).all(organizationId) as { category: string; count: number }[];

    const byCategoryMap = byCategory.reduce((acc, row) => {
      acc[row.category] = row.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: result.total || 0,
      open: result.open || 0,
      in_progress: result.in_progress || 0,
      resolved: result.resolved || 0,
      closed: result.closed || 0,
      by_priority: byPriority,
      by_category: byCategoryMap,
      avg_resolution_time_hours: result.avg_resolution_time_hours || 0,
      sla_compliance_rate: result.sla_compliance_rate || 100,
    };
  }

  /**
   * Find SLA breached tickets
   */
  async findSLABreached(organizationId: number): Promise<Ticket[]> {
    return this.findAll({
      organization_id: organizationId,
      sla_status: 'breached',
    });
  }

  /**
   * Find SLA at-risk tickets
   */
  async findSLAAtRisk(organizationId: number): Promise<Ticket[]> {
    return this.findAll({
      organization_id: organizationId,
      sla_status: 'at_risk',
    });
  }

  /**
   * Find unassigned tickets
   */
  async findUnassigned(organizationId: number): Promise<Ticket[]> {
    return db.prepare(`
      SELECT * FROM tickets
      WHERE organization_id = ?
        AND assigned_to IS NULL
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).all(organizationId) as Ticket[];
  }

  /**
   * Bulk assign tickets to an agent
   */
  async bulkAssign(ticketIds: number[], assigneeId: number): Promise<void> {
    const placeholders = ticketIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE tickets
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(assigneeId, ...ticketIds);
  }

  /**
   * Map database row to TicketWithDetails
   */
  private mapToTicketWithDetails(row: any): TicketWithDetails {
    return {
      // Ticket fields
      id: row.id,
      title: row.title,
      description: row.description,
      user_id: row.user_id,
      assigned_to: row.assigned_to,
      category_id: row.category_id,
      priority_id: row.priority_id,
      status_id: row.status_id,
      organization_id: row.organization_id,
      sla_policy_id: row.sla_policy_id,
      sla_deadline: row.sla_deadline,
      sla_status: row.sla_status,
      sla_first_response_at: row.sla_first_response_at,
      sla_resolution_at: row.sla_resolution_at,
      escalation_level: row.escalation_level,
      escalated_at: row.escalated_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,

      // Related entities
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        role: row.user_role,
      } as any,

      assigned_agent: row.assigned_agent_id
        ? {
            id: row.assigned_agent_id,
            name: row.assigned_agent_name,
            email: row.assigned_agent_email,
          }
        : undefined,

      category: {
        id: row.category_id,
        name: row.category_name,
        color: row.category_color,
      } as any,

      priority: {
        id: row.priority_id,
        name: row.priority_name,
        level: row.priority_level,
        color: row.priority_color,
      } as any,

      status: {
        id: row.status_id,
        name: row.status_name,
        color: row.status_color,
        is_final: !!row.status_is_final,
      } as any,

      comments_count: row.comments_count || 0,
      attachments_count: row.attachments_count || 0,
    } as TicketWithDetails;
  }
}
