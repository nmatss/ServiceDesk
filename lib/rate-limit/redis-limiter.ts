import { NextRequest, NextResponse } from 'next/server';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';

// In-memory store for rate limiting (fallback when Redis is not available)
interface RateLimitEntry {
  requests: number[];
}

const memoryStore = new Map<string, RateLimitEntry>();

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
}

/**
 * Rate limiter baseado em memória (para desenvolvimento/fallback)
 * Para produção, usar Redis via ioredis quando REDIS_URL estiver configurado
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<RateLimitResult> {
  // Identificador único (IP ou userId)
  const key = identifier || getTrustedClientIP(request);
  const storeKey = `${config.keyPrefix || 'ratelimit'}:${key}`;

  const now = Date.now();
  const windowStart = now - config.windowMs;

  // TODO: Implementar Redis quando REDIS_URL estiver disponível
  // if (process.env.REDIS_URL) { ... }

  // Usar memória como fallback
  let entry = memoryStore.get(storeKey);

  if (!entry) {
    entry = { requests: [] };
    memoryStore.set(storeKey, entry);
  }

  // Remover requests antigas (fora da janela)
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

  // Adicionar request atual
  entry.requests.push(now);

  const count = entry.requests.length;
  const remaining = Math.max(0, config.max - count);
  const reset = now + config.windowMs;

  // Limpar memória periodicamente (evitar memory leak)
  if (Math.random() < 0.01) { // 1% de chance
    cleanupMemoryStore(config.windowMs);
  }

  return {
    success: count <= config.max,
    limit: config.max,
    remaining,
    reset
  };
}

/**
 * Limpa entradas antigas do memoryStore
 */
function cleanupMemoryStore(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;

  for (const [key, entry] of memoryStore.entries()) {
    entry.requests = entry.requests.filter(timestamp => timestamp > cutoff);

    if (entry.requests.length === 0) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Middleware helper para aplicar rate limiting
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
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
    }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.reset.toString(),
        'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString()
      }
    });
  }

  // Success - rate limit não excedido
  return null;
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
