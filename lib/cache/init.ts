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
    return;
  }

  // Check if Redis is configured — skip entirely if not (no timeout delay)
  const redisHost = process.env.REDIS_HOST || process.env.REDIS_URL;

  if (!redisHost) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Redis not configured in production. Using in-memory cache.');
    }
    isInitialized = true;
    return;
  }

  // Redis is configured — connect in background (don't block startup)
  isInitialized = true;
  connectRedisAsync().catch(() => {});
}

/** Connect to Redis without blocking server startup */
async function connectRedisAsync(): Promise<void> {
  try {
    logger.info('Initializing Redis caching layer (background)...');

    redisClient = getRedisClient();
    await redisClient.connect();

    const health = await redisClient.healthCheck();
    if (health.status === 'unhealthy') {
      throw new Error('Redis health check failed');
    }

    cacheManager = getCacheManager();
    logger.info(`Redis connected (latency: ${health.latency}ms)`);
  } catch (error) {
    logger.error('Failed to initialize Redis, using in-memory cache', error);
    redisClient = null;
    cacheManager = null;
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

// Auto-initialize in production (non-blocking)
if (process.env.NODE_ENV === 'production') {
  initializeCache().catch(() => {});
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
