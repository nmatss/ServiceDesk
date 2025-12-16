/**
 * Response Caching Layer
 * Enterprise-grade caching system with multiple strategies
 */

import { NextRequest, NextResponse } from 'next/server'
import { LRUCache } from 'lru-cache'
import { ApiContext, CacheOptions, CacheMeta } from './types'
import * as crypto from 'crypto'
import { logger } from '../monitoring/logger'
import type { Redis, Cluster } from 'ioredis'

// Cache Store Interface
interface CacheStore {
  get(key: string): Promise<CachedResponse | null>
  set(key: string, value: CachedResponse, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(pattern?: string): Promise<void>
  has(key: string): Promise<boolean>
  keys(pattern?: string): Promise<string[]>
  size(): Promise<number>
  stats(): Promise<CacheStats>
}

// Cached Response Structure
interface CachedResponse {
  data: unknown
  headers: Record<string, string>
  status: number
  timestamp: number
  ttl: number
  tags: string[]
  etag: string
  compressed?: boolean
}

// Cache Statistics
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  hitRate: number
  size: number
  memory?: number
}

// Cache Configuration
interface CacheConfig {
  defaultTTL: number
  maxSize: number
  maxAge: number
  compression: boolean
  enableETags: boolean
  enableConditionalRequests: boolean
  keyPrefix: string
  invalidationPatterns: string[]
}

// In-Memory Cache Store
class MemoryCacheStore implements CacheStore {
  private cache: LRUCache<string, CachedResponse>
  private cacheStats: CacheStats

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new LRUCache<string, CachedResponse>({
      max: config.maxSize || 1000,
      ttl: config.defaultTTL || 300000, // 5 minutes
    })

    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      size: 0,
    }
  }

  async get(key: string): Promise<CachedResponse | null> {
    const cached = this.cache.get(key)

    if (cached) {
      this.cacheStats.hits++
      this.updateHitRate()

      // Check if TTL expired
      if (Date.now() - cached.timestamp > cached.ttl) {
        this.cache.delete(key)
        this.cacheStats.misses++
        return null
      }

      return cached
    }

    this.cacheStats.misses++
    this.updateHitRate()
    return null
  }

  async set(key: string, value: CachedResponse, ttl?: number): Promise<void> {
    if (ttl) {
      value.ttl = ttl
    }

    this.cache.set(key, value)
    this.cacheStats.sets++
    this.cacheStats.size = this.cache.size
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
    this.cacheStats.deletes++
    this.cacheStats.size = this.cache.size
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const regex = new RegExp(pattern)
      const keys = Array.from(this.cache.keys())
      for (const key of keys) {
        if (regex.test(key)) {
          this.cache.delete(key)
          this.cacheStats.deletes++
        }
      }
    } else {
      this.cache.clear()
      this.cacheStats.deletes += this.cacheStats.size
    }
    this.cacheStats.size = this.cache.size
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key)
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys())

    if (pattern) {
      const regex = new RegExp(pattern)
      return keys.filter(key => regex.test(key))
    }

    return keys
  }

  async size(): Promise<number> {
    return this.cache.size
  }

  async stats(): Promise<CacheStats> {
    return { ...this.cacheStats, size: this.cache.size }
  }

  private updateHitRate(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses
    this.cacheStats.hitRate = total > 0 ? this.cacheStats.hits / total : 0
  }
}

// Redis Cache Store (for production)
class RedisCacheStore implements CacheStore {
  private redis: Redis | Cluster
  private stats: CacheStats

