// Use edge-compatible logger to support middleware/edge runtime
import logger from '../monitoring/edge-logger';

/**
 * Environment Variable Validation and Management
 * Comprehensive validation for all environment variables used in ServiceDesk
 */

// Check if we're in build time (Next.js sets this during `next build`)
const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build';

// ============================================
// Type Definitions
// ============================================

export interface EnvironmentConfig {
  // Node Environment
  nodeEnv: 'development' | 'staging' | 'production';
  isProduction: boolean;
  isDevelopment: boolean;

  // Application URLs
  appUrl: string;
  apiUrl: string;
  port: number;

  // Security
  jwtSecret: string;
  jwtExpiresIn: number;
  sessionSecret: string;
  nextAuthSecret?: string;
  nextAuthUrl?: string;

  // Database
  databaseUrl: string;
  dbPoolMin: number;
  dbPoolMax: number;
  dbPoolIdleTimeout: number;
  dbPoolAcquireTimeout: number;

  // Email
  emailProvider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  emailFrom: {
    name: string;
    address: string;
  };

  // AI/OpenAI
  openai?: {
    apiKey: string;
    model: string;
    temperature: number;
  };

  // Redis
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    cluster: boolean;
  };

  // Monitoring
  sentry?: {
    dsn: string;
    environment: string;
    release?: string;
    tracesSampleRate: number;
    errorSampleRate: number;
  };

  datadog?: {
    apiKey: string;
    agentHost: string;
    agentPort: number;
    service: string;
    env: string;
    version: string;
    traceEnabled: boolean;
  };
}

// ============================================
// Validation Helpers
// ============================================

function getEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    logger.warn(`⚠️  WARNING: ${name} is not a valid number. Using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

function getEnvFloat(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    logger.warn(`⚠️  WARNING: ${name} is not a valid number. Using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

function getEnvBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;

  return value.toLowerCase() === 'true' || value === '1';
}

// ============================================
// Core Environment Checks
// ============================================

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isStaging(): boolean {
  return (process.env.NODE_ENV as string) === 'staging';
}

// ============================================
// Security Validation
// ============================================

export function validateJWTSecret(): string {
  // During build time, return a placeholder to allow compilation
  if (IS_BUILD_TIME) {
    return process.env.JWT_SECRET || 'build-time-placeholder-secret-32-chars';
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      '🔴 FATAL: JWT_SECRET environment variable is required!\n' +
      'Generate a secure secret with:\n' +
      '  openssl rand -hex 64\n' +
      'Then set it in your .env file:\n' +
      '  JWT_SECRET=<generated-secret>'
    );
  }

  // Enhanced validation: minimum length (512 bits = 64 bytes for production)
  if (secret.length < 64) {
    throw new Error(
      '🔴 FATAL: JWT_SECRET must be at least 64 characters long!\n' +
      `Current length: ${secret.length} characters\n` +
      'Generate a secure secret with: openssl rand -hex 64'
    );
  }

  // Check for weak/common secrets
  const weakSecrets = [
    'secret',
    'password',
    'admin',
    '12345',
    'qwerty',
    'dev-secret',
    'dev',
    'test',
    'local',
    'change-me',
    'changeme',
    'default',
    'placeholder',
    'build-time'
  ];

  const lowerSecret = secret.toLowerCase();
  for (const weak of weakSecrets) {
    if (lowerSecret.includes(weak)) {
      throw new Error(
        `🔴 FATAL: JWT_SECRET contains weak or default pattern "${weak}"!\n` +
        'Generate a strong random secret with: openssl rand -hex 64'
      );
    }
  }

  // Check for obvious patterns (like all same character, sequential, etc)
  // For hex secrets, we expect good distribution of chars but not high unique/length ratio
  const hasRepeatedPattern = /(.)\1{10,}/.test(secret); // 10+ same char in a row
  const isSequential = /(0123456789|abcdefghij|9876543210|jihgfedcba)/.test(secret);

  if (hasRepeatedPattern || isSequential) {
    throw new Error(
      '🔴 FATAL: JWT_SECRET contains obvious patterns!\n' +
      'Generate a cryptographically random secret with: openssl rand -hex 64'
    );
  }

  return secret;
}

