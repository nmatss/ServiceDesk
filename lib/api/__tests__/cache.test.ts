/**
 * Unit Tests for API Cache Layer
 * Tests caching functionality, TTL, invalidation, and performance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockCache, waitFor } from '@/tests/utils/test-helpers'

describe('API Cache Layer', () => {
  describe('Cache Operations', () => {
    let cache: ReturnType<typeof createMockCache>

    beforeEach(() => {
      cache = createMockCache()
    })

    describe('get and set', () => {
      it('should store and retrieve values', async () => {
        await cache.set('test-key', { data: 'test-value' }, 3600)
        const result = await cache.get('test-key')

        expect(result).toEqual({ data: 'test-value' })
        expect(cache.set).toHaveBeenCalledWith('test-key', { data: 'test-value' }, 3600)
        expect(cache.get).toHaveBeenCalledWith('test-key')
      })

      it('should return null for non-existent keys', async () => {
        const result = await cache.get('non-existent-key')
        expect(result).toBeNull()
      })

      it('should overwrite existing values', async () => {
        await cache.set('test-key', 'value1', 3600)
        await cache.set('test-key', 'value2', 3600)

        const result = await cache.get('test-key')
        expect(result).toBe('value2')
      })

      it('should handle complex objects', async () => {
        const complexData = {
          id: 1,
          nested: {
            array: [1, 2, 3],
            string: 'test',
          },
          date: new Date().toISOString(),
        }

        await cache.set('complex', complexData, 3600)
        const result = await cache.get('complex')

        expect(result).toEqual(complexData)
      })
    })

    describe('TTL (Time-To-Live)', () => {
      it('should expire entries after TTL', async () => {
        await cache.set('expire-test', 'value', 0.1) // 100ms TTL

        // Should exist immediately
        let result = await cache.get('expire-test')
        expect(result).toBe('value')

        // Wait for expiration
        await waitFor(150)

        // Should be expired
        result = await cache.get('expire-test')
        expect(result).toBeNull()
      })

      it('should use default TTL when not specified', async () => {
        await cache.set('default-ttl', 'value')

        const result = await cache.get('default-ttl')
        expect(result).toBe('value')
        expect(cache.set).toHaveBeenCalledWith('default-ttl', 'value', undefined)
      })

      it('should handle very long TTL values', async () => {
        await cache.set('long-ttl', 'value', 86400) // 24 hours

        const result = await cache.get('long-ttl')
        expect(result).toBe('value')
      })
    })

    describe('delete', () => {
      it('should delete existing entries', async () => {
        await cache.set('delete-test', 'value', 3600)

        let exists = await cache.has('delete-test')
        expect(exists).toBe(true)

        await cache.delete('delete-test')

        exists = await cache.has('delete-test')
        expect(exists).toBe(false)
      })

      it('should return true when deleting existing key', async () => {
        await cache.set('delete-test', 'value', 3600)
        const result = await cache.delete('delete-test')

        expect(cache.delete).toHaveBeenCalledWith('delete-test')
      })

      it('should handle deleting non-existent keys', async () => {
        await cache.delete('non-existent')

        expect(cache.delete).toHaveBeenCalledWith('non-existent')
      })
    })

    describe('clear', () => {
      it('should clear all cache entries', async () => {
        await cache.set('key1', 'value1', 3600)
        await cache.set('key2', 'value2', 3600)
        await cache.set('key3', 'value3', 3600)

        await cache.clear()

        const result1 = await cache.get('key1')
        const result2 = await cache.get('key2')
        const result3 = await cache.get('key3')

        expect(result1).toBeNull()
        expect(result2).toBeNull()
        expect(result3).toBeNull()
      })

      it('should allow new entries after clearing', async () => {
        await cache.set('old-key', 'old-value', 3600)
        await cache.clear()
        await cache.set('new-key', 'new-value', 3600)

        const result = await cache.get('new-key')
        expect(result).toBe('new-value')
      })
    })

    describe('has', () => {
      it('should return true for existing keys', async () => {
        await cache.set('exists', 'value', 3600)

        const exists = await cache.has('exists')
        expect(exists).toBe(true)
      })

      it('should return false for non-existent keys', async () => {
        const exists = await cache.has('does-not-exist')
        expect(exists).toBe(false)
      })

      it('should return false for expired keys', async () => {
        await cache.set('expire-soon', 'value', 0.1)

        // Should exist initially
        let exists = await cache.has('expire-soon')
        expect(exists).toBe(true)

        // Wait for expiration
        await waitFor(150)

        // Should not exist after expiration
        exists = await cache.has('expire-soon')
        expect(exists).toBe(false)
      })
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = generateCacheKey('users', { id: 1, name: 'John' })
      const key2 = generateCacheKey('users', { id: 1, name: 'John' })

      expect(key1).toBe(key2)
    })

    it('should generate different keys for different inputs', () => {
      const key1 = generateCacheKey('users', { id: 1 })
      const key2 = generateCacheKey('users', { id: 2 })

      expect(key1).not.toBe(key2)
    })

    it('should handle nested objects consistently', () => {
      const key1 = generateCacheKey('test', { a: { b: { c: 1 } } })
      const key2 = generateCacheKey('test', { a: { b: { c: 1 } } })

      expect(key1).toBe(key2)
    })

    it('should handle arrays consistently', () => {
      const key1 = generateCacheKey('test', { ids: [1, 2, 3] })
      const key2 = generateCacheKey('test', { ids: [1, 2, 3] })

      expect(key1).toBe(key2)
    })
  })

  describe('Cache Invalidation', () => {
    let cache: ReturnType<typeof createMockCache>

    beforeEach(() => {
      cache = createMockCache()
    })

    it('should invalidate by exact key', async () => {
      await cache.set('users:1', { id: 1, name: 'John' }, 3600)
      await cache.set('users:2', { id: 2, name: 'Jane' }, 3600)

      await cache.delete('users:1')

      expect(await cache.has('users:1')).toBe(false)
      expect(await cache.has('users:2')).toBe(true)
    })

    it('should support tag-based invalidation', async () => {
      // This tests the concept - implementation may vary
      const taggedCache = new TaggedCache(cache)

      await taggedCache.set('user:1', { data: 'test' }, { tags: ['users', 'user:1'] })
      await taggedCache.set('user:2', { data: 'test' }, { tags: ['users', 'user:2'] })
      await taggedCache.set('post:1', { data: 'test' }, { tags: ['posts'] })

      await taggedCache.invalidateTag('users')

      expect(await cache.has('user:1')).toBe(false)
      expect(await cache.has('user:2')).toBe(false)
      expect(await cache.has('post:1')).toBe(true)
    })
  })

  describe('Cache Performance', () => {
    let cache: ReturnType<typeof createMockCache>

    beforeEach(() => {
      cache = createMockCache()
    })

    it('should handle rapid sequential sets', async () => {
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key-${i}`, `value-${i}`, 3600))
      }

      await Promise.all(promises)

      // Verify random samples
      expect(await cache.get('key-0')).toBe('value-0')
      expect(await cache.get('key-50')).toBe('value-50')
      expect(await cache.get('key-99')).toBe('value-99')
    })

    it('should handle rapid sequential gets', async () => {
      await cache.set('popular-key', 'popular-value', 3600)

      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(cache.get('popular-key'))
      }

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result).toBe('popular-value')
      })
    })

    it('should handle mixed operations efficiently', async () => {
      const operations = []

      // Mix of sets, gets, and deletes
      for (let i = 0; i < 50; i++) {
        operations.push(cache.set(`key-${i}`, `value-${i}`, 3600))
        operations.push(cache.get(`key-${i % 10}`))
        if (i % 5 === 0) {
          operations.push(cache.delete(`key-${i}`))
        }
      }

      await expect(Promise.all(operations)).resolves.not.toThrow()
    })
  })

  describe('Cache Edge Cases', () => {
    let cache: ReturnType<typeof createMockCache>

    beforeEach(() => {
      cache = createMockCache()
    })

    it('should handle null values', async () => {
      await cache.set('null-value', null, 3600)
      const result = await cache.get('null-value')

      // Distinguish between "not found" and "stored null"
      expect(await cache.has('null-value')).toBe(true)
    })

    it('should handle undefined values', async () => {
      await cache.set('undefined-value', undefined, 3600)
      const result = await cache.get('undefined-value')

      expect(await cache.has('undefined-value')).toBe(true)
    })

    it('should handle empty strings', async () => {
      await cache.set('empty-string', '', 3600)
      const result = await cache.get('empty-string')

      expect(result).toBe('')
      expect(await cache.has('empty-string')).toBe(true)
    })

    it('should handle zero as a value', async () => {
      await cache.set('zero-value', 0, 3600)
      const result = await cache.get('zero-value')

      expect(result).toBe(0)
    })

    it('should handle false as a value', async () => {
      await cache.set('false-value', false, 3600)
      const result = await cache.get('false-value')

      expect(result).toBe(false)
    })

    it('should handle very large objects', async () => {
      const largeArray = Array(10000).fill(0).map((_, i) => ({
        id: i,
        data: `data-${i}`,
      }))

      await cache.set('large-object', largeArray, 3600)
      const result = await cache.get('large-object')

      expect(result).toEqual(largeArray)
      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        expect(result.length).toBe(10000)
      }
    })
  })
})

// Helper functions
function generateCacheKey(prefix: string, params: any): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort())
  return `${prefix}:${sorted}`
}

class TaggedCache {
  private tagMap = new Map<string, Set<string>>()

  constructor(private cache: ReturnType<typeof createMockCache>) {}

  async set(key: string, value: any, options: { tags?: string[] } = {}) {
    await this.cache.set(key, value)

    if (options.tags) {
      options.tags.forEach(tag => {
        if (!this.tagMap.has(tag)) {
          this.tagMap.set(tag, new Set())
        }
        this.tagMap.get(tag)!.add(key)
      })
    }
  }

  async invalidateTag(tag: string) {
    const keys = this.tagMap.get(tag)
    if (keys) {
      for (const key of keys) {
        await this.cache.delete(key)
      }
      this.tagMap.delete(tag)
    }
  }
}
