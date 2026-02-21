/**
 * SSO Providers List Route
 *
 * Returns list of available and configured SSO providers
 */

import { NextRequest, NextResponse } from 'next/server';
import ssoManager from '@/lib/auth/sso-manager';
import { logger } from '@/lib/monitoring/logger';
import { verifyToken } from '@/lib/auth/auth-service';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/auth/sso/providers
 * Get list of available SSO providers
 */
export async function GET(_request: NextRequest) {
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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authentication and authorization check - only admins can configure SSO
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check for admin role
    if (user.role !== 'admin') {
      logger.warn('Unauthorized SSO configuration attempt', {
        userId: user.id,
        email: user.email,
        role: user.role
      });
      return NextResponse.json(
        { error: 'Forbidden. Admin access required to configure SSO providers.' },
        { status: 403 }
      );
    }

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
      // Log successful SSO configuration for audit trail
      logger.info('SSO provider configured', {
        providerId: name,
        providerType: type,
        configuredBy: user.id,
        email: user.email,
        organizationId: user.organization_id
      });

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