export function validateOpenAIKey(): string | undefined {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('⚠️  OPENAI_API_KEY not set. AI features will be disabled.');
    return undefined;
  }

  if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    logger.warn('⚠️  OPENAI_API_KEY may be invalid (should start with "sk-")');
  }

  return process.env.OPENAI_API_KEY;
}

export function validateDatabaseURL(): string {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '🔴 FATAL: DATABASE_URL environment variable must be set in production!'
      );
    }

    logger.warn('⚠️  Using local SQLite database (servicedesk.db)');
    return './servicedesk.db';
  }

  return process.env.DATABASE_URL;
}

// ============================================
// Additional Validation Functions
// ============================================

export function validateSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      '🔴 FATAL: SESSION_SECRET environment variable is required!\n' +
      'Generate a secure secret with:\n' +
      '  openssl rand -hex 64\n' +
      'Then set it in your .env file:\n' +
      '  SESSION_SECRET=<generated-secret>'
    );
  }

  // Enforce 64 character minimum for enhanced security
  if (secret.length < 64) {
    throw new Error(
      '🔴 FATAL: SESSION_SECRET must be at least 64 characters long!\n' +
      `Current length: ${secret.length} characters\n` +
      'Generate a secure secret with: openssl rand -hex 64'
    );
  }

  // Check for weak patterns
  const weakPatterns = [
    'dev',
    'test',
    'local',
    'default',
    'secret',
    'password',
    'change-me',
    'changeme',
    'placeholder'
  ];

  const lowerSecret = secret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      throw new Error(
        `🔴 FATAL: SESSION_SECRET contains weak or default pattern "${pattern}"!\n` +
        'Generate a strong random secret with: openssl rand -hex 64'
      );
    }
  }

  return secret;
}

export function validateRedisConfig() {
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;

  if (!redisUrl && !redisHost) {
    if (isProduction()) {
      logger.warn('⚠️  WARNING: Redis not configured in production. Caching and sessions will be limited.');
    }
    return undefined;
  }

  return {
    url: redisUrl,
    host: redisHost || 'localhost',
    port: getEnvNumber('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD'),
    db: getEnvNumber('REDIS_DB', 0),
    cluster: getEnvBoolean('REDIS_CLUSTER', false),
  };
}

export function validateSentryConfig() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (isProduction()) {
      logger.warn('⚠️  WARNING: Sentry not configured. Error tracking disabled.');
    }
    return undefined;
  }

  return {
    dsn,
    environment: getEnv('SENTRY_ENVIRONMENT', process.env.NODE_ENV || 'development'),
    release: getEnv('SENTRY_RELEASE'),
    tracesSampleRate: getEnvFloat('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    errorSampleRate: getEnvFloat('SENTRY_ERROR_SAMPLE_RATE', 1.0),
  };
}

