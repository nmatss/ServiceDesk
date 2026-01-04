/**
 * HTTP Cache Headers Configuration
 * Route-specific cache control headers for optimal performance
 */

export const CacheHeaders = {
  // Static data - cache for 10 minutes
  // Use for: knowledge articles, catalog items, lookup data
  STATIC: {
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
    'CDN-Cache-Control': 'public, s-maxage=600',
  },

  // Semi-static - cache for 5 minutes
  // Use for: analytics, dashboard stats, team data
  SEMI_STATIC: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    'CDN-Cache-Control': 'public, s-maxage=300',
  },

  // Dynamic but cacheable - cache for 1 minute
  // Use for: ticket lists, user lists, search results
  DYNAMIC: {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
    'CDN-Cache-Control': 'public, s-maxage=60',
  },

  // Very short cache - 30 seconds
  // Use for: notifications, real-time data
  SHORT: {
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
    'CDN-Cache-Control': 'public, s-maxage=30',
  },

  // User-specific - private cache for 30 seconds
  // Use for: user profile, user settings, user-specific data
  PRIVATE: {
    'Cache-Control': 'private, max-age=30',
  },

  // Long-term static - cache for 30 minutes
  // Use for: statuses, priorities, categories (rarely change)
  LONG_STATIC: {
    'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=600',
    'CDN-Cache-Control': 'public, s-maxage=1800',
  },

  // No cache - mutations and real-time
  // Use for: POST, PUT, DELETE, real-time updates
  NO_CACHE: {
    'Cache-Control': 'no-store, must-revalidate',
  },
} as const

/**
 * Helper function to apply cache headers to a Response
 */
export function applyCacheHeaders(
  response: Response,
  cacheType: keyof typeof CacheHeaders
): Response {
  const headers = CacheHeaders[cacheType]
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

/**
 * Helper function to create a JSON response with cache headers
 */
export function jsonWithCache<T>(
  data: T,
  cacheType: keyof typeof CacheHeaders,
  options?: ResponseInit
): Response {
  const response = Response.json(data, options)
  return applyCacheHeaders(response, cacheType)
}

/**
 * Cache configuration by route pattern
 */
export const ROUTE_CACHE_CONFIG = {
  // Knowledge Base - 10 min cache
  '/api/knowledge/articles': 'STATIC',
  '/api/knowledge/search': 'STATIC',
  '/api/knowledge/route': 'STATIC',

  // Catalog - 10 min cache
  '/api/catalog': 'STATIC',
  '/api/catalog/requests': 'DYNAMIC',

  // Analytics - 5 min cache
  '/api/analytics': 'SEMI_STATIC',

  // Tickets - 1 min cache (GET only)
  '/api/tickets': 'DYNAMIC',
  '/api/admin/tickets': 'DYNAMIC',
  '/api/portal/tickets': 'DYNAMIC',

  // Users - 5 min cache
  '/api/users': 'SEMI_STATIC',
  '/api/teams': 'SEMI_STATIC',

  // Settings - 5 min cache
  '/api/settings': 'SEMI_STATIC',

  // Static lookups - 30 min cache
  '/api/statuses': 'LONG_STATIC',
  '/api/priorities': 'LONG_STATIC',
  '/api/categories': 'LONG_STATIC',
  '/api/ticket-types': 'LONG_STATIC',

  // Problems - 1 min cache
  '/api/problems': 'DYNAMIC',

  // CMDB - 5 min cache
  '/api/cmdb': 'SEMI_STATIC',

  // SLA - 5 min cache
  '/api/sla': 'SEMI_STATIC',

  // Workflows - 5 min cache
  '/api/workflows/definitions': 'SEMI_STATIC',
  '/api/workflows/executions': 'DYNAMIC',

  // Notifications - 30 sec cache
  '/api/notifications': 'SHORT',
} as const

export type CacheType = keyof typeof CacheHeaders
export type CachedRoute = keyof typeof ROUTE_CACHE_CONFIG
