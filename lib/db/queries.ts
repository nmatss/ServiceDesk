import db from './connection';
import type { 
  User, CreateUser, UpdateUser,
  Category, CreateCategory, UpdateCategory,
  Priority, CreatePriority, UpdatePriority,
  Status, CreateStatus, UpdateStatus,
  Ticket, CreateTicket, UpdateTicket, TicketWithDetails,
  Comment, CreateComment, UpdateComment,
  Attachment, CreateAttachment
} from '../types/database';

// ===== USERS =====
export const userQueries = {
  // Buscar todos os usuários
  getAll: (): User[] => {
    return db.prepare('SELECT * FROM users ORDER BY name').all() as User[];
  },

  // Buscar usuário por ID
  getById: (id: number): User | undefined => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  // Buscar usuário por email
  getByEmail: (email: string): User | undefined => {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },

  // Buscar usuários por role
  getByRole: (role: 'admin' | 'agent' | 'user'): User[] => {
    return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY name').all(role) as User[];
  },

  // Criar usuário
  create: (user: CreateUser): User => {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, role) 
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(user.name, user.email, user.role);
    return userQueries.getById(result.lastInsertRowid as number)!;
  },

  // Atualizar usuário
  update: (user: UpdateUser): User | undefined => {
    const fields = [];
    const values = [];

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

    if (fields.length === 0) return userQueries.getById(user.id);

    values.push(user.id);
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return userQueries.getById(user.id);
  },

  // Deletar usuário
  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// ===== CATEGORIES =====
