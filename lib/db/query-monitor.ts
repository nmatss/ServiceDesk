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
      console.error(`❌ Query failed: ${queryName}`, error);
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
    console.warn(
      `🐌 SLOW QUERY: ${queryName} (${duration}ms) - ` +
      `Threshold: ${SLOW_QUERY_THRESHOLD}ms | ` +
      `Avg: ${stats.averageTime.toFixed(1)}ms | ` +
      `Max: ${stats.maxTime}ms`
    );
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`✅ ${queryName}: ${duration}ms`);
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
  console.log('\n📊 QUERY PERFORMANCE SUMMARY\n');
  console.log('=' .repeat(80));
  console.log(
    'Query'.padEnd(35) +
    'Calls'.padEnd(8) +
    'Avg (ms)'.padEnd(10) +
    'Min (ms)'.padEnd(10) +
    'Max (ms)'.padEnd(10) +
    'Slow'
  );
  console.log('=' .repeat(80));

  const stats = getAllQueryStats();

  for (const stat of stats.slice(0, 20)) {
    console.log(
      stat.name.padEnd(35) +
      stat.totalCalls.toString().padEnd(8) +
      stat.averageTime.toFixed(1).padEnd(10) +
      stat.minTime.toFixed(0).padEnd(10) +
      stat.maxTime.toFixed(0).padEnd(10) +
      stat.slowQueries.toString()
    );
  }

  console.log('=' .repeat(80));

  const totalQueries = stats.reduce((sum, s) => sum + s.totalCalls, 0);
  const totalTime = stats.reduce((sum, s) => sum + s.totalTime, 0);
  const totalSlow = stats.reduce((sum, s) => sum + s.slowQueries, 0);

  console.log(`Total queries: ${totalQueries}`);
  console.log(`Total time: ${totalTime.toFixed(0)}ms`);
  console.log(`Slow queries: ${totalSlow} (${((totalSlow / totalQueries) * 100).toFixed(1)}%)`);
  console.log('\n');
}

/**
 * Reset query statistics
 */
export function resetQueryStats() {
  queryStats.clear();
  console.log('🔄 Query statistics reset');
}

/**
 * Analyze database query plan (SQLite EXPLAIN QUERY PLAN)
 *
 * @param sql - SQL query to analyze
 * @param params - Query parameters
 */
export function explainQuery(sql: string, params: any[] = []) {
  console.log('\n🔍 QUERY PLAN ANALYSIS\n');
  console.log('SQL:', sql);
  console.log('Params:', params);
  console.log('\n');

  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);

  console.log('Execution Plan:');
  for (const row of plan as any[]) {
    console.log(`  ${row.detail}`);
  }

  console.log('\n');
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

  console.log('\n📈 DATABASE STATISTICS\n');
  console.log(`Tables: ${stats.tableCount.count}`);
  console.log(`Indexes: ${stats.indexCount.count}`);
  console.log(`Size: ${(stats.databaseSize.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nTables with index counts:');

  for (const table of stats.tables) {
    console.log(`  ${table.name}: ${table.index_count} indexes`);
  }

  console.log('\n');

  return stats;
}

// Export for use in scripts
if (typeof module !== 'undefined' && require.main === module) {
  // Run database stats when executed directly
  getDatabaseStats();
}
