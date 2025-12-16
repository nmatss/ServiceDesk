/**
 * Edge-Compatible Logger
 *
 * A lightweight logger for Edge Runtime environments (middleware, edge functions)
 * that doesn't use Node.js-specific APIs like fs, path, or process.cwd()
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: number;
  tenantId?: number;
  organizationId?: number;
  [key: string]: unknown;
}

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'authorization',
  'cookie',
];

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
 * Format log message for console output
 */
function formatLog(level: LogLevel, message: string, metadata?: LogMetadata): string {
  const timestamp = new Date().toISOString();
  const redactedMeta = metadata ? redactSensitiveData(metadata) : {};

  return JSON.stringify({
    timestamp,
    level,
    message,
    ...redactedMeta,
  });
}

/**
 * Edge-compatible logger
 */
export const edgeLogger = {
  error(message: string, metadata?: LogMetadata | Error): void {
    if (metadata instanceof Error) {
      console.error(formatLog(LogLevel.ERROR, message, {
        error: metadata.message,
        stack: metadata.stack,
      }));
    } else {
      console.error(formatLog(LogLevel.ERROR, message, metadata));
    }
  },

  warn(message: string, metadata?: LogMetadata): void {
    console.warn(formatLog(LogLevel.WARN, message, metadata));
  },

  info(message: string, metadata?: LogMetadata): void {
    console.info(formatLog(LogLevel.INFO, message, metadata));
  },

  debug(message: string, metadata?: LogMetadata): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog(LogLevel.DEBUG, message, metadata));
    }
  },

  log(level: string, message: string, metadata?: LogMetadata): void {
    const logFn = level === 'error' ? console.error
                : level === 'warn' ? console.warn
                : level === 'debug' ? console.debug
                : console.info;
    logFn(formatLog(level as LogLevel, message, metadata));
  },
};

export default edgeLogger;
