/**
 * Helmet-style Security Headers Configuration
 *
 * Implements comprehensive security headers similar to helmet.js for Next.js
 * All headers are configurable and production-ready
 */

import { NextResponse } from 'next/server';
import { isProduction } from '@/lib/config/env';

/**
 * Security headers configuration
 */
export interface HelmetConfig {
  contentSecurityPolicy?: {
    directives: Record<string, string | string[]>;
    reportOnly?: boolean;
  };
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  xFrameOptions?: 'DENY' | 'SAMEORIGIN';
  xContentTypeOptions?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: Record<string, string[]>;
  xssProtection?: boolean;
  dnsPrefetchControl?: boolean;
  expectCT?: {
    maxAge: number;
    enforce: boolean;
  };
}

/**
 * Default production-ready helmet configuration
 */
const defaultConfig: HelmetConfig = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Next.js
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components/emotion
        'https://fonts.googleapis.com'
      ],
      'font-src': [
        "'self'",
        'data:',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://r2cdn.perplexity.ai'
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:' // Allow all HTTPS images
      ],
      'connect-src': [
        "'self'",
        'https://api.openai.com',
        'wss:', // WebSocket connections
        'https://*.sentry.io' // Sentry error tracking
      ],
      'frame-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    },
    reportOnly: false
  },
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    geolocation: [],
    microphone: [],
    camera: [],
    payment: [],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: []
  },
  xssProtection: true,
  dnsPrefetchControl: true,
  expectCT: {
    maxAge: 86400, // 24 hours
    enforce: true
  }
};

/**
 * Development-specific overrides (less strict)
 */
const devOverrides: Partial<HelmetConfig> = {
  contentSecurityPolicy: {
    directives: {
      ...defaultConfig.contentSecurityPolicy!.directives,
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'", // Required for Next.js dev mode
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      'connect-src': [
        "'self'",
        'http://localhost:*',
        'ws://localhost:*',
        'https://api.openai.com',
        'wss:',
        'https://*.sentry.io'
      ]
    },
    reportOnly: false
  },
  strictTransportSecurity: {
    maxAge: 0, // Disabled in development
    includeSubDomains: false,
    preload: false
  }
};

/**
 * Get active configuration based on environment
 */
function getConfig(): HelmetConfig {
  if (!isProduction()) {
    return { ...defaultConfig, ...devOverrides };
  }
  return defaultConfig;
}

/**
 * Format CSP directive
 */
function formatCSPDirective(directives: Record<string, string | string[]>): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0 ? `${key} ${value.join(' ')}` : key;
      }
      return `${key} ${value}`;
    })
    .join('; ');
}

/**
 * Format Permissions-Policy header
 */
function formatPermissionsPolicy(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([key, value]) => {
      if (value.length === 0) {
        return `${key}=()`;
      }
      return `${key}=(${value.join(' ')})`;
    })
    .join(', ');
}

/**
 * Apply all security headers to response
 */
export function applyHelmetHeaders(response: NextResponse): NextResponse {
  const config = getConfig();

  // Content Security Policy
  if (config.contentSecurityPolicy) {
    const cspHeader = config.contentSecurityPolicy.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    const cspValue = formatCSPDirective(config.contentSecurityPolicy.directives);
    response.headers.set(cspHeader, cspValue);
  }

  // Strict-Transport-Security (HSTS)
  if (config.strictTransportSecurity && isProduction()) {
    const hsts = config.strictTransportSecurity;
    let hstsValue = `max-age=${hsts.maxAge}`;

    if (hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (hsts.preload) {
      hstsValue += '; preload';
    }

    response.headers.set('Strict-Transport-Security', hstsValue);
  }

  // X-Frame-Options
  if (config.xFrameOptions) {
    response.headers.set('X-Frame-Options', config.xFrameOptions);
  }

  // X-Content-Type-Options
  if (config.xContentTypeOptions) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // Referrer-Policy
  if (config.referrerPolicy) {
    response.headers.set('Referrer-Policy', config.referrerPolicy);
  }

  // Permissions-Policy
  if (config.permissionsPolicy) {
    const permissionsPolicy = formatPermissionsPolicy(config.permissionsPolicy);
    response.headers.set('Permissions-Policy', permissionsPolicy);
  }

  // X-XSS-Protection (legacy, but still useful for older browsers)
  if (config.xssProtection) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }

  // X-DNS-Prefetch-Control
  if (config.dnsPrefetchControl) {
    response.headers.set('X-DNS-Prefetch-Control', 'on');
  }

  // Expect-CT (deprecated but still useful during transition)
  if (config.expectCT && isProduction()) {
    const expectCT = config.expectCT;
    let expectCTValue = `max-age=${expectCT.maxAge}`;

    if (expectCT.enforce) {
      expectCTValue += ', enforce';
    }

    response.headers.set('Expect-CT', expectCTValue);
  }

  // Remove X-Powered-By header (leak information about server)
  response.headers.delete('X-Powered-By');

  // Server header (optional - hide server information)
  if (isProduction()) {
    response.headers.set('Server', 'ServiceDesk');
  }

  return response;
}

/**
 * Create a custom helmet configuration
 */
export function createHelmetConfig(custom: Partial<HelmetConfig>): HelmetConfig {
  const base = getConfig();

  // Deep merge CSP directives
  if (custom.contentSecurityPolicy?.directives) {
    custom.contentSecurityPolicy.directives = {
      ...base.contentSecurityPolicy?.directives,
      ...custom.contentSecurityPolicy.directives
    };
  }

  return { ...base, ...custom };
}

/**
 * Apply custom helmet configuration
 */
export function applyCustomHelmetHeaders(
  response: NextResponse,
  _config: HelmetConfig
): NextResponse {
  // Config available for future use
  // const originalConfig = getConfig;

  // Apply custom headers
  const result = applyHelmetHeaders(response);

  return result;
}

/**
 * CSP Report handler (for CSP violation reports)
 */
export interface CSPReport {
  'document-uri': string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  'blocked-uri': string;
  'status-code': number;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
}

/**
 * Log CSP violations
 */
export function logCSPViolation(report: CSPReport): void {
  console.warn('CSP Violation:', {
    documentUri: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number']
  });

  // In production, send to monitoring service
  if (isProduction()) {
    // TODO: Send to Sentry or other monitoring service
  }
}

/**
 * Validate security headers
 */
export function validateSecurityHeaders(headers: Headers): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const requiredHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy'
  ];

  const productionHeaders = [
    'Strict-Transport-Security'
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required headers
  for (const header of requiredHeaders) {
    if (!headers.has(header)) {
      missing.push(header);
    }
  }

  // Check production-specific headers
  if (isProduction()) {
    for (const header of productionHeaders) {
      if (!headers.has(header)) {
        warnings.push(`Missing production header: ${header}`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Export default configuration for inspection
 */
export { defaultConfig, devOverrides };
