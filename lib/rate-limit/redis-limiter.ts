import { NextRequest, NextResponse } from 'next/server';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Redis connection (lazy, optional)
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';

let redisClient: Redis | null = null;
let redisInitAttempted = false;
let redisAvailable = false;

/**
 * Lazily initialise and return the Redis client used for rate limiting.
 * Returns `null` when Redis is not configured or the connection failed.
 */
export function getRedisClient(): Redis | null {
  if (redisInitAttempted) {
    return redisAvailable ? redisClient : null;
  }

  redisInitAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn(
      '[rate-limit] REDIS_URL not set — falling back to in-memory rate limiting'
    );
    return null;
  }

  try {
    // Dynamic require so the module is only loaded when REDIS_URL is present.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require('ioredis') as typeof import('ioredis').default;

    redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 3000,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy(times: number) {
        if (times > 3) {
          // After 3 retries give up and fall back to in-memory
          console.warn(
            '[rate-limit] Redis retry limit reached — falling back to in-memory rate limiting'
          );
          redisAvailable = false;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
    });

    redisClient.on('ready', () => {
      redisAvailable = true;
      logger.info('[rate-limit] Redis connected — using Redis-backed rate limiting');
    });

    redisClient.on('error', (err: Error) => {
      // Log but do NOT throw — we fall back to in-memory silently
      if (redisAvailable) {
        console.warn(
          '[rate-limit] Redis error — falling back to in-memory rate limiting:',
          err.message
        );
      }
      redisAvailable = false;
    });

    redisClient.on('close', () => {
      redisAvailable = false;
    });

    redisClient.on('end', () => {
      redisAvailable = false;
    });

    // Optimistic: assume available until proven otherwise
    redisAvailable = true;
    return redisClient;
  } catch (err) {
    console.warn(
      '[rate-limit] Failed to initialise Redis — falling back to in-memory rate limiting:',
      err instanceof Error ? err.message : err
    );
    redisAvailable = false;
    return null;
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  const cleanup = () => {
    if (redisClient) {
      redisClient.disconnect();
    }
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

// ---------------------------------------------------------------------------
// In-memory sliding window store (fallback)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
  timestamps: number[]; // Circular buffer for precise sliding window
}

const memoryStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  windowMs: number;  // Janela de tempo em ms
  max: number;       // Máximo de requests na janela
  keyPrefix?: string; // Prefixo para a chave
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Timestamp Unix quando o limite reseta
  headers: Record<string, string>; // Headers para incluir na resposta
}

// ---------------------------------------------------------------------------
// Redis-backed sliding window (sorted sets)
// ---------------------------------------------------------------------------

/**
 * Sliding window rate limit using Redis sorted sets.
 * Each request is stored as a member with its timestamp as the score.
 * Old entries outside the window are pruned atomically via a pipeline.
 */
