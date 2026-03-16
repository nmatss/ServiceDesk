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
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'servicedesk_token';
const REFRESH_COOKIE_NAME = 'servicedesk_refresh_token';

/**
 * POST /api/auth/sso/[provider]/logout
 * Logout from SSO provider
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { provider } = await params;
    const cookieStore = await cookies();

    // Clear local authentication cookies
    cookieStore.delete(COOKIE_NAME);
    cookieStore.delete(REFRESH_COOKIE_NAME);
    cookieStore.delete('sso_state');
    cookieStore.delete('sso_redirect');

    // Get provider configuration
    const providerConfig = await ssoManager.getProvider(provider);

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
  { params }: { params: Promise<{ provider: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;
  const cookieStore = await cookies();

  // Clear all auth cookies
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  cookieStore.delete('sso_state');
  cookieStore.delete('sso_redirect');

  const { provider } = await params;

  // Check if provider has a logout URL to redirect to
  try {
    const providerConfig = await ssoManager.getProvider(provider);
    const config = providerConfig?.configuration as Record<string, unknown> | undefined;
    if (providerConfig?.type === 'oauth2' && config?.logoutUrl) {
      return NextResponse.redirect(new URL(String(config.logoutUrl)));
    }
    if (providerConfig?.type === 'saml2' && config?.sloUrl) {
      return NextResponse.redirect(new URL(String(config.sloUrl)));
    }
  } catch (error) {
    logger.warn('Failed to get SSO provider logout URL, redirecting to login', { provider, error });
  }

  // Default: redirect to login page
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