  constructor(redisClient: Redis | Cluster) {
    this.redis = redisClient
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      size: 0,
    }
  }

  async get(key: string): Promise<CachedResponse | null> {
    try {
      const data = await this.redis.get(key)

      if (data) {
        this.stats.hits++
        this.updateHitRate()
        return JSON.parse(data)
      }

      this.stats.misses++
      this.updateHitRate()
      return null
    } catch (error) {
      logger.error('Redis cache get error', error)
      this.stats.misses++
      return null
    }
  }

  async set(key: string, value: CachedResponse, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      const expiration = ttl || value.ttl

      if (expiration > 0) {
        await this.redis.setex(key, Math.ceil(expiration / 1000), serialized)
      } else {
        await this.redis.set(key, serialized)
      }

      this.stats.sets++
    } catch (error) {
      logger.error('Redis cache set error', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key)
      this.stats.deletes++
    } catch (error) {
      logger.error('Redis cache delete error', error)
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys)
          this.stats.deletes += keys.length
        }
      } else {
        await this.redis.flushdb()
      }
    } catch (error) {
      logger.error('Redis cache clear error', error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1
    } catch (error) {
      logger.error('Redis cache has error', error)
      return false
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern || '*')
    } catch (error) {
      logger.error('Redis cache keys error', error)
      return []
    }
  }

  async size(): Promise<number> {
    try {
      return await this.redis.dbsize()
    } catch (error) {
      logger.error('Redis cache size error', error)
      return 0
    }
  }

  async stats(): Promise<CacheStats> {
    this.stats.size = await this.size()
    return { ...this.stats }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}

// Cache Manager
export class CacheManager {
  private store: CacheStore
  private config: CacheConfig

  constructor(store?: CacheStore, config?: Partial<CacheConfig>) {
    this.store = store || new MemoryCacheStore()
    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000,
      maxAge: 3600000, // 1 hour
      compression: true,
      enableETags: true,
      enableConditionalRequests: true,
      keyPrefix: 'api:',
      invalidationPatterns: [],
      ...config,
    }
  }

  // Generate cache key
  private generateKey(req: NextRequest, context?: ApiContext): string {
    const url = req.nextUrl
    const method = req.method
    const userId = context?.user?.id || 'anonymous'
    const version = context?.version || 'v1'

    // Include relevant query parameters and headers
    const params = new URLSearchParams(url.search)
    params.sort() // Ensure consistent ordering

    const keyData = {
      method,
      path: url.pathname,
      params: params.toString(),
      userId,
      version,
    }

    const keyString = JSON.stringify(keyData)
    const hash = crypto.createHash('md5').update(keyString).digest('hex')

    return `${this.config.keyPrefix}${hash}`
  }

  // Generate ETag
  private generateETag(data: unknown): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
    return `"${hash}"`
  }

  // Check if request can be cached
  private canCache(req: NextRequest, options?: CacheOptions): boolean {
    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return false
    }

    // Check cache-control headers
    const cacheControl = req.headers.get('cache-control')
    if (cacheControl?.includes('no-cache') || cacheControl?.includes('no-store')) {
      return false
    }

    return true
  }

  // Get cached response
  async get(req: NextRequest, context?: ApiContext): Promise<NextResponse | null> {
    if (!this.canCache(req)) {
      return null
    }

    const key = this.generateKey(req, context)
    const cached = await this.store.get(key)

    if (!cached) {
      return null
    }

    // Check conditional requests
    if (this.config.enableConditionalRequests) {
      const ifNoneMatch = req.headers.get('if-none-match')
      if (ifNoneMatch === cached.etag) {
        return new NextResponse(null, { status: 304 })
      }

      const ifModifiedSince = req.headers.get('if-modified-since')
      if (ifModifiedSince) {
        const modifiedSince = new Date(ifModifiedSince).getTime()
        if (cached.timestamp <= modifiedSince) {
          return new NextResponse(null, { status: 304 })
        }
      }
    }

    // Create response with cached data
    const response = NextResponse.json(cached.data, {
      status: cached.status,
      headers: {
        ...cached.headers,
        'X-Cache': 'HIT',
        'Cache-Control': `max-age=${Math.floor(cached.ttl / 1000)}`,
      },
    })

    if (this.config.enableETags) {
      response.headers.set('ETag', cached.etag)
    }

    return response
  }

  // Cache response
  async set(
    req: NextRequest,
    response: NextResponse,
    data: unknown,
    context?: ApiContext,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.canCache(req, options)) {
      return
    }

    const key = this.generateKey(req, context)
    const ttl = options?.ttl || this.config.defaultTTL
    const tags = options?.tags || []
    const etag = this.generateETag(data)

    const cachedResponse: CachedResponse = {
      data,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
      timestamp: Date.now(),
      ttl,
      tags,
      etag,
    }

    await this.store.set(key, cachedResponse, ttl)

    // Add cache headers to response
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('Cache-Control', `max-age=${Math.floor(ttl / 1000)}`)

    if (this.config.enableETags) {
      response.headers.set('ETag', etag)
    }
  }

  // Invalidate cache by tags
  async invalidateByTags(tags: string[]): Promise<void> {
    const keys = await this.store.keys(`${this.config.keyPrefix}*`)

    for (const key of keys) {
      const cached = await this.store.get(key)
      if (cached && cached.tags.some(tag => tags.includes(tag))) {
        await this.store.delete(key)
      }
    }
  }

  // Invalidate cache by pattern
  async invalidateByPattern(pattern: string): Promise<void> {
    await this.store.clear(pattern)
  }

  // Get cache statistics
  async getStats(): Promise<CacheStats> {
    return this.store.stats()
  }

  // Clear all cache
  async clear(): Promise<void> {
    await this.store.clear()
  }
}

