/**
 * Sentry Helper Utilities
 *
 * Centralized utilities for error tracking and monitoring with Sentry.
 * These helpers make it easy to capture errors with proper context.
 */

import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Error severity levels
 */
export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

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
    extra?: Record<string, any>
    level?: SentryLevel
  }
) {
  const { user, tags, extra, level = 'error' } = context || {}

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
    extra?: Record<string, any>
  }
) {
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
  [key: string]: any
}) {
  Sentry.setUser(user)
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 *
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category
 * @param level - Severity level
 * @param data - Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: SentryLevel = 'info',
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Wrap an API route handler with Sentry error tracking
 *
 * Usage:
 * export const GET = withSentry(async (request: NextRequest) => {
 *   // Your code here
 * })
 */
export function withSentry<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options?: {
    routeName?: string
    tags?: Record<string, string>
  }
): T {
  return (async (...args: any[]) => {
    const request = args[0] as NextRequest

    // Start a new transaction for performance monitoring
    const transaction = Sentry.startTransaction({
      name: options?.routeName || request.url,
      op: 'http.server',
      tags: {
        method: request.method,
        ...options?.tags,
      },
    })

    try {
      // Add request breadcrumb
      addBreadcrumb(
        `API Request: ${request.method} ${request.url}`,
        'http',
        'info',
        {
          method: request.method,
          url: request.url,
          headers: Object.fromEntries(request.headers),
        }
      )

      // Execute handler
      const response = await handler(...args)

      // Add response breadcrumb
      addBreadcrumb(
        `API Response: ${response.status}`,
        'http',
        response.status >= 400 ? 'warning' : 'info',
        {
          status: response.status,
        }
      )

      transaction.setStatus('ok')
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
        level: 'error',
      })

      transaction.setStatus('internal_error')

      // Re-throw to let Next.js handle it
      throw error
    } finally {
      transaction.finish()
    }
  }) as T
}

/**
 * Capture database errors with proper context
 *
 * @param error - The database error
 * @param query - The SQL query that failed (optional)
 * @param params - Query parameters (optional)
 */
export function captureDatabaseError(
  error: Error | unknown,
  query?: string,
  params?: any[]
) {
  captureException(error, {
    tags: {
      errorType: 'database',
      query: query ? 'provided' : 'not-provided',
    },
    extra: {
      query,
      params,
    },
    level: 'error',
  })
}

/**
 * Capture authentication errors
 *
 * @param error - The auth error
 * @param context - Auth context (username, method, etc.)
 */
export function captureAuthError(
  error: Error | unknown,
  context?: {
    username?: string
    method?: string
    provider?: string
  }
) {
  captureException(error, {
    tags: {
      errorType: 'authentication',
      authMethod: context?.method || 'unknown',
      authProvider: context?.provider || 'local',
    },
    extra: {
      username: context?.username,
    },
    level: 'warning',
  })
}

/**
 * Capture integration errors (external APIs, webhooks, etc.)
 *
 * @param error - The integration error
 * @param service - Name of the external service
 * @param operation - Operation being performed
 */
export function captureIntegrationError(
  error: Error | unknown,
  service: string,
  operation: string
) {
  captureException(error, {
    tags: {
      errorType: 'integration',
      service,
      operation,
    },
    level: 'error',
  })
}

/**
 * Measure performance of async operations
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
  const transaction = Sentry.startTransaction({
    name,
    op: 'function',
    tags,
  })

  try {
    const result = await operation()
    transaction.setStatus('ok')
    return result
  } catch (error) {
    transaction.setStatus('internal_error')
    throw error
  } finally {
    transaction.finish()
  }
}

/**
 * Create a span for a specific operation within a transaction
 *
 * @param name - Span name
 * @param operation - Async function to track
 * @param data - Additional span data
 */
export async function createSpan<T>(
  name: string,
  operation: () => Promise<T>,
  data?: Record<string, any>
): Promise<T> {
  const span = Sentry.getCurrentHub().getScope()?.getTransaction()?.startChild({
    op: 'function',
    description: name,
    data,
  })

  try {
    const result = await operation()
    span?.setStatus('ok')
    return result
  } catch (error) {
    span?.setStatus('internal_error')
    throw error
  } finally {
    span?.finish()
  }
}
