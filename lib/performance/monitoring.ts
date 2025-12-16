/**
 * Performance Monitoring System
 *
 * Features:
 * - Core Web Vitals tracking (LCP, FID, CLS, TTFB, INP)
 * - API response time monitoring
 * - Database query performance
 * - Real User Monitoring (RUM)
 * - Performance budgets
 * - Automated alerts
 */

import { logger } from '../monitoring/logger'

// ========================
// CORE WEB VITALS TYPES
// ========================

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType: string
}

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
  fcp?: number // First Contentful Paint
  inp?: number // Interaction to Next Paint

  // Custom metrics
  apiResponseTime?: number
  dbQueryTime?: number
  pageLoadTime?: number
  timeToInteractive?: number
}

export interface PerformanceEntry {
  timestamp: number
  url: string
  userAgent: string
  metrics: PerformanceMetrics
  context: {
    userId?: number
    organizationId?: number
    sessionId?: string
  }
}

export interface PerformanceBudget {
  metric: keyof PerformanceMetrics
  budget: number // in ms or score
  alertThreshold: number // percentage (e.g., 0.8 = 80% of budget)
}

// ========================
// PERFORMANCE THRESHOLDS
// ========================

export const CORE_WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  FID: {
    good: 100,
    needsImprovement: 300,
  },
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  INP: {
    good: 200,
    needsImprovement: 500,
  },
}

// ========================
// PERFORMANCE MONITOR
// ========================

class PerformanceMonitor {
  private metrics: PerformanceEntry[] = []
  private budgets: PerformanceBudget[] = []
  private maxStoredMetrics = 1000

  // Aggregated statistics
  private stats = {
    totalRequests: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    errorRate: 0,
  }

  constructor() {
    this.initializeDefaultBudgets()
  }

  /**
   * Initialize default performance budgets
   */
  private initializeDefaultBudgets(): void {
    this.budgets = [
      { metric: 'lcp', budget: 2500, alertThreshold: 0.8 },
      { metric: 'fid', budget: 100, alertThreshold: 0.8 },
      { metric: 'cls', budget: 0.1, alertThreshold: 0.8 },
      { metric: 'ttfb', budget: 800, alertThreshold: 0.8 },
      { metric: 'apiResponseTime', budget: 500, alertThreshold: 0.8 },
      { metric: 'dbQueryTime', budget: 100, alertThreshold: 0.8 },
    ]
  }

  /**
   * Track Web Vitals metric
   */
  trackWebVital(metric: WebVitalsMetric): void {
    const rating = this.calculateRating(metric.name, metric.value)

    logger.info('Web Vitals metric recorded', {
      name: metric.name,
      value: metric.value,
      rating,
      id: metric.id,
    })

    // Check against budgets
    this.checkBudget(metric.name.toLowerCase() as keyof PerformanceMetrics, metric.value)
  }

  /**
   * Calculate metric rating based on thresholds
   */
  private calculateRating(
    name: string,
    value: number
  ): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = CORE_WEB_VITALS_THRESHOLDS[name as keyof typeof CORE_WEB_VITALS_THRESHOLDS]
    if (!thresholds) return 'good'

    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.needsImprovement) return 'needs-improvement'
    return 'poor'
  }

  /**
   * Track API response time
   */
  trackApiResponse(endpoint: string, duration: number, statusCode: number): void {
    this.stats.totalRequests++

    // Update average response time
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + duration) /
      this.stats.totalRequests

    // Track errors
    if (statusCode >= 400) {
      this.stats.errorRate = (this.stats.errorRate * (this.stats.totalRequests - 1) + 1) / this.stats.totalRequests
    }

    logger.debug('API response tracked', {
      endpoint,
      duration,
      statusCode,
    })

    // Check against budget
    this.checkBudget('apiResponseTime', duration)

    // Alert on slow requests
    if (duration > 1000) {
      logger.warn('Slow API request detected', {
        endpoint,
        duration,
        threshold: 1000,
      })
    }
  }

  /**
   * Track database query time
   */
  trackDbQuery(query: string, duration: number): void {
    logger.debug('Database query tracked', {
      query: query.substring(0, 100),
      duration,
    })

    // Check against budget
    this.checkBudget('dbQueryTime', duration)

    // Alert on slow queries
    if (duration > 100) {
      logger.warn('Slow database query detected', {
        query: query.substring(0, 200),
        duration,
        threshold: 100,
      })
    }
  }

  /**
   * Track full page performance
   */
  trackPagePerformance(entry: PerformanceEntry): void {
    this.metrics.push(entry)

    // Limit stored metrics
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics.shift()
    }

    // Check all metrics against budgets
    Object.entries(entry.metrics).forEach(([metric, value]) => {
      if (value !== undefined) {
        this.checkBudget(metric as keyof PerformanceMetrics, value)
      }
    })

    logger.info('Page performance tracked', {
      url: entry.url,
      metrics: entry.metrics,
    })
  }

  /**
   * Check metric against performance budget
   */
  private checkBudget(metric: keyof PerformanceMetrics, value: number): void {
    const budget = this.budgets.find((b) => b.metric === metric)
    if (!budget) return

    const percentageUsed = value / budget.budget

    if (percentageUsed >= 1.0) {
      logger.error('Performance budget exceeded', {
        metric,
        value,
        budget: budget.budget,
        percentageUsed: Math.round(percentageUsed * 100),
      })
    } else if (percentageUsed >= budget.alertThreshold) {
      logger.warn('Performance budget threshold reached', {
        metric,
        value,
        budget: budget.budget,
        percentageUsed: Math.round(percentageUsed * 100),
        threshold: budget.alertThreshold * 100,
      })
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalMetrics: this.metrics.length,
      recentMetrics: this.metrics.slice(-10),
    }
  }

  /**
   * Get metrics by time period
   */
  getMetricsByPeriod(startTime: number, endTime: number): PerformanceEntry[] {
    return this.metrics.filter(
      (entry) => entry.timestamp >= startTime && entry.timestamp <= endTime
    )
  }

  /**
   * Get percentile value
   */
  getPercentile(metric: keyof PerformanceMetrics, percentile: number): number {
    const values = this.metrics
      .map((entry) => entry.metrics[metric])
      .filter((v): v is number => v !== undefined)
      .sort((a, b) => a - b)

    if (values.length === 0) return 0

    const index = Math.ceil((percentile / 100) * values.length) - 1
    return values[index] || 0
  }

  /**
   * Get Core Web Vitals summary
   */
  getCoreWebVitalsSummary() {
    const metrics: (keyof PerformanceMetrics)[] = ['lcp', 'fid', 'cls', 'ttfb', 'fcp', 'inp']
    const summary: Record<string, any> = {}

    for (const metric of metrics) {
      const values = this.metrics
        .map((entry) => entry.metrics[metric])
        .filter((v): v is number => v !== undefined)

      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        const p75 = this.getPercentile(metric, 75)
        const p95 = this.getPercentile(metric, 95)

        summary[metric] = {
          avg: Math.round(avg * 100) / 100,
          p75: Math.round(p75 * 100) / 100,
          p95: Math.round(p95 * 100) / 100,
          rating: this.calculateRating(metric.toUpperCase(), p75),
        }
      }
    }

    return summary
  }

  /**
   * Set custom performance budget
   */
  setBudget(budget: PerformanceBudget): void {
    const existingIndex = this.budgets.findIndex((b) => b.metric === budget.metric)
    if (existingIndex >= 0) {
      this.budgets[existingIndex] = budget
    } else {
      this.budgets.push(budget)
    }

    logger.info('Performance budget updated', budget)
  }

  /**
   * Get all budgets
   */
  getBudgets(): PerformanceBudget[] {
    return [...this.budgets]
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: number): void {
    const cutoff = Date.now() - olderThan
    const before = this.metrics.length
    this.metrics = this.metrics.filter((entry) => entry.timestamp >= cutoff)
    const removed = before - this.metrics.length

    logger.info('Old performance metrics cleared', { removed, remaining: this.metrics.length })
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): PerformanceEntry[] {
    return [...this.metrics]
  }
}

