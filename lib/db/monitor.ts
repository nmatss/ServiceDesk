/**
 * Database Query Performance Monitor
 * Tracks slow queries, logs performance metrics, and alerts on degradation
 */

import Database from 'better-sqlite3';
import logger from '../monitoring/structured-logger';

interface QueryMetrics {
  name: string;
  sql: string;
  executionTimeMs: number;
  timestamp: Date;
  rowsReturned?: number;
  params?: unknown[];
}

interface QueryStats {
  name: string;
  count: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  p95TimeMs: number;
  lastExecuted: Date;
}

interface SlowQuery {
  name: string;
  sql: string;
  executionTimeMs: number;
  timestamp: Date;
  params?: unknown[];
  queryPlan?: string;
}

class QueryMonitor {
  private metrics: QueryMetrics[] = [];
  private slowQueries: SlowQuery[] = [];
  private queryStats = new Map<string, QueryMetrics[]>();

  // Configurações
  private slowQueryThresholdMs: number;
  private maxMetricsInMemory: number;
  private enableQueryPlanCapture: boolean;

  constructor(config?: {
    slowQueryThresholdMs?: number;
    maxMetricsInMemory?: number;
    enableQueryPlanCapture?: boolean;
  }) {
    this.slowQueryThresholdMs = config?.slowQueryThresholdMs ?? 100; // 100ms default
    this.maxMetricsInMemory = config?.maxMetricsInMemory ?? 10000;
    this.enableQueryPlanCapture = config?.enableQueryPlanCapture ?? true;
  }

  /**
   * Instrumeta uma query para monitoramento
   */
  instrumentQuery<T>(
    db: Database.Database,
    sql: string,
    params: unknown[] = [],
    options: { name?: string; threshold?: number } = {}
  ): { result: T; executionTimeMs: number } {
    const startTime = performance.now();
    const queryName = options.name || this.extractQueryName(sql);

    let result: T;
    let rowsReturned: number | undefined;

    try {
      // Executar query
      const stmt = db.prepare(sql);
      result = stmt.all(...params) as T;

      // Contar rows se for array
      if (Array.isArray(result)) {
        rowsReturned = result.length;
      }
    } catch (error) {
      const executionTimeMs = performance.now() - startTime;
      logger.error('Query execution error', {
        name: queryName,
        sql,
        params,
        executionTimeMs,
        error,
      });
      throw error;
    }

    const executionTimeMs = performance.now() - startTime;

    // Registrar métrica
    const metric: QueryMetrics = {
      name: queryName,
      sql,
      executionTimeMs,
      timestamp: new Date(),
      rowsReturned,
      params: process.env.NODE_ENV === 'development' ? params : undefined,
    };

    this.recordMetric(metric);

    // Verificar se é slow query
    const threshold = options.threshold ?? this.slowQueryThresholdMs;
    if (executionTimeMs > threshold) {
      this.recordSlowQuery(db, metric);
    }

    return { result, executionTimeMs };
  }

