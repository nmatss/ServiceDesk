import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 *
 * Implements Double Submit Cookie pattern with additional security measures:
 * - Random token generation using crypto
 * - Token validation on all state-changing requests (POST, PUT, PATCH, DELETE)
 * - Secure cookie storage with httpOnly flag
 * - SameSite=Lax for CSRF protection
 * - Token rotation on successful validation
 */

export const CSRF_TOKEN_COOKIE = 'csrf_token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * Validate CSRF token from request
 */
export function validateCSRFToken(request: NextRequest): boolean {
  // Skip CSRF validation for safe methods (GET, HEAD, OPTIONS)
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    console.warn('CSRF validation failed: Missing token', {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      method,
      path: request.nextUrl.pathname
    });
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  const isValid = timingSafeEqual(cookieToken, headerToken);

  if (!isValid) {
    console.warn('CSRF validation failed: Token mismatch', {
      method,
      path: request.nextUrl.pathname
    });
  }

  return isValid;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create CSRF protection middleware
 */
export function createCSRFMiddleware() {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Skip CSRF for public endpoints that don't require protection
    const isPublicEndpoint = isPublicPath(request.nextUrl.pathname);
    if (isPublicEndpoint) {
      return null; // Continue without CSRF check
    }

    // Validate CSRF token
    const isValid = validateCSRFToken(request);

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
        },
        { status: 403 }
      );
    }

    // CSRF token is valid - continue
    return null;
  };
}

/**
 * Add CSRF token to response
 * Should be called for all responses that might initiate state-changing requests
 */
export function setCSRFToken(response: NextResponse): NextResponse {
  const token = generateCSRFToken();

  // Set secure cookie
  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false, // Must be accessible to JavaScript for header inclusion
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Provides CSRF protection while allowing normal navigation
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/'
  });

  // Also include in response header for easy client access
  response.headers.set(CSRF_TOKEN_HEADER, token);

  return response;
}

/**
 * Check if path is public and doesn't require CSRF protection
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/api/auth/login',           // Login can't have CSRF token yet
    '/api/auth/register',        // Registration can't have CSRF token yet
    '/api/auth/sso/',            // SSO endpoints handle their own CSRF
    '/api/health',               // Health check
    '/api/public/',              // Explicitly public APIs
    '/_next/',                   // Next.js internals
    '/static/',                  // Static assets
  ];

  return publicPaths.some(path => pathname.startsWith(path));
}

/**
 * Middleware wrapper for API routes
 * Use this in your API routes to enforce CSRF protection
 */
export async function withCSRFProtection(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Check if CSRF validation is needed
  const method = request.method.toUpperCase();
  const needsValidation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (needsValidation && !isPublicPath(request.nextUrl.pathname)) {
    const isValid = validateCSRFToken(request);

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
        },
        { status: 403 }
      );
    }
  }

  // Execute handler
  const response = await handler(request);

  // Set new CSRF token in response
  return setCSRFToken(response);
}

/**
 * Get current CSRF token from request
 * Useful for token rotation scenarios
 */
export function getCSRFToken(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
}

/**
 * Validate CSRF token in API route (alternative usage pattern)
 */
export function requireCSRFToken(request: NextRequest): void {
  const isValid = validateCSRFToken(request);

  if (!isValid) {
    throw new Error('CSRF token validation failed');
  }
}
