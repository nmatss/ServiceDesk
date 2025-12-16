/**
 * Observable Database Queries
 *
 * Wrapper around database queries with automatic observability:
 * - Performance tracking
 * - Error capture
 * - Distributed tracing
 * - Slow query detection
 */

import db from './connection';
import { trackDatabaseQuery } from '../monitoring/observability';
import type { Database } from 'better-sqlite3';

// ========================
// TYPE DEFINITIONS
// ========================

// type SQLiteStatement = ReturnType<Database['prepare']>;

export interface QueryOptions {
  queryType: 'select' | 'insert' | 'update' | 'delete' | 'other';
  operation: string;
  table?: string;
  tags?: Record<string, string>;
}

// ========================
// QUERY WRAPPERS
// ========================

/**
 * Execute a SELECT query with observability
 *
 * @example
 * const users = await observableQuery.all(
 *   'SELECT * FROM users WHERE organization_id = ?',
 *   [organizationId],
 *   { queryType: 'select', operation: 'users.findByOrg', table: 'users' }
 * );
 */
export const observableQuery = {
  /**
   * Execute query and return all rows
   */
  all<T = any>(
    query: string,
    params: any[] = [],
    options: QueryOptions
  ): Promise<T[]> {
    return trackDatabaseQuery(
      query,
      () => {
        const stmt = db.prepare(query);
        return stmt.all(...params) as T[];
      },
      options
    );
  },

  /**
   * Execute query and return first row
   */
  get<T = any>(
    query: string,
    params: any[] = [],
    options: QueryOptions
  ): Promise<T | undefined> {
    return trackDatabaseQuery(
      query,
      () => {
        const stmt = db.prepare(query);
        return stmt.get(...params) as T | undefined;
      },
      options
    );
  },

  /**
   * Execute query and return run result (for INSERT/UPDATE/DELETE)
   */
  run(
    query: string,
    params: any[] = [],
    options: QueryOptions
  ): Promise<{ lastInsertRowid: number; changes: number }> {
    return trackDatabaseQuery(
      query,
      () => {
        const stmt = db.prepare(query);
        const result = stmt.run(...params);
        return {
          lastInsertRowid: Number(result.lastInsertRowid),
          changes: result.changes,
        };
      },
      options
    );
  },

  /**
   * Execute query within a transaction
   */
  transaction<T>(
    operation: string,
    fn: (db: Database) => T
  ): Promise<T> {
    return trackDatabaseQuery(
      'BEGIN TRANSACTION',
      () => {
        const transaction = db.transaction(fn);
        return transaction(db);
      },
      {
        queryType: 'other',
        operation: `transaction.${operation}`,
        tags: { type: 'transaction' },
      }
    );
  },
};

// ========================
// COMMON QUERY PATTERNS
// ========================

/**
 * Find by ID with observability
 */
export async function findById<T>(
  table: string,
  id: number,
  options?: { columns?: string[] }
): Promise<T | undefined> {
  const columns = options?.columns?.join(', ') || '*';
  const query = `SELECT ${columns} FROM ${table} WHERE id = ?`;

  return observableQuery.get<T>(
    query,
    [id],
    {
      queryType: 'select',
      operation: `${table}.findById`,
      table,
    }
  );
}

/**
 * Find all with filters
 */
export async function findAll<T>(
  table: string,
  filters?: {
    where?: Record<string, any>;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }
): Promise<T[]> {
  let query = `SELECT * FROM ${table}`;
  const params: any[] = [];

  // Build WHERE clause
  if (filters?.where) {
    const conditions = Object.entries(filters.where).map(([key, value]) => {
      params.push(value);
      return `${key} = ?`;
    });
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
  }

  // Add ORDER BY
  if (filters?.orderBy) {
    query += ` ORDER BY ${filters.orderBy}`;
  }

  // Add LIMIT and OFFSET
  if (filters?.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }
  if (filters?.offset) {
    query += ` OFFSET ?`;
    params.push(filters.offset);
  }

  return observableQuery.all<T>(
    query,
    params,
    {
      queryType: 'select',
      operation: `${table}.findAll`,
      table,
    }
  );
}

/**
 * Insert record with observability
 */
export async function insert(
  table: string,
  data: Record<string, any>
): Promise<number> {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data);

  const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  const result = await observableQuery.run(
    query,
    values,
    {
      queryType: 'insert',
      operation: `${table}.insert`,
      table,
    }
  );

  return result.lastInsertRowid;
}

/**
 * Update record with observability
 */
export async function update(
  table: string,
  id: number,
  data: Record<string, any>
): Promise<number> {
  const columns = Object.keys(data);
  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const values = [...Object.values(data), id];

  const query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;

  const result = await observableQuery.run(
    query,
    values,
    {
      queryType: 'update',
      operation: `${table}.update`,
      table,
    }
  );

  return result.changes;
}

/**
 * Delete record with observability
 */
export async function deleteById(
  table: string,
  id: number
): Promise<number> {
  const query = `DELETE FROM ${table} WHERE id = ?`;

  const result = await observableQuery.run(
    query,
    [id],
    {
      queryType: 'delete',
      operation: `${table}.delete`,
      table,
    }
  );

  return result.changes;
}

/**
 * Count records with observability
 */
export async function count(
  table: string,
  where?: Record<string, any>
): Promise<number> {
  let query = `SELECT COUNT(*) as count FROM ${table}`;
  const params: any[] = [];

  if (where) {
    const conditions = Object.entries(where).map(([key, value]) => {
      params.push(value);
      return `${key} = ?`;
    });
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
  }

  const result = await observableQuery.get<{ count: number }>(
    query,
    params,
    {
      queryType: 'select',
      operation: `${table}.count`,
      table,
    }
  );

  return result?.count || 0;
}

// ========================
// BATCH OPERATIONS
// ========================

/**
 * Batch insert with observability
 */
export async function batchInsert(
  table: string,
  records: Record<string, any>[]
): Promise<number[]> {
  if (records.length === 0) return [];

  const firstRecord = records[0];
  if (!firstRecord) return [];

  const columns = Object.keys(firstRecord);
  const placeholders = columns.map(() => '?').join(', ');

  return observableQuery.transaction(
    `${table}.batchInsert`,
    () => {
      const stmt = db.prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      );

      const ids: number[] = [];
      for (const record of records) {
        const values = columns.map((col) => record[col]);
        const result = stmt.run(...values);
        ids.push(Number(result.lastInsertRowid));
      }

      return ids;
    }
  );
}

/**
 * Batch update with observability
 */
export async function batchUpdate(
  table: string,
  updates: Array<{ id: number; data: Record<string, any> }>
): Promise<number> {
  if (updates.length === 0) return 0;

  return observableQuery.transaction(
    `${table}.batchUpdate`,
    () => {
      let totalChanges = 0;

      for (const update of updates) {
        const columns = Object.keys(update.data);
        const setClause = columns.map((col) => `${col} = ?`).join(', ');
        const values = [...Object.values(update.data), update.id];

        const stmt = db.prepare(
          `UPDATE ${table} SET ${setClause} WHERE id = ?`
        );
        const result = stmt.run(...values);
        totalChanges += result.changes;
      }

      return totalChanges;
    }
  );
}

// ========================
// EXPORTS
// ========================

export default observableQuery;
