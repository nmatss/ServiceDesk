/**
 * Cache Patterns Implementation
 *
 * Implements common caching patterns:
 * - Cache-Aside (Lazy Loading)
 * - Write-Through
 * - Write-Behind (Write-Back)
 * - Read-Through
 * - Refresh-Ahead
 */

import { CacheManager, getCacheManager, CacheOptions } from './cache-manager';
import logger from '../monitoring/structured-logger';

/**
 * Cache-Aside Pattern (Lazy Loading)
 *
 * - Application code is responsible for loading data into cache
 * - On cache miss, data is loaded from source and cached
 * - Most common pattern, gives application full control
 */
export class CacheAsidePattern {
  private cacheManager: CacheManager;

  constructor(cacheManager?: CacheManager) {
    this.cacheManager = cacheManager || getCacheManager();
  }

  /**
   * Get data with cache-aside pattern
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.cacheManager.get<T>(key, options);

    if (cached !== null) {
      logger.debug('CacheAside: Cache hit', { key });
      return cached;
    }

    // Cache miss - fetch from source
    logger.debug('CacheAside: Cache miss, fetching from source', { key });
    const data = await fetchFn();

    // Store in cache
    await this.cacheManager.set(key, data, options);

    return data;
  }

  /**
   * Get with automatic refresh before expiration
   */
  async getWithRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions & { refreshThreshold?: number } = {}
  ): Promise<T> {
    const { refreshThreshold = 0.2, ...cacheOptions } = options;

    // Try to get from cache
    const cached = await this.cacheManager.get<T>(key, cacheOptions);

    if (cached !== null) {
      // Check if we should refresh proactively
      const ttl = await this.cacheManager.ttl(key, cacheOptions);
      const maxTtl = cacheOptions.ttl || 300;

      if (ttl > 0 && ttl / maxTtl <= refreshThreshold) {
        // Refresh in background
        logger.debug('CacheAside: Proactive refresh triggered', {
          key,
          ttl,
          threshold: refreshThreshold,
        });

        // Don't await - refresh in background
        this.refreshInBackground(key, fetchFn, cacheOptions);
      }

      return cached;
    }

    // Cache miss - fetch and cache
    const data = await fetchFn();
    await this.cacheManager.set(key, data, cacheOptions);

    return data;
  }

  /**
   * Refresh cache in background
   */
  private async refreshInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const data = await fetchFn();
      await this.cacheManager.set(key, data, options);
      logger.debug('CacheAside: Background refresh completed', { key });
    } catch (error) {
      logger.error('CacheAside: Background refresh failed', { key, error });
    }
  }

  /**
   * Delete from cache
   */
  async invalidate(key: string, options: CacheOptions = {}): Promise<void> {
    await this.cacheManager.del(key, options);
  }
}

/**
 * Write-Through Pattern
 *
 * - Data is written to cache and source simultaneously
 * - Ensures cache and source are always in sync
 * - Slower writes but guaranteed consistency
 */
export class WriteThroughPattern {
  private cacheManager: CacheManager;

  constructor(cacheManager?: CacheManager) {
    this.cacheManager = cacheManager || getCacheManager();
  }

  /**
   * Write data with write-through pattern
   */
  async write<T>(
    key: string,
    data: T,
    writeFn: (data: T) => Promise<void>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      // Write to source first
      logger.debug('WriteThrough: Writing to source', { key });
      await writeFn(data);

      // Then update cache
      logger.debug('WriteThrough: Updating cache', { key });
      await this.cacheManager.set(key, data, options);

      logger.debug('WriteThrough: Write completed', { key });
    } catch (error) {
      logger.error('WriteThrough: Write failed', { key, error });
      // Invalidate cache on write failure
      await this.cacheManager.del(key, options);
      throw error;
    }
  }

  /**
   * Read data (cache-first)
   */
  async read<T>(
    key: string,
    readFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try cache first
    const cached = await this.cacheManager.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    // Read from source and cache
    const data = await readFn();
    await this.cacheManager.set(key, data, options);

    return data;
  }

  /**
   * Update data (write-through)
   */
  async update<T>(
    key: string,
    updateFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Update in source
    const data = await updateFn();

    // Update cache
    await this.cacheManager.set(key, data, options);

    return data;
  }

  /**
   * Delete data (write-through)
   */
  async delete(
    key: string,
    deleteFn: () => Promise<void>,
    options: CacheOptions = {}
  ): Promise<void> {
    // Delete from source
    await deleteFn();

    // Delete from cache
    await this.cacheManager.del(key, options);
  }
}

