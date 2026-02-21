/**
 * PostgreSQL Connection Layer
 *
 * Provides connection pooling and query execution for local/remote PostgreSQL.
 */

import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getPostgresConnectionString } from './config';

export interface PostgresQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

type QueryExecutor = Pool | PoolClient;

function normalizeInsertId(row: any): number | undefined {
  if (!row || typeof row !== 'object') return undefined;

  if (typeof row.id === 'number') return row.id;
  if (typeof row.id === 'string') {
    const parsed = Number(row.id);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

export class PostgresConnection {
  private pool: Pool;
  private connectionString: string;

  constructor(connectionString?: string) {
    this.connectionString = connectionString || getPostgresConnectionString() || '';

    if (!this.connectionString) {
      throw new Error('PostgreSQL connection string not found. Set DATABASE_URL=postgresql://... or PG* variables.');
    }

    this.pool = new Pool({
      connectionString: this.connectionString,
      max: Number(process.env.DB_POOL_MAX || 20),
      min: Number(process.env.DB_POOL_MIN || 2),
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000),
      connectionTimeoutMillis: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT || 5000),
      ssl:
        process.env.NODE_ENV === 'production'
          ? {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
              ca: process.env.DATABASE_CA_CERT || undefined,
            }
          : false,
    });
  }

  private async execute<T = any>(
    sql: string,
    params: any[] | undefined,
    executor?: QueryExecutor
  ): Promise<PostgresQueryResult<T>> {
    const client = executor || this.pool;
    const result = await client.query<T & QueryResultRow>(sql, params || []);

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      command: result.command,
    };
  }

  /**
   * Execute a query and return rows.
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.execute<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute query and return first row.
   */
  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  /**
   * Execute query and return all rows.
   */
  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.query<T>(sql, params);
  }

  /**
   * Execute INSERT/UPDATE/DELETE and return affected rows.
   */
  async run(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    const result = await this.execute(sql, params);
    const firstRow = result.rows[0] as any;

    return {
      changes: result.rowCount,
      lastInsertRowid: normalizeInsertId(firstRow),
    };
  }

  /**
   * Prepare statement compatibility layer.
   */
  prepare(sql: string) {
    return {
      get: async (...params: any[]) => this.get(sql, params),
      all: async (...params: any[]) => this.all(sql, params),
      run: async (...params: any[]) => this.run(sql, params),
    };
  }

  /**
   * Execute transaction.
   */
  async transaction<T>(callback: (db: PostgresConnection) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    const txDb = {
      query: async <R = any>(sql: string, params?: any[]) =>
        (await this.execute<R>(sql, params, client)).rows,
      get: async <R = any>(sql: string, params?: any[]) => {
        const rows = (await this.execute<R>(sql, params, client)).rows;
        return rows[0];
      },
      all: async <R = any>(sql: string, params?: any[]) =>
        (await this.execute<R>(sql, params, client)).rows,
      run: async (sql: string, params?: any[]) => {
        const result = await this.execute(sql, params, client);
        const firstRow = result.rows[0] as any;

        return {
          changes: result.rowCount,
          lastInsertRowid: normalizeInsertId(firstRow),
        };
      },
      prepare: (sql: string) => ({
        get: async (...params: any[]) => {
          const rows = (await this.execute(sql, params, client)).rows;
          return rows[0];
        },
        all: async (...params: any[]) =>
          (await this.execute(sql, params, client)).rows,
        run: async (...params: any[]) => {
          const result = await this.execute(sql, params, client);
          const firstRow = result.rows[0] as any;
          return {
            changes: result.rowCount,
            lastInsertRowid: normalizeInsertId(firstRow),
          };
        },
      }),
    } as unknown as PostgresConnection;

    try {
      await client.query('BEGIN');
      const result = await callback(txDb);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute raw SQL (unsafe).
   */
  async unsafe(sql: string): Promise<any> {
    const result = await this.pool.query(sql);
    return result.rows;
  }

  /**
   * Close connection pool.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Check if connection is alive.
   */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connection info (password masked).
   */
  getConnectionInfo(): { type: string; url: string } {
    const url = this.connectionString.replace(/:[^:@]+@/, ':***@');
    return {
      type: 'postgresql',
      url,
    };
  }
}

let postgresInstance: PostgresConnection | null = null;

export function getPostgresConnection(): PostgresConnection {
  if (!postgresInstance) {
    postgresInstance = new PostgresConnection();
  }
  return postgresInstance;
}

export function createPostgresConnection(connectionString?: string): PostgresConnection {
  return new PostgresConnection(connectionString);
}

export async function closePostgresConnection(): Promise<void> {
  if (postgresInstance) {
    await postgresInstance.close();
    postgresInstance = null;
  }
}

export async function checkPostgresHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    const db = getPostgresConnection();
    const isAlive = await db.ping();
    const latency = Date.now() - startTime;

    if (!isAlive) {
      return { status: 'unhealthy', error: 'Connection failed' };
    }

    return { status: 'healthy', latency };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default PostgresConnection;
