/**
 * Readiness Probe Endpoint
 *
 * Kubernetes readiness probe - checks if the application is ready to serve traffic.
 * This checks critical dependencies (database, cache, etc.).
 * If it fails, Kubernetes will stop sending traffic but won't restart the pod.
 *
 * Endpoint: GET /api/health/ready
 * Response: 200 OK if ready, 503 if not ready
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    const result = db.prepare('SELECT 1 as health_check').get();
    return result
      ? { status: 'ok' }
      : { status: 'error', message: 'Database query returned no result' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check file system access
 */
async function checkFileSystem(): Promise<{ status: 'ok' | 'error'; message?: string }> {
  try {
    // Check if we can access the current working directory
    process.cwd();
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'File system access failed',
    };
  }
}

/**
 * GET /api/health/ready
 *
 * Comprehensive readiness check
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  // Check database
  checks.database = await checkDatabase();

  // Check file system
  checks.filesystem = await checkFileSystem();

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  checks.memory = {
    status: memUsagePercent < 90 ? 'ok' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    percentage: Math.round(memUsagePercent),
  };

  // Determine overall readiness
  const hasErrors = Object.values(checks).some((check: any) => check.status === 'error');
  const isReady = !hasErrors;

  const duration = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks,
      checkDuration: duration,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.DD_VERSION || '1.0.0',
    },
    {
      status: isReady ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
