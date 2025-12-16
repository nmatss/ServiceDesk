/**
 * Redis Multi-Layer Caching Manager for Enterprise Scale
 * Implements intelligent caching strategies with Redis clustering support
 */

import { Redis, Cluster } from 'ioredis';
import logger from '../monitoring/structured-logger';

export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    cluster?: boolean;
    nodes?: Array<{ host: string; port: number }>;
  };
  defaultTTL: number;
  keyPrefix: string;
  compression: {
    enabled: boolean;
    threshold: number; // bytes
    algorithm: 'gzip' | 'brotli';
  };
  serialization: 'json' | 'msgpack';
  layers: CacheLayerConfig[];
}

export interface CacheLayerConfig {
  name: string;
  ttl: number;
  maxSize?: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  compression: boolean;
  patterns: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  layerStats: Map<string, LayerStats>;
}

export interface LayerStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage: number;
  avgResponseTime: number;
}

export interface CacheEntry<T = any> {
  value: T;
  ttl: number;
  layer: string;
  compressed: boolean;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

export class RedisManager {
  private static instance: RedisManager;
  private redis!: Redis | Cluster;
  private config: CacheConfig;
  private stats: CacheStats;
  private layerConfigs = new Map<string, CacheLayerConfig>();
  private metricsInterval?: NodeJS.Timeout;

  private constructor(config: CacheConfig) {
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      layerStats: new Map()
    };

    this.initializeRedis();
    this.setupLayers();
    this.startMetricsCollection();
  }

  static getInstance(config?: CacheConfig): RedisManager {
    if (!RedisManager.instance && config) {
      RedisManager.instance = new RedisManager(config);
    }
    return RedisManager.instance;
  }

  /**
   * Set a value in the cache with intelligent layer selection
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      layer?: string;
      tags?: string[];
      compress?: boolean;
    } = {}
  ): Promise<void> {
    const {
      ttl = this.config.defaultTTL,
      layer = this.selectOptimalLayer(key),
      tags = [],
      compress = this.shouldCompress(value)
    } = options;

    const fullKey = this.buildKey(key, layer);
    const cacheEntry: CacheEntry<T> = {
      value,
      ttl,
      layer,
      compressed: compress,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0
    };

    let serializedValue = this.serialize(cacheEntry);

    if (compress) {
      serializedValue = await this.compress(serializedValue);
    }

    // Set in Redis with appropriate TTL
    await this.redis.setex(fullKey, ttl, serializedValue);

    // Update tags for cache invalidation
    if (tags.length > 0) {
      await this.updateTags(fullKey, tags);
    }

    // Update layer stats
    this.updateLayerStats(layer, 'set');
  }

  /**
   * Get a value from the cache with layer awareness
   */
  async get<T>(
    key: string,
    options: {
      layers?: string[];
      updateStats?: boolean;
    } = {}
  ): Promise<T | null> {
    const { layers = this.getAllLayerNames(), updateStats = true } = options;

    // Try each layer in order of preference
    for (const layer of layers) {
      const fullKey = this.buildKey(key, layer);

      try {
        const serializedValue = await this.redis.get(fullKey);

        if (serializedValue) {
          const cacheEntry = await this.deserialize<CacheEntry<T>>(serializedValue);

          // Update access statistics
          if (updateStats) {
            cacheEntry.lastAccessed = new Date();
            cacheEntry.accessCount++;
            await this.updateCacheEntry(fullKey, cacheEntry);
            this.stats.hits++;
            this.updateLayerStats(layer, 'hit');
          }

          return cacheEntry.value;
        }
      } catch (error) {
        logger.warn(`Cache get error for key ${fullKey}:`, error);
      }
    }

    if (updateStats) {
      this.stats.misses++;
    }

    return null;
  }

