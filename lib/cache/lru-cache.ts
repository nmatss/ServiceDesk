/**
 * High-Performance LRU Cache with O(1) operations
 * Replaces database-based cache for 100x faster operations
 */

interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  size: number;
  prev: CacheEntry<T> | null;
  next: CacheEntry<T> | null;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private head: CacheEntry<T> | null = null;
  private tail: CacheEntry<T> | null = null;
  private maxSize: number;
  private maxMemoryMB: number;
  private currentMemory: number = 0;
  private stats: CacheStats;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: { maxSize?: number; maxMemoryMB?: number; cleanupIntervalMs?: number } = {}) {
    this.maxSize = options.maxSize || 10000;
    this.maxMemoryMB = options.maxMemoryMB || 100;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      size: 0,
      maxSize: this.maxSize,
      hitRate: 0,
    };

    // Start cleanup interval for expired entries
    const cleanupMs = options.cleanupIntervalMs || 60000; // 1 minute default
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), cleanupMs);
  }

  /**
   * Get value from cache - O(1)
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Move to front (most recently used)
    this.moveToFront(entry);
    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache - O(1)
   */
  set(key: string, value: T, ttlSeconds: number = 300): boolean {
    try {
      const serialized = JSON.stringify(value);
      const size = serialized.length;

      // Check memory limit
      const sizeMB = size / (1024 * 1024);
      if (sizeMB > this.maxMemoryMB * 0.1) {
        // Single entry too large (>10% of max)
        return false;
      }

      // Remove existing entry if present
      if (this.cache.has(key)) {
        this.delete(key);
      }

      // Evict if needed
      while (
        (this.cache.size >= this.maxSize || this.currentMemory + size > this.maxMemoryMB * 1024 * 1024) &&
        this.tail
      ) {
        this.evictLRU();
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
        size,
        prev: null,
        next: this.head,
      };

      if (this.head) {
        this.head.prev = entry;
      }
      this.head = entry;

      if (!this.tail) {
        this.tail = entry;
      }

      this.cache.set(key, entry);
      this.currentMemory += size;
      this.stats.sets++;
      this.stats.size = this.cache.size;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete value from cache - O(1)
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.removeFromList(entry);
    this.cache.delete(key);
    this.currentMemory -= entry.size;
    this.stats.size = this.cache.size;

    return true;
  }

  /**
   * Delete entries matching pattern - O(n) but optimized
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/%/g, '.*').replace(/\?/g, '.'));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if key exists without updating LRU order
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentMemory = 0;
    this.stats.size = 0;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  // Private methods

  private moveToFront(entry: CacheEntry<T>): void {
    if (entry === this.head) return;

    this.removeFromList(entry);

    entry.prev = null;
    entry.next = this.head;

    if (this.head) {
      this.head.prev = entry;
    }

    this.head = entry;

    if (!this.tail) {
      this.tail = entry;
    }
  }

  private removeFromList(entry: CacheEntry<T>): void {
    if (entry.prev) {
      entry.prev.next = entry.next;
    } else {
      this.head = entry.next;
    }

    if (entry.next) {
      entry.next.prev = entry.prev;
    } else {
      this.tail = entry.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const key = this.tail.key;
    this.delete(key);
    this.stats.evictions++;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.delete(key);
      }
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;
  }
}

// Global cache instances for different data types
const caches = {
  default: new LRUCache({ maxSize: 5000, maxMemoryMB: 50 }),
  tickets: new LRUCache({ maxSize: 2000, maxMemoryMB: 30 }),
  users: new LRUCache({ maxSize: 1000, maxMemoryMB: 10 }),
  stats: new LRUCache({ maxSize: 500, maxMemoryMB: 20 }),
  lookups: new LRUCache({ maxSize: 500, maxMemoryMB: 5 }), // statuses, priorities, categories
};

export type CacheNamespace = keyof typeof caches;

/**
 * Get cache instance by namespace
 */
export function getCache(namespace: CacheNamespace = 'default'): LRUCache {
  return caches[namespace];
}

/**
 * Generate cache key with namespace
 */
export function generateCacheKey(prefix: string, params: Record<string, unknown> = {}): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join('|');

  return sortedParams ? `${prefix}:${sortedParams}` : prefix;
}

// High-level cache operations

