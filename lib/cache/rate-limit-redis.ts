/**
 * Distributed Rate Limiting with Redis
 *
 * Implements multiple rate limiting algorithms:
 * - Fixed Window
 * - Sliding Window Log
 * - Sliding Window Counter
 * - Token Bucket
 * - Leaky Bucket
 */

import { getRedisClient } from './redis-client';
import logger from '../monitoring/structured-logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests in window
  algorithm?: 'fixed' | 'sliding-log' | 'sliding-counter' | 'token-bucket' | 'leaky-bucket';
  keyPrefix?: string;
  blockDuration?: number; // Block duration after limit exceeded (ms)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp
  retryAfter?: number; // Seconds to wait
  total: number;
}

export class RedisRateLimiter {
  private static instance: RedisRateLimiter;
  private redisClient: ReturnType<typeof getRedisClient>;

  private constructor() {
    this.redisClient = getRedisClient();
  }

  public static getInstance(): RedisRateLimiter {
    if (!RedisRateLimiter.instance) {
      RedisRateLimiter.instance = new RedisRateLimiter();
    }
    return RedisRateLimiter.instance;
  }

  /**
   * Build Redis key
   */
  private buildKey(identifier: string, prefix: string = 'ratelimit'): string {
    return `${prefix}:${identifier}`;
  }