export const categoryQueries = {
  getAll: (): Category[] => {
    return db.prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
  },

  getById: (id: number): Category | undefined => {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
  },

  create: (category: CreateCategory): Category => {
    const stmt = db.prepare(`
      INSERT INTO categories (name, description, color) 
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(category.name, category.description, category.color);
    return categoryQueries.getById(result.lastInsertRowid as number)!;
  },

  update: (category: UpdateCategory): Category | undefined => {
    const fields = [];
    const values = [];

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

    if (fields.length === 0) return categoryQueries.getById(category.id);

    values.push(category.id);
    const stmt = db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return categoryQueries.getById(category.id);
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// ===== PRIORITIES =====
export const priorityQueries = {
  getAll: (): Priority[] => {
    return db.prepare('SELECT * FROM priorities ORDER BY level').all() as Priority[];
  },

  getById: (id: number): Priority | undefined => {
    return db.prepare('SELECT * FROM priorities WHERE id = ?').get(id) as Priority | undefined;
  },

  create: (priority: CreatePriority): Priority => {
    const stmt = db.prepare(`
      INSERT INTO priorities (name, level, color) 
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(priority.name, priority.level, priority.color);
    return priorityQueries.getById(result.lastInsertRowid as number)!;
  },

  update: (priority: UpdatePriority): Priority | undefined => {
    const fields = [];
    const values = [];

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

    if (fields.length === 0) return priorityQueries.getById(priority.id);

    values.push(priority.id);
    const stmt = db.prepare(`UPDATE priorities SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return priorityQueries.getById(priority.id);
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM priorities WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// ===== STATUSES =====
export const statusQueries = {
  getAll: (): Status[] => {
    return db.prepare('SELECT * FROM statuses ORDER BY is_final, name').all() as Status[];
  },

  getById: (id: number): Status | undefined => {
    return db.prepare('SELECT * FROM statuses WHERE id = ?').get(id) as Status | undefined;
  },

  getNonFinal: (): Status[] => {
    return db.prepare('SELECT * FROM statuses WHERE is_final = 0 ORDER BY name').all() as Status[];
  },

  getFinal: (): Status[] => {
    return db.prepare('SELECT * FROM statuses WHERE is_final = 1 ORDER BY name').all() as Status[];
  },

  create: (status: CreateStatus): Status => {
    const stmt = db.prepare(`
      INSERT INTO statuses (name, description, color, is_final) 
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(status.name, status.description, status.color, status.is_final ? 1 : 0);
    return statusQueries.getById(result.lastInsertRowid as number)!;
  },

  update: (status: UpdateStatus): Status | undefined => {
    const fields = [];
    const values = [];

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

    if (fields.length === 0) return statusQueries.getById(status.id);

    values.push(status.id);
    const stmt = db.prepare(`UPDATE statuses SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return statusQueries.getById(status.id);
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM statuses WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// ===== TICKETS =====
export const ticketQueries = {
  getAll: (organizationId: number): TicketWithDetails[] => {
    // OPTIMIZED: Single query with LEFT JOINs for counts instead of subqueries
    // Previous: N+1 subqueries for each ticket (slow)
    // Current: Single query with aggregation JOINs (fast)
    const stmt = db.prepare(`
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
    `);
    return stmt.all(organizationId) as TicketWithDetails[];
  },

  getById: (id: number, organizationId: number): TicketWithDetails | undefined => {
    // OPTIMIZED: Single query with LEFT JOINs for counts instead of subqueries
    const stmt = db.prepare(`
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
      WHERE t.id = ? AND t.organization_id = ?
    `);
    return stmt.get(id, id, id, organizationId) as TicketWithDetails | undefined;
  },

  getByUserId: (userId: number, organizationId: number): TicketWithDetails[] => {
    // OPTIMIZED: Single query with LEFT JOINs for counts instead of subqueries
    const stmt = db.prepare(`
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
    `);
    return stmt.all(userId, organizationId) as TicketWithDetails[];
  },

  getByAssignedTo: (assignedTo: number, organizationId: number): TicketWithDetails[] => {
    // OPTIMIZED: Single query with LEFT JOINs for counts instead of subqueries
    const stmt = db.prepare(`
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
    `);
    return stmt.all(assignedTo, organizationId) as TicketWithDetails[];
  },

  create: (ticket: CreateTicket, organizationId: number): Ticket => {
    const stmt = db.prepare(`
      INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      ticket.title,
      ticket.description,
      ticket.user_id,
      ticket.assigned_to || null,
      ticket.category_id,
      ticket.priority_id,
      ticket.status_id,
      organizationId
    );
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid as number) as Ticket;
  },

  update: (ticket: UpdateTicket, organizationId: number): Ticket | undefined => {
    const fields = [];
    const values = [];

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
      return db.prepare('SELECT * FROM tickets WHERE id = ? AND organization_id = ?').get(ticket.id, organizationId) as Ticket | undefined;
    }

    values.push(ticket.id, organizationId);
    const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`);
    stmt.run(...values);
    return db.prepare('SELECT * FROM tickets WHERE id = ? AND organization_id = ?').get(ticket.id, organizationId) as Ticket | undefined;
  },

  delete: (id: number, organizationId: number): boolean => {
    const stmt = db.prepare('DELETE FROM tickets WHERE id = ? AND organization_id = ?');
    const result = stmt.run(id, organizationId);
    return result.changes > 0;
  },
};

// ===== COMMENTS =====
export const commentQueries = {
  getByTicketId: (ticketId: number, organizationId: number): any[] => {
    const stmt = db.prepare(`
      SELECT
        c.*,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN tickets t ON c.ticket_id = t.id
      WHERE c.ticket_id = ? AND t.organization_id = ?
      ORDER BY c.created_at ASC
    `);
    return stmt.all(ticketId, organizationId) as any[];
  },

  getById: (id: number, organizationId: number): any | undefined => {
    const stmt = db.prepare(`
      SELECT
        c.*,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN tickets t ON c.ticket_id = t.id
      WHERE c.id = ? AND t.organization_id = ?
    `);
    return stmt.get(id, organizationId) as any | undefined;
  },

  create: (comment: CreateComment, organizationId: number): Comment => {
    // Verify ticket belongs to organization before creating comment
    const ticketCheck = db.prepare('SELECT id FROM tickets WHERE id = ? AND organization_id = ?').get(comment.ticket_id, organizationId);
    if (!ticketCheck) {
      throw new Error('Ticket not found or does not belong to organization');
    }

    const stmt = db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(comment.ticket_id, comment.user_id, comment.content, comment.is_internal ? 1 : 0);
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid as number) as Comment;
  },

  update: (comment: UpdateComment, organizationId: number): Comment | undefined => {
    const fields = [];
    const values = [];

    if (comment.content !== undefined) {
      fields.push('content = ?');
      values.push(comment.content);
    }
    if (comment.is_internal !== undefined) {
      fields.push('is_internal = ?');
      values.push(comment.is_internal ? 1 : 0);
    }

    if (fields.length === 0) {
      const stmt = db.prepare(`
        SELECT c.* FROM comments c
        LEFT JOIN tickets t ON c.ticket_id = t.id
        WHERE c.id = ? AND t.organization_id = ?
      `);
      return stmt.get(comment.id, organizationId) as Comment | undefined;
    }

    values.push(comment.id, organizationId);
    const stmt = db.prepare(`
      UPDATE comments SET ${fields.join(', ')}
      WHERE id = ? AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
    `);
    stmt.run(...values);

    const resultStmt = db.prepare(`
      SELECT c.* FROM comments c
      LEFT JOIN tickets t ON c.ticket_id = t.id
      WHERE c.id = ? AND t.organization_id = ?
    `);
    return resultStmt.get(comment.id, organizationId) as Comment | undefined;
  },

  delete: (id: number, organizationId: number): boolean => {
    const stmt = db.prepare(`
      DELETE FROM comments
      WHERE id = ? AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
    `);
    const result = stmt.run(id, organizationId);
    return result.changes > 0;
  },
};

// ===== ATTACHMENTS =====
export const attachmentQueries = {
  getByTicketId: (ticketId: number, organizationId: number): Attachment[] => {
    const stmt = db.prepare(`
      SELECT a.*
      FROM attachments a
      LEFT JOIN tickets t ON a.ticket_id = t.id
      WHERE a.ticket_id = ? AND t.organization_id = ?
      ORDER BY a.created_at
    `);
    return stmt.all(ticketId, organizationId) as Attachment[];
  },

  getById: (id: number, organizationId: number): Attachment | undefined => {
    const stmt = db.prepare(`
      SELECT a.*
      FROM attachments a
      LEFT JOIN tickets t ON a.ticket_id = t.id
      WHERE a.id = ? AND t.organization_id = ?
    `);
    return stmt.get(id, organizationId) as Attachment | undefined;
  },

  create: (attachment: CreateAttachment, organizationId: number): Attachment => {
    // Verify ticket belongs to organization before creating attachment
    const ticketCheck = db.prepare('SELECT id FROM tickets WHERE id = ? AND organization_id = ?').get(attachment.ticket_id, organizationId);
    if (!ticketCheck) {
      throw new Error('Ticket not found or does not belong to organization');
    }

    const stmt = db.prepare(`
      INSERT INTO attachments (ticket_id, filename, original_name, mime_type, size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      attachment.ticket_id,
      attachment.filename,
      attachment.original_name,
      attachment.mime_type,
      attachment.size,
      attachment.uploaded_by
    );
    return db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid as number) as Attachment;
  },

  delete: (id: number, organizationId: number): boolean => {
    const stmt = db.prepare(`
      DELETE FROM attachments
      WHERE id = ? AND ticket_id IN (SELECT id FROM tickets WHERE organization_id = ?)
    `);
    const result = stmt.run(id, organizationId);
    return result.changes > 0;
  },
};

