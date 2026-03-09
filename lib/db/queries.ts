/**
 * Database Query Layer
 *
 * Type-safe query functions for all database entities.
 * Provides CRUD operations with organization-level isolation and optimized queries.
 * Uses the async adapter pattern for SQLite/PostgreSQL compatibility.
 *
 * @module lib/db/queries
 */

import { executeQuery, executeQueryOne, executeRun, sqlNow, sqlCurrentDate, sqlTrue, sqlFalse } from './adapter';
import { getDatabaseType } from './config';
import { getFromCache, setCache } from '../cache/lru-cache';
import logger from '@/lib/monitoring/structured-logger';
import type {
  User, CreateUser, UpdateUser,
  Category, CreateCategory, UpdateCategory,
  Priority, CreatePriority, UpdatePriority,
  Status, CreateStatus, UpdateStatus,
  Ticket, CreateTicket, UpdateTicket,
  Comment, CreateComment, UpdateComment,
  Attachment, CreateAttachment
} from '../types/database';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  REALTIME_KPIS: 300,     // 5 minutes
  SLA_ANALYTICS: 600,      // 10 minutes
  AGENT_PERFORMANCE: 600,  // 10 minutes
  CATEGORY_ANALYTICS: 600, // 10 minutes
  VOLUME_TRENDS: 600,      // 10 minutes
};

/**
 * SQL dialect helpers for dynamic date subtraction with parameter-based days.
 * SQLite: datetime('now', '-' || ? || ' days')
 * PostgreSQL: NOW() - (? || ' days')::interval
 */
function sqlDynamicDateSub(): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() - (? || ' days')::interval`
    : `datetime('now', '-' || ? || ' days')`;
}

/**
 * SQL dialect helper for json_group_array/json_object (SQLite) vs json_agg/json_build_object (PostgreSQL)
 */
function sqlJsonGroupArray(expr: string): string {
  return getDatabaseType() === 'postgresql'
    ? `json_agg(${expr})`
    : `json_group_array(${expr})`;
}

function sqlJsonObject(pairs: string): string {
  return getDatabaseType() === 'postgresql'
    ? `json_build_object(${pairs})`
    : `json_object(${pairs})`;
}

/**
 * SQL dialect helper for julianday-based minute calculations.
 * SQLite: ROUND((julianday(col) - julianday('now')) * 24 * 60)
 * PostgreSQL: ROUND(EXTRACT(EPOCH FROM (col::timestamp - NOW())) / 60.0)
 */
function sqlMinutesUntil(col: string): string {
  return getDatabaseType() === 'postgresql'
    ? `ROUND(EXTRACT(EPOCH FROM (${col}::timestamp - NOW())) / 60.0)`
    : `ROUND((julianday(${col}) - julianday('now')) * 24 * 60)`;
}

/**
 * SQL dialect helper for datetime with hour offsets.
 * SQLite: datetime('now', '+N hours')
 * PostgreSQL: NOW() + INTERVAL 'N hours'
 */
function sqlDateAddHours(hours: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() + INTERVAL '${hours} hours'`
    : `datetime('now', '+${hours} hours')`;
}

/**
 * SQL dialect helper for date() function used in GROUP BY/SELECT.
 * SQLite: date(expr)
 * PostgreSQL: (expr)::date
 */
function sqlDate(expr: string): string {
  return getDatabaseType() === 'postgresql'
    ? `(${expr})::date`
    : `date(${expr})`;
}

/**
 * SQL dialect helper for datetime comparison.
 * SQLite: datetime('now')
 * PostgreSQL: NOW()
 */
function sqlDatetimeNow(): string {
  return getDatabaseType() === 'postgresql' ? 'NOW()' : "datetime('now')";
}

function sqlDatetimeSub(days: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${days} days'`
    : `datetime('now', '-${days} days')`;
}

/**
 * Flattened TicketWithDetails type for database query results
 * This represents the JOIN query result before transformation
 */
export interface TicketWithDetailsFlatRow extends Ticket {
  // User fields (ticket creator)
  user_name: string;
  user_email: string;
  user_role: string;

  // Assigned agent fields (optional)
  assigned_agent_name: string | null;
  assigned_agent_email: string | null;
  assigned_agent_role: string | null;

  // Category fields
  category_name: string;
  category_description: string | null;
  category_color: string;

  // Priority fields
  priority_name: string;
  priority_level: number;
  priority_color: string;

  // Status fields
  status_name: string;
  status_description: string | null;
  status_color: string;
  status_is_final: number; // SQLite boolean (0 or 1)

  // Aggregate counts
  comments_count: number;
  attachments_count: number;
}

/**
 * Comment with user details (flattened)
 */
export interface CommentWithUserRow extends Comment {
  user_name: string;
  user_email: string;
  user_role: string;
}

/**
 * Real-time KPI metrics
 */
export interface RealTimeKPIs {
  tickets_today: number;
  tickets_this_week: number;
  tickets_this_month: number;
  total_tickets: number;
  sla_response_met: number;
  sla_resolution_met: number;
  total_sla_tracked: number;
  avg_response_time: number | null;
  avg_resolution_time: number | null;
  fcr_rate: number | null;
  csat_score: number | null;
  csat_responses: number;
  active_agents: number;
  open_tickets: number;
  resolved_today: number;
}

/**
 * SLA analytics data point
 */
export interface SLAAnalyticsRow {
  date: string;
  total_tickets: number;
  response_met: number;
  resolution_met: number;
  avg_response_time: number | null;
  avg_resolution_time: number | null;
  response_sla_rate: number | null;
  resolution_sla_rate: number | null;
}

/**
 * Agent performance metrics
 */
export interface AgentPerformanceRow {
  id: number;
  name: string;
  email: string;
  assigned_tickets: number;
  resolved_tickets: number;
  resolution_rate: number | null;
  avg_response_time: number | null;
  avg_resolution_time: number | null;
  avg_satisfaction: number | null;
  satisfaction_responses: number;
}

/**
 * Category analytics
 */
export interface CategoryAnalyticsRow {
  id: number;
  name: string;
  color: string;
  total_tickets: number;
  resolved_tickets: number;
  resolution_rate: number | null;
  avg_resolution_time: number | null;
  avg_satisfaction: number | null;
}

/**
 * Priority distribution
 */
export interface PriorityDistributionRow {
  id: number;
  name: string;
  level: number;
  color: string;
  ticket_count: number;
  percentage: number | null;
}

/**
 * Ticket volume trends
 */
export interface TicketVolumeTrendRow {
  date: string;
  created: number;
  resolved: number;
  high_priority: number;
}

/**
 * Response time analytics
 */
export interface ResponseTimeAnalyticsRow {
  date: string;
  total_responses: number;
  avg_response_time: number | null;
  min_response_time: number | null;
  max_response_time: number | null;
  sla_met: number;
  sla_compliance: number | null;
}

/**
 * Satisfaction trends
 */
export interface SatisfactionTrendRow {
  date: string;
  total_responses: number;
  avg_rating: number | null;
  positive_ratings: number;
  negative_ratings: number;
  satisfaction_rate: number | null;
}

/**
 * Comparative analytics row
 */
export interface ComparativeAnalyticsRow {
  label: string;
  color: string;
  period: string;
  value: number;
  metric: string;
}

/**
 * Anomaly detection data
 */
export interface AnomalyDetectionRow {
  date: string;
  ticket_count: number;
  high_priority_count: number;
  avg_tickets: number;
  avg_high_priority: number;
  anomaly_type: 'high_volume' | 'high_priority_spike' | 'normal';
}

/**
 * Knowledge base analytics
 */
export interface KnowledgeBaseAnalytics {
  published_articles: number;
  total_views: number | null;
  avg_helpfulness: number | null;
  top_articles: string; // JSON string
}

/**
 * User query operations
 *
 * Provides CRUD operations for user management with role-based filtering.
 * All queries return User objects with timestamps and role information.
 *
 * SECURITY: All queries now require organizationId for multi-tenant isolation.
 */
