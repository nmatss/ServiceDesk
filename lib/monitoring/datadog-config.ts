/**
 * Configuração do Datadog APM
 * Inicialização e configuração do tracer
 */

import { logger } from './logger';

// Configurações do ambiente
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || 'localhost';
const DD_TRACE_AGENT_PORT = process.env.DD_TRACE_AGENT_PORT || '8126';
const DD_SERVICE = process.env.DD_SERVICE || 'servicedesk';
const DD_ENV = process.env.DD_ENV || process.env.NODE_ENV || 'development';
const DD_VERSION = process.env.DD_VERSION || '1.0.0';
const DD_TRACE_ENABLED = process.env.DD_TRACE_ENABLED === 'true';
const DD_TRACE_DEBUG = process.env.DD_TRACE_DEBUG === 'true';
const DD_TRACE_SAMPLE_RATE = parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0');

// Tracer instance
let tracer: any = null;

/**
 * Get dd-trace tracer instance
 */
export function getTracer() {
  if (!tracer && DD_TRACE_ENABLED) {
    try {
      // Import dd-trace dynamically to avoid initialization issues
      const ddTrace = require('dd-trace');
      tracer = ddTrace;
    } catch (error) {
      logger.warn('dd-trace not available, tracing disabled', error);
      // Return a no-op tracer
      tracer = {
        startSpan: () => ({
          setTag: () => {},
          finish: () => {},
        }),
        scope: () => ({
          active: () => null,
          activate: (_span: any, fn: any) => fn(),
        }),
      };
    }
  }
  return tracer || {
    startSpan: () => ({
      setTag: () => {},
      finish: () => {},
    }),
    scope: () => ({
      active: () => null,
      activate: (_span: any, fn: any) => fn(),
    }),
  };
}

/**
 * Inicializar Datadog APM
 */
export function initializeDatadogAPM() {
  if (!DD_TRACE_ENABLED) {
    logger.info('Datadog APM disabled');
    return;
  }

  try {
    // Import and initialize dd-trace
    const ddTrace = require('dd-trace');

    tracer = ddTrace.init({
      // Service information
      service: DD_SERVICE,
      env: DD_ENV,
      version: DD_VERSION,

      // Agent configuration
      hostname: DD_AGENT_HOST,
      port: parseInt(DD_TRACE_AGENT_PORT, 10),

      // Tracing configuration
      enabled: true,
      debug: DD_TRACE_DEBUG,
      sampleRate: DD_TRACE_SAMPLE_RATE,

      // Logging
      logInjection: true,
      runtimeMetrics: true,

      // Profiling (optional)
      profiling: process.env.DD_PROFILING_ENABLED === 'true',

      // Tags
      tags: {
        'service.type': 'web',
        'framework': 'nextjs',
      },

      // Analytics
      analytics: process.env.DD_TRACE_ANALYTICS_ENABLED === 'true',
    });

    logger.info('Datadog APM initialized successfully', {
      service: DD_SERVICE,
      env: DD_ENV,
      version: DD_VERSION,
      agent_host: DD_AGENT_HOST,
      agent_port: DD_TRACE_AGENT_PORT,
      sample_rate: DD_TRACE_SAMPLE_RATE,
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      try {
        await tracer?.flush();
        logger.info('Datadog APM shutdown successfully');
      } catch (error) {
        logger.error('Error shutting down Datadog APM', error);
      } finally {
        process.exit(0);
      }
    });
  } catch (error) {
    logger.error('Failed to initialize Datadog APM', error);
  }
}

/**
 * Shutdown manual do APM
 */
export async function shutdownDatadogAPM() {
  if (tracer) {
    try {
      await tracer.flush();
      logger.info('Datadog APM shutdown');
    } catch (error) {
      logger.error('Error during Datadog APM shutdown', error);
    }
  }
}

/**
 * Configuração de filtros de trace
 */
export const traceFilters = {
  // Ignorar health checks
  ignoreHealthChecks: true,

  // Ignorar assets estáticos
  ignoreStaticAssets: true,

  // Paths ignorados
  ignoredPaths: [
    '/health',
    '/healthz',
    '/ping',
    '/favicon.ico',
    '/_next/static',
    '/_next/image',
    '/public',
  ],

  // Headers sensíveis que não devem ser logados
  sensitiveHeaders: [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
  ],

  // Query params sensíveis
  sensitiveQueryParams: [
    'token',
    'api_key',
    'password',
    'secret',
  ],
};

/**
 * Verificar se um path deve ser ignorado
 */
export function shouldIgnorePath(path: string): boolean {
  return traceFilters.ignoredPaths.some((ignored) => path.startsWith(ignored));
}

/**
 * Sanitizar headers sensíveis
 */
export function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };

  traceFilters.sensitiveHeaders.forEach((header) => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitizar query params sensíveis
 */
export function sanitizeQueryParams(params: Record<string, any>): Record<string, any> {
  const sanitized = { ...params };

  traceFilters.sensitiveQueryParams.forEach((param) => {
    if (sanitized[param]) {
      sanitized[param] = '[REDACTED]';
    }
  });

  return sanitized;
}

export default {
  initializeDatadogAPM,
  shutdownDatadogAPM,
  traceFilters,
  shouldIgnorePath,
  sanitizeHeaders,
  sanitizeQueryParams,
};
