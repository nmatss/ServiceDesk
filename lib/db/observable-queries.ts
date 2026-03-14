/**
 * Observable Database Queries
 *
 * Wrapper around database queries with automatic observability:
 * - Performance tracking
 * - Error capture
 * - Distributed tracing
 * - Slow query detection
 */

import { executeQuery, executeQueryOne, executeRun, executeTransaction, type SqlParam } from '@/lib/db/adapter';
import { trackDatabaseQuery } from '../monitoring/observability';

// ========================
// TYPE DEFINITIONS
// ========================

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
  async all<T = any>(
    query: string,
    params: SqlParam[] = [],
    options: QueryOptions
  ): Promise<T[]> {
    return trackDatabaseQuery(
      query,
      async () => {
        return await executeQuery<T>(query, params);
      },
      options
    );
  },

  /**
   * Execute query and return first row
   */
  async get<T = any>(
    query: string,
    params: SqlParam[] = [],
    options: QueryOptions
  ): Promise<T | undefined> {
    return trackDatabaseQuery(
      query,
      async () => {
        return await executeQueryOne<T>(query, params);
      },
      options
    );
  },

  /**
   * Execute query and return run result (for INSERT/UPDATE/DELETE)
   */
  async run(
    query: string,
    params: SqlParam[] = [],
    options: QueryOptions
  ): Promise<{ lastInsertRowid: number; changes: number }> {
    return trackDatabaseQuery(
      query,
      async () => {
        const result = await executeRun(query, params);
        return {
          lastInsertRowid: Number(result.lastInsertRowid || 0),
          changes: result.changes,
        };
      },
      options
    );
  },

  /**
   * Execute query within a transaction
   */
  async transaction<T>(
    operation: string,
    fn: (tx: { executeQuery: typeof executeQuery; executeQueryOne: typeof executeQueryOne; executeRun: typeof executeRun }) => Promise<T>
  ): Promise<T> {
    return trackDatabaseQuery(
      'BEGIN TRANSACTION',
      async () => {
        return await executeTransaction(async (_db) => {
          // Within executeTransaction, the adapter handles transaction scoping.
          // We pass the global adapter functions since they operate within the active transaction.
          return await fn({
            executeQuery,
            executeQueryOne,
            executeRun,
          });
        });
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
    where?: Record<string, unknown>;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }
): Promise<T[]> {
  let query = `SELECT * FROM ${table}`;
  const params: SqlParam[] = [];

  // Build WHERE clause
  if (filters?.where) {
    const conditions = Object.entries(filters.where).map(([key, value]) => {
      params.push(value as SqlParam);
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
  data: any
): Promise<number> {
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data) as SqlParam[];

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
  data: any
): Promise<number> {
  const columns = Object.keys(data);
  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const values = [...Object.values(data) as SqlParam[], id];

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
  where?: Record<string, unknown>
): Promise<number> {
  let query = `SELECT COUNT(*) as count FROM ${table}`;
  const params: SqlParam[] = [];

  if (where) {
    const conditions = Object.entries(where).map(([key, value]) => {
      params.push(value as SqlParam);
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
  records: Record<string, unknown>[]
): Promise<number[]> {
  if (records.length === 0) return [];

  const firstRecord = records[0];
  if (!firstRecord) return [];

  const columns = Object.keys(firstRecord);
  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  return observableQuery.transaction(
    `${table}.batchInsert`,
    async (tx) => {
      const ids: number[] = [];
      for (const record of records) {
        const values = columns.map((col) => record[col]) as SqlParam[];
        const result = await tx.executeRun(insertSql, values);
        ids.push(Number(result.lastInsertRowid || 0));
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
  updates: Array<{ id: number; data: any }>
): Promise<number> {
  if (updates.length === 0) return 0;

  return observableQuery.transaction(
    `${table}.batchUpdate`,
    async (tx) => {
      let totalChanges = 0;

      for (const upd of updates) {
        const columns = Object.keys(upd.data);
        const setClause = columns.map((col) => `${col} = ?`).join(', ');
        const values = [...Object.values(upd.data) as SqlParam[], upd.id];

        const result = await tx.executeRun(
          `UPDATE ${table} SET ${setClause} WHERE id = ?`,
          values
        );
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