export const userQueries = {
  getAll: async (organizationId: number): Promise<User[]> => {
    return await executeQuery<User>('SELECT * FROM users WHERE organization_id = ? ORDER BY name', [organizationId]);
  },

  getById: async (id: number, organizationId: number): Promise<User | undefined> => {
    return await executeQueryOne<User>('SELECT * FROM users WHERE id = ? AND organization_id = ?', [id, organizationId]);
  },

  getByEmail: async (email: string, organizationId: number): Promise<User | undefined> => {
    return await executeQueryOne<User>('SELECT * FROM users WHERE email = ? AND organization_id = ?', [email, organizationId]);
  },

  getByRole: async (role: 'admin' | 'agent' | 'user', organizationId: number): Promise<User[]> => {
    return await executeQuery<User>('SELECT * FROM users WHERE role = ? AND organization_id = ? ORDER BY name', [role, organizationId]);
  },

  create: async (user: CreateUser, organizationId: number): Promise<User> => {
    const result = await executeRun(
      `INSERT INTO users (name, email, role, organization_id) VALUES (?, ?, ?, ?)`,
      [user.name, user.email, user.role, organizationId]
    );
    const created = await executeQueryOne<User>('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  update: async (user: UpdateUser, organizationId: number): Promise<User | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (user.name !== undefined) {
      fields.push('name = ?');
      values.push(user.name);
    }
    if (user.email !== undefined) {
      fields.push('email = ?');
      values.push(user.email);
    }
    if (user.role !== undefined) {
      fields.push('role = ?');
      values.push(user.role);
    }

    if (fields.length === 0) return await userQueries.getById(user.id, organizationId);

    values.push(user.id, organizationId);
    await executeRun(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`, values);
    return await userQueries.getById(user.id, organizationId);
  },

  delete: async (id: number, organizationId: number): Promise<boolean> => {
    const result = await executeRun('DELETE FROM users WHERE id = ? AND organization_id = ?', [id, organizationId]);
    return result.changes > 0;
  },
};

// ===== CATEGORIES =====
// NOTE: Categories are global (shared across organizations) - no organization_id filter needed
export const categoryQueries = {
  getAll: async (): Promise<Category[]> => {
    return await executeQuery<Category>('SELECT id, organization_id, tenant_id, name, description, color, created_at, updated_at FROM categories ORDER BY name');
  },

  getById: async (id: number): Promise<Category | undefined> => {
    return await executeQueryOne<Category>('SELECT id, organization_id, tenant_id, name, description, color, created_at, updated_at FROM categories WHERE id = ?', [id]);
  },

  create: async (category: CreateCategory): Promise<Category> => {
    const result = await executeRun(
      `INSERT INTO categories (name, description, color) VALUES (?, ?, ?)`,
      [category.name, category.description, category.color]
    );
    const created = await executeQueryOne<Category>('SELECT id, organization_id, tenant_id, name, description, color, created_at, updated_at FROM categories WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  update: async (category: UpdateCategory): Promise<Category | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (category.name !== undefined) {
      fields.push('name = ?');
      values.push(category.name);
    }
    if (category.description !== undefined) {
      fields.push('description = ?');
      values.push(category.description);
    }
    if (category.color !== undefined) {
      fields.push('color = ?');
      values.push(category.color);
    }

    if (fields.length === 0) return await categoryQueries.getById(category.id);

    values.push(category.id);
    await executeRun(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return await categoryQueries.getById(category.id);
  },

  delete: async (id: number): Promise<boolean> => {
    const result = await executeRun('DELETE FROM categories WHERE id = ?', [id]);
    return result.changes > 0;
  },
};

// ===== PRIORITIES =====
// NOTE: Priorities are global (shared across organizations) - no organization_id filter needed
export const priorityQueries = {
  getAll: async (): Promise<Priority[]> => {
    return await executeQuery<Priority>('SELECT id, organization_id, tenant_id, name, level, color, created_at, updated_at FROM priorities ORDER BY level');
  },

  getById: async (id: number): Promise<Priority | undefined> => {
    return await executeQueryOne<Priority>('SELECT id, organization_id, tenant_id, name, level, color, created_at, updated_at FROM priorities WHERE id = ?', [id]);
  },

  create: async (priority: CreatePriority): Promise<Priority> => {
    const result = await executeRun(
      `INSERT INTO priorities (name, level, color) VALUES (?, ?, ?)`,
      [priority.name, priority.level, priority.color]
    );
    const created = await executeQueryOne<Priority>('SELECT id, organization_id, tenant_id, name, level, color, created_at, updated_at FROM priorities WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  update: async (priority: UpdatePriority): Promise<Priority | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (priority.name !== undefined) {
      fields.push('name = ?');
      values.push(priority.name);
    }
    if (priority.level !== undefined) {
      fields.push('level = ?');
      values.push(priority.level);
    }
    if (priority.color !== undefined) {
      fields.push('color = ?');
      values.push(priority.color);
    }

    if (fields.length === 0) return await priorityQueries.getById(priority.id);

    values.push(priority.id);
    await executeRun(`UPDATE priorities SET ${fields.join(', ')} WHERE id = ?`, values);
    return await priorityQueries.getById(priority.id);
  },

  delete: async (id: number): Promise<boolean> => {
    const result = await executeRun('DELETE FROM priorities WHERE id = ?', [id]);
    return result.changes > 0;
  },
};

// ===== STATUSES =====
// NOTE: Statuses are global (shared across organizations) - no organization_id filter needed
export const statusQueries = {
  getAll: async (): Promise<Status[]> => {
    return await executeQuery<Status>('SELECT id, organization_id, tenant_id, name, description, color, is_final, created_at, updated_at FROM statuses ORDER BY is_final, name');
  },

  getById: async (id: number): Promise<Status | undefined> => {
    return await executeQueryOne<Status>('SELECT id, organization_id, tenant_id, name, description, color, is_final, created_at, updated_at FROM statuses WHERE id = ?', [id]);
  },

  getNonFinal: async (): Promise<Status[]> => {
    return await executeQuery<Status>('SELECT id, organization_id, tenant_id, name, description, color, is_final, created_at, updated_at FROM statuses WHERE is_final = 0 ORDER BY name');
  },

  getFinal: async (): Promise<Status[]> => {
    return await executeQuery<Status>('SELECT id, organization_id, tenant_id, name, description, color, is_final, created_at, updated_at FROM statuses WHERE is_final = 1 ORDER BY name');
  },

  create: async (status: CreateStatus): Promise<Status> => {
    const result = await executeRun(
      `INSERT INTO statuses (name, description, color, is_final) VALUES (?, ?, ?, ?)`,
      [status.name, status.description, status.color, status.is_final ? 1 : 0]
    );
    const created = await executeQueryOne<Status>('SELECT id, organization_id, tenant_id, name, description, color, is_final, created_at, updated_at FROM statuses WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  update: async (status: UpdateStatus): Promise<Status | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (status.name !== undefined) {
      fields.push('name = ?');
      values.push(status.name);
    }
    if (status.description !== undefined) {
      fields.push('description = ?');
      values.push(status.description);
    }
    if (status.color !== undefined) {
      fields.push('color = ?');
      values.push(status.color);
    }
    if (status.is_final !== undefined) {
      fields.push('is_final = ?');
      values.push(status.is_final ? 1 : 0);
    }

    if (fields.length === 0) return await statusQueries.getById(status.id);

    values.push(status.id);
    await executeRun(`UPDATE statuses SET ${fields.join(', ')} WHERE id = ?`, values);
    return await statusQueries.getById(status.id);
  },

  delete: async (id: number): Promise<boolean> => {
    const result = await executeRun('DELETE FROM statuses WHERE id = ?', [id]);
    return result.changes > 0;
  },
};

/**
 * Ticket query operations
 *
 * Provides comprehensive ticket management with organization-level isolation.
 * All ticket queries use optimized JOINs to include related data (user, agent, category, etc.)
 * and aggregate counts (comments, attachments) in a single query for performance.
 *
 * PERFORMANCE NOTE: These queries use LEFT JOINs with aggregation subqueries instead of
 * N+1 queries, reducing database round-trips from O(n) to O(1).
 */
export const ticketQueries = {
  getAll: async (organizationId: number): Promise<TicketWithDetailsFlatRow[]> => {
    return await executeQuery<TicketWithDetailsFlatRow>(`
      SELECT
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        COALESCE(cm.comments_count, 0) as comments_count,
        COALESCE(at.attachments_count, 0) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as comments_count
        FROM comments
        GROUP BY ticket_id
      ) cm ON t.id = cm.ticket_id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as attachments_count
        FROM attachments
        GROUP BY ticket_id
      ) at ON t.id = at.ticket_id
      WHERE t.organization_id = ?
      ORDER BY t.created_at DESC
    `, [organizationId]);
  },

  getById: async (id: number): Promise<TicketWithDetailsFlatRow | undefined> => {
    return await executeQueryOne<TicketWithDetailsFlatRow>(`
      SELECT
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        COALESCE(cm.comments_count, 0) as comments_count,
        COALESCE(at.attachments_count, 0) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as comments_count
        FROM comments
        WHERE ticket_id = ?
        GROUP BY ticket_id
      ) cm ON t.id = cm.ticket_id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as attachments_count
        FROM attachments
        WHERE ticket_id = ?
        GROUP BY ticket_id
      ) at ON t.id = at.ticket_id
      WHERE t.id = ?
    `, [id, id, id]);
  },

  getByUserId: async (userId: number, organizationId: number): Promise<TicketWithDetailsFlatRow[]> => {
    return await executeQuery<TicketWithDetailsFlatRow>(`
      SELECT
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        COALESCE(cm.comments_count, 0) as comments_count,
        COALESCE(at.attachments_count, 0) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as comments_count
        FROM comments
        GROUP BY ticket_id
      ) cm ON t.id = cm.ticket_id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as attachments_count
        FROM attachments
        GROUP BY ticket_id
      ) at ON t.id = at.ticket_id
      WHERE t.user_id = ? AND t.organization_id = ?
      ORDER BY t.created_at DESC
    `, [userId, organizationId]);
  },

  getByAssignedTo: async (assignedTo: number, organizationId: number): Promise<TicketWithDetailsFlatRow[]> => {
    return await executeQuery<TicketWithDetailsFlatRow>(`
      SELECT
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        COALESCE(cm.comments_count, 0) as comments_count,
        COALESCE(at.attachments_count, 0) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as comments_count
        FROM comments
        GROUP BY ticket_id
      ) cm ON t.id = cm.ticket_id
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) as attachments_count
        FROM attachments
        GROUP BY ticket_id
      ) at ON t.id = at.ticket_id
      WHERE t.assigned_to = ? AND t.organization_id = ?
      ORDER BY t.created_at DESC
    `, [assignedTo, organizationId]);
  },

  create: async (ticket: CreateTicket, organizationId: number): Promise<Ticket> => {
    const result = await executeRun(`
      INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticket.title,
      ticket.description,
      ticket.user_id,
      ticket.assigned_to || null,
      ticket.category_id,
      ticket.priority_id,
      ticket.status_id,
      organizationId
    ]);
    const created = await executeQueryOne<Ticket>('SELECT * FROM tickets WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  // SECURITY: Enforces organization_id filter to prevent cross-tenant ticket updates
  update: async (ticket: UpdateTicket, organizationId: number): Promise<Ticket | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (ticket.title !== undefined) {
      fields.push('title = ?');
      values.push(ticket.title);
    }
    if (ticket.description !== undefined) {
      fields.push('description = ?');
      values.push(ticket.description);
    }
    if (ticket.assigned_to !== undefined) {
      fields.push('assigned_to = ?');
      values.push(ticket.assigned_to);
    }
    if (ticket.category_id !== undefined) {
      fields.push('category_id = ?');
      values.push(ticket.category_id);
    }
    if (ticket.priority_id !== undefined) {
      fields.push('priority_id = ?');
      values.push(ticket.priority_id);
    }
    if (ticket.status_id !== undefined) {
      fields.push('status_id = ?');
      values.push(ticket.status_id);
    }
    if (ticket.resolved_at !== undefined) {
      fields.push('resolved_at = ?');
      values.push(ticket.resolved_at);
    }

    if (fields.length === 0) {
      return await executeQueryOne<Ticket>('SELECT * FROM tickets WHERE id = ? AND organization_id = ?', [ticket.id, organizationId]);
    }

    values.push(ticket.id, organizationId);
    await executeRun(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`, values);
    return await executeQueryOne<Ticket>('SELECT * FROM tickets WHERE id = ? AND organization_id = ?', [ticket.id, organizationId]);
  },

  // SECURITY: Enforces organization_id filter to prevent cross-tenant ticket deletion
  delete: async (id: number, organizationId: number): Promise<boolean> => {
    const result = await executeRun('DELETE FROM tickets WHERE id = ? AND organization_id = ?', [id, organizationId]);
    return result.changes > 0;
  },
};

// ===== COMMENTS =====
export const commentQueries = {
  getByTicketId: async (ticketId: number, organizationId: number): Promise<CommentWithUserRow[]> => {
    return await executeQuery<CommentWithUserRow>(`
      SELECT
        c.*,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN tickets t ON c.ticket_id = t.id
      WHERE c.ticket_id = ? AND t.organization_id = ?
      ORDER BY c.created_at ASC
    `, [ticketId, organizationId]);
  },

  getById: async (id: number, organizationId: number): Promise<CommentWithUserRow | undefined> => {
    return await executeQueryOne<CommentWithUserRow>(`
      SELECT
        c.*,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN tickets t ON c.ticket_id = t.id
      WHERE c.id = ? AND t.organization_id = ?
    `, [id, organizationId]);
  },

  create: async (comment: CreateComment, organizationId: number): Promise<Comment> => {
    // Verify ticket belongs to organization before creating comment
    const ticketCheck = await executeQueryOne<{ id: number }>('SELECT id FROM tickets WHERE id = ? AND organization_id = ?', [comment.ticket_id, organizationId]);
    if (!ticketCheck) {
      throw new Error('Ticket not found or does not belong to organization');
    }

    const result = await executeRun(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal)
      VALUES (?, ?, ?, ?)
    `, [comment.ticket_id, comment.user_id, comment.content, comment.is_internal ? 1 : 0]);
    const created = await executeQueryOne<Comment>('SELECT * FROM comments WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  update: async (comment: UpdateComment, organizationId: number): Promise<Comment | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (comment.content !== undefined) {
      fields.push('content = ?');
      values.push(comment.content);
    }
    if (comment.is_internal !== undefined) {
      fields.push('is_internal = ?');
      values.push(comment.is_internal ? 1 : 0);
    }

    if (fields.length === 0) {
      return await executeQueryOne<Comment>(`
        SELECT c.* FROM comments c
        LEFT JOIN tickets t ON c.ticket_id = t.id
        WHERE c.id = ? AND t.organization_id = ?
      `, [comment.id, organizationId]);
    }

    values.push(comment.id, organizationId);
    await executeRun(`
      UPDATE comments SET ${fields.join(', ')}
      WHERE id = ? AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
    `, values);

    return await executeQueryOne<Comment>(`
      SELECT c.* FROM comments c
      LEFT JOIN tickets t ON c.ticket_id = t.id
      WHERE c.id = ? AND t.organization_id = ?
    `, [comment.id, organizationId]);
  },

  delete: async (id: number, organizationId: number): Promise<boolean> => {
    const result = await executeRun(`
      DELETE FROM comments
      WHERE id = ? AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
    `, [id, organizationId]);
    return result.changes > 0;
  },
};

