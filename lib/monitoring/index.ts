/**
 * Monitoring & Observability - Main Export
 *
 * Central export for all monitoring and observability features.
 * Import from this file to access all monitoring functionality.
 */

// Prometheus Metrics
export {
  // Metrics instances
  httpRequestsTotal,
  httpRequestDuration,
  dbQueriesTotal,
  dbQueryDuration,
  ticketsCreatedTotal,
  ticketsResolvedTotal,
  slaBreachesTotal,
  authAttemptsTotal,
  errorsTotal,

  // Helper functions
  recordHttpRequest,
  recordDbQuery,
  recordAuthAttempt,
  recordTicketCreated,
  recordTicketResolved,
  recordSLABreach,
  recordCacheOperation,
  recordJobExecution,
  updateActiveTickets,
  updateActiveUsers,
  updateWebSocketConnections,

  // Registry
  getMetrics,
  getMetricsJSON,
  clearMetrics,
  getRegistry,
} from './metrics';

// Structured Logging
export {
  structuredLogger,
  LogLevel,
  createChildLogger,
  logHttpRequest,
  logDatabaseQuery,
  logAuthEvent,
  logSecurityEvent,
  logBusinessMetric,
  logError,
  generateCorrelationId,
  createRequestLogger,
} from './structured-logger';

// Legacy Logger (for backward compatibility)
export { logger, EventType } from './logger';

// Sentry Error Tracking
export {
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  withSentry,
  captureDatabaseError,
  captureAuthError,
  captureIntegrationError,
  measurePerformance,
  createSpan,
} from './sentry-helpers';

// Datadog APM
export {
  getTracer,
  initializeDatadogAPM,
  shutdownDatadogAPM,
  traceFilters,
  shouldIgnorePath,
  sanitizeHeaders,
  sanitizeQueryParams,
} from './datadog-config';

export {
  ddTracer,
  DatadogTracer,
  Trace,
  TraceSync,
} from './datadog-tracer';

export {
  ticketMetrics,
  authMetrics,
  databaseMetrics,
  apiMetrics,
  knowledgeBaseMetrics,
  systemMetrics,
} from './datadog-metrics';

// Unified Observability
// Note: Observability module exports would go here when implemented
// export { withObservability, trackDatabaseQuery, ... } from './observability';

// Performance Monitoring
// Note: Performance monitoring exports would go here when implemented
// export { performanceMonitor } from '../performance/monitoring';

// Types
// Note: These types would be exported when observability module is implemented
// export type { ObservabilityContext, ApiRouteOptions, DatabaseQueryOptions } from './observability';

export type {
  LogMetadata,
} from './structured-logger';

export type {
  SentryLevel,
} from './sentry-helpers';

export type {
  SpanAttributes,
  TraceContext,
} from './datadog-tracer';

// ======================
// INITIALIZATION
// ======================

/**
 * Initialize all monitoring services
 * Call this in your application startup (e.g., instrumentation.ts)
 */
export function initializeMonitoring() {
  const { initializeDatadogAPM } = require('./datadog-config');
  const { structuredLogger } = require('./structured-logger');

  structuredLogger.info('Initializing monitoring services', {
    sentryEnabled: !!process.env.SENTRY_DSN,
    datadogEnabled: process.env.DD_TRACE_ENABLED === 'true',
    prometheusEnabled: true,
  });

  // Initialize Datadog APM
  if (process.env.DD_TRACE_ENABLED === 'true') {
    initializeDatadogAPM();
  }

  // Note: Sentry is initialized in sentry.*.config.ts files
  // Prometheus metrics are collected automatically

  structuredLogger.info('Monitoring services initialized');
}

// ======================
// CONVENIENCE EXPORTS
// ======================

// Import the individual exports to use in the convenience object
import {
  recordHttpRequest as _recordHttpRequest,
  recordDbQuery as _recordDbQuery,
  recordTicketCreated as _recordTicketCreated,
  recordTicketResolved as _recordTicketResolved,
  recordSLABreach as _recordSLABreach
} from './metrics';

import {
  structuredLogger as _structuredLogger,
  logError as _logError
} from './structured-logger';

import { ddTracer as _ddTracer } from './datadog-tracer';
import { captureException as _captureException } from './sentry-helpers';

/**
 * Quick access to commonly used functions
 */
export const monitoring = {
  // Metrics
  recordHttpRequest: _recordHttpRequest,
  recordDbQuery: _recordDbQuery,
  recordTicketCreated: _recordTicketCreated,
  recordTicketResolved: _recordTicketResolved,
  recordSLABreach: _recordSLABreach,

  // Logging
  log: _structuredLogger,
  error: _logError,

  // Tracing
  trace: _ddTracer.trace.bind(_ddTracer),

  // Errors
  captureError: _captureException,
} as const;

export default monitoring;
