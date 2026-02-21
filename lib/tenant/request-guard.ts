import { NextRequest, NextResponse } from 'next/server';
import {
  getTenantContextFromRequest,
  getUserContextFromRequest,
  type TenantContext,
  type UserContext,
} from '@/lib/tenant/context';
import logger from '@/lib/monitoring/structured-logger';

export interface TenantUserRequestContext {
  tenant: TenantContext;
  user: UserContext;
}

/**
 * Flattened auth context for convenient use in API routes.
 * Matches the spec: { userId, organizationId, role, email }
 */
export interface AuthGuardContext {
  userId: number;
  organizationId: number;
  role: string;
  email: string;
  name?: string;
  tenantSlug: string;
}

export interface TenantGuardOptions {
  requireRoles?: string[];
}

type GuardSuccess = { context: TenantUserRequestContext; auth: AuthGuardContext; response?: undefined };
type GuardFailure = { context?: undefined; auth?: undefined; response: NextResponse };
type GuardResult = GuardSuccess | GuardFailure;

/**
 * Unified auth guard for API routes.
 *
 * Extracts and verifies the JWT from the request (cookie or Authorization header),
 * validates tenant isolation, and optionally checks role membership.
 *
 * Returns either `{ context, auth }` on success or `{ response }` on failure.
 * - `context` preserves the existing `{ tenant, user }` shape for backward compat.
 * - `auth` provides a flat `{ userId, organizationId, role, email }` for convenience.
 *
 * SECURITY: Never falls back to a default organization_id.
 */
export function requireTenantUserContext(
  request: NextRequest,
  options: TenantGuardOptions = {}
): GuardResult {
  const userContext = getUserContextFromRequest(request);
  if (!userContext) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const tenantContext = getTenantContextFromRequest(request);
  if (!tenantContext) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Tenant context not found' },
        { status: 401 }
      ),
    };
  }

  if (tenantContext.id !== userContext.tenant_id) {
    logger.warn('Tenant/user context mismatch detected', {
      tenantIdFromContext: tenantContext.id,
      tenantIdFromUser: userContext.tenant_id,
      userId: userContext.id,
      role: userContext.role,
      path: request.nextUrl.pathname,
    });

    return {
      response: NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      ),
    };
  }

  if (options.requireRoles && !options.requireRoles.includes(userContext.role)) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return {
    context: {
      tenant: tenantContext,
      user: userContext,
    },
    auth: {
      userId: userContext.id,
      organizationId: tenantContext.id,
      role: userContext.role,
      email: userContext.email ?? '',
      name: userContext.name,
      tenantSlug: tenantContext.slug,
    },
  };
}