  /**
   * Fixed Window Algorithm
   * Simple and memory efficient, but can allow burst at window boundaries
   */
  async fixedWindow(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config;
    const key = this.buildKey(identifier, keyPrefix);
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      const redis = this.redisClient.getClient();

      // Increment counter
      const count = await redis.incr(key);

      // Set expiry on first request
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Get TTL for reset time
      const ttl = await redis.ttl(key);
      const resetTime = Date.now() + ttl * 1000;
      const remaining = Math.max(0, maxRequests - count);
      const allowed = count <= maxRequests;

      if (!allowed) {
        logger.warn('Rate limit exceeded (fixed window)', {
          identifier,
          count,
          limit: maxRequests,
          resetTime,
        });
      }

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : ttl,
        total: maxRequests,
      };
    } catch (error) {
      logger.error('Fixed window rate limit error', error);
      // Fail open - allow request on error
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: Date.now() + windowSeconds * 1000,
        total: maxRequests,
      };
    }
  }

  /**
   * Sliding Window Log Algorithm
   * Accurate but memory intensive (stores timestamp for each request)
   */
  async slidingWindowLog(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config;
    const key = this.buildKey(identifier, keyPrefix);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const redis = this.redisClient.getClient();

      // Use Redis Sorted Set with timestamps as scores
      const pipeline = redis.pipeline();

      // Remove old entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);

      // Count current entries
      pipeline.zcard(key);

      // Add new entry
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();

      if (!results || !results[1]) {
        throw new Error('Pipeline execution failed');
      }

      // Get count (before adding new entry)
      const count = (results[1][1] as number) || 0;
      const remaining = Math.max(0, maxRequests - count - 1);
      const allowed = count < maxRequests;

      // Calculate reset time (when oldest entry expires)
      const oldestTimestamp = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestTimestamp.length > 1 && oldestTimestamp[1]
        ? parseInt(oldestTimestamp[1]) + windowMs
        : now + windowMs;

      if (!allowed) {
        // Remove the entry we just added
        await redis.zrem(key, `${now}-${Math.random()}`);

        logger.warn('Rate limit exceeded (sliding window log)', {
          identifier,
          count,
          limit: maxRequests,
          resetTime,
        });
      }

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
        total: maxRequests,
      };
    } catch (error) {
      logger.error('Sliding window log rate limit error', error);
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: now + windowMs,
        total: maxRequests,
      };
    }
  }

  /**
   * Sliding Window Counter Algorithm
   * Balance between accuracy and memory usage
   */
  async slidingWindowCounter(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config;
    const windowSeconds = Math.ceil(windowMs / 1000);
    const now = Date.now();
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    const currentKey = this.buildKey(`${identifier}:${currentWindow}`, keyPrefix);
    const previousKey = this.buildKey(`${identifier}:${previousWindow}`, keyPrefix);

    try {
      const redis = this.redisClient.getClient();

      // Get counts from current and previous windows
      const [currentCount, previousCount] = await Promise.all([
        redis.get(currentKey).then(v => parseInt(v || '0')),
        redis.get(previousKey).then(v => parseInt(v || '0')),
      ]);

      // Calculate weighted count
      const windowProgress = (now % windowMs) / windowMs;
      const weightedCount = Math.floor(
        previousCount * (1 - windowProgress) + currentCount
      );

      const remaining = Math.max(0, maxRequests - weightedCount - 1);
      const allowed = weightedCount < maxRequests;

      if (allowed) {
        // Increment current window
        await redis.incr(currentKey);
        await redis.expire(currentKey, windowSeconds * 2);
      }

      const resetTime = (currentWindow + 1) * windowMs;

      if (!allowed) {
        logger.warn('Rate limit exceeded (sliding window counter)', {
          identifier,
          weightedCount,
          limit: maxRequests,
          resetTime,
        });
      }

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000),
        total: maxRequests,
      };
    } catch (error) {
      logger.error('Sliding window counter rate limit error', error);
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: (currentWindow + 1) * windowMs,
        total: maxRequests,
      };
    }
  }

  /**
   * Token Bucket Algorithm
   * Good for handling bursts while maintaining average rate
   */
  async tokenBucket(
    identifier: string,
    config: RateLimitConfig & { refillRate?: number; bucketSize?: number }
  ): Promise<RateLimitResult> {
    const {
      windowMs,
      maxRequests,
      keyPrefix = 'ratelimit',
      refillRate = maxRequests / (windowMs / 1000), // tokens per second
      bucketSize = maxRequests,
    } = config;

    const key = this.buildKey(identifier, keyPrefix);
    const now = Date.now();

    try {
      const redis = this.redisClient.getClient();

      // Get current bucket state
      const data = await redis.get(key);
      let tokens: number;
      let lastRefill: number;

      if (data) {
        const state = JSON.parse(data);
        tokens = state.tokens;
        lastRefill = state.lastRefill;

        // Refill tokens based on time passed
        const timePassed = (now - lastRefill) / 1000;
        const tokensToAdd = Math.floor(timePassed * refillRate);
        tokens = Math.min(bucketSize, tokens + tokensToAdd);
        lastRefill = now;
      } else {
        tokens = bucketSize;
        lastRefill = now;
      }

      const allowed = tokens >= 1;
      let remaining = tokens;

      if (allowed) {
        // Consume one token
        tokens -= 1;
        remaining = tokens;

        // Save state
        await redis.setex(
          key,
          Math.ceil(windowMs / 1000),
          JSON.stringify({ tokens, lastRefill })
        );
      }

      // Calculate reset time (when bucket will be full)
      const tokensNeeded = bucketSize - tokens;
      const resetTime = now + (tokensNeeded / refillRate) * 1000;

      if (!allowed) {
        logger.warn('Rate limit exceeded (token bucket)', {
          identifier,
          tokens,
          limit: bucketSize,
          resetTime,
        });
      }

      return {
        allowed,
        remaining: Math.floor(remaining),
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil((1 / refillRate)),
        total: bucketSize,
      };
    } catch (error) {
      logger.error('Token bucket rate limit error', error);
      return {
        allowed: true,
        remaining: bucketSize,
        resetTime: now + windowMs,
        total: bucketSize,
      };
    }
  }

  /**
   * Leaky Bucket Algorithm
   * Smooths out bursts by processing requests at a constant rate
   */
  async leakyBucket(
    identifier: string,
    config: RateLimitConfig & { leakRate?: number; bucketSize?: number }
  ): Promise<RateLimitResult> {
    const {
      windowMs,
      maxRequests,
      keyPrefix = 'ratelimit',
      leakRate = maxRequests / (windowMs / 1000), // requests per second
      bucketSize = maxRequests,
    } = config;

    const key = this.buildKey(identifier, keyPrefix);
    const now = Date.now();

    try {
      const redis = this.redisClient.getClient();

      // Get current bucket state
      const data = await redis.get(key);
      let water: number; // Current water level
      let lastLeak: number;

      if (data) {
        const state = JSON.parse(data);
        water = state.water;
        lastLeak = state.lastLeak;

        // Leak water based on time passed
        const timePassed = (now - lastLeak) / 1000;
        const waterToLeak = timePassed * leakRate;
        water = Math.max(0, water - waterToLeak);
        lastLeak = now;
      } else {
        water = 0;
        lastLeak = now;
      }

      const allowed = water < bucketSize;
      let remaining = Math.floor(bucketSize - water - 1);

      if (allowed) {
        // Add one drop
        water += 1;

        // Save state
        await redis.setex(
          key,
          Math.ceil(windowMs / 1000),
          JSON.stringify({ water, lastLeak })
        );
      }

      // Calculate reset time
      const resetTime = now + ((water - bucketSize + 1) / leakRate) * 1000;

      if (!allowed) {
        logger.warn('Rate limit exceeded (leaky bucket)', {
          identifier,
          water,
          limit: bucketSize,
          resetTime,
        });
      }

      return {
        allowed,
        remaining: Math.max(0, remaining),
        resetTime,
        retryAfter: allowed ? undefined : Math.ceil(1 / leakRate),
        total: bucketSize,
      };
    } catch (error) {
      logger.error('Leaky bucket rate limit error', error);
      return {
        allowed: true,
        remaining: bucketSize,
        resetTime: now + windowMs,
        total: bucketSize,
      };
    }
  }

  /**
   * Main rate limit method (delegates to algorithm)
   */
  async limit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const algorithm = config.algorithm || 'sliding-counter';

    switch (algorithm) {
      case 'fixed':
        return this.fixedWindow(identifier, config);
      case 'sliding-log':
        return this.slidingWindowLog(identifier, config);
      case 'sliding-counter':
        return this.slidingWindowCounter(identifier, config);
      case 'token-bucket':
        return this.tokenBucket(identifier, config);
      case 'leaky-bucket':
        return this.leakyBucket(identifier, config);
      default:
        return this.slidingWindowCounter(identifier, config);
    }
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string, keyPrefix: string = 'ratelimit'): Promise<boolean> {
    try {
      const redis = this.redisClient.getClient();
      const pattern = `${keyPrefix}:${identifier}*`;

      // Scan and delete all matching keys
      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += await redis.del(...keys);
        }
      } while (cursor !== '0');

      logger.info('Rate limit reset', { identifier, deleted });
      return deleted > 0;
    } catch (error) {
      logger.error('Failed to reset rate limit', { identifier, error });
      return false;
    }
  }

  /**
   * Get rate limit status without consuming quota
   */
  async check(
    identifier: string,
    config: RateLimitConfig
  ): Promise<Omit<RateLimitResult, 'allowed'>> {
    const { keyPrefix = 'ratelimit' } = config;
    const key = this.buildKey(identifier, keyPrefix);

    try {
      const redis = this.redisClient.getClient();
      const count = await redis.get(key);
      const ttl = await redis.ttl(key);

      const currentCount = parseInt(count || '0');
      const remaining = Math.max(0, config.maxRequests - currentCount);
      const resetTime = Date.now() + ttl * 1000;

      return {
        remaining,
        resetTime,
        total: config.maxRequests,
      };
    } catch (error) {
      logger.error('Failed to check rate limit', { identifier, error });
      return {
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        total: config.maxRequests,
      };
    }
  }
}

/**
 * Get RedisRateLimiter instance
 */
export function getRedisRateLimiter(): RedisRateLimiter {
  return RedisRateLimiter.getInstance();
}

/**
 * Export singleton
 */
export const redisRateLimiter = RedisRateLimiter.getInstance();

/**
 * Common rate limit configurations
 */
export const rateLimitPresets = {
  // API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    algorithm: 'sliding-counter' as const,
  },

  // Authentication
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    algorithm: 'sliding-log' as const,
  },

  // Strict auth (after multiple failures)
  authStrict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    algorithm: 'sliding-log' as const,
    blockDuration: 60 * 60 * 1000, // 1 hour
  },

  // File uploads
  upload: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    algorithm: 'token-bucket' as const,
  },

  // Search queries
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    algorithm: 'leaky-bucket' as const,
  },

  // Password reset
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    algorithm: 'fixed' as const,
  },

  // Admin operations
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    algorithm: 'sliding-counter' as const,
  },
};
