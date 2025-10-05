/**
 * Environment Variable Validation and Management
 * Ensures critical environment variables are set in production
 */

export function validateJWTSecret(): string {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '🔴 FATAL: JWT_SECRET environment variable must be set in production!\n' +
        'Generate a secure secret with: openssl rand -hex 32\n' +
        'Then set it in your .env file or deployment environment.'
      );
    }

    console.warn(
      '⚠️  WARNING: Using development JWT secret. ' +
      'This is INSECURE for production use!'
    );

    return 'dev-secret-CHANGE-ME-IN-PRODUCTION';
  }

  // Validate minimum length (256 bits = 32 bytes)
  if (process.env.JWT_SECRET.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '🔴 FATAL: JWT_SECRET must be at least 32 characters long for security!\n' +
        'Generate a secure secret with: openssl rand -hex 32'
      );
    }

    console.warn('⚠️  WARNING: JWT_SECRET is too short. Should be at least 32 characters.');
  }

  return process.env.JWT_SECRET;
}

export function validateOpenAIKey(): string | undefined {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. AI features will be disabled.');
    return undefined;
  }

  if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.warn('⚠️  OPENAI_API_KEY may be invalid (should start with "sk-")');
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

    console.warn('⚠️  Using local SQLite database (servicedesk.db)');
    return './servicedesk.db';
  }

  return process.env.DATABASE_URL;
}

export function validateEnvironment(): void {
  console.log('🔍 Validating environment variables...');

  try {
    validateJWTSecret();
    validateOpenAIKey();
    validateDatabaseURL();

    console.log('✅ Environment validation passed!');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Auto-validate on import in production
if (process.env.NODE_ENV === 'production') {
  validateEnvironment();
}