// ===== ANALYTICS & DASHBOARD =====
export const analyticsQueries = {
  // Real-time KPIs
  // TODO: Schema update required - add organization_id to tickets table
  getRealTimeKPIs: (organizationId: number) => {
    return db.prepare(`
      SELECT
        -- Ticket Volume
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND date(created_at) = date('now')) as tickets_today,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND datetime(created_at) >= datetime('now', '-7 days')) as tickets_this_week,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND datetime(created_at) >= datetime('now', '-30 days')) as tickets_this_month,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ?) as total_tickets,

        -- SLA Metrics (JOIN with tickets for organization filter)
        (SELECT COUNT(*) FROM sla_tracking st INNER JOIN tickets t ON st.ticket_id = t.id WHERE t.organization_id = ? AND st.response_met = 1) as sla_response_met,
        (SELECT COUNT(*) FROM sla_tracking st INNER JOIN tickets t ON st.ticket_id = t.id WHERE t.organization_id = ? AND st.resolution_met = 1) as sla_resolution_met,
        (SELECT COUNT(*) FROM sla_tracking st INNER JOIN tickets t ON st.ticket_id = t.id WHERE t.organization_id = ?) as total_sla_tracked,
        (SELECT ROUND(AVG(st.response_time_minutes), 2) FROM sla_tracking st INNER JOIN tickets t ON st.ticket_id = t.id WHERE t.organization_id = ? AND st.response_met = 1) as avg_response_time,
        (SELECT ROUND(AVG(st.resolution_time_minutes), 2) FROM sla_tracking st INNER JOIN tickets t ON st.ticket_id = t.id WHERE t.organization_id = ? AND st.resolution_met = 1) as avg_resolution_time,

        -- First Call Resolution (FCR)
        (SELECT
          ROUND(
            CAST(COUNT(CASE WHEN comments_count <= 1 AND status_final = 1 THEN 1 END) AS FLOAT) /
            CAST(COUNT(*) AS FLOAT) * 100, 2
          )
          FROM (
            SELECT t.id,
              (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id AND user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))) as comments_count,
              s.is_final as status_final
            FROM tickets t
            LEFT JOIN statuses s ON t.status_id = s.id
            WHERE t.organization_id = ? AND s.is_final = 1
          )
        ) as fcr_rate,

        -- Customer Satisfaction (CSAT) (JOIN with tickets for organization filter)
        (SELECT ROUND(AVG(ss.rating), 2) FROM satisfaction_surveys ss INNER JOIN tickets t ON ss.ticket_id = t.id WHERE t.organization_id = ? AND datetime(ss.created_at) >= datetime('now', '-30 days')) as csat_score,
        (SELECT COUNT(*) FROM satisfaction_surveys ss INNER JOIN tickets t ON ss.ticket_id = t.id WHERE t.organization_id = ? AND datetime(ss.created_at) >= datetime('now', '-30 days')) as csat_responses,

        -- Agent Performance
        (SELECT COUNT(DISTINCT assigned_to) FROM tickets WHERE organization_id = ? AND assigned_to IS NOT NULL) as active_agents,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND status_id IN (SELECT id FROM statuses WHERE is_final = 0)) as open_tickets,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND datetime(created_at) >= datetime('now', '-1 day') AND status_id IN (SELECT id FROM statuses WHERE is_final = 1)) as resolved_today
    `).get(organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId) as any;
  },

  // SLA Performance Analytics
  getSLAAnalytics: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
      SELECT
        date(t.created_at) as date,
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
      WHERE t.organization_id = ? AND datetime(t.created_at) >= ${periodFilter}
      GROUP BY date(t.created_at)
      ORDER BY date(t.created_at)
    `).all(organizationId);
  },

  // Agent Performance Analytics
  getAgentPerformance: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
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
      LEFT JOIN tickets t ON u.id = t.assigned_to AND t.organization_id = ? AND datetime(t.created_at) >= ${periodFilter}
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(t.id) > 0
      ORDER BY resolved_tickets DESC
    `).all(organizationId);
  },

  // Category Performance Analytics
  getCategoryAnalytics: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
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
      LEFT JOIN tickets t ON c.id = t.category_id AND t.organization_id = ? AND datetime(t.created_at) >= ${periodFilter}
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
      GROUP BY c.id, c.name, c.color
      HAVING COUNT(t.id) > 0
      ORDER BY total_tickets DESC
    `).all(organizationId);
  },

  // Priority Distribution Analytics
  getPriorityDistribution: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
      SELECT
        p.id,
        p.name,
        p.level,
        p.color,
        COUNT(t.id) as ticket_count,
        ROUND(
          CAST(COUNT(t.id) AS FLOAT) /
          CAST((SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND datetime(created_at) >= ${periodFilter}) AS FLOAT) * 100, 2
        ) as percentage
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id AND t.organization_id = ? AND datetime(t.created_at) >= ${periodFilter}
      GROUP BY p.id, p.name, p.level, p.color
      ORDER BY p.level DESC
    `).all(organizationId, organizationId);
  },

  // Ticket Volume Trends
  getTicketVolumeTrends: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as created,
        COUNT(CASE WHEN status_id IN (SELECT id FROM statuses WHERE is_final = 1) THEN 1 END) as resolved,
        COUNT(CASE WHEN priority_id IN (SELECT id FROM priorities WHERE level >= 3) THEN 1 END) as high_priority
      FROM tickets
      WHERE organization_id = ? AND datetime(created_at) >= ${periodFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at)
    `).all(organizationId);
  },

  // Response Time Analytics
  getResponseTimeAnalytics: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
      SELECT
        date(t.created_at) as date,
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
      WHERE t.organization_id = ? AND datetime(t.created_at) >= ${periodFilter} AND st.response_time_minutes IS NOT NULL
      GROUP BY date(t.created_at)
      ORDER BY date(t.created_at)
    `).all(organizationId);
  },

  // Customer Satisfaction Trends
  getSatisfactionTrends: (organizationId: number, period: 'week' | 'month' | 'quarter' = 'month') => {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    return db.prepare(`
      SELECT
        date(ss.created_at) as date,
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
      WHERE t.organization_id = ? AND datetime(ss.created_at) >= ${periodFilter}
      GROUP BY date(ss.created_at)
      ORDER BY date(ss.created_at)
    `).all(organizationId);
  },

  // Comparative Analytics (Department/Period)
  getComparativeAnalytics: (organizationId: number, compareBy: 'category' | 'agent' | 'priority', periods: string[]) => {
    if (compareBy === 'category') {
      return db.prepare(`
        SELECT
          c.name as label,
          c.color,
          period.name as period,
          COUNT(t.id) as value,
          'tickets' as metric
        FROM categories c
        CROSS JOIN (
          SELECT 'Current' as name, datetime('now', '-30 days') as start_date
          UNION ALL
          SELECT 'Previous' as name, datetime('now', '-60 days') as start_date
        ) period
        LEFT JOIN tickets t ON c.id = t.category_id
          AND t.organization_id = ?
          AND datetime(t.created_at) >= period.start_date
          AND datetime(t.created_at) < CASE
            WHEN period.name = 'Current' THEN datetime('now')
            ELSE datetime('now', '-30 days')
          END
        GROUP BY c.id, c.name, c.color, period.name
        ORDER BY c.name, period.name
      `).all(organizationId);
    }
    // Add more comparative queries as needed
    return [];
  },

  // Anomaly Detection Data
  getAnomalyDetectionData: (organizationId: number) => {
    return db.prepare(`
      WITH daily_metrics AS (
        SELECT
          date(created_at) as date,
          COUNT(*) as ticket_count,
          COUNT(CASE WHEN priority_id IN (SELECT id FROM priorities WHERE level >= 3) THEN 1 END) as high_priority_count
        FROM tickets
        WHERE organization_id = ? AND datetime(created_at) >= datetime('now', '-30 days')
        GROUP BY date(created_at)
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
    `).all(organizationId);
  },

  // Knowledge Base Analytics
  // TODO: Schema update required - add organization_id to kb_articles table
  getKnowledgeBaseAnalytics: (organizationId: number) => {
    return db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM kb_articles WHERE organization_id = ? AND status = 'published') as published_articles,
        (SELECT SUM(view_count) FROM kb_articles WHERE organization_id = ? AND status = 'published') as total_views,
        (SELECT ROUND(AVG(helpful_votes * 1.0 / (helpful_votes + not_helpful_votes)), 2)
         FROM kb_articles
         WHERE organization_id = ? AND status = 'published' AND (helpful_votes + not_helpful_votes) > 0
        ) as avg_helpfulness,
        (
          SELECT json_group_array(
            json_object(
              'title', title,
              'view_count', view_count,
              'helpfulness', ROUND(helpful_votes * 1.0 / (helpful_votes + not_helpful_votes), 2)
            )
          )
          FROM (
            SELECT title, view_count, helpful_votes, not_helpful_votes
            FROM kb_articles
            WHERE organization_id = ? AND status = 'published'
            ORDER BY view_count DESC
            LIMIT 10
          )
        ) as top_articles
    `).get(organizationId, organizationId, organizationId, organizationId);
  }
};

// ===== SLA TRACKING =====
export const slaQueries = {
  getBySLAPolicy: (policyId: number, organizationId: number) => {
    return db.prepare(`
      SELECT st.*, t.title, t.created_at as ticket_created_at, sp.name as policy_name
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN sla_policies sp ON st.sla_policy_id = sp.id
      WHERE st.sla_policy_id = ? AND t.organization_id = ?
      ORDER BY st.created_at DESC
    `).all(policyId, organizationId);
  },

  getBreachedSLAs: (organizationId: number) => {
    return db.prepare(`
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
    `).all(organizationId);
  },

  getUpcomingSLABreaches: (organizationId: number) => {
    return db.prepare(`
      SELECT
        st.*,
        t.title,
        t.id as ticket_id,
        u.name as user_name,
        a.name as agent_name,
        sp.name as policy_name,
        ROUND((julianday(st.response_due_at) - julianday('now')) * 24 * 60) as minutes_until_response_breach,
        ROUND((julianday(st.resolution_due_at) - julianday('now')) * 24 * 60) as minutes_until_resolution_breach
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN sla_policies sp ON st.sla_policy_id = sp.id
      WHERE t.organization_id = ?
        AND ((st.response_due_at BETWEEN CURRENT_TIMESTAMP AND datetime('now', '+2 hours') AND st.response_met = 0)
         OR (st.resolution_due_at BETWEEN CURRENT_TIMESTAMP AND datetime('now', '+4 hours') AND st.resolution_met = 0))
        AND t.status_id NOT IN (SELECT id FROM statuses WHERE is_final = 1)
      ORDER BY st.response_due_at ASC, st.resolution_due_at ASC
    `).all(organizationId);
  }
};

// ===== DASHBOARD WIDGETS =====
export const dashboardQueries = {
  getWidgetData: (widgetType: string, organizationId: number, config: any = {}) => {
    switch (widgetType) {
      case 'kpi_summary':
        return analyticsQueries.getRealTimeKPIs(organizationId);

      case 'sla_performance':
        return analyticsQueries.getSLAAnalytics(organizationId, config.period || 'month');

      case 'agent_performance':
        return analyticsQueries.getAgentPerformance(organizationId, config.period || 'month');

      case 'category_distribution':
        return analyticsQueries.getCategoryAnalytics(organizationId, config.period || 'month');

      case 'priority_distribution':
        return analyticsQueries.getPriorityDistribution(organizationId, config.period || 'month');

      case 'volume_trends':
        return analyticsQueries.getTicketVolumeTrends(organizationId, config.period || 'month');

      case 'response_time_trends':
        return analyticsQueries.getResponseTimeAnalytics(organizationId, config.period || 'month');

      case 'satisfaction_trends':
        return analyticsQueries.getSatisfactionTrends(organizationId, config.period || 'month');

      case 'sla_breaches':
        return slaQueries.getBreachedSLAs(organizationId);

      case 'upcoming_breaches':
        return slaQueries.getUpcomingSLABreaches(organizationId);

      case 'anomaly_detection':
        return analyticsQueries.getAnomalyDetectionData(organizationId);

      case 'knowledge_base_stats':
        return analyticsQueries.getKnowledgeBaseAnalytics(organizationId);

      default:
        return null;
    }
  },

  saveCustomDashboard: (userId: number, dashboardConfig: any) => {
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value, description, type, updated_by)
      VALUES (?, ?, ?, 'json', ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(
      `dashboard_config_user_${userId}`,
      JSON.stringify(dashboardConfig),
      `Custom dashboard configuration for user ${userId}`,
      userId
    );
  },

  getUserDashboard: (userId: number) => {
    const result = db.prepare(`
      SELECT value
      FROM system_settings
      WHERE key = ?
    `).get(`dashboard_config_user_${userId}`) as { value: string } | undefined;

    return result ? JSON.parse(result.value) : null;
  },

  getGlobalDashboard: () => {
    const result = db.prepare(`
      SELECT value
      FROM system_settings
      WHERE key = 'dashboard_config_global'
    `).get() as { value: string } | undefined;

    return result ? JSON.parse(result.value) : null;
  }
};

