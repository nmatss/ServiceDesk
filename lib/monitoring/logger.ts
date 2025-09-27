import fs from 'fs'
import path from 'path'
import db from '../db/connection'

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
  details?: any
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
  enableDatabase: boolean
  enableFile: boolean
  logDirectory: string
  maxFileSize: number
  maxFiles: number
  metricsInterval: number
}

const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: process.env.NODE_ENV !== 'production',
  enableDatabase: true,
  enableFile: process.env.NODE_ENV === 'production',
  logDirectory: path.join(process.cwd(), 'logs'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  metricsInterval: 60000 // 1 minuto
}

class Logger {
  private config: LoggerConfig
  private metricsData: Metrics
  private metricsInterval?: NodeJS.Timeout

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

    this.initDatabase()
    this.initFileSystem()
    this.startMetricsCollection()
  }

  /**
   * Inicializar tabela de logs
   */
  private initDatabase() {
    if (!this.config.enableDatabase) return

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME NOT NULL,
          level INTEGER NOT NULL,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          user_id INTEGER,
          tenant_id INTEGER,
          ip_address TEXT,
          user_agent TEXT,
          request_id TEXT,
          duration_ms INTEGER,
          stack_trace TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Índices para performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
        CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
        CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
      `)

      // Tabela de métricas
      db.exec(`
        CREATE TABLE IF NOT EXISTS metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME NOT NULL,
          metric_name TEXT NOT NULL,
          metric_value REAL NOT NULL,
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
      `)
    } catch (error) {
      console.error('Error initializing logs database:', error)
    }
  }

  /**
   * Inicializar sistema de arquivos para logs
   */
  private initFileSystem() {
    if (!this.config.enableFile) return

    try {
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true })
      }
    } catch (error) {
      console.error('Error creating log directory:', error)
    }
  }

  /**
   * Iniciar coleta de métricas
   */
  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics()
    }, this.config.metricsInterval)
  }

  /**
   * Log principal
   */
  log(level: LogLevel, type: EventType, message: string, details?: any, metadata?: Partial<LogEntry>) {
    if (level > this.config.level) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      details: details ? JSON.stringify(details) : undefined,
      ...metadata
    }

    // Console log
    if (this.config.enableConsole) {
      this.logToConsole(entry)
    }

    // Database log
    if (this.config.enableDatabase) {
      this.logToDatabase(entry)
    }

    // File log
    if (this.config.enableFile) {
      this.logToFile(entry)
    }

    // Update metrics
    this.updateMetrics(entry)
  }

  /**
   * Log para console
   */
  private logToConsole(entry: LogEntry) {
    const levelName = LogLevel[entry.level]
    const timestamp = new Date(entry.timestamp).toLocaleString()
    const prefix = `[${timestamp}] [${levelName}] [${entry.type}]`

    const message = `${prefix} ${entry.message}`

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, entry.details ? JSON.parse(entry.details) : '')
        break
      case LogLevel.WARN:
        console.warn(message, entry.details ? JSON.parse(entry.details) : '')
        break
      case LogLevel.DEBUG:
        console.debug(message, entry.details ? JSON.parse(entry.details) : '')
        break
      default:
        console.log(message, entry.details ? JSON.parse(entry.details) : '')
    }
  }

  /**
   * Log para database
   */
  private async logToDatabase(entry: LogEntry) {
    try {
      db.prepare(`
        INSERT INTO logs (timestamp, level, type, message, details, user_id, tenant_id, ip_address, user_agent, request_id, duration_ms, stack_trace)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.timestamp,
        entry.level,
        entry.type,
        entry.message,
        entry.details,
        entry.user_id,
        entry.tenant_id,
        entry.ip_address,
        entry.user_agent,
        entry.request_id,
        entry.duration_ms,
        entry.stack_trace
      )
    } catch (error) {
      console.error('Error saving log to database:', error)
    }
  }

  /**
   * Log para arquivo
   */
  private logToFile(entry: LogEntry) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const filename = path.join(this.config.logDirectory, `app-${today}.log`)

      const logLine = JSON.stringify(entry) + '\n'

      fs.appendFileSync(filename, logLine)

      // Rotacionar arquivos se necessário
      this.rotateLogFiles(filename)
    } catch (error) {
      console.error('Error writing log to file:', error)
    }
  }

  /**
   * Rotacionar arquivos de log
   */
  private rotateLogFiles(filename: string) {
    try {
      const stats = fs.statSync(filename)
      if (stats.size > this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const rotatedFilename = filename.replace('.log', `-${timestamp}.log`)
        fs.renameSync(filename, rotatedFilename)

        // Remover arquivos antigos
        const files = fs.readdirSync(this.config.logDirectory)
          .filter(f => f.endsWith('.log'))
          .map(f => ({
            name: f,
            path: path.join(this.config.logDirectory, f),
            time: fs.statSync(path.join(this.config.logDirectory, f)).mtime
          }))
          .sort((a, b) => b.time.getTime() - a.time.getTime())

        if (files.length > this.config.maxFiles) {
          files.slice(this.config.maxFiles).forEach(file => {
            fs.unlinkSync(file.path)
          })
        }
      }
    } catch (error) {
      console.error('Error rotating log files:', error)
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

  /**
   * Coletar métricas do sistema
   */
  private collectSystemMetrics() {
    try {
      // Usuários ativos (últimos 5 minutos)
      const activeUsers = db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM logs
        WHERE timestamp > datetime('now', '-5 minutes')
        AND user_id IS NOT NULL
      `).get() as { count: number }

      this.metricsData.active_users = activeUsers.count

      // Salvar métricas no banco
      this.saveMetrics()
    } catch (error) {
      console.error('Error collecting system metrics:', error)
    }
  }

  /**
   * Salvar métricas no banco
   */
  private saveMetrics() {
    try {
      const timestamp = new Date().toISOString()

      for (const [name, value] of Object.entries(this.metricsData)) {
        db.prepare(`
          INSERT INTO metrics (timestamp, metric_name, metric_value)
          VALUES (?, ?, ?)
        `).run(timestamp, name, value)
      }
    } catch (error) {
      console.error('Error saving metrics:', error)
    }
  }

  // Métodos de conveniência
  error(message: string, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.ERROR, EventType.ERROR, message, details, metadata)
  }

  warn(message: string, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, EventType.SYSTEM, message, details, metadata)
  }

  info(message: string, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.SYSTEM, message, details, metadata)
  }

  debug(message: string, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.DEBUG, EventType.SYSTEM, message, details, metadata)
  }

  // Logs específicos
  auth(message: string, userId?: number, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.AUTH, message, details, { ...metadata, user_id: userId })
  }

  api(message: string, duration?: number, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.API, message, details, { ...metadata, duration_ms: duration })
  }

  security(message: string, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, EventType.SECURITY, message, details, metadata)
  }

  performance(message: string, duration: number, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.PERFORMANCE, message, details, { ...metadata, duration_ms: duration })
  }

  userAction(message: string, userId: number, details?: any, metadata?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, EventType.USER_ACTION, message, details, { ...metadata, user_id: userId })
  }

  /**
   * Buscar logs com filtros
   */
  getLogs(filters: {
    startDate?: string
    endDate?: string
    level?: LogLevel
    type?: EventType
    userId?: number
    limit?: number
    offset?: number
  } = {}) {
    try {
      let query = 'SELECT * FROM logs WHERE 1=1'
      const params: any[] = []

      if (filters.startDate) {
        query += ' AND timestamp >= ?'
        params.push(filters.startDate)
      }

      if (filters.endDate) {
        query += ' AND timestamp <= ?'
        params.push(filters.endDate)
      }

      if (filters.level !== undefined) {
        query += ' AND level = ?'
        params.push(filters.level)
      }

      if (filters.type) {
        query += ' AND type = ?'
        params.push(filters.type)
      }

      if (filters.userId) {
        query += ' AND user_id = ?'
        params.push(filters.userId)
      }

      query += ' ORDER BY timestamp DESC'

      if (filters.limit) {
        query += ' LIMIT ?'
        params.push(filters.limit)
      }

      if (filters.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }

      return db.prepare(query).all(...params)
    } catch (error) {
      console.error('Error getting logs:', error)
      return []
    }
  }

  /**
   * Obter métricas
   */
  getMetrics(hours: number = 24): Metrics {
    try {
      const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString()

      const metrics = db.prepare(`
        SELECT metric_name, AVG(metric_value) as avg_value
        FROM metrics
        WHERE timestamp >= ?
        GROUP BY metric_name
      `).all(startTime) as { metric_name: string; avg_value: number }[]

      const result: Partial<Metrics> = {}
      metrics.forEach(m => {
        result[m.metric_name as keyof Metrics] = Math.round(m.avg_value)
      })

      return { ...this.metricsData, ...result }
    } catch (error) {
      console.error('Error getting metrics:', error)
      return this.metricsData
    }
  }

  /**
   * Cleanup logs antigos
   */
  cleanup(daysToKeep: number = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)).toISOString()

      const logsDeleted = db.prepare(`
        DELETE FROM logs WHERE timestamp < ?
      `).run(cutoffDate)

      const metricsDeleted = db.prepare(`
        DELETE FROM metrics WHERE timestamp < ?
      `).run(cutoffDate)

      this.info('Log cleanup completed', {
        logsDeleted: logsDeleted.changes,
        metricsDeleted: metricsDeleted.changes,
        cutoffDate
      })
    } catch (error) {
      this.error('Error during log cleanup', error)
    }
  }

  /**
   * Destruir logger
   */
  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
  }
}

// Instância global do logger
export const logger = new Logger()

// Middleware para request logging
export function createRequestLogger() {
  return function logRequest(req: any, startTime: number) {
    const duration = Date.now() - startTime
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    logger.api(
      `${req.method} ${req.url}`,
      duration,
      {
        method: req.method,
        url: req.url,
        statusCode: 200 // Será atualizado se houver erro
      },
      {
        ip_address: ip,
        user_agent: userAgent
      }
    )
  }
}

export default logger