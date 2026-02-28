/**
 * Edge-Compatible Tenant Resolver
 *
 * This resolver works in Edge Runtime (middleware) without database access.
 * It resolves tenants from:
 * 1. Explicit headers (x-tenant-id, x-tenant-slug)
 * 2. Cookies (tenant-context)
 * 3. Development default (for localhost)
 *
 * For database-based tenant resolution, use the full resolver in API routes.
 */

import type { Organization } from '@/lib/types/database';

/**
 * Minimal tenant info for Edge Runtime
 */
export interface EdgeTenantInfo {
  id: number;
  slug: string;
  name: string;
  domain?: string;
}

/**
 * Tenant resolution result for Edge Runtime
 */
export interface EdgeTenantResolutionResult {
  tenant: EdgeTenantInfo | null;
  method: 'header' | 'cookie' | 'default-dev' | 'not-resolved';
  needsValidation: boolean; // True if tenant needs to be validated by API route
  error?: string;
}

/**
 * Edge resolver options
 */
export interface EdgeResolverOptions {
  hostname: string;
  pathname: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  allowDevDefault?: boolean;
}

/**
 * Default development tenant for localhost
 */
const DEV_DEFAULT_TENANT: EdgeTenantInfo = {
  id: 1,
  slug: 'default',
  name: 'Default Organization',
};

/**
 * Check if running in development mode
 */
function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Parse tenant context from cookie
 */
function parseTenantCookie(cookieValue: string): EdgeTenantInfo | null {
  try {
    const parsed = JSON.parse(cookieValue);

    // Validate required fields
    if (
      typeof parsed.id === 'number' &&
      parsed.id > 0 &&
      typeof parsed.slug === 'string' &&
      parsed.slug.length > 0 &&
      typeof parsed.name === 'string'
    ) {
      return {
        id: parsed.id,
        slug: parsed.slug,
        name: parsed.name,
        domain: parsed.domain,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve tenant from headers
 */
function resolveTenantFromHeaders(
  headers: Record<string, string>
): EdgeTenantInfo | null {
  const tenantId = headers['x-tenant-id'];
  const tenantSlug = headers['x-tenant-slug'];
  const tenantName = headers['x-tenant-name'];

  if (!tenantId || !tenantSlug) {
    return null;
  }

  const id = parseInt(tenantId, 10);
  if (isNaN(id) || id <= 0) {
    return null;
  }

  return {
    id,
    slug: tenantSlug,
    name: tenantName || tenantSlug,
  };
}

/**
 * Edge-compatible tenant resolver
 *
 * This resolver does NOT make database calls.
 * It resolves tenant info from headers and cookies only.
 * API routes should validate the tenant against the database.
 */
export function resolveEdgeTenant(
  options: EdgeResolverOptions
): EdgeTenantResolutionResult {
  const { hostname, headers, cookies, allowDevDefault = false } = options;

  // Strategy 1: Explicit headers (highest priority)
  const headerTenant = resolveTenantFromHeaders(headers);
  if (headerTenant) {
    return {
      tenant: headerTenant,
      method: 'header',
      needsValidation: true, // Headers could be spoofed, need API validation
    };
  }

  // Strategy 2: Tenant context cookie (set by previous API calls)
  const tenantCookie = cookies['tenant-context'];
  if (tenantCookie) {
    const cookieTenant = parseTenantCookie(tenantCookie);
    if (cookieTenant) {
      return {
        tenant: cookieTenant,
        method: 'cookie',
        needsValidation: false, // Cookie was set by server, trusted
      };
    }
  }

  // Strategy 3: Development default (ONLY in dev mode with localhost)
  if (
    isDevMode() &&
    allowDevDefault &&
    hostname.includes('localhost')
  ) {
    return {
      tenant: DEV_DEFAULT_TENANT,
      method: 'default-dev',
      needsValidation: true, // Dev default should be validated
    };
  }

  // No tenant resolved
  return {
    tenant: null,
    method: 'not-resolved',
    needsValidation: false,
    error: 'No tenant found - database resolution required',
  };
}

/**
 * Convert EdgeTenantInfo to full Organization type
 * (useful for compatibility with existing code)
 */
export function toOrganization(tenant: EdgeTenantInfo): Partial<Organization> {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    domain: tenant.domain,
    is_active: true,
    subscription_status: 'active',
  };
}

export default resolveEdgeTenant;