// ========================
// BROWSER-SIDE UTILITIES
// ========================

/**
 * Browser-side performance monitoring
 * To be used in client components
 */
export function initBrowserPerformanceMonitoring() {
  if (typeof window === 'undefined') return

  // Web Vitals tracking using PerformanceObserver
  try {
    // LCP - Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as any
      if (lastEntry) {
        reportWebVital({
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: 'good',
          delta: 0,
          id: crypto.randomUUID(),
          navigationType: 'navigate',
        })
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

    // FID - First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        reportWebVital({
          name: 'FID',
          value: entry.processingStart - entry.startTime,
          rating: 'good',
          delta: 0,
          id: crypto.randomUUID(),
          navigationType: 'navigate',
        })
      })
    })
    fidObserver.observe({ type: 'first-input', buffered: true })

    // CLS - Cumulative Layout Shift
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })

    // Report CLS on page hide
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportWebVital({
          name: 'CLS',
          value: clsValue,
          rating: 'good',
          delta: 0,
          id: crypto.randomUUID(),
          navigationType: 'navigate',
        })
      }
    })

    // TTFB - Time to First Byte
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navEntry) {
      const ttfb = navEntry.responseStart - navEntry.requestStart
      reportWebVital({
        name: 'TTFB',
        value: ttfb,
        rating: 'good',
        delta: 0,
        id: crypto.randomUUID(),
        navigationType: navEntry.type,
      })
    }
  } catch (error) {
    logger.error('Failed to initialize performance monitoring', error)
  }
}

/**
 * Report Web Vital to backend
 */
async function reportWebVital(metric: WebVitalsMetric) {
  try {
    // Send to analytics endpoint
    await fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      }),
    })
  } catch (error) {
    logger.error('Failed to report Web Vital', error)
  }
}

/**
 * Measure component render time
 */
export function measureComponentRender(componentName: string, callback: () => void) {
  const start = performance.now()
  callback()
  const duration = performance.now() - start

  if (duration > 16) {
    // Longer than 1 frame at 60fps
    logger.warn(`Slow component render: ${componentName} took ${duration.toFixed(2)}ms`)
  }
}

/**
 * Create performance mark
 */
export function mark(name: string) {
  if (typeof window !== 'undefined') {
    performance.mark(name)
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark: string) {
  if (typeof window !== 'undefined') {
    try {
      performance.measure(name, startMark, endMark)
      const measure = performance.getEntriesByName(name)[0]
      if (measure) {
        logger.info(`${name}: ${measure.duration.toFixed(2)}ms`)
        return measure.duration
      }
    } catch (error) {
      logger.error('Failed to measure performance', error)
    }
  }
  return 0
}

// ========================
// SINGLETON INSTANCE
// ========================

export const performanceMonitor = new PerformanceMonitor()

// Auto-cleanup old metrics every hour
setInterval(() => {
  performanceMonitor.clearOldMetrics(24 * 60 * 60 * 1000) // Keep 24 hours
}, 60 * 60 * 1000)

export default performanceMonitor
