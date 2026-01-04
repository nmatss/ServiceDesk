/**
 * Authentication Mocking Utilities
 * Provides helpers for mocking authentication and authorization in tests
 */

import { generateToken, hashPassword } from '@/lib/auth/sqlite-auth'
import type { NextRequest } from 'next/server'

export interface MockUser {
  id: number
  name: string
  email: string
  role: 'admin' | 'agent' | 'user'
  organization_id: number
  tenant_slug: string
  created_at: string
  updated_at: string
}

/**
 * Create a mock user object
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  const now = new Date().toISOString()
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    organization_id: 1,
    tenant_slug: 'default',
    created_at: now,
    updated_at: now,
    ...overrides
  }
}

/**
 * Create a mock admin user
 */
export function createMockAdmin(overrides?: Partial<MockUser>): MockUser {
  return createMockUser({
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides
  })
}

/**
 * Create a mock agent user
 */
export function createMockAgent(overrides?: Partial<MockUser>): MockUser {
  return createMockUser({
    name: 'Agent User',
    email: 'agent@example.com',
    role: 'agent',
    ...overrides
  })
}

/**
 * Generate a JWT token for a mock user
 */
export async function createMockToken(user?: Partial<MockUser>): Promise<string> {
  const mockUser = createMockUser(user)
  return await generateToken(mockUser)
}

/**
 * Generate an admin JWT token
 */
export async function createAdminToken(user?: Partial<MockUser>): Promise<string> {
  const adminUser = createMockAdmin(user)
  return await generateToken(adminUser)
}

/**
 * Generate an agent JWT token
 */
export async function createAgentToken(user?: Partial<MockUser>): Promise<string> {
  const agentUser = createMockAgent(user)
  return await generateToken(agentUser)
}

/**
 * Create mock request headers with authentication token
 */
export function createAuthHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Create mock authenticated request
 */
export async function createAuthenticatedRequest(
  options?: {
    method?: string
    url?: string
    body?: any
    headers?: Record<string, string>
    user?: Partial<MockUser>
  }
): Promise<any> {
  const token = await createMockToken(options?.user)

  const headers = {
    ...createAuthHeaders(token),
    ...options?.headers,
  }

  return createMockRequest({
    method: options?.method || 'GET',
    url: options?.url || '/api/test',
    headers,
    body: options?.body,
  })
}

/**
 * Create mock admin request
 */
export async function createAdminRequest(
  options?: {
    method?: string
    url?: string
    body?: any
    headers?: Record<string, string>
    user?: Partial<MockUser>
  }
): Promise<any> {
  const token = await createAdminToken(options?.user)

  const headers = {
    ...createAuthHeaders(token),
    ...options?.headers,
  }

  return createMockRequest({
    method: options?.method || 'GET',
    url: options?.url || '/api/admin/test',
    headers,
    body: options?.body,
  })
}

/**
 * Create mock agent request
 */
export async function createAgentRequest(
  options?: {
    method?: string
    url?: string
    body?: any
    headers?: Record<string, string>
    user?: Partial<MockUser>
  }
): Promise<any> {
  const token = await createAgentToken(options?.user)

  const headers = {
    ...createAuthHeaders(token),
    ...options?.headers,
  }

  return createMockRequest({
    method: options?.method || 'GET',
    url: options?.url || '/api/agent/test',
    headers,
    body: options?.body,
  })
}

/**
 * Create generic mock request
 */
export function createMockRequest(options?: {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: any
  cookies?: Map<string, string>
}): any {
  const headersMap = new Map(
    Object.entries(options?.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
  )

  const cookiesMap = options?.cookies || new Map()

  return {
    method: options?.method || 'GET',
    url: options?.url || '/api/test',
    headers: {
      get: (key: string) => headersMap.get(key.toLowerCase()) || null,
      has: (key: string) => headersMap.has(key.toLowerCase()),
      forEach: (callback: (value: string, key: string) => void) => headersMap.forEach(callback),
      entries: () => headersMap.entries(),
      keys: () => headersMap.keys(),
      values: () => headersMap.values(),
    },
    cookies: {
      get: (name: string) => cookiesMap.get(name),
      has: (name: string) => cookiesMap.has(name),
      getAll: () => Array.from(cookiesMap.entries()).map(([name, value]) => ({ name, value })),
    },
    json: async () => options?.body || {},
    text: async () => JSON.stringify(options?.body || {}),
    formData: async () => new FormData(),
  }
}

/**
 * Create mock response object
 */
export function createMockResponse(): {
  status: number
  statusText: string
  headers: Map<string, string>
  body: any
  ok: boolean
  json: (data: any) => any
  text: (data: string) => any
  redirect: (url: string, status?: number) => any
} {
  const response = {
    status: 200,
    statusText: 'OK',
    headers: new Map<string, string>(),
    body: null as any,
    ok: true,
    json: (data: any) => {
      response.body = data
      response.headers.set('content-type', 'application/json')
      return {
        ...response,
        json: async () => data
      }
    },
    text: (data: string) => {
      response.body = data
      response.headers.set('content-type', 'text/plain')
      return {
        ...response,
        text: async () => data
      }
    },
    redirect: (url: string, status = 302) => {
      response.status = status
      response.headers.set('location', url)
      return response
    }
  }

  return response
}

/**
 * Mock NextResponse for testing
 */
export function mockNextResponse(data: any, status = 200): any {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Map([['content-type', 'application/json']]),
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

/**
 * Extract user from authorization header
 */
export function extractUserFromAuth(authHeader: string | null): MockUser | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    // Decode JWT payload (without verification for testing)
    const [, payloadBase64] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())

    return {
      id: payload.id,
      name: payload.name || 'Test User',
      email: payload.email,
      role: payload.role,
      organization_id: payload.organization_id,
      tenant_slug: payload.tenant_slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Mock user credentials for testing
 */
export interface MockCredentials {
  email: string
  password: string
  role: 'admin' | 'agent' | 'user'
}

/**
 * Get default test credentials
 */
export function getTestCredentials(): {
  admin: MockCredentials
  agent: MockCredentials
  user: MockCredentials
} {
  return {
    admin: {
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin',
    },
    agent: {
      email: 'agent@example.com',
      password: 'Agent123!',
      role: 'agent',
    },
    user: {
      email: 'user@example.com',
      password: 'User123!',
      role: 'user',
    }
  }
}

/**
 * Mock password hash (for testing without actual bcrypt)
 */
export async function mockHashPassword(password: string): Promise<string> {
  return hashPassword(password)
}

/**
 * Create a complete mock authentication context
 */
export interface MockAuthContext {
  user: MockUser
  token: string
  headers: Record<string, string>
  request: any
}

/**
 * Setup authentication context for tests
 */
export async function setupAuthContext(
  role: 'admin' | 'agent' | 'user' = 'user',
  overrides?: Partial<MockUser>
): Promise<MockAuthContext> {
  let user: MockUser

  switch (role) {
    case 'admin':
      user = createMockAdmin(overrides)
      break
    case 'agent':
      user = createMockAgent(overrides)
      break
    default:
      user = createMockUser(overrides)
  }

  const token = await generateToken(user)
  const headers = createAuthHeaders(token)
  const request = createMockRequest({ headers })

  return {
    user,
    token,
    headers,
    request
  }
}

/**
 * Verify mock token structure (without actual verification)
 */
export function verifyMockToken(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    // Try to decode payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

    return !!(payload.id && payload.email && payload.role)
  } catch {
    return false
  }
}
