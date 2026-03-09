/**
 * Query Performance Monitoring
 *
 * Agent 13: Database Optimization
 * Created: 2025-12-25
 *
 * Provides performance monitoring for database queries:
 * - Tracks query execution time
 * - Logs slow queries (>100ms)
 * - Helps identify performance bottlenecks
 * - No production impact - minimal overhead
 *
 * Usage:
 * ```typescript
 * import { wrapQuery } from '@/lib/db/query-monitor';
 *
 * export function getExpensiveData(orgId: number) {
 *   return wrapQuery('getExpensiveData', () => {
 *     return db.prepare('SELECT ...').all(orgId);
 *   });
 * }
 * ```
 */

import { db } from './connection';
import logger from '@/lib/monitoring/structured-logger';

/**
 * Threshold for slow query warnings (milliseconds)
 * Queries exceeding this will be logged as slow
 */
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10);

/**
 * Enable/disable query monitoring
 * Set to false in production to reduce logging overhead
 */
const MONITORING_ENABLED = process.env.QUERY_MONITORING !== 'false';

/**
 * Query performance statistics
 */
interface QueryStats {
  name: string;
  totalCalls: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  slowQueries: number;
}

/**
 * In-memory query statistics
 */
const queryStats = new Map<string, QueryStats>();

/**
 * Wrap a query function with performance monitoring
 *
 * @param queryName - Descriptive name for the query (for logging)
 * @param queryFn - The query function to execute
 * @returns Query result
 *
 * @example
 * ```typescript
 * const users = await wrapQuery('getAllUsers', () => {
 *   return db.prepare('SELECT * FROM users').all();
 * });
 * ```
 */
export function wrapQuery<T>(
  queryName: string,
  queryFn: () => T | Promise<T>
): T | Promise<T> {
  // Skip monitoring if disabled
  if (!MONITORING_ENABLED) {
    return queryFn();
  }

  const start = Date.now();

  // Handle both sync and async queries
  const result = queryFn();

  // If promise, wait for completion
  if (result instanceof Promise) {
    return result.then(data => {
      trackQueryPerformance(queryName, Date.now() - start);
      return data;
    }).catch(error => {
      logger.error(`Query failed: ${queryName}`, error);
      throw error;
    });
  }

  // Sync query
  trackQueryPerformance(queryName, Date.now() - start);
  return result;
}

/**
 * Track query performance metrics
 */
function trackQueryPerformance(queryName: string, duration: number) {
  // Update statistics
  const stats = queryStats.get(queryName) || {
    name: queryName,
    totalCalls: 0,
    totalTime: 0,
    averageTime: 0,
    minTime: Infinity,
    maxTime: 0,
    slowQueries: 0
  };

  stats.totalCalls++;
  stats.totalTime += duration;
  stats.averageTime = stats.totalTime / stats.totalCalls;
  stats.minTime = Math.min(stats.minTime, duration);
  stats.maxTime = Math.max(stats.maxTime, duration);

  if (duration > SLOW_QUERY_THRESHOLD) {
    stats.slowQueries++;
  }

  queryStats.set(queryName, stats);

  // Log slow queries
  if (duration > SLOW_QUERY_THRESHOLD) {
    logger.warn(
      `SLOW QUERY: ${queryName} (${duration}ms) - ` +
      `Threshold: ${SLOW_QUERY_THRESHOLD}ms | ` +
      `Avg: ${stats.averageTime.toFixed(1)}ms | ` +
      `Max: ${stats.maxTime}ms`
    );
  } else if (process.env.NODE_ENV === 'development') {
    logger.info(`${queryName}: ${duration}ms`);
  }
}

/**
 * Get query statistics for a specific query
 */
export function getQueryStats(queryName: string): QueryStats | undefined {
  return queryStats.get(queryName);
}

/**
 * Get all query statistics
 */
export function getAllQueryStats(): QueryStats[] {
  return Array.from(queryStats.values()).sort((a, b) => b.totalTime - a.totalTime);
}

/**
 * Print performance summary
 */
export function printQueryStats() {
  const stats = getAllQueryStats();
  const totalQueries = stats.reduce((sum, s) => sum + s.totalCalls, 0);
  const totalTime = stats.reduce((sum, s) => sum + s.totalTime, 0);
  const totalSlow = stats.reduce((sum, s) => sum + s.slowQueries, 0);

  logger.info('QUERY PERFORMANCE SUMMARY', {
    totalQueries,
    totalTime: `${totalTime.toFixed(0)}ms`,
    slowQueries: `${totalSlow} (${totalQueries > 0 ? ((totalSlow / totalQueries) * 100).toFixed(1) : 0}%)`,
    topQueries: stats.slice(0, 20).map(s => ({
      name: s.name,
      calls: s.totalCalls,
      avgMs: s.averageTime.toFixed(1),
      maxMs: s.maxTime.toFixed(0),
      slow: s.slowQueries,
    })),
  });
}

/**
 * Reset query statistics
 */
export function resetQueryStats() {
  queryStats.clear();
  logger.info('Query statistics reset');
}

/**
 * Analyze database query plan (SQLite EXPLAIN QUERY PLAN)
 *
 * @param sql - SQL query to analyze
 * @param params - Query parameters
 */
export function explainQuery(sql: string, params: any[] = []) {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);

  logger.info('QUERY PLAN ANALYSIS', {
    sql,
    params,
    plan: (plan as any[]).map(row => row.detail),
  });
}

/**
 * Get database statistics
 */
export function getDatabaseStats() {
  const stats = {
    tableCount: db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type = 'table'
    `).get() as { count: number },

    indexCount: db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type = 'index'
    `).get() as { count: number },

    databaseSize: db.prepare(`
      SELECT page_count * page_size as size
      FROM pragma_page_count(), pragma_page_size()
    `).get() as { size: number },

    tables: db.prepare(`
      SELECT name, (
        SELECT COUNT(*) FROM sqlite_master sm2
        WHERE sm2.type = 'index'
          AND sm2.tbl_name = sm.name
      ) as index_count
      FROM sqlite_master sm
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string; index_count: number }>
  };

  logger.info('DATABASE STATISTICS', {
    tables: stats.tableCount.count,
    indexes: stats.indexCount.count,
    sizeMB: (stats.databaseSize.size / 1024 / 1024).toFixed(2),
    tableDetails: stats.tables.map(t => ({ name: t.name, indexes: t.index_count })),
  });

  return stats;
}

// Export for use in scripts
if (typeof module !== 'undefined' && require.main === module) {
  // Run database stats when executed directly
  getDatabaseStats();
}
