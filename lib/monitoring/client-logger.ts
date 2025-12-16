/**
 * Client-side Logger
 *
 * A lightweight logger for client-side (browser) use.
 * This logger does NOT use any Node.js modules (fs, path, etc.)
 * and is safe to import in client components and Edge runtime.
 *
 * For server-side logging with full features (database, file logging),
 * use the regular logger from '@/lib/monitoring/logger'
 */

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Event types
export enum EventType {
  AUTH = 'auth',
  API = 'api',
  DATABASE = 'database',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  USER_ACTION = 'user_action',
  SYSTEM = 'system'
}

// Log entry interface (compatible with server logger)
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: EventType;
  message: string;
  details?: unknown;
  user_id?: number;
  tenant_id?: number;
}

interface ClientLoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  sendToServer: boolean;
  serverEndpoint: string;
  batchSize: number;
  flushInterval: number;
}

const defaultConfig: ClientLoggerConfig = {
  level: typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
    ? LogLevel.INFO
    : LogLevel.DEBUG,
  enableConsole: true,
  sendToServer: false, // Set to true to send logs to server
  serverEndpoint: '/api/logs',
  batchSize: 10,
  flushInterval: 5000,
};

class ClientLogger {
  private config: ClientLoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<ClientLoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    if (this.config.sendToServer && typeof window !== 'undefined') {
      this.startFlushTimer();
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private log(level: LogLevel, type: EventType, message: string, details?: unknown) {
    if (level > this.config.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      details,
    };

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Buffer for server sending
    if (this.config.sendToServer) {
      this.logBuffer.push(entry);
      if (this.logBuffer.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  private logToConsole(entry: LogEntry) {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${levelName}] [${entry.type}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, entry.details ?? '');
        break;
      case LogLevel.WARN:
        console.warn(message, entry.details ?? '');
        break;
      case LogLevel.DEBUG:
        console.debug(message, entry.details ?? '');
        break;
      default:
        console.log(message, entry.details ?? '');
    }
  }

  private async flush() {
    if (this.logBuffer.length === 0) return;
    if (typeof window === 'undefined') return;

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await fetch(this.config.serverEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      // Re-add logs to buffer if sending failed
      this.logBuffer.unshift(...logs);
      console.error('[ClientLogger] Failed to send logs to server:', error);
    }
  }

  // Convenience methods
  error(message: string, details?: unknown) {
    this.log(LogLevel.ERROR, EventType.ERROR, message, details);
  }

  warn(message: string, details?: unknown) {
    this.log(LogLevel.WARN, EventType.SYSTEM, message, details);
  }

  info(message: string, details?: unknown) {
    this.log(LogLevel.INFO, EventType.SYSTEM, message, details);
  }

  debug(message: string, details?: unknown) {
    this.log(LogLevel.DEBUG, EventType.SYSTEM, message, details);
  }

  // Specific event types
  auth(message: string, userId?: number, details?: unknown) {
    this.log(LogLevel.INFO, EventType.AUTH, message, { userId, ...details as object });
  }

  api(message: string, duration?: number, details?: unknown) {
    this.log(LogLevel.INFO, EventType.API, message, { duration_ms: duration, ...details as object });
  }

  security(message: string, details?: unknown) {
    this.log(LogLevel.WARN, EventType.SECURITY, message, details);
  }

  performance(message: string, duration: number, details?: unknown) {
    this.log(LogLevel.INFO, EventType.PERFORMANCE, message, { duration_ms: duration, ...details as object });
  }

  userAction(message: string, userId: number, details?: unknown) {
    this.log(LogLevel.INFO, EventType.USER_ACTION, message, { userId, ...details as object });
  }

  // Cleanup
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Singleton instance
export const logger = new ClientLogger();

export default logger;