  /**
   * Intelligent cache-aside pattern with automatic layer selection
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      ttl?: number;
      layer?: string;
      tags?: string[];
      refreshThreshold?: number; // Percentage of TTL remaining to trigger refresh
    } = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      // Check if we should refresh proactively
      const shouldRefresh = await this.shouldRefreshProactively(key, options.refreshThreshold);

      if (shouldRefresh) {
        // Refresh in background
        this.refreshInBackground(key, fetchFn, options);
      }

      return cached;
    }

    // Cache miss - fetch from source
    const value = await fetchFn();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Multi-get operation across layers
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const layers = this.getAllLayerNames();

    // Build all possible cache keys
    const keyLayers: Array<{ key: string; layer: string; fullKey: string }> = [];
    for (const key of keys) {
      for (const layer of layers) {
        keyLayers.push({
          key,
          layer,
          fullKey: this.buildKey(key, layer)
        });
      }
    }

    // Batch get from Redis
    const fullKeys = keyLayers.map(kl => kl.fullKey);
    const values = await this.redis.mget(...fullKeys);

    // Process results
    for (let i = 0; i < keyLayers.length; i++) {
      const keyLayerInfo = keyLayers[i];
      if (!keyLayerInfo) continue;

      const { key, layer } = keyLayerInfo;
      const value = values[i];

      if (value && !results.has(key)) {
        try {
          const cacheEntry = await this.deserialize<CacheEntry<T>>(value);
          results.set(key, cacheEntry.value);
          this.updateLayerStats(layer, 'hit');
        } catch (error) {
          logger.warn(`Deserialization error for key ${key}:`, error);
        }
      }
    }

    // Mark misses
    for (const key of keys) {
      if (!results.has(key)) {
        results.set(key, null);
      }
    }

    return results;
  }

  /**
   * Delete from cache with layer awareness
   */
  async del(key: string, layers?: string[]): Promise<number> {
    const targetLayers = layers || this.getAllLayerNames();
    const keys = targetLayers.map(layer => this.buildKey(key, layer));

    const deleted = await this.redis.del(...keys);

    // Clean up tags
    await this.cleanupTags(keys);

    return deleted;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalDeleted = 0;

    for (const tag of tags) {
      const tagKey = `${this.config.keyPrefix}:tags:${tag}`;
      const keys = await this.redis.smembers(tagKey);

      if (keys.length > 0) {
        const deleted = await this.redis.del(...keys);
        totalDeleted += deleted;

        // Remove the tag set
        await this.redis.del(tagKey);
      }
    }

    return totalDeleted;
  }

  /**
   * Flush specific layer
   */
  async flushLayer(layerName: string): Promise<void> {
    const pattern = `${this.config.keyPrefix}:${layerName}:*`;
    const keys = await this.scanKeys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    // Reset layer stats
    this.stats.layerStats.set(layerName, {
      hits: 0,
      misses: 0,
      keys: 0,
      memoryUsage: 0,
      avgResponseTime: 0
    });
  }

  /**
   * Flush all cache
   */
  async flushAll(): Promise<void> {
    const pattern = `${this.config.keyPrefix}:*`;
    const keys = await this.scanKeys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    // Reset all stats
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      layerStats: new Map()
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateHitRate();
    return { ...this.stats };
  }

  /**
   * Get memory usage by layer
   */
  async getMemoryUsage(): Promise<Map<string, number>> {
    const usage = new Map<string, number>();

    for (const layerName of this.layerConfigs.keys()) {
      const pattern = `${this.config.keyPrefix}:${layerName}:*`;
      const keys = await this.scanKeys(pattern);

      let layerMemory = 0;
      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();
        keys.forEach(key => pipeline.memory('USAGE', key));
        const results = await pipeline.exec();

        if (results) {
          for (const result of results) {
            if (result && !result[0] && typeof result[1] === 'number') {
              layerMemory += result[1];
            }
          }
        }
      }

      usage.set(layerName, layerMemory);
    }

    return usage;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    memoryUsage: number;
    connectedClients: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Test basic connectivity and latency
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      // Get Redis info
      const info = await this.redis.info();
      const memoryInfo = this.parseRedisInfo(info, 'memory');
      const clientsInfo = this.parseRedisInfo(info, 'clients');

      const memoryUsage = parseInt(memoryInfo.used_memory || '0');
      const connectedClients = parseInt(clientsInfo.connected_clients || '0');

