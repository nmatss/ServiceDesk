/**
 * Database Mocking Utilities
 * Provides comprehensive database mocking helpers for unit and integration tests
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { hashPassword } from '@/lib/auth/sqlite-auth'

export interface MockDatabase {
  db: Database.Database
  cleanup: () => void
}

/**
 * Create an in-memory SQLite database for testing
 */
export function createInMemoryDatabase(): MockDatabase {
  const db = new Database(':memory:')

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  return {
    db,
    cleanup: () => {
      db.close()
    }
  }
}

/**
 * Create a temporary file-based SQLite database for testing
 */
export function createTempDatabase(testName?: string): MockDatabase {
  const testDbPath = path.join(
    __dirname,
    '../../data',
    `test-${testName || Date.now()}.db`
  )

  // Ensure directory exists
  const dir = path.dirname(testDbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(testDbPath)
  db.pragma('foreign_keys = ON')

  return {
    db,
    cleanup: () => {
      db.close()
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath)
      }
    }
  }
}

/**
 * Initialize database schema for testing
 */
export async function initializeTestSchema(db: Database.Database): Promise<void> {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'agent', 'user')),
      organization_id INTEGER DEFAULT 1,
      tenant_slug TEXT DEFAULT 'default',
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Tickets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status_id INTEGER DEFAULT 1,
      priority_id INTEGER DEFAULT 3,
      category_id INTEGER DEFAULT 1,
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      tenant_slug TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `)

  // Statuses
  db.exec(`
    CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6B7280',
      is_final BOOLEAN DEFAULT FALSE,
      order_index INTEGER DEFAULT 0
    )
  `)

  // Priorities
  db.exec(`
    CREATE TABLE IF NOT EXISTS priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      color TEXT DEFAULT '#6B7280'
    )
  `)

  // Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6B7280',
      tenant_slug TEXT DEFAULT 'default'
    )
  `)

  // Comments
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Organizations
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      settings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // KB Articles
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      category_id INTEGER,
      author_id INTEGER NOT NULL,
      views INTEGER DEFAULT 0,
      helpful_count INTEGER DEFAULT 0,
      tenant_slug TEXT DEFAULT 'default',
      is_published BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `)
}

/**
 * Seed database with default reference data
 */
export async function seedReferenceData(db: Database.Database): Promise<void> {
  // Seed statuses
  const statusData = [
    { id: 1, name: 'Open', color: '#3B82F6', is_final: 0, order_index: 1 },
    { id: 2, name: 'In Progress', color: '#F59E0B', is_final: 0, order_index: 2 },
    { id: 3, name: 'Resolved', color: '#10B981', is_final: 1, order_index: 3 },
    { id: 4, name: 'Closed', color: '#6B7280', is_final: 1, order_index: 4 }
  ]

  const insertStatus = db.prepare(
    'INSERT OR REPLACE INTO statuses (id, name, color, is_final, order_index) VALUES (?, ?, ?, ?, ?)'
  )

  for (const status of statusData) {
    insertStatus.run(status.id, status.name, status.color, status.is_final, status.order_index)
  }

  // Seed priorities
  const priorityData = [
    { id: 1, name: 'Critical', level: 1, color: '#EF4444' },
    { id: 2, name: 'High', level: 2, color: '#F59E0B' },
    { id: 3, name: 'Medium', level: 3, color: '#10B981' },
    { id: 4, name: 'Low', level: 4, color: '#6B7280' }
  ]

  const insertPriority = db.prepare(
    'INSERT OR REPLACE INTO priorities (id, name, level, color) VALUES (?, ?, ?, ?)'
  )

  for (const priority of priorityData) {
    insertPriority.run(priority.id, priority.name, priority.level, priority.color)
  }

  // Seed categories
  const categoryData = [
    { id: 1, name: 'Technical', description: 'Technical issues', color: '#3B82F6' },
    { id: 2, name: 'Administrative', description: 'Administrative requests', color: '#8B5CF6' },
    { id: 3, name: 'Commercial', description: 'Sales and commercial', color: '#10B981' }
  ]

  const insertCategory = db.prepare(
    'INSERT OR REPLACE INTO categories (id, name, description, color) VALUES (?, ?, ?, ?)'
  )

  for (const category of categoryData) {
    insertCategory.run(category.id, category.name, category.description, category.color)
  }

  // Seed default organization
  db.prepare(
    'INSERT OR REPLACE INTO organizations (id, name, slug, settings) VALUES (?, ?, ?, ?)'
  ).run(1, 'Test Organization', 'default', '{}')
}

/**
 * Create a mock user in the database
 */
export async function createMockUser(
  db: Database.Database,
  userData?: Partial<{
    name: string
    email: string
    password: string
    role: 'admin' | 'agent' | 'user'
    organization_id: number
    tenant_slug: string
  }>
): Promise<any> {
  const defaultData = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    role: 'user' as const,
    organization_id: 1,
    tenant_slug: 'default',
    ...userData
  }

  const passwordHash = await hashPassword(defaultData.password)

  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, organization_id, tenant_slug)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    defaultData.name,
    defaultData.email,
    passwordHash,
    defaultData.role,
    defaultData.organization_id,
    defaultData.tenant_slug
  )

  return {
    id: result.lastInsertRowid,
    name: defaultData.name,
    email: defaultData.email,
    role: defaultData.role,
    organization_id: defaultData.organization_id,
    tenant_slug: defaultData.tenant_slug,
    password: defaultData.password, // Include for testing authentication
  }
}

/**
 * Create a mock ticket in the database
 */
export function createMockTicket(
  db: Database.Database,
  ticketData?: Partial<{
    title: string
    description: string
    user_id: number
    assigned_to: number
    status_id: number
    priority_id: number
    category_id: number
    tenant_slug: string
  }>
): any {
  const defaultData = {
    title: 'Test Ticket',
    description: 'This is a test ticket description',
    user_id: 1,
    status_id: 1,
    priority_id: 3,
    category_id: 1,
    tenant_slug: 'default',
    ...ticketData
  }

  const result = db.prepare(`
    INSERT INTO tickets (title, description, user_id, assigned_to, status_id, priority_id, category_id, tenant_slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaultData.title,
    defaultData.description,
    defaultData.user_id,
    defaultData.assigned_to || null,
    defaultData.status_id,
    defaultData.priority_id,
    defaultData.category_id,
    defaultData.tenant_slug
  )

  return {
    id: result.lastInsertRowid,
    ...defaultData,
  }
}

