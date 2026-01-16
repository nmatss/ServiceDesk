import { NextRequest, NextResponse } from 'next/server';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';

// High-performance sliding window rate limiter using fixed-size circular buffer
interface RateLimitEntry {
  count: number;
  windowStart: number;
  timestamps: number[]; // Circular buffer for precise sliding window
}

const memoryStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute

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

/**
 * High-performance sliding window rate limiter
 * Uses circular buffer for O(1) operations with precise window tracking
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<RateLimitResult> {
  const key = identifier || getTrustedClientIP(request);
  const storeKey = `${config.keyPrefix || 'ratelimit'}:${key}`;

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
    headers
  };
}

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

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): { entries: number; memoryKB: number } {
  let totalSize = 0;
  for (const [key, entry] of memoryStore.entries()) {
    totalSize += key.length * 2 + entry.timestamps.length * 8 + 24;
  }
  return {
    entries: memoryStore.size,
    memoryKB: Math.round(totalSize / 1024)
  };
}

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

/**
 * Rate limit configs por tipo de endpoint
 */
export const RATE_LIMITS = {
  // Auth endpoints - CRÍTICO
  AUTH_REGISTER: { windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'auth:register' }, // 3/hora
  AUTH_LOGIN: { windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'auth:login' }, // 5/15min
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

  // Default/General
  DEFAULT: { windowMs: 60 * 1000, max: 60, keyPrefix: 'api' }, // 60/min
} as const;