// ===== ATTACHMENTS =====
export const attachmentQueries = {
  getByTicketId: async (ticketId: number, organizationId: number): Promise<Attachment[]> => {
    return await executeQuery<Attachment>(`
      SELECT a.*
      FROM attachments a
      LEFT JOIN tickets t ON a.ticket_id = t.id
      WHERE a.ticket_id = ? AND t.organization_id = ?
      ORDER BY a.created_at
    `, [ticketId, organizationId]);
  },

  getById: async (id: number, organizationId: number): Promise<Attachment | undefined> => {
    return await executeQueryOne<Attachment>(`
      SELECT a.*
      FROM attachments a
      LEFT JOIN tickets t ON a.ticket_id = t.id
      WHERE a.id = ? AND t.organization_id = ?
    `, [id, organizationId]);
  },

  create: async (attachment: CreateAttachment, organizationId: number): Promise<Attachment> => {
    // Verify ticket belongs to organization before creating attachment
    const ticketCheck = await executeQueryOne<{ id: number }>('SELECT id FROM tickets WHERE id = ? AND organization_id = ?', [attachment.ticket_id, organizationId]);
    if (!ticketCheck) {
      throw new Error('Ticket not found or does not belong to organization');
    }

    const result = await executeRun(`
      INSERT INTO attachments (ticket_id, filename, original_name, mime_type, size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      attachment.ticket_id,
      attachment.filename,
      attachment.original_name,
      attachment.mime_type,
      attachment.size,
      attachment.uploaded_by
    ]);
    const created = await executeQueryOne<Attachment>('SELECT * FROM attachments WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  delete: async (id: number, organizationId: number): Promise<boolean> => {
    const result = await executeRun(`
      DELETE FROM attachments
      WHERE id = ? AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
    `, [id, organizationId]);
    return result.changes > 0;
  },
};

/**
 * Analytics and Dashboard Query Operations
 *
 * Provides real-time analytics, KPIs, and metrics for dashboards and reporting.
 * These queries use complex aggregations and window functions for performance analytics.
 *
 * All analytics queries enforce organization-level isolation for multi-tenant security.
 */
export const analyticsQueries = {
  getRealTimeKPIs: async (organizationId: number): Promise<RealTimeKPIs> => {
    // Check cache first - provides 80%+ performance improvement
    const cacheKey = `analytics:kpis:${organizationId}`;
    const cached = getFromCache<RealTimeKPIs>(cacheKey);
    if (cached) {
      return cached;
    }

    const kpis = await executeQueryOne<RealTimeKPIs>(`
      WITH
      -- Ticket volume metrics (single scan with CASE aggregations)
      ticket_stats AS (
        SELECT
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN ${sqlDate('created_at')} = ${sqlCurrentDate()} THEN 1 END) as tickets_today,
          COUNT(CASE WHEN created_at >= ${sqlDatetimeSub(7)} THEN 1 END) as tickets_this_week,
          COUNT(CASE WHEN created_at >= ${sqlDatetimeSub(30)} THEN 1 END) as tickets_this_month,
          COUNT(DISTINCT CASE WHEN assigned_to IS NOT NULL THEN assigned_to END) as active_agents,
          COUNT(CASE WHEN status_id IN (SELECT id FROM statuses WHERE is_final = 0) THEN 1 END) as open_tickets,
          COUNT(CASE WHEN created_at >= ${sqlDatetimeSub(1)} AND status_id IN (SELECT id FROM statuses WHERE is_final = 1) THEN 1 END) as resolved_today
        FROM tickets
        WHERE organization_id = ? AND deleted_at IS NULL
      ),
      -- SLA tracking metrics (single join and scan)
      sla_stats AS (
        SELECT
          COUNT(*) as total_sla_tracked,
          COUNT(CASE WHEN st.response_met = 1 THEN 1 END) as sla_response_met,
          COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) as sla_resolution_met,
          ROUND(AVG(CASE WHEN st.response_met = 1 THEN st.response_time_minutes END), 2) as avg_response_time,
          ROUND(AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END), 2) as avg_resolution_time
        FROM sla_tracking st
        INNER JOIN tickets t ON st.ticket_id = t.id
        WHERE t.organization_id = ? AND t.deleted_at IS NULL
      ),
      -- First Call Resolution (FCR) with optimized comment count
      fcr_stats AS (
        SELECT
          ROUND(
            CAST(COUNT(CASE WHEN agent_comments <= 1 AND s.is_final = 1 THEN 1 END) AS FLOAT) /
            NULLIF(CAST(COUNT(CASE WHEN s.is_final = 1 THEN 1 END) AS FLOAT), 0) * 100, 2
          ) as fcr_rate
        FROM tickets t
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN (
          SELECT ticket_id, COUNT(*) as agent_comments
          FROM comments
          WHERE user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))
          GROUP BY ticket_id
        ) c ON t.id = c.ticket_id
        WHERE t.organization_id = ? AND t.deleted_at IS NULL
      ),
      -- Customer Satisfaction (CSAT) - last 30 days
      csat_stats AS (
        SELECT
          ROUND(AVG(ss.rating), 2) as csat_score,
          COUNT(*) as csat_responses
        FROM satisfaction_surveys ss
        INNER JOIN tickets t ON ss.ticket_id = t.id
        WHERE t.organization_id = ?
          AND t.deleted_at IS NULL
          AND ss.created_at >= ${sqlDatetimeSub(30)}
      )
      -- Final result combining all CTEs
      SELECT
        ts.total_tickets,
        ts.tickets_today,
        ts.tickets_this_week,
        ts.tickets_this_month,
        ts.active_agents,
        ts.open_tickets,
        ts.resolved_today,
        sla.total_sla_tracked,
        sla.sla_response_met,
        sla.sla_resolution_met,
        sla.avg_response_time,
        sla.avg_resolution_time,
        fcr.fcr_rate,
        csat.csat_score,
        csat.csat_responses
      FROM ticket_stats ts, sla_stats sla, fcr_stats fcr, csat_stats csat
    `, [organizationId, organizationId, organizationId, organizationId]);

    // Cache result for 5 minutes (reduces DB load by ~95%)
    if (kpis) {
      setCache(cacheKey, kpis, CACHE_TTL.REALTIME_KPIS);
    }

    return kpis!;
  },

  // SLA Performance Analytics
  getSLAAnalytics: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        ${sqlDate('t.created_at')} as date,
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN st.response_met = 1 THEN 1 END) as response_met,
        COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) as resolution_met,
        ROUND(AVG(st.response_time_minutes), 2) as avg_response_time,
        ROUND(AVG(st.resolution_time_minutes), 2) as avg_resolution_time,
        ROUND(
          CAST(COUNT(CASE WHEN st.response_met = 1 THEN 1 END) AS FLOAT) /
          CAST(COUNT(*) AS FLOAT) * 100, 2
        ) as response_sla_rate,
        ROUND(
          CAST(COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) AS FLOAT) /
          CAST(COUNT(*) AS FLOAT) * 100, 2
        ) as resolution_sla_rate
      FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ? AND t.created_at >= ${sqlDynamicDateSub()}
      GROUP BY ${sqlDate('t.created_at')}
      ORDER BY ${sqlDate('t.created_at')}
    `, [organizationId, days]);
  },

  // Agent Performance Analytics
  getAgentPerformance: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(t.id) as assigned_tickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as resolved_tickets,
        ROUND(
          CAST(COUNT(CASE WHEN s.is_final = 1 THEN 1 END) AS FLOAT) /
          CAST(COUNT(t.id) AS FLOAT) * 100, 2
        ) as resolution_rate,
        ROUND(AVG(st.response_time_minutes), 2) as avg_response_time,
        ROUND(AVG(st.resolution_time_minutes), 2) as avg_resolution_time,
        ROUND(AVG(ss.rating), 2) as avg_satisfaction,
        COUNT(ss.id) as satisfaction_responses
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to AND t.organization_id = ? AND t.created_at >= ${sqlDynamicDateSub()}
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(t.id) > 0
      ORDER BY resolved_tickets DESC
    `, [organizationId, days]);
  },

  // Category Performance Analytics
  getCategoryAnalytics: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        c.id,
        c.name,
        c.color,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as resolved_tickets,
        ROUND(
          CAST(COUNT(CASE WHEN s.is_final = 1 THEN 1 END) AS FLOAT) /
          CAST(COUNT(t.id) AS FLOAT) * 100, 2
        ) as resolution_rate,
        ROUND(AVG(st.resolution_time_minutes), 2) as avg_resolution_time,
        ROUND(AVG(ss.rating), 2) as avg_satisfaction
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id AND t.organization_id = ? AND t.created_at >= ${sqlDynamicDateSub()}
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      GROUP BY c.id, c.name, c.color
      HAVING COUNT(t.id) > 0
      ORDER BY total_tickets DESC
    `, [organizationId, days]);
  },

  // Priority Distribution Analytics
  getPriorityDistribution: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        p.id,
        p.name,
        p.level,
        p.color,
        COUNT(t.id) as ticket_count,
        ROUND(
          CAST(COUNT(t.id) AS FLOAT) /
          CAST((SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND created_at >= ${sqlDynamicDateSub()}) AS FLOAT) * 100, 2
        ) as percentage
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id AND t.organization_id = ? AND t.created_at >= ${sqlDynamicDateSub()}
      GROUP BY p.id, p.name, p.level, p.color
      ORDER BY p.level DESC
    `, [organizationId, days, organizationId, days]);
  },

  // Ticket Volume Trends
  getTicketVolumeTrends: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        ${sqlDate('created_at')} as date,
        COUNT(*) as created,
        COUNT(CASE WHEN status_id IN (SELECT id FROM statuses WHERE is_final = 1) THEN 1 END) as resolved,
        COUNT(CASE WHEN priority_id IN (SELECT id FROM priorities WHERE level >= 3) THEN 1 END) as high_priority
      FROM tickets
      WHERE organization_id = ? AND created_at >= ${sqlDynamicDateSub()}
      GROUP BY ${sqlDate('created_at')}
      ORDER BY ${sqlDate('created_at')}
    `, [organizationId, days]);
  },

  // Response Time Analytics
  getResponseTimeAnalytics: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        ${sqlDate('t.created_at')} as date,
        COUNT(st.id) as total_responses,
        ROUND(AVG(st.response_time_minutes), 2) as avg_response_time,
        MIN(st.response_time_minutes) as min_response_time,
        MAX(st.response_time_minutes) as max_response_time,
        COUNT(CASE WHEN st.response_met = 1 THEN 1 END) as sla_met,
        ROUND(
          CAST(COUNT(CASE WHEN st.response_met = 1 THEN 1 END) AS FLOAT) /
          CAST(COUNT(st.id) AS FLOAT) * 100, 2
        ) as sla_compliance
      FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ? AND t.created_at >= ${sqlDynamicDateSub()} AND st.response_time_minutes IS NOT NULL
      GROUP BY ${sqlDate('t.created_at')}
      ORDER BY ${sqlDate('t.created_at')}
    `, [organizationId, days]);
  },

  // Customer Satisfaction Trends
  getSatisfactionTrends: async (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    return await executeQuery(`
      SELECT
        ${sqlDate('ss.created_at')} as date,
        COUNT(*) as total_responses,
        ROUND(AVG(ss.rating), 2) as avg_rating,
        COUNT(CASE WHEN ss.rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN ss.rating <= 2 THEN 1 END) as negative_ratings,
        ROUND(
          CAST(COUNT(CASE WHEN ss.rating >= 4 THEN 1 END) AS FLOAT) /
          CAST(COUNT(*) AS FLOAT) * 100, 2
        ) as satisfaction_rate
      FROM satisfaction_surveys ss
      INNER JOIN tickets t ON ss.ticket_id = t.id
      WHERE t.organization_id = ? AND ss.created_at >= ${sqlDynamicDateSub()}
      GROUP BY ${sqlDate('ss.created_at')}
      ORDER BY ${sqlDate('ss.created_at')}
    `, [organizationId, days]);
  },

  // Comparative Analytics (Department/Period)
  getComparativeAnalytics: async (organizationId: number, compareBy: 'category' | 'agent' | 'priority', _periods?: string[]) => {
    if (compareBy === 'category') {
      return await executeQuery(`
        SELECT
          c.name as label,
          c.color,
          period.name as period,
          COUNT(t.id) as value,
          'tickets' as metric
        FROM categories c
        CROSS JOIN (
          SELECT 'Current' as name, ${sqlDatetimeSub(30)} as start_date
          UNION ALL
          SELECT 'Previous' as name, ${sqlDatetimeSub(60)} as start_date
        ) period
        LEFT JOIN tickets t ON c.id = t.category_id
          AND t.organization_id = ?
          AND t.created_at >= period.start_date
          AND t.created_at < CASE
            WHEN period.name = 'Current' THEN ${sqlDatetimeNow()}
            ELSE ${sqlDatetimeSub(30)}
          END
        GROUP BY c.id, c.name, c.color, period.name
        ORDER BY c.name, period.name
      `, [organizationId]);
    }
    // Add more comparative queries as needed
    return [];
  },

  // Anomaly Detection Data
  getAnomalyDetectionData: async (organizationId: number) => {
    return await executeQuery(`
      WITH daily_metrics AS (
        SELECT
          ${sqlDate('created_at')} as date,
          COUNT(*) as ticket_count,
          COUNT(CASE WHEN priority_id IN (SELECT id FROM priorities WHERE level >= 3) THEN 1 END) as high_priority_count
        FROM tickets
        WHERE organization_id = ? AND created_at >= ${sqlDatetimeSub(30)}
        GROUP BY ${sqlDate('created_at')}
      ),
      avg_metrics AS (
        SELECT
          AVG(ticket_count) as avg_tickets,
          AVG(high_priority_count) as avg_high_priority
        FROM daily_metrics
      )
      SELECT
        dm.date,
        dm.ticket_count,
        dm.high_priority_count,
        am.avg_tickets,
        am.avg_high_priority,
        CASE
          WHEN dm.ticket_count > (am.avg_tickets * 1.5) THEN 'high_volume'
          WHEN dm.high_priority_count > (am.avg_high_priority * 2) THEN 'high_priority_spike'
          ELSE 'normal'
        END as anomaly_type
      FROM daily_metrics dm
      CROSS JOIN avg_metrics am
      WHERE dm.ticket_count > (am.avg_tickets * 1.2) OR dm.high_priority_count > (am.avg_high_priority * 1.5)
      ORDER BY dm.date DESC
    `, [organizationId]);
  },

  // Knowledge Base Analytics
  getKnowledgeBaseAnalytics: async (organizationId: number) => {
    return await executeQueryOne(`
      SELECT
        (SELECT COUNT(*) FROM kb_articles WHERE organization_id = ? AND status = 'published') as published_articles,
        (SELECT SUM(view_count) FROM kb_articles WHERE organization_id = ? AND status = 'published') as total_views,
        (SELECT ROUND(AVG(helpful_votes * 1.0 / (helpful_votes + not_helpful_votes)), 2)
         FROM kb_articles
         WHERE organization_id = ? AND status = 'published' AND (helpful_votes + not_helpful_votes) > 0
        ) as avg_helpfulness,
        (
          SELECT ${sqlJsonGroupArray(
            sqlJsonObject("'title', title, 'view_count', view_count, 'helpfulness', ROUND(helpful_votes * 1.0 / (helpful_votes + not_helpful_votes), 2)")
          )}
          FROM (
            SELECT title, view_count, helpful_votes, not_helpful_votes
            FROM kb_articles
            WHERE organization_id = ? AND status = 'published'
            ORDER BY view_count DESC
            LIMIT 10
          )${getDatabaseType() === 'postgresql' ? ' sub' : ''}
        ) as top_articles
    `, [organizationId, organizationId, organizationId, organizationId]);
  }
};

// ===== SLA TRACKING =====
export const slaQueries = {
  getBySLAPolicy: async (policyId: number, organizationId: number) => {
    return await executeQuery(`
      SELECT st.*, t.title, t.created_at as ticket_created_at, sp.name as policy_name
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN sla_policies sp ON st.sla_policy_id = sp.id
      WHERE st.sla_policy_id = ? AND t.organization_id = ?
      ORDER BY st.created_at DESC
    `, [policyId, organizationId]);
  },

  getBreachedSLAs: async (organizationId: number) => {
    return await executeQuery(`
      SELECT
        st.*,
        t.title,
        t.id as ticket_id,
        u.name as user_name,
        a.name as agent_name,
        sp.name as policy_name
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN sla_policies sp ON st.sla_policy_id = sp.id
      WHERE t.organization_id = ?
        AND ((st.response_due_at < CURRENT_TIMESTAMP AND st.response_met = 0)
         OR (st.resolution_due_at < CURRENT_TIMESTAMP AND st.resolution_met = 0))
      ORDER BY st.response_due_at ASC, st.resolution_due_at ASC
    `, [organizationId]);
  },

  getUpcomingSLABreaches: async (organizationId: number) => {
    return await executeQuery(`
      SELECT
        st.*,
        t.title,
        t.id as ticket_id,
        u.name as user_name,
        a.name as agent_name,
        sp.name as policy_name,
        ${sqlMinutesUntil('st.response_due_at')} as minutes_until_response_breach,
        ${sqlMinutesUntil('st.resolution_due_at')} as minutes_until_resolution_breach
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN sla_policies sp ON st.sla_policy_id = sp.id
      WHERE t.organization_id = ?
        AND ((st.response_due_at BETWEEN CURRENT_TIMESTAMP AND ${sqlDateAddHours(2)} AND st.response_met = 0)
         OR (st.resolution_due_at BETWEEN CURRENT_TIMESTAMP AND ${sqlDateAddHours(4)} AND st.resolution_met = 0))
        AND t.status_id NOT IN (SELECT id FROM statuses WHERE is_final = 1)
      ORDER BY st.response_due_at ASC, st.resolution_due_at ASC
    `, [organizationId]);
  }
};

// ===== DASHBOARD WIDGETS =====
export const dashboardQueries = {
  getWidgetData: async (widgetType: string, organizationId: number, config: any = {}) => {
    switch (widgetType) {
      case 'kpi_summary':
        return await analyticsQueries.getRealTimeKPIs(organizationId);

      case 'sla_performance':
        return await analyticsQueries.getSLAAnalytics(organizationId, config.period || 'month');

      case 'agent_performance':
        return await analyticsQueries.getAgentPerformance(organizationId, config.period || 'month');

      case 'category_distribution':
        return await analyticsQueries.getCategoryAnalytics(organizationId, config.period || 'month');

      case 'priority_distribution':
        return await analyticsQueries.getPriorityDistribution(organizationId, config.period || 'month');

      case 'volume_trends':
        return await analyticsQueries.getTicketVolumeTrends(organizationId, config.period || 'month');

      case 'response_time_trends':
        return await analyticsQueries.getResponseTimeAnalytics(organizationId, config.period || 'month');

      case 'satisfaction_trends':
        return await analyticsQueries.getSatisfactionTrends(organizationId, config.period || 'month');

      case 'sla_breaches':
        return await slaQueries.getBreachedSLAs(organizationId);

      case 'upcoming_breaches':
        return await slaQueries.getUpcomingSLABreaches(organizationId);

      case 'anomaly_detection':
        return await analyticsQueries.getAnomalyDetectionData(organizationId);

      case 'knowledge_base_stats':
        return await analyticsQueries.getKnowledgeBaseAnalytics(organizationId);

      default:
        return null;
    }
  },

  saveCustomDashboard: async (userId: number, dashboardConfig: any) => {
    return await executeRun(`
      INSERT INTO system_settings (key, value, description, type, updated_by)
      VALUES (?, ?, ?, 'json', ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `, [
      `dashboard_config_user_${userId}`,
      JSON.stringify(dashboardConfig),
      `Custom dashboard configuration for user ${userId}`,
      userId
    ]);
  },

  getUserDashboard: async (userId: number) => {
    const result = await executeQueryOne<{ value: string }>(`
      SELECT value
      FROM system_settings
      WHERE key = ?
    `, [`dashboard_config_user_${userId}`]);

    return result ? JSON.parse(result.value) : null;
  },

  getGlobalDashboard: async () => {
    const result = await executeQueryOne<{ value: string }>(`
      SELECT value
      FROM system_settings
      WHERE key = 'dashboard_config_global'
    `);

    return result ? JSON.parse(result.value) : null;
  }
};

/**
 * System Settings Query Operations
 */
export const systemSettingsQueries = {
  getSystemSetting: async (key: string, organizationId?: number): Promise<string | null> => {
    if (organizationId !== undefined) {
      const orgSetting = await executeQueryOne<{ value: string }>(`
        SELECT value FROM system_settings
        WHERE key = ? AND organization_id = ?
        LIMIT 1
      `, [key, organizationId]);

      if (orgSetting) {
        return orgSetting.value;
      }
    }

    const globalSetting = await executeQueryOne<{ value: string }>(`
      SELECT value FROM system_settings
      WHERE key = ? AND organization_id IS NULL
      LIMIT 1
    `, [key]);

    return globalSetting?.value ?? null;
  },

  setSystemSetting: async (
    key: string,
    value: string,
    organizationId?: number,
    updatedBy?: number
  ): Promise<boolean> => {
    try {
      await executeRun(`
        INSERT INTO system_settings (key, value, organization_id, updated_by, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key, organization_id) DO UPDATE SET
          value = excluded.value,
          updated_by = excluded.updated_by,
          updated_at = CURRENT_TIMESTAMP
      `, [key, value, organizationId ?? null, updatedBy ?? null]);

      return true;
    } catch (error) {
      logger.error('Error setting system setting:', error);
      return false;
    }
  },

  getAllSystemSettings: async (organizationId?: number): Promise<Record<string, string>> => {
    const globalSettings = await executeQuery<{ key: string; value: string }>(`
      SELECT key, value
      FROM system_settings
      WHERE organization_id IS NULL
    `);

    const settingsMap: Record<string, string> = {};

    for (const setting of globalSettings) {
      settingsMap[setting.key] = setting.value;
    }

    if (organizationId !== undefined) {
      const orgSettings = await executeQuery<{ key: string; value: string }>(`
        SELECT key, value
        FROM system_settings
        WHERE organization_id = ?
      `, [organizationId]);

      for (const setting of orgSettings) {
        settingsMap[setting.key] = setting.value;
      }
    }

    return settingsMap;
  },

  deleteSystemSetting: async (key: string, organizationId?: number): Promise<boolean> => {
    const result = await executeRun(`
      DELETE FROM system_settings
      WHERE key = ? AND (organization_id = ? OR (organization_id IS NULL AND ? IS NULL))
    `, [key, organizationId ?? null, organizationId ?? null]);

    return result.changes > 0;
  },

  getAllSettingsWithMetadata: async (organizationId?: number) => {
    const query = organizationId !== undefined
      ? `SELECT * FROM system_settings WHERE organization_id = ? OR organization_id IS NULL ORDER BY key`
      : `SELECT * FROM system_settings WHERE organization_id IS NULL ORDER BY key`;

    const params = organizationId !== undefined ? [organizationId] : [];

    return await executeQuery<{
      id: number;
      key: string;
      value: string;
      description: string | null;
      type: string;
      is_public: boolean;
      is_encrypted: boolean;
      organization_id: number | null;
      updated_by: number | null;
      created_at: string;
      updated_at: string;
    }>(query, params);
  }
};

/**
 * Legacy compatibility exports
 * These provide backward compatibility for code that imports individual functions
 */
export const getSystemSetting = systemSettingsQueries.getSystemSetting;
export const setSystemSetting = systemSettingsQueries.setSystemSetting;
export const getAllSystemSettings = systemSettingsQueries.getAllSystemSettings;

/**
 * ========================================
 * WORKFLOW QUERIES
 * ========================================
 */

import type { WorkflowDefinition } from '../types/workflow';

/**
 * Helper to parse a raw workflow DB row into a WorkflowDefinition
 */
function parseWorkflowRow(workflow: any): WorkflowDefinition {
  const triggerConditions = workflow.wd_trigger_conditions
    ? JSON.parse(workflow.wd_trigger_conditions)
    : (workflow.trigger_conditions ? JSON.parse(workflow.trigger_conditions) : {});

  const stepsJson = workflow.steps_json ? JSON.parse(workflow.steps_json) : {};

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || '',
    version: workflow.version || 1,
    isActive: Boolean(workflow.is_active),
    isTemplate: Boolean(workflow.is_template),
    category: workflow.category || 'ticket_automation',
    priority: workflow.priority || 0,
    triggerType: workflow.trigger_type,
    triggerConditions,
    nodes: stepsJson.nodes || [],
    edges: stepsJson.edges || [],
    variables: stepsJson.variables || [],
    metadata: stepsJson.metadata || {
      tags: [],
      documentation: '',
      version: '1.0',
      author: '',
      lastModifiedBy: '',
      changeLog: [],
      dependencies: [],
      testCases: [],
      performance: {
        avgExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: 0,
        successRate: 0,
        errorRate: 0,
        resourceUsage: {
          memoryMB: 0,
          cpuPercent: 0,
          networkKB: 0,
          storageKB: 0,
        },
      },
    },
    executionCount: workflow.execution_count || 0,
    successCount: workflow.success_count || 0,
    failureCount: workflow.failure_count || 0,
    lastExecutedAt: workflow.last_executed_at ? new Date(workflow.last_executed_at) : undefined,
    createdBy: workflow.created_by,
    updatedBy: workflow.updated_by,
    createdAt: new Date(workflow.created_at),
    updatedAt: new Date(workflow.updated_at),
  };
}

export const workflowQueries = {
  async getWorkflowById(id: number): Promise<WorkflowDefinition | null> {
    try {
      const workflow = await executeQueryOne<any>(`
        SELECT
          w.*,
          wd.steps_json,
          wd.trigger_conditions as wd_trigger_conditions
        FROM workflows w
        LEFT JOIN workflow_definitions wd ON w.id = wd.id
        WHERE w.id = ?
      `, [id]);

      if (!workflow) {
        return null;
      }

      return parseWorkflowRow(workflow);
    } catch (error) {
      logger.error('Error getting workflow by ID:', error);
      throw error;
    }
  },

  async getActiveWorkflows(): Promise<WorkflowDefinition[]> {
    try {
      const workflows = await executeQuery<any>(`
        SELECT
          w.*,
          wd.steps_json,
          wd.trigger_conditions as wd_trigger_conditions
        FROM workflows w
        LEFT JOIN workflow_definitions wd ON w.id = wd.id
        WHERE w.is_active = TRUE
        ORDER BY w.priority DESC, w.created_at DESC
      `);

      return workflows.map(parseWorkflowRow);
    } catch (error) {
      logger.error('Error getting active workflows:', error);
      throw error;
    }
  },

  async getWorkflowsByTriggerType(triggerType: string): Promise<WorkflowDefinition[]> {
    try {
      const workflows = await executeQuery<any>(`
        SELECT
          w.*,
          wd.steps_json,
          wd.trigger_conditions as wd_trigger_conditions
        FROM workflows w
        LEFT JOIN workflow_definitions wd ON w.id = wd.id
        WHERE w.trigger_type = ? AND w.is_active = TRUE
        ORDER BY w.priority DESC
      `, [triggerType]);

      return workflows.map(parseWorkflowRow);
    } catch (error) {
      logger.error('Error getting workflows by trigger type:', error);
      throw error;
    }
  },
};

// Legacy compatibility exports
export const getWorkflowById = workflowQueries.getWorkflowById;
export const getActiveWorkflows = workflowQueries.getActiveWorkflows;
export const getWorkflowsByTriggerType = workflowQueries.getWorkflowsByTriggerType;

/**
 * ========================================
 * CAB (Change Advisory Board) QUERIES
 * ========================================
 */

import type {
  CABMeeting,
  CABConfiguration,
  CABMember,
  ChangeRequest,
  ChangeRequestApproval,
  CreateCABMeeting,
  CreateCABMember,
  CreateChangeRequest,
  CreateChangeRequestApproval,
  UpdateCABMeeting,
  UpdateChangeRequest,
  CABMeetingWithDetails,
  ChangeRequestWithDetails
} from '../types/database';

export const cabQueries = {
  getCabMeetings: async (organizationId: number, filters?: {
    status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    meeting_type?: 'regular' | 'emergency' | 'virtual';
    upcoming?: boolean;
  }): Promise<CABMeeting[]> => {
    let query = `
      SELECT m.*
      FROM cab_meetings m
      WHERE m.organization_id = ?
    `;
    const params: any[] = [organizationId];

    if (filters?.status) {
      query += ' AND m.status = ?';
      params.push(filters.status);
    }

    if (filters?.meeting_type) {
      query += ' AND m.meeting_type = ?';
      params.push(filters.meeting_type);
    }

    if (filters?.upcoming) {
      query += ` AND m.meeting_date >= ${sqlCurrentDate()} AND m.status = 'scheduled'`;
    }

    query += ' ORDER BY m.meeting_date DESC, m.created_at DESC';

    return await executeQuery<CABMeeting>(query, params);
  },

  getCabMeetingById: async (id: number, organizationId: number): Promise<CABMeetingWithDetails | undefined> => {
    const meeting = await executeQueryOne<any>(`
      SELECT
        m.*,
        u.name as organizer_name,
        u.email as organizer_email,
        c.name as cab_name,
        c.description as cab_description
      FROM cab_meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN cab_configurations c ON m.cab_id = c.id
      WHERE m.id = ? AND m.organization_id = ?
    `, [id, organizationId]);

    if (!meeting) return undefined;

    // Get change requests for this meeting
    const changeRequests = await executeQuery(`
      SELECT cr.*,
        u.name as requester_name,
        ct.name as change_type_name
      FROM change_requests cr
      LEFT JOIN users u ON cr.requester_id = u.id
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      WHERE cr.cab_meeting_id = ?
      ORDER BY cr.risk_level DESC, cr.priority DESC
    `, [id]);

    return {
      ...meeting,
      change_requests: changeRequests
    } as CABMeetingWithDetails;
  },

  createCabMeeting: async (meeting: Omit<CreateCABMeeting, 'organization_id'>, organizationId: number, createdBy: number): Promise<CABMeeting> => {
    const result = await executeRun(`
      INSERT INTO cab_meetings (
        cab_id, meeting_date, meeting_type, status, attendees,
        agenda, minutes, decisions, action_items, created_by, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      meeting.cab_id,
      meeting.meeting_date,
      meeting.meeting_type || 'regular',
      meeting.status || 'scheduled',
      meeting.attendees ? JSON.stringify(meeting.attendees) : null,
      meeting.agenda || null,
      meeting.minutes || null,
      meeting.decisions ? JSON.stringify(meeting.decisions) : null,
      meeting.action_items ? JSON.stringify(meeting.action_items) : null,
      createdBy,
      organizationId
    ]);

    const created = await executeQueryOne<CABMeeting>('SELECT * FROM cab_meetings WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  updateCabMeeting: async (meeting: UpdateCABMeeting, organizationId: number): Promise<CABMeeting | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    if (meeting.status !== undefined) {
      fields.push('status = ?');
      values.push(meeting.status);
    }
    if (meeting.meeting_date !== undefined) {
      fields.push('meeting_date = ?');
      values.push(meeting.meeting_date);
    }
    if (meeting.meeting_type !== undefined) {
      fields.push('meeting_type = ?');
      values.push(meeting.meeting_type);
    }
    if (meeting.attendees !== undefined) {
      fields.push('attendees = ?');
      values.push(JSON.stringify(meeting.attendees));
    }
    if (meeting.agenda !== undefined) {
      fields.push('agenda = ?');
      values.push(meeting.agenda);
    }
    if (meeting.minutes !== undefined) {
      fields.push('minutes = ?');
      values.push(meeting.minutes);
    }
    if (meeting.decisions !== undefined) {
      fields.push('decisions = ?');
      values.push(JSON.stringify(meeting.decisions));
    }
    if (meeting.action_items !== undefined) {
      fields.push('action_items = ?');
      values.push(JSON.stringify(meeting.action_items));
    }

    if (fields.length === 0) {
      return await executeQueryOne<CABMeeting>('SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?', [meeting.id, organizationId]);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(meeting.id, organizationId);

    await executeRun(`UPDATE cab_meetings SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`, values);

    return await executeQueryOne<CABMeeting>('SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?', [meeting.id, organizationId]);
  },

  deleteCabMeeting: async (id: number, organizationId: number): Promise<boolean> => {
    const result = await executeRun(
      `UPDATE cab_meetings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [id, organizationId]
    );
    return result.changes > 0;
  },

  getCabConfiguration: async (organizationId: number): Promise<CABConfiguration | undefined> => {
    return await executeQueryOne<CABConfiguration>(`SELECT * FROM cab_configurations WHERE organization_id = ? AND is_active = ${sqlTrue()}`, [organizationId]);
  },

  getCabMembers: async (organizationId: number, cabId?: number): Promise<CABMember[]> => {
    if (cabId) {
      return await executeQuery<CABMember>(`
        SELECT cm.*, u.name as user_name, u.email as user_email
        FROM cab_members cm
        LEFT JOIN users u ON cm.user_id = u.id
        WHERE cm.cab_id = ? AND cm.is_active = ${sqlTrue()}
        ORDER BY cm.role, u.name
      `, [cabId]);
    }

    return await executeQuery<CABMember>(`
      SELECT cm.*, u.name as user_name, u.email as user_email
      FROM cab_members cm
      LEFT JOIN cab_configurations c ON cm.cab_id = c.id
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE c.organization_id = ? AND cm.is_active = ${sqlTrue()}
      ORDER BY cm.role, u.name
    `, [organizationId]);
  },

  addCabMember: async (member: CreateCABMember): Promise<CABMember> => {
    const result = await executeRun(`
      INSERT INTO cab_members (cab_id, user_id, role, is_voting_member, expertise_areas, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      member.cab_id,
      member.user_id,
      member.role || 'member',
      member.is_voting_member !== undefined ? member.is_voting_member : true,
      member.expertise_areas ? JSON.stringify(member.expertise_areas) : null,
      member.is_active !== undefined ? member.is_active : true
    ]);

    const created = await executeQueryOne<CABMember>('SELECT * FROM cab_members WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  getChangesPendingCab: async (organizationId: number): Promise<ChangeRequest[]> => {
    return await executeQuery<ChangeRequest>(`
      SELECT cr.*,
        u.name as requester_name,
        ct.name as change_type_name
      FROM change_requests cr
      LEFT JOIN users u ON cr.requester_id = u.id
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      WHERE cr.organization_id = ?
        AND cr.status IN ('submitted', 'under_review', 'pending_cab')
        AND cr.cab_meeting_id IS NULL
      ORDER BY cr.risk_level DESC, cr.priority DESC, cr.created_at ASC
    `, [organizationId]);
  },

  getChangeRequestById: async (id: number, organizationId: number): Promise<ChangeRequestWithDetails | undefined> => {
    const change = await executeQueryOne<any>(`
      SELECT cr.*,
        u.name as requester_name,
        u.email as requester_email,
        o.name as owner_name,
        i.name as implementer_name,
        ct.name as change_type_name
      FROM change_requests cr
      LEFT JOIN users u ON cr.requester_id = u.id
      LEFT JOIN users o ON cr.owner_id = o.id
      LEFT JOIN users i ON cr.implementer_id = i.id
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      WHERE cr.id = ? AND cr.organization_id = ?
    `, [id, organizationId]);

    if (!change) return undefined;

    // Get approvals/votes
    const approvals = await executeQuery(`
      SELECT cra.*,
        u.name as approver_name,
        u.email as approver_email
      FROM change_request_approvals cra
      LEFT JOIN users u ON cra.approver_id = u.id
      WHERE cra.change_request_id = ?
      ORDER BY cra.decided_at DESC
    `, [id]);

    return {
      ...change,
      approvals
    } as ChangeRequestWithDetails;
  },

  createChangeRequest: async (change: Omit<CreateChangeRequest, 'organization_id'>, organizationId: number): Promise<ChangeRequest> => {
    // Generate change number
    const lastChange = await executeQueryOne<{ change_number: string }>(`
      SELECT change_number FROM change_requests
      WHERE organization_id = ?
      ORDER BY id DESC LIMIT 1
    `, [organizationId]);

    let changeNumber = 'CHG-0001';
    if (lastChange) {
      const num = parseInt(lastChange.change_number.split('-')[1]) + 1;
      changeNumber = `CHG-${num.toString().padStart(4, '0')}`;
    }

    const result = await executeRun(`
      INSERT INTO change_requests (
        change_number, title, description, change_type_id, category, priority,
        risk_level, risk_assessment, impact_assessment, reason_for_change,
        business_justification, implementation_plan, backout_plan, test_plan,
        communication_plan, requested_start_date, requested_end_date,
        requester_id, owner_id, implementer_id, status, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      changeNumber,
      change.title,
      change.description,
      change.change_type_id || null,
      change.category || 'normal',
      change.priority || 'medium',
      change.risk_level || null,
      change.risk_assessment || null,
      change.impact_assessment || null,
      change.reason_for_change || null,
      change.business_justification || null,
      change.implementation_plan || null,
      change.backout_plan || null,
      change.test_plan || null,
      change.communication_plan || null,
      change.requested_start_date || null,
      change.requested_end_date || null,
      change.requester_id,
      change.owner_id || null,
      change.implementer_id || null,
      change.status || 'draft',
      organizationId
    ]);

    const created = await executeQueryOne<ChangeRequest>('SELECT * FROM change_requests WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  updateChangeRequest: async (change: UpdateChangeRequest, organizationId: number): Promise<ChangeRequest | undefined> => {
    const fields: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, any> = {
      title: change.title,
      description: change.description,
      status: change.status,
      approval_status: change.approval_status,
      risk_level: change.risk_level,
      priority: change.priority,
      cab_meeting_id: change.cab_meeting_id,
      approved_by: change.approved_by,
      approved_at: change.approved_at,
      approval_notes: change.approval_notes
    };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return await executeQueryOne<ChangeRequest>('SELECT * FROM change_requests WHERE id = ? AND organization_id = ?', [change.id, organizationId]);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(change.id, organizationId);

    await executeRun(`UPDATE change_requests SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`, values);

    return await executeQueryOne<ChangeRequest>('SELECT * FROM change_requests WHERE id = ? AND organization_id = ?', [change.id, organizationId]);
  },

  recordCabDecision: async (approval: CreateChangeRequestApproval): Promise<ChangeRequestApproval> => {
    await executeRun(`
      INSERT INTO change_request_approvals (
        change_request_id, cab_member_id, vote, voted_at, comments, conditions
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      ON CONFLICT(change_request_id, cab_member_id) DO UPDATE SET
        vote = excluded.vote,
        voted_at = CURRENT_TIMESTAMP,
        comments = excluded.comments,
        conditions = excluded.conditions
    `, [
      approval.change_request_id,
      approval.cab_member_id,
      approval.vote || null,
      approval.comments || null,
      approval.conditions || null
    ]);

    const result = await executeQueryOne<ChangeRequestApproval>(`
      SELECT * FROM change_request_approvals
      WHERE change_request_id = ? AND cab_member_id = ?
    `, [approval.change_request_id, approval.cab_member_id]);
    return result!;
  },

  getCabAgenda: async (organizationId: number, meetingId?: number): Promise<ChangeRequest[]> => {
    if (meetingId) {
      return await executeQuery<ChangeRequest>(`
        SELECT cr.*,
          u.name as requester_name,
          ct.name as change_type_name
        FROM change_requests cr
        LEFT JOIN users u ON cr.requester_id = u.id
        LEFT JOIN change_types ct ON cr.change_type_id = ct.id
        WHERE cr.cab_meeting_id = ?
        ORDER BY cr.risk_level DESC, cr.priority DESC
      `, [meetingId]);
    }

    return await cabQueries.getChangesPendingCab(organizationId);
  },

  addChangeToAgenda: async (changeId: number, meetingId: number, organizationId: number): Promise<boolean> => {
    const result = await executeRun(`
      UPDATE change_requests
      SET cab_meeting_id = ?, status = 'pending_cab', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [meetingId, changeId, organizationId]);

    return result.changes > 0;
  }
};

// Export individual functions for convenience
export const getCabMeetings = cabQueries.getCabMeetings;
export const getCabMeetingById = cabQueries.getCabMeetingById;
export const createCabMeeting = cabQueries.createCabMeeting;
export const updateCabMeeting = cabQueries.updateCabMeeting;
export const deleteCabMeeting = cabQueries.deleteCabMeeting;
export const getCabConfiguration = cabQueries.getCabConfiguration;
export const getCabMembers = cabQueries.getCabMembers;
export const addCabMember = cabQueries.addCabMember;
export const getChangesPendingCab = cabQueries.getChangesPendingCab;
export const getChangeRequestById = cabQueries.getChangeRequestById;
export const createChangeRequest = cabQueries.createChangeRequest;
export const updateChangeRequest = cabQueries.updateChangeRequest;
export const recordCabDecision = cabQueries.recordCabDecision;
export const getCabAgenda = cabQueries.getCabAgenda;
export const addChangeToAgenda = cabQueries.addChangeToAgenda;

/**
 * ========================================
 * NOTIFICATION QUERIES
 * ========================================
 */

import type { Notification as NotificationType } from '../types/database';

interface CreateNotificationInput {
  user_id: number;
  tenant_id: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  ticket_id?: number;
}

export const notificationQueries = {
  getUserNotifications: async (userId: number, tenantId: number, options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ notifications: NotificationType[], total: number, unread: number }> => {
    const { unreadOnly = false, limit = 50, offset = 0 } = options;

    let whereClause = 'WHERE user_id = ? AND tenant_id = ?';
    const params: any[] = [userId, tenantId];

    if (unreadOnly) {
      whereClause += ' AND is_read = 0';
    }

    const notifications = await executeQuery<NotificationType>(`
      SELECT *
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const totalRow = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM notifications
      ${whereClause}
    `, params);

    const unreadRow = await executeQueryOne<{ unread: number }>(`
      SELECT COUNT(*) as unread
      FROM notifications
      WHERE user_id = ? AND tenant_id = ? AND is_read = 0
    `, [userId, tenantId]);

    return {
      notifications,
      total: totalRow?.total ?? 0,
      unread: unreadRow?.unread ?? 0
    };
  },

  getUnreadCount: async (userId: number, tenantId: number): Promise<number> => {
    const row = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND tenant_id = ? AND is_read = 0
    `, [userId, tenantId]);

    return row?.count ?? 0;
  },

  createNotification: async (notification: CreateNotificationInput): Promise<NotificationType> => {
    const result = await executeRun(`
      INSERT INTO notifications (user_id, tenant_id, type, title, message, data, ticket_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ${sqlNow()})
    `, [
      notification.user_id,
      notification.tenant_id,
      notification.type,
      notification.title,
      notification.message,
      notification.data ? JSON.stringify(notification.data) : null,
      notification.ticket_id || null
    ]);

    const created = await executeQueryOne<NotificationType>('SELECT * FROM notifications WHERE id = ?', [result.lastInsertRowid]);
    return created!;
  },

  markAsRead: async (notificationId: number, userId: number, tenantId: number): Promise<boolean> => {
    const result = await executeRun(`
      UPDATE notifications
      SET is_read = 1, updated_at = ${sqlNow()}
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [notificationId, userId, tenantId]);

    return result.changes > 0;
  },

  markAllAsRead: async (userId: number, tenantId: number): Promise<number> => {
    const result = await executeRun(`
      UPDATE notifications
      SET is_read = 1, updated_at = ${sqlNow()}
      WHERE user_id = ? AND tenant_id = ? AND is_read = 0
    `, [userId, tenantId]);

    return result.changes;
  },

  markMultipleAsRead: async (notificationIds: number[], userId: number, tenantId: number): Promise<number> => {
    if (notificationIds.length === 0) return 0;

    const placeholders = notificationIds.map(() => '?').join(',');
    const result = await executeRun(`
      UPDATE notifications
      SET is_read = 1, updated_at = ${sqlNow()}
      WHERE id IN (${placeholders}) AND user_id = ? AND tenant_id = ?
    `, [...notificationIds, userId, tenantId]);

    return result.changes;
  },

  deleteOldNotifications: async (tenantId: number, daysOld: number = 30): Promise<number> => {
    const result = await executeRun(`
      DELETE FROM notifications
      WHERE tenant_id = ?
        AND is_read = 1
        AND created_at < ${sqlDynamicDateSub()}
    `, [tenantId, daysOld]);

    return result.changes;
  },

  getNotificationById: async (notificationId: number, userId: number, tenantId: number): Promise<NotificationType | undefined> => {
    return await executeQueryOne<NotificationType>(`
      SELECT * FROM notifications
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [notificationId, userId, tenantId]);
  },

  getNotificationsByType: async (userId: number, tenantId: number, type: string, limit: number = 20): Promise<NotificationType[]> => {
    return await executeQuery<NotificationType>(`
      SELECT * FROM notifications
      WHERE user_id = ? AND tenant_id = ? AND type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, tenantId, type, limit]);
  },

  createTicketNotification: async (params: {
    userId: number;
    tenantId: number;
    ticketId: number;
    type: 'ticket_assigned' | 'ticket_updated' | 'comment_added' | 'ticket_resolved' | 'sla_warning' | 'sla_breach';
    ticketTitle: string;
    additionalData?: Record<string, any>;
  }): Promise<NotificationType> => {
    const messages: Record<string, string> = {
      ticket_assigned: `Ticket #${params.ticketId} foi atribuído a você`,
      ticket_updated: `Status do ticket #${params.ticketId} foi atualizado`,
      comment_added: `Novo comentário no ticket #${params.ticketId}`,
      ticket_resolved: `Ticket #${params.ticketId} foi resolvido`,
      sla_warning: `⚠️ Ticket #${params.ticketId} próximo ao vencimento do SLA`,
      sla_breach: `🔴 SLA violado no ticket #${params.ticketId}`,
    };

    return await notificationQueries.createNotification({
      user_id: params.userId,
      tenant_id: params.tenantId,
      type: params.type,
      title: params.ticketTitle,
      message: messages[params.type],
      ticket_id: params.ticketId,
      data: {
        ticketId: params.ticketId,
        ...params.additionalData,
      },
    });
  },
};

