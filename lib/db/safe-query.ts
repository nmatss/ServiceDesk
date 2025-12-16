/**
 * SQL Injection Protection Layer
 *
 * Provides safe query builders with:
 * - Column/table name allowlisting
 * - Parameterized queries enforcement
 * - Input validation and sanitization
 * - Type-safe query construction
 */

import db from './connection';
import logger from '../monitoring/structured-logger';

// ============================================
// COLUMN AND TABLE ALLOWLISTS
// ============================================

/**
 * Allowed table names - ONLY these tables can be queried dynamically
 */
const ALLOWED_TABLES = new Set([
  'users',
  'tickets',
  'comments',
  'attachments',
  'categories',
  'priorities',
  'statuses',
  'organizations',
  'teams',
  'team_members',
  'notifications',
  'notification_events',
  'sla_policies',
  'sla_tracking',
  'kb_articles',
  'kb_categories',
  'kb_tags',
  'kb_article_tags',
  'analytics_daily_metrics',
  'analytics_agent_metrics',
  'audit_logs',
  'user_sessions',
  'automations',
  'workflows',
  'workflow_executions',
  'refresh_tokens',
  'login_attempts',
  'password_history',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
]);

/**
 * Allowed column names per table
 */
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  users: new Set([
    'id', 'name', 'email', 'role', 'organization_id', 'tenant_id',
    'is_active', 'created_at', 'updated_at', 'last_login_at',
    'job_title', 'department', 'phone', 'avatar_url'
  ]),
  tickets: new Set([
    'id', 'title', 'description', 'status_id', 'priority_id',
    'category_id', 'user_id', 'assigned_to', 'organization_id',
    'tenant_id', 'created_at', 'updated_at', 'resolved_at',
    'sla_deadline', 'tags', 'custom_fields'
  ]),
  comments: new Set([
    'id', 'ticket_id', 'user_id', 'content', 'is_internal',
    'created_at', 'updated_at'
  ]),
  categories: new Set(['id', 'name', 'description', 'color', 'icon']),
  priorities: new Set(['id', 'name', 'description', 'color', 'level']),
  statuses: new Set(['id', 'name', 'description', 'color', 'is_closed']),
  organizations: new Set(['id', 'name', 'slug', 'settings', 'is_active']),
  kb_articles: new Set([
    'id', 'title', 'content', 'slug', 'category_id',
    'author_id', 'views', 'helpful_count', 'is_published',
    'created_at', 'updated_at'
  ]),
};

/**
 * Allowed sort directions
 */
const ALLOWED_SORT_DIRECTIONS = new Set(['ASC', 'DESC', 'asc', 'desc']);

/**
 * Allowed operators for WHERE clauses
 */
const ALLOWED_OPERATORS = new Set([
  '=', '!=', '<>', '>', '<', '>=', '<=',
  'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
  'IS NULL', 'IS NOT NULL',
  'BETWEEN'
]);

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate table name against allowlist
 */
export function isValidTable(table: string): boolean {
  return ALLOWED_TABLES.has(table);
}

/**
 * Validate column name against table's allowlist
 */
export function isValidColumn(table: string, column: string): boolean {
  const allowedColumns = ALLOWED_COLUMNS[table];
  if (!allowedColumns) {
    return false;
  }
  return allowedColumns.has(column);
}

/**
 * Validate sort direction
 */
export function isValidSortDirection(direction: string): boolean {
  return ALLOWED_SORT_DIRECTIONS.has(direction.toUpperCase());
}

/**
 * Validate SQL operator
 */
export function isValidOperator(operator: string): boolean {
  return ALLOWED_OPERATORS.has(operator.toUpperCase());
}

/**
 * Sanitize table name - throws if invalid
 */
