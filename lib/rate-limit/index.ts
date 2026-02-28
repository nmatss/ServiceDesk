import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '../monitoring/structured-logger';

interface RateLimitConfig {
  windowMs: number // Janela de tempo em ms
  maxRequests: number // Maximo de requests na janela
  keyGenerator?: (req: any) => string // Funcao para gerar chave unica
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
}

interface RateLimitEntry {
  key: string
  count: number
  reset_time: string
  created_at: string
}

// Configuracoes padrao por tipo de endpoint
export const rateLimitConfigs = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 100,
    message: 'Muitas requisicoes para API. Tente novamente em 15 minutos.'
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5, // Maximo 5 tentativas de login em 15 minutos
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  'auth-strict': {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 3, // Maximo 3 tentativas em 1 hora (mais rigoroso)
    message: 'Muitas tentativas de autenticacao. Conta temporariamente bloqueada por 1 hora.'
  },
  refresh: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 10, // Permite multiplos refreshes
    message: 'Muitas requisicoes de refresh. Tente novamente em 5 minutos.'
  },
  upload: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 10,
    message: 'Muitos uploads. Tente novamente em 5 minutos.'
  },
  search: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    maxRequests: 30,
    message: 'Muitas pesquisas. Tente novamente em 1 minuto.'
  },
  'password-reset': {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 3,
    message: 'Muitas solicitacoes de redefinicao de senha. Tente novamente em 1 hora.'
  },
  'embedding-generation': {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 20,
    message: 'Muitas requisicoes de geracao de embeddings. Tente novamente em 5 minutos.'
  },
  'semantic-search': {
    windowMs: 1 * 60 * 1000, // 1 minuto
    maxRequests: 50,
    message: 'Muitas pesquisas semanticas. Tente novamente em 1 minuto.'
  },
  'search-suggest': {
    windowMs: 1 * 60 * 1000, // 1 minuto
    maxRequests: 60,
    message: 'Muitas requisicoes de sugestao de pesquisa. Tente novamente em 1 minuto.'
  }
}

// Track whether table has been initialized
let tableInitialized = false;

/**
 * Inicializar tabela de rate limiting
 */
async function initRateLimitTable() {
  try {
    await executeRun(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, []);

    // Indice para limpeza automatica
    await executeRun(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time
      ON rate_limits(reset_time)
    `, []);

    tableInitialized = true;
  } catch (error) {
    logger.error('Error creating rate_limits table', error);
  }
}

/**
 * Gerar chave padrao baseada no IP e endpoint
 */
function defaultKeyGenerator(req: any, endpoint: string): string {
  const ip = req.headers.get('x-forwarded-for') ||
             req.headers.get('x-real-ip') ||
             req.ip ||
             'unknown'

  const userAgent = req.headers.get('user-agent') || 'unknown'
  const hash = Buffer.from(`${ip}-${userAgent}-${endpoint}`).toString('base64')

  return `rate_limit:${hash}`
}

/**
 * Limpar entradas expiradas
 */
async function cleanupExpiredEntries() {
  try {
    const result = await executeRun(`
      DELETE FROM rate_limits
      WHERE reset_time < datetime('now')
    `, []);

    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired rate limit entries`)
    }
  } catch (error) {
    logger.error('Error cleaning up rate limits', error)
  }
}

/**
 * Ensure table exists
 */
async function ensureTable() {
  if (!tableInitialized) {
    try {
      await executeQuery<any>('SELECT 1 FROM rate_limits LIMIT 1', []);
      tableInitialized = true;
    } catch {
      await initRateLimitTable();
    }
  }
}

/**
 * Aplicar rate limiting
 */
