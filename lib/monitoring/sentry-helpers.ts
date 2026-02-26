/**
 * Sentry Helper Utilities
 *
 * Centralized utilities for error tracking and monitoring with Sentry.
 * These helpers make it easy to capture errors with proper context.
 *
 * Updated for Sentry SDK v8+ (using new startSpan API)
 *
 * IMPORTANT: This module is imported by middleware.ts which runs in Edge Runtime.
 * Edge Runtime does NOT allow eval(), new Function(), or dynamic require().
 * All Sentry access must be optional and gracefully degrade to no-ops.
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Error severity levels
 */
export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/**
 * Sentry SDK interface (subset of @sentry/nextjs that we use)
 */
interface SentryLike {
  captureException: (error: unknown, context?: Record<string, unknown>) => void
  captureMessage: (message: string, context?: Record<string, unknown>) => void
  setUser: (user: Record<string, unknown> | null) => void
  setTag: (key: string, value: string) => void
  setExtra: (key: string, value: unknown) => void
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void
  startSpan: <T>(options: Record<string, unknown>, callback: () => T) => T
}

/**
 * Cached Sentry module reference.
 * null = not yet loaded, undefined = load attempted but unavailable
 */
let _sentry: SentryLike | null | undefined = null

/**
 * Get the Sentry SDK if available.
 *
 * Returns null in development or if @sentry/nextjs is not installed.
 * Does NOT use eval() or dynamic require() — safe for Edge Runtime.
 * In Edge Runtime, Sentry will simply be unavailable (returns null).
 */
function getSentry(): SentryLike | null {
  if (process.env.NODE_ENV === 'development') {
    return null
  }

  if (_sentry !== null) {
    return _sentry || null
  }

  // In Edge Runtime, we cannot dynamically import Node.js modules.
  // Sentry integration should be set up via @sentry/nextjs instrumentation
  // which hooks into the framework automatically. These helpers gracefully
  // degrade to no-ops when Sentry is not available.
  _sentry = undefined
  return null
}

/**
 * Capture an exception with additional context
 *
 * @param error - The error to capture
 * @param context - Additional context for the error
 * @param level - Severity level (default: 'error')
 */
export function captureException(
  error: Error | unknown,
  context?: {
    user?: { id?: string; email?: string; username?: string }
    tags?: Record<string, string>
    extra?: Record<string, unknown>
    level?: SentryLevel
  }
) {
  const { user, tags, extra, level = 'error' } = context || {}

  const Sentry = getSentry()
  if (!Sentry) return

  Sentry.captureException(error, {
    level,
    user,
    tags,
    extra,
  })
}

/**
 * Capture a message (non-error event)
 *
 * @param message - The message to capture
 * @param level - Severity level (default: 'info')
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: SentryLevel = 'info',
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }
) {
  const Sentry = getSentry()
  if (!Sentry) return

  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  })
}

/**
 * Set user context for all subsequent error reports
 *
 * @param user - User information
 */
export function setUser(user: {
  id?: string
  email?: string
  username?: string
  [key: string]: unknown
}) {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.setUser(user)
}

/**
 * Clear user context
 */
export function clearUser() {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.setUser(null)
}

/**
 * Add a breadcrumb for debugging
 *
 * @param message - Breadcrumb message
 * @param category - Category (e.g., 'auth', 'api', 'ui')
 * @param level - Severity level
 * @param data - Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: SentryLevel = 'info',
  data?: Record<string, unknown>
) {
  const Sentry = getSentry()
  if (!Sentry) return

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  })
}

/**
 * Set a tag that will be added to all events
 *
 * @param key - Tag key
 * @param value - Tag value
 */
export function setTag(key: string, value: string) {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.setTag(key, value)
}

/**
 * Set extra context that will be added to all events
 *
 * @param key - Extra key
 * @param value - Extra value
 */
export function setExtra(key: string, value: unknown) {
  const Sentry = getSentry()
  if (!Sentry) return
  Sentry.setExtra(key, value)
}

/**
 * Wrap an API route handler with Sentry error tracking
 *
 * @param handler - The route handler function
 * @param options - Additional options
 */
export function withSentryApiRoute<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  options?: {
    routeName?: string
    tags?: Record<string, string>
  }
): T {
  return (async (...args: unknown[]) => {
    const request = args[0] as NextRequest
    const Sentry = getSentry()

    try {
      // Add request breadcrumb
      addBreadcrumb(
        `API Request: ${request.method} ${request.url}`,
        'http',
        'info',
        {
          method: request.method,
          url: request.url,
        }
      )

      // Execute handler with span tracking if Sentry is available
      let response: NextResponse
      if (Sentry) {
        response = await Sentry.startSpan(
          {
            name: options?.routeName || request.url,
            op: 'http.server',
            attributes: {
              method: request.method,
              ...options?.tags,
            },
          },
          async () => handler(...args) as Promise<NextResponse>
        )
      } else {
        response = await handler(...args) as NextResponse
      }

      // Add response breadcrumb
      addBreadcrumb(
        `API Response: ${response.status}`,
        'http',
        response.status >= 400 ? 'warning' : 'info',
        {
          status: response.status,
        }
      )

      return response
    } catch (error) {
      // Capture error with context
      captureException(error, {
        tags: {
          route: request.url,
          method: request.method,
          ...options?.tags,
        },
        extra: {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers),
        },
      })

      // Re-throw to let Next.js handle the error
      throw error
    }
  }) as T
}

