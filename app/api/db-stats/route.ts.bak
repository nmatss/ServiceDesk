/**
 * Database Performance Statistics API
 * Exposes query performance metrics, cache stats, and pool stats
 */

import { NextResponse } from 'next/server';
import queryMonitor from '@/lib/db/monitor';
import queryCache from '@/lib/db/query-cache';
import { pool } from '@/lib/db/connection';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Query monitor stats
    const querySummary = queryMonitor.getPerformanceSummary();
    const queryStats = queryMonitor.getQueryStats().slice(0, 10);
    const slowQueries = queryMonitor.getSlowQueries(10);

    // Cache stats
    const cacheStats = queryCache.getStats();
    const cacheInfo = queryCache.getDetailedInfo();

    // Pool stats
    const poolStats = pool.getStats();

    // Database stats
    const dbStats = await pool.execute((db) => {
      const tables = ['tickets', 'users', 'comments', 'notifications', 'sla_tracking'];
      const stats: Record<string, { count: number; size?: number }> = {};

      for (const table of tables) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
          count: number;
        };
        stats[table] = { count: count.count };
      }

      return stats;
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      query: {
        summary: {
          totalQueries: querySummary.totalQueries,
          slowQueries: querySummary.slowQueriesCount,
          slowQueryPercentage: querySummary.slowQueryPercentage,
          avgExecutionTime: querySummary.avgExecutionTime,
          uniqueQueries: querySummary.uniqueQueries,
        },
        topQueries: queryStats.map((q) => ({
          name: q.name,
          count: q.count,
          avgTime: q.avgTimeMs,
          p95Time: q.p95TimeMs,
          totalTime: q.totalTimeMs,
        })),
        recentSlowQueries: slowQueries.map((q) => ({
          name: q.name,
          executionTime: q.executionTimeMs,
          timestamp: q.timestamp,
        })),
      },
      cache: {
        stats: {
          hitRate: cacheStats.hitRate,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          sets: cacheStats.sets,
          evictions: cacheStats.evictions,
          currentEntries: cacheStats.currentEntries,
          currentSizeMB: (cacheStats.currentSize / 1024 / 1024).toFixed(2),
        },
        mostAccessed: cacheInfo.mostAccessed.slice(0, 10).map((entry) => ({
          key: entry.key,
          accessCount: entry.accessCount,
          sizeMB: (entry.size / 1024 / 1024).toFixed(4),
        })),
      },
      pool: {
        total: poolStats.total,
        inUse: poolStats.inUse,
        available: poolStats.available,
        efficiency: ((poolStats.inUse / poolStats.total) * 100).toFixed(2) + '%',
        config: poolStats.config,
      },
      database: {
        tables: dbStats,
      },
      health: {
        status: 'healthy',
        checks: {
          queryPerformance: querySummary.slowQueryPercentage < 10 ? 'ok' : 'warning',
          cacheEfficiency: cacheStats.hitRate > 70 ? 'ok' : 'warning',
          poolEfficiency: (poolStats.inUse / poolStats.total) > 0.8 ? 'warning' : 'ok',
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch database stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database statistics' },
      { status: 500 }
    );
  }
}
