/**
 * Web Vitals Collection Endpoint
 *
 * Collects Core Web Vitals metrics from the browser for Real User Monitoring (RUM)
 *
 * Metrics collected:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - TTFB (Time to First Byte)
 * - FCP (First Contentful Paint)
 * - INP (Interaction to Next Paint)
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor, WebVitalsMetric } from '@/lib/performance/monitoring';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { metric, url, userAgent, timestamp: _timestamp } = body;

    // Validate metric data
    if (!metric || !metric.name || typeof metric.value === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Invalid metric data' },
        { status: 400 }
      );
    }

    // Track the Web Vital
    performanceMonitor.trackWebVital(metric as WebVitalsMetric);

    // Log for analysis
    logger.info('Web Vital collected', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      url,
      userAgent: userAgent?.substring(0, 100), // Truncate user agent
    });

    return NextResponse.json({
      success: true,
      message: 'Web Vital recorded successfully',
      metric: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
      },
    });
  } catch (error) {
    logger.error('Failed to record Web Vital', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record Web Vital',
      },
      { status: 500 }
    );
  }
}

// Disable body size limit for this endpoint
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
