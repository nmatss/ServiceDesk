/**
 * Dynamic SSO Provider Routes
 *
 * Handles authentication flow for multiple SSO providers:
 * - OAuth 2.0 (Google, Microsoft, GitHub, Okta)
 * - SAML 2.0 (Azure AD, Okta SAML)
 * - OIDC (OpenID Connect)
 *
 * Flow:
 * 1. GET /api/auth/sso/[provider] - Initiate SSO login
 * 2. GET /api/auth/sso/[provider]/callback - Handle provider callback
 * 3. POST /api/auth/sso/[provider]/logout - SSO logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import ssoManager from '@/lib/auth/sso-manager';
import db from '@/lib/db/connection';
import { sign } from 'jsonwebtoken';
import { validateJWTSecret } from '@/lib/config/env';
import { logger } from '@/lib/monitoring/logger';

const JWT_SECRET = validateJWTSecret();
const COOKIE_NAME = 'servicedesk_token';

/**
 * GET /api/auth/sso/[provider]
 * Initiate SSO login flow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;

    // Get provider configuration
    const providerConfig = ssoManager.getProvider(provider);

    if (!providerConfig) {
      return NextResponse.json(
        { error: 'SSO provider not found or not configured' },
        { status: 404 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = generateState();

    // Store state in session
    const cookieStore = cookies();
    cookieStore.set('sso_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    // Store redirect URL if provided
    const searchParams = request.nextUrl.searchParams;
    const redirectUrl = searchParams.get('redirect') || '/dashboard';
    cookieStore.set('sso_redirect', redirectUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });

    // Generate authorization URL based on provider type
    let authUrl: string | null = null;

    if (providerConfig.type === 'saml2') {
      authUrl = ssoManager.generateSamlAuthRequest(provider, state);
    } else if (providerConfig.type === 'oauth2' || providerConfig.type === 'oidc') {
      authUrl = ssoManager.generateOAuthAuthUrl(provider, state);
    }

    if (!authUrl) {
      return NextResponse.json(
        { error: 'Failed to generate authorization URL' },
        { status: 500 }
      );
    }

    // Redirect to provider
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error('SSO initiation error', error);
    return NextResponse.json(
      { error: 'Failed to initiate SSO login' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/sso/[provider]
 * Handle provider callback (alternative to GET callback)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const body = await request.json();

    // Handle SAML POST binding
    if (body.SAMLResponse) {
      return handleSAMLCallback(provider, body.SAMLResponse, body.RelayState);
    }

    // Handle OAuth callback
    if (body.code) {
      return handleOAuthCallback(provider, body.code, body.state);
    }

    return NextResponse.json(
      { error: 'Invalid callback data' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('SSO callback error', error);
    return NextResponse.json(
      { error: 'Failed to process SSO callback' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Handle OAuth callback
 */
async function handleOAuthCallback(
  provider: string,
  code: string,
  state: string
): Promise<NextResponse> {
  try {
    // Verify state parameter
    const cookieStore = cookies();
    const savedState = cookieStore.get('sso_state')?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: 'Invalid state parameter - possible CSRF attack' },
        { status: 400 }
      );
    }

    // Exchange code for user info
    const ssoUser = await ssoManager.processOAuthCallback(provider, code, state);

    if (!ssoUser) {
      return NextResponse.json(
        { error: 'Failed to authenticate with SSO provider' },
        { status: 401 }
      );
    }

    // Authenticate or create user
    const user = await ssoManager.authenticateSSOUser(ssoUser);

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create or authenticate user' },
        { status: 500 }
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
    });

    // Get redirect URL
    const redirectUrl = cookieStore.get('sso_redirect')?.value || '/dashboard';

    // Clear SSO cookies
    cookieStore.delete('sso_state');
    cookieStore.delete('sso_redirect');

    // Return success with redirect
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      redirectUrl,
    });
  } catch (error) {
    logger.error('OAuth callback error', error);
    return NextResponse.json(
      { error: 'OAuth authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Handle SAML callback
 */
async function handleSAMLCallback(
  provider: string,
  samlResponse: string,
  relayState?: string
): Promise<NextResponse> {
  try {
    // Verify relay state if present
    if (relayState) {
      const cookieStore = cookies();
      const savedState = cookieStore.get('sso_state')?.value;

      if (savedState && savedState !== relayState) {
        return NextResponse.json(
          { error: 'Invalid relay state - possible CSRF attack' },
          { status: 400 }
        );
      }
    }

    // Process SAML response
    const ssoUser = await ssoManager.processSamlResponse(provider, samlResponse);

    if (!ssoUser) {
      return NextResponse.json(
        { error: 'Failed to authenticate with SAML provider' },
        { status: 401 }
      );
    }

    // Authenticate or create user
    const user = await ssoManager.authenticateSSOUser(ssoUser);

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create or authenticate user' },
        { status: 500 }
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
    });

    // Get redirect URL
    const redirectUrl = cookieStore.get('sso_redirect')?.value || '/dashboard';

    // Clear SSO cookies
    cookieStore.delete('sso_state');
    cookieStore.delete('sso_redirect');

    // Return success with redirect
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      redirectUrl,
    });
  } catch (error) {
    logger.error('SAML callback error', error);
    return NextResponse.json(
      { error: 'SAML authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Generate secure state parameter
 */
function generateState(): string {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');
}
