import db from './connection'
import { logger } from '../monitoring/logger'
import { cacheStrategy, CacheOptions } from '../cache/strategy'

interface QueryStats {
  query: string
  executionTime: number
  rowsReturned: number
  planSteps: number
  cacheHit?: boolean
}

interface IndexSuggestion {
  table: string
  columns: string[]
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface ConnectionPoolStats {
  active: number
  idle: number
  total: number
  waitingRequests: number
}

interface QueryCacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  hitRate: number
}

interface CachedQueryResult {
  data: unknown
  timestamp: number
  ttl: number
}

interface ExplainPlanRow {
  id: number
  parent: number
  notused: number
  detail: string
}

interface IndexRow {
  name: string
  tbl_name: string
  sql: string | null
}

interface IndexUsageResult {
  name: string
  table: string
  definition: string | null
}

class DatabaseOptimizer {
  private queryCache = new Map<string, CachedQueryResult>()
  private slowQueries: QueryStats[] = []
  private readonly SLOW_QUERY_THRESHOLD = 100 // ms
  private cacheHits = 0
  private cacheMisses = 0
  private cacheEvictions = 0

  // Connection pool simulation (SQLite doesn't have true pooling, but we track usage)
  private activeConnections = 0
  private maxConnections = 10
  private connectionQueue: Array<() => void> = []

