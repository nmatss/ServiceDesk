/**
 * Dynamic Tenant Resolver
 *
 * Resolves tenant information from various sources:
 * 1. Explicit headers (x-tenant-id, x-tenant-slug)
 * 2. Subdomain (e.g., acme.servicedesk.com)
 * 3. Path prefix (e.g., /t/acme)
 * 4. Database query (as fallback)
 *
 * Features:
 * - LRU caching for performance
 * - Multi-strategy resolution
 * - Tenant validation (active, subscription)
 * - Structured logging for auditability
 * - Graceful error handling
 *
 * CRITICAL: NO HARDCODED TENANT DATA
 */

import { getPooledConnection } from '@/lib/db/connection';
import type { Organization } from '@/lib/types/database';
import {
  getTenantFromCache,
  setTenantInCache,
  getCacheStats,
  getCacheHitRatio,
} from './cache';
import { isProduction } from '@/lib/config/env';
import { captureException } from '@/lib/monitoring/sentry-helpers';

/**
 * Tenant resolution result
 */
export interface TenantResolutionResult {
  tenant: Organization | null;
  method: TenantResolutionMethod;
  cached: boolean;
  error?: string;
  /** Convenience alias for tenant?.id - organization ID for multi-tenant queries */
  organizationId?: number;
}

/**
 * Resolution methods in order of precedence
 */
export type TenantResolutionMethod =
  | 'explicit-header'
  | 'subdomain'
  | 'path'
  | 'default-dev'
  | 'not-found';

/**
 * Tenant resolver options
 */
export interface TenantResolverOptions {
  hostname: string;
  pathname: string;
  headers?: Record<string, string>;
  allowDevDefault?: boolean;
}

/**
 * Resolve tenant from explicit headers
 *
 * @param headers - Request headers
 * @returns Tenant or null
 */
async function resolveTenantFromHeaders(
  headers: Record<string, string>
): Promise<TenantResolutionResult | null> {
  const tenantId = headers['x-tenant-id'];
  const tenantSlug = headers['x-tenant-slug'];

  // Only resolve if BOTH headers are present (security measure)
  if (!tenantId || !tenantSlug) {
    return null;
  }

  const id = parseInt(tenantId, 10);
  if (isNaN(id) || id <= 0) {
    return {
      tenant: null,
      method: 'explicit-header',
      cached: false,
      error: 'Invalid tenant ID in header',
    };
  }

  // Check cache first
  const cached = getTenantFromCache(`id:${id}`);
  if (cached) {
    return {
      tenant: cached,
      method: 'explicit-header',
      cached: true,
    };
  }

  // Query database
  const tenant = await getTenantById(id);

  if (tenant) {
    setTenantInCache(tenant);
  }

  return {
    tenant,
    method: 'explicit-header',
    cached: false,
  };
}

/**
 * Resolve tenant from subdomain
 *
 * @param hostname - Request hostname
 * @returns Tenant or null
 */
async function resolveTenantFromSubdomain(
  hostname: string
): Promise<TenantResolutionResult | null> {
  // Extract subdomain (e.g., "acme" from "acme.servicedesk.com")
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\./);

  if (!subdomainMatch || subdomainMatch[1] === 'www') {
    return null;
  }

  const subdomain = subdomainMatch[1];

  if (!subdomain) {
    return null;
  }

  // Check cache
  const cached = getTenantFromCache(`domain:${subdomain}`);
  if (cached) {
    return {
      tenant: cached,
      method: 'subdomain',
      cached: true,
    };
  }

  // Query database by domain
  const tenant = await getTenantByDomain(subdomain);

  if (tenant) {
    setTenantInCache(tenant);
    return {
      tenant,
      method: 'subdomain',
      cached: false,
    };
  }

  return null;
}

/**
 * Resolve tenant from path prefix
 *
 * @param pathname - Request pathname
 * @returns Tenant or null
 */
async function resolveTenantFromPath(
  pathname: string
): Promise<TenantResolutionResult | null> {
  // Extract tenant slug from path (e.g., "/t/acme/dashboard" -> "acme")
  const pathMatch = pathname.match(/^\/t\/([a-z0-9-]+)/);

  if (!pathMatch) {
    return null;
  }

  const slug = pathMatch[1];

  if (!slug) {
    return null;
  }

  // Check cache
  const cached = getTenantFromCache(`slug:${slug}`);
  if (cached) {
    return {
      tenant: cached,
      method: 'path',
      cached: true,
    };
  }

  // Query database by slug
  const tenant = await getTenantBySlug(slug);

  if (tenant) {
    setTenantInCache(tenant);
    return {
      tenant,
      method: 'path',
      cached: false,
    };
  }

  return null;
}

/**
 * Get tenant by ID from database
 *
 * @param id - Tenant ID
 * @returns Tenant or null
 */
