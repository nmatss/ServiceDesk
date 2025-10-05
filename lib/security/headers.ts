/**
 * Security Headers Module
 * Centralized security headers configuration
 */

import type { NextResponse } from 'next/server'

export interface SecurityHeadersConfig {
  enableCSP?: boolean
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
    enableCSP = true,
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

  // Content-Security-Policy
  if (enableCSP) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.openai.com wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)
  }

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
