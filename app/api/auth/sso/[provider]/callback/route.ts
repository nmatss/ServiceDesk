/**
 * SSO Provider Callback Route
 *
 * Handles the callback from SSO providers after user authentication
 * Supports both OAuth 2.0 and SAML 2.0 protocols
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import ssoManager from '@/lib/auth/sso-manager';
import { sign } from 'jsonwebtoken';
import { validateJWTSecret } from '@/lib/config/env';

const JWT_SECRET = validateJWTSecret();
const COOKIE_NAME = 'servicedesk_token';

/**
 * GET /api/auth/sso/[provider]/callback
 * Handle OAuth 2.0 callback (query parameters)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const searchParams = request.nextUrl.searchParams;

    // Get OAuth parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth error
    if (error) {
      console.error('SSO provider error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Invalid callback parameters', request.url)
      );
    }

    // Verify state parameter (CSRF protection)
    const cookieStore = cookies();
    const savedState = cookieStore.get('sso_state')?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Invalid state parameter', request.url)
      );
    }

    // Exchange code for user info
    const ssoUser = await ssoManager.processOAuthCallback(provider, code, state);

    if (!ssoUser) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Failed to authenticate with SSO provider', request.url)
      );
    }

    // Authenticate or create user
    const user = await ssoManager.authenticateSSOUser(ssoUser);

    if (!user) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Failed to create user account', request.url)
      );
    }

    // Generate JWT token
    const token = sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        ssoProvider: provider,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set authentication cookie
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Get redirect URL
    const redirectUrl = cookieStore.get('sso_redirect')?.value || '/dashboard';

    // Clear SSO cookies
    cookieStore.delete('sso_state');
    cookieStore.delete('sso_redirect');

    // Redirect to application
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('SSO callback error:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=SSO authentication failed', request.url)
    );
  }
}

/**
 * POST /api/auth/sso/[provider]/callback
 * Handle SAML 2.0 callback (POST binding)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const formData = await request.formData();

    // Get SAML parameters
    const samlResponse = formData.get('SAMLResponse') as string;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Invalid SAML response', request.url)
      );
    }

    // Verify relay state if present (CSRF protection)
    if (relayState) {
      const cookieStore = cookies();
      const savedState = cookieStore.get('sso_state')?.value;

      if (savedState && savedState !== relayState) {
        return NextResponse.redirect(
          new URL('/auth/login?error=Invalid relay state', request.url)
        );
      }
    }

    // Process SAML response
    const ssoUser = await ssoManager.processSamlResponse(provider, samlResponse);

    if (!ssoUser) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Failed to process SAML response', request.url)
      );
    }

    // Authenticate or create user
    const user = await ssoManager.authenticateSSOUser(ssoUser);

    if (!user) {
      return NextResponse.redirect(
        new URL('/auth/login?error=Failed to create user account', request.url)
      );
    }

    // Generate JWT token
    const cookieStore = cookies();
    const token = sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        ssoProvider: provider,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set authentication cookie
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Get redirect URL
    const redirectUrl = cookieStore.get('sso_redirect')?.value || '/dashboard';

    // Clear SSO cookies
    cookieStore.delete('sso_state');
    cookieStore.delete('sso_redirect');

    // Redirect to application
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('SAML callback error:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=SAML authentication failed', request.url)
    );
  }
}
