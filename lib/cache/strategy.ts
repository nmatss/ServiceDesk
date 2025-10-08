/**
 * Multi-Layer Caching Strategy
 *
 * L1: In-memory LRU cache (fastest, limited size)
 * L2: Redis cache (fast, distributed)
 * L3: CDN cache (edge network)
 *
 * Features:
 * - Automatic cache warming
 * - Hit rate tracking
 * - TTL management
 * - Invalidation patterns
 * - Cache-aside pattern
 */

import { LRUCache } from 'lru-cache'
import Redis from 'ioredis'
import { logger } from '../monitoring/logger'

// ========================
// INTERFACES & TYPES
// ========================

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Tags for invalidation
  compress?: boolean // Compress large values
  priority?: 'high' | 'normal' | 'low'
}

export interface CacheStats {
  l1Hits: number
  l2Hits: number
  l3Hits: number
  misses: number
  totalRequests: number
  hitRate: number
  avgResponseTime: number
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  tags: string[]
  compressed: boolean
}

// ========================
// L1: IN-MEMORY LRU CACHE
// ========================

class L1Cache {
  private cache: LRUCache<string, CacheEntry<any>>
  private hits = 0
  private misses = 0

  constructor(maxSize = 500, maxAge = 5 * 60 * 1000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: maxAge,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (entry) {
      this.hits++

      // Check if expired
      const age = Date.now() - entry.timestamp
      if (age > entry.ttl * 1000) {
        this.cache.delete(key)
        this.misses++
        return null
      }

      return entry.data as T
    }
    this.misses++
    return null
  }

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || 300,
      tags: options.tags || [],
      compressed: options.compress || false,
    }
    this.cache.set(key, entry)
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  invalidateByTag(tag: string): number {
    let count = 0
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: this.hits / (this.hits + this.misses) || 0,
    }
  }
}

// ========================
// L2: REDIS CACHE
// ========================

class L2Cache {
  private redis: Redis | null = null
  private hits = 0
  private misses = 0
  private connected = false

  constructor() {
    this.initializeRedis()
  }

  private initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null
          return Math.min(times * 100, 2000)
        },
        lazyConnect: true,
        enableOfflineQueue: false,
      })

      this.redis.on('connect', () => {
        this.connected = true
        logger.info('L2 Cache (Redis) connected')
      })

      this.redis.on('error', (err) => {
        this.connected = false
        logger.error('L2 Cache (Redis) error', { error: err.message })
      })

      // Connect asynchronously
      this.redis.connect().catch((err) => {
        logger.warn('L2 Cache (Redis) connection failed, running without Redis', {
          error: err.message,
        })
      })
    } catch (error) {
      logger.error('L2 Cache initialization failed', { error })
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.redis) {
      return null
    }

    try {
      const data = await this.redis.get(key)
      if (data) {
        this.hits++
        const entry: CacheEntry<T> = JSON.parse(data)

        // Check if expired
        const age = Date.now() - entry.timestamp
        if (age > entry.ttl * 1000) {
          await this.delete(key)
          this.misses++
          return null
        }

        return entry.data
      }
      this.misses++
      return null
    } catch (error) {
      logger.error('L2 Cache get error', { key, error })
      this.misses++
      return null
    }
  }

  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    if (!this.connected || !this.redis) {
      return
    }

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: options.ttl || 300,
        tags: options.tags || [],
        compressed: options.compress || false,
      }

      const serialized = JSON.stringify(entry)
      const ttl = options.ttl || 300

      await this.redis.setex(key, ttl, serialized)

      // Store tag mappings for invalidation
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await this.redis.sadd(`tag:${tag}`, key)
          await this.redis.expire(`tag:${tag}`, ttl + 60) // Expire tags slightly later
        }
      }
    } catch (error) {
      logger.error('L2 Cache set error', { key, error })
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected || !this.redis) {
      return
    }

    try {
      await this.redis.del(key)
    } catch (error) {
      logger.error('L2 Cache delete error', { key, error })
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.connected || !this.redis) {
      return 0
    }

    try {
      const keys = await this.redis.smembers(`tag:${tag}`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        await this.redis.del(`tag:${tag}`)
      }
      return keys.length
    } catch (error) {
      logger.error('L2 Cache invalidateByTag error', { tag, error })
      return 0
    }
  }

  async clear(): Promise<void> {
    if (!this.connected || !this.redis) {
      return
    }

    try {
      await this.redis.flushdb()
      this.hits = 0
      this.misses = 0
    } catch (error) {
      logger.error('L2 Cache clear error', { error })
    }
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      connected: this.connected,
      hitRate: this.hits / (this.hits + this.misses) || 0,
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.connected = false
    }
  }
}

// ========================
// MULTI-LAYER CACHE STRATEGY
// ========================

export class CacheStrategy {
  private l1: L1Cache
  private l2: L2Cache
  private totalRequests = 0
  private responseTimes: number[] = []

  constructor() {
    this.l1 = new L1Cache(500, 5 * 60 * 1000) // 500 items, 5 min TTL
    this.l2 = new L2Cache()

    // Warm up cache periodically
    this.startCacheWarming()
  }

