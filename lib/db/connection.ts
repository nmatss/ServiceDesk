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

// Configurações de performance
legacyDb.pragma('journal_mode = WAL');
legacyDb.pragma('synchronous = NORMAL');
legacyDb.pragma('cache_size = 1000');
legacyDb.pragma('temp_store = MEMORY');

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

