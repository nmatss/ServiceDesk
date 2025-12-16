/**
 * Prometheus Metrics Infrastructure
 *
 * Provides comprehensive metrics collection for:
 * - Application metrics (requests, errors, response times)
 * - Infrastructure metrics (CPU, memory, connections)
 * - Business metrics (tickets, SLA, users)
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// ======================
// CONFIGURATION
// ======================

const PREFIX = 'servicedesk_';
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// Enable default metrics collection (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  prefix: PREFIX,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ======================
// HTTP METRICS
// ======================

export const httpRequestsTotal = new Counter({
  name: `${PREFIX}http_requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: `${PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: DEFAULT_BUCKETS,
});

export const httpRequestSize = new Histogram({
  name: `${PREFIX}http_request_size_bytes`,
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
});

export const httpResponseSize = new Histogram({
  name: `${PREFIX}http_response_size_bytes`,
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
});

export const httpActiveRequests = new Gauge({
  name: `${PREFIX}http_active_requests`,
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'route'],
});

// ======================
// DATABASE METRICS
// ======================

export const dbQueriesTotal = new Counter({
  name: `${PREFIX}db_queries_total`,
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const dbQueryDuration = new Histogram({
  name: `${PREFIX}db_query_duration_seconds`,
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

export const dbActiveConnections = new Gauge({
  name: `${PREFIX}db_active_connections`,
  help: 'Number of active database connections',
});

export const dbTransactionsTotal = new Counter({
  name: `${PREFIX}db_transactions_total`,
  help: 'Total number of database transactions',
  labelNames: ['status'],
});

export const dbSlowQueriesTotal = new Counter({
  name: `${PREFIX}db_slow_queries_total`,
  help: 'Total number of slow database queries (>100ms)',
  labelNames: ['operation', 'table'],
});

// ======================
// AUTHENTICATION METRICS
// ======================

export const authAttemptsTotal = new Counter({
  name: `${PREFIX}auth_attempts_total`,
  help: 'Total authentication attempts',
  labelNames: ['method', 'status'],
});

export const authActiveSessionsGauge = new Gauge({
  name: `${PREFIX}auth_active_sessions`,
  help: 'Number of active user sessions',
});

export const auth2FAAttemptsTotal = new Counter({
  name: `${PREFIX}auth_2fa_attempts_total`,
  help: 'Total 2FA attempts',
  labelNames: ['method', 'status'],
});

export const authPasswordResetTotal = new Counter({
  name: `${PREFIX}auth_password_reset_total`,
  help: 'Total password reset requests',
  labelNames: ['status'],
});

// ======================
// TICKET METRICS
// ======================

export const ticketsCreatedTotal = new Counter({
  name: `${PREFIX}tickets_created_total`,
  help: 'Total tickets created',
  labelNames: ['priority', 'category', 'organization_id'],
});

export const ticketsResolvedTotal = new Counter({
  name: `${PREFIX}tickets_resolved_total`,
  help: 'Total tickets resolved',
  labelNames: ['priority', 'category', 'organization_id'],
});

export const ticketResolutionTime = new Histogram({
  name: `${PREFIX}ticket_resolution_time_seconds`,
  help: 'Time to resolve tickets in seconds',
  labelNames: ['priority', 'category'],
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400], // 1m to 24h
});

export const ticketsActiveGauge = new Gauge({
  name: `${PREFIX}tickets_active`,
  help: 'Number of active tickets',
  labelNames: ['priority', 'status'],
});

export const ticketCommentsTotal = new Counter({
  name: `${PREFIX}ticket_comments_total`,
  help: 'Total ticket comments',
  labelNames: ['user_type'],
});

// ======================
// SLA METRICS
// ======================

export const slaBreachesTotal = new Counter({
  name: `${PREFIX}sla_breaches_total`,
  help: 'Total SLA breaches',
  labelNames: ['priority', 'organization_id'],
});

export const slaComplianceRate = new Gauge({
  name: `${PREFIX}sla_compliance_rate`,
  help: 'SLA compliance rate (0-1)',
  labelNames: ['priority', 'organization_id'],
});

export const slaResponseTime = new Histogram({
  name: `${PREFIX}sla_response_time_seconds`,
  help: 'Time to first response in seconds',
  labelNames: ['priority'],
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400],
});

// ======================
// USER METRICS
// ======================

export const usersRegisteredTotal = new Counter({
  name: `${PREFIX}users_registered_total`,
  help: 'Total users registered',
  labelNames: ['role', 'organization_id'],
});

export const usersActiveGauge = new Gauge({
  name: `${PREFIX}users_active`,
  help: 'Number of active users (last 5 minutes)',
});

export const userActionsTotal = new Counter({
  name: `${PREFIX}user_actions_total`,
  help: 'Total user actions',
  labelNames: ['action_type', 'resource_type'],
});

// ======================
// KNOWLEDGE BASE METRICS
// ======================

export const kbArticlesViewedTotal = new Counter({
  name: `${PREFIX}kb_articles_viewed_total`,
  help: 'Total knowledge base articles viewed',
  labelNames: ['article_id'],
});

export const kbSearchesTotal = new Counter({
  name: `${PREFIX}kb_searches_total`,
  help: 'Total knowledge base searches',
  labelNames: ['has_results'],
});

export const kbArticlesHelpfulTotal = new Counter({
  name: `${PREFIX}kb_articles_helpful_total`,
  help: 'Total helpful votes on KB articles',
  labelNames: ['article_id', 'helpful'],
});

// ======================
// ERROR METRICS
// ======================

export const errorsTotal = new Counter({
  name: `${PREFIX}errors_total`,
  help: 'Total application errors',
  labelNames: ['error_type', 'severity'],
});

export const apiErrorsTotal = new Counter({
  name: `${PREFIX}api_errors_total`,
  help: 'Total API errors',
  labelNames: ['method', 'route', 'error_type'],
});

export const dbErrorsTotal = new Counter({
  name: `${PREFIX}db_errors_total`,
  help: 'Total database errors',
  labelNames: ['operation', 'error_type'],
});

// ======================
// CACHE METRICS
// ======================

export const cacheHitsTotal = new Counter({
  name: `${PREFIX}cache_hits_total`,
  help: 'Total cache hits',
  labelNames: ['cache_type'],
});

export const cacheMissesTotal = new Counter({
  name: `${PREFIX}cache_misses_total`,
  help: 'Total cache misses',
  labelNames: ['cache_type'],
});

export const cacheSize = new Gauge({
  name: `${PREFIX}cache_size_bytes`,
  help: 'Cache size in bytes',
  labelNames: ['cache_type'],
});

// ======================
// BACKGROUND JOB METRICS
// ======================

export const jobExecutionsTotal = new Counter({
  name: `${PREFIX}job_executions_total`,
  help: 'Total background job executions',
  labelNames: ['job_type', 'status'],
});

export const jobDuration = new Histogram({
  name: `${PREFIX}job_duration_seconds`,
  help: 'Background job duration in seconds',
  labelNames: ['job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
});

export const jobQueueSize = new Gauge({
  name: `${PREFIX}job_queue_size`,
  help: 'Number of jobs in queue',
  labelNames: ['job_type'],
});

// ======================
// WEBSOCKET METRICS
// ======================

export const websocketConnectionsActive = new Gauge({
  name: `${PREFIX}websocket_connections_active`,
  help: 'Number of active WebSocket connections',
});

export const websocketMessagesTotal = new Counter({
  name: `${PREFIX}websocket_messages_total`,
  help: 'Total WebSocket messages',
  labelNames: ['direction', 'event_type'],
});

export const websocketConnectionsTotal = new Counter({
  name: `${PREFIX}websocket_connections_total`,
  help: 'Total WebSocket connections',
  labelNames: ['action'],
});

// ======================
// RATE LIMITING METRICS
// ======================

export const rateLimitHitsTotal = new Counter({
  name: `${PREFIX}rate_limit_hits_total`,
  help: 'Total rate limit hits',
  labelNames: ['endpoint', 'user_type'],
});

export const rateLimitRemainingGauge = new Gauge({
  name: `${PREFIX}rate_limit_remaining`,
  help: 'Remaining rate limit tokens',
  labelNames: ['endpoint', 'user_id'],
});

// ======================
// BUSINESS METRICS
// ======================

export const revenueTotal = new Counter({
  name: `${PREFIX}revenue_total_cents`,
  help: 'Total revenue in cents',
  labelNames: ['organization_id', 'plan_type'],
});

export const activeOrganizationsGauge = new Gauge({
  name: `${PREFIX}organizations_active`,
  help: 'Number of active organizations',
});

export const customerSatisfactionScore = new Gauge({
  name: `${PREFIX}customer_satisfaction_score`,
  help: 'Customer satisfaction score (1-5)',
  labelNames: ['organization_id'],
});

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
  requestSize?: number,
  responseSize?: number
) {
  httpRequestsTotal.inc({ method, route, status_code: statusCode });
  httpRequestDuration.observe({ method, route, status_code: statusCode }, durationSeconds);

  if (requestSize) {
    httpRequestSize.observe({ method, route }, requestSize);
  }
  if (responseSize) {
    httpResponseSize.observe({ method, route }, responseSize);
  }
}

/**
 * Record database query metrics
 */
