/**
 * Redis Cache - Main Export File
 *
 * Centralized exports for the Redis caching infrastructure.
 *
 * Usage:
 * ```typescript
 * import { initializeCacheSystem, cacheManager, sessionManager } from '@/lib/cache/redis-cache';
 *
 * // Initialize on app startup
 * await initializeCacheSystem();
 *
 * // Use cache
 * await cacheManager.set('key', 'value', { ttl: 300 });
 * const value = await cacheManager.get('key');
 * ```
 */

// ===== Core Exports =====

// Redis Client
export {
  createRedisClient,
  getRedisClient,
  RedisClient,
  defaultRedisConfig,
  clusterRedisConfig,
  sentinelRedisConfig,
} from './redis-client';
export type { RedisClientConfig } from './redis-client';

// Cache Manager
export {
  getCacheManager,
  cacheManager,
  CacheManager,
} from './cache-manager';
export type { CacheOptions, CacheStats } from './cache-manager';

// Compression
export {
  compress,
  decompress,
  isCompressed,
  getCompressionAlgorithm,
  estimateCompressionRatio,
} from './compression';
export type { CompressionAlgorithm, CompressionOptions } from './compression';

// ===== Patterns =====

export {
  cacheAside,
  writeThrough,
  writeBehind,
  readThrough,
  refreshAhead,
  CacheAsidePattern,
  WriteThroughPattern,
  WriteBehindPattern,
  ReadThroughPattern,
  RefreshAheadPattern,
} from './patterns';

// ===== Session Management =====

export {
  getSessionManager,
  sessionManager,
  SessionManager,
} from './sessions';
export type { SessionData, SessionOptions } from './sessions';

// ===== Rate Limiting =====

export {
  getRedisRateLimiter,
  redisRateLimiter,
  RedisRateLimiter,
  rateLimitPresets,
} from './rate-limit-redis';
export type { RateLimitConfig, RateLimitResult } from './rate-limit-redis';

// ===== Cache Warming =====

export {
  getCacheWarmer,
  cacheWarmer,
  warmCacheOnStartup,
  CacheWarmer,
} from './warming';
export type { WarmingStrategy, WarmingResult } from './warming';

// ===== Invalidation =====

export {
  getCacheInvalidator,
  cacheInvalidator,
  domainInvalidator,
  CacheInvalidator,
  DomainInvalidator,
} from './invalidation';
export type { InvalidationEvent, InvalidationCallback } from './invalidation';

// ===== Metrics =====

export {
  getCacheMetrics,
  cacheMetrics,
  CacheMetricsCollector,
} from './metrics';
export type { CacheMetrics } from './metrics';

// ===== Configuration =====

export {
  getCacheConfig,
  defaultCacheConfig,
  productionCacheConfig,
  developmentCacheConfig,
  ttlPresets,
  cacheOptionsPresets,
} from './config';
export type { CacheSystemConfig } from './config';

// ===== Initialization =====

export {
  getCacheInitializer,
  initializeCacheSystem,
  shutdownCacheSystem,
  cacheInitializer,
  CacheInitializer,
} from './init-cache';
export type { CacheInitOptions } from './init-cache';

// ===== Convenience Functions =====

/**
 * Quick cache helpers
 */
import { getCacheManager } from './cache-manager';
import { CacheOptions } from './cache-manager';

/**
 * Get from cache with fallback
 */
export async function cache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  const manager = getCacheManager();

  const cached = await manager.get<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  await manager.set(key, value, options);

  return value;
}

/**
 * Remember value in cache (Laravel-style)
 */
export async function remember<T>(
  key: string,
  ttl: number,
  callback: () => Promise<T>
): Promise<T> {
  return cache(key, callback, { ttl });
}

/**
 * Remember value forever (very long TTL)
 */
export async function rememberForever<T>(
  key: string,
  callback: () => Promise<T>
): Promise<T> {
  return cache(key, callback, { ttl: 86400 * 365 }); // 1 year
}

/**
 * Forget (delete) from cache
 */
export async function forget(key: string | string[]): Promise<number> {
  const manager = getCacheManager();
  return manager.del(key);
}

/**
 * Flush all cache
 */
export async function flush(): Promise<void> {
  const manager = getCacheManager();
  await manager.clear();
}

/**
 * Check if key exists in cache
 */
export async function has(key: string): Promise<boolean> {
  const manager = getCacheManager();
  return manager.exists(key);
}

/**
 * Get remaining TTL for key (in seconds)
 */
export async function ttl(key: string): Promise<number> {
  const manager = getCacheManager();
  return manager.ttl(key);
}
