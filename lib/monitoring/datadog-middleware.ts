/**
 * Datadog APM Middleware for Request Tracing
 * Provides automatic HTTP request tracing and custom spans
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTracer } from './datadog-config'

/**
 * Middleware wrapper to add Datadog tracing to Next.js middleware
 */
export function withDatadogTrace(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const tracer = getTracer()
    const span = tracer.startSpan('next.middleware', {
      resource: `${request.method} ${request.nextUrl.pathname}`,
      tags: {
        'http.method': request.method,
        'http.url': request.url,
        'http.path': request.nextUrl.pathname,
        'http.query': request.nextUrl.search,
        'http.user_agent': request.headers.get('user-agent') || '',
        'span.kind': 'server',
      },
    })

    try {
      const response = await handler(request)

      // Add response tags
      span.setTag('http.status_code', response.status)
      span.setTag('http.status_text', response.statusText)

      return response
    } catch (error) {
      // Record error in span
      span.setTag('error', true)
      span.setTag('error.type', error instanceof Error ? error.name : 'Error')
      span.setTag('error.message', error instanceof Error ? error.message : String(error))
      span.setTag('error.stack', error instanceof Error ? error.stack : '')

      throw error
    } finally {
      span.finish()
    }
  }
}

/**
 * Trace an API route handler
 */
export function traceApiRoute<T>(
  operationName: string,
  handler: () => T | Promise<T>,
  tags?: Record<string, any>
): Promise<T> {
  const tracer = getTracer()
  const span = tracer.startSpan(`api.${operationName}`, {
    resource: operationName,
    tags: {
      'span.kind': 'server',
      ...tags,
    },
  })

  return tracer.scope().activate(span, async () => {
    try {
      const result = await handler()
      span.setTag('success', true)
      return result
    } catch (error) {
      span.setTag('error', true)
      span.setTag('error.type', error instanceof Error ? error.name : 'Error')
      span.setTag('error.message', error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      span.finish()
    }
  })
}

/**
 * Create a custom span for tracing specific operations
 */
export async function traceOperation<T>(
  operationName: string,
  operation: () => T | Promise<T>,
  tags?: Record<string, any>
): Promise<T> {
  const tracer = getTracer()
  const span = tracer.startSpan(operationName, {
    resource: operationName,
    tags: tags || {},
  })

  return tracer.scope().activate(span, async () => {
    try {
      const result = await operation()
      span.setTag('success', true)
      return result
    } catch (error) {
      span.setTag('error', true)
      span.setTag('error.type', error instanceof Error ? error.name : 'Error')
      span.setTag('error.message', error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      span.finish()
    }
  })
}

/**
 * Add custom tags to the current span
 */
export function addSpanTags(tags: Record<string, any>) {
  const tracer = getTracer()
  const span = tracer.scope().active()

  if (span) {
    Object.entries(tags).forEach(([key, value]) => {
      span.setTag(key, value)
    })
  }
}

/**
 * Add a custom metric to the current span
 */
export function recordMetric(name: string, value: number, tags?: Record<string, string>) {
  const tracer = getTracer()
  const span = tracer.scope().active()

  if (span) {
    span.setTag(`metric.${name}`, value)
    if (tags) {
      Object.entries(tags).forEach(([key, val]) => {
        span.setTag(`metric.${name}.${key}`, val)
      })
    }
  }
}
