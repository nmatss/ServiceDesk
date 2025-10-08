/**
 * Unified Observability Infrastructure
 *
 * This module provides a single interface for all observability features:
 * - Performance tracking
 * - Error monitoring (Sentry)
 * - Distributed tracing (Datadog)
 * - Metrics collection
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { performanceMonitor } from '../performance/monitoring';
import { captureException, withSentry } from './sentry-helpers';
import { ddTracer } from './datadog-tracer';
import {
  ticketMetrics,
  authMetrics,
  databaseMetrics,
  apiMetrics
} from './datadog-metrics';
import { logAuditAction } from '../audit/logger';

// ========================
// TYPE DEFINITIONS
// ========================

export interface ObservabilityContext {
  requestId: string;
  startTime: number;
  userId?: number;
  tenantId?: number;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiRouteOptions {
  routeName?: string;
  requiresAuth?: boolean;
  trackPerformance?: boolean;
  logAudit?: boolean;
  tags?: Record<string, string>;
}

export interface DatabaseQueryOptions {
  queryType: string;
  operation: string;
  table?: string;
  tags?: Record<string, string>;
}

// ========================
// CONTEXT MANAGEMENT
// ========================

/**
 * Create observability context from request
 */
export function createObservabilityContext(request: NextRequest): ObservabilityContext {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const userId = request.headers.get('x-user-id');
  const tenantId = request.headers.get('x-tenant-id');
  const userRole = request.headers.get('x-user-role');
  const ipAddress =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return {
    requestId,
    startTime: Date.now(),
    userId: userId ? parseInt(userId, 10) : undefined,
    tenantId: tenantId ? parseInt(tenantId, 10) : undefined,
    userRole,
    ipAddress,
    userAgent,
  };
}

// ========================
// API ROUTE WRAPPER
// ========================

/**
 * Wrap API route handler with full observability
 *
 * Features:
 * - Automatic performance tracking
 * - Error capture and reporting
 * - Distributed tracing
 * - Metrics collection
 * - Audit logging
 * - Request/response logging
 *
 * @example
 * export const GET = withObservability(
 *   async (request: NextRequest) => {
 *     // Your handler code
 *     return NextResponse.json({ data: 'hello' });
 *   },
 *   { routeName: 'tickets.list', trackPerformance: true }
 * );
 */
export function withObservability<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: ApiRouteOptions = {}
): T {
  const {
    routeName = 'unknown',
    requiresAuth = false,
    trackPerformance = true,
    logAudit = false,
    tags = {},
  } = options;

  return (async (...args: any[]) => {
    const request = args[0] as NextRequest;
    const context = createObservabilityContext(request);

    // Extract route information
    const method = request.method;
    const pathname = request.nextUrl.pathname;
    const fullRouteName = routeName || `${method} ${pathname}`;

    // Start Datadog trace
    return await ddTracer.trace(
      `api.${fullRouteName}`,
      async (span) => {
        // Set trace tags
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', request.url);
        span.setAttribute('http.path', pathname);
        span.setAttribute('request.id', context.requestId);

        if (context.userId) {
          span.setAttribute('user.id', context.userId);
        }
        if (context.tenantId) {
          span.setAttribute('tenant.id', context.tenantId);
        }
        if (context.userRole) {
          span.setAttribute('user.role', context.userRole);
        }

        // Add custom tags
        Object.entries(tags).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });

        try {
          // Log request start
          logger.api(
            `${method} ${pathname} started`,
            0,
            { routeName: fullRouteName },
            {
              request_id: context.requestId,
              user_id: context.userId,
              tenant_id: context.tenantId,
              ip_address: context.ipAddress,
              user_agent: context.userAgent,
            }
          );

          // Execute handler
          const response = await handler(...args);
          const duration = Date.now() - context.startTime;

          // Track performance
          if (trackPerformance) {
            performanceMonitor.trackApiResponse(pathname, duration, response.status);
          }

          // Record metrics
          apiMetrics.request(method, pathname, response.status, duration);

          // Log successful response
          logger.api(
            `${method} ${pathname} completed`,
            duration,
            {
              routeName: fullRouteName,
              statusCode: response.status,
            },
            {
              request_id: context.requestId,
              user_id: context.userId,
              tenant_id: context.tenantId,
            }
          );

          // Audit logging
          if (logAudit && context.userId) {
            logAuditAction({
              user_id: context.userId,
              action: 'api_request',
              resource_type: 'api',
              new_values: JSON.stringify({
                method,
                path: pathname,
                status: response.status,
                duration,
              }),
              ip_address: context.ipAddress,
              user_agent: context.userAgent,
            });
          }

          // Set response headers
          response.headers.set('X-Request-ID', context.requestId);
          response.headers.set('X-Response-Time', `${duration}ms`);

          return response;
        } catch (error) {
          const duration = Date.now() - context.startTime;

          // Capture error in Sentry
          captureException(error, {
            user: context.userId
              ? {
                  id: context.userId.toString(),
                  username: context.userRole || 'unknown',
                }
              : undefined,
            tags: {
              route: fullRouteName,
              method,
              path: pathname,
              request_id: context.requestId,
              ...tags,
            },
            extra: {
              duration,
              tenantId: context.tenantId,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
            level: 'error',
          });

          // Record error metric
          apiMetrics.error(method, pathname, error instanceof Error ? error.name : 'Unknown');

          // Log error
          logger.error(
            `${method} ${pathname} failed`,
            {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              duration,
            },
            {
              request_id: context.requestId,
              user_id: context.userId,
              tenant_id: context.tenantId,
            }
          );

          // Return error response
          return NextResponse.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Internal server error',
              requestId: context.requestId,
            },
            {
              status: 500,
              headers: {
                'X-Request-ID': context.requestId,
                'X-Response-Time': `${duration}ms`,
              },
            }
          );
        }
      },
      {
        'span.kind': 'server',
        'service.name': process.env.DD_SERVICE || 'servicedesk',
      }
    );
  }) as T;
}

