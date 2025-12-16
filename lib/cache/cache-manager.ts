/**
 * Cache Manager - Unified Cache Abstraction Layer
 *
 * Provides a high-level caching interface with:
 * - Multi-level caching (L1: Memory, L2: Redis)
 * - Automatic serialization/deserialization
 * - Tag-based invalidation
 * - TTL management
 * - Pattern matching
 * - Compression support
 * - Cache statistics
 */

import { LRUCache } from 'lru-cache';
import { RedisClient, getRedisClient } from './redis-client';
import logger from '../monitoring/structured-logger';
import { compress, decompress } from './compression';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  tags?: string[]; // Tags for invalidation
  serialize?: boolean; // Auto JSON.stringify (default: true)
  compress?: boolean; // Compress large values
  compressionThreshold?: number; // Bytes threshold for compression (default: 1024)
  useL1?: boolean; // Use L1 (memory) cache (default: true)
  useL2?: boolean; // Use L2 (Redis) cache (default: true)
}

export interface CacheStats {
  l1: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
  };
  l2: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  total: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

interface CacheEntry<T = any> {
  value: T;
  compressed: boolean;
  tags: string[];
  createdAt: number;
  expiresAt: number;
}

export class CacheManager {
  private static instance: CacheManager;

  // L1 Cache (Memory - LRU)
  private l1Cache: LRUCache<string, string>;

  // L2 Cache (Redis)
  private redisClient?: RedisClient;

  // Configuration
  private config: {
    l1MaxSize: number;
    l1MaxAge: number; // milliseconds
    defaultTTL: number; // seconds
    keyPrefix: string;
    compressionThreshold: number;
    enableL1: boolean;
    enableL2: boolean;
  };

  // Statistics
  private stats: CacheStats = {
    l1: { hits: 0, misses: 0, size: 0, maxSize: 0, hitRate: 0 },
    l2: { hits: 0, misses: 0, hitRate: 0 },
    total: { hits: 0, misses: 0, hitRate: 0 },
  };

  // Tag tracking for invalidation
  private tagMap: Map<string, Set<string>> = new Map();

