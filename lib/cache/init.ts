/**
 * Cache Initialization - Activates Redis caching layer
 * Integrates Redis with the existing cache system
 */

import { getRedisClient } from './redis-client';
import { getCacheManager } from './cache-manager';
import logger from '../monitoring/structured-logger';

let redisClient: ReturnType<typeof getRedisClient> | null = null;
let cacheManager: ReturnType<typeof getCacheManager> | null = null;
let isInitialized = false;

/**
 * Initialize Redis caching layer
 * Call this at application startup
 */
export async function initializeCache(): Promise<void> {
  if (isInitialized) {
    logger.info('✅ Cache already initialized');
    return;
  }

  try {
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

    // Initialize Redis client
    redisClient = getRedisClient();

    // Connect to Redis
    await redisClient.connect();

    // Test connection
    const health = await redisClient.healthCheck();

    if (health.status === 'unhealthy') {
      throw new Error('Redis health check failed');
    }

    // Initialize cache manager
    cacheManager = getCacheManager();

    logger.info('✅ Redis caching initialized successfully');
    logger.info(`   - Status: ${health.status}`);
    logger.info(`   - Latency: ${health.latency}ms`);
    logger.info(`   - Connected: ${health.connected}`);

    isInitialized = true;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis', error);
    logger.warn('⚠️  Falling back to in-memory cache');
    isInitialized = true;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisManager() {
  return redisClient;
}

/**
 * Check if Redis is active
 */
export function isRedisActive(): boolean {
  return redisClient !== null && cacheManager !== null;
}

/**
 * Shutdown cache gracefully
 */
export async function shutdownCache(): Promise<void> {
  if (redisClient) {
    logger.info('🛑 Shutting down Redis cache...');
    await redisClient.disconnect();
    redisClient = null;
    cacheManager = null;
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
