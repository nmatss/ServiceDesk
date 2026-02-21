import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { validateJWTSecret } from '@/lib/config/env';
import { captureAuthError } from '@/lib/monitoring/sentry-helpers';

export interface TenantContext {
  id: number;
  slug: string;
  name: string;
}

export interface UserContext {
  user_id: number;
  email: string;
  name: string;
  role: string;
  organization_id: number;
  tenant_slug: string;
}

function extractAuthToken(request: NextRequest): string | null {
  const tokenFromCookie = request.cookies.get('auth_token')?.value;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookieToken = cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('auth_token='))
      ?.split('=')
      .slice(1)
      .join('=');

    if (cookieToken) {
      return cookieToken;
    }
  }

  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;
}

/**
 * Extrai contexto de tenant do JWT token
 *
 * SECURITY: This function extracts tenant information from the JWT token,
 * ensuring that tenant_id cannot be injected by the client.
 *
 * @param request - NextRequest object
 * @returns TenantContext if valid token exists, null otherwise
 */
export async function getTenantContextFromRequest(
  request: NextRequest
): Promise<TenantContext | null> {
  try {
    const token = extractAuthToken(request);

    if (!token) {
      return null;
    }

    const secret = new TextEncoder().encode(validateJWTSecret());
    const { payload } = await jwtVerify(token, secret);

    if (!payload.organization_id || !payload.tenant_slug) {
      return null;
    }

    return {
      id: payload.organization_id as number,
      slug: payload.tenant_slug as string,
      name: (payload.tenant_name as string) || ''
    };
  } catch (error) {
    captureAuthError(error, { method: 'getTenantContextFromRequest' });
    return null;
  }
}

/**
 * Extrai contexto completo do usuário do JWT
 *
 * SECURITY: This function extracts complete user context from the JWT token,
 * including the tenant/organization ID. This ensures proper tenant isolation
 * and prevents tenant_id injection attacks.
 *
 * @param request - NextRequest object
 * @returns UserContext if valid token exists, null otherwise
 */
export async function getUserContextFromRequest(
  request: NextRequest
): Promise<UserContext | null> {
  try {
    const token = extractAuthToken(request);

    if (!token) {
      return null;
    }

    const secret = new TextEncoder().encode(validateJWTSecret());
    const { payload } = await jwtVerify(token, secret);

    // Validate required fields
    if (!payload.id || !payload.email || !payload.role || !payload.organization_id) {
      return null;
    }

    return {
      user_id: payload.id as number,
      email: payload.email as string,
      name: (payload.name as string) || '',
      role: payload.role as string,
      organization_id: payload.organization_id as number,
      tenant_slug: (payload.tenant_slug as string) || ''
    };
  } catch (error) {
    captureAuthError(error, { method: 'getUserContextFromRequest' });
    return null;
  }
}

/**
 * Validates that a resource belongs to the user's tenant
 *
 * SECURITY: Use this function to validate that any resource being accessed
 * belongs to the authenticated user's tenant.
 *
 * @param userContext - User context from getUserContextFromRequest
 * @param resourceTenantId - The tenant_id/organization_id of the resource being accessed
 * @returns true if resource belongs to user's tenant, false otherwise
 */
export function validateTenantAccess(
  userContext: UserContext | null,
  resourceTenantId: number
): boolean {
  if (!userContext) {
    return false;
  }

  return userContext.organization_id === resourceTenantId;
}