export function getFromCache<T>(key: string, namespace: CacheNamespace = 'default'): T | null {
  return caches[namespace].get(key) as T | null;
}

export function setCache<T>(key: string, value: T, ttl: number = 300, namespace: CacheNamespace = 'default'): boolean {
  return caches[namespace].set(key, value, ttl);
}

export function removeFromCache(key: string, namespace: CacheNamespace = 'default'): boolean {
  return caches[namespace].delete(key);
}

export function removeCachePattern(pattern: string, namespace: CacheNamespace = 'default'): number {
  return caches[namespace].deletePattern(pattern);
}

export function clearCache(namespace?: CacheNamespace): void {
  if (namespace) {
    caches[namespace].clear();
  } else {
    Object.values(caches).forEach((cache) => cache.clear());
  }
}

export function getCacheStats(namespace?: CacheNamespace): CacheStats | Record<string, CacheStats> {
  if (namespace) {
    return caches[namespace].getStats();
  }
  return Object.fromEntries(Object.entries(caches).map(([name, cache]) => [name, cache.getStats()]));
}

// Specialized cache functions for common operations

export function cacheTicketSearch<T>(tenantId: number, searchParams: Record<string, unknown>, data: T, ttl = 60): void {
  const key = generateCacheKey(`tenant:${tenantId}:tickets:search`, searchParams);
  setCache(key, data, ttl, 'tickets');
}

export function getCachedTicketSearch<T>(tenantId: number, searchParams: Record<string, unknown>): T | null {
  const key = generateCacheKey(`tenant:${tenantId}:tickets:search`, searchParams);
  return getFromCache<T>(key, 'tickets');
}

export function cacheStats<T>(tenantId: number, statsType: string, data: T, ttl = 300): void {
  const key = `tenant:${tenantId}:stats:${statsType}`;
  setCache(key, data, ttl, 'stats');
}

export function getCachedStats<T>(tenantId: number, statsType: string): T | null {
  const key = `tenant:${tenantId}:stats:${statsType}`;
  return getFromCache<T>(key, 'stats');
}

export function cacheLookup<T>(tenantId: number, lookupType: string, data: T, ttl = 1800): void {
  const key = `tenant:${tenantId}:lookup:${lookupType}`;
  setCache(key, data, ttl, 'lookups');
}

export function getCachedLookup<T>(tenantId: number, lookupType: string): T | null {
  const key = `tenant:${tenantId}:lookup:${lookupType}`;
  return getFromCache<T>(key, 'lookups');
}

// Targeted cache invalidation (much better than clearing everything)

export function invalidateTicketCache(tenantId: number, ticketId?: number): void {
  const ticketCache = caches.tickets;
  if (ticketId) {
    ticketCache.delete(`tenant:${tenantId}:ticket:${ticketId}`);
  }
  ticketCache.deletePattern(`tenant:${tenantId}:tickets:search%`);
  // Only invalidate stats for this tenant
  caches.stats.deletePattern(`tenant:${tenantId}:stats%`);
}

export function invalidateUserCache(tenantId: number, userId: number): void {
  caches.users.delete(`tenant:${tenantId}:user:${userId}`);
  caches.users.deletePattern(`tenant:${tenantId}:users%`);
}

export function invalidateLookupCache(tenantId: number, lookupType?: string): void {
  if (lookupType) {
    caches.lookups.delete(`tenant:${tenantId}:lookup:${lookupType}`);
  } else {
    caches.lookups.deletePattern(`tenant:${tenantId}:lookup%`);
  }
}

// Cache wrapper for async functions
export async function withCache<T>(
  key: string,
  fn: () => T | Promise<T>,
  options: { ttl?: number; namespace?: CacheNamespace } = {}
): Promise<T> {
  const { ttl = 300, namespace = 'default' } = options;

  // Try cache first
  const cached = getFromCache<T>(key, namespace);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  setCache(key, result, ttl, namespace);

  return result;
}

export default {
  get: getFromCache,
  set: setCache,
  delete: removeFromCache,
  deletePattern: removeCachePattern,
  clear: clearCache,
  stats: getCacheStats,
  withCache,
  invalidateTicket: invalidateTicketCache,
  invalidateUser: invalidateUserCache,
  invalidateLookup: invalidateLookupCache,
};
