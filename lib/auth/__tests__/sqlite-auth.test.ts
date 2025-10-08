import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateUser,
  createUser,
  getUserByEmail,
  getUserById,
  updateUserPassword,
  emailExists,
  getAllUsers,
  updateUser,
  deleteUser,
  type AuthUser,
  type LoginCredentials,
  type RegisterData
} from '../sqlite-auth'

// Mock the database connection
vi.mock('@/lib/db/connection', () => ({
  default: {
    prepare: vi.fn()
  }
}))

// Mock Sentry helpers
vi.mock('@/lib/monitoring/sentry-helpers', () => ({
  captureDatabaseError: vi.fn(),
  captureAuthError: vi.fn()
}))

// Mock env validation
vi.mock('@/lib/config/env', () => ({
  validateJWTSecret: () => 'test-jwt-secret-minimum-32-characters-long-for-testing-purposes-only'
}))

describe('Authentication - Password Hashing', () => {
  it('should hash password successfully', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)

    expect(hash).toBeDefined()
    expect(hash).not.toBe(password)
    expect(hash.length).toBeGreaterThan(30)
    expect(hash.startsWith('$2b$')).toBe(true)
  })

  it('should generate different hashes for same password', async () => {
    const password = 'testPassword123!'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)

    expect(hash1).not.toBe(hash2)
  })

  it('should hash empty password', async () => {
    const hash = await hashPassword('')
    expect(hash).toBeDefined()
    expect(hash.startsWith('$2b$')).toBe(true)
  })

  it('should hash very long password', async () => {
    const longPassword = 'a'.repeat(200)
    const hash = await hashPassword(longPassword)
    expect(hash).toBeDefined()
    expect(hash.startsWith('$2b$')).toBe(true)
  })
})

describe('Authentication - Password Verification', () => {
  it('should verify correct password', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(password, hash)

    expect(isValid).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword('wrongPassword', hash)

    expect(isValid).toBe(false)
  })

  it('should reject empty password when hash is not empty', async () => {
    const password = 'testPassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword('', hash)

    expect(isValid).toBe(false)
  })

  it('should be case sensitive', async () => {
    const password = 'TestPassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword('testpassword123!', hash)

    expect(isValid).toBe(false)
  })
})

describe('Authentication - JWT Token Generation', () => {
  const mockUser: AuthUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    organization_id: 1,
    tenant_slug: 'test-org',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  it('should generate valid JWT token', async () => {
    const token = await generateToken(mockUser)

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3) // JWT format: header.payload.signature
  })

  it('should generate different tokens for different users', async () => {
    const user1 = { ...mockUser, id: 1, email: 'user1@example.com' }
    const user2 = { ...mockUser, id: 2, email: 'user2@example.com' }

    const token1 = await generateToken(user1)
    const token2 = await generateToken(user2)

    expect(token1).not.toBe(token2)
  })

  it('should include user data in token payload', async () => {
    const token = await generateToken(mockUser)
    const parts = token.split('.')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

    expect(payload.id).toBe(mockUser.id)
    expect(payload.email).toBe(mockUser.email)
    expect(payload.role).toBe(mockUser.role)
    expect(payload.organization_id).toBe(mockUser.organization_id)
    expect(payload.tenant_slug).toBe(mockUser.tenant_slug)
  })

  it('should set expiration time', async () => {
    const token = await generateToken(mockUser)
    const parts = token.split('.')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

    expect(payload.exp).toBeDefined()
    expect(payload.iat).toBeDefined()
    expect(payload.exp).toBeGreaterThan(payload.iat)
  })
})

describe('Authentication - JWT Token Verification', () => {
  const mockUser: AuthUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    organization_id: 1,
    tenant_slug: 'test-org',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should verify valid token and return user data', async () => {
    const db = await import('@/lib/db/connection')
    const token = await generateToken(mockUser)

    // Mock database calls
    vi.mocked(db.default.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        organization_id: mockUser.organization_id,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at
      })
    } as any)

    const user = await verifyToken(token)

    expect(user).toBeDefined()
    expect(user?.id).toBe(mockUser.id)
    expect(user?.email).toBe(mockUser.email)
  })

  it('should reject invalid token format', async () => {
    const user = await verifyToken('invalid.token.format')
    expect(user).toBeNull()
  })

  it('should reject empty token', async () => {
    const user = await verifyToken('')
    expect(user).toBeNull()
  })

  it('should reject token with wrong signature', async () => {
    const token = await generateToken(mockUser)
    const parts = token.split('.')
    const tamperedToken = `${parts[0]}.${parts[1]}.wrongsignature`

    const user = await verifyToken(tamperedToken)
    expect(user).toBeNull()
  })

  it('should validate tenant ID when provided', async () => {
    const db = await import('@/lib/db/connection')
    const token = await generateToken(mockUser)

    vi.mocked(db.default.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        organization_id: mockUser.organization_id,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at
      })
    } as any)

    // Verify with correct tenant ID
    const userValid = await verifyToken(token, mockUser.organization_id)
    expect(userValid).toBeDefined()

    // Verify with wrong tenant ID
    const userInvalid = await verifyToken(token, 999)
    expect(userInvalid).toBeNull()
  })
})

