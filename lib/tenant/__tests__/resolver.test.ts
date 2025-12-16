/**
 * Comprehensive Unit Tests for Tenant Resolver
 * Tests all resolution strategies, caching, validation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveTenant, getTenantCacheStats, logTenantResolution } from '../resolver'
import { clearCache, getCacheHitRatio } from '../cache'
import type { Organization } from '@/lib/types/database'
import * as dbConnection from '@/lib/db/connection'

// Mock database connection
vi.mock('@/lib/db/connection', () => ({
  getPooledConnection: vi.fn()
}))

// Mock Sentry helpers
vi.mock('@/lib/monitoring/sentry-helpers', () => ({
  captureException: vi.fn()
}))

// Mock environment helpers
vi.mock('@/lib/config/env', () => ({
  isProduction: () => false
}))

describe('Tenant Resolver', () => {
  // Test tenant data
  const mockTenant: Organization = {
    id: 1,
    name: 'ACME Corp',
    slug: 'acme',
    domain: 'acme',
    settings: JSON.stringify({}),
    subscription_plan: 'enterprise',
    subscription_status: 'active',
    subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    max_users: 100,
    max_tickets_per_month: 1000,
    features: JSON.stringify({}),
    billing_email: 'billing@acme.com',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const inactiveTenant: Organization = {
    ...mockTenant,
    id: 2,
    slug: 'inactive',
    is_active: false
  }

  const expiredTenant: Organization = {
    ...mockTenant,
    id: 3,
    slug: 'expired',
    subscription_status: 'expired'
  }

  beforeEach(() => {
    clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearCache()
  })

  describe('Strategy 1: Explicit Headers', () => {
    it('should resolve tenant by explicit headers (both x-tenant-id and x-tenant-slug)', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toEqual(mockTenant)
      expect(result.method).toBe('explicit-header')
      expect(result.cached).toBe(false)
    })

    it('should use cache on second call with same headers', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      // First call - database query
      const result1 = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result1.cached).toBe(false)

      // Second call - from cache
      const result2 = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result2.cached).toBe(true)
      expect(result2.tenant).toEqual(mockTenant)
      expect(dbConnection.getPooledConnection).toHaveBeenCalledTimes(1)
    })

    it('should reject if only x-tenant-id is provided (security)', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })

    it('should reject if only x-tenant-slug is provided (security)', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })

    it('should reject invalid tenant ID (non-numeric)', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': 'invalid',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('explicit-header')
      expect(result.error).toContain('Invalid tenant ID')
    })

    it('should reject invalid tenant ID (zero)', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '0',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.error).toContain('Invalid tenant ID')
    })

    it('should reject invalid tenant ID (negative)', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '-5',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.error).toContain('Invalid tenant ID')
    })
  })

  describe('Strategy 2: Subdomain Resolution', () => {
    it('should resolve tenant by subdomain', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      const result = await resolveTenant({
        hostname: 'acme.servicedesk.com',
        pathname: '/'
      })

      expect(result.tenant).toEqual(mockTenant)
      expect(result.method).toBe('subdomain')
      expect(result.cached).toBe(false)
    })

    it('should extract subdomain correctly from multi-level domain', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      const result = await resolveTenant({
        hostname: 'acme.app.servicedesk.com',
        pathname: '/'
      })

      expect(result.tenant).toEqual(mockTenant)
      expect(result.method).toBe('subdomain')
    })

    it('should ignore www subdomain', async () => {
      const result = await resolveTenant({
        hostname: 'www.servicedesk.com',
        pathname: '/'
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })

    it('should use cache on second subdomain call', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      await resolveTenant({
        hostname: 'acme.servicedesk.com',
        pathname: '/'
      })

      const result2 = await resolveTenant({
        hostname: 'acme.servicedesk.com',
        pathname: '/'
      })

      expect(result2.cached).toBe(true)
      expect(dbConnection.getPooledConnection).toHaveBeenCalledTimes(1)
    })

    it('should return null if no subdomain present', async () => {
      const result = await resolveTenant({
        hostname: 'servicedesk.com',
        pathname: '/'
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })
  })

  describe('Strategy 3: Path Prefix Resolution', () => {
    it('should resolve tenant by path prefix /t/slug', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/acme/dashboard'
      })

      expect(result.tenant).toEqual(mockTenant)
      expect(result.method).toBe('path')
      expect(result.cached).toBe(false)
    })

    it('should extract slug correctly from path', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/acme'
      })

      expect(result.tenant).toEqual(mockTenant)
      expect(result.method).toBe('path')
    })

    it('should use cache on second path call', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/acme/dashboard'
      })

      const result2 = await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/acme/settings'
      })

      expect(result2.cached).toBe(true)
      expect(dbConnection.getPooledConnection).toHaveBeenCalledTimes(1)
    })

    it('should return null if path does not match /t/ pattern', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/dashboard'
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })

    it('should handle slug with hyphens and numbers', async () => {
      const tenantWithHyphens = { ...mockTenant, slug: 'test-company-123' }
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(tenantWithHyphens)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/test-company-123/tickets'
      })

      expect(result.tenant).toEqual(tenantWithHyphens)
    })
  })

  describe('Tenant Validation', () => {
    it('should reject inactive tenant', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(inactiveTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '2',
          'x-tenant-slug': 'inactive'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.error).toContain('inactive')
    })

    it('should reject tenant with expired subscription', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(expiredTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '3',
          'x-tenant-slug': 'expired'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.error).toContain('expired')
    })

    it('should reject tenant with subscription_status = cancelled', async () => {
      const cancelledTenant = { ...mockTenant, subscription_status: 'cancelled' }
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(cancelledTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.error).toBeDefined()
    })

    it('should accept tenant with subscription_status = trialing', async () => {
      const trialingTenant = { ...mockTenant, subscription_status: 'trialing' }
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(trialingTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toEqual(trialingTenant)
    })

    it('should reject tenant with expired subscription_expires_at', async () => {
      const pastExpiration = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const expiredByDateTenant = {
        ...mockTenant,
        subscription_expires_at: pastExpiration
      }
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(expiredByDateTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.error).toContain('expired')
    })
  })

  describe('Strategy Precedence', () => {
    it('should prioritize explicit headers over subdomain', async () => {
      const headerTenant = { ...mockTenant, id: 10, slug: 'header-tenant' }

      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(headerTenant)

      const result = await resolveTenant({
        hostname: 'subdomain-tenant.servicedesk.com',
        pathname: '/',
        headers: {
          'x-tenant-id': '10',
          'x-tenant-slug': 'header-tenant'
        }
      })

      expect(result.tenant?.id).toBe(10)
      expect(result.method).toBe('explicit-header')
    })

    it('should prioritize subdomain over path', async () => {
      const subdomainTenant = { ...mockTenant, id: 20, slug: 'subdomain-tenant' }

      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(subdomainTenant)

      const result = await resolveTenant({
        hostname: 'subdomain-tenant.servicedesk.com',
        pathname: '/t/path-tenant/dashboard'
      })

      expect(result.tenant?.id).toBe(20)
      expect(result.method).toBe('subdomain')
    })

    it('should fall back to path if subdomain not found', async () => {
      const pathTenant = { ...mockTenant, id: 30, slug: 'path-tenant' }

      vi.mocked(dbConnection.getPooledConnection)
        .mockResolvedValueOnce(null) // Subdomain query returns null
        .mockResolvedValueOnce(pathTenant) // Path query returns tenant

      const result = await resolveTenant({
        hostname: 'unknown.servicedesk.com',
        pathname: '/t/path-tenant/dashboard'
      })

      expect(result.tenant?.id).toBe(30)
      expect(result.method).toBe('path')
    })
  })

  describe('Development Default Strategy', () => {
    it('should use default tenant in dev mode with allowDevDefault', async () => {
      const defaultTenant = { ...mockTenant, id: 99, slug: 'default-tenant' }
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(defaultTenant)

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        allowDevDefault: true
      })

      expect(result.tenant?.id).toBe(99)
      expect(result.method).toBe('default-dev')
    })

    it('should NOT use default tenant if allowDevDefault is false', async () => {
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        allowDevDefault: false
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })

    it('should NOT use default tenant for non-localhost hostname', async () => {
      const result = await resolveTenant({
        hostname: 'production.com',
        pathname: '/',
        allowDevDefault: true
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })
  })

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      clearCache()
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      // First call - cache miss
      await resolveTenant({
        hostname: 'acme.servicedesk.com',
        pathname: '/'
      })

      // Second call - cache hit
      await resolveTenant({
        hostname: 'acme.servicedesk.com',
        pathname: '/'
      })

      const stats = getTenantCacheStats()
      expect(stats.hits).toBeGreaterThan(0)
      expect(stats.misses).toBeGreaterThan(0)
      expect(stats.hitRatio).toBeGreaterThan(0)
    })

    it('should calculate hit ratio correctly', async () => {
      clearCache()
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValue(mockTenant)

      // Create multiple cache hits
      for (let i = 0; i < 5; i++) {
        await resolveTenant({
          hostname: 'acme.servicedesk.com',
          pathname: '/'
        })
      }

      const hitRatio = getCacheHitRatio()
      expect(hitRatio).toBeGreaterThan(0)
      expect(hitRatio).toBeLessThanOrEqual(100)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockRejectedValueOnce(
        new Error('Database connection failed')
      )

      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
    })

    it('should return not-found for completely invalid request', async () => {
      const result = await resolveTenant({
        hostname: 'unknown.com',
        pathname: '/random'
      })

      expect(result.tenant).toBeNull()
      expect(result.method).toBe('not-found')
      expect(result.error).toBeDefined()
    })
  })

  describe('Log Tenant Resolution', () => {
    it('should log tenant resolution with full context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = {
        tenant: mockTenant,
        method: 'subdomain' as const,
        cached: true
      }

      logTenantResolution(result, {
        hostname: 'acme.servicedesk.com',
        pathname: '/dashboard',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1'
      })

      expect(consoleSpy).toHaveBeenCalled()
      const logData = JSON.parse(consoleSpy.mock.calls[0]?.[1] || '{}')
      expect(logData.tenant?.slug).toBe('acme')
      expect(logData.resolution.method).toBe('subdomain')
      expect(logData.resolution.cached).toBe(true)
      expect(logData.request.hostname).toBe('acme.servicedesk.com')

      consoleSpy.mockRestore()
    })

    it('should handle null tenant in logging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = {
        tenant: null,
        method: 'not-found' as const,
        cached: false,
        error: 'No tenant found'
      }

      logTenantResolution(result, {
        hostname: 'unknown.com',
        pathname: '/'
      })

      expect(consoleSpy).toHaveBeenCalled()
      const logData = JSON.parse(consoleSpy.mock.calls[0]?.[1] || '{}')
      expect(logData.tenant).toBeNull()
      expect(logData.resolution.error).toBe('No tenant found')

      consoleSpy.mockRestore()
    })

    it('should truncate long user agents in logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const longUserAgent = 'A'.repeat(500)
      const result = {
        tenant: mockTenant,
        method: 'subdomain' as const,
        cached: false
      }

      logTenantResolution(result, {
        hostname: 'acme.servicedesk.com',
        pathname: '/',
        userAgent: longUserAgent
      })

      const logData = JSON.parse(consoleSpy.mock.calls[0]?.[1] || '{}')
      expect(logData.request.userAgent?.length).toBe(200)

      consoleSpy.mockRestore()
    })
  })

  describe('Multi-key Caching', () => {
    it('should cache tenant by all keys (id, slug, domain)', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      // First call by ID
      await resolveTenant({
        hostname: 'localhost',
        pathname: '/',
        headers: {
          'x-tenant-id': '1',
          'x-tenant-slug': 'acme'
        }
      })

      // Second call by slug should hit cache
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/acme'
      })

      expect(result.cached).toBe(true)
      expect(dbConnection.getPooledConnection).toHaveBeenCalledTimes(1)
    })

    it('should share cache between subdomain and path lookups', async () => {
      vi.mocked(dbConnection.getPooledConnection).mockResolvedValueOnce(mockTenant)

      // First call by subdomain
      await resolveTenant({
        hostname: 'acme.servicedesk.com',
        pathname: '/'
      })

      // Second call by path should hit cache
      const result = await resolveTenant({
        hostname: 'localhost',
        pathname: '/t/acme'
      })

      expect(result.cached).toBe(true)
      expect(dbConnection.getPooledConnection).toHaveBeenCalledTimes(1)
    })
  })
})
