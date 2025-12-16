/**
 * PostgreSQL Connection Layer (Neon Serverless)
 *
 * Provides connection pooling and query execution for PostgreSQL
 * Compatible with existing SQLite query interface
 */

import { neon, neonConfig, Pool } from '@neondatabase/serverless';
// Note: getDatabaseType not needed here as this file is PostgreSQL-specific
// import { getDatabaseType } from './config';

// Configure Neon for optimal performance
neonConfig.fetchConnectionCache = true;

export interface PostgresQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

export class PostgresConnection {
  private sql: ReturnType<typeof neon>;
  private pool?: Pool;
  private connectionString: string;

  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.DATABASE_URL || '';

    if (!this.connectionString) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }

    // Create main SQL executor
    this.sql = neon(this.connectionString);

    // Create connection pool for transactions
    this.pool = new Pool({ connectionString: this.connectionString });

    console.log('✓ PostgreSQL connection initialized (Neon Serverless)');
  }

  /**
   * Execute a simple query
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      // Neon SQL expects template strings, so we'll use dynamic SQL execution
      // We use 'any' type assertion because neon doesn't support parameterized queries in the same way
      const result = await (this.sql as any)(sql, params || []);
      return result as T[];
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  }

  /**
   * Execute query and return single row
   */
  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    const results = await this.query<T>(sql, params);
    return results[0];
  }

  /**
   * Execute query and return all rows
   */
  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return await this.query<T>(sql, params);
  }

  /**
   * Execute INSERT/UPDATE/DELETE and return affected rows
   */
  async run(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    try {
      // For INSERT queries, use RETURNING to get the ID
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const modifiedSql = sql.includes('RETURNING') ? sql : `${sql} RETURNING id`;
        const result = await (this.sql as any)(modifiedSql, params || []);

        return {
          changes: Array.isArray(result) ? result.length : 1,
          lastInsertRowid: (Array.isArray(result) && result[0] && 'id' in result[0]) ? result[0].id : undefined
        };
      }

      // For UPDATE/DELETE
      const result = await (this.sql as any)(sql, params || []);
      return {
        changes: Array.isArray(result) ? result.length : 0
      };
    } catch (error) {
      console.error('PostgreSQL run error:', error);
      throw error;
    }
  }

  /**
   * Prepare statement (compatibility layer)
   * PostgreSQL doesn't need explicit preparation in this context
   */
  prepare(sql: string) {
    return {
      get: async (...params: any[]) => this.get(sql, params),
      all: async (...params: any[]) => this.all(sql, params),
      run: async (...params: any[]) => this.run(sql, params)
    };
  }

  /**
   * Execute transaction
   */
  async transaction<T>(callback: (db: PostgresConnection) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(this);
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
   * Execute raw SQL (unsafe - use carefully)
   */
  async unsafe(sql: string): Promise<any> {
    return await this.sql.unsafe(sql);
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  /**
   * Check if connection is alive
   */
  async ping(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): { type: string; url: string } {
    // Hide password in URL
    const url = this.connectionString.replace(/:[^:@]+@/, ':***@');
    return {
      type: 'postgresql',
      url
    };
  }
}

/**
 * Singleton instance
 */
let postgresInstance: PostgresConnection | null = null;

/**
 * Get PostgreSQL connection instance
 */
export function getPostgresConnection(): PostgresConnection {
  if (!postgresInstance) {
    postgresInstance = new PostgresConnection();
  }
  return postgresInstance;
}

/**
 * Create new PostgreSQL connection
 */
export function createPostgresConnection(connectionString?: string): PostgresConnection {
  return new PostgresConnection(connectionString);
}

/**
 * Close global connection
 */
export async function closePostgresConnection(): Promise<void> {
  if (postgresInstance) {
    await postgresInstance.close();
    postgresInstance = null;
  }
}

/**
 * Health check for PostgreSQL
 */
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
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default PostgresConnection;
