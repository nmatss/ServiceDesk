/**
 * Cache Initialization - Activates Redis caching layer
 * Integrates Redis with the existing cache system
 */

import { createRedisManager, defaultCacheConfig } from '@/lib/performance/redis-manager';
import { configureCacheStore } from '@/lib/api/cache';
import { dbOptimizer } from '@/lib/db/optimizer';
import { logger } from '../monitoring/logger';

let redisManager: ReturnType<typeof createRedisManager> | null = null;
let isInitialized = false;

/**
 * Initialize Redis caching layer and database optimizer
 * Call this at application startup
 */
export async function initializeCache(): Promise<void> {
  if (isInitialized) {
    logger.info('✅ Cache already initialized');
    return;
  }

  try {
    // Initialize database optimizer first
    logger.info('🔍 Initializing database optimizer...');
    await dbOptimizer.optimizeTables();
    logger.info('✅ Database optimizer initialized (ANALYZE completed)');
    logger.info(`   - Database size: ${dbOptimizer.getDatabaseSize().sizeMB} MB`);
    const dbStats = dbOptimizer.getPerformanceStats();
    logger.info(`   - Slow queries tracked: ${dbStats.slowQueries.length}`);
    logger.info(`   - Average query time: ${dbStats.averageQueryTime}ms`);
    // Check if Redis is configured
    const redisHost = process.env.REDIS_HOST || process.env.REDIS_URL;

    if (!redisHost && process.env.NODE_ENV === 'production') {
      logger.warn('⚠️  WARNING: Redis not configured in production. Using in-memory cache.');
      isInitialized = true;
      return;
    }

    if (!redisHost) {
      logger.info('ℹ️  Redis not configured. Using in-memory cache for development.');
      isInitialized = true;
      return;
    }

    logger.info('🚀 Initializing Redis caching layer...');

    // Create Redis manager
    redisManager = createRedisManager(defaultCacheConfig);

    // Wait for Redis connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 5000);

      // Test connection
      redisManager!.healthCheck()
        .then(health => {
          clearTimeout(timeout);
          if (health.status === 'healthy' || health.status === 'degraded') {
            resolve(health);
          } else {
            reject(new Error(`Redis unhealthy: ${health.errors.join(', ')}`));
          }
        })
        .catch(reject);
    });

    // Get Redis client for the API cache
    const redisClient = (redisManager as any).redis;

    // Configure the API cache store to use Redis
    configureCacheStore(redisClient);

    const stats = redisManager.getStats();
    logger.info('✅ Redis caching initialized successfully');
    logger.info(`   - Hit rate: ${stats.hitRate.toFixed(2)}%`);
    logger.info(`   - Total keys: ${stats.totalKeys}`);
    logger.info(`   - Layers configured: ${stats.layerStats.size}`);

    isInitialized = true;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis', error);
    logger.warn('⚠️  Falling back to in-memory cache');
    isInitialized = true;
  }
}

/**
 * Get Redis manager instance
 */
export function getRedisManager() {
  return redisManager;
}

/**
 * Check if Redis is active
 */
export function isRedisActive(): boolean {
  return redisManager !== null;
}

/**
 * Shutdown cache gracefully
 */
export async function shutdownCache(): Promise<void> {
  if (redisManager) {
    logger.info('🛑 Shutting down Redis cache...');
    await redisManager.shutdown();
    redisManager = null;
    isInitialized = false;
    logger.info('✅ Redis cache shut down successfully');
  }
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeCache().catch(err => logger.error('Failed to initialize cache', err));
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await shutdownCache();
});

process.on('SIGINT', async () => {
  await shutdownCache();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownCache();
  process.exit(0);
});
