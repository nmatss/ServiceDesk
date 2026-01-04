import Database from 'better-sqlite3';
import path from 'path';
import pool from './connection-pool';

// Caminho para o arquivo do banco de dados
const dbPath = path.join(process.cwd(), 'data', 'servicedesk.db');

// Garantir que o diretório data existe
import { mkdirSync } from 'fs';
try {
  mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (error) {
  // Diretório já existe ou erro de permissão
}

/**
 * LEGACY: Direct database connection
 * @deprecated Use connection pool instead for better performance
 * Import { pool } from './connection-pool' and use pool.execute()
 */
const legacyDb = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Habilitar foreign keys
legacyDb.pragma('foreign_keys = ON');

// OPTIMIZED: Performance configurations (Agent 13)
// WAL mode: Better concurrency and performance
legacyDb.pragma('journal_mode = WAL');

// NORMAL sync: Balance between safety and performance
legacyDb.pragma('synchronous = NORMAL');

// 64MB cache size: -64000 = 64MB (negative = KB, positive = pages)
// Previous: 1000 pages (~4MB) | New: 64MB (~16x improvement)
legacyDb.pragma('cache_size = -64000');

// Memory-based temp storage: Faster temporary tables and sorts
legacyDb.pragma('temp_store = MEMORY');

// Memory-mapped I/O: 30GB (faster reads for large databases)
legacyDb.pragma('mmap_size = 30000000000');

// Auto-vacuum: Incremental (prevents database bloat)
legacyDb.pragma('auto_vacuum = INCREMENTAL');

// Busy timeout: 5 seconds (prevents lock errors)
legacyDb.pragma('busy_timeout = 5000');

/**
 * Default export: Legacy direct connection for backward compatibility
 * New code should use the connection pool instead
 */
export default legacyDb;

/**
 * Named export for db (for consistent imports)
 */
export const db = legacyDb;

/**
 * Named export for getDb function (for consistent imports)
 */
export const getDb = () => legacyDb;

/**
 * Named export for getDB function (for consistent imports)
 */
export const getDB = () => legacyDb;

/**
 * Named export for getConnection (for consistent imports)
 */
export const getConnection = () => legacyDb;

/**
 * Named export for getDatabase (for consistent imports)
 * Alias for getDB - added for compatibility with newer API routes
 */
export const getDatabase = () => legacyDb;

/**
 * Recommended: Use connection pool for better performance
 *
 * @example
 * ```typescript
 * import { getPooledConnection } from '@/lib/db/connection';
 *
 * const result = await getPooledConnection(async (db) => {
 *   return db.prepare('SELECT * FROM users').all();
 * });
 * ```
 */
export async function getPooledConnection<T>(
  operation: (db: Database.Database) => T | Promise<T>
): Promise<T> {
  return pool.execute(operation);
}

/**
 * Export pool for direct access
 */
export { pool };

