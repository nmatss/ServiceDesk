#!/usr/bin/env tsx

/**
 * Query Performance Monitor Script
 * Displays real-time query performance metrics
 */

import queryMonitor from '../lib/db/monitor';
import queryCache from '../lib/db/query-cache';
import { pool } from '../lib/db/connection';
import { logger } from '../lib/monitoring/logger';

async function main() {
  logger.info('Database Query Performance Monitor\n');

  // Get performance summary
  const summary = queryMonitor.getPerformanceSummary();

  logger.info('=== Performance Summary ===');
  logger.info(`Total Queries: ${summary.totalQueries}`);
  logger.info(`Slow Queries: ${summary.slowQueriesCount} (${summary.slowQueryPercentage.toFixed(2)}%)`);
  logger.info(`Average Execution Time: ${summary.avgExecutionTime.toFixed(3)}ms`);
  logger.info(`Unique Queries: ${summary.uniqueQueries}\n`);

  // Most expensive queries
  if (summary.mostExpensiveQueries.length > 0) {
    logger.info('=== Most Expensive Queries ===');
    for (const query of summary.mostExpensiveQueries.slice(0, 10)) {
      logger.info(`\n${query.name}:`);
      logger.info(`  Count: ${query.count}`);
      logger.info(`  Avg: ${query.avgTime.toFixed(3)}ms`);
      logger.info(`  P95: ${query.p95TimeMs.toFixed(3)}ms`);
      logger.info(`  Total: ${query.totalTimeMs.toFixed(3)}ms`);
    }
  }

  // Recent slow queries
  if (summary.recentSlowQueries.length > 0) {
    logger.info('\n\n=== Recent Slow Queries ===');
    for (const slowQuery of summary.recentSlowQueries.slice(0, 5)) {
      logger.info(`\n${slowQuery.name}:`);
      logger.info(`  Time: ${slowQuery.executionTimeMs.toFixed(3)}ms`);
      logger.info(`  Timestamp: ${slowQuery.timestamp.toISOString()}`);
      logger.info(`  SQL: ${slowQuery.sql.substring(0, 100)}...`);
      if (slowQuery.queryPlan) {
        logger.info(`  Query Plan:\n${slowQuery.queryPlan}`);
      }
    }
  }

  // Cache statistics
  logger.info('\n\n=== Query Cache Statistics ===');
  const cacheStats = queryCache.getStats();
  logger.info(`Hit Rate: ${cacheStats.hitRate.toFixed(2)}%`);
  logger.info(`Hits: ${cacheStats.hits}`);
  logger.info(`Misses: ${cacheStats.misses}`);
  logger.info(`Entries: ${cacheStats.currentEntries}`);
  logger.info(`Size: ${(cacheStats.currentSize / 1024 / 1024).toFixed(2)}MB`);
  logger.info(`Evictions: ${cacheStats.evictions}`);

  // Connection pool statistics
  logger.info('\n=== Connection Pool Statistics ===');
  const poolStats = pool.getStats();
  logger.info(`Total Connections: ${poolStats.total}`);
  logger.info(`In Use: ${poolStats.inUse}`);
  logger.info(`Available: ${poolStats.available}`);
  logger.info(`Pool Efficiency: ${((poolStats.inUse / poolStats.total) * 100).toFixed(2)}%`);

  logger.info('\n✅ Monitoring complete!');
}

main();