  /**
   * Executar query com análise de performance e multi-layer caching
   */
  async executeWithStats<T>(
    query: string,
    params: unknown[] = [],
    cacheOptions?: CacheOptions
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // Verificar cache multi-layer (L1 memory -> L2 Redis)
      const cacheKey = this.generateCacheKey(query, params)

      // Try multi-layer cache first
      const cachedResult = await cacheStrategy.get<T>(cacheKey)
      if (cachedResult !== null) {
        this.cacheHits++
        const executionTime = Date.now() - startTime
        logger.debug('Query cache hit (multi-layer)', {
          query: query.substring(0, 100),
          time: executionTime,
        })

        // Track as cache hit
        this.slowQueries.push({
          query,
          executionTime,
          rowsReturned: Array.isArray(cachedResult) ? cachedResult.length : 1,
          planSteps: 0,
          cacheHit: true,
        })

        return cachedResult
      }

      this.cacheMisses++

      // Acquire connection from pool
      await this.acquireConnection()

      try {
        // Executar query
        const result = db.prepare(query).all(...params) as T

        const executionTime = Date.now() - startTime

        // Analisar performance
        if (executionTime > this.SLOW_QUERY_THRESHOLD) {
          await this.analyzeSlowQuery(query, params, executionTime, result)
        }

        // Cache resultado com multi-layer strategy
        if (this.shouldCache(query, executionTime)) {
          const ttl = this.calculateOptimalTTL(query, executionTime)
          await cacheStrategy.set(cacheKey, result, {
            ttl,
            tags: this.extractCacheTags(query),
            ...cacheOptions,
          })
        }

        logger.debug('Query executed', {
          query: query.substring(0, 100),
          executionTime,
          rowsReturned: Array.isArray(result) ? result.length : 1,
        })

        return result
      } finally {
        // Release connection
        this.releaseConnection()
      }
    } catch (error) {
      logger.error('Query execution failed', error as Error, { details: { query } })
      throw error
    }
  }

  /**
   * Acquire connection from pool
   */
  private async acquireConnection(): Promise<void> {
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++
      return Promise.resolve()
    }

    // Wait for available connection
    return new Promise((resolve) => {
      this.connectionQueue.push(resolve)
    })
  }

  /**
   * Release connection back to pool
   */
  private releaseConnection(): void {
    if (this.connectionQueue.length > 0) {
      const nextInQueue = this.connectionQueue.shift()
      if (nextInQueue) {
        nextInQueue()
      }
    } else {
      this.activeConnections = Math.max(0, this.activeConnections - 1)
    }
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): ConnectionPoolStats {
    return {
      active: this.activeConnections,
      idle: Math.max(0, this.maxConnections - this.activeConnections),
      total: this.maxConnections,
      waitingRequests: this.connectionQueue.length,
    }
  }

  /**
   * Calculate optimal TTL based on query characteristics
   */
  private calculateOptimalTTL(query: string, executionTime: number): number {
    const lowerQuery = query.toLowerCase()

    // Static reference data - cache longer
    if (
      lowerQuery.includes('categories') ||
      lowerQuery.includes('priorities') ||
      lowerQuery.includes('statuses')
    ) {
      return 3600 // 1 hour
    }

    // Slow queries - cache longer to avoid repeated expensive operations
    if (executionTime > 500) {
      return 900 // 15 minutes
    }

    // Analytics/aggregations - medium TTL
    if (lowerQuery.includes('count') || lowerQuery.includes('group by')) {
      return 300 // 5 minutes
    }

    // Default TTL
    return 180 // 3 minutes
  }

  /**
   * Extract cache tags from query for invalidation
   */
  private extractCacheTags(query: string): string[] {
    const tags: string[] = []
    const lowerQuery = query.toLowerCase()

    // Extract table names as tags
    const tables = [
      'tickets',
      'users',
      'categories',
      'priorities',
      'statuses',
      'comments',
      'attachments',
      'kb_articles',
    ]

    for (const table of tables) {
      if (lowerQuery.includes(table)) {
        tags.push(table)
      }
    }

    return tags
  }

  /**
   * Invalidate cache by table name
   */
  async invalidateCache(table: string): Promise<void> {
    await cacheStrategy.invalidateByTag(table)
    logger.info('Cache invalidated', { table })
  }

  /**
   * Get query cache statistics
   */
  getQueryCacheStats(): QueryCacheStats {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      evictions: this.cacheEvictions,
      size: this.queryCache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    }
  }

  /**
   * Gerar chave de cache
   */
  private generateCacheKey(query: string, params: unknown[]): string {
    return Buffer.from(query + JSON.stringify(params)).toString('base64')
  }

  /**
   * Verificar se deve fazer cache da query
   */
  private shouldCache(query: string, executionTime: number): boolean {
    // Cache SELECT queries que demoram mais que 50ms
    return query.trim().toLowerCase().startsWith('select') && executionTime > 50
  }

  /**
   * Analisar query lenta
   */
  private async analyzeSlowQuery(query: string, params: unknown[], executionTime: number, result: unknown): Promise<void> {
    try {
      // Obter plano de execução
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`
      const plan = db.prepare(explainQuery).all(...params) as ExplainPlanRow[]

      const stats: QueryStats = {
        query,
        executionTime,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        planSteps: plan.length
      }

      this.slowQueries.push(stats)

      // Manter apenas as últimas 100 queries lentas
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift()
      }

      logger.warn('Slow query detected', {
        details: {
          query: query.substring(0, 200),
          executionTime,
          planSteps: plan.length,
          plan: plan.map(p => p.detail).join(' | ')
        }
      })

      // Sugerir otimizações
      const suggestions = this.generateOptimizationSuggestions(query, plan)
      if (suggestions.length > 0) {
        logger.info('Query optimization suggestions', {
          details: {
            query: query.substring(0, 100),
            suggestions
          }
        })
      }

    } catch (error) {
      logger.error('Error analyzing slow query', error as Error, { details: { query } })
    }
  }

  /**
   * Gerar sugestões de otimização
   */
  private generateOptimizationSuggestions(query: string, plan: ExplainPlanRow[]): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = []

    // Analisar plano de execução
    for (const step of plan) {
      const detail = step.detail?.toLowerCase() || ''

      // Detectar scans em tabelas grandes
      if (detail.includes('scan table')) {
        const tableMatch = detail.match(/scan table (\w+)/)
        if (tableMatch && tableMatch[1]) {
          const table = tableMatch[1]
          suggestions.push({
            table,
            columns: this.extractColumnsFromWhere(query, table),
            reason: 'Table scan detected - consider adding index',
            priority: 'high'
          })
        }
      }

      // Detectar ordenação sem índice
      if (detail.includes('use temp b-tree for order by')) {
        const orderByMatch = query.match(/order by\s+([\w\s,]+)/i)
        if (orderByMatch && orderByMatch[1]) {
          const columns = orderByMatch[1].split(',').map(c => c.trim().split(' ')[0] ?? '')
          suggestions.push({
            table: this.extractTableFromQuery(query),
            columns,
            reason: 'Temporary B-tree for ORDER BY - consider adding index',
            priority: 'medium'
          })
        }
      }

      // Detectar GROUP BY sem índice
      if (detail.includes('use temp b-tree for group by')) {
        const groupByMatch = query.match(/group by\s+([\w\s,]+)/i)
        if (groupByMatch && groupByMatch[1]) {
          const columns = groupByMatch[1].split(',').map(c => c.trim())
          suggestions.push({
            table: this.extractTableFromQuery(query),
            columns,
            reason: 'Temporary B-tree for GROUP BY - consider adding index',
            priority: 'medium'
          })
        }
      }
    }

    return suggestions
  }

  /**
   * Extrair colunas da cláusula WHERE
   */
  private extractColumnsFromWhere(query: string, _table: string): string[] {
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i)
    if (!whereMatch) return []

    const whereClause = whereMatch[1]
    const columns: string[] = []

    // Extrair colunas da condição WHERE
    const columnMatches = whereClause?.match(/(\w+)\s*[=<>!]/g)
    if (columnMatches) {
      columns.push(...columnMatches.map(m => m.replace(/\s*[=<>!].*/, '')))
    }

    return [...new Set(columns)] // Remove duplicatas
  }

  /**
   * Extrair tabela principal da query
   */
  private extractTableFromQuery(query: string): string {
    const fromMatch = query.match(/from\s+(\w+)/i)
    return fromMatch?.[1] ?? 'unknown'
  }

  /**
   * Criar índices sugeridos
   */
  async createSuggestedIndexes(suggestions: IndexSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      if (suggestion.priority === 'high') {
        try {
          const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`
          const createIndexQuery = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${suggestion.table}(${suggestion.columns.join(', ')})`

          db.exec(createIndexQuery)
          logger.info('Index created', {
            details: {
              indexName,
              table: suggestion.table,
              columns: suggestion.columns
            }
          })
        } catch (error) {
          logger.error('Failed to create index', error as Error, {
            details: { suggestion }
          })
        }
      }
    }
  }

  /**
   * Analisar uso de índices existentes
   */
  analyzeIndexUsage(): IndexUsageResult[] {
    try {
      // Obter estatísticas de índices do SQLite
      const indexes = db.prepare(`
        SELECT name, tbl_name, sql
        FROM sqlite_master
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      `).all() as IndexRow[]

      return indexes.map(index => ({
        name: index.name,
        table: index.tbl_name,
        definition: index.sql,
        // Note: SQLite não fornece estatísticas de uso de índice nativamente
        // Seria necessário usar PRAGMA ou análise de planos de execução
      }))
    } catch (error) {
      logger.error('Error analyzing index usage', error as Error)
      return []
    }
  }

  /**
   * Otimizar tabelas (VACUUM e ANALYZE)
   */
  async optimizeTables(): Promise<void> {
    try {
      logger.info('Starting database optimization')

      // ANALYZE para atualizar estatísticas
      db.exec('ANALYZE')
      logger.info('Database analysis completed')

      // VACUUM para desfragmentar (cuidado em produção)
      if (process.env.NODE_ENV !== 'production') {
        db.exec('VACUUM')
        logger.info('Database vacuum completed')
      }

      // Recriar estatísticas para todas as tabelas
      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[]

      for (const table of tables) {
        db.exec(`ANALYZE ${table.name}`)
      }

      logger.info('Database optimization completed', { tablesAnalyzed: tables.length })
    } catch (error) {
      logger.error('Database optimization failed', error as Error)
    }
  }

  /**
   * Verificar integridade do banco
   */
  async checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
    try {
      const result = db.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[]

      const errors = result
        .map(r => r.integrity_check)
        .filter(msg => msg !== 'ok')

      logger.info('Database integrity check', {
        status: errors.length === 0 ? 'ok' : 'errors_found',
        errorCount: errors.length
      })

      return {
        ok: errors.length === 0,
        errors
      }
    } catch (error) {
      logger.error('Database integrity check failed', error as Error)
      return {
        ok: false,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Obter estatísticas de performance
   */
  getPerformanceStats(): {
    slowQueries: QueryStats[]
    averageQueryTime: number
    cacheHitRate: number
    totalQueries: number
  } {
    const averageTime = this.slowQueries.length > 0
      ? this.slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / this.slowQueries.length
      : 0

    return {
      slowQueries: this.slowQueries.slice(-10), // Últimas 10
      averageQueryTime: Math.round(averageTime),
      cacheHitRate: 0, // Seria necessário implementar tracking
      totalQueries: this.slowQueries.length
    }
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.queryCache.clear()
    logger.info('Query cache cleared')
  }

  /**
   * Obter tamanho do banco de dados
   */
  getDatabaseSize(): { pageCount: number; pageSize: number; sizeBytes: number; sizeMB: number } {
    try {
      const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number }
      const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number }

      const sizeBytes = pageCount.page_count * pageSize.page_size
      const sizeMB = Math.round((sizeBytes / 1024 / 1024) * 100) / 100

      return {
        pageCount: pageCount.page_count,
        pageSize: pageSize.page_size,
        sizeBytes,
        sizeMB
      }
    } catch (error) {
      logger.error('Error getting database size', error as Error)
      return { pageCount: 0, pageSize: 0, sizeBytes: 0, sizeMB: 0 }
    }
  }
}

// Instância global do otimizador
export const dbOptimizer = new DatabaseOptimizer()

// Executar otimização automática a cada hora
setInterval(() => {
  dbOptimizer.optimizeTables()
}, 60 * 60 * 1000)

export default dbOptimizer