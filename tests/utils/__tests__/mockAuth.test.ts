/**
 * Unit tests for mockAuth utilities
 * Verifies authentication mocking helpers work correctly
 */

import { describe, it, expect } from 'vitest'
import {
  createMockUser,
  createMockAdmin,
  createMockAgent,
  createMockToken,
  createAdminToken,
  createAgentToken,
  createAuthHeaders,
  createAuthenticatedRequest,
  createMockRequest,
  createMockResponse,
  mockNextResponse,
  extractUserFromAuth,
  getTestCredentials,
  setupAuthContext,
  verifyMockToken,
} from '../mockAuth'

describe('mockAuth - Mock User Creation', () => {
  it('should create a mock user with default values', () => {
    const user = createMockUser()

    expect(user).toBeDefined()
    expect(user.id).toBe(1)
    expect(user.name).toBe('Test User')
    expect(user.email).toBe('test@example.com')
    expect(user.role).toBe('user')
    expect(user.organization_id).toBe(1)
    expect(user.tenant_slug).toBe('default')
  })

  it('should create a mock user with custom values', () => {
    const user = createMockUser({
      id: 999,
      name: 'Custom User',
      email: 'custom@test.com',
      role: 'agent',
    })

    expect(user.id).toBe(999)
    expect(user.name).toBe('Custom User')
    expect(user.email).toBe('custom@test.com')
    expect(user.role).toBe('agent')
  })

  it('should create a mock admin user', () => {
    const admin = createMockAdmin()

    expect(admin.role).toBe('admin')
    expect(admin.email).toBe('admin@example.com')
  })

  it('should create a mock agent user', () => {
    const agent = createMockAgent()

    expect(agent.role).toBe('agent')
    expect(agent.email).toBe('agent@example.com')
  })
})

