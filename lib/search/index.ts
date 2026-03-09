import { executeQuery, executeQueryOne, executeRun, sqlDateSub, sqlDatetimeAddMinutes, sqlDatetimeSubHours } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { TicketWithDetails, KnowledgeArticleWithDetails, User } from '../types/database';
import logger from '../monitoring/structured-logger';

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
 * Busca avancada de tickets
 */
export async function searchTickets(filters: SearchFilters = {}): Promise<SearchResults<TicketWithDetails>> {
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

    const allowedSortBy = ['created_at', 'updated_at', 'priority', 'status', 'title'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    let whereConditions: string[] = [];
    let params: any[] = [];
    let joins: string[] = [];

    // Busca por texto
    if (query.trim()) {
      const escapedQuery = query.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
      whereConditions.push(`(
        t.title LIKE ? ESCAPE '\\' OR
        t.description LIKE ? ESCAPE '\\' OR
        EXISTS (
          SELECT 1 FROM comments c
          WHERE c.ticket_id = t.id AND c.content LIKE ? ESCAPE '\\'
        )
      )`);
      const searchTerm = `%${escapedQuery}%`;
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

    // Filtros por agente responsavel
    if (assignedTo.length > 0) {
      const placeholders = assignedTo.map(() => '?').join(',');
      whereConditions.push(`t.assigned_to IN (${placeholders})`);
      params.push(...assignedTo);
    }

    // Filtros por usuario criador
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
            (st.response_due_at > CURRENT_TIMESTAMP AND st.response_due_at <= ${sqlDatetimeAddMinutes(30)}) OR
            (st.resolution_due_at > CURRENT_TIMESTAMP AND st.resolution_due_at <= ${sqlDatetimeSubHours(-2)})
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
      ORDER BY t.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    const tickets = await executeQuery<TicketWithDetails>(mainQuery, [...params, limit, offset]);

    // Contar total
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tickets t
      ${joinClause}
      ${whereClause}
    `;

    const countResult = await executeQueryOne<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;

    // Calcular facets
    const facets = await calculateTicketFacets(filters);

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
export async function searchKnowledgeBase(query: string, options: {
  categoryId?: number;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<SearchResults<KnowledgeArticleWithDetails>> {
  try {
    const {
      categoryId,
      publishedOnly = true,
      limit = 20,
      offset = 0
    } = options;

    let whereConditions: string[] = [];
    let params: any[] = [];

    // Busca por texto (titulo, conteudo, tags)
    if (query.trim()) {
      const escapedQuery = query.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
      whereConditions.push(`(
        ka.title LIKE ? ESCAPE '\\' OR
        ka.content LIKE ? ESCAPE '\\' OR
        ka.summary LIKE ? ESCAPE '\\' OR
        ka.tags LIKE ? ESCAPE '\\'
      )`);
      const searchTerm = `%${escapedQuery}%`;
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

    const articles = await executeQuery<KnowledgeArticleWithDetails>(mainQuery, [...params, limit, offset]);

    // Contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM knowledge_articles ka
      ${whereClause}
    `;

    const countResult = await executeQueryOne<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;

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
 * Busca global (tickets + knowledge base + usuarios)
 */
export async function globalSearch(query: string, options: {
  includeTickets?: boolean;
  includeKnowledge?: boolean;
  includeUsers?: boolean;
  limit?: number;
} = {}): Promise<{
  tickets: TicketWithDetails[];
  articles: KnowledgeArticleWithDetails[];
  users: User[];
  total: number;
}> {
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
      const ticketResults = await searchTickets({ query, limit });
      tickets = ticketResults.items.slice(0, limit);
    }

    // Buscar knowledge base
    if (includeKnowledge) {
      const knowledgeResults = await searchKnowledgeBase(query, { limit });
      articles = knowledgeResults.items.slice(0, limit);
    }

    // Buscar usuarios
    if (includeUsers && query.trim()) {
      const escapedQuery = query.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
      const searchTerm = `%${escapedQuery}%`;
      users = await executeQuery<User>(
        `SELECT *
        FROM users
        WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
        ORDER BY name
        LIMIT ?`,
        [searchTerm, searchTerm, limit]
      );
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
async function calculateTicketFacets(currentFilters: SearchFilters): Promise<SearchFacets> {
  try {
    let baseWhere: string[] = [];
    let baseParams: any[] = [];

    if (currentFilters.query?.trim()) {
      const escapedQuery = currentFilters.query.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');
      baseWhere.push(`(
        t.title LIKE ? ESCAPE '\\' OR
        t.description LIKE ? ESCAPE '\\' OR
        EXISTS (SELECT 1 FROM comments c WHERE c.ticket_id = t.id AND c.content LIKE ? ESCAPE '\\')
      )`);
      const searchTerm = `%${escapedQuery}%`;
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
    const categories = await executeQuery<{ id: number; name: string; count: number }>(`
      SELECT c.id, c.name, COUNT(t.id) as count
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id
      ${baseWhereClause}
      GROUP BY c.id, c.name
      HAVING COUNT(t.id) > 0
      ORDER BY count DESC
    `, baseParams);

    // Prioridades
    const priorities = await executeQuery<{ id: number; name: string; level: number; count: number }>(`
      SELECT p.id, p.name, p.level, COUNT(t.id) as count
      FROM priorities p
      LEFT JOIN tickets t ON p.id = t.priority_id
      ${baseWhereClause}
      GROUP BY p.id, p.name, p.level
      HAVING COUNT(t.id) > 0
      ORDER BY p.level DESC
    `, baseParams);

    // Status
    const statuses = await executeQuery<{ id: number; name: string; count: number }>(`
      SELECT s.id, s.name, COUNT(t.id) as count
      FROM statuses s
      LEFT JOIN tickets t ON s.id = t.status_id
      ${baseWhereClause}
      GROUP BY s.id, s.name
      HAVING COUNT(t.id) > 0
      ORDER BY count DESC
    `, baseParams);

    // Agentes
    const assignedAgents = await executeQuery<{ id: number; name: string; count: number }>(`
      SELECT u.id, u.name, COUNT(t.id) as count
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to
      ${baseWhereClause}
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name
      HAVING COUNT(t.id) > 0
      ORDER BY count DESC
    `, baseParams);

    // Ranges de data - dialect-specific
    const isPostgres = getDatabaseType() === 'postgresql';
    const dateRangeCase = isPostgres
      ? `CASE
          WHEN (t.created_at)::date = CURRENT_DATE THEN 'today'
          WHEN (t.created_at)::date >= CURRENT_DATE - INTERVAL '7 days' THEN 'this_week'
          WHEN (t.created_at)::date >= CURRENT_DATE - INTERVAL '30 days' THEN 'this_month'
          WHEN (t.created_at)::date >= CURRENT_DATE - INTERVAL '90 days' THEN 'last_3_months'
          ELSE 'older'
        END`
      : `CASE
          WHEN DATE(t.created_at) = DATE('now') THEN 'today'
          WHEN DATE(t.created_at) >= DATE('now', '-7 days') THEN 'this_week'
          WHEN DATE(t.created_at) >= DATE('now', '-30 days') THEN 'this_month'
          WHEN DATE(t.created_at) >= DATE('now', '-90 days') THEN 'last_3_months'
          ELSE 'older'
        END`;

    const dateRanges = await executeQuery<{ period: string; count: number }>(`
      SELECT
        ${dateRangeCase} as period,
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
    `, baseParams);

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
 * Salva uma busca do usuario (para historico)
 */
export async function saveSearch(userId: number, query: string, filters: SearchFilters, resultCount: number): Promise<boolean> {
  try {
    await executeRun(`
      INSERT INTO search_history (user_id, query, filters, result_count)
      VALUES (?, ?, ?, ?)
    `, [
      userId,
      query,
      JSON.stringify(filters),
      resultCount
    ]);

    return true;
  } catch (error) {
    logger.error('Error saving search', error);
    return false;
  }
}

/**
 * Busca historico do usuario
 */
export async function getSearchHistory(userId: number, limit: number = 10): Promise<any[]> {
  try {
    return await executeQuery(`
      SELECT query, filters, result_count, created_at
      FROM search_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, limit]);
  } catch (error) {
    logger.error('Error getting search history', error);
    return [];
  }
}

/**
 * Sugestoes de busca baseadas no historico
 */
export async function getSearchSuggestions(userId: number, partialQuery: string, limit: number = 5): Promise<string[]> {
  try {
    if (!partialQuery.trim()) return [];

    const escapedQuery = partialQuery.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const results = await executeQuery<{ query: string }>(`
      SELECT DISTINCT query
      FROM search_history
      WHERE user_id = ? AND query LIKE ? ESCAPE '\\'
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, `%${escapedQuery}%`, limit]);

    return results.map(r => r.query);
  } catch (error) {
    logger.error('Error getting search suggestions', error);
    return [];
  }
}
