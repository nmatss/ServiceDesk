/**
 * Prometheus Metrics Endpoint
 *
 * This endpoint exposes application metrics in Prometheus format.
 * Configure your Prometheus server to scrape this endpoint.
 *
 * Endpoint: GET /api/metrics
 * Format: Prometheus text format
 * Auth: Optional (can be configured with API key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/monitoring/metrics';

/**
 * GET /api/metrics
 *
 * Returns all application metrics in Prometheus format
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add API key authentication
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.METRICS_API_KEY;

    if (expectedApiKey && apiKey !== expectedApiKey) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'API Key',
        },
      });
    }

    // Get metrics in Prometheus format
    const metrics = await getMetrics();

    // Return metrics with proper content type
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