  private constructor(config?: Partial<typeof CacheManager.prototype.config>) {
    // Default configuration
    this.config = {
      l1MaxSize: parseInt(process.env.CACHE_L1_MAX_SIZE || '500'),
      l1MaxAge: parseInt(process.env.CACHE_L1_MAX_AGE || '60000'), // 1 minute
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'), // 5 minutes
      keyPrefix: process.env.CACHE_KEY_PREFIX || 'servicedesk',
      compressionThreshold: 1024, // 1KB
      enableL1: process.env.CACHE_ENABLE_L1 !== 'false',
      enableL2: process.env.CACHE_ENABLE_L2 !== 'false',
      ...config,
    };

    // Initialize L1 cache
    this.l1Cache = new LRUCache<string, string>({
      max: this.config.l1MaxSize,
      ttl: this.config.l1MaxAge,
      updateAgeOnGet: true,
      allowStale: false,
    });

    this.stats.l1.maxSize = this.config.l1MaxSize;

    // Initialize L2 cache (Redis) if enabled
    if (this.config.enableL2) {
      try {
        this.redisClient = getRedisClient();
      } catch (error) {
        logger.warn('CacheManager: Redis client not initialized, L2 cache disabled');
        this.config.enableL2 = false;
      }
    }

    logger.info('CacheManager initialized', {
      l1Enabled: this.config.enableL1,
      l2Enabled: this.config.enableL2,
      l1MaxSize: this.config.l1MaxSize,
      defaultTTL: this.config.defaultTTL,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<typeof CacheManager.prototype.config>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.config.keyPrefix;
    return `${finalPrefix}:${key}`;
  }

  /**
   * Serialize value
   */
  private serialize<T>(value: T, shouldSerialize: boolean = true): string {
    if (!shouldSerialize) {
      return value as any as string;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      logger.error('CacheManager: Serialization error', error);
      throw new Error('Failed to serialize cache value');
    }
  }

  /**
   * Deserialize value
   */
  private deserialize<T>(value: string, shouldDeserialize: boolean = true): T {
    if (!shouldDeserialize) {
      return value as any as T;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      logger.error('CacheManager: Deserialization error', error);
      throw new Error('Failed to deserialize cache value');
    }
  }

  /**
   * Create cache entry wrapper
   */
  private createEntry<T>(
    value: T,
    tags: string[],
    ttl: number,
    compressed: boolean
  ): CacheEntry<T> {
    const now = Date.now();
    return {
      value,
      compressed,
      tags,
      createdAt: now,
      expiresAt: now + ttl * 1000,
    };
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Get value from cache (multi-level)
   */
  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix);
    const { useL1 = this.config.enableL1, useL2 = this.config.enableL2 } = options;

    // Try L1 cache first
    if (useL1) {
      const l1Value = this.l1Cache.get(fullKey);
      if (l1Value) {
        try {
          const entry = this.deserialize<CacheEntry<T>>(l1Value);

          if (!this.isExpired(entry)) {
            this.stats.l1.hits++;
            this.stats.total.hits++;
            this.updateHitRates();

            // Decompress if needed
            if (entry.compressed) {
              entry.value = await decompress(entry.value as any) as T;
            }

            logger.debug('CacheManager: L1 hit', { key: fullKey });
            return entry.value;
          } else {
            // Remove expired entry
            this.l1Cache.delete(fullKey);
          }
        } catch (error) {
          logger.warn('CacheManager: L1 deserialization error', { key: fullKey, error });
          this.l1Cache.delete(fullKey);
        }
      }
      this.stats.l1.misses++;
    }

    // Try L2 cache (Redis)
    if (useL2 && this.redisClient) {
      try {
        const redis = this.redisClient.getClient();
        const l2Value = await redis.get(fullKey);

        if (l2Value) {
          const entry = this.deserialize<CacheEntry<T>>(l2Value);

          if (!this.isExpired(entry)) {
            this.stats.l2.hits++;
            this.stats.total.hits++;
            this.updateHitRates();

            // Decompress if needed
            if (entry.compressed) {
              entry.value = await decompress(entry.value as any) as T;
            }

            // Promote to L1
            if (useL1) {
              this.l1Cache.set(fullKey, l2Value);
            }

            logger.debug('CacheManager: L2 hit', { key: fullKey });
            return entry.value;
          } else {
            // Remove expired entry
            await redis.del(fullKey);
          }
        }
        this.stats.l2.misses++;
      } catch (error) {
        logger.error('CacheManager: L2 get error', { key: fullKey, error });
      }
    }

    this.stats.total.misses++;
    this.updateHitRates();
    return null;
  }

  /**
   * Set value in cache (multi-level)
   */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const {
      ttl = this.config.defaultTTL,
      prefix,
      tags = [],
      serialize = true,
      compress: shouldCompress,
      compressionThreshold = this.config.compressionThreshold,
      useL1 = this.config.enableL1,
      useL2 = this.config.enableL2,
    } = options;

    const fullKey = this.buildKey(key, prefix);

    // Serialize value
    let serializedValue = this.serialize(value, serialize);

    // Determine if compression is needed
    const compressed =
      shouldCompress !== false &&
      serializedValue.length > compressionThreshold;

    // Compress if needed
    if (compressed) {
      serializedValue = await compress(serializedValue);
    }

    // Create cache entry
    const entry = this.createEntry(serializedValue, tags, ttl, compressed);
    const entryString = JSON.stringify(entry);

    // Store in L1
    if (useL1) {
      this.l1Cache.set(fullKey, entryString);
      this.stats.l1.size = this.l1Cache.size;
    }

    // Store in L2 (Redis)
    if (useL2 && this.redisClient) {
      try {
        const redis = this.redisClient.getClient();
        await redis.setex(fullKey, ttl, entryString);

        // Track tags for invalidation
        if (tags.length > 0) {
          await this.trackTags(fullKey, tags, ttl);
        }
      } catch (error) {
        logger.error('CacheManager: L2 set error', { key: fullKey, error });
      }
    }

    logger.debug('CacheManager: Set', {
      key: fullKey,
      ttl,
      compressed,
      size: entryString.length,
    });
  }

