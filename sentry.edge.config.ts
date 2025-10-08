/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures Sentry for Edge Runtime (middleware).
 * Edge Runtime runs in V8 isolates and has different capabilities.
 */

import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/monitoring/logger';

const SENTRY_DSN = process.env.SENTRY_DSN
const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'

// Initialize Sentry only if DSN is configured
if (SENTRY_DSN) {
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
        logger.error('Sentry event (edge)', event, hint)
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