  /**
   * Wrapper para prepared statements
   */
  createInstrumentedStatement<P = unknown[], R = unknown>(
    db: Database.Database,
    sql: string,
    options: { name?: string; threshold?: number } = {}
  ) {
    const stmt = db.prepare(sql);
    const queryName = options.name || this.extractQueryName(sql);

    return {
      get: (...params: P extends unknown[] ? P : never): R | undefined => {
        const startTime = performance.now();
        const result = stmt.get(...(params as unknown[])) as R | undefined;
        const executionTimeMs = performance.now() - startTime;

        this.recordMetric({
          name: queryName,
          sql,
          executionTimeMs,
          timestamp: new Date(),
          rowsReturned: result ? 1 : 0,
          params: process.env.NODE_ENV === 'development' ? params : undefined,
        });

        if (executionTimeMs > (options.threshold ?? this.slowQueryThresholdMs)) {
          this.recordSlowQuery(db, {
            name: queryName,
            sql,
            executionTimeMs,
            timestamp: new Date(),
            params: process.env.NODE_ENV === 'development' ? params : undefined,
          });
        }

        return result;
      },

      all: (...params: P extends unknown[] ? P : never): R[] => {
        const startTime = performance.now();
        const result = stmt.all(...(params as unknown[])) as R[];
        const executionTimeMs = performance.now() - startTime;

        this.recordMetric({
          name: queryName,
          sql,
          executionTimeMs,
          timestamp: new Date(),
          rowsReturned: result.length,
          params: process.env.NODE_ENV === 'development' ? params : undefined,
        });

        if (executionTimeMs > (options.threshold ?? this.slowQueryThresholdMs)) {
          this.recordSlowQuery(db, {
            name: queryName,
            sql,
            executionTimeMs,
            timestamp: new Date(),
            params: process.env.NODE_ENV === 'development' ? params : undefined,
          });
        }

        return result;
      },

      run: (...params: P extends unknown[] ? P : never): Database.RunResult => {
        const startTime = performance.now();
        const result = stmt.run(...(params as unknown[]));
        const executionTimeMs = performance.now() - startTime;

        this.recordMetric({
          name: queryName,
          sql,
          executionTimeMs,
          timestamp: new Date(),
          rowsReturned: result.changes,
          params: process.env.NODE_ENV === 'development' ? params : undefined,
        });

        if (executionTimeMs > (options.threshold ?? this.slowQueryThresholdMs)) {
          this.recordSlowQuery(db, {
            name: queryName,
            sql,
            executionTimeMs,
            timestamp: new Date(),
            params: process.env.NODE_ENV === 'development' ? params : undefined,
          });
        }

        return result;
      },
    };
  }

