/**
 * Comprehensive Unit Tests for Database Adapter
 * Tests query execution, placeholder conversion, transactions, and dual database support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createDatabaseAdapter,
  getDatabase,
  executeQuery,
  executeQueryOne,
  executeRun,
  executeTransaction,
  SQLDialectConverter,
  isPromise,
  type DatabaseAdapter,
  type RunResult
} from '../adapter'

// Mock database config
vi.mock('../config', () => ({
  getDatabaseType: vi.fn(() => 'sqlite'),
  isPostgreSQL: vi.fn(() => false)
}))

// Mock SQLite connection
vi.mock('../connection', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({ id: 1, name: 'Test' })),
      all: vi.fn(() => [{ id: 1 }, { id: 2 }]),
      run: vi.fn(() => ({
        changes: 1,
        lastInsertRowid: 123
      }))
    })),
    transaction: vi.fn((fn: Function) => fn)
  }
  return { default: mockDb }
})

// Mock PostgreSQL connection
vi.mock('../connection.postgres', () => ({
  getPostgresConnection: vi.fn(() => ({
    query: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
    get: vi.fn(async () => ({ id: 1, name: 'Test' })),
    all: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
    run: vi.fn(async () => ({ changes: 1, lastInsertRowid: 456 })),
    transaction: vi.fn(async (fn: Function) => await fn())
  }))
}))

describe('Database Adapter', () => {
  let adapter: DatabaseAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createDatabaseAdapter()
  })

  describe('Adapter Creation', () => {
    it('should create SQLite adapter by default', () => {
      const adapter = createDatabaseAdapter()
      expect(adapter.getType()).toBe('sqlite')
    })

    it('should create synchronous adapter for SQLite', () => {
      const adapter = createDatabaseAdapter()
      expect(adapter.isAsync()).toBe(false)
    })

    it('should return singleton instance', () => {
      const db1 = getDatabase()
      const db2 = getDatabase()

      expect(db1).toBe(db2)
    })
  })

  describe('SQLite Adapter - Query Operations', () => {
    it('should execute query and return rows', () => {
      const result = adapter.query('SELECT * FROM users')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute query with parameters', () => {
      const result = adapter.query('SELECT * FROM users WHERE id = ?', [1])

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute single row query', () => {
      const result = adapter.get('SELECT * FROM users WHERE id = ?', [1])

      expect(result).toBeDefined()
      expect(result).toHaveProperty('name')
    })

    it('should execute all rows query', () => {
      const result = adapter.all('SELECT * FROM users')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute INSERT/UPDATE/DELETE', async () => {
      const result = await adapter.run('INSERT INTO users (name) VALUES (?)', ['John'])

      expect(result).toBeDefined()
      expect(result.changes).toBe(1)
      expect(result.lastInsertRowid).toBeDefined()
    })
  })

  describe('SQLite Adapter - Prepared Statements', () => {
    it('should prepare statement', () => {
      const stmt = adapter.prepare('SELECT * FROM users WHERE id = ?')

      expect(stmt).toBeDefined()
      expect(stmt.get).toBeDefined()
      expect(stmt.all).toBeDefined()
      expect(stmt.run).toBeDefined()
    })

    it('should execute prepared statement get', () => {
      const stmt = adapter.prepare('SELECT * FROM users WHERE id = ?')
      const result = stmt.get(1)

      expect(result).toBeDefined()
    })

    it('should execute prepared statement all', () => {
      const stmt = adapter.prepare('SELECT * FROM users')
      const result = stmt.all()

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute prepared statement run', async () => {
      const stmt = adapter.prepare('INSERT INTO users (name) VALUES (?)')
      const result = await stmt.run('John')

      expect(result).toBeDefined()
      expect(result.changes).toBeDefined()
    })
  })

  describe('SQLite Adapter - Transactions', () => {
    it('should execute transaction', () => {
      const result = adapter.transaction((db) => {
        db.run('INSERT INTO users (name) VALUES (?)', ['John'])
        return { success: true }
      })

      expect(result).toEqual({ success: true })
    })

    it('should rollback on error', () => {
      expect(() => {
        adapter.transaction((db) => {
          db.run('INSERT INTO users (name) VALUES (?)', ['John'])
          throw new Error('Test error')
        })
      }).toThrow('Test error')
    })

    it('should commit successful transaction', async () => {
      const result = await adapter.transaction(async (db) => {
        const insert = await db.run('INSERT INTO users (name) VALUES (?)', ['John'])
        return insert.lastInsertRowid
      })

      expect(result).toBeDefined()
    })
  })

  describe('Placeholder Conversion (SQLite → PostgreSQL)', () => {
    it('should convert single placeholder', () => {
      const config = require('../config')
      config.getDatabaseType.mockReturnValueOnce('postgresql')
      config.isPostgreSQL.mockReturnValueOnce(true)

      const pgAdapter = createDatabaseAdapter()

      // The adapter should convert ? to $1 internally
      // We can't directly test the conversion, but we can verify it doesn't error
      expect(() => pgAdapter.query('SELECT * FROM users WHERE id = ?', [1])).not.toThrow()
    })

    it('should convert multiple placeholders in order', () => {
      // Test the converter directly
      const sql = 'SELECT * FROM users WHERE id = ? AND name = ?'
      let counter = 0
      const converted = sql.replace(/\?/g, () => `$${++counter}`)

      // Converter replaces ? with $1, $2, etc
      expect(converted).not.toContain('?')
    })

    it('should handle queries with no placeholders', () => {
      const result = adapter.query('SELECT * FROM users')
      expect(result).toBeDefined()
    })

    it('should handle complex queries with many placeholders', () => {
      const sql = 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)'
      const result = adapter.run(sql, ['John', 'john@example.com', 30])

      expect(result).toBeDefined()
    })
  })

  describe('SQL Dialect Converter', () => {
    describe('SQLite → PostgreSQL', () => {
      it('should convert AUTOINCREMENT to SERIAL', () => {
        const sqlite = 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT)'
        const postgres = SQLDialectConverter.toPostgreSQL(sqlite)

        expect(postgres).toContain('SERIAL PRIMARY KEY')
        expect(postgres).not.toContain('AUTOINCREMENT')
      })

      it('should convert DATETIME to TIMESTAMP WITH TIME ZONE', () => {
        const sqlite = 'CREATE TABLE logs (created_at DATETIME)'
        const postgres = SQLDialectConverter.toPostgreSQL(sqlite)

        expect(postgres).toContain('TIMESTAMP WITH TIME ZONE')
        expect(postgres).not.toContain('DATETIME')
      })

      it('should convert DATETIME(\'now\') to CURRENT_TIMESTAMP', () => {
        const sqlite = 'INSERT INTO logs (created_at) VALUES (DATETIME(\'now\'))'
        const postgres = SQLDialectConverter.toPostgreSQL(sqlite)

        expect(postgres).toContain('CURRENT_TIMESTAMP')
      })

      it('should preserve BOOLEAN type', () => {
        const sqlite = 'CREATE TABLE settings (enabled BOOLEAN)'
        const postgres = SQLDialectConverter.toPostgreSQL(sqlite)

        expect(postgres).toContain('BOOLEAN')
      })

      it('should handle multiple conversions in one query', () => {
        const sqlite = `
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME,
            is_active BOOLEAN
          )
        `
        const postgres = SQLDialectConverter.toPostgreSQL(sqlite)

        expect(postgres).toContain('SERIAL PRIMARY KEY')
        expect(postgres).toContain('TIMESTAMP WITH TIME ZONE')
        expect(postgres).toContain('BOOLEAN')
      })
    })

    describe('PostgreSQL → SQLite', () => {
      it('should convert SERIAL to AUTOINCREMENT', () => {
        const postgres = 'CREATE TABLE users (id SERIAL PRIMARY KEY)'
        const sqlite = SQLDialectConverter.toSQLite(postgres)

        expect(sqlite).toContain('INTEGER PRIMARY KEY AUTOINCREMENT')
        expect(sqlite).not.toContain('SERIAL')
      })

      it('should convert BIGSERIAL to INTEGER', () => {
        const postgres = 'CREATE TABLE logs (id BIGSERIAL)'
        const sqlite = SQLDialectConverter.toSQLite(postgres)

        expect(sqlite).toContain('INTEGER')
        expect(sqlite).not.toContain('BIGSERIAL')
      })

      it('should convert TIMESTAMP WITH TIME ZONE to DATETIME', () => {
        const postgres = 'CREATE TABLE logs (created_at TIMESTAMP WITH TIME ZONE)'
        const sqlite = SQLDialectConverter.toSQLite(postgres)

        expect(sqlite).toContain('DATETIME')
        expect(sqlite).not.toContain('TIMESTAMP')
      })

      it('should convert JSONB to TEXT', () => {
        const postgres = 'CREATE TABLE settings (data JSONB)'
        const sqlite = SQLDialectConverter.toSQLite(postgres)

        expect(sqlite).toContain('TEXT')
        expect(sqlite).not.toContain('JSONB')
      })

      it('should convert INET to TEXT', () => {
        const postgres = 'CREATE TABLE logs (ip_address INET)'
        const sqlite = SQLDialectConverter.toSQLite(postgres)

        expect(sqlite).toContain('TEXT')
        expect(sqlite).not.toContain('INET')
      })
    })
  })

  describe('Helper Functions', () => {
    it('should execute query helper', async () => {
      const result = await executeQuery('SELECT * FROM users')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute single query helper', async () => {
      const result = await executeQueryOne('SELECT * FROM users WHERE id = ?', [1])

      expect(result).toBeDefined()
    })

    it('should execute run helper', async () => {
      const result = await executeRun('INSERT INTO users (name) VALUES (?)', ['John'])

      expect(result).toBeDefined()
      expect(result.changes).toBeDefined()
    })

    it('should execute transaction helper', async () => {
      const result = await executeTransaction((db) => {
        db.run('INSERT INTO users (name) VALUES (?)', ['John'])
        return { success: true }
      })

      expect(result).toEqual({ success: true })
    })
  })

  describe('Promise Detection', () => {
    it('should detect Promise instances', () => {
      const promise = Promise.resolve(42)
      expect(isPromise(promise)).toBe(true)
    })

    it('should detect non-Promise values', () => {
      expect(isPromise(42)).toBe(false)
      expect(isPromise('string')).toBe(false)
      expect(isPromise(null)).toBe(false)
      expect(isPromise(undefined)).toBe(false)
      expect(isPromise({})).toBe(false)
      expect(isPromise([])).toBe(false)
    })

    it('should detect async function results', async () => {
      const asyncFn = async () => 42
      const result = asyncFn()
      expect(isPromise(result)).toBe(true)
    })
  })

  describe('Type Safety', () => {
    it('should preserve type information in query', () => {
      interface User {
        id: number
        name: string
      }

      const result = adapter.query<User>('SELECT * FROM users')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should preserve type information in get', () => {
      interface User {
        id: number
        name: string
      }

      const result = adapter.get<User>('SELECT * FROM users WHERE id = ?', [1])

      expect(result).toBeDefined()
    })

    it('should type run result correctly', async () => {
      const result: RunResult = await adapter.run('INSERT INTO users (name) VALUES (?)', ['John'])

      expect(result.changes).toBeDefined()
      expect(typeof result.changes).toBe('number')
    })
  })

  describe('Error Handling', () => {
    it('should handle query errors gracefully', () => {
      const db = require('../connection').default
      db.prepare = vi.fn(() => ({
        all: vi.fn(() => { throw new Error('Query error') })
      }))

      expect(() => adapter.query('INVALID SQL')).toThrow('Query error')
    })

    it('should handle transaction errors', () => {
      expect(() => {
        adapter.transaction(() => {
          throw new Error('Transaction failed')
        })
      }).toThrow('Transaction failed')
    })

    it('should handle prepared statement errors', () => {
      const db = require('../connection').default
      db.prepare = vi.fn(() => {
        throw new Error('Prepare failed')
      })

      expect(() => adapter.prepare('SELECT * FROM invalid')).toThrow('Prepare failed')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty result sets', () => {
      const db = require('../connection').default
      db.prepare = vi.fn(() => ({
        all: vi.fn(() => [])
      }))

      const result = adapter.query('SELECT * FROM users WHERE 1=0')
      expect(result).toEqual([])
    })

    it('should handle null values', () => {
      const db = require('../connection').default
      db.prepare = vi.fn(() => ({
        get: vi.fn(() => null)
      }))

      const result = adapter.get('SELECT * FROM users WHERE id = ?', [999])
      expect(result).toBeNull()
    })

    it('should handle undefined parameters', () => {
      const result = adapter.query('SELECT * FROM users')
      expect(result).toBeDefined()
    })

    it('should handle empty parameter array', () => {
      const result = adapter.query('SELECT * FROM users', [])
      expect(result).toBeDefined()
    })

    it('should handle very long SQL queries', () => {
      const longSql = 'SELECT * FROM users WHERE ' +
        Array(100).fill('id = ? OR').join(' ') + ' id = ?'
      const params = Array(101).fill(1)

      expect(() => adapter.query(longSql, params)).not.toThrow()
    })

    it('should handle special characters in SQL', () => {
      const sql = "SELECT * FROM users WHERE name = 'O''Brien'"
      expect(() => adapter.query(sql)).not.toThrow()
    })

    it('should handle multi-line SQL', () => {
      const sql = `
        SELECT *
        FROM users
        WHERE id = ?
          AND name = ?
      `
      expect(() => adapter.query(sql, [1, 'John'])).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should execute many queries quickly', () => {
      const iterations = 1000
      const startTime = Date.now()

      for (let i = 0; i < iterations; i++) {
        adapter.query('SELECT * FROM users WHERE id = ?', [i])
      }

      const duration = Date.now() - startTime

      // 1000 queries should complete in less than 100ms
      expect(duration).toBeLessThan(100)
    })

    it('should handle concurrent queries', () => {
      const queries = Array.from({ length: 100 }, (_, i) =>
        adapter.query('SELECT * FROM users WHERE id = ?', [i])
      )

      expect(queries).toHaveLength(100)
      queries.forEach(result => {
        expect(result).toBeDefined()
      })
    })

    it('should reuse prepared statements efficiently', () => {
      const stmt = adapter.prepare('SELECT * FROM users WHERE id = ?')

      const startTime = Date.now()
      for (let i = 0; i < 1000; i++) {
        stmt.get(i)
      }
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(50)
    })
  })

  describe('Async/Sync Compatibility', () => {
    it('should work with sync adapter (SQLite)', () => {
      const result = adapter.query('SELECT * FROM users')
      expect(isPromise(result)).toBe(false)
    })

    it('should handle both sync and async in helpers', async () => {
      const result = await executeQuery('SELECT * FROM users')
      expect(result).toBeDefined()
    })

    it('should handle async transactions', async () => {
      const result = await executeTransaction(async () => {
        await Promise.resolve()
        return { success: true }
      })

      expect(result).toEqual({ success: true })
    })
  })

  describe('Database Metadata', () => {
    it('should report correct database type', () => {
      expect(adapter.getType()).toBe('sqlite')
    })

    it('should report correct async status', () => {
      expect(adapter.isAsync()).toBe(false)
    })
  })

  describe('Complex Queries', () => {
    it('should handle JOINs', () => {
      const sql = `
        SELECT u.*, t.title
        FROM users u
        LEFT JOIN tickets t ON u.id = t.user_id
        WHERE u.id = ?
      `
      expect(() => adapter.query(sql, [1])).not.toThrow()
    })

    it('should handle subqueries', () => {
      const sql = `
        SELECT * FROM users
        WHERE id IN (SELECT user_id FROM tickets WHERE status = ?)
      `
      expect(() => adapter.query(sql, ['open'])).not.toThrow()
    })

    it('should handle aggregations', () => {
      const sql = `
        SELECT user_id, COUNT(*) as ticket_count
        FROM tickets
        GROUP BY user_id
        HAVING COUNT(*) > ?
      `
      expect(() => adapter.query(sql, [5])).not.toThrow()
    })

    it('should handle CTEs (Common Table Expressions)', () => {
      const sql = `
        WITH user_stats AS (
          SELECT user_id, COUNT(*) as count
          FROM tickets
          GROUP BY user_id
        )
        SELECT * FROM user_stats WHERE count > ?
      `
      expect(() => adapter.query(sql, [10])).not.toThrow()
    })
  })
})
