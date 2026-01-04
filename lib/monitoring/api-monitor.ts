/**
 * API Performance Monitoring
 *
 * Tracks API response times, error rates, and performance metrics
 * for all API endpoints.
 */

import { captureException } from './sentry-helpers'

interface APIMetric {
  endpoint: string
  method: string
  duration: number
  status: 'success' | 'error'
  statusCode?: number
  timestamp: number
  error?: string
}

interface APIStats {
  totalCalls: number
  successRate: number
  averageDuration: number
  slowestCall: number
  fastestCall: number
  errorCount: number
  byEndpoint: Record<string, {
    calls: number
    avgDuration: number
    errors: number
  }>
}

/**
 * API Monitor Class
 */
export class APIMonitor {
  private static metrics: APIMetric[] = []
  private static maxMetrics = 500 // Keep last 500 API calls
  private static slowQueryThreshold = 1000 // 1 second
  private static enabled = true

  /**
   * Monitor an API call
   */
  static async monitorAPICall<T>(
    endpoint: string,
    method: string = 'GET',
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.enabled) {
      return fn()
    }

    const start = Date.now()
    let status: 'success' | 'error' = 'success'
    let statusCode: number | undefined
    let error: string | undefined

    try {
      const result = await fn()
      statusCode = 200
      return result
    } catch (err) {
      status = 'error'
      error = err instanceof Error ? err.message : String(err)

      // Capture error in Sentry
      captureException(err, {
        tags: {
          endpoint,
          method,
          errorType: 'api_call_failed',
        },
        extra: {
          endpoint,
          method,
          duration: Date.now() - start,
        },
      })

      throw err
    } finally {
      const duration = Date.now() - start

      // Track metric
      this.trackAPIMetric({
        endpoint,
        method,
        duration,
        status,
        statusCode,
        timestamp: Date.now(),
        error,
      })

      // Log slow API calls
      if (duration > this.slowQueryThreshold) {
        console.warn(`[API Monitor] Slow API call detected`, {
          endpoint,
          method,
          duration: `${duration}ms`,
          status,
        })
      }
    }
  }

  /**
   * Track API metric
   */
  static trackAPIMetric(metric: APIMetric): void {
    this.metrics.push(metric)

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Send to analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'api_call', {
        endpoint: metric.endpoint,
        method: metric.method,
        duration: Math.round(metric.duration),
        status: metric.status,
        status_code: metric.statusCode,
      })
    }
  }

  /**
   * Get all metrics
   */
  static getMetrics(): APIMetric[] {
    return [...this.metrics]
  }

  /**
   * Get metrics for specific endpoint
   */
  static getMetricsByEndpoint(endpoint: string): APIMetric[] {
    return this.metrics.filter((m) => m.endpoint === endpoint)
  }

  /**
   * Get statistics
   */
  static getStats(): APIStats {
    if (this.metrics.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageDuration: 0,
        slowestCall: 0,
        fastestCall: 0,
        errorCount: 0,
        byEndpoint: {},
      }
    }

    const totalCalls = this.metrics.length
    const successfulCalls = this.metrics.filter((m) => m.status === 'success').length
    const successRate = (successfulCalls / totalCalls) * 100

    const durations = this.metrics.map((m) => m.duration)
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
    const slowestCall = Math.max(...durations)
    const fastestCall = Math.min(...durations)

    const errorCount = this.metrics.filter((m) => m.status === 'error').length

    // Group by endpoint
    const byEndpoint: Record<string, { calls: number; avgDuration: number; errors: number }> = {}

    this.metrics.forEach((metric) => {
      if (!byEndpoint[metric.endpoint]) {
        byEndpoint[metric.endpoint] = {
          calls: 0,
          avgDuration: 0,
          errors: 0,
        }
      }

      byEndpoint[metric.endpoint].calls++
      byEndpoint[metric.endpoint].avgDuration += metric.duration
      if (metric.status === 'error') {
        byEndpoint[metric.endpoint].errors++
      }
    })

    // Calculate averages
    Object.keys(byEndpoint).forEach((endpoint) => {
      byEndpoint[endpoint].avgDuration /= byEndpoint[endpoint].calls
    })

    return {
      totalCalls,
      successRate,
      averageDuration,
      slowestCall,
      fastestCall,
      errorCount,
      byEndpoint,
    }
  }

  /**
   * Get slow API calls
   */
  static getSlowCalls(threshold: number = this.slowQueryThreshold): APIMetric[] {
    return this.metrics.filter((m) => m.duration > threshold)
  }

  /**
   * Get failed API calls
   */
  static getFailedCalls(): APIMetric[] {
    return this.metrics.filter((m) => m.status === 'error')
  }

  /**
   * Get recent API calls
   */
  static getRecentCalls(limit: number = 10): APIMetric[] {
    return this.metrics.slice(-limit)
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Set slow query threshold
   */
  static setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold
  }

  /**
   * Enable/disable monitoring
   */
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Get report
   */
  static getReport(): {
    timestamp: string
    stats: APIStats
    slowCalls: APIMetric[]
    failedCalls: APIMetric[]
    recentCalls: APIMetric[]
  } {
    return {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      slowCalls: this.getSlowCalls(),
      failedCalls: this.getFailedCalls(),
      recentCalls: this.getRecentCalls(),
    }
  }

  /**
   * Export metrics as JSON
   */
  static exportMetrics(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        stats: this.getStats(),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  }

  /**
   * Log performance summary
   */
  static logSummary(): void {
    const stats = this.getStats()

    console.log('[API Monitor] Performance Summary', {
      totalCalls: stats.totalCalls,
      successRate: `${stats.successRate.toFixed(2)}%`,
      averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
      slowestCall: `${stats.slowestCall}ms`,
      fastestCall: `${stats.fastestCall}ms`,
      errorCount: stats.errorCount,
      endpointCount: Object.keys(stats.byEndpoint).length,
    })

    // Log slow endpoints
    const slowEndpoints = Object.entries(stats.byEndpoint)
      .filter(([_, data]) => data.avgDuration > this.slowQueryThreshold)
      .sort((a, b) => b[1].avgDuration - a[1].avgDuration)

    if (slowEndpoints.length > 0) {
      console.warn('[API Monitor] Slow endpoints detected:',
        slowEndpoints.map(([endpoint, data]) => ({
          endpoint,
          avgDuration: `${data.avgDuration.toFixed(2)}ms`,
          calls: data.calls,
        }))
      )
    }
  }
}

/**
 * Wrapper function for monitoring API calls
 */
export async function monitorAPICall<T>(
  endpoint: string,
  fn: () => Promise<T>,
  method: string = 'GET'
): Promise<T> {
  return APIMonitor.monitorAPICall(endpoint, method, fn)
}

/**
 * Track API metric manually
 */
export function trackAPIMetric(metric: Omit<APIMetric, 'timestamp'>): void {
  APIMonitor.trackAPIMetric({
    ...metric,
    timestamp: Date.now(),
  })
}

// Export singleton instance
export default APIMonitor

// Type declarations for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      eventName: string,
      params: Record<string, any>
    ) => void
  }
}
