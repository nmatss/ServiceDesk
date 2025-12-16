/**
 * Cache Monitoring and Metrics
 *
 * Comprehensive metrics collection and monitoring for cache performance.
 *
 * Metrics tracked:
 * - Hit/miss rates
 * - Latency (P50, P95, P99)
 * - Memory usage
 * - Eviction rates
 * - Operation counts
 * - Error rates
 *
 * Export formats:
 * - Prometheus
 * - JSON
 * - Custom dashboards
 */

import { getCacheManager } from './cache-manager';
import { getRedisClient } from './redis-client';
import { getCacheInvalidator } from './invalidation';
import { getSessionManager } from './sessions';
import logger from '../monitoring/structured-logger';
import { register, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

export interface CacheMetrics {
  // Hit rates
  hitRate: {
    l1: number;
    l2: number;
    total: number;
  };

  // Operation counts
  operations: {
    get: number;
    set: number;
    delete: number;
    clear: number;
  };

  // Latency (milliseconds)
  latency: {
    get: {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
    };
    set: {
      p50: number;
      p95: number;
      p99: number;
      avg: number;
    };
  };

  // Memory usage
  memory: {
    l1Size: number;
    l1MaxSize: number;
    l2Used?: number;
    l2Peak?: number;
  };

  // Errors
  errors: {
    total: number;
    rate: number; // errors per minute
  };

  // Invalidation
  invalidation: {
    published: number;
    received: number;
    processed: number;
  };

  // Sessions
  sessions: {
    total: number;
    active: number;
  };

  // Health
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: number;
  };
}

export class CacheMetricsCollector {
  private static instance: CacheMetricsCollector;

  // Prometheus metrics
  private cacheHits: Counter;
  private cacheMisses: Counter;
  private cacheOperations: Counter;
  private cacheLatency: Histogram;
  private cacheSize: Gauge;
  private cacheErrors: Counter;
  private invalidationEvents: Counter;
  private activeSessions: Gauge;

  // Internal tracking
  private operationCounts = {
    get: 0,
    set: 0,
    delete: 0,
    clear: 0,
  };

  private latencyBuffer: {
    get: number[];
    set: number[];
  } = {
    get: [],
    set: [],
  };

  private errorCount = 0;
  private startTime = Date.now();
  private metricsInterval?: NodeJS.Timeout;

