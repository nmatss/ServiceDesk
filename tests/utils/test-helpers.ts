/**
 * Test Helpers and Utilities
 * Common test utilities for unit testing critical business logic
 */

import { vi } from 'vitest'
import type { Database } from 'better-sqlite3'

// ============================================================================
// Database Mock Helpers
// ============================================================================

/**
 * Create a mock database instance for testing
 */
export function createMockDb() {
  const data = new Map<string, any>()
  const lastIds = new Map<string, number>()

  const db = {
    get: vi.fn((key?: string) => {
      if (key) return data.get(key)
      return undefined
    }),
    all: vi.fn(() => Array.from(data.values())),
    run: vi.fn((query?: string, params?: any[]) => {
      if (query?.includes('INSERT')) {
        const table = extractTableName(query) || 'default'
        const currentId = lastIds.get(table) || 0
        const newId = currentId + 1
        lastIds.set(table, newId)
        return { lastID: newId, changes: 1 }
      }
      if (query?.includes('UPDATE') || query?.includes('DELETE')) {
        return { changes: 1 }
      }
      return { changes: 0 }
    }),
    prepare: vi.fn((query: string) => ({
      get: vi.fn((params?: any) => data.get(params?.[0]) || null),
      all: vi.fn(() => Array.from(data.values())),
      run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
    })),
    exec: vi.fn(),
    transaction: vi.fn((fn: Function) => fn),
    _setData: (key: any, value: any) => data.set(key, value),
    _getData: (key: any) => data.get(key),
    _clear: () => {
      data.clear()
      lastIds.clear()
    },
    _getAllData: () => Array.from(data.values()),
  }

  return db
}

/**
 * Extract table name from SQL query
 */
function extractTableName(query: string): string | null {
  const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)/i)
  if (insertMatch) return insertMatch[1]

  const updateMatch = query.match(/UPDATE\s+(\w+)/i)
  if (updateMatch) return updateMatch[1]

  return null
}

// ============================================================================
// Test Data Builders
// ============================================================================

/**
 * Build a test ticket object
 */
export function buildTicket(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: 'Test Ticket',
    description: 'Test ticket description for testing purposes',
    status_id: 1,
    priority_id: 3,
    category_id: 1,
    user_id: 1,
    organization_id: 1,
    assigned_to: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resolved_at: null,
    ...overrides,
  }
}

/**
 * Build a test user object
 */
export function buildUser(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password_hash: '$2b$12$test.hash.for.testing',
    role: 'user' as const,
    organization_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Build a test admin user
 */
export function buildAdmin(overrides: Partial<any> = {}) {
  return buildUser({
    id: 2,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides,
  })
}

/**
 * Build a test agent user
 */
export function buildAgent(overrides: Partial<any> = {}) {
  return buildUser({
    id: 3,
    name: 'Agent User',
    email: 'agent@example.com',
    role: 'agent',
    ...overrides,
  })
}

/**
 * Build a test comment
 */
export function buildComment(overrides: Partial<any> = {}) {
  return {
    id: 1,
    ticket_id: 1,
    user_id: 1,
    content: 'Test comment content',
    is_internal: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Build a test SLA policy
 */
export function buildSLAPolicy(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: 'Standard SLA',
    priority_id: 3,
    response_time_hours: 24,
    resolution_time_hours: 72,
    is_active: true,
    organization_id: 1,
    ...overrides,
  }
}

/**
 * Build a test workflow
 */
export function buildWorkflow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    name: 'Test Workflow',
    description: 'Test workflow for automation',
    trigger_type: 'ticket_created',
    is_active: true,
    organization_id: 1,
    actions: [],
    ...overrides,
  }
}

/**
 * Build a test knowledge base article
 */
