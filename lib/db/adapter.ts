/**
 * Unified Database Adapter
 *
 * Provides a consistent interface for both SQLite and PostgreSQL
 * Automatically selects the correct database based on environment
 */

import { getDatabaseType } from './config';
import Database from 'better-sqlite3';
import { PostgresConnection, getPostgresConnection } from './connection.postgres';
import legacyDb from './connection'; // SQLite connection

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface RunResult {
  changes: number;
  lastInsertRowid?: number;
}

/**
 * Unified database interface
 */
export interface DatabaseAdapter {
  // Query methods
  query<T = any>(sql: string, params?: any[]): Promise<T[]> | T[];
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined> | T | undefined;
  all<T = any>(sql: string, params?: any[]): Promise<T[]> | T[];
  run(sql: string, params?: any[]): Promise<RunResult> | RunResult;

  // Prepared statements
  prepare(sql: string): PreparedStatement;

  // Transactions
  transaction<T>(callback: (db: DatabaseAdapter) => T | Promise<T>): Promise<T> | T;

  // Metadata
  getType(): 'sqlite' | 'postgresql';
  isAsync(): boolean;
}

/**
 * Prepared statement interface
 */
export interface PreparedStatement {
  get<T = any>(...params: any[]): Promise<T | undefined> | T | undefined;
  all<T = any>(...params: any[]): Promise<T[]> | T[];
  run(...params: any[]): Promise<RunResult> | RunResult;
}

/**
 * SQLite Adapter (Synchronous)
 */
class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  private executeAll<T = any>(stmt: any, params?: any[]): T[] {
    if (typeof stmt.all === 'function') {
      return (params && params.length > 0 ? stmt.all(...params) : stmt.all()) as T[];
    }

    if (typeof stmt.get === 'function') {
      const row = params && params.length > 0 ? stmt.get(...params) : stmt.get();
      return row == null ? [] : [row as T];
    }

    return [];
  }

  private executeGet<T = any>(stmt: any, params?: any[]): T | undefined {
    if (typeof stmt.get === 'function') {
      return (params && params.length > 0 ? stmt.get(...params) : stmt.get()) as T | undefined;
    }

    if (typeof stmt.all === 'function') {
      const rows = (params && params.length > 0 ? stmt.all(...params) : stmt.all()) as T[];
      return rows[0];
    }

    return undefined;
  }

  private executeRun(stmt: any, params?: any[]): RunResult {
    if (typeof stmt.run !== 'function') {
      return { changes: 0 };
    }

    const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
    return {
      changes: Number(result?.changes ?? 0),
      lastInsertRowid: typeof result?.lastInsertRowid === 'number'
        ? result.lastInsertRowid as number
        : undefined
    };
  }

  query<T = any>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return this.executeAll<T>(stmt, params);
  }

  get<T = any>(sql: string, params?: any[]): T | undefined {
    const stmt = this.db.prepare(sql);
    return this.executeGet<T>(stmt, params);
  }

  all<T = any>(sql: string, params?: any[]): T[] {
    return this.query<T>(sql, params);
  }

  run(sql: string, params?: any[]): RunResult {
    const stmt = this.db.prepare(sql);
    return this.executeRun(stmt, params);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      get: <T = any>(...params: any[]) => this.executeGet<T>(stmt, params),
      all: <T = any>(...params: any[]) => this.executeAll<T>(stmt, params),
      run: (...params: any[]) => this.executeRun(stmt, params)
    };
  }

  transaction<T>(callback: (db: DatabaseAdapter) => T): T {
    return this.db.transaction(() => callback(this))();
  }

  getType(): 'sqlite' {
    return 'sqlite';
  }

  isAsync(): boolean {
    return false;
  }
}

/**
 * PostgreSQL Adapter (Asynchronous)
 */
class PostgreSQLAdapter implements DatabaseAdapter {
  private db: PostgresConnection;