// Cache middleware
export function withCache(options?: CacheOptions) {
  return function <T extends Record<string, unknown>>(
    target: T,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (
      req: NextRequest,
      context?: ApiContext
    ) => Promise<NextResponse>

    descriptor.value = async function (
      this: T,
      req: NextRequest,
      context?: ApiContext
    ): Promise<NextResponse> {
      const cacheManager =
        (global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager ||
        new CacheManager()

      // Try to get cached response
      const cachedResponse = await cacheManager.get(req, context)
      if (cachedResponse) {
        return cachedResponse
      }

      // Call original method
      const response = await originalMethod.call(this, req, context)

      // Cache the response if successful
      if (response.ok) {
        const responseClone = response.clone()
        const data = await responseClone.json()
        await cacheManager.set(req, response, data, context, options)
      }

      return response
    }

    return descriptor
  }
}

// Cache strategies
export const cacheStrategies = {
  // Short-term cache (5 minutes)
  short: {
    ttl: 5 * 60 * 1000,
    tags: ['short-term'],
  },

  // Medium-term cache (30 minutes)
  medium: {
    ttl: 30 * 60 * 1000,
    tags: ['medium-term'],
  },

  // Long-term cache (2 hours)
  long: {
    ttl: 2 * 60 * 60 * 1000,
    tags: ['long-term'],
  },

  // User-specific cache (15 minutes)
  user: {
    ttl: 15 * 60 * 1000,
    tags: ['user-specific'],
  },

  // Static content cache (24 hours)
  static: {
    ttl: 24 * 60 * 60 * 1000,
    tags: ['static'],
  },

  // No cache
  none: {
    ttl: 0,
    tags: [],
  },
}

// Default cache manager instance
export const defaultCacheManager = new CacheManager()

// Configure cache store
export function configureCacheStore(redisClient?: Redis | Cluster): void {
  if (redisClient && process.env.NODE_ENV === 'production') {
    const redisStore = new RedisCacheStore(redisClient)
    ;(global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager =
      new CacheManager(redisStore)
  } else {
    ;(global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager =
      defaultCacheManager
  }
}

// Cache invalidation helpers
export const cacheInvalidation = {
  // Invalidate user-specific cache
  async user(userId: number): Promise<void> {
    const manager =
      (global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager ||
      defaultCacheManager
    await manager.invalidateByPattern(`*userId":${userId}*`)
  },

  // Invalidate ticket-related cache
  async ticket(ticketId: number): Promise<void> {
    const manager =
      (global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager ||
      defaultCacheManager
    await manager.invalidateByTags(['tickets', `ticket-${ticketId}`])
  },

  // Invalidate category-related cache
  async category(categoryId: number): Promise<void> {
    const manager =
      (global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager ||
      defaultCacheManager
    await manager.invalidateByTags(['categories', `category-${categoryId}`])
  },

  // Invalidate knowledge base cache
  async knowledgeBase(): Promise<void> {
    const manager =
      (global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager ||
      defaultCacheManager
    await manager.invalidateByTags(['knowledge-base'])
  },

  // Invalidate all cache
  async all(): Promise<void> {
    const manager =
      (global as typeof globalThis & { cacheManager?: CacheManager }).cacheManager ||
      defaultCacheManager
    await manager.clear()
  },
}

export default CacheManager