describe('mockAuth - Token Generation', () => {
  it('should generate a valid JWT token', async () => {
    const token = await createMockToken()

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('should generate an admin token', async () => {
    const token = await createAdminToken()

    expect(token).toBeDefined()
    expect(verifyMockToken(token)).toBe(true)

    // Decode and verify role
    const [, payloadBase64] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
    expect(payload.role).toBe('admin')
  })

  it('should generate an agent token', async () => {
    const token = await createAgentToken()

    expect(token).toBeDefined()
    expect(verifyMockToken(token)).toBe(true)

    const [, payloadBase64] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
    expect(payload.role).toBe('agent')
  })

  it('should include user data in token', async () => {
    const user = createMockUser({
      id: 123,
      email: 'test@example.com',
      role: 'user',
    })

    const token = await createMockToken(user)
    const [, payloadBase64] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())

    expect(payload.id).toBe(123)
    expect(payload.email).toBe('test@example.com')
    expect(payload.role).toBe('user')
  })
})

describe('mockAuth - Auth Headers', () => {
  it('should create auth headers with token', () => {
    const token = 'test-token-123'
    const headers = createAuthHeaders(token)

    expect(headers).toBeDefined()
    expect(headers['Authorization']).toBe(`Bearer ${token}`)
    expect(headers['Content-Type']).toBe('application/json')
  })
})

describe('mockAuth - Mock Requests', () => {
  it('should create a basic mock request', () => {
    const request = createMockRequest()

    expect(request).toBeDefined()
    expect(request.method).toBe('GET')
    expect(request.url).toBe('/api/test')
  })

  it('should create mock request with custom options', () => {
    const request = createMockRequest({
      method: 'POST',
      url: '/api/tickets',
      headers: { 'X-Custom': 'value' },
      body: { title: 'Test' },
    })

    expect(request.method).toBe('POST')
    expect(request.url).toBe('/api/tickets')
    expect(request.headers.get('x-custom')).toBe('value')
  })

  it('should handle headers case-insensitively', () => {
    const request = createMockRequest({
      headers: { 'Content-Type': 'application/json' },
    })

    expect(request.headers.get('content-type')).toBe('application/json')
    expect(request.headers.get('Content-Type')).toBe('application/json')
    expect(request.headers.get('CONTENT-TYPE')).toBe('application/json')
  })

  it('should create authenticated request', async () => {
    const request = await createAuthenticatedRequest({
      method: 'POST',
      url: '/api/tickets',
      body: { title: 'Test Ticket' },
    })

    expect(request).toBeDefined()
    expect(request.headers.get('authorization')).toContain('Bearer ')
  })

  it('should create admin request', async () => {
    const request = await createAuthenticatedRequest({
      method: 'GET',
      url: '/api/admin/users',
      user: { role: 'admin' },
    })

    const authHeader = request.headers.get('authorization')
    expect(authHeader).toContain('Bearer ')

    const token = authHeader!.substring(7)
    const [, payloadBase64] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
    expect(payload.role).toBe('admin')
  })
})

describe('mockAuth - Mock Response', () => {
  it('should create a mock response', () => {
    const response = createMockResponse()

    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
  })

  it('should create JSON response', () => {
    const response = createMockResponse()
    const data = { success: true, message: 'Test' }

    const jsonResponse = response.json(data)

    expect(jsonResponse.body).toEqual(data)
  })

  it('should create text response', () => {
    const response = createMockResponse()
    const text = 'Hello World'

    const textResponse = response.text(text)

    expect(textResponse.body).toBe(text)
  })

  it('should create redirect response', () => {
    const response = createMockResponse()
    const redirectResponse = response.redirect('/login', 302)

    expect(redirectResponse.status).toBe(302)
    expect(redirectResponse.headers.get('location')).toBe('/login')
  })
})

describe('mockAuth - NextResponse Mock', () => {
  it('should mock NextResponse JSON', async () => {
    const data = { success: true, message: 'Test' }
    const response = mockNextResponse(data)

    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
    expect(await response.json()).toEqual(data)
  })

  it('should mock NextResponse with custom status', async () => {
    const data = { error: 'Not found' }
    const response = mockNextResponse(data, 404)

    expect(response.status).toBe(404)
    expect(response.ok).toBe(false)
  })
})

describe('mockAuth - Extract User from Auth', () => {
  it('should extract user from valid auth header', async () => {
    const mockUser = createMockUser({ id: 123, email: 'test@example.com' })
    const token = await createMockToken(mockUser)
    const authHeader = `Bearer ${token}`

    const user = extractUserFromAuth(authHeader)

    expect(user).toBeDefined()
    expect(user!.id).toBe(123)
    expect(user!.email).toBe('test@example.com')
  })

  it('should return null for invalid auth header', () => {
    const user = extractUserFromAuth('Invalid Header')
    expect(user).toBeNull()
  })

  it('should return null for missing Bearer prefix', () => {
    const user = extractUserFromAuth('token-without-bearer')
    expect(user).toBeNull()
  })

  it('should return null for null header', () => {
    const user = extractUserFromAuth(null)
    expect(user).toBeNull()
  })
})

describe('mockAuth - Test Credentials', () => {
  it('should provide test credentials', () => {
    const credentials = getTestCredentials()

    expect(credentials).toBeDefined()
    expect(credentials.admin).toBeDefined()
    expect(credentials.agent).toBeDefined()
    expect(credentials.user).toBeDefined()

    expect(credentials.admin.role).toBe('admin')
    expect(credentials.agent.role).toBe('agent')
    expect(credentials.user.role).toBe('user')
  })
})

describe('mockAuth - Auth Context Setup', () => {
  it('should setup user auth context', async () => {
    const context = await setupAuthContext('user')

    expect(context).toBeDefined()
    expect(context.user).toBeDefined()
    expect(context.token).toBeDefined()
    expect(context.headers).toBeDefined()
    expect(context.request).toBeDefined()

    expect(context.user.role).toBe('user')
  })

  it('should setup admin auth context', async () => {
    const context = await setupAuthContext('admin')

    expect(context.user.role).toBe('admin')
  })

  it('should setup agent auth context', async () => {
    const context = await setupAuthContext('agent')

    expect(context.user.role).toBe('agent')
  })

  it('should allow custom user overrides', async () => {
    const context = await setupAuthContext('user', {
      id: 999,
      name: 'Custom Name',
    })

    expect(context.user.id).toBe(999)
    expect(context.user.name).toBe('Custom Name')
  })
})

describe('mockAuth - Token Verification', () => {
  it('should verify valid token structure', async () => {
    const token = await createMockToken()
    expect(verifyMockToken(token)).toBe(true)
  })

  it('should reject invalid token format', () => {
    expect(verifyMockToken('invalid.token')).toBe(false)
    expect(verifyMockToken('not-a-token')).toBe(false)
    expect(verifyMockToken('')).toBe(false)
  })

  it('should reject malformed payload', () => {
    const invalidToken = 'header.invalid-base64.signature'
    expect(verifyMockToken(invalidToken)).toBe(false)
  })
})
