/**
 * Cache System Initialization
 *
 * Initializes all cache components in the correct order.
 *
 * Steps:
 * 1. Initialize Redis client
 * 2. Initialize Cache Manager
 * 3. Initialize Session Manager
 * 4. Initialize Cache Invalidator
 * 5. Initialize Rate Limiter
 * 6. Initialize Cache Warmer
 * 7. Initialize Metrics Collector
 * 8. Warm cache (if enabled)
 */

import { createRedisClient } from './redis-client';
import { getCacheManager } from './cache-manager';
import { getSessionManager } from './sessions';
import { getCacheInvalidator } from './invalidation';
import { getRedisRateLimiter } from './rate-limit-redis';
import { getCacheWarmer, warmCacheOnStartup } from './warming';
import { getCacheMetrics } from './metrics';
import { getCacheConfig } from './config';
import logger from '../monitoring/structured-logger';

export interface CacheInitOptions {
  skipWarming?: boolean;
  skipMetrics?: boolean;
  skipInvalidation?: boolean;
}

export class CacheInitializer {
  private static instance: CacheInitializer;
  private initialized = false;
  private config = getCacheConfig();

  private components = {
    redis: false,
    cacheManager: false,
    sessionManager: false,
    invalidator: false,
    rateLimiter: false,
    warmer: false,
    metrics: false,
  };

  private constructor() {}

  public static getInstance(): CacheInitializer {
    if (!CacheInitializer.instance) {
      CacheInitializer.instance = new CacheInitializer();
    }
    return CacheInitializer.instance;
  }

  /**
   * Initialize entire cache system
   */
  async initialize(options: CacheInitOptions = {}): Promise<void> {
    if (this.initialized) {
      logger.warn('Cache system already initialized');
      return;
    }

    logger.info('Initializing cache system', {
      config: this.config,
      options,
    });

    const startTime = Date.now();

    try {
      // Step 1: Initialize Redis client
      await this.initializeRedis();

      // Step 2: Initialize Cache Manager
      this.initializeCacheManager();

      // Step 3: Initialize Session Manager
      this.initializeSessionManager();

      // Step 4: Initialize Cache Invalidator
      if (!options.skipInvalidation && this.config.invalidation.enablePubSub) {
        await this.initializeInvalidator();
      }

      // Step 5: Initialize Rate Limiter
      this.initializeRateLimiter();

      // Step 6: Initialize Cache Warmer
      this.initializeCacheWarmer();

      // Step 7: Initialize Metrics Collector
      if (!options.skipMetrics && this.config.metrics.enabled) {
        this.initializeMetrics();
      }

      // Step 8: Warm cache
      if (!options.skipWarming && this.config.warming.enableOnStartup) {
        await this.warmCache();
      }

      this.initialized = true;

      const duration = Date.now() - startTime;

      logger.info('Cache system initialized successfully', {
        duration: `${duration}ms`,
        components: this.components,
      });
    } catch (error) {
      logger.error('Failed to initialize cache system', error);
      throw error;
    }
  }

  /**
   * Initialize Redis client
   */
  private async initializeRedis(): Promise<void> {
    try {
      logger.info('Initializing Redis client');

      const redisClient = createRedisClient(this.config.redis);

      // Connect if not using lazy connect
      if (!this.config.redis.lazyConnect) {
        await redisClient.connect();
      }

      // Health check
      const health = await redisClient.healthCheck();

      if (health.status === 'unhealthy') {
        throw new Error('Redis health check failed');
      }

      this.components.redis = true;
      logger.info('Redis client initialized', { status: health.status });
    } catch (error) {
      logger.error('Failed to initialize Redis client', error);
      throw error;
    }
  }

  /**
   * Initialize Cache Manager
   */
  private initializeCacheManager(): void {
    try {
      logger.info('Initializing Cache Manager');

      getCacheManager({
        l1MaxSize: this.config.cache.l1MaxSize,
        l1MaxAge: this.config.cache.l1MaxAge,
        defaultTTL: this.config.cache.defaultTTL,
        keyPrefix: this.config.cache.keyPrefix,
        compressionThreshold: this.config.cache.compressionThreshold,
        enableL1: this.config.cache.enableL1,
        enableL2: this.config.cache.enableL2,
      });

      this.components.cacheManager = true;
      logger.info('Cache Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize Cache Manager', error);
      throw error;
    }
  }

  /**
   * Initialize Session Manager
   */
  private initializeSessionManager(): void {
    try {
      logger.info('Initializing Session Manager');

      getSessionManager();

      this.components.sessionManager = true;
      logger.info('Session Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize Session Manager', error);
      throw error;
    }
  }

