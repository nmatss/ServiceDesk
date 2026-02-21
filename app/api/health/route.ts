/**
 * Health Check API Route
 *
 * Provides system health and observability status
 * Use this endpoint for monitoring and alerting
 */

import { NextRequest, NextResponse } from 'next/server';
import { withObservability, getObservabilityHealth } from '@/lib/monitoring/observability';
import { checkDatabaseHealth, checkRedisHealth } from '@/lib/health/dependency-checks';
/**
 * GET /api/health
 *
 * Returns health status of the application and its dependencies
 */
export const GET = withObservability(
  async (_request: NextRequest) => {
    const checks: Record<string, any> = {};

    // Check database connectivity
    checks.database = await checkDatabaseHealth();
    checks.redis = await checkRedisHealth();

    // Get observability health
    const observability = getObservabilityHealth();
    checks.observability = observability;

    // Determine overall health
    const hasErrors =
      checks.database.status === 'error' ||
      checks.redis.status === 'error' ||
      observability.status === 'unhealthy';
    const status = hasErrors ? 'unhealthy' : 'healthy';

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        version: process.env.DD_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks,
      },
      {
        status: hasErrors ? 503 : 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  },
  {
    routeName: 'health.check',
    trackPerformance: true,
    requiresAuth: false,
    logAudit: false,
  }
);
