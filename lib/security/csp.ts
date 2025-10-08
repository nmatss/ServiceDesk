/**
 * Content Security Policy (CSP) Implementation
 * Enterprise-grade CSP headers with nonce support and violation reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSecurityConfig } from './config';
import { logger } from '../monitoring/logger';

export interface CspNonce {
  nonce: string;
  scriptNonce: string;
  styleNonce: string;
}

/**
 * Generate cryptographically secure nonces for CSP
 */
export function generateCspNonces(): CspNonce {
  const nonce = randomBytes(16).toString('base64');
  return {
    nonce,
    scriptNonce: nonce,
    styleNonce: randomBytes(16).toString('base64')
  };
}

/**
 * Build CSP header value from configuration
 */
export function buildCspHeader(nonces?: CspNonce): string {
  const config = getSecurityConfig();
  const csp = config.csp;
  const directives: string[] = [];

  // Helper function to add nonce to directive
  const addNonce = (sources: string[], nonceValue?: string): string[] => {
    if (nonceValue && csp.useNonce) {
      return [...sources, `'nonce-${nonceValue}'`];
    }
    return sources;
  };

  // Build each directive
  const directiveMap = {
    'default-src': csp.directives.defaultSrc,
    'script-src': addNonce(csp.directives.scriptSrc, nonces?.scriptNonce),
    'style-src': addNonce(csp.directives.styleSrc, nonces?.styleNonce),
    'img-src': csp.directives.imgSrc,
    'font-src': csp.directives.fontSrc,
    'connect-src': csp.directives.connectSrc,
    'media-src': csp.directives.mediaSrc,
    'object-src': csp.directives.objectSrc,
    'frame-src': csp.directives.frameSrc,
    'worker-src': csp.directives.workerSrc,
    'manifest-src': csp.directives.manifestSrc,
    'base-uri': csp.directives.baseUri,
    'form-action': csp.directives.formAction,
    'frame-ancestors': csp.directives.frameAncestors
  };

  // Add standard directives
  for (const [directive, sources] of Object.entries(directiveMap)) {
    if (sources && sources.length > 0) {
      directives.push(`${directive} ${sources.join(' ')}`);
    }
  }

  // Add upgrade-insecure-requests if enabled
  if (csp.directives.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  // Add report-uri if specified
  if (csp.reportUri) {
    directives.push(`report-uri ${csp.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Apply CSP headers to response
 */
export function applyCspHeaders(response: NextResponse, nonces?: CspNonce): void {
  const config = getSecurityConfig();
  const csp = config.csp;

  const cspValue = buildCspHeader(nonces);
  const headerName = csp.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  response.headers.set(headerName, cspValue);

  // Set nonce headers for client-side access
  if (nonces && csp.useNonce) {
    response.headers.set('X-Script-Nonce', nonces.scriptNonce);
    response.headers.set('X-Style-Nonce', nonces.styleNonce);
  }
}

/**
 * CSP middleware for Next.js
 */
export function createCspMiddleware() {
  return (request: NextRequest): NextResponse => {
    const response = NextResponse.next();

    // Skip CSP for API routes (they don't need it)
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return response;
    }

    // Generate nonces for this request
    const nonces = generateCspNonces();

    // Apply CSP headers
    applyCspHeaders(response, nonces);

    return response;
  };
}

/**
 * CSP violation report handler
 */
export interface CspViolationReport {
  'csp-report': {
    'blocked-uri': string;
    'document-uri': string;
    'effective-directive': string;
    'original-policy': string;
    'referrer': string;
    'script-sample': string;
    'status-code': number;
    'violated-directive': string;
  };
}

/**
 * Process CSP violation reports
 */
export function processCspViolation(report: CspViolationReport, request: NextRequest): void {
  const violation = report['csp-report'];

  const logData = {
    timestamp: new Date().toISOString(),
    type: 'csp_violation',
    blockedUri: violation['blocked-uri'],
    documentUri: violation['document-uri'],
    effectiveDirective: violation['effective-directive'],
    violatedDirective: violation['violated-directive'],
    scriptSample: violation['script-sample'],
    userAgent: request.headers.get('user-agent'),
    ip: request.ip || request.headers.get('x-forwarded-for'),
    referrer: violation.referrer
  };

  // Log the violation
  logger.warn('CSP Violation', logData);

  // Filter out known false positives
  if (isKnownFalsePositive(violation)) {
    return;
  }

  // Alert on repeated violations
  checkViolationPattern(logData);

  // In production, send to security monitoring
  if (process.env.NODE_ENV === 'production') {
    sendSecurityAlert('csp_violation', logData);
  }
}

/**
 * Check if violation is a known false positive
 */
function isKnownFalsePositive(violation: CspViolationReport['csp-report']): boolean {
  const blockedUri = violation['blocked-uri'];
  const documentUri = violation['document-uri'];

  // Browser extensions
  const extensionPatterns = [
    /^chrome-extension:/,
    /^moz-extension:/,
    /^safari-extension:/,
    /^ms-browser-extension:/
  ];

  if (extensionPatterns.some(pattern => pattern.test(blockedUri))) {
    return true;
  }

  // Common false positives
  const falsePositives = [
    'data:',
    'blob:',
    'about:blank',
    'javascript:void(0)'
  ];

  return falsePositives.some(fp => blockedUri.startsWith(fp));
}

/**
 * Track violation patterns for anomaly detection
 */
const violationCache = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();

function checkViolationPattern(violation: any): void {
  const key = `${violation.documentUri}:${violation.violatedDirective}`;
  const now = Date.now();
  const existing = violationCache.get(key);

  if (!existing) {
    violationCache.set(key, { count: 1, firstSeen: now, lastSeen: now });
    return;
  }

  existing.count++;
  existing.lastSeen = now;

  // Alert on anomalous patterns
  const timeDiff = now - existing.firstSeen;
  const rate = existing.count / (timeDiff / 1000 / 60); // violations per minute

  if (rate > 10) { // More than 10 violations per minute
    logger.error('CSP Violation Storm Detected', {
      pattern: key,
      count: existing.count,
      rate: rate.toFixed(2),
      duration: Math.round(timeDiff / 1000)
    });
  }
}

/**
 * Send security alert (placeholder for monitoring integration)
 */
function sendSecurityAlert(type: string, data: any): void {
  // TODO: Integrate with your security monitoring system
  // Examples: Sentry, DataDog, Splunk, custom webhook

  const alertData = {
    type,
    severity: 'medium',
    timestamp: new Date().toISOString(),
    data
  };

  // Log for now, replace with actual alert mechanism
  logger.info('Security Alert', alertData);
}

/**
 * Validate CSP configuration
 */
export function validateCspConfig(): string[] {
  const config = getSecurityConfig();
  const csp = config.csp;
  const errors: string[] = [];

  // Check for unsafe directives in production
  if (process.env.NODE_ENV === 'production') {
    const unsafePatterns = ["'unsafe-inline'", "'unsafe-eval'"];

    for (const directive of Object.values(csp.directives)) {
      if (Array.isArray(directive)) {
        for (const source of directive) {
          if (unsafePatterns.includes(source)) {
            errors.push(`Unsafe CSP directive found in production: ${source}`);
          }
        }
      }
    }
  }

  // Check for missing report-uri
  if (!csp.reportUri) {
    errors.push('CSP report-uri should be configured for violation tracking');
  }

  // Check for overly permissive directives
  for (const [directive, sources] of Object.entries(csp.directives)) {
    if (Array.isArray(sources) && sources.includes('*')) {
      errors.push(`Overly permissive CSP directive: ${directive} allows all sources (*)`);
    }
  }

  return errors;
}

/**
 * Generate CSP for development mode with relaxed policies
 */
export function getDevCspConfig(): Partial<typeof getSecurityConfig> {
  return {
    csp: {
      useNonce: false, // Disable nonce in development for easier debugging
      reportOnly: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: false
      }
    }
  } as any;
}