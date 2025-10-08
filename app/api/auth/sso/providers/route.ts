/**
 * SSO Providers List Route
 *
 * Returns list of available and configured SSO providers
 */

import { NextRequest, NextResponse } from 'next/server';
import ssoManager from '@/lib/auth/sso-manager';
import { logger } from '@/lib/monitoring/logger';

/**
 * GET /api/auth/sso/providers
 * Get list of available SSO providers
 */
export async function GET(request: NextRequest) {
  try {
    // Get all active providers
    const providers = ssoManager.getActiveProviders();

    // Map to public format (don't expose secrets)
    const publicProviders = providers.map(p => ({
      id: p.id,
      name: p.name,
      displayName: p.display_name,
      type: p.type,
      isActive: p.is_active,
      loginUrl: `/api/auth/sso/${p.name}`,
    }));

    return NextResponse.json({
      success: true,
      providers: publicProviders,
    });
  } catch (error) {
    logger.error('Get SSO providers error', error);
    return NextResponse.json(
      { error: 'Failed to get SSO providers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/sso/providers
 * Admin endpoint to configure SSO provider
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication and authorization check
    // Only admins should be able to configure SSO providers

    const body = await request.json();
    const { name, displayName, type, configuration } = body;

    // Validate required fields
    if (!name || !displayName || !type || !configuration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['saml2', 'oauth2', 'oidc', 'ldap'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid provider type' },
        { status: 400 }
      );
    }

    // Save provider configuration
    const success = ssoManager.saveProvider({
      name,
      display_name: displayName,
      type,
      is_active: true,
      configuration,
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'SSO provider configured successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to save provider configuration' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Configure SSO provider error', error);
    return NextResponse.json(
      { error: 'Failed to configure SSO provider' },
      { status: 500 }
    );
  }
}
