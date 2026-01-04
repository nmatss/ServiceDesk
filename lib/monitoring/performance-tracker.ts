/**
 * Performance Tracking Infrastructure
 *
 * Tracks Web Vitals and custom performance metrics for monitoring application performance.
 * Integrates with analytics and Sentry for comprehensive monitoring.
 */

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  id?: string
  navigationType?: string
}

interface WebVitalMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP'
  value: number
  delta: number
  rating: 'good' | 'needs-improvement' | 'poor'
  id: string
  navigationType: string
}

/**
 * Web Vitals thresholds (following Google's recommendations)
 */
const THRESHOLDS = {
  CLS: [0.1, 0.25], // Cumulative Layout Shift
  FID: [100, 300], // First Input Delay (ms)
  FCP: [1800, 3000], // First Contentful Paint (ms)
  LCP: [2500, 4000], // Largest Contentful Paint (ms)
  TTFB: [800, 1800], // Time to First Byte (ms)
  INP: [200, 500], // Interaction to Next Paint (ms)
}

/**
 * Performance Tracker Class
 */
export class PerformanceTracker {
  private static metrics: PerformanceMetric[] = []
  private static maxMetrics = 100 // Keep last 100 metrics in memory

  /**
   * Track a Web Vital metric
   */
  static trackWebVital(metric: WebVitalMetric): void {
    const rating = this.getRating(metric.name, metric.value)

    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating,
      timestamp: Date.now(),
      id: metric.id,
      navigationType: metric.navigationType,
    }

    // Store metric
    this.addMetric(performanceMetric)

    // Send to analytics
    this.sendToAnalytics(metric, rating)

    // Send to Sentry for performance monitoring
    this.sendToSentry(metric, rating)

    // Log poor metrics
    if (rating === 'poor') {
      console.warn(`[Performance] Poor ${metric.name}: ${metric.value}`, {
        rating,
        threshold: THRESHOLDS[metric.name],
      })
    }
  }

  /**
   * Track custom performance metric
   */
  static trackCustomMetric(name: string, value: number): void {
    const metric: PerformanceMetric = {
      name,
      value,
      rating: 'good', // Default rating for custom metrics
      timestamp: Date.now(),
    }

    this.addMetric(metric)

    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'custom_metric', {
        metric_name: name,
        metric_value: Math.round(value),
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Track page load time
   */
  static trackPageLoad(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart
        const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart
        const domInteractive = navigation.domInteractive - navigation.fetchStart

        this.trackCustomMetric('page_load_time', loadTime)
        this.trackCustomMetric('dom_content_loaded', domContentLoaded)
        this.trackCustomMetric('dom_interactive', domInteractive)
      }
    })
  }

  /**
   * Track resource loading performance
   */
  static trackResourceTiming(): void {
    if (typeof window === 'undefined') return

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const slowResources = resources.filter((resource) => resource.duration > 1000)

    if (slowResources.length > 0) {
      console.warn(`[Performance] ${slowResources.length} slow resources detected`, {
        resources: slowResources.map((r) => ({
          name: r.name,
          duration: Math.round(r.duration),
          type: r.initiatorType,
        })),
      })
    }
  }

  /**
   * Get rating based on metric name and value
   */
  private static getRating(
    name: WebVitalMetric['name'],
    value: number
  ): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = THRESHOLDS[name]
    if (!thresholds) return 'good'

    if (value <= thresholds[0]) return 'good'
    if (value <= thresholds[1]) return 'needs-improvement'
    return 'poor'
  }

  /**
   * Add metric to storage
   */
  private static addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  /**
   * Send metric to Google Analytics
   */
  private static sendToAnalytics(metric: WebVitalMetric, rating: string): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        metric_rating: rating,
        metric_delta: Math.round(metric.delta),
        metric_id: metric.id,
        navigation_type: metric.navigationType,
      })
    }
  }

  /**
   * Send metric to Sentry
   */
  private static sendToSentry(metric: WebVitalMetric, rating: string): void {
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      const Sentry = (window as any).Sentry

      // Set measurement for performance tracking
      Sentry.setMeasurement(metric.name, metric.value, 'millisecond')

      // Add breadcrumb for poor metrics
      if (rating === 'poor') {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Poor ${metric.name}: ${metric.value}`,
          level: 'warning',
          data: {
            value: metric.value,
            rating,
          },
        })
      }
    }
  }

  /**
   * Get all tracked metrics
   */
  static getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Get metrics by name
   */
  static getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name)
  }

  /**
   * Get metrics summary
   */
  static getSummary(): {
    total: number
    byRating: Record<string, number>
    byName: Record<string, number>
    averageValues: Record<string, number>
  } {
    const summary = {
      total: this.metrics.length,
      byRating: {
        good: 0,
        'needs-improvement': 0,
        poor: 0,
      },
      byName: {} as Record<string, number>,
      averageValues: {} as Record<string, number>,
    }

    const valuesByName = {} as Record<string, number[]>

    this.metrics.forEach((metric) => {
      // Count by rating
      summary.byRating[metric.rating]++

      // Count by name
      summary.byName[metric.name] = (summary.byName[metric.name] || 0) + 1

      // Collect values for averaging
      if (!valuesByName[metric.name]) {
        valuesByName[metric.name] = []
      }
      valuesByName[metric.name].push(metric.value)
    })

    // Calculate averages
    Object.keys(valuesByName).forEach((name) => {
      const values = valuesByName[name]
      summary.averageValues[name] =
        values.reduce((sum, val) => sum + val, 0) / values.length
    })

    return summary
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Export metrics as JSON
   */
  static exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getSummary(),
      timestamp: new Date().toISOString(),
    }, null, 2)
  }

  /**
   * Get performance report
   */
  static getReport(): {
    timestamp: string
    summary: ReturnType<typeof PerformanceTracker.getSummary>
    recentMetrics: PerformanceMetric[]
    poorMetrics: PerformanceMetric[]
  } {
    const summary = this.getSummary()
    const recentMetrics = this.metrics.slice(-10)
    const poorMetrics = this.metrics.filter((m) => m.rating === 'poor')

    return {
      timestamp: new Date().toISOString(),
      summary,
      recentMetrics,
      poorMetrics,
    }
  }
}

/**
 * Initialize Web Vitals tracking
 */
export function initWebVitalsTracking(): void {
  if (typeof window === 'undefined') return

  // Track page load
  PerformanceTracker.trackPageLoad()

  // Track resource timing after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      PerformanceTracker.trackResourceTiming()
    }, 0)
  })
}

/**
 * Report Web Vitals to performance tracker
 * This is used with the web-vitals library
 */
export function reportWebVitals(metric: WebVitalMetric): void {
  PerformanceTracker.trackWebVital(metric)
}

// Export singleton instance
export default PerformanceTracker

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
