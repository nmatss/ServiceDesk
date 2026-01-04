/**
 * Unit tests for mockDatabase utilities
 * Verifies database mocking helpers work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createInMemoryDatabase,
  initializeTestSchema,
  seedReferenceData,
  createMockUser,
  createMockTicket,
  createMockComment,
  createMockArticle,
  clearTestData,
  getRecordCount,
  setupTestDatabase,
  cleanupTestDatabase,
  type MockDatabase,
} from '../mockDatabase'

describe('mockDatabase - In-Memory Database', () => {
  let mockDb: MockDatabase

  beforeEach(() => {
    mockDb = createInMemoryDatabase()
  })

  afterEach(() => {
    if (mockDb) {
      mockDb.cleanup()
    }
  })

  it('should create an in-memory database', () => {
    expect(mockDb).toBeDefined()
    expect(mockDb.db).toBeDefined()
    expect(typeof mockDb.cleanup).toBe('function')
  })

  it('should enable foreign keys', () => {
    const result = mockDb.db.pragma('foreign_keys', { simple: true })
    expect(result).toBe(1)
  })

  it('should cleanup database properly', () => {
    expect(() => mockDb.cleanup()).not.toThrow()
  })
})

describe('mockDatabase - Schema Initialization', () => {
  let mockDb: MockDatabase

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should create users table', () => {
    const result = mockDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get()

    expect(result).toBeDefined()
  })

  it('should create tickets table', () => {
    const result = mockDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'")
      .get()

    expect(result).toBeDefined()
  })

  it('should create statuses table', () => {
    const result = mockDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='statuses'")
      .get()

    expect(result).toBeDefined()
  })

  it('should create priorities table', () => {
    const result = mockDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='priorities'")
      .get()

    expect(result).toBeDefined()
  })

  it('should create categories table', () => {
    const result = mockDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")
      .get()

    expect(result).toBeDefined()
  })
})

describe('mockDatabase - Seed Reference Data', () => {
  let mockDb: MockDatabase

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
    await seedReferenceData(mockDb.db)
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should seed statuses', () => {
    const count = getRecordCount(mockDb.db, 'statuses')
    expect(count).toBeGreaterThan(0)
  })

  it('should seed priorities', () => {
    const count = getRecordCount(mockDb.db, 'priorities')
    expect(count).toBeGreaterThan(0)
  })

  it('should seed categories', () => {
    const count = getRecordCount(mockDb.db, 'categories')
    expect(count).toBeGreaterThan(0)
  })

  it('should seed organizations', () => {
    const org = mockDb.db.prepare('SELECT * FROM organizations WHERE id = 1').get()
    expect(org).toBeDefined()
  })
})

describe('mockDatabase - Create Mock User', () => {
  let mockDb: MockDatabase

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
    await seedReferenceData(mockDb.db)
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should create a mock user with default values', async () => {
    const user = await createMockUser(mockDb.db)

    expect(user).toBeDefined()
    expect(user.id).toBeDefined()
    expect(user.name).toBe('Test User')
    expect(user.email).toContain('@example.com')
    expect(user.role).toBe('user')
  })

  it('should create a mock user with custom values', async () => {
    const user = await createMockUser(mockDb.db, {
      name: 'Custom User',
      email: 'custom@test.com',
      role: 'admin',
    })

    expect(user.name).toBe('Custom User')
    expect(user.email).toBe('custom@test.com')
    expect(user.role).toBe('admin')
  })

  it('should hash the password', async () => {
    const user = await createMockUser(mockDb.db, { password: 'SecurePass123!' })

    // Verify user is in database
    const dbUser = mockDb.db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(user.id) as any

    expect(dbUser.password_hash).toBeDefined()
    expect(dbUser.password_hash).not.toBe('SecurePass123!')
  })

  it('should generate unique emails for multiple users', async () => {
    const user1 = await createMockUser(mockDb.db)
    const user2 = await createMockUser(mockDb.db)

    expect(user1.email).not.toBe(user2.email)
  })
})

describe('mockDatabase - Create Mock Ticket', () => {
  let mockDb: MockDatabase
  let userId: number

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
    await seedReferenceData(mockDb.db)

    const user = await createMockUser(mockDb.db)
    userId = user.id as number
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should create a mock ticket with default values', () => {
    const ticket = createMockTicket(mockDb.db, { user_id: userId })

    expect(ticket).toBeDefined()
    expect(ticket.id).toBeDefined()
    expect(ticket.title).toBe('Test Ticket')
    expect(ticket.user_id).toBe(userId)
  })

  it('should create a mock ticket with custom values', () => {
    const ticket = createMockTicket(mockDb.db, {
      title: 'Custom Ticket',
      description: 'Custom description',
      user_id: userId,
      status_id: 2,
      priority_id: 1,
    })

    expect(ticket.title).toBe('Custom Ticket')
    expect(ticket.description).toBe('Custom description')
    expect(ticket.status_id).toBe(2)
    expect(ticket.priority_id).toBe(1)
  })
})

describe('mockDatabase - Create Mock Comment', () => {
  let mockDb: MockDatabase
  let ticketId: number
  let userId: number

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
    await seedReferenceData(mockDb.db)

    const user = await createMockUser(mockDb.db)
    userId = user.id as number

    const ticket = createMockTicket(mockDb.db, { user_id: userId })
    ticketId = ticket.id as number
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should create a mock comment', () => {
    const comment = createMockComment(mockDb.db, {
      ticket_id: ticketId,
      user_id: userId,
      content: 'Test comment',
    })

    expect(comment).toBeDefined()
    expect(comment.id).toBeDefined()
    expect(comment.content).toBe('Test comment')
  })

  it('should create internal comments', () => {
    const comment = createMockComment(mockDb.db, {
      ticket_id: ticketId,
      user_id: userId,
      content: 'Internal note',
      is_internal: true,
    })

    expect(comment.is_internal).toBe(true)
  })
})

describe('mockDatabase - Create Mock Article', () => {
  let mockDb: MockDatabase
  let authorId: number

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
    await seedReferenceData(mockDb.db)

    const user = await createMockUser(mockDb.db)
    authorId = user.id as number
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should create a mock article', () => {
    const article = createMockArticle(mockDb.db, { author_id: authorId })

    expect(article).toBeDefined()
    expect(article.id).toBeDefined()
    expect(article.title).toBe('Test Article')
    expect(article.author_id).toBe(authorId)
  })

  it('should create unique slugs', () => {
    const article1 = createMockArticle(mockDb.db, { author_id: authorId })
    const article2 = createMockArticle(mockDb.db, { author_id: authorId })

    expect(article1.slug).not.toBe(article2.slug)
  })
})

describe('mockDatabase - Utility Functions', () => {
  let mockDb: MockDatabase

  beforeEach(async () => {
    mockDb = createInMemoryDatabase()
    await initializeTestSchema(mockDb.db)
    await seedReferenceData(mockDb.db)
  })

  afterEach(() => {
    mockDb.cleanup()
  })

  it('should clear test data', async () => {
    await createMockUser(mockDb.db)
    await createMockUser(mockDb.db)

    expect(getRecordCount(mockDb.db, 'users')).toBeGreaterThan(0)

    clearTestData(mockDb.db)

    expect(getRecordCount(mockDb.db, 'users')).toBe(0)
  })

  it('should get record count', async () => {
    await createMockUser(mockDb.db)
    await createMockUser(mockDb.db)
    await createMockUser(mockDb.db)

    const count = getRecordCount(mockDb.db, 'users')
    expect(count).toBe(3)
  })
})

describe('mockDatabase - Setup and Cleanup', () => {
  it('should setup complete test database', async () => {
    const mockDb = await setupTestDatabase()

    expect(mockDb).toBeDefined()
    expect(mockDb.db).toBeDefined()

    // Verify schema
    const tables = mockDb.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()

    expect(tables.length).toBeGreaterThan(0)

    // Verify reference data
    expect(getRecordCount(mockDb.db, 'statuses')).toBeGreaterThan(0)
    expect(getRecordCount(mockDb.db, 'priorities')).toBeGreaterThan(0)

    cleanupTestDatabase(mockDb)
  })
})
