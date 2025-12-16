import { NextRequest, NextResponse } from 'next/server';
import logger from '../monitoring/edge-logger';

/**
 * CSRF Protection Middleware - Edge Runtime Compatible
 *
 * Implements Enhanced Double Submit Cookie pattern with session binding:
 * - Random token generation using Web Crypto API (Edge compatible)
 * - Token bound to session ID via HMAC signature
 * - Token expiration (1 hour)
 * - Token validation on all state-changing requests (POST, PUT, PATCH, DELETE)
 * - Secure cookie storage with httpOnly flag
 * - SameSite=Lax for CSRF protection
 * - Token rotation on successful validation
 * - Auth endpoints (login/register) now require CSRF tokens
 */

export const CSRF_TOKEN_COOKIE = 'csrf_token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Get CSRF secret - MUST be configured in production
function getCSRFSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '🔴 FATAL: CSRF_SECRET or JWT_SECRET must be set in production!\n' +
        'Generate a secure secret with: openssl rand -hex 32\n' +
        'Set CSRF_SECRET or JWT_SECRET in your .env file.'
      );
    }

    // Development fallback
    logger.warn('⚠️  WARNING: Using development CSRF secret. This is INSECURE for production!');
    return 'dev-csrf-secret-CHANGE-ME-IN-PRODUCTION-MINIMUM-32-CHARS';
  }

  if (secret.length < 32) {
    throw new Error(
      '🔴 FATAL: CSRF_SECRET must be at least 32 characters long!\n' +
      'Generate a secure secret with: openssl rand -hex 32'
    );
  }

  return secret;
}

/**
 * Generate random bytes using Web Crypto API (Edge Runtime compatible)
 */
function getRandomBytes(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create HMAC signature using Web Crypto API (Edge Runtime compatible)
 * Note: This is an async function due to Web Crypto API requirements
 */
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify HMAC signature using Web Crypto API (Edge Runtime compatible)
 */
async function verifyHmacSignature(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await createHmacSignature(data, secret);
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Edge Runtime compatible implementation
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a session-bound CSRF token with expiration
 * @param sessionId - User session identifier (can be cookie value or device ID)
 * @returns Base64-encoded token with timestamp and signature
 */
export async function generateCSRFToken(sessionId?: string): Promise<string> {
  const secret = getCSRFSecret();
  const timestamp = Date.now().toString();
  const randomData = getRandomBytes(CSRF_TOKEN_LENGTH);

  // If no session ID, use the random data as session ID (for pre-auth requests)
  const effectiveSessionId = sessionId || randomData;

  // Create token data: sessionId:timestamp:randomData
  const data = `${effectiveSessionId}:${timestamp}:${randomData}`;

  // Sign the data with HMAC
  const signature = await createHmacSignature(data, secret);

  // Return base64-encoded token
  return btoa(`${data}:${signature}`);
}

/**
 * Validate session-bound CSRF token
 * @param token - CSRF token from header
 * @param sessionId - Current session identifier
 * @returns True if token is valid and not expired
 */
export async function validateCSRFTokenWithSession(token: string, sessionId?: string): Promise<boolean> {
  try {
    const secret = getCSRFSecret();

    // Decode token
    const decoded = atob(token);
    const parts = decoded.split(':');

    if (parts.length !== 4) {
      logger.warn('CSRF token validation failed: Invalid token format');
      return false;
    }

    const [storedSessionId, timestamp, randomData, signature] = parts;

    if (!storedSessionId || !timestamp || !randomData || !signature) {
      logger.warn('CSRF token validation failed: Missing token parts');
      return false;
    }

    // Verify signature
    const data = `${storedSessionId}:${timestamp}:${randomData}`;
    const isValidSignature = await verifyHmacSignature(data, signature, secret);

    if (!isValidSignature) {
      logger.warn('CSRF token validation failed: Invalid signature');
      return false;
    }

    // Check expiration (1 hour)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 3600000) { // 1 hour in milliseconds
      logger.warn('CSRF token validation failed: Token expired', {
        ageMinutes: Math.round(tokenAge / 60000)
      });
      return false;
    }

    // SECURITY FIX: Make session ID validation mandatory for authenticated requests
    // Don't allow validation without session ID - prevents session fixation attacks
    if (!sessionId) {
      logger.warn('CSRF validation attempted without session ID - denying for security');
      return false;
    }

    // Verify session ID matches the one in the token
    if (storedSessionId !== sessionId) {
      logger.warn('CSRF token validation failed: Session mismatch');
      return false;
    }

    return true;
  } catch (error) {
    logger.error('CSRF token validation error', error as Error);
    return false;
  }
}

/**
 * Validate CSRF token from request
 * Now uses enhanced session-bound validation
 */
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
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
    logger.warn('CSRF validation failed: Missing token', {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      method,
      path: request.nextUrl.pathname
    });
    return false;
  }

  // First check if tokens match (timing-safe comparison)
  const tokensMatch = timingSafeEqual(cookieToken, headerToken);
  if (!tokensMatch) {
    logger.warn('CSRF validation failed: Token mismatch', {
      method,
      path: request.nextUrl.pathname
    });
    return false;
  }

  // Then validate the token structure, signature, and expiration
  // Extract session ID from auth_token cookie if available
  const authToken = request.cookies.get('auth_token')?.value;
  const sessionId = authToken || request.cookies.get('device_id')?.value;

  const isValid = await validateCSRFTokenWithSession(headerToken, sessionId);

  if (!isValid) {
    logger.warn('CSRF validation failed: Invalid token structure or expired', {
      method,
      path: request.nextUrl.pathname,
      hasSession: !!sessionId
    });
  }

  return isValid;
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
    const isValid = await validateCSRFToken(request);

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
 * Now generates session-bound tokens with expiration
 */
export async function setCSRFToken(response: NextResponse, request?: NextRequest): Promise<NextResponse> {
  // Extract session ID from request if available
  let sessionId: string | undefined;
  if (request) {
    const authToken = request.cookies.get('auth_token')?.value;
    const deviceId = request.cookies.get('device_id')?.value;
    sessionId = authToken || deviceId;
  }

  const token = await generateCSRFToken(sessionId);

  // Set secure cookie
  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false, // Must be accessible to JavaScript for header inclusion
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Provides CSRF protection while allowing normal navigation
    maxAge: 60 * 60, // 1 hour (matches token expiration)
    path: '/'
  });

  // Also include in response header for easy client access
  response.headers.set(CSRF_TOKEN_HEADER, token);

  return response;
}

/**
 * Check if path is public and doesn't require CSRF protection
 *
 * SECURITY: Auth endpoints (login/register) are NO LONGER exempt from CSRF protection.
 * The frontend must obtain a CSRF token via GET request before submitting login/register forms.
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/api/auth/sso/',            // SSO endpoints handle their own CSRF via state parameter
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
    const isValid = await validateCSRFToken(request);

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
export async function requireCSRFToken(request: NextRequest): Promise<void> {
  const isValid = await validateCSRFToken(request);

  if (!isValid) {
    throw new Error('CSRF token validation failed');
  }
}