async function getTenantById(id: number): Promise<Organization | null> {
  try {
    return await getPooledConnection<Organization | null>((db) => {
      const stmt = db.prepare(`
        SELECT
          id,
          name,
          slug,
          domain,
          settings,
          subscription_plan,
          subscription_status,
          subscription_expires_at,
          max_users,
          max_tickets_per_month,
          features,
          billing_email,
          is_active,
          created_at,
          updated_at
        FROM organizations
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `);

      const row = stmt.get(id) as Organization | undefined;
      return row || null;
    });
  } catch (error) {
    captureException(error, {
      tags: { errorType: 'tenant_query', method: 'id' },
      extra: { tenantId: id },
      level: 'error',
    });
    return null;
  }
}

/**
 * Get tenant by slug from database
 *
 * @param slug - Tenant slug
 * @returns Tenant or null
 */
async function getTenantBySlug(slug: string): Promise<Organization | null> {
  try {
    return await getPooledConnection<Organization | null>((db) => {
      const stmt = db.prepare(`
        SELECT
          id,
          name,
          slug,
          domain,
          settings,
          subscription_plan,
          subscription_status,
          subscription_expires_at,
          max_users,
          max_tickets_per_month,
          features,
          billing_email,
          is_active,
          created_at,
          updated_at
        FROM organizations
        WHERE slug = ?
          AND is_active = 1
        LIMIT 1
      `);

      const row = stmt.get(slug) as Organization | undefined;
      return row || null;
    });
  } catch (error) {
    captureException(error, {
      tags: { errorType: 'tenant_query', method: 'slug' },
      extra: { slug },
      level: 'error',
    });
    return null;
  }
}

/**
 * Get tenant by domain from database
 *
 * @param domain - Tenant domain/subdomain
 * @returns Tenant or null
 */
async function getTenantByDomain(domain: string): Promise<Organization | null> {
  try {
    return await getPooledConnection<Organization | null>((db) => {
      const stmt = db.prepare(`
        SELECT
          id,
          name,
          slug,
          domain,
          settings,
          subscription_plan,
          subscription_status,
          subscription_expires_at,
          max_users,
          max_tickets_per_month,
          features,
          billing_email,
          is_active,
          created_at,
          updated_at
        FROM organizations
        WHERE domain = ?
          AND is_active = 1
        LIMIT 1
      `);

      const row = stmt.get(domain) as Organization | undefined;
      return row || null;
    });
  } catch (error) {
    captureException(error, {
      tags: { errorType: 'tenant_query', method: 'domain' },
      extra: { domain },
      level: 'error',
    });
    return null;
  }
}

/**
 * Validate tenant status and subscription
 *
 * @param tenant - Tenant to validate
 * @returns Validation result
 */
function validateTenant(tenant: Organization): {
  valid: boolean;
  reason?: string;
} {
  // Check if tenant is active
  if (!tenant.is_active) {
    return {
      valid: false,
      reason: 'Tenant is inactive',
    };
  }

  // Check subscription status
  if (
    tenant.subscription_status !== 'active' &&
    tenant.subscription_status !== 'trialing'
  ) {
    return {
      valid: false,
      reason: `Subscription is ${tenant.subscription_status}`,
    };
  }

  // Check subscription expiration (if present)
  if (tenant.subscription_expires_at) {
    const expirationDate = new Date(tenant.subscription_expires_at);
    if (expirationDate < new Date()) {
      return {
        valid: false,
        reason: 'Subscription has expired',
      };
    }
  }

  return { valid: true };
}

/**
 * Main tenant resolver function
 *
 * Resolves tenant using multiple strategies in order of precedence:
 * 1. Explicit headers
 * 2. Subdomain
 * 3. Path prefix
 * 4. Development default (only in dev mode with localhost)
 *
 * @param options - Resolver options
 * @returns Tenant resolution result
 */