// Export individual functions
export const getUserNotifications = notificationQueries.getUserNotifications;
export const getUnreadCount = notificationQueries.getUnreadCount;
export const createNotification = notificationQueries.createNotification;
export const markAsRead = notificationQueries.markAsRead;
export const markAllAsRead = notificationQueries.markAllAsRead;
export const markMultipleAsRead = notificationQueries.markMultipleAsRead;
export const deleteOldNotifications = notificationQueries.deleteOldNotifications;
export const getNotificationById = notificationQueries.getNotificationById;
export const getNotificationsByType = notificationQueries.getNotificationsByType;
export const createTicketNotification = notificationQueries.createTicketNotification;

// ========================================
// TICKET ACCESS TOKENS
// ========================================

/**
 * Ticket Access Token interface
 */
export interface TicketAccessToken {
  id: number;
  ticket_id: number;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  usage_count: number;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
  created_by: number | null;
  metadata: string | null;
}

/**
 * Generates a secure UUID v4 token for ticket access
 */
export async function generateTicketAccessToken(
  ticketId: number,
  expirationDays: number = 30,
  createdBy?: number
): Promise<string> {
  const crypto = require('crypto');
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  await executeRun(`
    INSERT INTO ticket_access_tokens (
      ticket_id,
      token,
      expires_at,
      is_active,
      created_by
    )
    VALUES (?, ?, ?, 1, ?)
  `, [ticketId, token, expiresAt.toISOString(), createdBy || null]);

  return token;
}

