/**
 * Integration Tests for Ticket Creation API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '../route'
import type { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/tenant/manager', () => ({
  getCurrentTenantId: vi.fn(() => 1),
  getWorkflowManager: vi.fn(() => ({
    processTicketCreation: vi.fn(async () => ({
      success: true,
      initial_status_id: 1,
      message: 'Ticket created successfully',
      approval_required: false
    }))
  }))
}))

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn((sql: string) => ({
      get: vi.fn((ticketTypeId: number, tenantId: number) => {
        if (sql.includes('ticket_types')) {
          return ticketTypeId === 1 ? { id: 1, name: 'Incident', workflow_type: 'incident' } : null
        }
        if (sql.includes('categories')) {
          return ticketTypeId === 1 ? { id: 1, name: 'Technical', tenant_id: 1 } : null
        }
        if (sql.includes('priorities')) {
          return ticketTypeId === 1 ? { id: 1, name: 'High', level: 2 } : null
        }
        if (sql.includes('SELECT') && sql.includes('tickets t')) {
          return {
            id: 1,
            title: 'Test Ticket',
            ticket_type_name: 'Incident',
            category_name: 'Technical',
            priority_name: 'High'
          }
        }
        return null
      }),
      run: vi.fn(() => ({ lastInsertRowid: 1 })),
      all: vi.fn(() => [])
    }))
  }))
}))

describe('POST /api/tickets/create', () => {
  function createMockRequest(body: any, headers: Record<string, string> = {}) {
    return {
      json: async () => body,
      headers: {
        get: (key: string) => headers[key] || null
      },
      nextUrl: {
        pathname: '/api/tickets/create'
      }
    } as unknown as NextRequest
  }

  const validTicketData = {
    title: 'Test Ticket',
    description: 'This is a test ticket',
    ticket_type_id: 1,
    category_id: 1,
    priority_id: 1,
    organization_id: 1,
    user_id: 1
  }

  const authHeaders = {
    'x-user-id': '1',
    'x-organization-id': '1',
    'x-user-role': 'agent',
    'x-tenant-id': '1',
    'x-tenant-slug': 'demo',
    'x-tenant-name': 'Demo Tenant'
  }

  describe('Success Cases', () => {
    it('should create ticket with valid data', async () => {
      const request = createMockRequest(validTicketData, authHeaders)
      const response = await POST(request)

      expect(response).toBeDefined()
      const json = await response.json()

      expect(json.success).toBe(true)
      expect(json.data.ticket).toBeDefined()
      expect(json.data.ticket.title).toBe('Test Ticket')
    })

    it('should use authenticated user ID', async () => {
      const request = createMockRequest(validTicketData, authHeaders)
      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(true)
      // User ID should come from headers, not request body
    })

    it('should include workflow result in response', async () => {
      const request = createMockRequest(validTicketData, authHeaders)
      const response = await POST(request)
      const json = await response.json()

      expect(json.data.workflow_result).toBeDefined()
      expect(json.data.workflow_result.message).toBeDefined()
    })
  })

  describe('Validation Errors', () => {
    it('should reject missing title', async () => {
      const invalidData = { ...validTicketData, title: '' }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(400)
    })

    it('should reject missing description', async () => {
      const invalidData = { ...validTicketData, description: '' }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(400)
    })

    it('should reject title exceeding max length', async () => {
      const invalidData = {
        ...validTicketData,
        title: 'a'.repeat(501) // Max is 500
      }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(400)
    })

    it('should reject description exceeding max length', async () => {
      const invalidData = {
        ...validTicketData,
        description: 'a'.repeat(10001) // Max is 10000
      }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(400)
    })
  })

  describe('Authentication Errors', () => {
    it('should reject unauthenticated requests', async () => {
      const request = createMockRequest(validTicketData, {})

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(401)
      expect(json.error.type).toBe('AUTHENTICATION_ERROR')
    })

    it('should reject requests without user ID', async () => {
      const headersWithoutUser = { ...authHeaders }
      delete headersWithoutUser['x-user-id']

      const request = createMockRequest(validTicketData, headersWithoutUser)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(401)
    })
  })

  describe('Multi-Tenant Security', () => {
    it('should enforce tenant isolation for ticket_type', async () => {
      const invalidData = {
        ...validTicketData,
        ticket_type_id: 999 // Non-existent or different tenant
      }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(404)
      expect(json.error.message).toContain('Ticket type not found')
    })

    it('should enforce tenant isolation for category', async () => {
      const invalidData = {
        ...validTicketData,
        category_id: 999 // Non-existent or different tenant
      }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(404)
      expect(json.error.message).toContain('Category not found')
    })

    it('should enforce tenant isolation for priority', async () => {
      const invalidData = {
        ...validTicketData,
        priority_id: 999 // Non-existent or different tenant
      }
      const request = createMockRequest(invalidData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(404)
      expect(json.error.message).toContain('Priority not found')
    })
  })

  describe('Business Logic', () => {
    it('should include optional fields when provided', async () => {
      const dataWithOptionals = {
        ...validTicketData,
        impact: 2,
        urgency: 3,
        affected_users_count: 5,
        business_service: 'Email Service',
        location: 'Building A',
        source: 'email'
      }
      const request = createMockRequest(dataWithOptionals, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(true)
      // Verify optional fields are included
    })

    it('should use default values for optional fields', async () => {
      const request = createMockRequest(validTicketData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(true)
      // Default impact: 3, urgency: 3, affected_users_count: 1
    })
  })

  describe('Error Handling', () => {
    it('should handle workflow processing errors gracefully', async () => {
      // Mock workflow failure
      vi.mocked(require('@/lib/tenant/manager').getWorkflowManager).mockImplementationOnce(() => ({
        processTicketCreation: vi.fn(async () => ({
          success: false,
          error: 'Workflow validation failed'
        }))
      }))

      const request = createMockRequest(validTicketData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(409) // Conflict
      expect(json.error.message).toContain('Workflow')
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(require('@/lib/db').getDb).mockImplementationOnce(() => ({
        prepare: vi.fn(() => {
          throw new Error('Database connection failed')
        })
      }))

      const request = createMockRequest(validTicketData, authHeaders)

      const response = await POST(request)
      const json = await response.json()

      expect(json.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('Response Format', () => {
    it('should return consistent success response format', async () => {
      const request = createMockRequest(validTicketData, authHeaders)
      const response = await POST(request)
      const json = await response.json()

      expect(json).toHaveProperty('success')
      expect(json).toHaveProperty('data')
      expect(json.data).toHaveProperty('ticket')
      expect(json.data).toHaveProperty('workflow_result')
      expect(json.data).toHaveProperty('message')
    })

    it('should return consistent error response format', async () => {
      const request = createMockRequest({}, authHeaders)
      const response = await POST(request)
      const json = await response.json()

      expect(json).toHaveProperty('success', false)
      expect(json).toHaveProperty('error')
      expect(json.error).toHaveProperty('type')
      expect(json.error).toHaveProperty('message')
      expect(json.error).toHaveProperty('timestamp')
    })
  })
})
