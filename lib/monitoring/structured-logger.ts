/**
 * Structured Logger with Winston
 *
 * Production-grade structured logging with:
 * - JSON output for log aggregation
 * - Correlation IDs for request tracing
 * - Sensitive data redaction
 * - Log levels and filtering
 * - Multiple transports (console, file, external services)
 */

import * as winston from 'winston';
import * as path from 'path';

// ======================
// TYPES
// ======================

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

export interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: number;
  tenantId?: number;
  organizationId?: number;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  path?: string;
  operation?: string;
  errorCode?: string;
  errorType?: string;
  stackTrace?: string;
  [key: string]: any;
}

// ======================
// CONFIGURATION
// ======================

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const SERVICE_NAME = process.env.DD_SERVICE || 'servicedesk';
const ENVIRONMENT = process.env.DD_ENV || process.env.NODE_ENV || 'development';
const VERSION = process.env.DD_VERSION || '1.0.0';

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'creditCard',
  'credit_card',
  'ssn',
  'cvv',
];

// ======================
// FORMATTERS
// ======================

/**
 * Redact sensitive data from logs
 */
function redactSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * JSON formatter for structured logging
 */
const jsonFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json(),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      metadata,
      correlationId,
      requestId,
      ...rest
    } = info;

    // Combine metadata and rest into a single object for redaction
    const combinedMetadata = {
      ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
      ...(typeof rest === 'object' && rest !== null ? rest : {}),
    };
    const redactedData = redactSensitiveData(combinedMetadata) as Record<string, unknown>;

    return JSON.stringify({
      timestamp,
      level,
      message,
      service: SERVICE_NAME,
      environment: ENVIRONMENT,
      version: VERSION,
      correlationId: correlationId || requestId,
      ...redactedData,
    });
  })
);

/**
 * Human-readable formatter for development
 */
const consoleFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, correlationId, requestId, ...metadata } = info;

    let log = `[${timestamp}] ${level}: ${message}`;

    if (correlationId || requestId) {
      log += ` [${correlationId || requestId}]`;
    }

    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(redactSensitiveData(metadata), null, 2)}`;
    }

    return log;
  })
);

// ======================
// TRANSPORTS
// ======================

const transports: winston.transport[] = [];

// Console transport (always enabled in development, optional in production)
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
  transports.push(
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? jsonFormatter : consoleFormatter,
    })
  );
}

// File transports (production only)
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE === 'true') {
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonFormatter,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true,
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFormatter,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true,
    })
  );

  // HTTP log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'http.log'),
      level: 'http',
      format: jsonFormatter,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  );
}

// ======================
// LOGGER INSTANCE
// ======================

export const structuredLogger = winston.createLogger({
  level: LOG_LEVEL,
  levels: winston.config.npm.levels,
  format: jsonFormatter,
  transports,
  exitOnError: false,
  silent: process.env.LOG_SILENT === 'true',
});

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Create a child logger with default metadata
 */
export function createChildLogger(defaultMetadata: LogMetadata) {
  return {
    error: (message: string, metadata?: LogMetadata) =>
      structuredLogger.error(message, { ...defaultMetadata, ...metadata }),

    warn: (message: string, metadata?: LogMetadata) =>
      structuredLogger.warn(message, { ...defaultMetadata, ...metadata }),

    info: (message: string, metadata?: LogMetadata) =>
      structuredLogger.info(message, { ...defaultMetadata, ...metadata }),

    http: (message: string, metadata?: LogMetadata) =>
      structuredLogger.http(message, { ...defaultMetadata, ...metadata }),

    verbose: (message: string, metadata?: LogMetadata) =>
      structuredLogger.verbose(message, { ...defaultMetadata, ...metadata }),

    debug: (message: string, metadata?: LogMetadata) =>
      structuredLogger.debug(message, { ...defaultMetadata, ...metadata }),
  };
}

/**
 * Log HTTP request
 */
function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  metadata?: LogMetadata
): void {
  structuredLogger.http(`${method} ${url} ${statusCode}`, {
    method,
    url,
    statusCode,
    duration,
    ...metadata,
  });
}

/**
 * Log database query
 */
function logDatabaseQuery(
  operation: string,
  table: string,
  duration: number,
  metadata?: LogMetadata
): void {
  const level = duration > 100 ? 'warn' : 'debug';
  structuredLogger.log(level, `Database query: ${operation} on ${table}`, {
    operation,
    table,
    duration,
    slow: duration > 100,
    ...metadata,
  });
}

/**
 * Log authentication event
 */
function logAuthEvent(
  event: string,
  success: boolean,
  metadata?: LogMetadata
): void {
  const level = success ? 'info' : 'warn';
  structuredLogger.log(level, `Auth: ${event}`, {
    event,
    success,
    authEvent: true,
    ...metadata,
  });
}

/**
 * Log security event
 */
function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: LogMetadata
): void {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  structuredLogger.log(level, `Security: ${event}`, {
    event,
    severity,
    securityEvent: true,
    ...metadata,
  });
}

/**
 * Log business metric
 */
function logBusinessMetric(
  metric: string,
  value: number,
  metadata?: LogMetadata
): void {
  structuredLogger.info(`Metric: ${metric}`, {
    metric,
    value,
    businessMetric: true,
    ...metadata,
  });
}

/**
 * Log error with stack trace
 */
function logError(
  error: Error | unknown,
  context?: string,
  metadata?: LogMetadata
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stackTrace = error instanceof Error ? error.stack : undefined;

  structuredLogger.error(`${context ? `${context}: ` : ''}${errorMessage}`, {
    error: errorMessage,
    errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    stackTrace,
    ...metadata,
  });
}

/**
 * Generate correlation ID
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// ======================
// MIDDLEWARE HELPERS
// ======================

// Define Request interface for type safety
interface RequestLike {
  method: string;
  url: string;
  headers: {
    get?: (key: string) => string | null;
  };
}

/**
 * Create request logger middleware
 */
function createRequestLogger() {
  return {
    onRequest: (req: RequestLike, correlationId?: string) => {
      const cid = correlationId || generateCorrelationId();
      const startTime = Date.now();

      return {
        correlationId: cid,
        startTime,
        logger: createChildLogger({
          correlationId: cid,
          method: req.method,
          url: req.url,
          ipAddress: req.headers.get?.('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get?.('user-agent') || 'unknown',
        }),
      };
    },

    onResponse: (
      req: RequestLike,
      statusCode: number,
      startTime: number,
      correlationId: string,
      metadata?: LogMetadata
    ) => {
      const duration = Date.now() - startTime;
      logHttpRequest(req.method, req.url, statusCode, duration, {
        correlationId,
        ...metadata,
      });
    },

    onError: (
      req: RequestLike,
      error: Error,
      startTime: number,
      correlationId: string,
      metadata?: LogMetadata
    ) => {
      const duration = Date.now() - startTime;
      logError(error, `Request failed: ${req.method} ${req.url}`, {
        correlationId,
        method: req.method,
        url: req.url,
        duration,
        ...metadata,
      });
    },
  };
}

// ======================
// EXPORTS
// ======================

// Default export
export default structuredLogger;

// Alias for backward compatibility (many files import 'logger')
export const logger = structuredLogger;

export {
  logHttpRequest,
  logDatabaseQuery,
  logAuthEvent,
  logSecurityEvent,
  logBusinessMetric,
  logError,
  generateCorrelationId,
  createRequestLogger,
};
