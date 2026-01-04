/**
 * Token Refresh Endpoint
 *
 * Handles automatic token rotation:
 * - Validates refresh token
 * - Generates new access token
 * - Generates new refresh token (rotation)
 * - Revokes old refresh token
 * - Returns new tokens via httpOnly cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractTokensFromRequest,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  revokeRefreshToken,
  getOrCreateDeviceId
} from '@/lib/auth/token-manager';
import { captureAuthError } from '@/lib/monitoring/sentry-helpers';
import { logger } from '@/lib/monitoring/logger';
import { createRateLimitMiddleware } from '@/lib/rate-limit';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Rate limiting para refresh tokens
const refreshRateLimit = createRateLimitMiddleware('refresh');

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  // Apply rate limiting
  const rateLimitResult = await refreshRateLimit(request, '/api/auth/refresh');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult; // Rate limit exceeded
  }
  try {
    // Extract tokens and device fingerprint from request
    const { refreshToken, deviceFingerprint } = extractTokensFromRequest(request);

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'No refresh token provided',
          code: 'MISSING_REFRESH_TOKEN'
        },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken, deviceFingerprint);

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        },
        { status: 401 }
      );
    }

    // Revoke old refresh token (token rotation)
    const revoked = revokeRefreshToken(refreshToken);
    if (!revoked) {
      logger.warn('Failed to revoke old refresh token during rotation', {
        user_id: payload.user_id
      });
    }

    // Get or create device ID
    const deviceId = getOrCreateDeviceId(request);

    // Generate new tokens
    const newAccessToken = await generateAccessToken({
      ...payload,
      device_fingerprint: deviceFingerprint
    });

    const newRefreshToken = await generateRefreshToken(
      payload,
      deviceFingerprint
    );

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
      user: {
        id: payload.user_id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        tenant_id: payload.tenant_id,
        tenant_slug: payload.tenant_slug
      }
    });

    // Set new authentication cookies
    setAuthCookies(response, newAccessToken, newRefreshToken, deviceId);

    logger.info('Tokens refreshed successfully', {
      user_id: payload.user_id,
      tenant_id: payload.tenant_id
    });

    return response;

  } catch (error) {
    captureAuthError(error, { method: 'refresh_token' });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh tokens',
        code: 'REFRESH_FAILED'
      },
      { status: 500 }
    );
  }
}

/**
 * GET method for token validation (optional)
 * Checks if current refresh token is valid without rotating it
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { refreshToken, deviceFingerprint } = extractTokensFromRequest(request);

    if (!refreshToken) {
      return NextResponse.json({
        valid: false,
        message: 'No refresh token found'
      });
    }

    const payload = await verifyRefreshToken(refreshToken, deviceFingerprint);

    if (!payload) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid or expired refresh token'
      });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: payload.user_id,
        email: payload.email,
        role: payload.role,
        tenant_id: payload.tenant_id
      }
    });

  } catch (error) {
    captureAuthError(error, { method: 'refresh_token_validation' });

    return NextResponse.json({
      valid: false,
      message: 'Validation failed'
    });
  }
}