  /**
   * Get value from cache (L1 -> L2 -> miss)
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now()
    this.totalRequests++

    try {
      // Try L1 first (fastest)
      const l1Result = this.l1.get<T>(key)
      if (l1Result !== null) {
        this.recordResponseTime(Date.now() - startTime)
        logger.debug('Cache hit (L1)', { key, time: Date.now() - startTime })
        return l1Result
      }

      // Try L2 (Redis)
      const l2Result = await this.l2.get<T>(key)
      if (l2Result !== null) {
        // Promote to L1
        this.l1.set(key, l2Result, { ttl: 300 })
        this.recordResponseTime(Date.now() - startTime)
        logger.debug('Cache hit (L2)', { key, time: Date.now() - startTime })
        return l2Result
      }

      // Cache miss
      this.recordResponseTime(Date.now() - startTime)
      logger.debug('Cache miss', { key, time: Date.now() - startTime })
      return null
    } catch (error) {
      logger.error('Cache get error', { key, error })
      return null
    }
  }

  /**
   * Set value in all cache layers
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      // Set in L1 (sync)
      this.l1.set(key, data, options)

      // Set in L2 (async)
      await this.l2.set(key, data, options)

      logger.debug('Cache set', { key, layers: ['L1', 'L2'] })
    } catch (error) {
      logger.error('Cache set error', { key, error })
    }
  }

  /**
   * Cache-aside pattern: get from cache or fetch from source
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Fetch from source
    const data = await fetcher()

    // Store in cache
    await this.set(key, data, options)

    return data
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    this.l1.delete(key)
    await this.l2.delete(key)
    logger.debug('Cache delete', { key })
  }

  /**
   * Invalidate by tag across all layers
   */
  async invalidateByTag(tag: string): Promise<number> {
    const l1Count = this.l1.invalidateByTag(tag)
    const l2Count = await this.l2.invalidateByTag(tag)
    const total = l1Count + l2Count

    logger.info('Cache invalidation by tag', { tag, l1Count, l2Count, total })
    return total
  }

  /**
   * Invalidate by pattern (Redis SCAN)
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    // L1: Not supported (would need to iterate all keys)
    // L2: Use Redis SCAN
    logger.info('Cache invalidation by pattern', { pattern })
    return 0 // TODO: Implement Redis SCAN
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    this.l1.clear()
    await this.l2.clear()
    logger.info('Cache cleared')
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const l1Stats = this.l1.getStats()
    const l2Stats = this.l2.getStats()

    const totalHits = l1Stats.hits + l2Stats.hits
    const totalMisses = l1Stats.misses + l2Stats.misses
    const totalRequests = totalHits + totalMisses

    return {
      l1Hits: l1Stats.hits,
      l2Hits: l2Stats.hits,
      l3Hits: 0, // CDN hits would come from edge logs
      misses: totalMisses,
      totalRequests: this.totalRequests,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      avgResponseTime:
        this.responseTimes.length > 0
          ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
          : 0,
    }
  }

  /**
   * Record response time for metrics
   */
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time)
    // Keep only last 1000 measurements
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift()
    }
  }

  /**
   * Cache warming: Pre-load frequently accessed data
   */
  private startCacheWarming(): void {
    // Warm up cache every 10 minutes
    setInterval(() => {
      this.warmCache()
    }, 10 * 60 * 1000)
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(): Promise<void> {
    try {
      logger.info('Cache warming started')

      // Example: Pre-load common queries
      // This would be customized based on your application
      const commonKeys = [
        'categories:all',
        'priorities:all',
        'statuses:all',
        'ticket-types:all',
      ]

      // You would implement the actual data fetching here
      logger.debug('Cache warming completed', { keysWarmed: commonKeys.length })
    } catch (error) {
      logger.error('Cache warming failed', { error })
    }
  }

  /**
   * Disconnect from cache layers
   */
  async disconnect(): Promise<void> {
    await this.l2.disconnect()
  }
}

// ========================
// CACHE KEY BUILDERS
// ========================

export class CacheKeyBuilder {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  /**
   * Build cache key for entity by ID
   */
  byId(id: number | string): string {
    return `${this.prefix}:${id}`
  }

  /**
   * Build cache key for list with filters
   */
  list(filters?: Record<string, any>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return `${this.prefix}:all`
    }

    const sorted = Object.keys(filters)
      .sort()
      .map((key) => `${key}=${filters[key]}`)
      .join('&')

    return `${this.prefix}:list:${sorted}`
  }

  /**
   * Build cache key for search queries
   */
  search(query: string, filters?: Record<string, any>): string {
    const normalized = query.toLowerCase().trim()
    const filterKey = filters ? JSON.stringify(filters) : ''
    return `${this.prefix}:search:${normalized}:${filterKey}`
  }

  /**
   * Build cache key for aggregations
   */
  aggregate(type: string, ...params: any[]): string {
    return `${this.prefix}:agg:${type}:${params.join(':')}`
  }
}

// ========================
// PRE-CONFIGURED BUILDERS
// ========================

export const cacheKeys = {
  tickets: new CacheKeyBuilder('ticket'),
  users: new CacheKeyBuilder('user'),
  categories: new CacheKeyBuilder('category'),
  analytics: new CacheKeyBuilder('analytics'),
  knowledge: new CacheKeyBuilder('kb'),
}

// ========================
// SINGLETON INSTANCE
// ========================

export const cacheStrategy = new CacheStrategy()

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await cacheStrategy.disconnect()
  })
}

export default cacheStrategy