// ========================
// DATABASE QUERY TRACKING
// ========================

/**
 * Wrap database query with observability
 *
 * @example
 * const users = await trackDatabaseQuery(
 *   'SELECT * FROM users WHERE id = ?',
 *   () => db.prepare('SELECT * FROM users WHERE id = ?').all(userId),
 *   { queryType: 'select', operation: 'users.findById', table: 'users' }
 * );
 */
export async function trackDatabaseQuery<T>(
  query: string,
  operation: () => T | Promise<T>,
  options: DatabaseQueryOptions
): Promise<T> {
  const { queryType, operation: operationName, table, tags = {} } = options;
  const startTime = Date.now();

  return await ddTracer.trace(
    `db.${operationName}`,
    async (span) => {
      // Set database-specific tags
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', queryType);
      if (table) {
        span.setAttribute('db.table', table);
      }
      span.setAttribute('db.statement', query.substring(0, 200)); // Limit query length

      // Add custom tags
      Object.entries(tags).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });

      try {
        const result = await operation();
        const duration = Date.now() - startTime;

        // Track performance
        performanceMonitor.trackDbQuery(query, duration);

        // Record metrics
        databaseMetrics.queryExecutionTime(queryType, duration);

        // Log slow queries
        if (duration > 100) {
          logger.warn('Slow database query detected', {
            query: query.substring(0, 200),
            duration,
            queryType,
            operation: operationName,
            table,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log error
        logger.error('Database query failed', {
          error: error instanceof Error ? error.message : String(error),
          query: query.substring(0, 200),
          duration,
          queryType,
          operation: operationName,
          table,
        });

        // Capture in Sentry
        captureException(error, {
          tags: {
            errorType: 'database',
            queryType,
            operation: operationName,
            table: table || 'unknown',
          },
          extra: {
            query: query.substring(0, 500),
            duration,
          },
        });

        throw error;
      }
    },
    { 'span.kind': 'client' }
  );
}

// ========================
// BUSINESS METRICS HELPERS
// ========================

/**
 * Track ticket-related metrics
 */
export const trackTicketMetrics = {
  created: (priority: string, category: string, organizationId: number) => {
    ticketMetrics.created(priority, category, organizationId);
    logger.info('Ticket created', { priority, category, organizationId });
  },

  resolved: (
    priority: string,
    category: string,
    organizationId: number,
    resolutionTimeMs: number
  ) => {
    ticketMetrics.resolved(priority, category, organizationId, resolutionTimeMs);
    logger.info('Ticket resolved', {
      priority,
      category,
      organizationId,
      resolutionTimeMs,
    });
  },

  slaBreached: (priority: string, organizationId: number) => {
    ticketMetrics.slaBreached(priority, organizationId);
    logger.warn('SLA breached', { priority, organizationId });
  },
};

/**
 * Track authentication metrics
 */
export const trackAuthMetrics = {
  loginSuccess: (userId: number, organizationId: number, method: string = 'password') => {
    authMetrics.loginSuccess(userId, organizationId, method);
    logger.auth('Login successful', userId, { method, organizationId });
  },

  loginFailed: (email: string, reason: string) => {
    authMetrics.loginFailed(email, reason);
    logger.security('Login failed', { email, reason });
  },

  registered: (userId: number, organizationId: number, role: string) => {
    authMetrics.registered(userId, organizationId, role);
    logger.auth('User registered', userId, { organizationId, role });
  },
};

// ========================
// HEALTH CHECK HELPER
// ========================

/**
 * Get observability health status
 */
export function getObservabilityHealth() {
  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    checks: {
      sentry: {
        enabled: !!process.env.SENTRY_DSN,
        status: 'ok' as 'ok' | 'error',
      },
      datadog: {
        enabled: process.env.DD_TRACE_ENABLED === 'true',
        status: 'ok' as 'ok' | 'error',
      },
      logging: {
        enabled: true,
        status: 'ok' as 'ok' | 'error',
      },
      performance: {
        enabled: true,
        status: 'ok' as 'ok' | 'error',
      },
    },
    metrics: performanceMonitor.getStats(),
  };

  // Determine overall health status
  const hasErrors = Object.values(health.checks).some((check) => check.status === 'error');
  if (hasErrors) {
    health.status = 'unhealthy';
  }

  return health;
}

// ========================
// EXPORTS
// ========================

export {
  logger,
  performanceMonitor,
  captureException,
  ddTracer,
  ticketMetrics,
  authMetrics,
  databaseMetrics,
  apiMetrics,
};
