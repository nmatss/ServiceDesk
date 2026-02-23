// @ts-nocheck
/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures Sentry for Edge Runtime (middleware).
 * Edge Runtime runs in V8 isolates and has different capabilities.
 *
 * IMPORTANT: Do NOT import Node.js modules here - this file runs in Edge runtime.
 */

// Edge-compatible logger (no Node.js dependencies)
const edgeLogger = {
  error: (message: string, ...args: unknown[]) => console.error(`[SENTRY-EDGE] ${message}`, ...args),
  info: (message: string, ...args: unknown[]) => console.log(`[SENTRY-EDGE] ${message}`, ...args),
};

const SENTRY_DSN = process.env.SENTRY_DSN
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true'
const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'

// Initialize Sentry only if DSN is configured
if (SENTRY_ENABLED && SENTRY_DSN) {
  // Lazy import to avoid build-time incompatibilities in dev
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const Sentry = eval('require')('@sentry/nextjs')

  Sentry.init({
    // Data Source Name - where to send errors
    dsn: SENTRY_DSN,

    // Environment identification
    environment: ENVIRONMENT,

    // Release version
    release: process.env.SENTRY_RELEASE,

    // ========================
    // SAMPLING CONFIGURATION
    // ========================

    // Percentage of error events to send
    sampleRate: parseFloat(process.env.SENTRY_ERROR_SAMPLE_RATE || '1.0'),

    // Percentage of transactions to trace
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'), // Lower for edge

    // ========================
    // ERROR FILTERING
    // ========================

    ignoreErrors: [
      // Expected middleware errors
      'Unauthorized',
      'Forbidden',
      'Not Found',
    ],

    // ========================
    // PRIVACY & SECURITY
    // ========================

    beforeSend(event, hint) {
      // Don't send events in development
      if (ENVIRONMENT === 'development') {
        edgeLogger.error('Sentry event (edge)', event, hint)
        return null
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['Cookie']
      }

      return event
    },

    // ========================
    // ADDITIONAL OPTIONS
    // ========================

    attachStacktrace: true,
    debug: ENVIRONMENT === 'development',
  })
}