async function checkRateLimitRedis(
  storeKey: string,
  config: RateLimitConfig,
  redis: Redis
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const member = `${now}:${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const ttlSeconds = Math.ceil(config.windowMs / 1000);

  const pipeline = redis.pipeline();

  // 1. Remove entries outside the window
  pipeline.zremrangebyscore(storeKey, '-inf', windowStart);
  // 2. Add current request
  pipeline.zadd(storeKey, now, member);
  // 3. Count entries in window (after add)
  pipeline.zcard(storeKey);
  // 4. Set key expiry so Redis auto-cleans
  pipeline.expire(storeKey, ttlSeconds);

  const results = await pipeline.exec();

  // results[2] = [err, count] from ZCARD
  const count = (results && results[2] && results[2][1] as number) || 0;
  const remaining = Math.max(0, config.max - count);
  const resetTime = Math.ceil((now + config.windowMs) / 1000);
  const success = count <= config.max;

  // If over limit, remove the member we just added (don't pollute the set)
  if (!success) {
    redis.zrem(storeKey, member).catch(() => {
      // best-effort removal
    });
  }

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.max.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'X-RateLimit-Policy': `${config.max};w=${ttlSeconds}`,
  };

  if (!success) {
    headers['Retry-After'] = ttlSeconds.toString();
  }

  return {
    success,
    limit: config.max,
    remaining,
    reset: resetTime * 1000,
    headers,
  };
}

// ---------------------------------------------------------------------------
// In-memory sliding window (existing implementation)
// ---------------------------------------------------------------------------

function checkRateLimitMemory(
  storeKey: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Scheduled cleanup instead of random (more predictable)
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    lastCleanup = now;
    queueMicrotask(() => cleanupMemoryStore(config.windowMs));
  }

  let entry = memoryStore.get(storeKey);

  if (!entry) {
    entry = { count: 0, windowStart: now, timestamps: [] };
    memoryStore.set(storeKey, entry);
  }

  // Fast path: if window hasn't changed much, just increment
  if (entry.timestamps.length === 0) {
    entry.timestamps.push(now);
    entry.count = 1;
  } else {
    // Remove old timestamps (sliding window)
    const validTimestamps = entry.timestamps.filter(t => t > windowStart);
    validTimestamps.push(now);

    // Keep buffer size reasonable (max 2x the limit)
    if (validTimestamps.length > config.max * 2) {
      entry.timestamps = validTimestamps.slice(-config.max);
    } else {
      entry.timestamps = validTimestamps;
    }
    entry.count = entry.timestamps.length;
  }

  const remaining = Math.max(0, config.max - entry.count);
  const resetTime = Math.ceil((now + config.windowMs) / 1000); // Unix timestamp in seconds
  const success = entry.count <= config.max;

  // Prepare standard rate limit headers (RFC 6585 compliant)
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.max.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'X-RateLimit-Policy': `${config.max};w=${Math.ceil(config.windowMs / 1000)}`,
  };

  if (!success) {
    headers['Retry-After'] = Math.ceil(config.windowMs / 1000).toString();
  }

  return {
    success,
    limit: config.max,
    remaining,
    reset: resetTime * 1000,
    headers,
  };
}

// ---------------------------------------------------------------------------
// Main entry point — tries Redis, falls back to in-memory
// ---------------------------------------------------------------------------

/**
 * High-performance sliding window rate limiter.
 * Uses Redis sorted sets when REDIS_URL is available, otherwise falls back
 * to an in-memory sliding window with circular buffer.
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<RateLimitResult> {
  const key = identifier || getTrustedClientIP(request);
  const storeKey = `${config.keyPrefix || 'ratelimit'}:${key}`;

  // Attempt Redis path
  const redis = getRedisClient();
  if (redis && redisAvailable) {
    try {
      return await checkRateLimitRedis(storeKey, config, redis);
    } catch (err) {
      // Redis command failed — fall back to in-memory for this request
      console.warn(
        '[rate-limit] Redis command failed — using in-memory fallback:',
        err instanceof Error ? err.message : err
      );
    }
  }

  // In-memory fallback
  return checkRateLimitMemory(storeKey, config);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Limpa entradas antigas do memoryStore - runs async
 */
function cleanupMemoryStore(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs * 2; // Keep entries for 2x window

  for (const [key, entry] of memoryStore.entries()) {
    // Remove if last activity was before cutoff
    const lastActivity = entry.timestamps[entry.timestamps.length - 1] || 0;
    if (lastActivity < cutoff) {
      memoryStore.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): {
  entries: number;
  memoryKB: number;
  backend: 'redis' | 'memory';
} {
  let totalSize = 0;
  for (const [key, entry] of memoryStore.entries()) {
    totalSize += key.length * 2 + entry.timestamps.length * 8 + 24;
  }
  return {
    entries: memoryStore.size,
    memoryKB: Math.round(totalSize / 1024),
    backend: redisAvailable ? 'redis' : 'memory',
  };
}

// ---------------------------------------------------------------------------
// Middleware helper
// ---------------------------------------------------------------------------

/**
 * Middleware helper para aplicar rate limiting
 * Returns null if allowed, NextResponse if blocked
 * Also sets rate limit headers on the response
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<NextResponse | null> {
  // Explicit bypass for specific environments/jobs (never in production).
  if (process.env.BYPASS_RATE_LIMIT === 'true') {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('BYPASS_RATE_LIMIT cannot be used in production');
      // Don't bypass in production -- fall through to normal rate limiting
    } else {
      return null;
    }
  }

  // In tests we bypass by default to avoid cross-test pollution.
  // Dedicated rate-limit tests can opt-in with ENABLE_RATE_LIMIT_TESTS=true.
  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_TESTS !== 'true') {
    return null;
  }

  const result = await checkRateLimit(request, config, identifier);

  if (!result.success) {
    return NextResponse.json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please slow down.',
      limit: result.limit,
      remaining: 0,
      retryAfter: Math.ceil(config.windowMs / 1000)
    }, {
      status: 429,
      headers: result.headers
    });
  }

  // Success - store headers for later use
  // Note: Caller should add result.headers to their response
  return null;
}

/**
 * Helper to add rate limit headers to a successful response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  Object.entries(result.headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// ---------------------------------------------------------------------------
// Rate limit configs por tipo de endpoint
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  // Auth endpoints - CRÍTICO
  AUTH_REGISTER: { windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'auth:register' }, // 3/hora
  AUTH_LOGIN: { windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 5 : 50, keyPrefix: 'auth:login' }, // 5/15min prod, 50 dev
  AUTH_FORGOT_PASSWORD: { windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'auth:forgot' }, // 3/hora

  // AI endpoints - ALTO CUSTO
  AI_CLASSIFY: { windowMs: 60 * 1000, max: 10, keyPrefix: 'ai:classify' }, // 10/min
  AI_SEMANTIC: { windowMs: 60 * 1000, max: 10, keyPrefix: 'ai:semantic' }, // 10/min
  AI_SUGGEST: { windowMs: 60 * 1000, max: 10, keyPrefix: 'ai:suggest' }, // 10/min

  // Ticket mutations
  TICKET_MUTATION: { windowMs: 60 * 1000, max: 30, keyPrefix: 'ticket:mutation' }, // 30/min
  TICKET_COMMENT: { windowMs: 60 * 1000, max: 30, keyPrefix: 'ticket:comment' }, // 30/min
  TICKET_ATTACHMENT: { windowMs: 60 * 1000, max: 20, keyPrefix: 'ticket:attachment' }, // 20/min

  // Email/WhatsApp
  EMAIL_SEND: { windowMs: 60 * 1000, max: 10, keyPrefix: 'email:send' }, // 10/min
  WHATSAPP_SEND: { windowMs: 60 * 1000, max: 10, keyPrefix: 'whatsapp:send' }, // 10/min
  WEBHOOK: { windowMs: 60 * 1000, max: 100, keyPrefix: 'webhook' }, // 100/min

  // Search/Query
  SEARCH: { windowMs: 60 * 1000, max: 60, keyPrefix: 'search' }, // 60/min
  KNOWLEDGE_SEARCH: { windowMs: 60 * 1000, max: 60, keyPrefix: 'knowledge:search' }, // 60/min

  // Workflows
  WORKFLOW_EXECUTE: { windowMs: 60 * 1000, max: 20, keyPrefix: 'workflow:execute' }, // 20/min
  WORKFLOW_MUTATION: { windowMs: 60 * 1000, max: 20, keyPrefix: 'workflow:mutation' }, // 20/min

  // Analytics
  ANALYTICS: { windowMs: 60 * 1000, max: 30, keyPrefix: 'analytics' }, // 30/min

  // Admin mutations
  ADMIN_MUTATION: { windowMs: 60 * 1000, max: 20, keyPrefix: 'admin:mutation' }, // 20/min
  ADMIN_USER: { windowMs: 60 * 1000, max: 20, keyPrefix: 'admin:user' }, // 20/min

  // Billing
  BILLING: { windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'billing' }, // 30/15min

  // Default/General
  DEFAULT: { windowMs: 60 * 1000, max: process.env.NODE_ENV === 'production' ? 120 : 60, keyPrefix: 'api' }, // 120/min prod, 60/min dev
} as const;
