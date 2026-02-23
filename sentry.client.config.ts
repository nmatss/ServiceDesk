// @ts-nocheck
/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for client-side error tracking.
 * It runs in the browser and captures:
 * - JavaScript errors
 * - Unhandled promise rejections
 * - User interactions (breadcrumbs)
 * - Performance metrics (if enabled)
 *
 * NOTE: Do NOT import Node.js modules here - this file runs in the browser.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
const SENTRY_ENABLED = process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' || process.env.SENTRY_ENABLED === 'true'
const ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'

// Initialize Sentry only if DSN is configured
if (SENTRY_ENABLED && SENTRY_DSN) {
  // Lazy import to avoid build-time incompatibilities in dev
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const Sentry = eval('require')('@sentry/nextjs')
  const integrations: any[] = []

  if (typeof Sentry.browserTracingIntegration === 'function') {
    integrations.push(
      Sentry.browserTracingIntegration({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation,
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/[^/]*\.servicedesk\.com/,
          /^https:\/\/api\.servicedesk\.com/,
        ],
      })
    )
  }

  if (ENVIRONMENT === 'production' && typeof Sentry.replayIntegration === 'function') {
    integrations.push(
      Sentry.replayIntegration({
        sessionSampleRate: 0.01,
        errorSampleRate: 0.1,
        maskAllText: true,
        blockAllMedia: true,
      })
    )
  }

  Sentry.init({
    // Data Source Name - where to send errors
    dsn: SENTRY_DSN,

    // Environment identification
    environment: ENVIRONMENT,

    // Release version (use git SHA in production)
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    // ========================
    // SAMPLING CONFIGURATION
    // ========================

    // Percentage of error events to send (1.0 = 100%)
    // Lower this in high-traffic production to reduce costs
    sampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE || '1.0'),

    // Percentage of transactions to trace for performance monitoring
    // 0.1 = 10% of transactions
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // ========================
    // ERROR FILTERING
    // ========================

    // Ignore specific errors that are not actionable
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',

      // Random network errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',

      // Canceled requests
      'AbortError',
      'Request aborted',

      // Third-party scripts
      'Non-Error promise rejection captured',

      // Safari specific
      'ResizeObserver loop limit exceeded',

      // Ad blockers
      'adsbygoogle',

      // Common false positives
      'ChunkLoadError',
      'Loading chunk',
    ],

    // Filter out errors from specific URLs
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,

      // Third-party scripts
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /facebook\.net/i,

      // Local development
      /localhost/i,
      /127\.0\.0\.1/i,
    ],

    // ========================
    // INTEGRATIONS
    // ========================

    integrations,

    // ========================
    // BREADCRUMBS
    // ========================

    // Maximum number of breadcrumbs to keep
    maxBreadcrumbs: 50,

    // ========================
    // PRIVACY & SECURITY
    // ========================

    // Before sending events, scrub sensitive data
    beforeSend(event, hint) {
      // Don't send events in development
      if (ENVIRONMENT === 'development') {
        console.error('[Sentry] Event (dev):', event, hint)
        return null
      }

      // Remove sensitive data from user context
      if (event.user) {
        delete event.user.ip_address
        delete event.user.email
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['Cookie']
        delete event.request.headers['X-CSRF-Token']
      }

      // Remove sensitive query parameters
      if (event.request?.query_string) {
        const sensitiveParams = ['token', 'password', 'secret', 'api_key', 'apikey']
        sensitiveParams.forEach(param => {
          if (event.request?.query_string?.includes(param)) {
            event.request.query_string = event.request.query_string.replace(
              new RegExp(`${param}=[^&]*`, 'gi'),
              `${param}=[REDACTED]`
            )
          }
        })
      }

      return event
    },

    // Before sending breadcrumbs
    beforeBreadcrumb(breadcrumb, hint) {
      // Don't send console.log breadcrumbs in production
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null
      }

      // Scrub sensitive data from HTTP breadcrumbs
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data?.url) {
          // Remove query parameters with sensitive data
          breadcrumb.data.url = breadcrumb.data.url.replace(
            /([?&])(token|password|secret|api_key)=[^&]*/gi,
            '$1$2=[REDACTED]'
          )
        }
      }

      return breadcrumb
    },

    // ========================
    // ADDITIONAL OPTIONS
    // ========================

    // Attach stack traces to messages
    attachStacktrace: true,

    // Enable automatic session tracking
    autoSessionTracking: true,

    // Enable debug mode in development
    debug: ENVIRONMENT === 'development',

    // Normalize depth for nested objects
    normalizeDepth: 5,
  })
}
