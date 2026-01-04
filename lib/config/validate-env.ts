/**
 * Comprehensive Environment Variable Validation
 *
 * Validates that ALL required secrets are configured before starting the application.
 * This prevents the application from running with insecure default values.
 *
 * MUST be executed at application startup (server-side only).
 */

import logger from '../monitoring/edge-logger';

/**
 * Validates that TOUS required secrets are configured
 * Throws error if any required secret is missing or weak
 */
export function validateRequiredSecrets(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Validating environment secrets...\n');

  // ============================================
  // ALWAYS REQUIRED SECRETS
  // ============================================

  // JWT_SECRET
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (process.env.JWT_SECRET.length < 64) {
    errors.push(`JWT_SECRET must be at least 64 characters (current: ${process.env.JWT_SECRET.length})`);
  } else if (hasWeakPattern(process.env.JWT_SECRET, 'JWT_SECRET')) {
    errors.push('JWT_SECRET contains weak or default pattern');
  }

  // SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    errors.push('SESSION_SECRET is required');
  } else if (process.env.SESSION_SECRET.length < 64) {
    errors.push(`SESSION_SECRET must be at least 64 characters (current: ${process.env.SESSION_SECRET.length})`);
  } else if (hasWeakPattern(process.env.SESSION_SECRET, 'SESSION_SECRET')) {
    errors.push('SESSION_SECRET contains weak or default pattern');
  }

  // ============================================
  // PRODUCTION-ONLY REQUIRED SECRETS
  // ============================================

  if (isProduction) {
    // Database
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production');
    } else if (process.env.DATABASE_URL.includes('sqlite')) {
      warnings.push('SQLite is not recommended for production. Use PostgreSQL.');
    }

    // Redis (for distributed caching and rate limiting)
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      warnings.push('REDIS_URL is recommended in production for distributed rate limiting and caching');
    }

    // NextAuth (if using NextAuth)
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_SECRET) {
      errors.push('NEXTAUTH_SECRET is required when NEXTAUTH_URL is set');
    }

    // Sentry (error tracking)
    if (!process.env.SENTRY_DSN) {
      warnings.push('SENTRY_DSN is recommended in production for error tracking');
    }

    // Source maps
    if (process.env.SENTRY_DSN && !process.env.SENTRY_AUTH_TOKEN) {
      warnings.push('SENTRY_AUTH_TOKEN is recommended for source map upload');
    }
  }

  // ============================================
  // CONDITIONAL SECRETS (if feature is enabled)
  // ============================================

  // SSO
  if (process.env.ENABLE_SSO === 'true' || process.env.SSO_ENABLED === 'true') {
    if (!process.env.SSO_ENCRYPTION_KEY) {
      errors.push('SSO_ENCRYPTION_KEY is required when SSO is enabled');
    } else if (process.env.SSO_ENCRYPTION_KEY.length < 32) {
      errors.push(`SSO_ENCRYPTION_KEY must be at least 32 characters (current: ${process.env.SSO_ENCRYPTION_KEY.length})`);
    } else if (hasWeakPattern(process.env.SSO_ENCRYPTION_KEY, 'SSO_ENCRYPTION_KEY')) {
      errors.push('SSO_ENCRYPTION_KEY contains weak or default pattern');
    }
  }

  // MFA
  if (process.env.ENFORCE_2FA_FOR_ADMIN === 'true' || process.env.MFA_ENABLED === 'true') {
    if (!process.env.MFA_SECRET) {
      errors.push('MFA_SECRET is required when MFA is enabled');
    } else if (process.env.MFA_SECRET.length < 32) {
      errors.push(`MFA_SECRET must be at least 32 characters (current: ${process.env.MFA_SECRET.length})`);
    } else if (hasWeakPattern(process.env.MFA_SECRET, 'MFA_SECRET')) {
      errors.push('MFA_SECRET contains weak or default pattern');
    }
  }

  // WhatsApp Integration
  if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
    if (!process.env.WHATSAPP_ACCESS_TOKEN) {
      errors.push('WHATSAPP_ACCESS_TOKEN is required when WhatsApp is configured');
    }
    if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      errors.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN is required when WhatsApp is configured');
    }
    if (!process.env.WHATSAPP_WEBHOOK_SECRET && isProduction) {
      errors.push('WHATSAPP_WEBHOOK_SECRET is required in production when WhatsApp is configured');
    }
  }

  // Email Webhooks
  if (process.env.EMAIL_WEBHOOK_ENABLED === 'true') {
    if (!process.env.EMAIL_WEBHOOK_SECRET) {
      errors.push('EMAIL_WEBHOOK_SECRET is required when email webhooks are enabled');
    }
  }

  // General Webhooks
  if (process.env.WEBHOOK_SECRET) {
    if (process.env.WEBHOOK_SECRET.length < 32) {
      errors.push(`WEBHOOK_SECRET must be at least 32 characters (current: ${process.env.WEBHOOK_SECRET.length})`);
    }
  }

  // PWA Push Notifications
  if (process.env.ENABLE_PWA === 'true') {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      warnings.push('VAPID keys are required for PWA push notifications (generate with: npx web-push generate-vapid-keys)');
    }
  }

  // ============================================
  // VALIDATE RESULTS
  // ============================================

  // Print warnings
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    warnings.forEach(warning => {
      console.log(`  ⚠️  ${warning}`);
    });
    console.log('');
  }

  // Print errors and exit if any
  if (errors.length > 0) {
    console.error('🔴 ENVIRONMENT VALIDATION FAILED:\n');
    errors.forEach(error => {
      console.error(`  ❌ ${error}`);
    });
    console.error('\n📖 Quick Setup Guide:');
    console.error('  Generate all required secrets with:');
    console.error('    openssl rand -hex 64 > jwt.secret');
    console.error('    openssl rand -hex 64 > session.secret');
    console.error('    openssl rand -hex 32 > mfa.secret');
    console.error('    openssl rand -hex 32 > sso.secret');
    console.error('\n  Then add to .env file:');
    console.error('    JWT_SECRET=$(cat jwt.secret)');
    console.error('    SESSION_SECRET=$(cat session.secret)');
    console.error('    MFA_SECRET=$(cat mfa.secret)');
    console.error('    SSO_ENCRYPTION_KEY=$(cat sso.secret)');
    console.error('\n  Clean up temporary files:');
    console.error('    rm *.secret');
    console.error('');

    process.exit(1);
  }

  console.log('✅ Environment validation passed!\n');
}

