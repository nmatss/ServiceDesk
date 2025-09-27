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
  getAll: (): TicketWithDetails[] => {
    const stmt = db.prepare(`
      SELECT 
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      ORDER BY t.created_at DESC
    `);
    return stmt.all() as TicketWithDetails[];
  },

  getById: (id: number): TicketWithDetails | undefined => {
    const stmt = db.prepare(`
      SELECT 
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.id = ?
    `);
    return stmt.get(id) as TicketWithDetails | undefined;
  },

  getByUserId: (userId: number): TicketWithDetails[] => {
    const stmt = db.prepare(`
      SELECT 
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `);
    return stmt.all(userId) as TicketWithDetails[];
  },

  getByAssignedTo: (assignedTo: number): TicketWithDetails[] => {
    const stmt = db.prepare(`
      SELECT 
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `);
    return stmt.all(assignedTo) as TicketWithDetails[];
  },

  create: (ticket: CreateTicket): Ticket => {
    const stmt = db.prepare(`
      INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      ticket.title, 
      ticket.description, 
      ticket.user_id, 
      ticket.assigned_to || null, 
      ticket.category_id, 
      ticket.priority_id, 
      ticket.status_id
    );
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid as number) as Ticket;
  },

  update: (ticket: UpdateTicket): Ticket | undefined => {
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

    if (fields.length === 0) return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id) as Ticket | undefined;

    values.push(ticket.id);
    const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id) as Ticket | undefined;
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM tickets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// ===== COMMENTS =====
export const commentQueries = {
  getByTicketId: (ticketId: number): any[] => {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `);
    return stmt.all(ticketId) as any[];
  },

  getById: (id: number): any | undefined => {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `);
    return stmt.get(id) as any | undefined;
  },

  create: (comment: CreateComment): Comment => {
    const stmt = db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal) 
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(comment.ticket_id, comment.user_id, comment.content, comment.is_internal ? 1 : 0);
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid as number) as Comment;
  },

  update: (comment: UpdateComment): Comment | undefined => {
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

    if (fields.length === 0) return db.prepare('SELECT * FROM comments WHERE id = ?').get(comment.id) as Comment | undefined;

    values.push(comment.id);
    const stmt = db.prepare(`UPDATE comments SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(comment.id) as Comment | undefined;
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM comments WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

// ===== ATTACHMENTS =====
export const attachmentQueries = {
  getByTicketId: (ticketId: number): Attachment[] => {
    return db.prepare('SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at').all(ticketId) as Attachment[];
  },

  getById: (id: number): Attachment | undefined => {
    return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined;
  },

  create: (attachment: CreateAttachment): Attachment => {
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

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM attachments WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },
};

