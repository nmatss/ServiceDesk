/**
 * Performance Metrics API
 *
 * Endpoints for monitoring and analyzing application performance
 */

import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/performance/monitoring'
import { cacheStrategy } from '@/lib/cache/strategy'
import { dbOptimizer } from '@/lib/db/optimizer'
import { createCompressedResponse } from '@/lib/api/compression'
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/performance/metrics
 * Get comprehensive performance statistics
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require admin authentication - exposes system internals
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;
    const acceptEncoding = request.headers.get('accept-encoding') || ''

    // Gather all performance metrics
    const metrics = {
      timestamp: new Date().toISOString(),

      // Performance Monitor Stats
      performance: performanceMonitor.getStats(),

      // Core Web Vitals Summary
      webVitals: performanceMonitor.getCoreWebVitalsSummary(),

      // Cache Statistics
      cache: {
        strategy: cacheStrategy.getStats(),
      },

      // Database Performance
      database: {
        optimizer: dbOptimizer.getPerformanceStats(),
        queryCache: dbOptimizer.getQueryCacheStats(),
        connectionPool: dbOptimizer.getConnectionPoolStats(),
        size: dbOptimizer.getDatabaseSize(),
      },

      // System Info
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    }

    // Return compressed response
    return createCompressedResponse(metrics, acceptEncoding, {
      headers: {
        'Cache-Control': 'private, max-age=10, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to get performance metrics', error)
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/performance/metrics
 * Record client-side performance metrics
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const data = await request.json()

    // Track based on metric type
    if (data.type === 'web-vital') {
      performanceMonitor.trackWebVital(data.metric)
    } else if (data.type === 'page-performance') {
      performanceMonitor.trackPagePerformance(data.entry)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to record performance metric', error)
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    )
  }
}
