/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for server-side error tracking.
 * It runs in Node.js and captures:
 * - Server-side errors
 * - API route errors
 * - Database errors
 * - Background job failures
 */

import { logger } from '@/lib/monitoring/logger';

const SENTRY_DSN = process.env.SENTRY_DSN
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true'
const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'

async function initSentryServer() {
  if (!SENTRY_ENABLED || !SENTRY_DSN) {
    return
  }

  try {
    const Sentry = await import('@sentry/nextjs')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integrations: any[] = []

    if (typeof Sentry.httpIntegration === 'function') {
      integrations.push(Sentry.httpIntegration())
    }

    // Note: nodeProfilingIntegration requires @sentry/profiling-node package
    // which is not currently installed. Skipping profiling integration.

    Sentry.init({
      // Data Source Name - where to send errors
      dsn: SENTRY_DSN,

      // Environment identification
      environment: ENVIRONMENT,

      // Release version (use git SHA in production)
      release: process.env.SENTRY_RELEASE,

      // ========================
      // SAMPLING CONFIGURATION
      // ========================

      // Percentage of error events to send (1.0 = 100%)
      sampleRate: parseFloat(process.env.SENTRY_ERROR_SAMPLE_RATE || '1.0'),

      // Percentage of transactions to trace for performance monitoring
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

      // ========================
      // ERROR FILTERING
      // ========================

      // Ignore specific errors
      ignoreErrors: [
        // Network errors that are out of our control
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',

        // Client disconnections
        'Client closed connection',
        'socket hang up',

        // Expected authentication errors
        'JsonWebTokenError',
        'TokenExpiredError',

        // Rate limiting (expected behavior)
        'Too Many Requests',
      ],

      // ========================
      // INTEGRATIONS
      // ========================

      integrations,

      // ========================
      // PRIVACY & SECURITY
      // ========================

      // Before sending events, scrub sensitive data
      beforeSend(event) {
        // Don't send events in development
        if (ENVIRONMENT === 'development') {
          return null
        }

        // Remove sensitive data from contexts
        if (event.contexts?.headers) {
          delete event.contexts.headers.authorization
          delete event.contexts.headers.cookie
        }

        // Remove sensitive environment variables
        const runtimeEnv = event.contexts?.runtime?.env as Record<string, string> | undefined
        if (runtimeEnv) {
          const sensitiveEnvVars = [
            'JWT_SECRET',
            'SESSION_SECRET',
            'DATABASE_URL',
            'SENTRY_AUTH_TOKEN',
            'OPENAI_API_KEY',
            'SMTP_PASSWORD',
            'AWS_SECRET_ACCESS_KEY',
          ]

          sensitiveEnvVars.forEach(key => {
            if (runtimeEnv[key]) {
              runtimeEnv[key] = '[REDACTED]'
            }
          })
        }

        // Add server information
        event.server_name = process.env.HOSTNAME || 'unknown'

        return event
      },

      // ========================
      // ADDITIONAL OPTIONS
      // ========================

      // Attach stack traces to messages
      attachStacktrace: true,

      // Enable debug mode in development
      debug: ENVIRONMENT === 'development',

      // Normalize depth for nested objects
      normalizeDepth: 5,
    })

    logger.info('Sentry server initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize Sentry server', error)
  }
}

initSentryServer()

// Export to make this a proper ES module (required for dynamic import)
export {}
