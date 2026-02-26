/**
 * Gov.br OAuth 2.0 Callback Handler
 * Processes OAuth callback, creates/updates user, and generates JWT
 *
 * Features:
 * - OAuth code exchange
 * - User profile sync
 * - CPF/CNPJ validation
 * - Trust level verification
 * - JWT token generation
 * - Automatic user creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGovBrClient, syncGovBrProfile } from '@/lib/integrations/govbr/oauth-client';
import { getUserByEmail, createUser } from '@/lib/auth/auth-service';
import { cookies } from 'next/headers';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET handler - OAuth callback
 * Handles the OAuth redirect from Gov.br
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || error;
      logger.error('Gov.br OAuth error', errorDescription);

      return NextResponse.redirect(
        new URL(`/auth/login?error=govbr_auth_failed&message=${encodeURIComponent(errorDescription)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/auth/login?error=invalid_callback', request.url)
      );
    }

    // Retrieve state from cookies for CSRF protection
    const cookieStore = await cookies();
    const savedState = cookieStore.get('govbr_state')?.value;
    const returnUrl = cookieStore.get('govbr_return_url')?.value || '/dashboard';

    // Verify state (CSRF protection)
    if (!savedState || state !== savedState) {
      logger.error('Gov.br state mismatch - possible CSRF attack');
      return NextResponse.redirect(
        new URL('/auth/login?error=csrf_mismatch', request.url)
      );
    }

    // Initialize Gov.br client
    const govbrClient = getGovBrClient();

    // Exchange authorization code for tokens
    const tokenResult = await govbrClient.exchangeCodeForTokens(code);

    if (!tokenResult.success || !tokenResult.tokens) {
      logger.error('Failed to exchange code for tokens', tokenResult.error);
      return NextResponse.redirect(
        new URL('/auth/login?error=token_exchange_failed', request.url)
      );
    }

    const tokens = tokenResult.tokens;

    // Get user profile from Gov.br
    const profileResult = await govbrClient.getUserProfile(tokens.access_token);

    if (!profileResult.success || !profileResult.profile) {
      logger.error('Failed to get user profile', profileResult.error);
      return NextResponse.redirect(
        new URL('/auth/login?error=profile_fetch_failed', request.url)
      );
    }

    const profile = profileResult.profile;

    // Validate CPF if present
    if (profile.cpf && !govbrClient.validateCPF(profile.cpf)) {
      logger.error('Invalid CPF from Gov.br', profile.cpf);
      return NextResponse.redirect(
        new URL('/auth/login?error=invalid_cpf', request.url)
      );
    }

    // Determine trust level
    const trustLevel = govbrClient.getTrustLevel(profile.amr);

    logger.info('Gov.br authentication successful', {
      name: profile.name,
      email: profile.email,
      cpf: profile.cpf ? govbrClient.formatCPF(profile.cpf) : undefined,
      trustLevel: trustLevel.level,
    });

    // Find or create user
    let user = profile.email ? await getUserByEmail(profile.email) : undefined;

    if (!user) {
      // Create new user from Gov.br profile
      user = await createUser({
        name: profile.name,
        email: profile.email || `${profile.cpf}@govbr.temp`, // Temporary email if not provided
        password: '', // SSO users don't have passwords
        role: 'user',
      });

      logger.info('Created new user from Gov.br', user?.id);
    } else {
      logger.info('Updated existing user with Gov.br data', user.id);
    }

    // Ensure user exists
    if (!user) {
      logger.error('Failed to create or retrieve user');
      return NextResponse.redirect(
        new URL('/auth/login?error=user_creation_failed', request.url)
      );
    }

    // Sync Gov.br profile (store tokens, etc.)
    await syncGovBrProfile(profile, tokens);

    const {
      generateAccessToken,
      generateRefreshToken,
      setAuthCookies,
      generateDeviceFingerprint,
      getOrCreateDeviceId,
    } = await import('@/lib/auth/token-manager');

    const deviceFingerprint = generateDeviceFingerprint(request);
    const deviceId = getOrCreateDeviceId(request);

    const tokenPayload = {
      user_id: user.id,
      tenant_id: user.organization_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_slug: `org-${user.organization_id}`,
      device_fingerprint: deviceFingerprint,
    };

    const accessToken = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload, deviceFingerprint);

    // Redirect to return URL or dashboard
    const response = NextResponse.redirect(new URL(returnUrl, request.url));

    // Clear temporary cookies
    response.cookies.delete('govbr_state');
    response.cookies.delete('govbr_return_url');

    // Set authentication cookies
    setAuthCookies(response, accessToken, refreshToken, deviceId);

    response.cookies.set(
      'tenant-context',
      JSON.stringify({
        id: user.organization_id,
        slug: `org-${user.organization_id}`,
        name: `org-${user.organization_id}`,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      }
    );

    // Store Gov.br tokens for future API calls (optional)
    response.cookies.set('govbr_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
    });

    if (tokens.refresh_token) {
      response.cookies.set('govbr_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return response;
  } catch (error) {
    logger.error('Error processing Gov.br callback', error);

    return NextResponse.redirect(
      new URL(
        `/auth/login?error=govbr_callback_failed&message=${encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )}`,
        request.url
      )
    );
  }
}
