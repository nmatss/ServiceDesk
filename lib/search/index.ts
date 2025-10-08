import db from '../db/connection';
import { TicketWithDetails, KnowledgeArticleWithDetails, User } from '../types/database';
import { logger } from '../monitoring/logger';

export interface SearchFilters {
  query?: string;
  categories?: number[];
  priorities?: number[];
  statuses?: number[];
  assignedTo?: number[];
  users?: number[];
  dateFrom?: string;
  dateTo?: string;
  slaStatus?: 'compliant' | 'warning' | 'breach';
  tags?: string[];
  hasAttachments?: boolean;
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'status' | 'title';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface SearchResults<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: { id: number; name: string; count: number }[];
  priorities: { id: number; name: string; level: number; count: number }[];
  statuses: { id: number; name: string; count: number }[];
  assignedAgents: { id: number; name: string; count: number }[];
  dateRanges: { period: string; count: number }[];
}

/**
 * Busca avançada de tickets
 */
export function searchTickets(filters: SearchFilters = {}): SearchResults<TicketWithDetails> {
  try {
    const {
      query = '',
      categories = [],
      priorities = [],
      statuses = [],
      assignedTo = [],
      users = [],
      dateFrom,
      dateTo,
      slaStatus,
      hasAttachments,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = filters;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let joins: string[] = [];

    // Busca por texto
    if (query.trim()) {
      whereConditions.push(`(
        t.title LIKE ? OR
        t.description LIKE ? OR
        EXISTS (
          SELECT 1 FROM comments c
          WHERE c.ticket_id = t.id AND c.content LIKE ?
        )
      )`);
      const searchTerm = `%${query.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filtros por categoria
    if (categories.length > 0) {
      const placeholders = categories.map(() => '?').join(',');
      whereConditions.push(`t.category_id IN (${placeholders})`);
      params.push(...categories);
    }

    // Filtros por prioridade
    if (priorities.length > 0) {
      const placeholders = priorities.map(() => '?').join(',');
      whereConditions.push(`t.priority_id IN (${placeholders})`);
      params.push(...priorities);
    }

    // Filtros por status
    if (statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(',');
      whereConditions.push(`t.status_id IN (${placeholders})`);
      params.push(...statuses);
    }

    // Filtros por agente responsável
    if (assignedTo.length > 0) {
      const placeholders = assignedTo.map(() => '?').join(',');
      whereConditions.push(`t.assigned_to IN (${placeholders})`);
      params.push(...assignedTo);
    }

    // Filtros por usuário criador
    if (users.length > 0) {
      const placeholders = users.map(() => '?').join(',');
      whereConditions.push(`t.user_id IN (${placeholders})`);
      params.push(...users);
    }

    // Filtros por data
    if (dateFrom) {
      whereConditions.push('t.created_at >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push('t.created_at <= ?');
      params.push(dateTo);
    }

    // Filtros por SLA
    if (slaStatus) {
      joins.push('LEFT JOIN sla_tracking st ON t.id = st.ticket_id');

      switch (slaStatus) {
        case 'compliant':
          whereConditions.push('(st.response_met = 1 AND st.resolution_met = 1)');
          break;
        case 'warning':
          whereConditions.push(`(
            (st.response_due_at > CURRENT_TIMESTAMP AND st.response_due_at <= datetime('now', '+30 minutes')) OR
            (st.resolution_due_at > CURRENT_TIMESTAMP AND st.resolution_due_at <= datetime('now', '+2 hours'))
          )`);
          break;
        case 'breach':
          whereConditions.push(`(
            (st.response_due_at <= CURRENT_TIMESTAMP AND st.response_met = 0) OR
            (st.resolution_due_at <= CURRENT_TIMESTAMP AND st.resolution_met = 0)
          )`);
          break;
      }
    }

    // Filtro por anexos
    if (hasAttachments !== undefined) {
      if (hasAttachments) {
        whereConditions.push('EXISTS (SELECT 1 FROM attachments a WHERE a.ticket_id = t.id)');
      } else {
        whereConditions.push('NOT EXISTS (SELECT 1 FROM attachments a WHERE a.ticket_id = t.id)');
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const joinClause = joins.join(' ');

    // Query principal
    const mainQuery = `
      SELECT DISTINCT
        t.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        a.name as assigned_agent_name,
        c.name as category_name,
        c.color as category_color,
        p.name as priority_name,
        p.level as priority_level,
        p.color as priority_color,
        s.name as status_name,
        s.color as status_color,
        s.is_final as status_is_final,
        (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
        (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      ${joinClause}
      ${whereClause}
      ORDER BY t.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const tickets = db.prepare(mainQuery).all(...params, limit, offset) as TicketWithDetails[];

    // Contar total
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tickets t
      ${joinClause}
      ${whereClause}
    `;

    const { total } = db.prepare(countQuery).get(...params) as { total: number };

    // Calcular facets
    const facets = calculateTicketFacets(filters);

    return {
      items: tickets,
      total,
      hasMore: (offset + limit) < total,
      facets
    };
  } catch (error) {
    logger.error('Error searching tickets', error);
    return { items: [], total: 0, hasMore: false, facets: getEmptyFacets() };
  }
}

/**
 * Busca na Knowledge Base
 */
export function searchKnowledgeBase(query: string, options: {
  categoryId?: number;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): SearchResults<KnowledgeArticleWithDetails> {
  try {
    const {
      categoryId,
      publishedOnly = true,
      limit = 20,
      offset = 0
    } = options;

    let whereConditions: string[] = [];
    let params: any[] = [];

    // Busca por texto (título, conteúdo, tags)
    if (query.trim()) {
      whereConditions.push(`(
        ka.title LIKE ? OR
        ka.content LIKE ? OR
        ka.summary LIKE ? OR
        ka.tags LIKE ?
      )`);
      const searchTerm = `%${query.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (publishedOnly) {
      whereConditions.push('ka.is_published = 1');
    }

    if (categoryId) {
      whereConditions.push('ka.category_id = ?');
      params.push(categoryId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const mainQuery = `
      SELECT
        ka.*,
        c.name as category_name,
        c.color as category_color,
        au.name as author_name,
        au.email as author_email,
        rv.name as reviewer_name
      FROM knowledge_articles ka
      LEFT JOIN categories c ON ka.category_id = c.id
      LEFT JOIN users au ON ka.author_id = au.id
      LEFT JOIN users rv ON ka.reviewed_by = rv.id
      ${whereClause}
      ORDER BY ka.helpful_count DESC, ka.view_count DESC, ka.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const articles = db.prepare(mainQuery).all(...params, limit, offset) as KnowledgeArticleWithDetails[];

    // Contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM knowledge_articles ka
      ${whereClause}
    `;

    const { total } = db.prepare(countQuery).get(...params) as { total: number };

    // Para knowledge base, não precisamos de facets complexos
    const emptyFacets = getEmptyFacets();

    return {
      items: articles,
      total,
      hasMore: (offset + limit) < total,
      facets: emptyFacets
    };
  } catch (error) {
    logger.error('Error searching knowledge base', error);
    return { items: [], total: 0, hasMore: false, facets: getEmptyFacets() };
  }
}

/**
 * Busca global (tickets + knowledge base + usuários)
 */
export function globalSearch(query: string, options: {
  includeTickets?: boolean;
  includeKnowledge?: boolean;
  includeUsers?: boolean;
  limit?: number;
} = {}): {
  tickets: TicketWithDetails[];
  articles: KnowledgeArticleWithDetails[];
  users: User[];
  total: number;
} {
  try {
    const {
      includeTickets = true,
      includeKnowledge = true,
      includeUsers = true,
      limit = 10
    } = options;

    let tickets: TicketWithDetails[] = [];
    let articles: KnowledgeArticleWithDetails[] = [];
    let users: User[] = [];

    // Buscar tickets
    if (includeTickets) {
      const ticketResults = searchTickets({ query, limit });
      tickets = ticketResults.items.slice(0, limit);
    }

    // Buscar knowledge base
    if (includeKnowledge) {
      const knowledgeResults = searchKnowledgeBase(query, { limit });
      articles = knowledgeResults.items.slice(0, limit);
    }

    // Buscar usuários
    if (includeUsers && query.trim()) {
      const userQuery = `
        SELECT *
        FROM users
        WHERE name LIKE ? OR email LIKE ?
        ORDER BY name
        LIMIT ?
      `;
      const searchTerm = `%${query.trim()}%`;
      users = db.prepare(userQuery).all(searchTerm, searchTerm, limit) as User[];
    }

    return {
      tickets,
      articles,
      users,
      total: tickets.length + articles.length + users.length
    };
  } catch (error) {
    logger.error('Error in global search', error);
    return { tickets: [], articles: [], users: [], total: 0 };
  }
}

/**
 * Calcula facets para filtros
 */
function calculateTicketFacets(currentFilters: SearchFilters): SearchFacets {
  try {
    // Base query para facets (sem os filtros que estamos calculando)
    let baseWhere: string[] = [];
    let baseParams: any[] = [];

    if (currentFilters.query?.trim()) {
      baseWhere.push(`(
        t.title LIKE ? OR
        t.description LIKE ? OR
        EXISTS (SELECT 1 FROM comments c WHERE c.ticket_id = t.id AND c.content LIKE ?)
      )`);
      const searchTerm = `%${currentFilters.query.trim()}%`;
      baseParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (currentFilters.dateFrom) {
      baseWhere.push('t.created_at >= ?');
      baseParams.push(currentFilters.dateFrom);
    }

    if (currentFilters.dateTo) {
      baseWhere.push('t.created_at <= ?');
      baseParams.push(currentFilters.dateTo);
    }

    const baseWhereClause = baseWhere.length > 0 ? `WHERE ${baseWhere.join(' AND ')}` : '';

    // Categorias
    const categories = db.prepare(`
      SELECT c.id, c.name, COUNT(t.id) as count
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id
      ${baseWhereClause}
      GROUP BY c.id, c.name
      HAVING count > 0
      ORDER BY count DESC
    `).all(...baseParams) as { id: number; name: string; count: number }[];

    // Prioridades
    const priorities = db.prepare(`
      SELECT p.id, p.name, p.level, COUNT(t.id) as count
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id
      ${baseWhereClause}
      GROUP BY p.id, p.name, p.level
      HAVING count > 0
      ORDER BY p.level DESC
    `).all(...baseParams) as { id: number; name: string; level: number; count: number }[];

    // Status
    const statuses = db.prepare(`
      SELECT s.id, s.name, COUNT(t.id) as count
      FROM statuses s
      LEFT JOIN tickets t ON s.id = t.status_id
      ${baseWhereClause}
      GROUP BY s.id, s.name
      HAVING count > 0
      ORDER BY count DESC
    `).all(...baseParams) as { id: number; name: string; count: number }[];

    // Agentes
    const assignedAgents = db.prepare(`
      SELECT u.id, u.name, COUNT(t.id) as count
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to
      ${baseWhereClause}
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name
      HAVING count > 0
      ORDER BY count DESC
    `).all(...baseParams) as { id: number; name: string; count: number }[];

    // Ranges de data
    const dateRanges = db.prepare(`
      SELECT
        CASE
          WHEN DATE(t.created_at) = DATE('now') THEN 'today'
          WHEN DATE(t.created_at) >= DATE('now', '-7 days') THEN 'this_week'
          WHEN DATE(t.created_at) >= DATE('now', '-30 days') THEN 'this_month'
          WHEN DATE(t.created_at) >= DATE('now', '-90 days') THEN 'last_3_months'
          ELSE 'older'
        END as period,
        COUNT(*) as count
      FROM tickets t
      ${baseWhereClause}
      GROUP BY period
      ORDER BY
        CASE period
          WHEN 'today' THEN 1
          WHEN 'this_week' THEN 2
          WHEN 'this_month' THEN 3
          WHEN 'last_3_months' THEN 4
          ELSE 5
        END
    `).all(...baseParams) as { period: string; count: number }[];

    return {
      categories,
      priorities,
      statuses,
      assignedAgents,
      dateRanges
    };
  } catch (error) {
    logger.error('Error calculating facets', error);
    return getEmptyFacets();
  }
}

/**
 * Retorna facets vazios
 */
function getEmptyFacets(): SearchFacets {
  return {
    categories: [],
    priorities: [],
    statuses: [],
    assignedAgents: [],
    dateRanges: []
  };
}

/**
 * Salva uma busca do usuário (para histórico)
 */
export function saveSearch(userId: number, query: string, filters: SearchFilters, resultCount: number): boolean {
  try {
    // Criar tabela de histórico de buscas se não existir
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        query TEXT NOT NULL,
        filters TEXT, -- JSON
        result_count INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at);
    `);

    const insertQuery = db.prepare(`
      INSERT INTO search_history (user_id, query, filters, result_count)
      VALUES (?, ?, ?, ?)
    `);

    const result = insertQuery.run(
      userId,
      query,
      JSON.stringify(filters),
      resultCount
    );

    return result.changes > 0;
  } catch (error) {
    logger.error('Error saving search', error);
    return false;
  }
}

/**
 * Busca histórico do usuário
 */
export function getSearchHistory(userId: number, limit: number = 10): any[] {
  try {
    const query = db.prepare(`
      SELECT query, filters, result_count, created_at
      FROM search_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return query.all(userId, limit) as any[];
  } catch (error) {
    logger.error('Error getting search history', error);
    return [];
  }
}

/**
 * Sugestões de busca baseadas no histórico
 */
export function getSearchSuggestions(userId: number, partialQuery: string, limit: number = 5): string[] {
  try {
    if (!partialQuery.trim()) return [];

    const query = db.prepare(`
      SELECT DISTINCT query
      FROM search_history
      WHERE user_id = ? AND query LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const results = query.all(userId, `%${partialQuery}%`, limit) as { query: string }[];
    return results.map(r => r.query);
  } catch (error) {
    logger.error('Error getting search suggestions', error);
    return [];
  }
}