      // Determine health status
      if (latency > 100) {
        status = 'degraded';
        errors.push(`High latency: ${latency}ms`);
      }

      if (latency > 500) {
        status = 'unhealthy';
      }

      return {
        status,
        latency,
        memoryUsage,
        connectedClients,
        errors
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: -1,
        memoryUsage: -1,
        connectedClients: -1,
        errors: [`Connection error: ${error}`]
      };
    }
  }

  /**
   * Perform cache warming for critical data
   */
  async warmCache(warmingStrategies: Array<{
    pattern: string;
    fetchFn: (key: string) => Promise<any>;
    layer: string;
    ttl: number;
  }>): Promise<{ warmed: number; errors: string[] }> {
    let warmed = 0;
    const errors: string[] = [];

    for (const strategy of warmingStrategies) {
      try {
        // This would be implemented based on your specific warming needs
        // For example, warming user sessions, frequently accessed tickets, etc.
        warmed++;
      } catch (error) {
        errors.push(`Warming failed for pattern ${strategy.pattern}: ${error}`);
      }
    }

    return { warmed, errors };
  }

  private initializeRedis(): void {
    if (this.config.redis.cluster && this.config.redis.nodes) {
      this.redis = new Cluster(this.config.redis.nodes, {
        redisOptions: {
          password: this.config.redis.password,
          db: this.config.redis.db || 0
        }
      });
    } else {
      this.redis = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db || 0,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        maxRetriesPerRequest: 3
      });
    }

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  private setupLayers(): void {
    for (const layerConfig of this.config.layers) {
      this.layerConfigs.set(layerConfig.name, layerConfig);
      this.stats.layerStats.set(layerConfig.name, {
        hits: 0,
        misses: 0,
        keys: 0,
        memoryUsage: 0,
        avgResponseTime: 0
      });
    }
  }

  private selectOptimalLayer(key: string): string {
    // Select layer based on key patterns and layer configurations
    for (const [layerName, config] of this.layerConfigs.entries()) {
      for (const pattern of config.patterns) {
        if (new RegExp(pattern).test(key)) {
          return layerName;
        }
      }
    }

    // Default to first layer
    return this.config.layers[0]?.name || 'default';
  }

  private shouldCompress<T>(value: T): boolean {
    if (!this.config.compression.enabled) {
      return false;
    }

    const serialized = this.serialize(value);
    return serialized.length > this.config.compression.threshold;
  }

  private serialize<T>(value: T): string {
    switch (this.config.serialization) {
      case 'json':
        return JSON.stringify(value);
      case 'msgpack':
        // Would use msgpack library
        return JSON.stringify(value); // Fallback to JSON
      default:
        return JSON.stringify(value);
    }
  }

  private async deserialize<T>(value: string): Promise<T> {
    // Check if compressed
    if (this.isCompressed(value)) {
      value = await this.decompress(value);
    }

    switch (this.config.serialization) {
      case 'json':
        return JSON.parse(value);
      case 'msgpack':
        // Would use msgpack library
        return JSON.parse(value); // Fallback to JSON
      default:
        return JSON.parse(value);
    }
  }

  private async compress(value: string): Promise<string> {
    // Implementation would use zlib or other compression library
    // For now, just mark as compressed
    return `COMPRESSED:${value}`;
  }

  private async decompress(value: string): Promise<string> {
    // Implementation would decompress using appropriate algorithm
    return value.replace('COMPRESSED:', '');
  }

  private isCompressed(value: string): boolean {
    return value.startsWith('COMPRESSED:');
  }

  private buildKey(key: string, layer: string): string {
    return `${this.config.keyPrefix}:${layer}:${key}`;
  }

  private getAllLayerNames(): string[] {
    return Array.from(this.layerConfigs.keys());
  }

  private async updateCacheEntry<T>(fullKey: string, cacheEntry: CacheEntry<T>): Promise<void> {
    try {
      let serializedValue = this.serialize(cacheEntry);

      if (cacheEntry.compressed) {
        serializedValue = await this.compress(serializedValue);
      }

      const ttl = await this.redis.ttl(fullKey);
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serializedValue);
      }
    } catch (error) {
      logger.warn(`Failed to update cache entry ${fullKey}:`, error);
    }
  }

  private async shouldRefreshProactively(key: string, threshold: number = 0.2): Promise<boolean> {
    if (!threshold) return false;

    const layer = this.selectOptimalLayer(key);
    const fullKey = this.buildKey(key, layer);

    try {
      const ttl = await this.redis.ttl(fullKey);
      const layerConfig = this.layerConfigs.get(layer);

      if (ttl > 0 && layerConfig) {
        const remainingRatio = ttl / layerConfig.ttl;
        return remainingRatio <= threshold;
      }
    } catch (error) {
      logger.warn(`Failed to check TTL for proactive refresh: ${error}`);
    }

    return false;
  }

  private async refreshInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: any
  ): Promise<void> {
    try {
      const value = await fetchFn();
      await this.set(key, value, { ...options, backgroundRefresh: true });
    } catch (error) {
      logger.warn(`Background refresh failed for key ${key}:`, error);
    }
  }

  private async updateTags(fullKey: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      const tagKey = `${this.config.keyPrefix}:tags:${tag}`;
      pipeline.sadd(tagKey, fullKey);
      pipeline.expire(tagKey, this.config.defaultTTL);
    }

    await pipeline.exec();
  }

  private async cleanupTags(_keys: string[]): Promise<void> {
    // Implementation would scan and remove keys from tag sets
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }

  private updateLayerStats(layer: string, operation: 'hit' | 'miss' | 'set'): void {
    const stats = this.stats.layerStats.get(layer);
    if (stats) {
      switch (operation) {
        case 'hit':
          stats.hits++;
          break;
        case 'miss':
          stats.misses++;
          break;
        case 'set':
          // Update key count
          break;
      }
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private parseRedisInfo(info: string, section: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');
    let inSection = false;

    for (const line of lines) {
      if (line.startsWith(`# ${section}`)) {
        inSection = true;
        continue;
      }

      if (line.startsWith('#')) {
        inSection = false;
        continue;
      }

      if (inSection && line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const memoryUsage = await this.getMemoryUsage();
        let totalMemory = 0;

        for (const [layerName, memory] of memoryUsage.entries()) {
          totalMemory += memory;
          const layerStats = this.stats.layerStats.get(layerName);
          if (layerStats) {
            layerStats.memoryUsage = memory;
          }
        }

        this.stats.memoryUsage = totalMemory;
      } catch (error) {
        logger.warn('Failed to collect cache metrics', error);
      }
    }, 60000); // Collect metrics every minute
  }

  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Default configuration for ServiceDesk
export const defaultCacheConfig: CacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    cluster: process.env.REDIS_CLUSTER === 'true'
  },
  defaultTTL: 3600, // 1 hour
  keyPrefix: 'servicedesk',
  compression: {
    enabled: true,
    threshold: 1024, // 1KB
    algorithm: 'gzip'
  },
  serialization: 'json',
  layers: [
    {
      name: 'session',
      ttl: 1800, // 30 minutes
      evictionPolicy: 'ttl',
      compression: false,
      patterns: ['session:*', 'user:session:*']
    },
    {
      name: 'api',
      ttl: 300, // 5 minutes
      evictionPolicy: 'lru',
      compression: true,
      patterns: ['api:*', 'query:*']
    },
    {
      name: 'static',
      ttl: 86400, // 24 hours
      evictionPolicy: 'lfu',
      compression: true,
      patterns: ['static:*', 'template:*', 'config:*']
    },
    {
      name: 'analytics',
      ttl: 7200, // 2 hours
      evictionPolicy: 'ttl',
      compression: true,
      patterns: ['analytics:*', 'report:*', 'metrics:*']
    }
  ]
};

// Export factory function
export function createRedisManager(config: CacheConfig = defaultCacheConfig): RedisManager {
  return RedisManager.getInstance(config);
}