  /**
   * Delete value from cache
   */
  public async del(key: string | string[], options: CacheOptions = {}): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    const { prefix } = options;

    let deleted = 0;

    for (const k of keys) {
      const fullKey = this.buildKey(k, prefix);

      // Delete from L1
      if (this.l1Cache.delete(fullKey)) {
        deleted++;
      }
      this.stats.l1.size = this.l1Cache.size;

      // Delete from L2
      if (this.redisClient) {
        try {
          const redis = this.redisClient.getClient();
          const result = await redis.del(fullKey);
          deleted += result;
        } catch (error) {
          logger.error('CacheManager: L2 delete error', { key: fullKey, error });
        }
      }
    }

    return deleted;
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.prefix);

    // Check L1
    if (this.l1Cache.has(fullKey)) {
      return true;
    }

    // Check L2
    if (this.redisClient) {
      try {
        const redis = this.redisClient.getClient();
        return (await redis.exists(fullKey)) === 1;
      } catch (error) {
        logger.error('CacheManager: L2 exists error', { key: fullKey, error });
      }
    }

    return false;
  }

  /**
   * Get multiple values from cache
   */
  public async mget<T>(keys: string[], options: CacheOptions = {}): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    // For now, get one by one (can be optimized with Redis MGET)
    for (const key of keys) {
      const value = await this.get<T>(key, options);
      results.set(key, value);
    }

    return results;
  }

  /**
   * Set multiple values in cache
   */
  public async mset(
    entries: Array<{ key: string; value: any; ttl?: number }>,
    options: CacheOptions = {}
  ): Promise<void> {
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, { ...options, ttl });
    }
  }

  /**
   * Get remaining TTL for a key (in seconds)
   */
  public async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    const fullKey = this.buildKey(key, options.prefix);

    // Check L2 (Redis has TTL command)
    if (this.redisClient) {
      try {
        const redis = this.redisClient.getClient();
        return await redis.ttl(fullKey);
      } catch (error) {
        logger.error('CacheManager: TTL error', { key: fullKey, error });
      }
    }

    // Check L1
    const l1Value = this.l1Cache.get(fullKey);
    if (l1Value) {
      try {
        const entry = this.deserialize<CacheEntry>(l1Value);
        const remaining = Math.max(0, entry.expiresAt - Date.now());
        return Math.floor(remaining / 1000);
      } catch (error) {
        logger.warn('CacheManager: TTL deserialization error', error);
      }
    }

    return -2; // Key does not exist
  }

  /**
   * Track tags for a cache key
   */
  private async trackTags(key: string, tags: string[], ttl: number): Promise<void> {
    if (!this.redisClient) return;

    try {
      const redis = this.redisClient.getClient();
      const pipeline = redis.pipeline();

      for (const tag of tags) {
        const tagKey = this.buildKey(`tag:${tag}`);
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, ttl);

        // Track in memory for L1
        if (!this.tagMap.has(tag)) {
          this.tagMap.set(tag, new Set());
        }
        this.tagMap.get(tag)!.add(key);
      }

      await pipeline.exec();
    } catch (error) {
      logger.error('CacheManager: Track tags error', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    let deleted = 0;

    for (const tag of tags) {
      // Get all keys with this tag from Redis
      if (this.redisClient) {
        try {
          const redis = this.redisClient.getClient();
          const tagKey = this.buildKey(`tag:${tag}`);
          const keys = await redis.smembers(tagKey);

          if (keys.length > 0) {
            // Delete all keys
            deleted += await redis.del(...keys);

            // Delete from L1
            for (const key of keys) {
              this.l1Cache.delete(key);
            }

            // Delete tag set
            await redis.del(tagKey);
          }
        } catch (error) {
          logger.error('CacheManager: Invalidate by tags error', { tag, error });
        }
      }

      // Invalidate from L1 tag map
      const l1Keys = this.tagMap.get(tag);
      if (l1Keys) {
        const keysArray = Array.from(l1Keys);
        for (const key of keysArray) {
          this.l1Cache.delete(key);
          deleted++;
        }
        this.tagMap.delete(tag);
      }
    }

    this.stats.l1.size = this.l1Cache.size;
    logger.info('CacheManager: Invalidated by tags', { tags, deleted });

    return deleted;
  }

  /**
   * Invalidate cache by pattern
   */
  public async invalidateByPattern(pattern: string): Promise<number> {
    let deleted = 0;

    // Invalidate in Redis
    if (this.redisClient) {
      try {
        const redis = this.redisClient.getClient();
        const fullPattern = this.buildKey(pattern);

        // Scan for keys
        const keys: string[] = [];
        let cursor = '0';

        do {
          const [nextCursor, matchedKeys] = await redis.scan(
            cursor,
            'MATCH',
            fullPattern,
            'COUNT',
            100
          );
          cursor = nextCursor;
          keys.push(...matchedKeys);
        } while (cursor !== '0');

        // Delete keys
        if (keys.length > 0) {
          deleted += await redis.del(...keys);
        }
      } catch (error) {
        logger.error('CacheManager: Invalidate by pattern error', { pattern, error });
      }
    }

    // Invalidate in L1
    const regex = new RegExp(pattern);
    const l1Keys = Array.from(this.l1Cache.keys());
    for (const key of l1Keys) {
      if (regex.test(key)) {
        this.l1Cache.delete(key);
        deleted++;
      }
    }

    this.stats.l1.size = this.l1Cache.size;
    logger.info('CacheManager: Invalidated by pattern', { pattern, deleted });

    return deleted;
  }

  /**
   * Clear all cache
   */
  public async clear(): Promise<void> {
    // Clear L1
    this.l1Cache.clear();
    this.tagMap.clear();
    this.stats.l1.size = 0;

    // Clear L2 (Redis) - only keys with our prefix
    if (this.redisClient) {
      try {
        await this.invalidateByPattern('*');
      } catch (error) {
        logger.error('CacheManager: Clear L2 error', error);
      }
    }

    logger.info('CacheManager: All cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateHitRates();
    return JSON.parse(JSON.stringify(this.stats));
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      l1: {
        hits: 0,
        misses: 0,
        size: this.l1Cache.size,
        maxSize: this.config.l1MaxSize,
        hitRate: 0,
      },
      l2: { hits: 0, misses: 0, hitRate: 0 },
      total: { hits: 0, misses: 0, hitRate: 0 },
    };
  }

  /**
   * Update hit rates
   */
  private updateHitRates(): void {
    // L1 hit rate
    const l1Total = this.stats.l1.hits + this.stats.l1.misses;
    this.stats.l1.hitRate =
      l1Total > 0 ? (this.stats.l1.hits / l1Total) * 100 : 0;

    // L2 hit rate
    const l2Total = this.stats.l2.hits + this.stats.l2.misses;
    this.stats.l2.hitRate =
      l2Total > 0 ? (this.stats.l2.hits / l2Total) * 100 : 0;

    // Total hit rate
    const totalHits = this.stats.total.hits;
    const totalMisses = this.stats.total.misses;
    const total = totalHits + totalMisses;
    this.stats.total.hitRate = total > 0 ? (totalHits / total) * 100 : 0;
  }
}

/**
 * Create or get CacheManager instance
 */
export function getCacheManager(config?: Partial<any>): CacheManager {
  return CacheManager.getInstance(config);
}

/**
 * Export singleton
 */
export const cacheManager = CacheManager.getInstance();
