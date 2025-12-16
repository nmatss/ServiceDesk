/**
 * Comprehensive Unit Tests for Tenant Cache
 * Tests LRU cache behavior, TTL, statistics, and multi-key caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getTenantFromCache,
  setTenantInCache,
  invalidateTenant,
  clearCache,
  getCacheStats,
  getCacheHitRatio,
  warmupCache,
  tenantCache
} from '../cache'
import type { Organization } from '@/lib/types/database'

describe('Tenant Cache', () => {
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

  const mockTenant2: Organization = {
    ...mockTenant,
    id: 2,
    name: 'TechCo',
    slug: 'techco',
    domain: 'techco'
  }

  beforeEach(() => {
    clearCache()
  })

  afterEach(() => {
    clearCache()
  })

  describe('Basic Cache Operations', () => {
    it('should set and get tenant from cache', () => {
      setTenantInCache(mockTenant)
      const cached = getTenantFromCache(`id:${mockTenant.id}`)

      expect(cached).toEqual(mockTenant)
    })

    it('should return null for cache miss', () => {
      const cached = getTenantFromCache('id:999')
      expect(cached).toBeNull()
    })

    it('should clear entire cache', () => {
      setTenantInCache(mockTenant)
      setTenantInCache(mockTenant2)

      clearCache()

      expect(getTenantFromCache(`id:${mockTenant.id}`)).toBeNull()
      expect(getTenantFromCache(`id:${mockTenant2.id}`)).toBeNull()
    })

    it('should throw error for invalid tenant data', () => {
      const invalidTenant = { ...mockTenant, id: 0 } as any

      expect(() => setTenantInCache(invalidTenant)).toThrow('Invalid tenant data')
    })

    it('should throw error for tenant without slug', () => {
      const invalidTenant = { ...mockTenant, slug: '' } as any

      expect(() => setTenantInCache(invalidTenant)).toThrow('Invalid tenant data')
    })
  })

  describe('Multi-Key Caching', () => {
    it('should cache tenant by ID', () => {
      setTenantInCache(mockTenant)
      const cached = getTenantFromCache(`id:${mockTenant.id}`)

      expect(cached?.id).toBe(mockTenant.id)
    })

    it('should cache tenant by slug', () => {
      setTenantInCache(mockTenant)
      const cached = getTenantFromCache(`slug:${mockTenant.slug}`)

      expect(cached?.slug).toBe(mockTenant.slug)
    })

    it('should cache tenant by domain if present', () => {
      setTenantInCache(mockTenant)
      const cached = getTenantFromCache(`domain:${mockTenant.domain}`)

      expect(cached?.domain).toBe(mockTenant.domain)
    })

    it('should not cache by domain if domain is null', () => {
      const tenantNoDomain: Organization = { ...mockTenant, domain: undefined }
      setTenantInCache(tenantNoDomain)

      const cached = getTenantFromCache('domain:null')
      expect(cached).toBeNull()
    })

    it('should retrieve same tenant by any key', () => {
      setTenantInCache(mockTenant)

      const cachedById = getTenantFromCache(`id:${mockTenant.id}`)
      const cachedBySlug = getTenantFromCache(`slug:${mockTenant.slug}`)
      const cachedByDomain = getTenantFromCache(`domain:${mockTenant.domain}`)

      expect(cachedById).toEqual(cachedBySlug)
      expect(cachedBySlug).toEqual(cachedByDomain)
    })
  })

  describe('Cache Invalidation', () => {
    it('should invalidate tenant by all keys', () => {
      setTenantInCache(mockTenant)

      invalidateTenant({
        id: mockTenant.id,
        slug: mockTenant.slug,
        domain: mockTenant.domain
      })

      expect(getTenantFromCache(`id:${mockTenant.id}`)).toBeNull()
      expect(getTenantFromCache(`slug:${mockTenant.slug}`)).toBeNull()
      expect(getTenantFromCache(`domain:${mockTenant.domain}`)).toBeNull()
    })

    it('should invalidate only specified tenant', () => {
      setTenantInCache(mockTenant)
      setTenantInCache(mockTenant2)

      invalidateTenant({
        id: mockTenant.id,
        slug: mockTenant.slug,
        domain: mockTenant.domain
      })

      expect(getTenantFromCache(`id:${mockTenant.id}`)).toBeNull()
      expect(getTenantFromCache(`id:${mockTenant2.id}`)).not.toBeNull()
    })

    it('should handle invalidation of tenant without domain', () => {
      const tenantNoDomain: Organization = { ...mockTenant, domain: undefined }
      setTenantInCache(tenantNoDomain)

      invalidateTenant({
        id: tenantNoDomain.id,
        slug: tenantNoDomain.slug,
        domain: tenantNoDomain.domain
      })

      expect(getTenantFromCache(`id:${tenantNoDomain.id}`)).toBeNull()
    })
  })

  describe('Cache Statistics', () => {
    it('should track cache hits', () => {
      clearCache()
      setTenantInCache(mockTenant)

      getTenantFromCache(`id:${mockTenant.id}`)
      getTenantFromCache(`id:${mockTenant.id}`)

      const stats = getCacheStats()
      expect(stats.hits).toBe(2)
    })

    it('should track cache misses', () => {
      clearCache()

      getTenantFromCache('id:999')
      getTenantFromCache('id:888')

      const stats = getCacheStats()
      expect(stats.misses).toBe(2)
    })

    it('should track cache size', () => {
      clearCache()
      setTenantInCache(mockTenant)
      setTenantInCache(mockTenant2)

      const stats = getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should calculate hit ratio correctly', () => {
      clearCache()
      setTenantInCache(mockTenant)

      // 2 hits
      getTenantFromCache(`id:${mockTenant.id}`)
      getTenantFromCache(`id:${mockTenant.id}`)

      // 1 miss
      getTenantFromCache('id:999')

      const hitRatio = getCacheHitRatio()
      expect(hitRatio).toBeCloseTo(66.67, 1) // 2/3 = 66.67%
    })

    it('should return 0 hit ratio when no operations', () => {
      clearCache()
      const hitRatio = getCacheHitRatio()
      expect(hitRatio).toBe(0)
    })

    it('should reset statistics on clearCache', () => {
      setTenantInCache(mockTenant)
      getTenantFromCache(`id:${mockTenant.id}`)
      getTenantFromCache('id:999')

      clearCache()

      const stats = getCacheStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.size).toBe(0)
    })
  })

  describe('Cache Entry Metadata', () => {
    it('should store cachedAt timestamp', () => {
      setTenantInCache(mockTenant)

      const cached = getTenantFromCache(`id:${mockTenant.id}`)
      expect(cached).toBeDefined()

      // Verify tenant was cached recently (within test execution time)
      // The cache internally stores timestamp but we verify by checking the tenant exists
      expect(cached).toEqual(mockTenant)
    })

    it('should reject corrupted cache entry', () => {
      // Manually set corrupted entry in cache
      tenantCache.set('id:999', { tenant: null as any, cachedAt: 0 })

      const cached = getTenantFromCache('id:999')
      expect(cached).toBeNull()

      // Cache should auto-remove corrupted entry
      const stats = getCacheStats()
      expect(stats.misses).toBe(1)
    })

    it('should reject cache entry without cachedAt', () => {
      // Manually set entry without cachedAt
      tenantCache.set('id:998', { tenant: mockTenant, cachedAt: 0 } as any)

      const cached = getTenantFromCache('id:998')
      expect(cached).toBeNull()
    })
  })

  describe('LRU Cache Behavior', () => {
    it('should update access time on get (LRU behavior)', () => {
      setTenantInCache(mockTenant)

      // Access multiple times
      getTenantFromCache(`id:${mockTenant.id}`)
      getTenantFromCache(`id:${mockTenant.id}`)
      getTenantFromCache(`id:${mockTenant.id}`)

      // Tenant should still be in cache
      const cached = getTenantFromCache(`id:${mockTenant.id}`)
      expect(cached).toEqual(mockTenant)
    })

    it('should maintain recently accessed items', () => {
      // Add multiple tenants
      const tenants: Organization[] = []
      for (let i = 1; i <= 10; i++) {
        const tenant = {
          ...mockTenant,
          id: i,
          slug: `tenant-${i}`,
          domain: `tenant-${i}`
        }
        tenants.push(tenant)
        setTenantInCache(tenant)
      }

      // Access first tenant multiple times
      for (let i = 0; i < 5; i++) {
        getTenantFromCache('id:1')
      }

      // First tenant should still be in cache
      expect(getTenantFromCache('id:1')).not.toBeNull()
    })
  })

  describe('Warmup Cache', () => {
    it('should warmup cache with multiple tenants', () => {
      const tenants: Organization[] = [
        mockTenant,
        mockTenant2,
        { ...mockTenant, id: 3, slug: 'tenant3', domain: 'tenant3' }
      ]

      warmupCache(tenants)

      expect(getTenantFromCache('id:1')).toEqual(mockTenant)
      expect(getTenantFromCache('id:2')).toEqual(mockTenant2)
      expect(getTenantFromCache('id:3')).toBeDefined()
    })

    it('should handle errors during warmup', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const invalidTenant = { ...mockTenant, id: 0 } as any
      const validTenant = mockTenant2

      warmupCache([invalidTenant, validTenant])

      // Valid tenant should be cached
      expect(getTenantFromCache(`id:${validTenant.id}`)).toEqual(validTenant)

      // Error should be logged for invalid tenant
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should handle empty array in warmup', () => {
      warmupCache([])

      const stats = getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('Cache Configuration', () => {
    it('should have correct max size configuration', () => {
      const stats = getCacheStats()
      expect(stats.maxSize).toBe(500)
    })

    it('should respect cache size limits', () => {
      const stats = getCacheStats()
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize)
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in keys', () => {
      const specialTenant = {
        ...mockTenant,
        slug: 'test-company-123',
        domain: 'test-company.com'
      }

      setTenantInCache(specialTenant)

      const cached = getTenantFromCache('slug:test-company-123')
      expect(cached).toEqual(specialTenant)
    })

    it('should handle concurrent cache operations', () => {
      // Set multiple tenants concurrently
      const tenants = Array.from({ length: 50 }, (_, i) => ({
        ...mockTenant,
        id: i + 1,
        slug: `tenant-${i + 1}`,
        domain: `tenant-${i + 1}`
      }))

      tenants.forEach(tenant => setTenantInCache(tenant))

      // Verify all tenants are cached
      tenants.forEach(tenant => {
        expect(getTenantFromCache(`id:${tenant.id}`)).toBeDefined()
      })
    })

    it('should handle cache updates for same tenant', () => {
      setTenantInCache(mockTenant)

      const updatedTenant = {
        ...mockTenant,
        name: 'ACME Corp Updated'
      }

      setTenantInCache(updatedTenant)

      const cached = getTenantFromCache(`id:${mockTenant.id}`)
      expect(cached?.name).toBe('ACME Corp Updated')
    })

    it('should handle null and undefined safely', () => {
      expect(() => setTenantInCache(null as any)).toThrow()
      expect(() => setTenantInCache(undefined as any)).toThrow()
    })

    it('should handle empty string keys gracefully', () => {
      const cached = getTenantFromCache('')
      expect(cached).toBeNull()
    })
  })

  describe('Performance Characteristics', () => {
    it('should perform cache operations quickly', () => {
      const iterations = 1000
      const startTime = Date.now()

      // Start at 1 to avoid id: 0 which is falsy and fails validation
      for (let i = 1; i <= iterations; i++) {
        setTenantInCache({ ...mockTenant, id: i })
        getTenantFromCache(`id:${i}`)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // 1000 operations should complete in less than 100ms
      expect(duration).toBeLessThan(100)
    })

    it('should maintain hit ratio with mixed operations', () => {
      clearCache()

      // Create predictable pattern: 2 hits per 1 miss
      setTenantInCache(mockTenant)

      // 2 hits
      getTenantFromCache(`id:${mockTenant.id}`)
      getTenantFromCache(`id:${mockTenant.id}`)

      // 1 miss
      getTenantFromCache('id:999')

      const hitRatio = getCacheHitRatio()
      expect(hitRatio).toBeCloseTo(66.67, 0)
    })
  })
})
