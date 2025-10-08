/**
 * Example API Route with Sentry Integration
 *
 * This example demonstrates best practices for error tracking in API routes.
 * Use this as a template for implementing Sentry in your own routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  withSentry,
  captureException,
  captureDatabaseError,
  addBreadcrumb,
  setUser,
} from '@/lib/monitoring/sentry-helpers'
import db from '@/lib/db/connection'

// ========================
// APPROACH 1: Using withSentry wrapper (Recommended)
// ========================
// This automatically tracks performance and captures errors

export const GET = withSentry(
  async (request: NextRequest) => {
    try {
      // Add custom breadcrumb for debugging
      addBreadcrumb('Fetching example data', 'database', 'info')

      // Set user context (if authenticated)
      // This will be attached to all error reports
      const userId = request.headers.get('x-user-id')
      if (userId) {
        setUser({
          id: userId,
          // email: 'user@example.com', // Don't include PII unless necessary
        })
      }

      // Simulate database query
      const data = db.prepare('SELECT * FROM tickets LIMIT 10').all()

      return NextResponse.json({
        success: true,
        data,
      })
    } catch (error) {
      // Database errors are automatically captured by withSentry
      // But you can add more context if needed
      captureDatabaseError(
        error,
        'SELECT * FROM tickets LIMIT 10'
      )

      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      )
    }
  },
  {
    routeName: 'GET /api/example-with-sentry',
    tags: {
      feature: 'example',
      version: 'v1',
    },
  }
)

// ========================
// APPROACH 2: Manual error tracking (Alternative)
// ========================
// Use this if you need more control over error capture

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Add breadcrumb
    addBreadcrumb('Processing POST request', 'api', 'info', {
      bodyKeys: Object.keys(body),
    })

    // Simulate some processing
    if (!body.name) {
      throw new Error('Name is required')
    }

    // Simulate database operation
    try {
      const result = db.prepare(
        'INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        body.name,
        body.description || 'No description',
        1, // user_id
        1, // category_id
        1, // priority_id
        1, // status_id
        1  // tenant_id
      )

      return NextResponse.json({
        success: true,
        id: result.lastInsertRowid,
      })
    } catch (dbError) {
      // Capture database error with context
      captureDatabaseError(
        dbError,
        'INSERT INTO tickets',
        [body.name, body.description]
      )

      throw dbError
    }
  } catch (error) {
    // Capture general errors
    captureException(error, {
      tags: {
        route: '/api/example-with-sentry',
        method: 'POST',
      },
      extra: {
        requestUrl: request.url,
      },
      level: 'error',
    })

    // Return error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// ========================
// APPROACH 3: Testing error tracking
// ========================
// This endpoint intentionally throws errors for testing

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const errorType = searchParams.get('type')

  // Set user context for testing
  setUser({
    id: 'test-user-123',
    username: 'test.user',
  })

  switch (errorType) {
    case 'sync':
      // Synchronous error
      throw new Error('This is a test synchronous error')

    case 'async':
      // Asynchronous error
      await Promise.reject(new Error('This is a test async error'))
      break

    case 'database':
      // Database error
      try {
        db.prepare('SELECT * FROM non_existent_table').all()
      } catch (error) {
        captureDatabaseError(error, 'SELECT * FROM non_existent_table')
        throw error
      }
      break

    case 'validation':
      // Validation error (warning level)
      captureException(new Error('Invalid input data'), {
        tags: { errorType: 'validation' },
        level: 'warning',
      })
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      )

    case 'unhandled':
      // Unhandled promise rejection
      Promise.reject(new Error('Unhandled promise rejection'))
      return NextResponse.json({ success: true })

    default:
      return NextResponse.json({
        message: 'Use ?type=sync|async|database|validation|unhandled to test different error types',
      })
  }

  return NextResponse.json({ success: true })
}
