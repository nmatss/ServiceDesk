/**
 * Next.js Instrumentation
 * Runs once when the server starts (both dev and production)
 *
 * This file initializes observability infrastructure including:
 * - Sentry error tracking
 * - Datadog APM and tracing
 * - Cache layer
 * - Performance monitoring
 *
 * IMPORTANT: No top-level Node.js module imports allowed here
 * because this file is evaluated in both Node.js and Edge runtimes.
 * Use dynamic imports inside the register() function instead.
 */

// Simple console logger for Edge runtime (no Node.js dependencies)
const edgeLogger = {
  info: (message: string, _details?: unknown) => console.log(`[INFO] ${message}`),
  error: (message: string, _error?: unknown) => console.error(`[ERROR] ${message}`),
  warn: (message: string, _details?: unknown) => console.warn(`[WARN] ${message}`),
};

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import the full logger only in Node.js runtime
    const { logger } = await import('./lib/monitoring/logger');

    logger.info('📊 Initializing ServiceDesk instrumentation...');

    try {
      // 1. Initialize Sentry for error tracking
      if (process.env.SENTRY_DSN) {
        await import('./sentry.server.config');
        logger.info('✓ Sentry error tracking initialized');
      } else {
        logger.info('⚠ Sentry DSN not configured - error tracking disabled');
      }
    } catch (error) {
      logger.error('✗ Failed to initialize Sentry', error);
    }

    try {
      // 2. Initialize Datadog APM and tracing
      if (process.env.DD_TRACE_ENABLED === 'true') {
        const { initializeDatadogAPM } = await import('./lib/monitoring/datadog-config');
        initializeDatadogAPM();
        logger.info('✓ Datadog APM initialized');
      } else {
        logger.info('⚠ Datadog tracing disabled (DD_TRACE_ENABLED not set to true)');
      }
    } catch (error) {
      logger.error('✗ Failed to initialize Datadog APM', error);
    }

    try {
      // 3. Initialize cache layer
      const { initializeCache } = await import('./lib/cache/init');
      await initializeCache();
      logger.info('✓ Cache layer initialized');
    } catch (error) {
      logger.error('✗ Failed to initialize cache', error);
    }

    try {
      // 4. Log instrumentation summary
      logger.info('ServiceDesk observability infrastructure ready', {
        sentry: !!process.env.SENTRY_DSN,
        datadog: process.env.DD_TRACE_ENABLED === 'true',
        environment: process.env.NODE_ENV || 'development',
      });
      logger.info('✓ Performance monitoring initialized');
    } catch (error) {
      logger.error('✗ Failed to initialize performance monitoring', error);
    }

    logger.info('🎯 ServiceDesk instrumentation complete');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    try {
      // Initialize Sentry for Edge runtime
      if (process.env.SENTRY_DSN) {
        await import('./sentry.edge.config');
        edgeLogger.info('✓ Sentry Edge runtime initialized');
      }
    } catch (error) {
      edgeLogger.error('✗ Failed to initialize Sentry Edge runtime', error);
    }
  }
}
