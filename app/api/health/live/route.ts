/**
 * Liveness Probe Endpoint
 *
 * Kubernetes liveness probe - checks if the application is running.
 * This probe should be simple and fast. If it fails, Kubernetes will restart the pod.
 *
 * Endpoint: GET /api/health/live
 * Response: 200 OK if alive, 503 if not
 */

import { NextRequest, NextResponse } from 'next/server';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/health/live
 *
 * Basic liveness check - always returns OK unless application is completely down
 */
export async function GET(_request: NextRequest) {
  try {
    // Simple check - if we can execute this code, we're alive
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };

    return NextResponse.json(status, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    // This should rarely happen
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  }
}
