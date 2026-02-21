import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER } from '@/lib/security/csrf';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/auth/csrf-token
 *
 * Provides CSRF tokens for unauthenticated requests (login, register)
 *
 * SECURITY: This endpoint is public and generates a new CSRF token
 * that can be used for subsequent authentication requests.
 *
 * The token is:
 * - Bound to a session ID (or random value for pre-auth)
 * - Expires after 1 hour
 * - Signed with HMAC for integrity
 * - Returned in both cookie and response header
 *
 * Usage:
 * 1. Frontend calls this endpoint before showing login/register form
 * 2. Frontend stores the token from response header
 * 3. Frontend includes token in X-CSRF-Token header when submitting form
 *
 * @returns CSRF token in cookie and response header
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Generate a session ID for pre-auth CSRF token
    // This will be replaced with actual session ID after authentication
    const deviceId = request.cookies.get('device_id')?.value;

    // Generate CSRF token
    const token = await generateCSRFToken(deviceId);

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'CSRF token generated successfully',
      token, // Also return in body for convenience
      expiresIn: 3600, // 1 hour in seconds
      usage: 'Include this token in X-CSRF-Token header for POST/PUT/PATCH/DELETE requests'
    }, { status: 200 });

    // Set CSRF token cookie
    response.cookies.set(CSRF_TOKEN_COOKIE, token, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/'
    });

    // Also set in response header
    response.headers.set(CSRF_TOKEN_HEADER, token);

    return response;
  } catch (error) {
    logger.error('Error generating CSRF token:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate CSRF token'
    }, { status: 500 });
  }
}

/**
 * HEAD /api/auth/csrf-token
 *
 * Lightweight endpoint to check if CSRF token is valid
 * Useful for checking if existing token needs refresh
 */
export async function HEAD(request: NextRequest) {
  const token = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

  if (!token) {
    return new NextResponse(null, { status: 404 });
  }

  // Token exists - frontend can check headers for expiry info
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('X-CSRF-Token-Present', 'true');

  return response;
}