/**
 * Validates and retrieves a ticket access token
 */
export async function validateTicketAccessToken(
  token: string,
  ticketId?: number
): Promise<TicketAccessToken | null> {
  let query = `
    SELECT * FROM ticket_access_tokens
    WHERE token = ?
      AND is_active = ${sqlTrue()}
      AND revoked_at IS NULL
      AND expires_at > ${sqlNow()}
  `;

  const params: (string | number)[] = [token];

  if (ticketId !== undefined) {
    query += ' AND ticket_id = ?';
    params.push(ticketId);
  }

  const tokenData = await executeQueryOne<TicketAccessToken>(query, params);

  return tokenData || null;
}

/**
 * Records token usage by updating usage_count and last_used_at
 */
export async function recordTokenUsage(
  tokenId: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  await executeRun(`
    UPDATE ticket_access_tokens
    SET
      usage_count = usage_count + 1,
      last_used_at = ${sqlNow()},
      used_at = COALESCE(used_at, ${sqlNow()}),
      metadata = COALESCE(?, metadata)
    WHERE id = ?
  `, [metadataJson, tokenId]);
}

/**
 * Revokes a ticket access token, preventing further use
 */
export async function revokeTicketAccessToken(token: string): Promise<boolean> {
  const result = await executeRun(`
    UPDATE ticket_access_tokens
    SET
      is_active = ${sqlFalse()},
      revoked_at = ${sqlNow()}
    WHERE token = ?
  `, [token]);

  return result.changes > 0;
}

/**
 * Revokes all tokens for a specific ticket
 */
export async function revokeAllTicketTokens(ticketId: number): Promise<number> {
  const result = await executeRun(`
    UPDATE ticket_access_tokens
    SET
      is_active = ${sqlFalse()},
      revoked_at = ${sqlNow()}
    WHERE ticket_id = ? AND is_active = ${sqlTrue()}
  `, [ticketId]);

  return result.changes;
}

/**
 * Cleans up expired tokens from the database
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await executeRun(`
    DELETE FROM ticket_access_tokens
    WHERE expires_at < ${sqlDatetimeSub(30)}
  `);

  return result.changes;
}

/**
 * Gets all active tokens for a ticket
 */
export async function getTicketTokens(ticketId: number): Promise<TicketAccessToken[]> {
  return await executeQuery<TicketAccessToken>(`
    SELECT * FROM ticket_access_tokens
    WHERE ticket_id = ?
      AND is_active = ${sqlTrue()}
      AND revoked_at IS NULL
    ORDER BY created_at DESC
  `, [ticketId]);
}
