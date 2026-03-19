/**
 * Unified Database Adapter
 *
 * Provides a consistent interface for both SQLite and PostgreSQL
 * Automatically selects the correct database based on environment
 */

import { getDatabaseType } from './config';
import { PostgresConnection, getPostgresConnection } from './connection.postgres';
import type { SqlParam } from './connection.postgres';

// Import better-sqlite3 types for TypeScript (type-only, no runtime impact)
import type Database from 'better-sqlite3';

// Lazy-load SQLite only when needed (not in production/Vercel)
// better-sqlite3 is listed in next.config.js serverExternalPackages so it won't be bundled
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sqliteDb: any = null;

function getSQLiteDb(): Database.Database {
  if (!_sqliteDb) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./connection');
      _sqliteDb = mod.default || mod;
    } catch {
      throw new Error('SQLite (better-sqlite3) is not available. Set DB_TYPE=postgresql for production.');
    }
  }
  return _sqliteDb;
}

export type { SqlParam };

export interface QueryResult<T = Record<string, unknown>> {
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
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]> | T[];
  get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | undefined> | T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]> | T[];
  run(sql: string, params?: SqlParam[]): Promise<RunResult> | RunResult;

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
  get<T = Record<string, unknown>>(...params: SqlParam[]): Promise<T | undefined> | T | undefined;
  all<T = Record<string, unknown>>(...params: SqlParam[]): Promise<T[]> | T[];
  run(...params: SqlParam[]): Promise<RunResult> | RunResult;
}

/**
 * SQLite Adapter (Synchronous)
 */