/**
 * Write-Behind Pattern (Write-Back)
 *
 * - Data is written to cache immediately
 * - Write to source happens asynchronously
 * - Faster writes but potential data loss on cache failure
 * - Requires write queue for reliability
 */
export class WriteBehindPattern {
  private cacheManager: CacheManager;
  private writeQueue: Map<string, { data: any; timestamp: number; retries: number }> = new Map();
  private processing: boolean = false;
  private flushInterval?: NodeJS.Timeout;

  constructor(
    cacheManager?: CacheManager,
    private options: {
      flushIntervalMs?: number;
      maxRetries?: number;
      batchSize?: number;
    } = {}
  ) {
    this.cacheManager = cacheManager || getCacheManager();
    this.options = {
      flushIntervalMs: 5000, // Flush every 5 seconds
      maxRetries: 3,
      batchSize: 10,
      ...options,
    };

    // Start background flush
    this.startBackgroundFlush();
  }

  /**
   * Write data with write-behind pattern
   */
  async write<T>(
    key: string,
    data: T,
    writeFn: (data: T) => Promise<void>,
    options: CacheOptions = {}
  ): Promise<void> {
    // Write to cache immediately
    logger.debug('WriteBehind: Writing to cache', { key });
    await this.cacheManager.set(key, data, options);

    // Queue write to source
    this.writeQueue.set(key, {
      data: { value: data, writeFn },
      timestamp: Date.now(),
      retries: 0,
    });

    logger.debug('WriteBehind: Queued for async write', {
      key,
      queueSize: this.writeQueue.size,
    });
  }

  /**
   * Read data (cache-only for write-behind)
   */
  async read<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    return this.cacheManager.get<T>(key, options);
  }

  /**
   * Flush write queue to source
   */
  async flush(): Promise<{ success: number; failed: number }> {
    if (this.processing || this.writeQueue.size === 0) {
      return { success: 0, failed: 0 };
    }

    this.processing = true;
    let success = 0;
    let failed = 0;

    const batch = Array.from(this.writeQueue.entries()).slice(
      0,
      this.options.batchSize
    );

    logger.debug('WriteBehind: Flushing queue', { batchSize: batch.length });

    for (const [key, queueItem] of batch) {
      try {
        // Execute write function
        await queueItem.data.writeFn(queueItem.data.value);

        // Remove from queue
        this.writeQueue.delete(key);
        success++;

        logger.debug('WriteBehind: Flushed to source', { key });
      } catch (error) {
        logger.error('WriteBehind: Flush failed', { key, error });

        // Retry logic
        if (queueItem.retries < (this.options.maxRetries || 3)) {
          queueItem.retries++;
          this.writeQueue.set(key, queueItem);
        } else {
          // Max retries exceeded - remove from queue
          this.writeQueue.delete(key);
          logger.error('WriteBehind: Max retries exceeded, dropping', { key });
        }

        failed++;
      }
    }

    this.processing = false;

    logger.info('WriteBehind: Flush completed', {
      success,
      failed,
      remaining: this.writeQueue.size,
    });

    return { success, failed };
  }

  /**
   * Start background flush process
   */
  private startBackgroundFlush(): void {
    this.flushInterval = setInterval(
      () => this.flush(),
      this.options.flushIntervalMs || 5000
    );

    logger.info('WriteBehind: Background flush started', {
      intervalMs: this.options.flushIntervalMs,
    });
  }

  /**
   * Stop background flush process
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    // Flush remaining items
    await this.flush();

    logger.info('WriteBehind: Stopped');
  }

  /**
   * Get queue stats
   */
  getQueueStats(): {
    size: number;
    oldestItem: number | null;
    processing: boolean;
  } {
    let oldestTimestamp: number | null = null;

    const queueItems = Array.from(this.writeQueue.values());
    for (const item of queueItems) {
      if (!oldestTimestamp || item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
      }
    }

    return {
      size: this.writeQueue.size,
      oldestItem: oldestTimestamp,
      processing: this.processing,
    };
  }
}