export function sanitizeTableName(table: string): string {
  if (!isValidTable(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return table;
}

/**
 * Sanitize column name - throws if invalid
 */
export function sanitizeColumnName(table: string, column: string): string {
  if (!isValidColumn(table, column)) {
    throw new Error(`Invalid column name: ${column} for table ${table}`);
  }
  return column;
}

/**
 * Sanitize sort direction - throws if invalid
 */
export function sanitizeSortDirection(direction: string): 'ASC' | 'DESC' {
  const upper = direction.toUpperCase();
  if (!isValidSortDirection(upper)) {
    throw new Error(`Invalid sort direction: ${direction}`);
  }
  return upper as 'ASC' | 'DESC';
}

// ============================================
// SAFE QUERY BUILDER
// ============================================

export interface WhereCondition {
  column: string;
  operator: string;
  value: any;
}

export interface QueryOptions {
  table: string;
  columns?: string[];
  where?: WhereCondition[];
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

/**
 * Build a safe SELECT query with parameterized values
 */
export function buildSafeSelectQuery(options: QueryOptions): {
  sql: string;
  params: any[];
} {
  const { table, columns, where, orderBy, orderDirection, limit, offset } = options;

  // Validate table
  const safeTable = sanitizeTableName(table);

  // Build SELECT clause
  let selectClause = '*';
  if (columns && columns.length > 0) {
    // Validate each column
    const safeColumns = columns.map(col => sanitizeColumnName(safeTable, col));
    selectClause = safeColumns.join(', ');
  }

  let sql = `SELECT ${selectClause} FROM ${safeTable}`;
  const params: any[] = [];

  // Build WHERE clause
  if (where && where.length > 0) {
    const whereClauses: string[] = [];

    for (const condition of where) {
      // Validate column
      const safeColumn = sanitizeColumnName(safeTable, condition.column);

      // Validate operator
      const upperOperator = condition.operator.toUpperCase();
      if (!isValidOperator(upperOperator)) {
        throw new Error(`Invalid operator: ${condition.operator}`);
      }

      // Build condition based on operator
      if (upperOperator === 'IS NULL' || upperOperator === 'IS NOT NULL') {
        whereClauses.push(`${safeColumn} ${upperOperator}`);
      } else if (upperOperator === 'IN' || upperOperator === 'NOT IN') {
        if (!Array.isArray(condition.value)) {
          throw new Error(`${upperOperator} requires an array value`);
        }
        const placeholders = condition.value.map(() => '?').join(', ');
        whereClauses.push(`${safeColumn} ${upperOperator} (${placeholders})`);
        params.push(...condition.value);
      } else if (upperOperator === 'BETWEEN') {
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          throw new Error('BETWEEN requires an array with exactly 2 values');
        }
        whereClauses.push(`${safeColumn} BETWEEN ? AND ?`);
        params.push(condition.value[0], condition.value[1]);
      } else {
        whereClauses.push(`${safeColumn} ${upperOperator} ?`);
        params.push(condition.value);
      }
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
  }

  // Build ORDER BY clause
  if (orderBy) {
    const safeOrderColumn = sanitizeColumnName(safeTable, orderBy);
    const safeDirection = orderDirection ? sanitizeSortDirection(orderDirection) : 'ASC';
    sql += ` ORDER BY ${safeOrderColumn} ${safeDirection}`;
  }

  // Build LIMIT clause
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('LIMIT must be a non-negative integer');
    }
    sql += ` LIMIT ${limit}`;
  }

  // Build OFFSET clause
  if (offset !== undefined) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('OFFSET must be a non-negative integer');
    }
    sql += ` OFFSET ${offset}`;
  }

  return { sql, params };
}

/**
 * Execute a safe SELECT query
 */
export function executeSafeSelect<T = any>(options: QueryOptions): T[] {
  const { sql, params } = buildSafeSelectQuery(options);

  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  } catch (error) {
    logger.error('Safe SELECT query failed', { sql, error });
    throw new Error('Database query failed');
  }
}

/**
 * Execute a safe SELECT query (single row)
 */
export function executeSafeSelectOne<T = any>(options: QueryOptions): T | null {
  const { sql, params } = buildSafeSelectQuery(options);

  try {
    const stmt = db.prepare(sql);
    const result = stmt.get(...params) as T | undefined;
    return result || null;
  } catch (error) {
    logger.error('Safe SELECT query failed', { sql, error });
    throw new Error('Database query failed');
  }
}

/**
 * Build a safe UPDATE query
 */
