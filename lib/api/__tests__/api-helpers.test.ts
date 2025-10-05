/**
 * Unit Tests for API Helpers
 */

import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import {
  getUserFromRequest,
  getTenantFromRequest,
  requireAdmin,
  requireRole,
  validateTenantAccess,
  parseJSONBody,
  parseQueryParams,
  successResponse,
  paginatedResponse,
  getIdFromParams,
} from '../api-helpers'
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '@/lib/errors/error-handler'

describe('getUserFromRequest', () => {
  it('should extract user from request headers', () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: {
        'x-user-id': '123',
        'x-organization-id': '456',
        'x-user-role': 'admin',
      },
    })

    const user = getUserFromRequest(request as any)

    expect(user).toEqual({
      id: 123,
      organization_id: 456,
      role: 'admin',
      email: '',
    })
  })

  it('should throw AuthenticationError if headers are missing', () => {
    const request = new Request('http://localhost:3000/api/test')

    expect(() => getUserFromRequest(request as any)).toThrow(AuthenticationError)
  })

  it('should throw AuthenticationError if user_id is missing', () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: {
        'x-organization-id': '456',
        'x-user-role': 'admin',
      },
    })

    expect(() => getUserFromRequest(request as any)).toThrow(AuthenticationError)
  })
})

describe('getTenantFromRequest', () => {
  it('should extract tenant from request headers', () => {
    const request = new Request('http://localhost:3000/api/test', {
      headers: {
        'x-tenant-id': '1',
        'x-tenant-slug': 'demo',
        'x-tenant-name': 'Demo Tenant',
      },
    })

    const tenant = getTenantFromRequest(request as any)

    expect(tenant).toEqual({
      id: 1,
      slug: 'demo',
      name: 'Demo Tenant',
    })
  })

  it('should throw error if tenant headers are missing', () => {
    const request = new Request('http://localhost:3000/api/test')

    expect(() => getTenantFromRequest(request as any)).toThrow('Tenant context not found')
  })
})

describe('requireAdmin', () => {
  it('should allow admin roles', () => {
    const adminRoles = ['super_admin', 'tenant_admin', 'team_manager', 'admin']

    adminRoles.forEach((role) => {
      const user = {
        id: 1,
        organization_id: 1,
        role,
        email: 'admin@example.com',
      }

      expect(() => requireAdmin(user)).not.toThrow()
    })
  })

  it('should reject non-admin roles', () => {
    const nonAdminRoles = ['agent', 'user', 'guest']

    nonAdminRoles.forEach((role) => {
      const user = {
        id: 1,
        organization_id: 1,
        role,
        email: 'user@example.com',
      }

      expect(() => requireAdmin(user)).toThrow(AuthorizationError)
      expect(() => requireAdmin(user)).toThrow('Admin access required')
    })
  })
})

describe('requireRole', () => {
  it('should allow users with correct role', () => {
    const user = {
      id: 1,
      organization_id: 1,
      role: 'agent',
      email: 'agent@example.com',
    }

    expect(() => requireRole(user, ['agent', 'admin'])).not.toThrow()
  })

  it('should reject users without correct role', () => {
    const user = {
      id: 1,
      organization_id: 1,
      role: 'user',
      email: 'user@example.com',
    }

    expect(() => requireRole(user, ['agent', 'admin'])).toThrow(AuthorizationError)
    expect(() => requireRole(user, ['agent', 'admin'])).toThrow('Required role: agent, admin')
  })
})

describe('validateTenantAccess', () => {
  it('should allow access when organization_ids match', () => {
    const user = {
      id: 1,
      organization_id: 1,
      role: 'user',
      email: 'user@example.com',
    }

    expect(() => validateTenantAccess(user, 1)).not.toThrow()
  })

  it('should deny access when organization_ids do not match', () => {
    const user = {
      id: 1,
      organization_id: 1,
      role: 'admin',
      email: 'admin@example.com',
    }

    expect(() => validateTenantAccess(user, 2)).toThrow(AuthorizationError)
    expect(() => validateTenantAccess(user, 2)).toThrow(
      'Access denied: resource belongs to different organization'
    )
  })
})

describe('parseJSONBody', () => {
  it('should parse and validate JSON body', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const body = { name: 'John', age: 30 }
    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const result = await parseJSONBody(request as any, schema)
    expect(result).toEqual(body)
  })

  it('should throw ValidationError for invalid data', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', age: 'invalid' }),
    })

    await expect(parseJSONBody(request as any, schema)).rejects.toThrow(ValidationError)
  })

  it('should throw ValidationError for invalid JSON', async () => {
    const schema = z.object({ name: z.string() })

    const request = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })

    await expect(parseJSONBody(request as any, schema)).rejects.toThrow(ValidationError)
  })
})