describe('Database - User Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getUserByEmail should return user when found', () => {
    const db = require('@/lib/db/connection').default
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'hash',
      role: 'user',
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(mockUser)
    } as any)

    const user = getUserByEmail('test@example.com')

    expect(user).toEqual(mockUser)
    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE email = ?')
  })

  it('getUserByEmail should return null when not found', () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined)
    } as any)

    const user = getUserByEmail('notfound@example.com')

    expect(user).toBeNull()
  })

  it('getUserById should return user when found', () => {
    const db = require('@/lib/db/connection').default
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(mockUser)
    } as any)

    const user = getUserById(1)

    expect(user).toEqual(mockUser)
    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?')
  })

  it('emailExists should return true when email exists', () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue({ id: 1 })
    } as any)

    const exists = emailExists('test@example.com')

    expect(exists).toBe(true)
  })

  it('emailExists should return false when email does not exist', () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined)
    } as any)

    const exists = emailExists('notfound@example.com')

    expect(exists).toBe(false)
  })

  it('getAllUsers should return array of users', () => {
    const db = require('@/lib/db/connection').default
    const mockUsers = [
      { id: 1, name: 'User 1', email: 'user1@example.com', role: 'user' },
      { id: 2, name: 'User 2', email: 'user2@example.com', role: 'agent' }
    ]

    vi.mocked(db.prepare).mockReturnValue({
      all: vi.fn().mockReturnValue(mockUsers)
    } as any)

    const users = getAllUsers()

    expect(users).toEqual(mockUsers)
    expect(users).toHaveLength(2)
  })

  it('deleteUser should return true when user is deleted', () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1 })
    } as any)

    const result = deleteUser(1)

    expect(result).toBe(true)
  })

  it('deleteUser should return false when user is not found', () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 0 })
    } as any)

    const result = deleteUser(999)

    expect(result).toBe(false)
  })
})

describe('Authentication - User Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createUser should hash password and create user', async () => {
    const db = require('@/lib/db/connection').default
    const userData: RegisterData = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      role: 'user'
    }

    const mockUser = {
      id: 1,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(mockUser)
    } as any)

    const user = await createUser(userData)

    expect(user).toBeDefined()
    expect(user?.email).toBe(userData.email)
  })

  it('createUser should use default role when not provided', async () => {
    const db = require('@/lib/db/connection').default
    const userData: RegisterData = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123'
    }

    const mockUser = {
      id: 1,
      name: userData.name,
      email: userData.email,
      role: 'user',
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(mockUser)
    } as any)

    const user = await createUser(userData)

    expect(user?.role).toBe('user')
  })
})

describe('Authentication - User Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authenticateUser should return user on valid credentials', async () => {
    const db = require('@/lib/db/connection').default
    const password = 'password123'
    const hash = await hashPassword(password)

    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: hash,
      role: 'user' as const,
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const mockOrg = {
      id: 1,
      slug: 'test-org',
      name: 'Test Organization'
    }

    let callCount = 0
    vi.mocked(db.prepare).mockImplementation(() => ({
      get: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return mockUser
        if (callCount === 2) return mockOrg
        return null
      })
    } as any))

    const credentials: LoginCredentials = {
      email: 'test@example.com',
      password: password
    }

    const user = await authenticateUser(credentials)

    expect(user).toBeDefined()
    expect(user?.email).toBe(credentials.email)
    expect(user?.id).toBe(mockUser.id)
    expect(user?.tenant_slug).toBe(mockOrg.slug)
  })

  it('authenticateUser should return null on invalid password', async () => {
    const db = require('@/lib/db/connection').default
    const hash = await hashPassword('correctPassword')

    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: hash,
      role: 'user',
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(mockUser)
    } as any)

    const credentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'wrongPassword'
    }

    const user = await authenticateUser(credentials)

    expect(user).toBeNull()
  })

  it('authenticateUser should return null on non-existent email', async () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined)
    } as any)

    const credentials: LoginCredentials = {
      email: 'notfound@example.com',
      password: 'password123'
    }

    const user = await authenticateUser(credentials)

    expect(user).toBeNull()
  })

  it('authenticateUser should return null when user has no password hash', async () => {
    const db = require('@/lib/db/connection').default

    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      password_hash: null,
      role: 'user',
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(mockUser)
    } as any)

    const credentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123'
    }

    const user = await authenticateUser(credentials)

    expect(user).toBeNull()
  })
})

describe('Authentication - Password Update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateUserPassword should hash new password and update', async () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1 })
    } as any)

    const result = await updateUserPassword(1, 'newPassword123')

    expect(result).toBe(true)
  })

  it('updateUserPassword should return false when user not found', async () => {
    const db = require('@/lib/db/connection').default

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 0 })
    } as any)

    const result = await updateUserPassword(999, 'newPassword123')

    expect(result).toBe(false)
  })
})

describe('Database - User Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updateUser should update user fields', () => {
    const db = require('@/lib/db/connection').default

    const updatedUser = {
      id: 1,
      name: 'Updated Name',
      email: 'updated@example.com',
      role: 'agent' as const,
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1 }),
      get: vi.fn().mockReturnValue(updatedUser)
    } as any)

    const result = updateUser(1, { name: 'Updated Name', role: 'agent' })

    expect(result).toBe(true)
  })

  it('updateUser should return false when no fields to update', () => {
    const db = require('@/lib/db/connection').default

    const existingUser = {
      id: 1,
      name: 'Existing Name',
      email: 'existing@example.com',
      role: 'user' as const,
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn().mockReturnValue(existingUser)
    } as any)

    const result = updateUser(1, {})

    expect(result).toBe(false)
  })
})