  /**
   * Registra uma métrica
   */
  private recordMetric(metric: QueryMetrics): void {
    // Adicionar à lista geral
    this.metrics.push(metric);

    // Adicionar ao mapa de stats por query
    if (!this.queryStats.has(metric.name)) {
      this.queryStats.set(metric.name, []);
    }
    this.queryStats.get(metric.name)!.push(metric);

    // Limpar métricas antigas se exceder limite
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }
  }

  /**
   * Registra uma slow query
   */
  private recordSlowQuery(db: Database.Database, metric: QueryMetrics): void {
    const slowQuery: SlowQuery = {
      name: metric.name,
      sql: metric.sql,
      executionTimeMs: metric.executionTimeMs,
      timestamp: metric.timestamp,
      params: metric.params,
    };

    // Capturar query plan se habilitado
    if (this.enableQueryPlanCapture) {
      try {
        const plan = db.prepare(`EXPLAIN QUERY PLAN ${metric.sql}`).all();
        slowQuery.queryPlan = JSON.stringify(plan, null, 2);
      } catch (error) {
        // Ignorar erros de explain (pode falhar com queries parametrizadas)
      }
    }

    this.slowQueries.push(slowQuery);

    // Log slow query
    logger.warn('Slow query detected', {
      name: metric.name,
      executionTimeMs: metric.executionTimeMs,
      threshold: this.slowQueryThresholdMs,
      sql: metric.sql.substring(0, 200), // Truncar SQL longo
      params: metric.params,
      queryPlan: slowQuery.queryPlan,
    });

    // Limitar tamanho do array de slow queries
    if (this.slowQueries.length > 1000) {
      this.slowQueries = this.slowQueries.slice(-1000);
    }
  }

  /**
   * Extrai nome da query do SQL
   */
  private extractQueryName(sql: string): string {
    const normalized = sql.trim().toUpperCase();

    // Detectar tipo de query
    if (normalized.startsWith('SELECT')) {
      // Extrair tabela principal
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      return fromMatch ? `SELECT_${fromMatch[1]}` : 'SELECT_UNKNOWN';
    } else if (normalized.startsWith('INSERT')) {
      const intoMatch = sql.match(/INTO\s+(\w+)/i);
      return intoMatch ? `INSERT_${intoMatch[1]}` : 'INSERT_UNKNOWN';
    } else if (normalized.startsWith('UPDATE')) {
      const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
      return updateMatch ? `UPDATE_${updateMatch[1]}` : 'UPDATE_UNKNOWN';
    } else if (normalized.startsWith('DELETE')) {
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      return fromMatch ? `DELETE_${fromMatch[1]}` : 'DELETE_UNKNOWN';
    }

    return 'QUERY_UNKNOWN';
  }

  /**
   * Calcula estatísticas de uma query
   */
  private calculateStats(metrics: QueryMetrics[]): QueryStats {
    const times = metrics.map(m => m.executionTimeMs).sort((a, b) => a - b);
    const count = times.length;
    const totalTimeMs = times.reduce((sum, time) => sum + time, 0);
    const avgTimeMs = totalTimeMs / count;
    const minTimeMs = times[0] ?? 0;
    const maxTimeMs = times[count - 1] ?? 0;
    const p95Index = Math.floor(count * 0.95);
    const p95TimeMs = times[p95Index] ?? maxTimeMs;

    return {
      name: metrics[0]?.name || 'unknown',
      count,
      totalTimeMs,
      avgTimeMs,
      minTimeMs,
      maxTimeMs,
      p95TimeMs,
      lastExecuted: metrics[count - 1]?.timestamp || new Date(),
    };
  }

  /**
   * Retorna estatísticas de todas as queries
   */
  getQueryStats(): QueryStats[] {
    const stats: QueryStats[] = [];

    for (const [_name, metrics] of this.queryStats.entries()) {
      if (metrics.length > 0) {
        stats.push(this.calculateStats(metrics));
      }
    }

    // Ordenar por total time (queries mais custosas)
    return stats.sort((a, b) => b.totalTimeMs - a.totalTimeMs);
  }

  /**
   * Retorna slow queries recentes
   */
  getSlowQueries(limit = 50): SlowQuery[] {
    return this.slowQueries.slice(-limit).reverse();
  }

  /**
   * Retorna métricas recentes
   */
  getRecentMetrics(limit = 100): QueryMetrics[] {
    return this.metrics.slice(-limit).reverse();
  }

  /**
   * Limpa métricas antigas
   */
  clearMetrics(): void {
    this.metrics = [];
    this.slowQueries = [];
    this.queryStats.clear();
  }

  /**
   * Retorna resumo geral de performance
   */
  getPerformanceSummary() {
    const stats = this.getQueryStats();
    const totalQueries = this.metrics.length;
    const slowQueriesCount = this.slowQueries.length;
    const avgExecutionTime = totalQueries > 0
      ? this.metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalQueries
      : 0;

    return {
      totalQueries,
      slowQueriesCount,
      slowQueryPercentage: totalQueries > 0 ? (slowQueriesCount / totalQueries) * 100 : 0,
      avgExecutionTime,
      uniqueQueries: stats.length,
      mostExpensiveQueries: stats.slice(0, 10),
      recentSlowQueries: this.getSlowQueries(10),
    };
  }

  /**
   * Analisa query plan
   */
  analyzeQueryPlan(db: Database.Database, sql: string): {
    plan: unknown[];
    hasFullScan: boolean;
    hasIndexScan: boolean;
    warnings: string[];
  } {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    const planText = JSON.stringify(plan).toUpperCase();

    const hasFullScan = planText.includes('SCAN TABLE');
    const hasIndexScan = planText.includes('SEARCH') || planText.includes('INDEX');

    const warnings: string[] = [];

    if (hasFullScan) {
      warnings.push('Query contains full table scan - consider adding index');
    }

    if (planText.includes('TEMP B-TREE')) {
      warnings.push('Query uses temporary B-tree - may benefit from covering index');
    }

    if (planText.includes('USE TEMP')) {
      warnings.push('Query uses temporary tables - consider query optimization');
    }

    return {
      plan,
      hasFullScan,
      hasIndexScan,
      warnings,
    };
  }
}

// Singleton instance
const queryMonitor = new QueryMonitor({
  slowQueryThresholdMs: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10),
  maxMetricsInMemory: parseInt(process.env.QUERY_METRICS_MAX || '10000', 10),
  enableQueryPlanCapture: process.env.ENABLE_QUERY_PLAN_CAPTURE !== 'false',
});

export default queryMonitor;
export { QueryMonitor, type QueryMetrics, type QueryStats, type SlowQuery };
