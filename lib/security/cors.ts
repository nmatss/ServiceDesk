/**
 * CORS (Cross-Origin Resource Sharing) Security Implementation
 * Enterprise-grade CORS policies with environment-specific configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityConfig } from './config';

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

/**
 * CORS middleware for Next.js API routes
 */
export function createCorsMiddleware(customOptions?: Partial<CorsOptions>) {
  const config = getSecurityConfig();
  const corsConfig = config.cors;

  const options: CorsOptions = {
    origin: createOriginValidator(corsConfig.allowedOrigins),
    methods: corsConfig.allowedMethods,
    allowedHeaders: corsConfig.allowedHeaders,
    exposedHeaders: corsConfig.exposedHeaders,
    credentials: corsConfig.credentials,
    maxAge: corsConfig.maxAge,
    preflightContinue: corsConfig.preflightContinue,
    optionsSuccessStatus: corsConfig.optionsSuccessStatus,
    ...customOptions
  };

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const response = NextResponse.next();
    const origin = request.headers.get('origin');
    const method = request.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return handlePreflightRequest(request, options);
    }

    // Apply CORS headers to actual requests
    applyCorsHeaders(response, origin, options);

    return null; // Continue with the request
  };
}

/**
 * Create origin validator function
 */
function createOriginValidator(allowedOrigins: string[]): (origin: string) => boolean {
  return (origin: string): boolean => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return true;
    }

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return true;
    }

    // Check wildcard patterns
    for (const allowedOrigin of allowedOrigins) {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(origin)) {
          return true;
        }
      }
    }

    // Development mode: allow localhost with any port
    if (process.env.NODE_ENV === 'development') {
      const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
      if (localhostPattern.test(origin)) {
        return true;
      }
    }

    return false;
  };
}

/**
 * Handle preflight (OPTIONS) requests
 */
function handlePreflightRequest(request: NextRequest, options: CorsOptions): NextResponse {
  const origin = request.headers.get('origin');
  const requestMethod = request.headers.get('access-control-request-method');
  const requestHeaders = request.headers.get('access-control-request-headers');

  // Validate origin
  if (origin && typeof options.origin === 'function' && !options.origin(origin)) {
    return new NextResponse(null, {
      status: 403,
      statusText: 'CORS: Origin not allowed'
    });
  }

  // Validate method
  if (requestMethod && options.methods && !options.methods.includes(requestMethod)) {
    return new NextResponse(null, {
      status: 405,
      statusText: 'CORS: Method not allowed'
    });
  }

  // Create preflight response
  const response = new NextResponse(null, {
    status: options.optionsSuccessStatus || 204
  });

  // Apply CORS headers
  applyCorsHeaders(response, origin, options);

  // Add method and headers for preflight
  if (options.methods) {
    response.headers.set('Access-Control-Allow-Methods', options.methods.join(', '));
  }

  if (requestHeaders && options.allowedHeaders) {
    const requestedHeaders = requestHeaders.split(',').map(h => h.trim());
    const allowedHeaders = requestedHeaders.filter(h =>
      options.allowedHeaders!.some(ah => ah.toLowerCase() === h.toLowerCase())
    );
    if (allowedHeaders.length > 0) {
      response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }
  }

  // Set max age for preflight cache
  if (options.maxAge) {
    response.headers.set('Access-Control-Max-Age', options.maxAge.toString());
  }

  return response;
}

/**
 * Apply CORS headers to response
 */
function applyCorsHeaders(response: NextResponse, origin: string | null, options: CorsOptions): void {
  // Set origin header
  if (origin && typeof options.origin === 'function' && options.origin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (typeof options.origin === 'string') {
    response.headers.set('Access-Control-Allow-Origin', options.origin);
  } else if (Array.isArray(options.origin) && origin && options.origin.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  // Set credentials header
  if (options.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Set exposed headers
  if (options.exposedHeaders && options.exposedHeaders.length > 0) {
    response.headers.set('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
  }

  // Add Vary header for origin-based responses
  response.headers.set('Vary', 'Origin');
}

/**
 * Validate CORS configuration
 */
export function validateCorsConfig(origins: string[]): string[] {
  const errors: string[] = [];

  if (!origins || origins.length === 0) {
    errors.push('At least one allowed origin must be specified');
    return errors;
  }

  for (const origin of origins) {
    // Check for valid URL format
    if (origin !== '*' && !origin.includes('*')) {
      try {
        new URL(origin);
      } catch {
        errors.push(`Invalid origin URL: ${origin}`);
      }
    }

    // Check for insecure origins in production
    if (process.env.NODE_ENV === 'production' && origin.startsWith('http://')) {
      errors.push(`Insecure origin not allowed in production: ${origin}`);
    }

    // Check for overly permissive wildcards
    if (origin === '*' && process.env.NODE_ENV === 'production') {
      errors.push('Wildcard origin (*) not recommended for production');
    }
  }

  return errors;
}

/**
 * Security headers for enhanced CORS protection
 */
export function addSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
}

/**
 * Rate limiting for CORS preflight requests
 */
const preflightCache = new Map<string, { count: number; resetTime: number }>();

export function checkPreflightRateLimit(origin: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const key = `preflight:${origin}`;
  const current = preflightCache.get(key);

  if (!current || now > current.resetTime) {
    preflightCache.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count++;
  return true;
}

/**
 * Log CORS violations for security monitoring
 */
export function logCorsViolation(origin: string, reason: string, request: NextRequest): void {
  const logData = {
    timestamp: new Date().toISOString(),
    type: 'cors_violation',
    origin,
    reason,
    userAgent: request.headers.get('user-agent'),
    ip: request.ip || request.headers.get('x-forwarded-for'),
    url: request.url,
    method: request.method
  };

  console.warn('CORS Violation:', logData);

  // In production, send to security monitoring system
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with security monitoring service
    // sendSecurityAlert('cors_violation', logData);
  }
}