export function buildSafeUpdateQuery(
  table: string,
  updates: Record<string, any>,
  where: WhereCondition[]
): { sql: string; params: any[] } {
  const safeTable = sanitizeTableName(table);

  // Validate and build SET clause
  const setClauses: string[] = [];
  const params: any[] = [];

  for (const [column, value] of Object.entries(updates)) {
    const safeColumn = sanitizeColumnName(safeTable, column);
    setClauses.push(`${safeColumn} = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) {
    throw new Error('UPDATE requires at least one column to update');
  }

  let sql = `UPDATE ${safeTable} SET ${setClauses.join(', ')}`;

  // Build WHERE clause (required for UPDATE)
  if (!where || where.length === 0) {
    throw new Error('UPDATE requires WHERE clause for safety');
  }

  const whereClauses: string[] = [];
  for (const condition of where) {
    const safeColumn = sanitizeColumnName(safeTable, condition.column);
    const upperOperator = condition.operator.toUpperCase();

    if (!isValidOperator(upperOperator)) {
      throw new Error(`Invalid operator: ${condition.operator}`);
    }

    whereClauses.push(`${safeColumn} ${upperOperator} ?`);
    params.push(condition.value);
  }

  sql += ' WHERE ' + whereClauses.join(' AND ');

  return { sql, params };
}

/**
 * Execute a safe UPDATE query
 */
export function executeSafeUpdate(
  table: string,
  updates: Record<string, any>,
  where: WhereCondition[]
): number {
  const { sql, params } = buildSafeUpdateQuery(table, updates, where);

  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  } catch (error) {
    logger.error('Safe UPDATE query failed', { sql, error });
    throw new Error('Database update failed');
  }
}

/**
 * Build a safe DELETE query
 */
export function buildSafeDeleteQuery(
  table: string,
  where: WhereCondition[]
): { sql: string; params: any[] } {
  const safeTable = sanitizeTableName(table);

  // Build WHERE clause (required for DELETE)
  if (!where || where.length === 0) {
    throw new Error('DELETE requires WHERE clause for safety');
  }

  let sql = `DELETE FROM ${safeTable}`;
  const params: any[] = [];
  const whereClauses: string[] = [];

  for (const condition of where) {
    const safeColumn = sanitizeColumnName(safeTable, condition.column);
    const upperOperator = condition.operator.toUpperCase();

    if (!isValidOperator(upperOperator)) {
      throw new Error(`Invalid operator: ${condition.operator}`);
    }

    whereClauses.push(`${safeColumn} ${upperOperator} ?`);
    params.push(condition.value);
  }

  sql += ' WHERE ' + whereClauses.join(' AND ');

  return { sql, params };
}

/**
 * Execute a safe DELETE query
 */
export function executeSafeDelete(table: string, where: WhereCondition[]): number {
  const { sql, params } = buildSafeDeleteQuery(table, where);

  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  } catch (error) {
    logger.error('Safe DELETE query failed', { sql, error });
    throw new Error('Database delete failed');
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Escape LIKE pattern special characters
 */
export function escapeLikePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Build a safe LIKE pattern
 */
export function buildLikePattern(search: string, position: 'start' | 'end' | 'contains' = 'contains'): string {
  const escaped = escapeLikePattern(search);

  switch (position) {
    case 'start':
      return `${escaped}%`;
    case 'end':
      return `%${escaped}`;
    case 'contains':
    default:
      return `%${escaped}%`;
  }
}

/**
 * Validate integer ID
 */
export function validateId(id: any, fieldName: string = 'id'): number {
  const numId = Number(id);

  if (!Number.isInteger(numId) || numId <= 0) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer`);
  }

  return numId;
}

/**
 * Validate limit/offset parameters
 */
export function validatePagination(limit?: any, offset?: any): {
  limit: number;
  offset: number;
} {
  const safeLimit = limit !== undefined ? Number(limit) : 50;
  const safeOffset = offset !== undefined ? Number(offset) : 0;

  if (!Number.isInteger(safeLimit) || safeLimit < 1 || safeLimit > 1000) {
    throw new Error('Limit must be between 1 and 1000');
  }

  if (!Number.isInteger(safeOffset) || safeOffset < 0) {
    throw new Error('Offset must be non-negative');
  }

  return { limit: safeLimit, offset: safeOffset };
}
