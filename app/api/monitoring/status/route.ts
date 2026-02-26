/**
 * Monitoring Status Endpoint
 *
 * Provides detailed status of all monitoring systems:
 * - Sentry error tracking
 * - Datadog APM
 * - Performance monitoring
 * - Logging system
 *
 * This endpoint is useful for verifying monitoring setup and debugging issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getObservabilityHealth } from '@/lib/monitoring/observability';
import { performanceMonitor } from '@/lib/performance/monitoring';
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require admin authentication - exposes system internals
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;
    // Get observability health
    const observabilityHealth = getObservabilityHealth();

    // Get performance stats
    const performanceStats = performanceMonitor.getStats();

    // Get Core Web Vitals summary
    const coreWebVitals = performanceMonitor.getCoreWebVitalsSummary();

    // Get performance budgets
    const budgets = performanceMonitor.getBudgets();

    // System information
    const systemInfo = {
      node_version: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: {
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        unit: 'MB',
      },
      environment: process.env.NODE_ENV || 'development',
    };

    // Monitoring configuration
    const monitoringConfig = {
      sentry: {
        enabled: !!process.env.SENTRY_DSN,
        dsn_configured: !!process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
        traces_sample_rate: process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1',
      },
      datadog: {
        enabled: process.env.DD_TRACE_ENABLED === 'true',
        service: process.env.DD_SERVICE || 'servicedesk',
        env: process.env.DD_ENV || process.env.NODE_ENV,
        version: process.env.DD_VERSION || '1.0.0',
        agent_host: process.env.DD_AGENT_HOST || 'localhost',
        agent_port: process.env.DD_TRACE_AGENT_PORT || '8126',
        sample_rate: process.env.DD_TRACE_SAMPLE_RATE || '1.0',
        custom_metrics_enabled: process.env.DD_CUSTOM_METRICS_ENABLED === 'true',
      },
      performance: {
        monitoring_enabled: true,
        budgets_configured: budgets.length,
        metrics_collected: performanceStats.totalMetrics,
      },
    };

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      monitoring: monitoringConfig,
      observability: observabilityHealth,
      performance: {
        stats: performanceStats,
        core_web_vitals: coreWebVitals,
        budgets: budgets,
      },
    });
  } catch (error) {
    logger.error('Failed to get monitoring status', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to retrieve monitoring status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
