/**
 * Tenant Cache System
 *
 * LRU cache implementation for tenant data to avoid repeated database queries.
 * This cache is critical for performance in multi-tenant environments.
 *
 * Features:
 * - LRU eviction policy (least recently used)
 * - TTL-based expiration (15 minutes default)
 * - Thread-safe operations
 * - Cache statistics tracking
 * - Configurable size and TTL
 */

import { LRUCache } from 'lru-cache';
import type { Organization } from '@/lib/types/database';

/**
 * Tenant cache entry with metadata
 */
interface TenantCacheEntry {
  tenant: Organization;
  cachedAt: number;
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  max: 500, // Maximum number of tenants to cache
  ttl: 1000 * 60 * 15, // 15 minutes TTL
  updateAgeOnGet: true, // LRU behavior
  allowStale: false, // Don't return stale entries
} as const;

/**
 * LRU Cache instance for tenant data
 */
const tenantCache = new LRUCache<string, TenantCacheEntry>(CACHE_CONFIG);

/**
 * Statistics tracking
 */
const stats: CacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  size: 0,
  maxSize: CACHE_CONFIG.max,
};

/**
 * Get tenant from cache
 *
 * @param key - Cache key (tenant ID, slug, or subdomain)
 * @returns Tenant data or null if not cached or expired
 */
export function getTenantFromCache(key: string): Organization | null {
  const entry = tenantCache.get(key);

  if (!entry) {
    stats.misses++;
    return null;
  }

  // Validate cache entry is not corrupted
  if (!entry.tenant || !entry.cachedAt) {
    tenantCache.delete(key);
    stats.misses++;
    return null;
  }

  stats.hits++;
  return entry.tenant;
}

/**
 * Set tenant in cache with multiple keys
 *
 * @param tenant - Tenant data to cache
 */
export function setTenantInCache(tenant: Organization): void {
  if (!tenant || !tenant.id || !tenant.slug) {
    throw new Error('Invalid tenant data for caching');
  }

  const entry: TenantCacheEntry = {
    tenant,
    cachedAt: Date.now(),
  };

  // Cache by ID (primary key)
  tenantCache.set(`id:${tenant.id}`, entry);

  // Cache by slug (secondary key)
  tenantCache.set(`slug:${tenant.slug}`, entry);

  // Cache by domain if available (tertiary key)
  if (tenant.domain) {
    tenantCache.set(`domain:${tenant.domain}`, entry);
  }

  stats.size = tenantCache.size;
}

/**
 * Invalidate tenant from cache (all keys)
 *
 * @param tenant - Tenant to invalidate
 */
export function invalidateTenant(tenant: Pick<Organization, 'id' | 'slug' | 'domain'>): void {
  tenantCache.delete(`id:${tenant.id}`);
  tenantCache.delete(`slug:${tenant.slug}`);

  if (tenant.domain) {
    tenantCache.delete(`domain:${tenant.domain}`);
  }

  stats.size = tenantCache.size;
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  tenantCache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.evictions = 0;
  stats.size = 0;
}

/**
 * Get cache statistics
 *
 * @returns Current cache statistics
 */
export function getCacheStats(): CacheStats {
  return {
    ...stats,
    size: tenantCache.size,
  };
}

/**
 * Get cache hit ratio
 *
 * @returns Hit ratio as percentage (0-100)
 */
export function getCacheHitRatio(): number {
  const total = stats.hits + stats.misses;
  if (total === 0) return 0;
  return (stats.hits / total) * 100;
}

/**
 * Warmup cache with frequently accessed tenants
 * This can be called during application startup
 *
 * @param tenants - Array of tenants to preload
 */
export function warmupCache(tenants: Organization[]): void {
  tenants.forEach(tenant => {
    try {
      setTenantInCache(tenant);
    } catch (error) {
      console.error(`Failed to warmup cache for tenant ${tenant.slug}:`, error);
    }
  });
}

/**
 * Export cache instance for advanced usage
 */
export { tenantCache };
