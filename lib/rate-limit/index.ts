import db from '../db/connection'
import { logger } from '../monitoring/logger';

interface RateLimitConfig {
  windowMs: number // Janela de tempo em ms
  maxRequests: number // Máximo de requests na janela
  keyGenerator?: (req: any) => string // Função para gerar chave única
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

// Configurações padrão por tipo de endpoint
export const rateLimitConfigs = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 100,
    message: 'Muitas requisições para API. Tente novamente em 15 minutos.'
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
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
  }
}

/**
 * Inicializar tabela de rate limiting
 */
function initRateLimitTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Índice para limpeza automática
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time
      ON rate_limits(reset_time)
    `)
  } catch (error) {
    logger.error('Error creating rate_limits table', error)
  }
}

/**
 * Gerar chave padrão baseada no IP e endpoint
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
function cleanupExpiredEntries() {
  try {
    const result = db.prepare(`
      DELETE FROM rate_limits
      WHERE reset_time < datetime('now')
    `).run()

    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired rate limit entries`)
    }
  } catch (error) {
    logger.error('Error cleaning up rate limits', error)
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

  // Inicializar tabela se necessário
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='rate_limits'
  `).get()

  if (!tableExists) {
    initRateLimitTable()
  }

  // Limpeza periódica (chance de 1%)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries()
  }

  const key = config.keyGenerator ?
    config.keyGenerator(request) :
    defaultKeyGenerator(request, endpoint)

  const now = new Date()
  const resetTime = new Date(now.getTime() + config.windowMs)

  try {
    // Buscar entrada existente
    const existing = db.prepare(`
      SELECT * FROM rate_limits
      WHERE key = ? AND reset_time > datetime('now')
    `).get(key) as RateLimitEntry | undefined

    if (existing) {
      // Incrementar contador
      const newCount = existing.count + 1

      db.prepare(`
        UPDATE rate_limits
        SET count = ?, updated_at = datetime('now')
        WHERE key = ?
      `).run(newCount, key)

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
      db.prepare(`
        INSERT OR REPLACE INTO rate_limits (key, count, reset_time)
        VALUES (?, 1, ?)
      `).run(key, resetTime.toISOString())

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
        total: config.maxRequests
      }
    }
  } catch (error) {
    logger.error('Rate limit error', error)
    // Em caso de erro, permitir a requisição
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
    const existing = db.prepare(`
      SELECT * FROM rate_limits
      WHERE key = ? AND reset_time > datetime('now')
    `).get(key) as RateLimitEntry | undefined

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
 * Resetar rate limit para uma chave específica
 */
export function resetRateLimit(request: any, endpoint: string): boolean {
  try {
    const key = defaultKeyGenerator(request, endpoint)

    const result = db.prepare(`
      DELETE FROM rate_limits WHERE key = ?
    `).run(key)

    return result.changes > 0
  } catch (error) {
    logger.error('Reset rate limit error', error)
    return false
  }
}

/**
 * Obter estatísticas de rate limiting
 */
export function getRateLimitStats(): {
  totalEntries: number
  activeEntries: number
  expiredEntries: number
} {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM rate_limits
    `).get() as { count: number }

    const active = db.prepare(`
      SELECT COUNT(*) as count FROM rate_limits
      WHERE reset_time > datetime('now')
    `).get() as { count: number }

    return {
      totalEntries: total.count,
      activeEntries: active.count,
      expiredEntries: total.count - active.count
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