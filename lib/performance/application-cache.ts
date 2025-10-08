import { logger } from '../monitoring/logger';

/**
 * Application-Level Cache Management
 * In-memory caching with LRU eviction, cache warming, and intelligent invalidation
 */

export interface ApplicationCacheConfig {
  maxSize: number;
  maxMemoryUsage: number; // bytes
  defaultTTL: number;
  checkInterval: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  compression: {
    enabled: boolean;
    threshold: number;
    algorithm: 'gzip' | 'lz4';
  };
  clustering: {
    enabled: boolean;
    syncInterval: number;
    conflictResolution: 'last-write-wins' | 'version-vector';
  };
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  compressed: boolean;
  tags: Set<string>;
  dependencies: Set<string>;
}

export interface CacheStats {
  size: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressionRatio: number;
  averageAccessTime: number;
}

export interface CacheCluster {
  nodeId: string;
  lastSync: number;
  version: number;
  entries: Map<string, CacheEntry>;
}

export class ApplicationCache<T = any> {
  private entries = new Map<string, CacheEntry<T>>();
  private accessOrder = new Set<string>();
  private sizeTracker = { count: 0, memory: 0 };
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressionCount: 0,
    totalCompressionRatio: 0
  };

  private cleanupInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  private clusters = new Map<string, CacheCluster>();

  constructor(private config: ApplicationCacheConfig) {
    this.startCleanupScheduler();

    if (config.clustering.enabled) {
      this.startClusterSync();
    }
  }

  /**
   * Set a value in the cache
   */
  async set(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
      compress?: boolean;
    } = {}
  ): Promise<void> {
    const {
      ttl = this.config.defaultTTL,
      tags = [],
      dependencies = [],
      compress = this.shouldCompress(value)
    } = options;

    // Remove existing entry if present
    this.delete(key);

    let finalValue = value;
    let compressed = false;
    let size = this.calculateSize(value);

    // Compress if needed
    if (compress && this.config.compression.enabled) {
      try {
        finalValue = await this.compress(value);
        compressed = true;
        const compressedSize = this.calculateSize(finalValue);

        this.stats.compressionCount++;
        this.stats.totalCompressionRatio += size / compressedSize;

        size = compressedSize;
      } catch (error) {
        logger.warn('Compression failed, storing uncompressed', error);
      }
    }

    const entry: CacheEntry<T> = {
      key,
      value: finalValue,
      ttl,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      size,
      compressed,
      tags: new Set(tags),
      dependencies: new Set(dependencies)
    };

    // Ensure we don't exceed memory limits
    await this.ensureSpace(size);

    // Store the entry
    this.entries.set(key, entry);
    this.trackAccess(key);
    this.updateSizeTracker(size, 1);

    // Sync with cluster if enabled
    if (this.config.clustering.enabled) {
      this.scheduleClusterSync(key);
    }
  }

  /**
   * Get a value from the cache
   */
  async get(key: string): Promise<T | null> {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.trackAccess(key);
    this.stats.hits++;

    // Decompress if necessary
    let value = entry.value;
    if (entry.compressed) {
      try {
        value = await this.decompress(entry.value);
      } catch (error) {
        logger.warn('Decompression failed', error);
        this.delete(key);
        return null;
      }
    }

    return value;
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    this.entries.delete(key);
    this.accessOrder.delete(key);
    this.updateSizeTracker(-entry.size, -1);

    // Delete dependent entries
    this.deleteDependents(key);

    return true;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.entries.clear();
    this.accessOrder.clear();
    this.sizeTracker = { count: 0, memory: 0 };
  }

  /**
   * Get multiple values at once
   */
  async mget(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    for (const key of keys) {
      const value = await this.get(key);
      results.set(key, value);
    }

    return results;
  }

  /**
   * Set multiple values at once
   */
  async mset(entries: Array<{
    key: string;
    value: T;
    options?: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    };
  }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.options);
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    const tagSet = new Set(tags);

    for (const [key, entry] of this.entries.entries()) {
      const hasMatchingTag = Array.from(entry.tags).some(tag => tagSet.has(tag));

      if (hasMatchingTag) {
        this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Warm cache with predefined data
   */
  async warmCache(warmingData: Array<{
    key: string;
    fetcher: () => Promise<T>;
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: 'high' | 'medium' | 'low';
    };
  }>): Promise<{ warmed: string[]; failed: string[] }> {
    const warmed: string[] = [];
    const failed: string[] = [];

    // Sort by priority
    const sortedData = warmingData.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = a.options?.priority || 'medium';
      const bPriority = b.options?.priority || 'medium';
      return priorityOrder[bPriority] - priorityOrder[aPriority];
    });

    for (const item of sortedData) {
      try {
        const value = await item.fetcher();
        await this.set(item.key, value, item.options);
        warmed.push(item.key);
      } catch (error) {
        logger.warn(`Failed to warm cache for key ${item.key}:`, error);
        failed.push(item.key);
      }
    }

    return { warmed, failed };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate = 100 - hitRate;

    const compressionRatio = this.stats.compressionCount > 0
      ? this.stats.totalCompressionRatio / this.stats.compressionCount
      : 1;

    return {
      size: this.sizeTracker.count,
      memoryUsage: this.sizeTracker.memory,
      hitRate,
      missRate,
      evictions: this.stats.evictions,
      compressionRatio,
      averageAccessTime: this.calculateAverageAccessTime()
    };
  }

  /**
   * Get detailed cache entries information
   */
  getEntries(filter?: {
    tags?: string[];
    minAccessCount?: number;
    maxAge?: number;
  }): Array<{
    key: string;
    size: number;
    accessCount: number;
    age: number;
    tags: string[];
    dependencies: string[];
  }> {
    const now = Date.now();
    const entries: Array<{
      key: string;
      size: number;
      accessCount: number;
      age: number;
      tags: string[];
      dependencies: string[];
    }> = [];

    for (const [key, entry] of this.entries.entries()) {
      const age = now - entry.createdAt;

      // Apply filters
      if (filter) {
        if (filter.tags && !filter.tags.some(tag => entry.tags.has(tag))) {
          continue;
        }

        if (filter.minAccessCount && entry.accessCount < filter.minAccessCount) {
          continue;
        }

        if (filter.maxAge && age > filter.maxAge) {
          continue;
        }
      }

      entries.push({
        key,
        size: entry.size,
        accessCount: entry.accessCount,
        age,
        tags: Array.from(entry.tags),
        dependencies: Array.from(entry.dependencies)
      });
    }

    return entries;
  }

  /**
   * Export cache for backup/analysis
   */
  export(): {
    entries: Array<{
      key: string;
      value: any;
      metadata: {
        ttl: number;
        createdAt: number;
        accessCount: number;
        tags: string[];
        dependencies: string[];
      };
    }>;
    stats: CacheStats;
    config: ApplicationCacheConfig;
  } {
    const entries = [];

    for (const [key, entry] of this.entries.entries()) {
      entries.push({
        key,
        value: entry.compressed ? '[COMPRESSED_DATA]' : entry.value,
        metadata: {
          ttl: entry.ttl,
          createdAt: entry.createdAt,
          accessCount: entry.accessCount,
          tags: Array.from(entry.tags),
          dependencies: Array.from(entry.dependencies)
        }
      });
    }

    return {
      entries,
      stats: this.getStats(),
      config: this.config
    };
  }

  private shouldCompress(value: T): boolean {
    if (!this.config.compression.enabled) {
      return false;
    }

    const size = this.calculateSize(value);
    return size > this.config.compression.threshold;
  }

  private async compress(value: T): Promise<T> {
    // Implementation would use compression library
    // For now, return value as-is
    return value;
  }

  private async decompress(value: T): Promise<T> {
    // Implementation would use decompression library
    // For now, return value as-is
    return value;
  }

  private calculateSize(value: T): number {
    // Rough estimation of object size in memory
    return JSON.stringify(value).length * 2; // Assuming UTF-16
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > entry.ttl * 1000;
  }

  private trackAccess(key: string): void {
    // Update access order for LRU
    this.accessOrder.delete(key);
    this.accessOrder.add(key);
  }

  private updateSizeTracker(memoryDelta: number, countDelta: number): void {
    this.sizeTracker.memory += memoryDelta;
    this.sizeTracker.count += countDelta;
  }

  private deleteDependents(key: string): void {
    for (const [entryKey, entry] of this.entries.entries()) {
      if (entry.dependencies.has(key)) {
        this.delete(entryKey);
      }
    }
  }

  private async ensureSpace(requiredSize: number): Promise<void> {
    while (
      this.sizeTracker.count >= this.config.maxSize ||
      this.sizeTracker.memory + requiredSize > this.config.maxMemoryUsage
    ) {
      const evicted = this.evictEntry();
      if (!evicted) {
        break; // No more entries to evict
      }
    }
  }

  private evictEntry(): boolean {
    if (this.entries.size === 0) {
      return false;
    }

    let keyToEvict: string;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.accessOrder.values().next().value;
        break;
      case 'lfu':
        keyToEvict = this.findLFUKey();
        break;
      case 'fifo':
        keyToEvict = this.entries.keys().next().value;
        break;
      case 'ttl':
        keyToEvict = this.findShortestTTLKey();
        break;
      default:
        keyToEvict = this.entries.keys().next().value;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
      return true;
    }

    return false;
  }

  private findLFUKey(): string {
    let minAccessCount = Infinity;
    let keyToEvict = '';

    for (const [key, entry] of this.entries.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private findShortestTTLKey(): string {
    let shortestTTL = Infinity;
    let keyToEvict = '';
    const now = Date.now();

    for (const [key, entry] of this.entries.entries()) {
      const remainingTTL = entry.ttl - (now - entry.createdAt) / 1000;
      if (remainingTTL < shortestTTL) {
        shortestTTL = remainingTTL;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private calculateAverageAccessTime(): number {
    // This would track actual access times in a real implementation
    return 1.5; // ms
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.entries.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  private startClusterSync(): void {
    if (!this.config.clustering.enabled) return;

    this.syncInterval = setInterval(() => {
      this.syncWithCluster();
    }, this.config.clustering.syncInterval);
  }

  private scheduleClusterSync(key: string): void {
    // Implementation would schedule sync for specific key
  }

  private syncWithCluster(): void {
    // Implementation would sync cache state across cluster nodes
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.clear();
  }
}

// Default configuration
export const defaultApplicationCacheConfig: ApplicationCacheConfig = {
  maxSize: 10000,
  maxMemoryUsage: 128 * 1024 * 1024, // 128MB
  defaultTTL: 3600, // 1 hour
  checkInterval: 60000, // 1 minute
  evictionPolicy: 'lru',
  compression: {
    enabled: true,
    threshold: 1024, // 1KB
    algorithm: 'gzip'
  },
  clustering: {
    enabled: false,
    syncInterval: 30000, // 30 seconds
    conflictResolution: 'last-write-wins'
  }
};

// Cache instance factory
export function createApplicationCache<T = any>(
  config: Partial<ApplicationCacheConfig> = {}
): ApplicationCache<T> {
  const finalConfig = { ...defaultApplicationCacheConfig, ...config };
  return new ApplicationCache<T>(finalConfig);
}

// Global cache instances for common use cases
export const sessionCache = createApplicationCache<any>({
  maxSize: 5000,
  defaultTTL: 1800, // 30 minutes
  evictionPolicy: 'ttl'
});

export const queryCache = createApplicationCache<any>({
  maxSize: 2000,
  defaultTTL: 300, // 5 minutes
  evictionPolicy: 'lru',
  compression: { enabled: true, threshold: 512, algorithm: 'gzip' }
});

export const templateCache = createApplicationCache<string>({
  maxSize: 1000,
  defaultTTL: 86400, // 24 hours
  evictionPolicy: 'lfu',
  compression: { enabled: true, threshold: 256, algorithm: 'gzip' }
});

export const configCache = createApplicationCache<any>({
  maxSize: 500,
  defaultTTL: 3600, // 1 hour
  evictionPolicy: 'ttl'
});