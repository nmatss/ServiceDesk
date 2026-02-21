import '@testing-library/jest-dom'
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

// Set environment variables for tests
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = '9f5c2e7d4a1b8c3f6e0d2c7a4b9e1f5c2d7a8b3e6f1c4a9d2e5b8f0a3c6d1e4f'
process.env.DATABASE_URL = ':memory:'

// Configuração para ambiente de teste
export const TEST_DB_PATH = path.join(__dirname, '../data/test.db')
export const ORIGINAL_ENV = 'test'

// Mock do banco de dados para testes
let testDb: Database.Database

export function setupTestDatabase() {
  beforeAll(async () => {
    // Configurar ambiente de teste
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = '8d3a6f1c4b9e2d7a5c0f3b8e1a4d9c2f6b0e3a7d1c5f8b2e4a9c6d0f3b7e1a5d'

    // Remover banco de teste se existir
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }

    // Criar diretório se não existir
    const testDir = path.dirname(TEST_DB_PATH)
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }

    // Criar novo banco de teste
    testDb = new Database(TEST_DB_PATH)

    // Criar estrutura básica de tabelas
    await createTestTables()
    await seedTestData()
  })

  afterAll(async () => {
    // Fechar conexão
    if (testDb) {
      testDb.close()
    }

    // Limpar banco de teste
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }

    // Restaurar ambiente
    process.env.NODE_ENV = ORIGINAL_ENV
  })

  beforeEach(() => {
    // Limpar dados de teste antes de cada teste
    clearTestData()
  })

  afterEach(() => {
    // Cleanup opcional após cada teste
  })
}

/**
 * Criar tabelas de teste
 */
async function createTestTables() {
  const createTableQueries = [
    // Usuários
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'agent', 'user')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tickets
    `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status_id INTEGER DEFAULT 1,
      priority_id INTEGER DEFAULT 3,
      category_id INTEGER DEFAULT 1,
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )`,

    // Status
    `CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6B7280',
      is_final BOOLEAN DEFAULT FALSE,
      order_index INTEGER DEFAULT 0
    )`,

    // Prioridades
    `CREATE TABLE IF NOT EXISTS priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      color TEXT DEFAULT '#6B7280'
    )`,

    // Categorias
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6B7280'
    )`,

    // Cache para testes
    `CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Rate limits para testes
    `CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      reset_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Logs para testes
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      level INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ]

  for (const query of createTableQueries) {
    testDb.exec(query)
  }
}

/**
 * Popular dados de teste
 */
async function seedTestData() {
  // Inserir status padrão
  const statusData = [
    { id: 1, name: 'Aberto', color: '#EF4444', is_final: false },
    { id: 2, name: 'Em Andamento', color: '#F59E0B', is_final: false },
    { id: 3, name: 'Resolvido', color: '#10B981', is_final: true },
    { id: 4, name: 'Fechado', color: '#6B7280', is_final: true }
  ]

  const insertStatus = testDb.prepare(`
    INSERT OR REPLACE INTO statuses (id, name, color, is_final)
    VALUES (?, ?, ?, ?)
  `)

  for (const status of statusData) {
    insertStatus.run(status.id, status.name, status.color, status.is_final ? 1 : 0)
  }

  // Inserir prioridades padrão
  const priorityData = [
    { id: 1, name: 'Crítica', level: 1, color: '#EF4444' },
    { id: 2, name: 'Alta', level: 2, color: '#F59E0B' },
    { id: 3, name: 'Média', level: 3, color: '#10B981' },
    { id: 4, name: 'Baixa', level: 4, color: '#6B7280' }
  ]

  const insertPriority = testDb.prepare(`
    INSERT OR REPLACE INTO priorities (id, name, level, color)
    VALUES (?, ?, ?, ?)
  `)

  for (const priority of priorityData) {
    insertPriority.run(priority.id, priority.name, priority.level, priority.color)
  }

  // Inserir categorias padrão
  const categoryData = [
    { id: 1, name: 'Técnico', description: 'Problemas técnicos', color: '#3B82F6' },
    { id: 2, name: 'Administrativo', description: 'Questões administrativas', color: '#8B5CF6' },
    { id: 3, name: 'Comercial', description: 'Questões comerciais', color: '#10B981' }
  ]

  const insertCategory = testDb.prepare(`
    INSERT OR REPLACE INTO categories (id, name, description, color)
    VALUES (?, ?, ?, ?)
  `)

  for (const category of categoryData) {
    insertCategory.run(category.id, category.name, category.description, category.color)
  }
}

/**
 * Limpar dados de teste (mantém estrutura)
 */
function clearTestData() {
  const tablesToClear = ['tickets', 'users', 'cache', 'rate_limits']

  for (const table of tablesToClear) {
    try {
      testDb.exec(`DELETE FROM ${table}`)
    } catch (error) {
      // Ignorar se tabela não existir
    }
  }
}

/**
 * Criar usuário de teste
 */
export function createTestUser(data: {
  name?: string
  email?: string
  password_hash?: string
  role?: 'admin' | 'agent' | 'user'
} = {}) {
  const userData = {
    name: 'Test User',
    email: 'test@example.com',
    password_hash: '$2b$12$test.hash.for.testing',
    role: 'user' as const,
    ...data
  }

  const result = testDb.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(userData.name, userData.email, userData.password_hash, userData.role)

  return {
    id: result.lastInsertRowid,
    ...userData
  }
}

/**
 * Criar ticket de teste
 */
export function createTestTicket(data: {
  title?: string
  description?: string
  user_id?: number
  status_id?: number
  priority_id?: number
  category_id?: number
} = {}) {
  const ticketData = {
    title: 'Test Ticket',
    description: 'Test ticket description',
    user_id: 1,
    status_id: 1,
    priority_id: 3,
    category_id: 1,
    ...data
  }

  const result = testDb.prepare(`
    INSERT INTO tickets (title, description, user_id, status_id, priority_id, category_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ticketData.title,
    ticketData.description,
    ticketData.user_id,
    ticketData.status_id,
    ticketData.priority_id,
    ticketData.category_id
  )

  return {
    id: result.lastInsertRowid,
    ...ticketData
  }
}

/**
 * Obter banco de teste
 */
export function getTestDb() {
  return testDb
}

/**
 * Utilitário para criar mock de request
 */
export function createMockRequest(data: {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: any
  json?: () => Promise<any>
} = {}) {
  // Create a map with lowercase keys for case-insensitive header lookup
  const headersMap = new Map(
    Object.entries(data.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
  )

  const { headers, ...restData } = data

  return {
    method: 'GET',
    url: '/test',
    json: async () => data.body || {},
    ...restData,
    headers: {
      get: (key: string) => headersMap.get(key.toLowerCase()) || null,
      has: (key: string) => headersMap.has(key.toLowerCase()),
      forEach: (callback: (value: string, key: string) => void) => headersMap.forEach(callback),
    },
  }
}

/**
 * Utilitário para criar mock de response
 */
export function createMockResponse() {
  const response = {
    status: 200,
    headers: new Map(),
    body: null as any,
    json: (data: any) => {
      response.body = data
      return {
        status: response.status,
        headers: response.headers,
        json: async () => data
      }
    }
  }

  return response
}

/**
 * Aguardar um tempo determinado
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Executar teste com timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timeout after ${ms}ms`)), ms)
    )
  ])
}