describe('parseQueryParams', () => {
  function createMockRequest(url: string) {
    const parsedUrl = new URL(url)
    return {
      nextUrl: {
        searchParams: parsedUrl.searchParams,
      },
    } as any
  }

  it('should parse and validate query parameters', () => {
    const schema = z.object({
      page: z.number(),
      limit: z.number(),
      search: z.string().optional(),
    })

    const request = createMockRequest('http://localhost:3000/api/test?page=1&limit=25&search=test')

    const result = parseQueryParams(request, schema)
    expect(result).toEqual({
      page: 1,
      limit: 25,
      search: 'test',
    })
  })

  it('should convert numeric strings to numbers', () => {
    const schema = z.object({
      id: z.number(),
    })

    const request = createMockRequest('http://localhost:3000/api/test?id=123')

    const result = parseQueryParams(request, schema)
    expect(result.id).toBe(123)
    expect(typeof result.id).toBe('number')
  })

  it('should throw ValidationError for invalid params', () => {
    const schema = z.object({
      page: z.number().min(1),
    })

    const request = createMockRequest('http://localhost:3000/api/test?page=0')

    expect(() => parseQueryParams(request, schema)).toThrow(ValidationError)
  })
})

describe('successResponse', () => {
  it('should create success response', () => {
    const data = { id: 1, name: 'Test' }
    const response = successResponse(data)

    expect(response).toEqual({
      success: true,
      data,
    })
  })

  it('should include optional message and meta', () => {
    const data = { id: 1 }
    const message = 'Operation successful'
    const meta = { timestamp: '2024-01-01' }

    const response = successResponse(data, message, meta)

    expect(response).toEqual({
      success: true,
      data,
      message,
      meta,
    })
  })
})

describe('paginatedResponse', () => {
  it('should create paginated response', () => {
    const data = [{ id: 1 }, { id: 2 }]
    const response = paginatedResponse(data, 1, 10, 50)

    expect(response).toEqual({
      success: true,
      data,
      meta: {
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
      },
    })
  })

  it('should calculate total pages correctly', () => {
    expect(paginatedResponse([], 1, 10, 95).meta.totalPages).toBe(10)
    expect(paginatedResponse([], 1, 10, 100).meta.totalPages).toBe(10)
    expect(paginatedResponse([], 1, 25, 50).meta.totalPages).toBe(2)
    expect(paginatedResponse([], 1, 25, 51).meta.totalPages).toBe(3)
  })
})

describe('getIdFromParams', () => {
  it('should extract and parse id from params', () => {
    const params = { id: '123' }
    const id = getIdFromParams(params)

    expect(id).toBe(123)
    expect(typeof id).toBe('number')
  })

  it('should extract custom param name', () => {
    const params = { ticketId: '456' }
    const id = getIdFromParams(params, 'ticketId')

    expect(id).toBe(456)
  })

  it('should throw ValidationError if params are undefined', () => {
    expect(() => getIdFromParams(undefined)).toThrow(ValidationError)
    expect(() => getIdFromParams(undefined)).toThrow('Missing id parameter')
  })

  it('should throw ValidationError if param is missing', () => {
    const params = { other: '123' }

    expect(() => getIdFromParams(params)).toThrow(ValidationError)
    expect(() => getIdFromParams(params)).toThrow('Missing id parameter')
  })

  it('should throw ValidationError for invalid id', () => {
    expect(() => getIdFromParams({ id: 'abc' })).toThrow(ValidationError)
    expect(() => getIdFromParams({ id: '0' })).toThrow(ValidationError)
    expect(() => getIdFromParams({ id: '-1' })).toThrow(ValidationError)
    expect(() => getIdFromParams({ id: '1.5' })).toThrow(ValidationError)
  })

  it('should throw ValidationError with custom param name', () => {
    const params = { id: '0' }

    expect(() => getIdFromParams(params, 'userId')).toThrow('Missing userId parameter')
  })
})

describe('Integration Tests', () => {
  it('should handle complete request flow', async () => {
    // Simulate authenticated request
    const requestBody = {
      title: 'New Ticket',
      description: 'Test description',
    }

    const request = new Request('http://localhost:3000/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': '1',
        'x-organization-id': '1',
        'x-user-role': 'agent',
      },
      body: JSON.stringify(requestBody),
    })

    // Extract user
    const user = getUserFromRequest(request as any)
    expect(user.id).toBe(1)

    // Validate body
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    })

    const data = await parseJSONBody(request as any, schema)
    expect(data).toEqual(requestBody)

    // Check authorization
    requireRole(user, ['agent', 'admin'])

    // Simulate tenant access check
    const resource = { organization_id: 1 }
    validateTenantAccess(user, resource.organization_id)

    // Create response
    const result = { id: 1, ...requestBody, user_id: user.id }
    const response = successResponse(result, 'Ticket created successfully')

    expect(response.success).toBe(true)
    expect(response.data).toEqual(result)
    expect(response.message).toBe('Ticket created successfully')
  })

  it('should handle multi-tenant isolation', () => {
    const user = {
      id: 1,
      organization_id: 1,
      role: 'admin',
      email: 'admin@tenant1.com',
    }

    const resourceFromOtherTenant = { organization_id: 2 }

    expect(() => validateTenantAccess(user, resourceFromOtherTenant.organization_id)).toThrow(
      AuthorizationError
    )
  })
})