export async function applyRateLimit(
  request: any,
  config: RateLimitConfig,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetTime: Date; total: number }> {

  await ensureTable();

  // Limpeza periodica (chance de 1%)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  const key = config.keyGenerator ?
    config.keyGenerator(request) :
    defaultKeyGenerator(request, endpoint)

  const now = new Date()
  const resetTime = new Date(now.getTime() + config.windowMs)

  try {
    // Buscar entrada existente
    const existing = await executeQueryOne<RateLimitEntry>(`
      SELECT * FROM rate_limits
      WHERE key = ? AND reset_time > datetime('now')
    `, [key]);

    if (existing) {
      // Incrementar contador
      const newCount = existing.count + 1

      await executeRun(`
        UPDATE rate_limits
        SET count = ?, updated_at = datetime('now')
        WHERE key = ?
      `, [newCount, key]);

      const remaining = Math.max(0, config.maxRequests - newCount)
      const allowed = newCount <= config.maxRequests

      return {
        allowed,
        remaining,
        resetTime: new Date(existing.reset_time),
        total: config.maxRequests
      }
    } else {
      // Criar nova entrada
      await executeRun(`
        INSERT OR REPLACE INTO rate_limits (key, count, reset_time)
        VALUES (?, 1, ?)
      `, [key, resetTime.toISOString()]);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
        total: config.maxRequests
      }
    }
  } catch (error) {
    logger.error('Rate limit error', error)
    // Em caso de erro, permitir a requisicao
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime,
      total: config.maxRequests
    }
  }
}

/**
 * Middleware de rate limiting para Next.js
 */
export function createRateLimitMiddleware(
  configType: keyof typeof rateLimitConfigs,
  customConfig?: Partial<RateLimitConfig>
) {
  const config = { ...rateLimitConfigs[configType], ...customConfig }

  return async function rateLimitMiddleware(request: any, endpoint: string) {
    const result = await applyRateLimit(request, config, endpoint)

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: config.message || 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime.getTime() - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.total.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toISOString(),
            'Retry-After': Math.ceil((result.resetTime.getTime() - Date.now()) / 1000).toString()
          }
        }
      )
    }

    return {
      headers: {
        'X-RateLimit-Limit': result.total.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toISOString()
      }
    }
  }
}

/**
 * Verificar status do rate limit sem incrementar
 */
export async function checkRateLimit(
  request: any,
  config: RateLimitConfig,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {

  const key = config.keyGenerator ?
    config.keyGenerator(request) :
    defaultKeyGenerator(request, endpoint)

  try {
    const existing = await executeQueryOne<RateLimitEntry>(`
      SELECT * FROM rate_limits
      WHERE key = ? AND reset_time > datetime('now')
    `, [key]);

    if (existing) {
      const remaining = Math.max(0, config.maxRequests - existing.count)
      const allowed = existing.count < config.maxRequests

      return {
        allowed,
        remaining,
        resetTime: new Date(existing.reset_time)
      }
    }

    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs)
    }
  } catch (error) {
    logger.error('Check rate limit error', error)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs)
    }
  }
}

/**
 * Resetar rate limit para uma chave especifica
 */
export async function resetRateLimit(request: any, endpoint: string): Promise<boolean> {
  try {
    const key = defaultKeyGenerator(request, endpoint)

    const result = await executeRun(`
      DELETE FROM rate_limits WHERE key = ?
    `, [key]);

    return result.changes > 0
  } catch (error) {
    logger.error('Reset rate limit error', error)
    return false
  }
}

/**
 * Obter estatisticas de rate limiting
 */
export async function getRateLimitStats(): Promise<{
  totalEntries: number
  activeEntries: number
  expiredEntries: number
}> {
  try {
    const total = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM rate_limits
    `, []);

    const active = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM rate_limits
      WHERE reset_time > datetime('now')
    `, []);

    return {
      totalEntries: total?.count ?? 0,
      activeEntries: active?.count ?? 0,
      expiredEntries: (total?.count ?? 0) - (active?.count ?? 0)
    }
  } catch (error) {
    logger.error('Get rate limit stats error', error)
    return {
      totalEntries: 0,
      activeEntries: 0,
      expiredEntries: 0
    }
  }
}

export default {
  applyRateLimit,
  createRateLimitMiddleware,
  checkRateLimit,
  resetRateLimit,
  getRateLimitStats,
  rateLimitConfigs
}
