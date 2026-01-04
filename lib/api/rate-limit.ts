/**
 * Rate Limiting Middleware
 * Enterprise-grade rate limiting with multiple strategies
 */

import { NextRequest, NextResponse } from 'next/server'
import { LRUCache } from 'lru-cache'
import { ApiContext, RateLimitInfo } from './types'
import { RateLimitError, ErrorDetails } from './errors'
import logger from '../monitoring/structured-logger'
import { getTrustedClientIP, validateIPHeaders, logSpoofingAttempt } from './ip-validation';

// Rate Limit Store Interface
interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>
  set(key: string, record: RateLimitRecord, ttl: number): Promise<void>
  increment(key: string, windowMs: number): Promise<RateLimitRecord>
  reset(key: string): Promise<void>
}

// Rate Limit Record
interface RateLimitRecord {
  count: number
  resetTime: number
  firstRequest: number
}

// In-Memory Store Implementation (for development)
class MemoryRateLimitStore implements RateLimitStore {
  private cache = new LRUCache<string, RateLimitRecord>({
    max: 10000,
    ttl: 1000 * 60 * 60, // 1 hour
  })

  async get(key: string): Promise<RateLimitRecord | null> {
    return this.cache.get(key) || null
  }

  async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
    this.cache.set(key, record, { ttl })
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now()
    const existing = this.cache.get(key)

    if (!existing || now >= existing.resetTime) {
      // New window
      const record: RateLimitRecord = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now,
      }
      this.cache.set(key, record, { ttl: windowMs })
      return record
    }

    // Increment existing
    existing.count++
    this.cache.set(key, existing, { ttl: existing.resetTime - now })
    return existing
  }

  async reset(key: string): Promise<void> {
    this.cache.delete(key)
  }
}

// Redis Store Implementation (for production)
class RedisRateLimitStore implements RateLimitStore {
  private redis: any // Redis client

  constructor(redisClient: any) {
    this.redis = redisClient
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    const data = await this.redis.get(key)
    return data ? JSON.parse(data) : null
  }

  async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
    await this.redis.setex(key, Math.ceil(ttl / 1000), JSON.stringify(record))
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now()
    const lua = `
      local key = KEYS[1]
      local window = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])

      local current = redis.call('GET', key)
      if current == false then
        local record = {
          count = 1,
          resetTime = now + window,
          firstRequest = now
        }
        redis.call('SETEX', key, math.ceil(window / 1000), cjson.encode(record))
        return cjson.encode(record)
      end

      local record = cjson.decode(current)
      if now >= record.resetTime then
        record = {
          count = 1,
          resetTime = now + window,
          firstRequest = now
        }
      else
        record.count = record.count + 1
      end

      redis.call('SETEX', key, math.ceil((record.resetTime - now) / 1000), cjson.encode(record))
      return cjson.encode(record)
    `

    const result = await this.redis.eval(lua, 1, key, windowMs, now)
    return JSON.parse(result)
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key)
  }
}

// Rate Limit Configuration
export interface RateLimitConfig {
  windowMs: number
  max: number
  message?: string
  standardHeaders?: boolean
  legacyHeaders?: boolean
  keyGenerator?: (req: NextRequest, context?: ApiContext) => string
  skip?: (req: NextRequest, context?: ApiContext) => boolean
  onLimitReached?: (req: NextRequest, context: ApiContext | undefined, rateLimitInfo: RateLimitInfo) => void
  store?: RateLimitStore
}

// Rate Limit Strategies
export const rateLimitStrategies = {
  // General API limits
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: 'Too many API requests, please try again later',
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many authentication attempts, please try again later',
  },

  // Password reset attempts
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset attempts, please try again later',
  },

  // File uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: 'Too many file uploads, please try again later',
  },

  // Search queries
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many search requests, please try again later',
  },

  // Webhook deliveries
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many webhook requests, please try again later',
  },

  // Admin operations
  admin: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100,
    message: 'Too many admin requests, please try again later',
  },

  // Public endpoints (more restrictive for unauthenticated users)
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many requests, please try again later',
  },
}

// Default Store
const defaultStore = new MemoryRateLimitStore()