/**
 * Create a mock comment
 */
export function createMockComment(
  db: Database.Database,
  commentData: {
    ticket_id: number
    user_id: number
    content: string
    is_internal?: boolean
  }
): any {
  const result = db.prepare(`
    INSERT INTO comments (ticket_id, user_id, content, is_internal)
    VALUES (?, ?, ?, ?)
  `).run(
    commentData.ticket_id,
    commentData.user_id,
    commentData.content,
    commentData.is_internal ? 1 : 0
  )

  return {
    id: result.lastInsertRowid,
    ...commentData,
  }
}

/**
 * Create a mock KB article
 */
export function createMockArticle(
  db: Database.Database,
  articleData?: Partial<{
    title: string
    slug: string
    content: string
    author_id: number
    category_id: number
    is_published: boolean
    tenant_slug: string
  }>
): any {
  const defaultData = {
    title: 'Test Article',
    slug: `test-article-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    content: 'Test article content',
    author_id: 1,
    category_id: 1,
    is_published: true,
    tenant_slug: 'default',
    ...articleData
  }

  const result = db.prepare(`
    INSERT INTO kb_articles (title, slug, content, author_id, category_id, is_published, tenant_slug)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaultData.title,
    defaultData.slug,
    defaultData.content,
    defaultData.author_id,
    defaultData.category_id,
    defaultData.is_published ? 1 : 0,
    defaultData.tenant_slug
  )

  return {
    id: result.lastInsertRowid,
    ...defaultData,
  }
}

/**
 * Clear all data from test database
 */
export function clearTestData(db: Database.Database): void {
  const tables = [
    'comments',
    'tickets',
    'kb_articles',
    'users',
  ]

  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run()
    } catch (error) {
      // Table might not exist, ignore
    }
  }
}

/**
 * Get count of records in a table
 */
export function getRecordCount(db: Database.Database, table: string): number {
  const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
  return result.count
}

/**
 * Setup a complete test database with schema and reference data
 */
export async function setupTestDatabase(): Promise<MockDatabase> {
  const mockDb = createInMemoryDatabase()
  await initializeTestSchema(mockDb.db)
  await seedReferenceData(mockDb.db)
  return mockDb
}

/**
 * Cleanup test database
 */
export function cleanupTestDatabase(mockDb: MockDatabase): void {
  mockDb.cleanup()
}
