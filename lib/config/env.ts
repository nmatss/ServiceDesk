/**
 * Environment Configuration Module
 * Centralized and type-safe environment variable access
 */

/**
 * Critical: JWT Secret
 * MUST be set in production, no defaults allowed
 */
export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL SECURITY ERROR: JWT_SECRET must be set in production environment'
      )
    }
    // Development only - log warning
    console.warn(
      '⚠️  WARNING: Using default JWT_SECRET in development. DO NOT use in production!'
    )
    return 'dev-only-secret-change-in-production-8f7d9e6c5b4a3'
  }

  // Validate secret length (minimum 32 characters)
  if (secret.length < 32) {
    throw new Error(
      'SECURITY ERROR: JWT_SECRET must be at least 32 characters long'
    )
  }

  return secret
}

/**
 * Database configuration
 */
export function getDatabasePath(): string {
  return process.env.DATABASE_URL || './servicedesk.db'
}

/**
 * Node environment
 */
export function getNodeEnv(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV
  if (env === 'production' || env === 'test') {
    return env
  }
  return 'development'
}

/**
 * Check if in production
 */
export function isProduction(): boolean {
  return getNodeEnv() === 'production'
}

/**
 * Check if in development
 */
export function isDevelopment(): boolean {
  return getNodeEnv() === 'development'
}

/**
 * Get port configuration
 */
export function getPort(): number {
  const port = process.env.PORT
  return port ? parseInt(port, 10) : 3000
}

/**
 * Get allowed origins for CORS
 */
export function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS
  if (!origins) {
    return isDevelopment()
      ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
      : []
  }
  return origins.split(',').map(origin => origin.trim())
}

/**
 * Rate limiting configuration
 */
export function getRateLimitConfig() {
  return {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
  }
}

/**
 * Session configuration
 */
export function getSessionConfig() {
  return {
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400', 10), // 24 hours in seconds
    cookieName: process.env.SESSION_COOKIE_NAME || 'auth_token',
    secure: isProduction(),
    httpOnly: true,
    sameSite: 'lax' as const,
  }
}

/**
 * Validate all required environment variables on startup
 */
export function validateEnvironment(): void {
  const required: Array<{ name: string; validator: () => void }> = [
    {
      name: 'JWT_SECRET',
      validator: () => getJWTSecret(),
    },
  ]

  const errors: string[] = []

  for (const { name, validator } of required) {
    try {
      validator()
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:')
    errors.forEach(error => console.error(`   - ${error}`))

    if (isProduction()) {
      throw new Error('Environment validation failed. See errors above.')
    }
  } else {
    console.log('✅ Environment validation passed')
  }
}