  /**
   * Initialize Cache Invalidator
   */
  private async initializeInvalidator(): Promise<void> {
    try {
      logger.info('Initializing Cache Invalidator');

      const invalidator = getCacheInvalidator();
      await invalidator.initialize();

      this.components.invalidator = true;
      logger.info('Cache Invalidator initialized');
    } catch (error) {
      logger.error('Failed to initialize Cache Invalidator', error);
      throw error;
    }
  }

  /**
   * Initialize Rate Limiter
   */
  private initializeRateLimiter(): void {
    try {
      logger.info('Initializing Rate Limiter');

      getRedisRateLimiter();

      this.components.rateLimiter = true;
      logger.info('Rate Limiter initialized');
    } catch (error) {
      logger.error('Failed to initialize Rate Limiter', error);
      throw error;
    }
  }

  /**
   * Initialize Cache Warmer
   */
  private initializeCacheWarmer(): void {
    try {
      logger.info('Initializing Cache Warmer');

      const warmer = getCacheWarmer();

      this.components.warmer = true;
      logger.info('Cache Warmer initialized', {
        strategies: warmer.listStrategies(),
      });
    } catch (error) {
      logger.error('Failed to initialize Cache Warmer', error);
      throw error;
    }
  }

  /**
   * Initialize Metrics Collector
   */
  private initializeMetrics(): void {
    try {
      logger.info('Initializing Metrics Collector');

      const metrics = getCacheMetrics();

      // Start periodic collection if enabled
      if (this.config.metrics.collectInterval > 0) {
        metrics.startPeriodicCollection(this.config.metrics.collectInterval);
      }

      this.components.metrics = true;
      logger.info('Metrics Collector initialized', {
        interval: this.config.metrics.collectInterval,
        prometheus: this.config.metrics.exportPrometheus,
      });
    } catch (error) {
      logger.error('Failed to initialize Metrics Collector', error);
      throw error;
    }
  }

  /**
   * Warm cache
   */
  private async warmCache(): Promise<void> {
    try {
      logger.info('Starting cache warming');

      await warmCacheOnStartup();

      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Failed to warm cache', error);
      // Don't throw - warming failure shouldn't prevent app startup
    }
  }

  /**
   * Shutdown cache system gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('Shutting down cache system');

    try {
      // Stop metrics collection
      if (this.components.metrics) {
        const metrics = getCacheMetrics();
        metrics.stopPeriodicCollection();
      }

      // Stop cache warmer schedules
      if (this.components.warmer) {
        const warmer = getCacheWarmer();
        warmer.stopAllSchedules();
      }

      // Shutdown invalidator
      if (this.components.invalidator) {
        const invalidator = getCacheInvalidator();
        await invalidator.shutdown();
      }

      // Disconnect Redis
      if (this.components.redis) {
        const { getRedisClient } = await import('./redis-client');
        const redisClient = getRedisClient();
        await redisClient.disconnect();
      }

      this.initialized = false;
      this.components = {
        redis: false,
        cacheManager: false,
        sessionManager: false,
        invalidator: false,
        rateLimiter: false,
        warmer: false,
        metrics: false,
      };

      logger.info('Cache system shutdown complete');
    } catch (error) {
      logger.error('Error during cache system shutdown', error);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      components: this.components,
      config: this.config,
    };
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, boolean>;
    details: any;
  }> {
    const health: any = {
      healthy: this.initialized,
      components: { ...this.components },
      details: {},
    };

    try {
      // Redis health
      if (this.components.redis) {
        const { getRedisClient } = await import('./redis-client');
        const redisClient = getRedisClient();
        const redisHealth = await redisClient.healthCheck();
        health.details.redis = redisHealth;
        health.components.redis = redisHealth.status !== 'unhealthy';
      }

      // Cache health
      if (this.components.cacheManager) {
        const cacheManager = getCacheManager();
        const cacheStats = cacheManager.getStats();
        health.details.cache = cacheStats;
        health.components.cacheManager = true;
      }

      // Metrics health
      if (this.components.metrics) {
        const metrics = getCacheMetrics();
        const metricsHealth = await metrics.healthCheck();
        health.details.metrics = metricsHealth;
        health.components.metrics = metricsHealth.status !== 'unhealthy';
      }

      // Overall health
      health.healthy = Object.values(health.components).every(v => v === true);

      return health;
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        healthy: false,
        components: this.components,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

/**
 * Get CacheInitializer instance
 */
export function getCacheInitializer(): CacheInitializer {
  return CacheInitializer.getInstance();
}

/**
 * Initialize cache system (convenience function)
 */
export async function initializeCacheSystem(options?: CacheInitOptions): Promise<void> {
  const initializer = getCacheInitializer();
  await initializer.initialize(options);
}

/**
 * Shutdown cache system (convenience function)
 */
export async function shutdownCacheSystem(): Promise<void> {
  const initializer = getCacheInitializer();
  await initializer.shutdown();
}

/**
 * Export singleton
 */
export const cacheInitializer = CacheInitializer.getInstance();