// Rate Limiter Class
export class RateLimiter {
  private config: Required<RateLimitConfig>

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      max: config.max,
      message: config.message || 'Too many requests, please try again later',
      standardHeaders: config.standardHeaders ?? true,
      legacyHeaders: config.legacyHeaders ?? false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skip: config.skip || (() => false),
      onLimitReached: config.onLimitReached || (() => {}),
      store: config.store || defaultStore,
    }
  }

  private defaultKeyGenerator(req: NextRequest, context?: ApiContext): string {
    // Use user ID if authenticated, otherwise IP
    if (context?.user?.id) {
      return `user:${context.user.id}`
    }

    // ✅ USAR IP VALIDATION - Proteção contra IP spoofing
    const ip = getTrustedClientIP(req)

    // ⚠️ Validar headers de IP e detectar tentativas de spoofing
    const validation = validateIPHeaders(req)
    if (!validation.valid) {
      // Logar warnings mas continuar (não bloquear)
      validation.warnings.forEach(warning => {
        logSpoofingAttempt(req, warning)
      })
    }

    return `ip:${ip}`
  }

  async middleware(
    req: NextRequest,
    context: ApiContext
  ): Promise<NextResponse | null> {
    // Check if request should be skipped
    if (this.config.skip(req, context)) {
      return null
    }

    const key = this.config.keyGenerator(req, context)
    const rateLimitKey = `ratelimit:${key}:${req.nextUrl.pathname}`

    try {
      const record = await this.config.store.increment(rateLimitKey, this.config.windowMs)
      const remaining = Math.max(0, this.config.max - record.count)
      const resetTime = Math.ceil(record.resetTime / 1000)

      const rateLimitInfo: RateLimitInfo = {
        limit: this.config.max,
        remaining,
        reset: resetTime,
      }

      // Check if limit exceeded
      if (record.count > this.config.max) {
        const retryAfter = Math.ceil((record.resetTime - Date.now()) / 1000)
        rateLimitInfo.retryAfter = retryAfter

        // Call limit reached callback
        this.config.onLimitReached(req, context, rateLimitInfo)

        // Create error response
        const error = new RateLimitError(retryAfter, rateLimitInfo as unknown as ErrorDetails, context.requestId)
        const response = NextResponse.json(
          {
            success: false,
            error: error.toApiError(req.nextUrl.pathname),
          },
          { status: 429 }
        )

        // Add rate limit headers
        this.addRateLimitHeaders(response, rateLimitInfo)
        return response
      }

      // Add rate limit headers to successful requests
      const response = NextResponse.next()
      this.addRateLimitHeaders(response, rateLimitInfo)
      return null // Continue to next middleware

    } catch (error) {
      logger.error('Rate limit store error', error)
      // On store error, allow request to continue
      return null
    }
  }

  private addRateLimitHeaders(response: NextResponse, info: RateLimitInfo): void {
    if (this.config.standardHeaders) {
      response.headers.set('RateLimit-Limit', info.limit.toString())
      response.headers.set('RateLimit-Remaining', info.remaining.toString())
      response.headers.set('RateLimit-Reset', info.reset.toString())
    }

    if (this.config.legacyHeaders) {
      response.headers.set('X-RateLimit-Limit', info.limit.toString())
      response.headers.set('X-RateLimit-Remaining', info.remaining.toString())
      response.headers.set('X-RateLimit-Reset', info.reset.toString())
    }

    if (info.retryAfter) {
      response.headers.set('Retry-After', info.retryAfter.toString())
    }
  }

  // Get current rate limit status
  async getStatus(req: NextRequest, context?: ApiContext): Promise<RateLimitInfo | null> {
    const key = this.config.keyGenerator(req, context)
    const rateLimitKey = `ratelimit:${key}:${req.nextUrl.pathname}`

    try {
      const record = await this.config.store.get(rateLimitKey)
      if (!record) {
        return {
          limit: this.config.max,
          remaining: this.config.max,
          reset: Math.ceil((Date.now() + this.config.windowMs) / 1000),
        }
      }

      const remaining = Math.max(0, this.config.max - record.count)
      return {
        limit: this.config.max,
        remaining,
        reset: Math.ceil(record.resetTime / 1000),
      }
    } catch (error) {
      logger.error('Rate limit status error', error)
      return null
    }
  }

  // Reset rate limit for a key
  async reset(req: NextRequest, context?: ApiContext): Promise<void> {
    const key = this.config.keyGenerator(req, context)
    const rateLimitKey = `ratelimit:${key}:${req.nextUrl.pathname}`

    try {
      await this.config.store.reset(rateLimitKey)
    } catch (error) {
      logger.error('Rate limit reset error', error)
    }
  }
}

// Pre-configured Rate Limiters
export const createRateLimiter = (strategy: keyof typeof rateLimitStrategies, overrides?: Partial<RateLimitConfig>) => {
  const config = { ...rateLimitStrategies[strategy], ...overrides }
  return new RateLimiter(config)
}

// Middleware factory
export function rateLimit(strategy: keyof typeof rateLimitStrategies, overrides?: Partial<RateLimitConfig>) {
  const limiter = createRateLimiter(strategy, overrides)

  return async (req: NextRequest, context: ApiContext): Promise<NextResponse | null> => {
    return limiter.middleware(req, context)
  }
}

// Export specific rate limiters
export const apiRateLimit = createRateLimiter('api')
export const authRateLimit = createRateLimiter('auth')
export const uploadRateLimit = createRateLimiter('upload')
export const searchRateLimit = createRateLimiter('search')
export const webhookRateLimit = createRateLimiter('webhook')
export const adminRateLimit = createRateLimiter('admin')
export const publicRateLimit = createRateLimiter('public')

// Store configuration
export function configureRateLimitStore(redisClient?: any): void {
  if (redisClient && process.env.NODE_ENV === 'production') {
    // Use Redis in production
    const redisStore = new RedisRateLimitStore(redisClient)

    // Update all rate limiters to use Redis
    Object.values(rateLimitStrategies).forEach(strategy => {
      if ('store' in strategy) {
        (strategy as any).store = redisStore
      }
    })
  }
}

export default RateLimiter