/**
 * Check if a secret contains weak or default patterns
 */
function hasWeakPattern(value: string, secretName: string): boolean {
  const weakPatterns = [
    'default',
    'dev',
    'test',
    'local',
    'change-me',
    'changeme',
    'secret',
    'password',
    'admin',
    '12345',
    'placeholder',
    'build-time',
    'example'
  ];

  const lowerValue = value.toLowerCase();

  for (const pattern of weakPatterns) {
    if (lowerValue.includes(pattern)) {
      logger.error(`${secretName} contains weak pattern: "${pattern}"`);
      return true;
    }
  }

  return false;
}

/**
 * Validate environment for specific feature
 * Use this for conditional feature validation
 */
export function validateFeatureSecrets(feature: string): void {
  switch (feature) {
    case 'sso':
      if (!process.env.SSO_ENCRYPTION_KEY) {
        throw new Error(
          '🔴 SSO_ENCRYPTION_KEY is required for SSO.\n' +
          'Generate: openssl rand -hex 32'
        );
      }
      break;

    case 'mfa':
      if (!process.env.MFA_SECRET) {
        throw new Error(
          '🔴 MFA_SECRET is required for MFA.\n' +
          'Generate: openssl rand -hex 32'
        );
      }
      break;

    case 'whatsapp':
      if (!process.env.WHATSAPP_WEBHOOK_SECRET) {
        throw new Error(
          '🔴 WHATSAPP_WEBHOOK_SECRET is required for WhatsApp webhooks.\n' +
          'Generate: openssl rand -hex 32'
        );
      }
      break;

    default:
      logger.warn(`Unknown feature for validation: ${feature}`);
  }
}

/**
 * Export validation results for monitoring
 */
export function getValidationReport(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    validateRequiredSecrets();
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    };
  }
}
