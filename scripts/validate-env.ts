#!/usr/bin/env tsx
/**
 * Production Environment Validation Script
 *
 * Validates that all critical environment variables are set and properly formatted.
 * Run with: npx tsx scripts/validate-env.ts
 *
 * Exit codes:
 *   0 - All critical checks passed
 *   1 - One or more critical checks failed
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env files (dotenv won't override existing env vars)
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// ============================================
// Colors (ANSI escape codes)
// ============================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function pass(msg: string) {
  console.log(`  ${colors.green}✓${colors.reset} ${msg}`);
}

function fail(msg: string) {
  console.log(`  ${colors.red}✗${colors.reset} ${msg}`);
}

function warn(msg: string) {
  console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
}

function header(msg: string) {
  console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`);
}

// ============================================
// Validation state
// ============================================

let criticalErrors = 0;
let warnings = 0;

// ============================================
// Validators
// ============================================

function isHex(value: string): boolean {
  return /^[0-9a-fA-F]+$/.test(value);
}

function checkCritical(name: string, validator?: (value: string) => string | null): void {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    fail(`${name} is not set ${colors.dim}(CRITICAL)${colors.reset}`);
    criticalErrors++;
    return;
  }

  if (validator) {
    const error = validator(value);
    if (error) {
      fail(`${name}: ${error} ${colors.dim}(CRITICAL)${colors.reset}`);
      criticalErrors++;
      return;
    }
  }

  pass(`${name} is set and valid`);
}

function checkOptional(name: string, description: string): void {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    warn(`${name} is not set — ${description}`);
    warnings++;
    return;
  }

  pass(`${name} is set`);
}

// ============================================
// Specific validators
// ============================================

function validateHexSecret(minLength: number) {
  return (value: string): string | null => {
    if (value.length < minLength) {
      return `must be at least ${minLength} characters (current: ${value.length}). Generate with: openssl rand -hex ${minLength / 2}`;
    }

    if (!isHex(value)) {
      return `should be a hex string. Generate with: openssl rand -hex ${minLength / 2}`;
    }

    // Check for weak patterns
    const weakPatterns = ['secret', 'password', 'changeme', 'placeholder', 'default', 'dev', 'test'];
    const lower = value.toLowerCase();
    for (const pattern of weakPatterns) {
      if (lower.includes(pattern)) {
        return `contains weak pattern "${pattern}". Generate a proper random value`;
      }
    }

    // Check for repeated characters
    if (/(.)\1{10,}/.test(value)) {
      return 'contains repeated character patterns. Use a cryptographically random value';
    }

    return null;
  };
}

function validateDatabaseUrl(value: string): string | null {
  // Accept PostgreSQL URLs
  if (value.startsWith('postgresql://') || value.startsWith('postgres://')) {
    // Basic format check: protocol://user:pass@host/db
    try {
      const url = new URL(value);
      if (!url.hostname) {
        return 'missing hostname in DATABASE_URL';
      }
      if (!url.pathname || url.pathname === '/') {
        return 'missing database name in DATABASE_URL path';
      }
      return null;
    } catch {
      return 'invalid URL format';
    }
  }

  // Accept SQLite for development
  if (value.endsWith('.db') || value.startsWith('file:')) {
    if (process.env.NODE_ENV === 'production') {
      return 'SQLite is not recommended for production. Use PostgreSQL';
    }
    return null;
  }

  return 'must start with postgresql:// or postgres://';
}

// ============================================
// Main
// ============================================

console.log(`${colors.bold}╔══════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.bold}║   ServiceDesk — Environment Validation           ║${colors.reset}`);
console.log(`${colors.bold}╚══════════════════════════════════════════════════╝${colors.reset}`);
console.log(`${colors.dim}  Environment: ${process.env.NODE_ENV || 'not set'}${colors.reset}`);

// --- Critical Security Secrets ---
header('Critical Security Secrets');
checkCritical('JWT_SECRET', validateHexSecret(64));
checkCritical('SESSION_SECRET', validateHexSecret(64));

// --- Database ---
header('Database');
checkCritical('DATABASE_URL', validateDatabaseUrl);

// --- Optional but Recommended ---
header('Optional (Recommended for Production)');
checkOptional('SENTRY_DSN', 'error tracking will be disabled');
checkOptional('REDIS_URL', 'caching and rate limiting will be limited');
checkOptional('RESEND_API_KEY', 'Resend email provider will be unavailable');
checkOptional('STRIPE_SECRET_KEY', 'billing/payments will be disabled');
checkOptional('NEXT_PUBLIC_APP_URL', 'defaults to http://localhost:3000');
checkOptional('NEXTAUTH_SECRET', 'required if using NextAuth');

// --- Summary ---
console.log('');
console.log(`${colors.bold}─── Summary ───${colors.reset}`);

if (criticalErrors > 0) {
  console.log(`  ${colors.red}${colors.bold}${criticalErrors} critical error(s)${colors.reset} — deploy will likely fail`);
}

if (warnings > 0) {
  console.log(`  ${colors.yellow}${warnings} warning(s)${colors.reset} — review before production`);
}

if (criticalErrors === 0 && warnings === 0) {
  console.log(`  ${colors.green}${colors.bold}All checks passed!${colors.reset}`);
}

if (criticalErrors === 0) {
  console.log(`\n  ${colors.green}${colors.bold}Environment validation: PASSED${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n  ${colors.red}${colors.bold}Environment validation: FAILED${colors.reset}`);
  console.log(`  ${colors.dim}Fix the critical errors above before deploying.${colors.reset}\n`);
  process.exit(1);
}
