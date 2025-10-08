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
import type { GovBrUserProfile } from '@/lib/integrations/govbr/oauth-client';
import { generateJWT } from '@/lib/auth/sqlite-auth';
import { getUserByEmail, createUser } from '@/lib/db/queries';
import { cookies } from 'next/headers';
import { logger } from '@/lib/monitoring/logger';

/**
 * GET handler - OAuth callback
 * Handles the OAuth redirect from Gov.br
 */
export async function GET(request: NextRequest) {
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
    const cookieStore = cookies();
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
    let user = profile.email ? await getUserByEmail(profile.email) : null;

    if (!user) {
      // Create new user from Gov.br profile
      user = await createUser({
        name: profile.name,
        email: profile.email || `${profile.cpf}@govbr.temp`, // Temporary email if not provided
        password_hash: '', // SSO users don't have passwords
        role: 'user',
        is_active: true,
        metadata: JSON.stringify({
          govbr: {
            sub: profile.sub,
            cpf: profile.cpf,
            cnpj: profile.cnpj,
            trustLevel: trustLevel.level,
            socialName: profile.social_name,
            birthDate: profile.birth_date,
            phone: profile.phone_number,
            phoneVerified: profile.phone_number_verified,
            emailVerified: profile.email_verified,
          },
        }),
      });

      logger.info('Created new user from Gov.br', user.id);
    } else {
      // Update existing user with Gov.br data
      const existingMetadata = user.metadata ? JSON.parse(user.metadata) : {};

      await createUser({
        ...user,
        metadata: JSON.stringify({
          ...existingMetadata,
          govbr: {
            sub: profile.sub,
            cpf: profile.cpf,
            cnpj: profile.cnpj,
            trustLevel: trustLevel.level,
            socialName: profile.social_name,
            birthDate: profile.birth_date,
            phone: profile.phone_number,
            phoneVerified: profile.phone_number_verified,
            emailVerified: profile.email_verified,
            lastSync: new Date().toISOString(),
          },
        }),
      });

      logger.info('Updated existing user with Gov.br data', user.id);
    }

    // Sync Gov.br profile (store tokens, etc.)
    await syncGovBrProfile(profile, tokens);

    // Generate JWT for application authentication
    const jwt = await generateJWT({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Clear temporary cookies
    cookieStore.delete('govbr_state');
    cookieStore.delete('govbr_return_url');

    // Set authentication cookie
    cookieStore.set('auth_token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Store Gov.br tokens for future API calls (optional)
    cookieStore.set('govbr_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
    });

    if (tokens.refresh_token) {
      cookieStore.set('govbr_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    // Redirect to return URL or dashboard
    return NextResponse.redirect(new URL(returnUrl, request.url));
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