export function buildKBArticle(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: 'Test Article',
    content: 'Test article content',
    category_id: 1,
    author_id: 1,
    is_published: true,
    views: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that actual matches expected object properties
 */
export function expectToMatchObject(actual: any, expected: any) {
  expect(actual).toMatchObject(expected)
}

/**
 * Assert that array contains object with properties
 */
export function expectArrayToContainObject(array: any[], expected: any) {
  const match = array.some(item =>
    Object.keys(expected).every(key => item[key] === expected[key])
  )
  expect(match).toBe(true)
}

/**
 * Assert that value is a valid ISO date string
 */
export function expectToBeISODate(value: any) {
  expect(typeof value).toBe('string')
  expect(new Date(value).toString()).not.toBe('Invalid Date')
}

/**
 * Assert that value is within range
 */
export function expectToBeInRange(value: number, min: number, max: number) {
  expect(value).toBeGreaterThanOrEqual(min)
  expect(value).toBeLessThanOrEqual(max)
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Create a mock repository with common CRUD operations
 */
export function createMockRepository<T = any>() {
  const items: T[] = []
  let nextId = 1

  return {
    items,
    create: vi.fn(async (data: Partial<T>): Promise<T> => {
      const item = { id: nextId++, ...data } as T
      items.push(item)
      return item
    }),
    findById: vi.fn(async (id: number): Promise<T | null> => {
      return items.find((item: any) => item.id === id) || null
    }),
    findAll: vi.fn(async (): Promise<T[]> => {
      return items
    }),
    update: vi.fn(async (id: number, data: Partial<T>): Promise<T | null> => {
      const index = items.findIndex((item: any) => item.id === id)
      if (index >= 0) {
        items[index] = { ...items[index], ...data }
        return items[index]
      }
      return null
    }),
    delete: vi.fn(async (id: number): Promise<boolean> => {
      const index = items.findIndex((item: any) => item.id === id)
      if (index >= 0) {
        items.splice(index, 1)
        return true
      }
      return false
    }),
    clear: () => {
      items.length = 0
      nextId = 1
    },
  }
}

/**
 * Create a mock cache implementation
 */
export function createMockCache() {
  const cache = new Map<string, { value: any; expiresAt: number }>()

  return {
    get: vi.fn(async (key: string) => {
      const entry = cache.get(key)
      if (!entry) return null
      if (Date.now() > entry.expiresAt) {
        cache.delete(key)
        return null
      }
      return entry.value
    }),
    set: vi.fn(async (key: string, value: any, ttl: number = 3600) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      })
    }),
    delete: vi.fn(async (key: string) => {
      return cache.delete(key)
    }),
    clear: vi.fn(async () => {
      cache.clear()
    }),
    has: vi.fn(async (key: string) => {
      const entry = cache.get(key)
      if (!entry) return false
      if (Date.now() > entry.expiresAt) {
        cache.delete(key)
        return false
      }
      return true
    }),
    _cache: cache,
  }
}

// ============================================================================
// Time Helpers
// ============================================================================

/**
 * Create a date in the past
 */
export function pastDate(hoursAgo: number): string {
  const date = new Date()
  date.setHours(date.getHours() - hoursAgo)
  return date.toISOString()
}

/**
 * Create a date in the future
 */
export function futureDate(hoursFromNow: number): string {
  const date = new Date()
  date.setHours(date.getHours() + hoursFromNow)
  return date.toISOString()
}

/**
 * Wait for async operations to complete
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if object has required properties
 */
export function hasRequiredProperties(obj: any, properties: string[]): boolean {
  return properties.every(prop => obj.hasOwnProperty(prop))
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
}

// ============================================================================
// Mock HTTP Helpers
// ============================================================================

/**
 * Create a mock HTTP request
 */
export function createMockRequest(options: {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: any
  params?: Record<string, string>
  query?: Record<string, string>
} = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/test',
    headers: new Map(Object.entries(options.headers || {})),
    body: options.body,
    params: options.params || {},
    query: options.query || {},
    json: async () => options.body,
  }
}

/**
 * Create a mock HTTP response
 */
export function createMockResponse() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  }
  return response
}

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Create a validation error
 */
export function createValidationError(field: string, message: string) {
  return {
    name: 'ValidationError',
    field,
    message,
  }
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string, id: number | string) {
  return {
    name: 'NotFoundError',
    message: `${resource} with id ${id} not found`,
  }
}
