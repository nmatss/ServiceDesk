import db from './connection'
import { logger } from '../monitoring/logger'

interface QueryStats {
  query: string
  executionTime: number
  rowsReturned: number
  planSteps: number
}

interface IndexSuggestion {
  table: string
  columns: string[]
  reason: string
  priority: 'high' | 'medium' | 'low'
}

class DatabaseOptimizer {
  private queryCache = new Map<string, any>()
  private slowQueries: QueryStats[] = []
  private readonly SLOW_QUERY_THRESHOLD = 100 // ms

  /**
   * Executar query com análise de performance
   */
  async executeWithStats<T>(query: string, params: any[] = []): Promise<T> {
    const startTime = Date.now()

    try {
      // Verificar cache primeiro
      const cacheKey = this.generateCacheKey(query, params)
      if (this.queryCache.has(cacheKey)) {
        logger.debug('Query cache hit', { query: query.substring(0, 100) })
        return this.queryCache.get(cacheKey)
      }

      // Executar query
      const result = db.prepare(query).all(...params) as T

      const executionTime = Date.now() - startTime

      // Analisar performance
      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        await this.analyzeSlowQuery(query, params, executionTime, result)
      }

      // Cache resultado se apropriado
      if (this.shouldCache(query, executionTime)) {
        this.queryCache.set(cacheKey, result)
        // Limpar cache após 5 minutos
        setTimeout(() => this.queryCache.delete(cacheKey), 300000)
      }

      logger.debug('Query executed', {
        query: query.substring(0, 100),
        executionTime,
        rowsReturned: Array.isArray(result) ? result.length : 1
      })

      return result
    } catch (error) {
      logger.error('Query execution failed', { query, error })
      throw error
    }
  }

  /**
   * Gerar chave de cache
   */
  private generateCacheKey(query: string, params: any[]): string {
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
  private async analyzeSlowQuery(query: string, params: any[], executionTime: number, result: any) {
    try {
      // Obter plano de execução
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`
      const plan = db.prepare(explainQuery).all(...params) as any[]

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
        query: query.substring(0, 200),
        executionTime,
        planSteps: plan.length,
        plan: plan.map(p => p.detail).join(' | ')
      })

      // Sugerir otimizações
      const suggestions = this.generateOptimizationSuggestions(query, plan)
      if (suggestions.length > 0) {
        logger.info('Query optimization suggestions', { query: query.substring(0, 100), suggestions })
      }

    } catch (error) {
      logger.error('Error analyzing slow query', { query, error })
    }
  }

  /**
   * Gerar sugestões de otimização
   */
  private generateOptimizationSuggestions(query: string, plan: any[]): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = []

    // Analisar plano de execução
    for (const step of plan) {
      const detail = step.detail?.toLowerCase() || ''

      // Detectar scans em tabelas grandes
      if (detail.includes('scan table')) {
        const tableMatch = detail.match(/scan table (\w+)/)
        if (tableMatch) {
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
        if (orderByMatch) {
          const columns = orderByMatch[1].split(',').map(c => c.trim().split(' ')[0])
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
        if (groupByMatch) {
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
  private extractColumnsFromWhere(query: string, table: string): string[] {
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i)
    if (!whereMatch) return []

    const whereClause = whereMatch[1]
    const columns: string[] = []

    // Extrair colunas da condição WHERE
    const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g)
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
    return fromMatch ? fromMatch[1] : 'unknown'
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
          logger.info('Index created', { indexName, table: suggestion.table, columns: suggestion.columns })
        } catch (error) {
          logger.error('Failed to create index', { suggestion, error })
        }
      }
    }
  }

  /**
   * Analisar uso de índices existentes
   */
  analyzeIndexUsage(): any[] {
    try {
      // Obter estatísticas de índices do SQLite
      const indexes = db.prepare(`
        SELECT name, tbl_name, sql
        FROM sqlite_master
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      `).all()

      return indexes.map(index => ({
        name: index.name,
        table: index.tbl_name,
        definition: index.sql,
        // Note: SQLite não fornece estatísticas de uso de índice nativamente
        // Seria necessário usar PRAGMA ou análise de planos de execução
      }))
    } catch (error) {
      logger.error('Error analyzing index usage', error)
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
      logger.error('Database optimization failed', error)
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
      logger.error('Database integrity check failed', error)
      return {
        ok: false,
        errors: [error.message]
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
      logger.error('Error getting database size', error)
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