export function validateDatadogConfig() {
  const apiKey = process.env.DD_API_KEY;

  if (!apiKey && getEnvBoolean('DD_TRACE_ENABLED', false)) {
    logger.warn('⚠️  WARNING: DD_TRACE_ENABLED is true but DD_API_KEY not set');
    return undefined;
  }

  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    agentHost: getEnv('DD_AGENT_HOST', 'localhost'),
    agentPort: getEnvNumber('DD_TRACE_AGENT_PORT', 8126),
    service: getEnv('DD_SERVICE', 'servicedesk'),
    env: getEnv('DD_ENV', process.env.NODE_ENV || 'development'),
    version: getEnv('DD_VERSION', '1.0.0'),
    traceEnabled: getEnvBoolean('DD_TRACE_ENABLED', false),
  };
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as any;

  return {
    // Node Environment
    nodeEnv,
    isProduction: isProduction(),
    isDevelopment: isDevelopment(),

    // Application URLs
    appUrl: getEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    apiUrl: getEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3000/api'),
    port: getEnvNumber('PORT', 3000),

    // Security
    jwtSecret: validateJWTSecret(),
    jwtExpiresIn: getEnvNumber('JWT_EXPIRES_IN', 28800),
    sessionSecret: validateSessionSecret(),
    nextAuthSecret: getEnv('NEXTAUTH_SECRET'),
    nextAuthUrl: getEnv('NEXTAUTH_URL'),

    // Database
    databaseUrl: validateDatabaseURL(),
    dbPoolMin: getEnvNumber('DB_POOL_MIN', 2),
    dbPoolMax: getEnvNumber('DB_POOL_MAX', 10),
    dbPoolIdleTimeout: getEnvNumber('DB_POOL_IDLE_TIMEOUT', 30000),
    dbPoolAcquireTimeout: getEnvNumber('DB_POOL_ACQUIRE_TIMEOUT', 5000),

    // Email
    emailProvider: getEnv('EMAIL_PROVIDER', 'smtp') as any,
    emailFrom: {
      name: getEnv('EMAIL_FROM_NAME', 'ServiceDesk'),
      address: getEnv('EMAIL_FROM_ADDRESS', 'noreply@servicedesk.com'),
    },

    // AI/OpenAI
    openai: validateOpenAIKey() ? {
      apiKey: validateOpenAIKey()!,
      model: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),
      temperature: getEnvFloat('AI_TEMPERATURE', 0.7),
    } : undefined,

    // Redis
    redis: validateRedisConfig(),

    // Monitoring
    sentry: validateSentryConfig(),
    datadog: validateDatadogConfig(),
  };
}

export function validateEnvironment(): void {
  // Skip validation during build time
  if (IS_BUILD_TIME) {
    logger.info('🔍 Skipping environment validation during build time');
    return;
  }

  logger.info('🔍 Validating environment variables...');

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Critical validations
    validateJWTSecret();
    validateSessionSecret();
    validateDatabaseURL();

    // Production-specific validations
    if (isProduction()) {
      // Check Redis
      const redis = validateRedisConfig();
      if (!redis) {
        warnings.push('Redis not configured - performance may be impacted');
      }

      // Check Monitoring
      const sentry = validateSentryConfig();
      if (!sentry) {
        warnings.push('Sentry not configured - error tracking disabled');
      }

      // Check Database Type
      const dbUrl = validateDatabaseURL();
      if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
        warnings.push('Production should use PostgreSQL database, not SQLite');
      }
    }

    // Optional features
    validateOpenAIKey();

    // Report results
    if (errors.length > 0) {
      logger.error('❌ Environment validation failed:', { errors });
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    if (warnings.length > 0) {
      warnings.forEach(warning => logger.warn(`⚠️  ${warning}`));
    }

    logger.info('✅ Environment validation passed!');
  } catch (error) {
    logger.error('❌ Environment validation failed', error instanceof Error ? error : new Error(String(error)));
    // Don't call process.exit() - let the calling code handle the error
    throw error;
  }
}

/**
 * Get JWT secret (alias for validateJWTSecret)
 */
export function getJWTSecret(): string {
  return validateJWTSecret();
}

export function getSessionSecret(): string {
  return validateSessionSecret();
}

export function getDatabaseURL(): string {
  return validateDatabaseURL();
}

export function getOpenAIKey(): string | undefined {
  return validateOpenAIKey();
}

/**
 * Validate WhatsApp configuration
 */
export function validateWhatsAppConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!phoneNumberId || !accessToken || !businessAccountId || !webhookVerifyToken) {
    if (isProduction()) {
      logger.warn('⚠️  WARNING: WhatsApp integration not configured. WhatsApp features will be disabled.');
    }
    return undefined;
  }

  return {
    phoneNumberId,
    accessToken,
    businessAccountId,
    webhookVerifyToken,
    apiVersion: getEnv('WHATSAPP_API_VERSION', 'v18.0'),
  };
}

export function getWhatsAppConfig() {
  return validateWhatsAppConfig();
}

// Auto-validate on import in production (skip during build time)
if (isProduction() && !IS_BUILD_TIME) {
  validateEnvironment();
}