  constructor(db: PostgresConnection) {
    this.db = db;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Convert SQLite placeholders (?) to PostgreSQL ($1, $2, etc)
    const convertedSql = this.convertPlaceholders(sql);
    return await this.db.query<T>(convertedSql, params);
  }

  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    const convertedSql = this.convertPlaceholders(sql);
    return await this.db.get<T>(convertedSql, params);
  }

  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return await this.query<T>(sql, params);
  }

  async run(sql: string, params?: any[]): Promise<RunResult> {
    const convertedSql = this.convertPlaceholders(sql);
    return await this.db.run(convertedSql, params);
  }

  prepare(sql: string): PreparedStatement {
    const convertedSql = this.convertPlaceholders(sql);
    return {
      get: async <T = any>(...params: any[]) => await this.db.get<T>(convertedSql, params),
      all: async <T = any>(...params: any[]) => await this.db.all<T>(convertedSql, params),
      run: async (...params: any[]) => await this.db.run(convertedSql, params)
    };
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Acquire a dedicated client so every query in the callback runs on the
    // same connection (and therefore inside the same transaction).
    const pool = (this.db as any).pool as import('pg').Pool;
    if (!pool || typeof pool.connect !== 'function') {
      // Fallback: delegate to PostgresConnection.transaction which already
      // does client-scoped work internally.
      return await this.db.transaction(async () => await callback(this));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const self = this; // for convertPlaceholders access
      const clientAdapter: DatabaseAdapter = {
        query: async <R = any>(sql: string, params?: any[]): Promise<R[]> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          return result.rows as R[];
        },
        get: async <R = any>(sql: string, params?: any[]): Promise<R | undefined> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          return result.rows[0] as R | undefined;
        },
        all: async <R = any>(sql: string, params?: any[]): Promise<R[]> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          return result.rows as R[];
        },
        run: async (sql: string, params?: any[]): Promise<RunResult> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          const firstRow = result.rows[0] as any;
          return {
            changes: result.rowCount ?? 0,
            lastInsertRowid: firstRow?.id != null ? Number(firstRow.id) : undefined,
          };
        },
        prepare: (sql: string): PreparedStatement => {
          const converted = self.convertPlaceholders(sql);
          return {
            get: async <R = any>(...params: any[]): Promise<R | undefined> => {
              const result = await client.query(converted, params);
              return result.rows[0] as R | undefined;
            },
            all: async <R = any>(...params: any[]): Promise<R[]> => {
              const result = await client.query(converted, params);
              return result.rows as R[];
            },
            run: async (...params: any[]): Promise<RunResult> => {
              const result = await client.query(converted, params);
              const firstRow = result.rows[0] as any;
              return {
                changes: result.rowCount ?? 0,
                lastInsertRowid: firstRow?.id != null ? Number(firstRow.id) : undefined,
              };
            },
          };
        },
        transaction: async <U>(cb: (db: DatabaseAdapter) => Promise<U>): Promise<U> => {
          // Nested transactions use savepoints
          await client.query('SAVEPOINT nested_tx');
          try {
            const result = await cb(clientAdapter);
            await client.query('RELEASE SAVEPOINT nested_tx');
            return result;
          } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT nested_tx');
            throw error;
          }
        },
        getType: () => 'postgresql' as const,
        isAsync: () => true,
      };

      const result = await callback(clientAdapter);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getType(): 'postgresql' {
    return 'postgresql';
  }

  isAsync(): boolean {
    return true;
  }

  /**
   * Convert SQLite placeholders (?) to PostgreSQL numbered placeholders ($1, $2, etc).
   * Skips ? characters that appear inside single-quoted SQL string literals.
   */
  private convertPlaceholders(sql: string): string {
    let paramIndex = 0;
    let result = '';
    let inString = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      // Handle single quotes (toggle string mode, handle escaped '' pairs)
      if (char === "'") {
        if (i + 1 < sql.length && sql[i + 1] === "'") {
          result += "''";
          i++; // skip next quote
          continue;
        }
        inString = !inString;
        result += char;
        continue;
      }

      if (char === '?' && !inString) {
        paramIndex++;
        result += `$${paramIndex}`;
      } else {
        result += char;
      }
    }

    return result;
  }
}

/**
 * Factory para criar o adapter correto
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  const globalWithTestDb = globalThis as typeof globalThis & {
    __SERVICEDESK_TEST_DB__?: Database.Database
  };

  if (process.env.NODE_ENV === 'test' && globalWithTestDb.__SERVICEDESK_TEST_DB__) {
    return new SQLiteAdapter(globalWithTestDb.__SERVICEDESK_TEST_DB__);
  }

  const dbType = getDatabaseType();

  if (dbType === 'postgresql') {
    const pgConnection = getPostgresConnection();
    return new PostgreSQLAdapter(pgConnection);
  } else {
    return new SQLiteAdapter(legacyDb);
  }
}

/**
 * Singleton instance
 */
let adapterInstance: DatabaseAdapter | null = null;

/**
 * Get unified database adapter
 */
export function getDatabase(): DatabaseAdapter {
  if (!adapterInstance) {
    adapterInstance = createDatabaseAdapter();
  }
  return adapterInstance;
}

/**
 * Get underlying database type ('sqlite' | 'postgresql')
 */
export function getDbType(): 'sqlite' | 'postgresql' {
  return getDatabase().getType();
}

/**
 * Helper: Execute query with automatic adapter selection
 */
export async function executeQuery<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const db = getDatabase();
  const result = db.query<T>(sql, params);
  return result instanceof Promise ? await result : result;
}

/**
 * Helper: Execute single row query
 */
export async function executeQueryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | undefined> {
  const db = getDatabase();
  const result = db.get<T>(sql, params);
  return result instanceof Promise ? await result : result;
}

/**
 * Helper: Execute INSERT/UPDATE/DELETE
 */
export async function executeRun(
  sql: string,
  params?: any[]
): Promise<RunResult> {
  const db = getDatabase();
  const result = db.run(sql, params);
  return result instanceof Promise ? await result : result;
}

/**
 * Helper: Execute transaction
 */
