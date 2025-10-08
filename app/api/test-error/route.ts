/**
 * Test Error Endpoint for Sentry Verification
 *
 * This endpoint intentionally throws errors to test Sentry integration
 * Should only be used in development/testing environments
 *
 * Usage:
 * - GET /api/test-error?type=simple - Test simple error
 * - GET /api/test-error?type=async - Test async error
 * - GET /api/test-error?type=database - Test database error
 * - GET /api/test-error?type=validation - Test validation error
 */

import { NextRequest, NextResponse } from 'next/server';
import { captureException, addBreadcrumb } from '@/lib/monitoring/sentry-helpers';
import { withObservability } from '@/lib/monitoring/observability';
import db from '@/lib/db/connection';

export const GET = withObservability(
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const errorType = searchParams.get('type') || 'simple';

    // Only allow in development
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_ERRORS !== 'true') {
      return NextResponse.json(
        { error: 'Test endpoints are disabled in production' },
        { status: 403 }
      );
    }

    addBreadcrumb('Test error endpoint called', 'test', 'info', {
      errorType,
    });

    try {
      switch (errorType) {
        case 'simple':
          throw new Error('Test error for Sentry verification - Simple synchronous error');

        case 'async':
          await new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Test error for Sentry verification - Async error'));
            }, 100);
          });
          break;

        case 'database':
          // Intentionally trigger a database error
          db.prepare('SELECT * FROM non_existent_table').get();
          break;

        case 'validation':
          throw new Error('Validation failed: Invalid test data');

        case 'auth':
          const authError = new Error('Authentication failed');
          authError.name = 'AuthenticationError';
          throw authError;

        case 'network':
          throw new Error('Network request failed: ECONNREFUSED');

        default:
          throw new Error(`Unknown error type: ${errorType}`);
      }
    } catch (error) {
      // Capture in Sentry with additional context
      captureException(error, {
        tags: {
          error_type: errorType,
          test_endpoint: 'true',
          environment: process.env.NODE_ENV || 'development',
        },
        extra: {
          requested_error_type: errorType,
          timestamp: new Date().toISOString(),
          user_agent: request.headers.get('user-agent'),
        },
        level: 'error',
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Error captured successfully in Sentry',
          error: {
            type: errorType,
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'Error',
          },
          instructions: {
            message: 'Check Sentry dashboard for this error',
            dashboard: 'https://sentry.io',
            tags_to_search: {
              error_type: errorType,
              test_endpoint: 'true',
            },
          },
        },
        { status: 500 }
      );
    }

    // This should never be reached
    return NextResponse.json({ message: 'No error thrown' });
  },
  {
    routeName: 'test.error',
    trackPerformance: true,
    logAudit: false,
    requiresAuth: false,
  }
);