class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  private executeAll<T = Record<string, unknown>>(stmt: Database.Statement, params?: SqlParam[]): T[] {
    return (params && params.length > 0 ? stmt.all(...params) : stmt.all()) as T[];
  }

  private executeGet<T = Record<string, unknown>>(stmt: Database.Statement, params?: SqlParam[]): T | undefined {
    return (params && params.length > 0 ? stmt.get(...params) : stmt.get()) as T | undefined;
  }

  private executeSqliteRun(stmt: Database.Statement, params?: SqlParam[]): RunResult {
    const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
    return {
      changes: Number(result?.changes ?? 0),
      lastInsertRowid: typeof result?.lastInsertRowid === 'number'
        ? result.lastInsertRowid as number
        : undefined
    };
  }

  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): T[] {
    const stmt = this.db.prepare(sql);
    return this.executeAll<T>(stmt, params);
  }

  get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): T | undefined {
    const stmt = this.db.prepare(sql);
    return this.executeGet<T>(stmt, params);
  }

  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): T[] {
    return this.query<T>(sql, params);
  }

  run(sql: string, params?: SqlParam[]): RunResult {
    const stmt = this.db.prepare(sql);
    return this.executeSqliteRun(stmt, params);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      get: <T = Record<string, unknown>>(...params: SqlParam[]) => this.executeGet<T>(stmt, params),
      all: <T = Record<string, unknown>>(...params: SqlParam[]) => this.executeAll<T>(stmt, params),
      run: (...params: SqlParam[]) => this.executeSqliteRun(stmt, params)
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

  async query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]> {
    // Convert SQLite placeholders (?) to PostgreSQL ($1, $2, etc)
    const convertedSql = this.convertPlaceholders(sql);
    return await this.db.query<T>(convertedSql, params);
  }

  async get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | undefined> {
    const convertedSql = this.convertPlaceholders(sql);
    return await this.db.get<T>(convertedSql, params);
  }

  async all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]> {
    return await this.query<T>(sql, params);
  }

  async run(sql: string, params?: SqlParam[]): Promise<RunResult> {
    const convertedSql = this.convertPlaceholders(sql);
    return await this.db.run(convertedSql, params);
  }

  prepare(sql: string): PreparedStatement {
    const convertedSql = this.convertPlaceholders(sql);
    return {
      get: async <T = Record<string, unknown>>(...params: SqlParam[]) => await this.db.get<T>(convertedSql, params),
      all: async <T = Record<string, unknown>>(...params: SqlParam[]) => await this.db.all<T>(convertedSql, params),
      run: async (...params: SqlParam[]) => await this.db.run(convertedSql, params)
    };
  }

  async transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Acquire a dedicated client so every query in the callback runs on the
    // same connection (and therefore inside the same transaction).
    const pool = (this.db as unknown as { pool: import('pg').Pool }).pool;
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
        query: async <R = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<R[]> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          return result.rows as R[];
        },
        get: async <R = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<R | undefined> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          return result.rows[0] as R | undefined;
        },
        all: async <R = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<R[]> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          return result.rows as R[];
        },
        run: async (sql: string, params?: SqlParam[]): Promise<RunResult> => {
          const converted = self.convertPlaceholders(sql);
          const result = await client.query(converted, params || []);
          const firstRow = result.rows[0] as Record<string, unknown> | undefined;
          return {
            changes: result.rowCount ?? 0,
            lastInsertRowid: firstRow?.id != null ? Number(firstRow.id) : undefined,
          };
        },
        prepare: (sql: string): PreparedStatement => {
          const converted = self.convertPlaceholders(sql);
          return {
            get: async <R = Record<string, unknown>>(...params: SqlParam[]): Promise<R | undefined> => {
              const result = await client.query(converted, params);
              return result.rows[0] as R | undefined;
            },
            all: async <R = Record<string, unknown>>(...params: SqlParam[]): Promise<R[]> => {
              const result = await client.query(converted, params);
              return result.rows as R[];
            },
            run: async (...params: SqlParam[]): Promise<RunResult> => {
              const result = await client.query(converted, params);
              const firstRow = result.rows[0] as Record<string, unknown> | undefined;
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
    return new SQLiteAdapter(getSQLiteDb());
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
 * Reset adapter singleton (for testing only)
 */
export function _resetAdapterForTesting(): void {
  adapterInstance = null;
  _sqliteDb = null;
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
export async function executeQuery<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  sql: string,
  params?: SqlParam[]
): Promise<T[]> {
  const db = getDatabase();
  const result = db.query<T>(sql, params);
  return result instanceof Promise ? await result : result;
}

/**
 * Helper: Execute single row query
 */
export async function executeQueryOne<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  sql: string,
  params?: SqlParam[]
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
  params?: SqlParam[]
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

export function sqlDatetimeSub(days: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${days} days'`
    : `datetime('now', '-${days} days')`;
}

export function sqlDatetimeSubHours(hours: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${hours} hours'`
    : `datetime('now', '-${hours} hours')`;
}

export function sqlDatetimeSubMinutes(minutes: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${minutes} minutes'`
    : `datetime('now', '-${minutes} minutes')`;
}

export function sqlDatetimeAddMinutes(minutes: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() + INTERVAL '${minutes} minutes'`
    : `datetime('now', '+${minutes} minutes')`;
}

export function sqlColSubMinutes(col: string, minutes: number): string {
  return getDatabaseType() === 'postgresql'
    ? `${col} - INTERVAL '${minutes} minutes'`
    : `datetime(${col}, '-${minutes} minutes')`;
}

export function sqlColAddMinutes(col: string, minutes: number): string {
  return getDatabaseType() === 'postgresql'
    ? `${col} + INTERVAL '${minutes} minutes'`
    : `datetime(${col}, '+${minutes} minutes')`;
}

export function sqlGroupConcat(col: string, sep: string = ','): string {
  return getDatabaseType() === 'postgresql'
    ? `STRING_AGG(${col}::text, '${sep}')`
    : `GROUP_CONCAT(${col}, '${sep}')`;
}

export function sqlExtractHour(col: string): string {
  return getDatabaseType() === 'postgresql'
    ? `EXTRACT(HOUR FROM ${col})`
    : `CAST(strftime('%H', ${col}) AS INTEGER)`;
}

export function sqlExtractDayOfWeek(col: string): string {
  return getDatabaseType() === 'postgresql'
    ? `EXTRACT(DOW FROM ${col})`
    : `CAST(strftime('%w', ${col}) AS INTEGER)`;
}

export function sqlDatetimeSubYears(years: number): string {
  return getDatabaseType() === 'postgresql'
    ? `NOW() - INTERVAL '${years} years'`
    : `datetime('now', '-${years} years')`;
}

/**
 * Returns the boolean TRUE literal for the current database.
 * PostgreSQL uses native BOOLEAN, SQLite uses INTEGER 1.
 */
export function sqlTrue(): string {
  return getDatabaseType() === 'postgresql' ? 'TRUE' : '1';
}

/**
 * Returns the boolean FALSE literal for the current database.
 * PostgreSQL uses native BOOLEAN, SQLite uses INTEGER 0.
 */
export function sqlFalse(): string {
  return getDatabaseType() === 'postgresql' ? 'FALSE' : '0';
}

export default getDatabase;