export function recordDbQuery(
  operation: string,
  table: string,
  durationSeconds: number,
  success: boolean = true
) {
  const status = success ? 'success' : 'error';
  dbQueriesTotal.inc({ operation, table, status });
  dbQueryDuration.observe({ operation, table }, durationSeconds);

  // Track slow queries (>100ms)
  if (durationSeconds > 0.1) {
    dbSlowQueriesTotal.inc({ operation, table });
  }
}

/**
 * Record authentication attempt
 */
export function recordAuthAttempt(method: string, success: boolean) {
  const status = success ? 'success' : 'failure';
  authAttemptsTotal.inc({ method, status });
}

/**
 * Record ticket creation
 */
export function recordTicketCreated(priority: string, category: string, organizationId: number) {
  ticketsCreatedTotal.inc({
    priority,
    category,
    organization_id: organizationId.toString(),
  });
}

/**
 * Record ticket resolution
 */
export function recordTicketResolved(
  priority: string,
  category: string,
  organizationId: number,
  resolutionTimeSeconds: number
) {
  ticketsResolvedTotal.inc({
    priority,
    category,
    organization_id: organizationId.toString(),
  });
  ticketResolutionTime.observe({ priority, category }, resolutionTimeSeconds);
}

/**
 * Record SLA breach
 */
