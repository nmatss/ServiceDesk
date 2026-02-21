/**
 * Gov.br OAuth Initiation Route
 * GET /api/auth/govbr
 *
 * Initiates OAuth flow by redirecting to Gov.br authorization endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGovBrClient } from '@/lib/integrations/govbr/oauth-client';
import { logger } from '@/lib/monitoring/logger';
import crypto from 'crypto';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = request.nextUrl;
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    // Check if Gov.br is configured
    if (!process.env.GOVBR_CLIENT_ID || !process.env.GOVBR_CLIENT_SECRET) {
      if (process.env.NODE_ENV !== 'production') {
        const fallbackUrl = new URL('/auth/login', request.url);
        fallbackUrl.searchParams.set('govbr', 'unavailable');
        fallbackUrl.searchParams.set('reason', 'not_configured');
        return NextResponse.redirect(fallbackUrl);
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Gov.br OAuth not configured',
        },
        { status: 503 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Create OAuth client
    const client = getGovBrClient();

    // Get authorization URL
    const authUrl = client.generateAuthorizationUrl(state, [
      'openid',
      'profile',
      'email',
      'phone',
      'govbr_confiabilidades', // Request trust level information
    ]);

    // Store state and returnUrl in session/cookie for validation in callback
    const response = NextResponse.redirect(authUrl);

    // Set secure cookies
    response.cookies.set('govbr_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    response.cookies.set('govbr_return_url', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    logger.info('Gov.br OAuth flow initiated', {
      hasState: !!state,
      returnUrl,
    });

    return response;
  } catch (error) {
    logger.error('Error initiating Gov.br OAuth', { error });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate Gov.br authentication',
      },
      { status: 500 }
    );
  }
}
