/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals and sends to analytics
 */

// Extend Navigator interface for experimental APIs
interface NavigatorNetworkInformation {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g'
}

interface ExtendedNavigator extends Navigator {
  connection?: NavigatorNetworkInformation
  deviceMemory?: number
}

// Extend Window interface for third-party SDKs
interface DatadogRUM {
  addTiming: (name: string, value: number) => void
  setGlobalContextProperty: (key: string, value: unknown) => void
}

interface SentrySDK {
  setMeasurement: (name: string, value: number, unit: string) => void
  addBreadcrumb: (breadcrumb: {
    category: string
    message: string
    level: 'info' | 'warning' | 'error'
    data?: Record<string, unknown>
  }) => void
}

interface ExtendedWindow extends Window {
  DD_RUM?: DatadogRUM
  Sentry?: SentrySDK
  __getWebVitalsScores?: () => Record<MetricName, WebVitalsMetric | null>
}

declare const window: ExtendedWindow

// Analytics endpoints (configure based on your monitoring service)
const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '/api/analytics/web-vitals'

// Thresholds for Web Vitals (Google recommendations)
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
  INP: { good: 200, needsImprovement: 500 },   // Interaction to Next Paint
}

export type MetricName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP'

// Define proper Metric interface based on web-vitals library
export interface Metric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  entries: PerformanceEntry[]
  id: string
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender' | 'restore'
}

export interface WebVitalsMetric extends Metric {
  rating: 'good' | 'needs-improvement' | 'poor'
}

/**
 * Rate a metric value based on thresholds
 */
function rateMetric(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = WEB_VITALS_THRESHOLDS[name]
  if (!threshold) return 'good'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Send metric to analytics service
 */
async function sendToAnalytics(metric: WebVitalsMetric): Promise<void> {
  // Don't send in development
  if (process.env.NODE_ENV !== 'production') {
    if (process.env.NEXT_PUBLIC_WEB_VITALS_LOG !== 'true') {
      return
    }
    console.log('[Web Vitals]', metric.name, {
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
    })
    return
  }

  try {
    const extendedNavigator = navigator as ExtendedNavigator

    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
      page: window.location.pathname,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      // Add custom context
      connectionType: extendedNavigator.connection?.effectiveType,
      deviceMemory: extendedNavigator.deviceMemory,
    })

    // Use sendBeacon if available (more reliable for page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_ENDPOINT, body)
    } else {
      // Fallback to fetch
      fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(console.error)
    }
  } catch (error) {
    console.error('[Web Vitals] Failed to send metric:', error)
  }
}

/**
 * Send metric to Datadog (if configured)
 */
function sendToDatadog(metric: WebVitalsMetric): void {
  if (typeof window === 'undefined') return

  // Check if Datadog RUM is initialized
  const DD_RUM = window.DD_RUM
  if (!DD_RUM) return

  try {
    DD_RUM.addTiming(metric.name, metric.value)

    // Add custom attributes
    DD_RUM.setGlobalContextProperty('web_vitals', {
      [metric.name.toLowerCase()]: {
        value: metric.value,
        rating: metric.rating,
      },
    })
  } catch (error) {
    console.error('[Web Vitals] Failed to send to Datadog:', error)
  }
}

/**
 * Send metric to Sentry (if configured)
 */
function sendToSentry(metric: WebVitalsMetric): void {
  if (typeof window === 'undefined') return

  // Check if Sentry is initialized
  const Sentry = window.Sentry
  if (!Sentry) return

  try {
    Sentry.setMeasurement(metric.name, metric.value, 'millisecond')

    // Add breadcrumb
    Sentry.addBreadcrumb({
      category: 'web-vitals',
      message: `${metric.name}: ${metric.value}`,
      level: metric.rating === 'poor' ? 'warning' : 'info',
      data: {
        value: metric.value,
        rating: metric.rating,
      },
    })
  } catch (error) {
    console.error('[Web Vitals] Failed to send to Sentry:', error)
  }
}

/**
 * Main Web Vitals reporting function
 * Call this from _app.tsx with reportWebVitals
 */