export function recordSLABreach(priority: string, organizationId: number) {
  slaBreachesTotal.inc({
    priority,
    organization_id: organizationId.toString(),
  });
}

/**
 * Record cache hit/miss
 */
export function recordCacheOperation(cacheType: string, hit: boolean) {
  if (hit) {
    cacheHitsTotal.inc({ cache_type: cacheType });
  } else {
    cacheMissesTotal.inc({ cache_type: cacheType });
  }
}

/**
 * Record background job execution
 */
export function recordJobExecution(
  jobType: string,
  durationSeconds: number,
  success: boolean
) {
  const status = success ? 'success' : 'failure';
  jobExecutionsTotal.inc({ job_type: jobType, status });
  jobDuration.observe({ job_type: jobType }, durationSeconds);
}

/**
 * Update active tickets count
 */
export function updateActiveTickets(priority: string, status: string, count: number) {
  ticketsActiveGauge.set({ priority, status }, count);
}

/**
 * Update active users count
 */
export function updateActiveUsers(count: number) {
  usersActiveGauge.set(count);
}

/**
 * Update WebSocket connections count
 */
export function updateWebSocketConnections(count: number) {
  websocketConnectionsActive.set(count);
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJSON(): Promise<any> {
  return await register.getMetricsAsJSON();
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  register.clear();
}

/**
 * Get registry for custom operations
 */
export function getRegistry() {
  return register;
}

// Export default metrics object
export default {
  // HTTP
  httpRequestsTotal,
  httpRequestDuration,
  httpActiveRequests,

  // Database
  dbQueriesTotal,
  dbQueryDuration,
  dbActiveConnections,

  // Auth
  authAttemptsTotal,
  authActiveSessionsGauge,

  // Tickets
  ticketsCreatedTotal,
  ticketsResolvedTotal,
  ticketResolutionTime,
  ticketsActiveGauge,

  // SLA
  slaBreachesTotal,
  slaComplianceRate,

  // Errors
  errorsTotal,
  apiErrorsTotal,

  // Cache
  cacheHitsTotal,
  cacheMissesTotal,

  // Jobs
  jobExecutionsTotal,
  jobDuration,

  // WebSocket
  websocketConnectionsActive,
  websocketMessagesTotal,

  // Helpers
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
};