  private constructor() {
    // Initialize Prometheus metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['layer'], // l1, l2
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['layer'],
    });

    this.cacheOperations = new Counter({
      name: 'cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation'], // get, set, delete, clear
    });

    this.cacheLatency = new Histogram({
      name: 'cache_operation_duration_ms',
      help: 'Cache operation duration in milliseconds',
      labelNames: ['operation'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    });

    this.cacheSize = new Gauge({
      name: 'cache_size_entries',
      help: 'Number of entries in cache',
      labelNames: ['layer'],
    });

    this.cacheErrors = new Counter({
      name: 'cache_errors_total',
      help: 'Total number of cache errors',
      labelNames: ['operation'],
    });

    this.invalidationEvents = new Counter({
      name: 'cache_invalidation_events_total',
      help: 'Total number of cache invalidation events',
      labelNames: ['type'], // published, received, processed
    });

    this.activeSessions = new Gauge({
      name: 'cache_active_sessions',
      help: 'Number of active sessions in cache',
    });

    // Collect default Node.js metrics
    collectDefaultMetrics({ register });

    logger.info('CacheMetricsCollector initialized');
  }

  public static getInstance(): CacheMetricsCollector {
    if (!CacheMetricsCollector.instance) {
      CacheMetricsCollector.instance = new CacheMetricsCollector();
    }
    return CacheMetricsCollector.instance;
  }

  /**
   * Record cache hit
   */
  recordHit(layer: 'l1' | 'l2'): void {
    this.cacheHits.inc({ layer });
  }

  /**
   * Record cache miss
   */
  recordMiss(layer: 'l1' | 'l2'): void {
    this.cacheMisses.inc({ layer });
  }

  /**
   * Record cache operation
   */
  recordOperation(operation: 'get' | 'set' | 'delete' | 'clear', durationMs: number): void {
    this.cacheOperations.inc({ operation });
    this.cacheLatency.observe({ operation }, durationMs);

    this.operationCounts[operation]++;

    // Track latency in buffer for percentile calculation
    if (operation === 'get' || operation === 'set') {
      this.latencyBuffer[operation].push(durationMs);

      // Keep buffer size manageable
      if (this.latencyBuffer[operation].length > 1000) {
        this.latencyBuffer[operation] = this.latencyBuffer[operation].slice(-1000);
      }
    }
  }

  /**
   * Record cache error
   */
  recordError(operation: string): void {
    this.cacheErrors.inc({ operation });
    this.errorCount++;
  }

  /**
   * Record invalidation event
   */
  recordInvalidation(type: 'published' | 'received' | 'processed'): void {
    this.invalidationEvents.inc({ type });
  }

  /**
   * Update cache size metrics
   */
  updateCacheSize(layer: 'l1' | 'l2', size: number): void {
    this.cacheSize.set({ layer }, size);
  }

  /**
   * Update session count
   */
  updateSessionCount(count: number): void {
    this.activeSessions.set(count);
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Get latency stats
   */
  private getLatencyStats(operation: 'get' | 'set') {
    const buffer = this.latencyBuffer[operation];
    if (buffer.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    const sorted = [...buffer].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      p50: Math.round(this.calculatePercentile(sorted, 50) * 100) / 100,
      p95: Math.round(this.calculatePercentile(sorted, 95) * 100) / 100,
      p99: Math.round(this.calculatePercentile(sorted, 99) * 100) / 100,
      avg: Math.round((sum / sorted.length) * 100) / 100,
    };
  }

  /**
   * Collect comprehensive metrics
   */
  async collectMetrics(): Promise<CacheMetrics> {
    try {
      const cacheManager = getCacheManager();
      const cacheStats = cacheManager.getStats();
      const redisClient = getRedisClient();
      const redisHealth = await redisClient.healthCheck();
      const invalidator = getCacheInvalidator();
      const invalidationStats = invalidator.getStats();

      // Session stats
      let sessionCount = 0;
      try {
        const sessionManager = getSessionManager();
        const sessionStats = await sessionManager.getStats();
        sessionCount = sessionStats.totalSessions;
      } catch (error) {
        logger.warn('Failed to get session stats', error);
      }

      // Calculate error rate (errors per minute)
      const uptimeMinutes = (Date.now() - this.startTime) / 60000;
      const errorRate = uptimeMinutes > 0 ? this.errorCount / uptimeMinutes : 0;

      // Determine health status
      let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (redisHealth.status === 'unhealthy' || cacheStats.total.hitRate < 30) {
        healthStatus = 'unhealthy';
      } else if (redisHealth.status === 'degraded' || cacheStats.total.hitRate < 50) {
        healthStatus = 'degraded';
      }

      const metrics: CacheMetrics = {
        hitRate: {
          l1: cacheStats.l1.hitRate,
          l2: cacheStats.l2.hitRate,
          total: cacheStats.total.hitRate,
        },
        operations: { ...this.operationCounts },
        latency: {
          get: this.getLatencyStats('get'),
          set: this.getLatencyStats('set'),
        },
        memory: {
          l1Size: cacheStats.l1.size,
          l1MaxSize: cacheStats.l1.maxSize,
          l2Used: redisHealth.memory?.used,
          l2Peak: redisHealth.memory?.peak,
        },
        errors: {
          total: this.errorCount,
          rate: errorRate,
        },
        invalidation: {
          published: invalidationStats.published,
          received: invalidationStats.received,
          processed: invalidationStats.processed,
        },
        sessions: {
          total: sessionCount,
          active: sessionCount, // For now, all sessions are considered active
        },
        health: {
          status: healthStatus,
          uptime: Date.now() - this.startTime,
          lastCheck: Date.now(),
        },
      };

      // Update Prometheus gauges
      this.updateCacheSize('l1', cacheStats.l1.size);
      this.updateSessionCount(sessionCount);

      return metrics;
    } catch (error) {
      logger.error('Failed to collect cache metrics', error);
      throw error;
    }
  }

  /**
   * Get Prometheus metrics (text format)
   */
  async getPrometheusMetrics(): Promise<string> {
    // Collect latest metrics to update gauges
    await this.collectMetrics();

    return register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<CacheMetrics> {
    return this.collectMetrics();
  }

  /**
   * Start periodic metrics collection
   */
  startPeriodicCollection(intervalMs: number = 60000): void {
    if (this.metricsInterval) {
      logger.warn('Metrics collection already running');
      return;
    }

    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();

        logger.debug('Cache metrics collected', {
          hitRate: metrics.hitRate.total.toFixed(2) + '%',
          l1Size: metrics.memory.l1Size,
          errors: metrics.errors.total,
          health: metrics.health.status,
        });
      } catch (error) {
        logger.error('Periodic metrics collection failed', error);
      }
    }, intervalMs);

    logger.info('Periodic metrics collection started', { intervalMs });
  }

  /**
   * Stop periodic metrics collection
   */
  stopPeriodicCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
      logger.info('Periodic metrics collection stopped');
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.operationCounts = {
      get: 0,
      set: 0,
      delete: 0,
      clear: 0,
    };

    this.latencyBuffer = {
      get: [],
      set: [],
    };

    this.errorCount = 0;
    this.startTime = Date.now();

    logger.info('Cache metrics reset');
  }

  /**
   * Get health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      redis: boolean;
      cache: boolean;
      hitRate: number;
      latency: number;
    };
  }> {
    try {
      const metrics = await this.collectMetrics();
      const redisClient = getRedisClient();
      const redisConnected = redisClient.isClientConnected();

      const checks = {
        redis: redisConnected,
        cache: metrics.health.status !== 'unhealthy',
        hitRate: metrics.hitRate.total,
        latency: metrics.latency.get.p95,
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!checks.redis || !checks.cache) {
        status = 'unhealthy';
      } else if (checks.hitRate < 50 || checks.latency > 100) {
        status = 'degraded';
      }

      return { status, checks };
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        checks: {
          redis: false,
          cache: false,
          hitRate: 0,
          latency: 0,
        },
      };
    }
  }
}

/**
 * Get CacheMetricsCollector instance
 */
export function getCacheMetrics(): CacheMetricsCollector {
  return CacheMetricsCollector.getInstance();
}

/**
 * Export singleton
 */
export const cacheMetrics = CacheMetricsCollector.getInstance();