export function reportWebVitals(metric: Metric): void {
  const name = metric.name as MetricName

  // Add rating to metric
  const enhancedMetric: WebVitalsMetric = {
    ...metric,
    rating: rateMetric(name, metric.value),
  }

  // Send to all configured services
  sendToAnalytics(enhancedMetric)
  sendToDatadog(enhancedMetric)
  sendToSentry(enhancedMetric)

  // Log warnings for poor metrics
  if (enhancedMetric.rating === 'poor' && (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_WEB_VITALS_LOG === 'true')) {
    console.warn(
      `[Web Vitals] Poor ${name} detected:`,
      `${metric.value.toFixed(2)}${name === 'CLS' ? '' : 'ms'}`,
      `(threshold: ${WEB_VITALS_THRESHOLDS[name]?.needsImprovement})`
    )
  }
}

/**
 * Get current Web Vitals scores
 * Useful for debugging in dev tools
 */
export function getWebVitalsScores(): Record<MetricName, WebVitalsMetric | null> {
  const scores: Record<MetricName, WebVitalsMetric | null> = {
    LCP: null,
    FID: null,
    CLS: null,
    FCP: null,
    TTFB: null,
    INP: null,
  }

  if (typeof window === 'undefined') return scores

  // Access performance entries
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Convert PerformanceEntry to our Metric format
      const metric: WebVitalsMetric = {
        name: entry.name,
        value: entry.duration || 0,
        rating: 'good',
        delta: 0,
        entries: [entry],
        id: `v4-${Date.now()}-${Math.random()}`,
        navigationType: 'navigate',
      }

      if (metric.name in scores) {
        const name = metric.name as MetricName
        scores[name] = {
          ...metric,
          rating: rateMetric(name, metric.value),
        }
      }
    }
  })

  try {
    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] })
  } catch (e) {
    // Some browsers don't support all entry types
  }

  return scores
}

/**
 * Monitor Long Tasks (tasks >50ms)
 */
export function monitorLongTasks(): void {
  if (typeof window === 'undefined') return
  if (!('PerformanceObserver' in window)) return
  if (process.env.NEXT_PUBLIC_WEB_VITALS_LOG !== 'true') return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Long task detected (>50ms)
        if (entry.duration > 50) {
          console.warn('[Performance] Long task detected:', {
            duration: `${entry.duration.toFixed(2)}ms`,
            startTime: entry.startTime,
            name: entry.name,
          })

          // Send to Sentry
          const Sentry = window.Sentry
          if (Sentry) {
            Sentry.addBreadcrumb({
              category: 'performance',
              message: 'Long task detected',
              level: 'warning',
              data: {
                duration: entry.duration,
                startTime: entry.startTime,
              },
            })
          }
        }
      }
    })

    observer.observe({ entryTypes: ['longtask'] })
  } catch (e) {
    console.error('[Performance] Failed to monitor long tasks:', e)
  }
}

/**
 * Monitor Resource Loading Performance
 */
export function monitorResourcePerformance(): void {
  if (typeof window === 'undefined') return
  if (process.env.NEXT_PUBLIC_WEB_VITALS_LOG !== 'true') return

  window.addEventListener('load', () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

    // Find slow resources (>1s)
    const slowResources = resources.filter((r) => r.duration > 1000)

    if (slowResources.length > 0) {
      console.warn('[Performance] Slow resources detected:',
        slowResources.map(r => ({
          name: r.name,
          duration: `${r.duration.toFixed(2)}ms`,
          size: r.transferSize || 'unknown',
        }))
      )
    }

    // Find large resources (>500KB)
    const largeResources = resources.filter((r) => r.transferSize > 500000)

    if (largeResources.length > 0) {
      console.warn('[Performance] Large resources detected:',
        largeResources.map(r => ({
          name: r.name,
          size: `${(r.transferSize / 1024).toFixed(2)}KB`,
        }))
      )
    }
  })
}

/**
 * Initialize all performance monitoring
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return
  if (process.env.NEXT_PUBLIC_WEB_VITALS_LOG !== 'true') return

  // Monitor long tasks
  monitorLongTasks()

  // Monitor resource performance
  monitorResourcePerformance()

  // Add global error tracking for performance issues
  if (process.env.NODE_ENV === 'production') {
    window.addEventListener('error', (event) => {
      if (event.filename?.includes('.js') || event.filename?.includes('.css')) {
        console.error('[Performance] Resource load error:', {
          filename: event.filename,
          message: event.message,
        })
      }
    })
  }
}

// Make available in dev tools
if (typeof window !== 'undefined') {
  window.__getWebVitalsScores = getWebVitalsScores
}
