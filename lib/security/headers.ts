/**
 * Security Headers Module
 * Centralized security headers configuration
 */

import type { NextResponse } from 'next/server'

export interface SecurityHeadersConfig {
  enableHSTS?: boolean
  enableXFrameOptions?: boolean
  enableXContentTypeOptions?: boolean
  enableXSSProtection?: boolean
  enableReferrerPolicy?: boolean
}

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = {}
): NextResponse {
  const {
    enableHSTS = process.env.NODE_ENV === 'production',
    enableXFrameOptions = true,
    enableXContentTypeOptions = true,
    enableXSSProtection = true,
    enableReferrerPolicy = true,
  } = config

  // X-Content-Type-Options
  if (enableXContentTypeOptions) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }

  // X-Frame-Options
  if (enableXFrameOptions) {
    response.headers.set('X-Frame-Options', 'DENY')
  }

  // X-XSS-Protection (legacy, but still good to have)
  if (enableXSSProtection) {
    response.headers.set('X-XSS-Protection', '1; mode=block')
  }

  // Referrer-Policy
  if (enableReferrerPolicy) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  }

  // Strict-Transport-Security (HSTS)
  if (enableHSTS) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // NOTE: CSP is handled exclusively by lib/security/helmet.ts to avoid conflicts.

  // Permissions-Policy (formerly Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )

  return response
}

/**
 * Sanitize header value to prevent header injection
 */
export function sanitizeHeaderValue(value: string): string {
  // Remove control characters and newlines
  return value.replace(/[\x00-\x1F\x7F]/g, '')
}

/**
 * Validate and sanitize custom headers
 */
export function setCustomHeader(
  response: NextResponse,
  name: string,
  value: string | number
): void {
  const sanitizedName = sanitizeHeaderValue(name)
  const sanitizedValue = sanitizeHeaderValue(String(value))

  if (sanitizedName && sanitizedValue) {
    response.headers.set(sanitizedName, sanitizedValue)
  }
}