/**
 * Capture API errors with standardized context
 *
 * @param error - The error that occurred
 * @param request - The incoming request
 * @param context - Additional context
 */
export function captureApiError(
  error: Error | unknown,
  request: NextRequest,
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }
) {
  captureException(error, {
    tags: {
      'api.route': request.url,
      'api.method': request.method,
      ...context?.tags,
    },
    extra: {
      url: request.url,
      method: request.method,
      ...context?.extra,
    },
    level: 'error',
  })
}

/**
 * Measure performance of async operations using Sentry spans
 *
 * @param name - Operation name
 * @param operation - Async function to measure
 * @param tags - Additional tags
 */
export async function measurePerformance<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const Sentry = getSentry()
  if (!Sentry) return operation()

  return Sentry.startSpan(
    {
      name,
      op: 'function',
      attributes: tags,
    },
    async () => {
      try {
        return await operation()
      } catch (error) {
        captureException(error, { tags })
        throw error
      }
    }
  )
}

/**
 * Create a span for a specific operation
 *
 * @param name - Span name
 * @param operation - Async function to track
 * @param data - Additional span data
 */
export async function createSpan<T>(
  name: string,
  operation: () => Promise<T>,
  data?: Record<string, unknown>
): Promise<T> {
  const Sentry = getSentry()
  if (!Sentry) return operation()

  return Sentry.startSpan(
    {
      name,
      op: 'function',
      attributes: data as Record<string, string>,
    },
    operation
  )
}

/**
 * Track database query performance
 *
 * @param queryName - Name/description of the query
 * @param query - Query function to execute
 */
export async function trackDatabaseQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const Sentry = getSentry()
  if (!Sentry) return query()

  return Sentry.startSpan(
    {
      name: queryName,
      op: 'db.query',
    },
    async () => {
      try {
        return await query()
      } catch (error) {
        captureException(error, {
          tags: { 'db.query': queryName },
        })
        throw error
      }
    }
  )
}

/**
 * Track external API call performance
 *
 * @param serviceName - Name of the external service
 * @param apiCall - API call function to execute
 */
export async function trackExternalCall<T>(
  serviceName: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const Sentry = getSentry()
  if (!Sentry) return apiCall()

  return Sentry.startSpan(
    {
      name: serviceName,
      op: 'http.client',
    },
    async () => {
      addBreadcrumb(`External call: ${serviceName}`, 'http', 'info')

      try {
        return await apiCall()
      } catch (error) {
        captureException(error, {
          tags: { 'external.service': serviceName },
        })
        throw error
      }
    }
  )
}

/**
 * Capture authentication-related errors
 *
 * @param error - The error that occurred
 * @param context - Additional context about the auth attempt
 */
export function captureAuthError(
  error: Error | unknown,
  context?: {
    method?: string
    userId?: string
    email?: string
    [key: string]: unknown
  }
) {
  captureException(error, {
    tags: {
      'auth.method': context?.method || 'unknown',
    },
    extra: context,
    level: 'warning',
  })
}

/**
 * Capture database-related errors with query context
 *
 * @param error - The error that occurred
 * @param query - The SQL query that failed
 * @param params - Query parameters (optional)
 */
export function captureDatabaseError(
  error: Error | unknown,
  query?: string,
  params?: unknown[]
) {
  captureException(error, {
    tags: {
      'error.type': 'database',
      'db.query': query ? query.substring(0, 100) : 'unknown',
    },
    extra: {
      query,
      params: params?.map(p => typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p),
    },
    level: 'error',
  })
}

/**
 * Capture integration-related errors (external APIs, webhooks, etc.)
 *
 * @param error - The error that occurred
 * @param integration - Name of the integration (e.g., 'whatsapp', 'govbr')
 * @param context - Additional context
 */
export function captureIntegrationError(
  error: Error | unknown,
  integration: string,
  context?: Record<string, unknown>
) {
  captureException(error, {
    tags: {
      'error.type': 'integration',
      'integration.name': integration,
    },
    extra: context,
    level: 'error',
  })
}

/**
 * Alias for withSentryApiRoute for backward compatibility
 */
export const withSentry = withSentryApiRoute

export default {
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
  setExtra,
  withSentryApiRoute,
  withSentry,
  captureApiError,
  captureAuthError,
  captureDatabaseError,
  captureIntegrationError,
  measurePerformance,
  createSpan,
  trackDatabaseQuery,
  trackExternalCall,
}