export async function executeTransaction<T>(
  callback: (db: DatabaseAdapter) => T | Promise<T>
): Promise<T> {
  const db = getDatabase();
  const result = db.transaction(callback);
  return result instanceof Promise ? await result : result;
}

/**
 * Type guard to check if result is a Promise
 */
export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return value instanceof Promise;
}

/**
 * SQL Dialect converter
 */
export class SQLDialectConverter {
  /**
   * Convert SQLite SQL to PostgreSQL SQL
   */
  static toPostgreSQL(sql: string): string {
    let converted = sql;

    // AUTOINCREMENT -> SERIAL
    converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
    converted = converted.replace(/AUTOINCREMENT/gi, 'SERIAL');

    // DATETIME('now') -> CURRENT_TIMESTAMP (must be before general DATETIME replacement)
    converted = converted.replace(/DATETIME\s*\(\s*['"]now['"]\s*\)/gi, 'CURRENT_TIMESTAMP');

    // DATETIME -> TIMESTAMP WITH TIME ZONE
    converted = converted.replace(/DATETIME/gi, 'TIMESTAMP WITH TIME ZONE');

    // Boolean values
    converted = converted.replace(/\bBOOLEAN\b/gi, 'BOOLEAN');

    // TEXT without limit -> TEXT (already compatible)
    // JSON strings should be JSONB (manual review needed)

    return converted;
  }

  /**
   * Convert PostgreSQL SQL to SQLite SQL
   */
  static toSQLite(sql: string): string {
    let converted = sql;

    // SERIAL -> AUTOINCREMENT
    converted = converted.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    converted = converted.replace(/BIGSERIAL/gi, 'INTEGER');

    // TIMESTAMP WITH TIME ZONE -> DATETIME
    converted = converted.replace(/TIMESTAMP WITH TIME ZONE/gi, 'DATETIME');

    // JSONB -> TEXT
    converted = converted.replace(/JSONB/gi, 'TEXT');

    // INET -> TEXT
    converted = converted.replace(/INET/gi, 'TEXT');

    return converted;
  }
}

// ============================================
// SQL Dialect Helper Functions
// ============================================
// These helpers generate SQL fragments that are compatible with both
// SQLite and PostgreSQL.  They are safe to interpolate into template
// literals because the output is deterministic (no user input).

/**
 * Returns the SQL expression for the current timestamp.
 * SQLite: datetime('now')   PostgreSQL: NOW()
 */
export function sqlNow(): string {
  return getDatabaseType() === 'postgresql' ? 'NOW()' : "datetime('now')";
}

/**
 * Returns the SQL expression for the current date (date only, no time).
 * SQLite: date('now')   PostgreSQL: CURRENT_DATE
 */
export function sqlCurrentDate(): string {
  return getDatabaseType() === 'postgresql' ? 'CURRENT_DATE' : "date('now')";
}

/**
 * Returns a SQL expression that computes the difference in *days*
 * between two timestamp columns / expressions.
 * SQLite: julianday(col1) - julianday(col2)
 * PostgreSQL: EXTRACT(EPOCH FROM (col1::timestamp - col2::timestamp)) / 86400.0
 */
export function sqlDateDiff(col1: string, col2: string): string {
  return getDatabaseType() === 'postgresql'
    ? `EXTRACT(EPOCH FROM (${col1}::timestamp - ${col2}::timestamp)) / 86400.0`
    : `julianday(${col1}) - julianday(${col2})`;
}

/**
 * Returns the SQL expression for "current date minus N days".
 * SQLite: date('now', '-N days')   PostgreSQL: CURRENT_DATE - INTERVAL 'N days'
 */
export function sqlDateSub(days: number): string {
  return getDatabaseType() === 'postgresql'
    ? `CURRENT_DATE - INTERVAL '${days} days'`
    : `date('now', '-${days} days')`;
}

/**
 * Returns the SQL expression for the first day of the current month.
 * SQLite: date('now', 'start of month')   PostgreSQL: date_trunc('month', CURRENT_DATE)
 */
export function sqlStartOfMonth(): string {
  return getDatabaseType() === 'postgresql'
    ? `date_trunc('month', CURRENT_DATE)`
    : `date('now', 'start of month')`;
}

/**
 * Returns the SQL expression for "current date plus N days".
 * SQLite: date('now', '+N days')   PostgreSQL: CURRENT_DATE + INTERVAL 'N days'
 */
export function sqlDateAdd(days: number): string {
  return getDatabaseType() === 'postgresql'
    ? `CURRENT_DATE + INTERVAL '${days} days'`
    : `date('now', '+${days} days')`;
}

/**
 * Wraps a column/expression with DATE() cast appropriate for each dialect.
 * SQLite: DATE(expr)   PostgreSQL: (expr)::date
 */
export function sqlCastDate(expr: string): string {
  return getDatabaseType() === 'postgresql'
    ? `(${expr})::date`
    : `DATE(${expr})`;
}

export default getDatabase;
