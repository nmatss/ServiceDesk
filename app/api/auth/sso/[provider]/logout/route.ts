/**
 * SSO Provider Logout Route
 *
 * Handles logout from SSO provider and local application
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import ssoManager from '@/lib/auth/sso-manager';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const COOKIE_NAME = 'servicedesk_token';

/**
 * POST /api/auth/sso/[provider]/logout
 * Logout from SSO provider
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const cookieStore = await cookies();

    // Clear local authentication cookie
    cookieStore.delete(COOKIE_NAME);
    cookieStore.delete('sso_state');
    cookieStore.delete('sso_redirect');

    // Get provider configuration
    const providerConfig = ssoManager.getProvider(provider);

    if (!providerConfig) {
      return NextResponse.json({
        success: true,
        message: 'Logged out locally (provider not found)',
      });
    }

    // For SAML providers, generate logout request
    if (providerConfig.type === 'saml2') {
      const sloUrl = providerConfig.configuration.sloUrl;

      if (sloUrl) {
        // In production, implement proper SAML logout request
        return NextResponse.json({
          success: true,
          message: 'Logged out',
          sloUrl, // Client should redirect to this URL
        });
      }
    }

    // For OAuth providers, logout is typically handled client-side
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('SSO logout error', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/sso/[provider]/logout
 * Alternative GET endpoint for logout
 */
export async function GET(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;
 params: { provider: _provider } }: { params: { provider: string } }
) {
  const cookieStore = await cookies();

  // Clear cookies
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete('sso_state');
  cookieStore.delete('sso_redirect');

  // Redirect to login page
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
