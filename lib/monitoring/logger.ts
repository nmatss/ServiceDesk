/**
 * Isomorphic Logger
 *
 * This logger works in both Node.js (server) and browser (client) environments.
 * Uses console-based logging only - no database dependencies.
 *
 * For database logging, use the server-side logging functions in API routes.
 */

// Níveis de log
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Tipos de evento
export enum EventType {
  AUTH = 'auth',
  API = 'api',
  DATABASE = 'database',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  USER_ACTION = 'user_action',
  SYSTEM = 'system'
}

// Interface para log entry
export interface LogEntry {
  id?: number
  timestamp: string
  level: LogLevel
  type: EventType
  message: string
  details?: unknown
  user_id?: number
  tenant_id?: number
  ip_address?: string
  user_agent?: string
  request_id?: string
  duration_ms?: number
  stack_trace?: string
}

// Interface para métricas
export interface Metrics {
  requests_total: number
  requests_errors: number
  response_time_avg: number
  active_users: number
  database_queries: number
  cache_hits: number
  cache_misses: number
}

// Configuração do logger
interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  prefix?: string
}

const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  prefix: '',
}

class Logger {
  private config: LoggerConfig
  private metricsData: Metrics

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.metricsData = {
      requests_total: 0,
      requests_errors: 0,
      response_time_avg: 0,
      active_users: 0,
      database_queries: 0,
      cache_hits: 0,
      cache_misses: 0
    }
  }

  /**
   * Log principal
   */
  log(level: LogLevel, type: EventType, message: string, details?: unknown, metadata?: Partial<LogEntry>) {
    if (level > this.config.level) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      details,
      ...metadata
    }

    // Console log
    if (this.config.enableConsole) {
      this.logToConsole(entry)
    }

    // Update metrics
    this.updateMetrics(entry)
  }

  /**
   * Log para console
   */
  private logToConsole(entry: LogEntry) {
    const levelName = LogLevel[entry.level]
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : ''
    const fullMessage = `${prefix}[${timestamp}] [${levelName}] [${entry.type}] ${entry.message}`

    switch (entry.level) {
      case LogLevel.ERROR:
        if (entry.details) {
          console.error(fullMessage, entry.details)
        } else {
          console.error(fullMessage)
        }
        break
      case LogLevel.WARN:
        if (entry.details) {
          console.warn(fullMessage, entry.details)
        } else {
          console.warn(fullMessage)
        }
        break
      case LogLevel.DEBUG:
        if (entry.details) {
          console.debug(fullMessage, entry.details)
        } else {
          console.debug(fullMessage)
        }
        break
      default:
        if (entry.details) {
          console.log(fullMessage, entry.details)
        } else {
          console.log(fullMessage)
        }
    }
  }

  /**
   * Atualizar métricas
   */
  private updateMetrics(entry: LogEntry) {
    switch (entry.type) {
      case EventType.API:
        this.metricsData.requests_total++
        if (entry.level === LogLevel.ERROR) {
          this.metricsData.requests_errors++
        }
        if (entry.duration_ms) {
          this.metricsData.response_time_avg =
            (this.metricsData.response_time_avg + entry.duration_ms) / 2
        }
        break

      case EventType.DATABASE:
        this.metricsData.database_queries++
        break
    }
  }

  // Métodos de conveniência
  error(message: string, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.ERROR, EventType.ERROR, message, details, metadata)
  }

  warn(message: string, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, EventType.SYSTEM, message, details, metadata)
  }

  info(message: string, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.SYSTEM, message, details, metadata)
  }

  debug(message: string, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.DEBUG, EventType.SYSTEM, message, details, metadata)
  }

  // Logs específicos
  auth(message: string, userId?: number, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.AUTH, message, details, { ...metadata, user_id: userId })
  }

  api(message: string, duration?: number, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.API, message, details, { ...metadata, duration_ms: duration })
  }

  security(message: string, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, EventType.SECURITY, message, details, metadata)
  }

  performance(message: string, duration: number, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.PERFORMANCE, message, details, { ...metadata, duration_ms: duration })
  }

  userAction(message: string, userId: number, details?: unknown, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.USER_ACTION, message, details, { ...metadata, user_id: userId })
  }

  /**
   * Obter métricas
   */
  getMetrics(): Metrics {
    return { ...this.metricsData }
  }

  /**
   * Destruir logger
   */
  destroy() {
    // Cleanup if needed
  }
}

// Instância global do logger
export const logger = new Logger()

// Middleware para request logging
export function createRequestLogger() {
  return function logRequest(req: { method: string; url: string; headers: { get: (name: string) => string | null } }, startTime: number) {
    const duration = Date.now() - startTime
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    logger.api(
      `${req.method} ${req.url}`,
      duration,
      {
        method: req.method,
        url: req.url,
        statusCode: 200
      },
      {
        ip_address: ip,
        user_agent: userAgent
      }
    )
  }
}

export default logger