/**
 * Read-Through Pattern
 *
 * - Cache is responsible for loading data
 * - Application only interacts with cache
 * - Cache handles source interactions transparently
 */
export class ReadThroughPattern {
  private cacheManager: CacheManager;
  private loaders: Map<string, (key: string) => Promise<any>> = new Map();

  constructor(cacheManager?: CacheManager) {
    this.cacheManager = cacheManager || getCacheManager();
  }

  /**
   * Register a data loader for a key pattern
   */
  registerLoader<T>(
    pattern: string,
    loader: (key: string) => Promise<T>
  ): void {
    this.loaders.set(pattern, loader);
    logger.debug('ReadThrough: Loader registered', { pattern });
  }

  /**
   * Read data with read-through pattern
   */
  async read<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    // Try cache first
    const cached = await this.cacheManager.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    // Find matching loader
    const loader = this.findLoader(key);

    if (!loader) {
      logger.warn('ReadThrough: No loader found for key', { key });
      return null;
    }

    // Load from source
    logger.debug('ReadThrough: Loading from source', { key });
    const data = await loader(key);

    if (data !== null) {
      // Cache the loaded data
      await this.cacheManager.set(key, data, options);
    }

    return data;
  }

  /**
   * Find loader for key
   */
  private findLoader(key: string): ((key: string) => Promise<any>) | undefined {
    const loadersArray = Array.from(this.loaders.entries());
    for (const [pattern, loader] of loadersArray) {
      const regex = new RegExp(pattern);
      if (regex.test(key)) {
        return loader;
      }
    }
    return undefined;
  }
}

/**
 * Refresh-Ahead Pattern
 *
 * - Proactively refreshes cache before expiration
 * - Reduces cache misses for hot data
 * - Requires TTL awareness and background refresh
 */
export class RefreshAheadPattern {
  private cacheManager: CacheManager;
  private refreshers: Map<string, NodeJS.Timeout> = new Map();

  constructor(cacheManager?: CacheManager) {
    this.cacheManager = cacheManager || getCacheManager();
  }

  /**
   * Get with refresh-ahead
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions & { refreshThreshold?: number } = {}
  ): Promise<T> {
    const { refreshThreshold = 0.8, ...cacheOptions } = options;

    // Try cache
    const cached = await this.cacheManager.get<T>(key, cacheOptions);

    if (cached !== null) {
      // Schedule refresh if approaching expiration
      this.scheduleRefresh(key, fetchFn, cacheOptions, refreshThreshold);
      return cached;
    }

    // Cache miss - fetch and cache
    const data = await fetchFn();
    await this.cacheManager.set(key, data, cacheOptions);

    // Schedule future refresh
    this.scheduleRefresh(key, fetchFn, cacheOptions, refreshThreshold);

    return data;
  }

  /**
   * Schedule refresh before expiration
   */
  private async scheduleRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions,
    threshold: number
  ): Promise<void> {
    // Clear existing refresher
    const existing = this.refreshers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Get TTL
    const ttl = await this.cacheManager.ttl(key, options);

    if (ttl > 0) {
      // Calculate refresh time
      const refreshIn = Math.max(0, ttl * threshold * 1000);

      // Schedule refresh
      const timeout = setTimeout(async () => {
        try {
          logger.debug('RefreshAhead: Refreshing cache', { key });
          const data = await fetchFn();
          await this.cacheManager.set(key, data, options);
          this.refreshers.delete(key);
        } catch (error) {
          logger.error('RefreshAhead: Refresh failed', { key, error });
        }
      }, refreshIn);

      this.refreshers.set(key, timeout);

      logger.debug('RefreshAhead: Refresh scheduled', {
        key,
        refreshInMs: refreshIn,
      });
    }
  }

  /**
   * Stop all scheduled refreshes
   */
  stop(): void {
    const timeouts = Array.from(this.refreshers.values());
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    this.refreshers.clear();
    logger.info('RefreshAhead: All refreshes stopped');
  }
}

/**
 * Export pattern instances (singleton)
 */
export const cacheAside = new CacheAsidePattern();
export const writeThrough = new WriteThroughPattern();
export const writeBehind = new WriteBehindPattern();
export const readThrough = new ReadThroughPattern();
export const refreshAhead = new RefreshAheadPattern();