export async function resolveTenant(
  options: TenantResolverOptions
): Promise<TenantResolutionResult> {
  const { hostname, pathname, headers = {}, allowDevDefault = false } = options;

  // Strategy 1: Explicit headers (highest priority)
  const headerResult = await resolveTenantFromHeaders(headers);
  if (headerResult?.tenant) {
    const validation = validateTenant(headerResult.tenant);
    if (!validation.valid) {
      return {
        tenant: null,
        method: 'explicit-header',
        cached: false,
        error: validation.reason,
      };
    }
    return headerResult;
  }

  // Strategy 2: Subdomain resolution
  const subdomainResult = await resolveTenantFromSubdomain(hostname);
  if (subdomainResult?.tenant) {
    const validation = validateTenant(subdomainResult.tenant);
    if (!validation.valid) {
      return {
        tenant: null,
        method: 'subdomain',
        cached: false,
        error: validation.reason,
      };
    }
    return subdomainResult;
  }

  // Strategy 3: Path prefix resolution
  const pathResult = await resolveTenantFromPath(pathname);
  if (pathResult?.tenant) {
    const validation = validateTenant(pathResult.tenant);
    if (!validation.valid) {
      return {
        tenant: null,
        method: 'path',
        cached: false,
        error: validation.reason,
      };
    }
    return pathResult;
  }

  // Strategy 4: Development default (ONLY in dev mode with localhost)
  // This is a fallback for development convenience, NOT for production
  if (
    !isProduction() &&
    allowDevDefault &&
    hostname.includes('localhost')
  ) {
    // Query first active tenant from database
    try {
      const defaultTenant = await getPooledConnection<Organization | null>((db) => {
        const stmt = db.prepare(`
          SELECT
            id,
            name,
            slug,
            domain,
            settings,
            subscription_plan,
            subscription_status,
            subscription_expires_at,
            max_users,
            max_tickets_per_month,
            features,
            billing_email,
            is_active,
            created_at,
            updated_at
          FROM organizations
          WHERE is_active = 1
            AND subscription_status IN ('active', 'trialing')
          ORDER BY id ASC
          LIMIT 1
        `);

        const row = stmt.get() as Organization | undefined;
        return row || null;
      });

      if (defaultTenant) {
        console.warn(
          `[DEV MODE] Using default tenant: ${defaultTenant.slug} (id: ${defaultTenant.id})`
        );
        return {
          tenant: defaultTenant,
          method: 'default-dev',
          cached: false,
        };
      }
    } catch (error) {
      captureException(error, {
        tags: { errorType: 'tenant_query', method: 'default-dev' },
        level: 'warning',
      });
    }
  }

  // No tenant found
  return {
    tenant: null,
    method: 'not-found',
    cached: false,
    error: 'No tenant found for this request',
  };
}

/**
 * Get cache statistics (for monitoring)
 */
export function getTenantCacheStats() {
  return {
    ...getCacheStats(),
    hitRatio: getCacheHitRatio(),
  };
}

/**
 * Log tenant resolution for audit trail
 *
 * @param result - Tenant resolution result
 * @param context - Additional context
 */
export function logTenantResolution(
  result: TenantResolutionResult,
  context: {
    hostname: string;
    pathname: string;
    userAgent?: string;
    ip?: string;
  }
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    tenant: result.tenant
      ? {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
        }
      : null,
    resolution: {
      method: result.method,
      cached: result.cached,
      error: result.error,
    },
    request: {
      hostname: context.hostname,
      pathname: context.pathname,
      userAgent: context.userAgent?.substring(0, 200), // Truncate for logs
      ip: context.ip,
    },
    cache: getTenantCacheStats(),
  };

  // In production, send to structured logging system
  // In development, console log for debugging
  if (isProduction()) {
    // TODO: Send to structured logging system (e.g., Datadog, CloudWatch)
    console.log(JSON.stringify(logData));
  } else {
    console.log('[Tenant Resolution]', JSON.stringify(logData, null, 2));
  }
}

/**
 * Helper to create TenantResolverOptions from NextRequest
 * This provides a convenient wrapper for API routes using NextRequest
 *
 * @param request - NextRequest object
 * @param allowDevDefault - Allow default tenant in development
 * @returns TenantResolverOptions
 */
export function createTenantResolverOptions(
  request: {
    nextUrl: { hostname: string; pathname: string };
    headers: { get: (name: string) => string | null }
  },
  allowDevDefault = false
): TenantResolverOptions {
  const headerRecord: Record<string, string> = {};

  // Extract tenant-related headers
  const tenantId = request.headers.get('x-tenant-id');
  const tenantSlug = request.headers.get('x-tenant-slug');

  if (tenantId) headerRecord['x-tenant-id'] = tenantId;
  if (tenantSlug) headerRecord['x-tenant-slug'] = tenantSlug;

  return {
    hostname: request.nextUrl.hostname,
    pathname: request.nextUrl.pathname,
    headers: headerRecord,
    allowDevDefault,
  };
}

/**
 * Convenience function to resolve tenant from NextRequest
 * Combines createTenantResolverOptions and resolveTenant
 * Returns result with organizationId populated for convenience
 *
 * @param request - NextRequest object
 * @param allowDevDefault - Allow default tenant in development
 * @returns TenantResolutionResult with organizationId
 */
export async function resolveTenantFromRequest(
  request: {
    nextUrl: { hostname: string; pathname: string };
    headers: { get: (name: string) => string | null }
  },
  allowDevDefault = false
): Promise<TenantResolutionResult> {
  const options = createTenantResolverOptions(request, allowDevDefault);
  const result = await resolveTenant(options);

  // Populate organizationId convenience field
  return {
    ...result,
    organizationId: result.tenant?.id,
  };
}
