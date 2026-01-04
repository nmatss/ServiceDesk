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

  query<T = any>(sql: string, params?: any[]): T[] {
    const stmt = this.db.prepare(sql);
    return params ? stmt.all(...params) as T[] : stmt.all() as T[];
  }

  get<T = any>(sql: string, params?: any[]): T | undefined {
    const stmt = this.db.prepare(sql);
    return params ? stmt.get(...params) as T | undefined : stmt.get() as T | undefined;
  }

  all<T = any>(sql: string, params?: any[]): T[] {
    return this.query<T>(sql, params);
  }

  run(sql: string, params?: any[]): RunResult {
    const stmt = this.db.prepare(sql);
    const result = params ? stmt.run(...params) : stmt.run();
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid as number
    };
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      get: <T = any>(...params: any[]) => stmt.get(...params) as T | undefined,
      all: <T = any>(...params: any[]) => stmt.all(...params) as T[],
      run: (...params: any[]) => {
        const result = stmt.run(...params);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid as number
        };
      }
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
    return await this.db.transaction(async () => await callback(this));
  }

  getType(): 'postgresql' {
    return 'postgresql';
  }

  isAsync(): boolean {
    return true;
  }

  /**
   * Convert SQLite placeholders (?) to PostgreSQL numbered placeholders ($1, $2, etc)
   */
  private convertPlaceholders(sql: string): string {
    let counter = 0;
    return sql.replace(/\?/g, () => `$${++counter}`);
  }
}

/**
 * Factory para criar o adapter correto
 */
export function createDatabaseAdapter(): DatabaseAdapter {
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

export default getDatabase;
