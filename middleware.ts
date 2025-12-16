/**
 * Next.js Middleware for Multi-Tenant ServiceDesk
 *
 * This middleware provides comprehensive request processing including:
 * - Multi-tenant resolution (subdomain, headers, path)
 * - JWT-based authentication and session validation
 * - Role-based access control (RBAC)
 * - CSRF protection for state-changing requests
 * - Security headers (CSP, HSTS, XSS protection)
 * - Performance optimization (caching, compression, ETags)
 * - Request logging and monitoring
 *
 * EXECUTION ORDER:
 * 1. Public route bypass
 * 2. CSRF validation (POST/PUT/PATCH/DELETE)
 * 3. Tenant resolution (headers > subdomain > path > dev default)
 * 4. Authentication check (JWT verification)
 * 5. Authorization check (role-based access)
 * 6. Performance optimizations (caching, compression)
 * 7. Security headers application
 *
 * @module middleware
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as jose from 'jose'
import { getJWTSecret, isProduction } from './lib/config/env'
import { applySecurityHeaders, sanitizeHeaderValue } from './lib/security/headers'
import { validateCSRFToken, setCSRFToken } from './lib/security/csrf'
import { captureAuthError, captureException } from './lib/monitoring/sentry-helpers'
// Use Edge-compatible tenant resolver (no database access)
import { resolveEdgeTenant, toOrganization } from './lib/tenant/edge-resolver'
import type { EdgeTenantInfo } from './lib/tenant/edge-resolver'
// Static import for helmet (Edge Runtime compatible)
import { applyHelmetHeaders } from './lib/security/helmet'

/**
 * JWT secret for token verification
 *
 * SECURITY: This secret must be at least 32 characters and stored securely
 * in environment variables. Never commit secrets to version control.
 */
const JWT_SECRET = new TextEncoder().encode(getJWTSecret())

// ========================
// PERFORMANCE UTILITIES
// ========================

/**
 * Generate ETag for response caching (Edge Runtime compatible)
 *
 * Creates a hash of the response body to enable conditional requests.
 * Uses a simple hash function that works in Edge Runtime without Node.js crypto.
 * Clients can send If-None-Match header to receive 304 Not Modified responses.
 *
 * @param body - Response body (string)
 * @returns ETag header value (quoted hash)
 *
 * @example
 * ```typescript
 * const etag = generateETag('{"data": "value"}');
 * response.headers.set('ETag', etag);
 * ```
 */
function generateETag(body: string): string {
  // Simple FNV-1a hash (Edge Runtime compatible, no Node.js crypto)
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++) {
    hash ^= body.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `"${hash.toString(16)}"`
}

/**
 * Check if request supports Brotli compression
 *
 * Checks the Accept-Encoding header to determine if the client
 * supports Brotli (br) compression for optimized response size.
 *
 * @param request - Next.js request object
 * @returns True if Brotli is supported, false otherwise
 */
function supportsBrotli(request: NextRequest): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  return acceptEncoding.includes('br')
}

/**
 * Get appropriate cache control header based on route pattern
 *
 * Implements different caching strategies for different route types:
 * - Static assets: 1 year immutable cache
 * - API routes: No cache (dynamic data)
 * - Public pages: 5 minutes with stale-while-revalidate
 * - Protected pages: 60 seconds private cache
 *
 * @param pathname - Request pathname
 * @returns Cache-Control header value
 *
 * @example
 * ```typescript
 * const cacheControl = getCacheControl('/_next/static/chunk.js');
 * // Returns: 'public, max-age=31536000, immutable'
 *
 * const apiCache = getCacheControl('/api/tickets');
 * // Returns: 'no-store, must-revalidate'
 * ```
 */
function getCacheControl(pathname: string): string {
  // Static assets - cache for 1 year
  if (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(jpg|jpeg|png|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$/)
  ) {
    return 'public, max-age=31536000, immutable'
  }

  // API routes - no cache by default (routes can override)
  if (pathname.startsWith('/api/')) {
    return 'no-store, must-revalidate'
  }

  // Landing page and public pages - cache for 5 minutes with revalidation
  if (pathname === '/landing' || pathname === '/portal') {
    return 'public, max-age=300, stale-while-revalidate=600'
  }

  // Protected pages - private cache for 60 seconds
  return 'private, max-age=60, must-revalidate'
}

// Routes that don't require tenant resolution
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/status',
  '/api/auth',
  '/api/docs', // API documentation (Swagger UI and OpenAPI spec)
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/landing',
  '/auth',
]

// Routes that are tenant-specific but public (no auth required)
const TENANT_PUBLIC_ROUTES = [
  '/portal',
  '/api/ticket-types',
  '/api/categories',
  '/api/priorities',
  '/api/tickets/create',
]

// Admin routes that require authentication and tenant admin role
const ADMIN_ROUTES = ['/admin', '/api/teams', '/api/users', '/api/tenant']

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/',
  '/dashboard',
  '/tickets',
  '/problems', // Problem Management
  '/known-errors', // Known Error Database
  '/profile',
  '/analytics',
  '/knowledge/admin',
  '/admin', // Admin routes require authentication
  '/api/tickets',
  '/api/problems', // Problem Management API
  '/api/known-errors', // KEDB API
  '/api/analytics',
  '/api/notifications',
]

/**
 * Tenant information interface
 */
interface TenantInfo {
  id: number
  slug: string
  name: string
  subdomain?: string
}

/**
 * User information interface
 */
interface UserInfo {
  id: number
  organization_id: number
  tenant_slug: string
  role: string
  name: string
  email: string
}

/**
 * Main middleware handler
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Create response
  let response = NextResponse.next()

  // CSRF Protection - validate token for state-changing requests
  // This happens early to reject invalid requests before expensive operations
  const needsCSRFValidation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())

  // SECURITY FIX: Remove auth endpoints from CSRF exemption
  // Only SSO callbacks are exempt (they use their own state validation)
  const isPublicCSRFPath = pathname.startsWith('/api/auth/sso/') && pathname.includes('/callback')

  if (needsCSRFValidation && !isPublicCSRFPath) {
    const isValidCSRF = await validateCSRFToken(request)

    if (!isValidCSRF) {
      // Return CSRF error response
      const csrfError = NextResponse.json(
        {
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
          code: 'CSRF_VALIDATION_FAILED'
        },
        { status: 403 }
      )

      // Apply security headers even to error responses
      return applySecurityHeaders(csrfError)
    }
  }

  // Extract cookies for tenant resolution
  const cookies: Record<string, string> = {}
  request.cookies.getAll().forEach(cookie => {
    cookies[cookie.name] = cookie.value
  })

  // Extract tenant information using Edge-compatible resolver (no database access)
  const tenantResolutionResult = resolveEdgeTenant({
    hostname,
    pathname,
    headers: Object.fromEntries(request.headers.entries()),
    cookies,
    allowDevDefault: !pathname.startsWith('/api/'), // Only allow dev default for frontend routes
  })

  // Log tenant resolution for debugging (simplified for Edge Runtime)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Edge Tenant Resolution]', {
      method: tenantResolutionResult.method,
      tenant: tenantResolutionResult.tenant?.slug,
      needsValidation: tenantResolutionResult.needsValidation,
    })
  }

  // Handle tenant not found
  if (!tenantResolutionResult.tenant) {
    // If no tenant found and route requires tenant, redirect to error page
    if (requiresTenant(pathname)) {
      return NextResponse.redirect(new URL('/tenant-not-found', request.url))
    }
    // Apply security headers and return
    return applySecurityHeaders(response)
  }

  const tenant = tenantResolutionResult.tenant

  // Validate tenant data structure
  if (!isValidTenant(tenant)) {
    captureException(new Error('Invalid tenant data structure'), {
      tags: { errorType: 'tenant_validation' },
      extra: {
        hostname,
        pathname,
        tenantId: tenant.id,
        resolutionMethod: tenantResolutionResult.method,
      },
      level: 'warning'
    })
    return NextResponse.redirect(new URL('/tenant-not-found', request.url))
  }

  // Set tenant information in headers (sanitized)
  response.headers.set(
    'x-tenant-id',
    sanitizeHeaderValue(tenant.id.toString())
  )
  response.headers.set(
    'x-tenant-slug',
    sanitizeHeaderValue(tenant.slug)
  )
  response.headers.set(
    'x-tenant-name',
    sanitizeHeaderValue(tenant.name)
  )

  // Handle authentication for protected routes
  if (requiresAuth(pathname)) {
    const authResult = await checkAuthentication(request, tenant)

    if (!authResult.authenticated) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(
        new URL(`/landing?tenant=${tenant.slug}`, request.url)
      )
    }

    // Validate user data
    if (!authResult.user || !isValidUser(authResult.user)) {
      captureAuthError(new Error('Invalid user data detected'), { method: 'jwt' })
      return NextResponse.json(
        { success: false, error: 'Invalid user session' },
        { status: 401 }
      )
    }

    // Check tenant-specific permissions
    if (requiresAdminAccess(pathname)) {
      const hasAdminAccess = checkAdminAccess(authResult.user, tenant)
      if (!hasAdminAccess) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { success: false, error: 'Insufficient permissions' },
            { status: 403 }
          )
        }
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

    // Set user information in headers (sanitized)
    response.headers.set(
      'x-user-id',
      sanitizeHeaderValue(authResult.user.id.toString())
    )
    response.headers.set('x-user-role', sanitizeHeaderValue(authResult.user.role))
    response.headers.set(
      'x-organization-id',
      sanitizeHeaderValue(authResult.user.organization_id.toString())
    )
  }

  // Set tenant context cookie for client-side access
  // Note: Limiting cookie size to prevent abuse
  const tenantContext = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name.substring(0, 100), // Limit name length
  }

  response.cookies.set('tenant-context', JSON.stringify(tenantContext), {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  })

  // ========================
  // PERFORMANCE OPTIMIZATIONS
  // ========================

  // Add cache control headers
  const cacheControl = getCacheControl(pathname)
  response.headers.set('Cache-Control', cacheControl)

  // Add Vary header for compression
  response.headers.set('Vary', 'Accept-Encoding, Cookie')

  // ETag support for conditional requests (only for GET requests)
  if (request.method === 'GET') {
    const ifNoneMatch = request.headers.get('if-none-match')

    // For static routes, we can use pathname as ETag
    if (
      pathname.startsWith('/_next/static/') ||
      pathname.startsWith('/static/')
    ) {
      const etag = generateETag(pathname)
      response.headers.set('ETag', etag)

      // Return 304 if ETag matches
      if (ifNoneMatch === etag) {
        return new NextResponse(null, {
          status: 304,
          headers: response.headers,
        })
      }
    }
  }

  // Add compression hints
  if (supportsBrotli(request)) {
    response.headers.set('X-Compression-Available', 'br')
  } else if (request.headers.get('accept-encoding')?.includes('gzip')) {
    response.headers.set('X-Compression-Available', 'gzip')
  }

  // Performance timing headers (only in development)
  if (!isProduction()) {
    const processingTime = Date.now() - Date.now() // This would need actual start time
    response.headers.set('X-Response-Time', `${processingTime}ms`)
  }

  // Apply basic security headers
  response = applySecurityHeaders(response)

  // Apply comprehensive Helmet-style security headers (static import for Edge Runtime)
  response = applyHelmetHeaders(response)

  // Set CSRF token in response for all requests (token rotation)
  // This ensures clients always have a valid token for the next request
  // Now includes session binding for enhanced security
  response = await setCSRFToken(response, request)

  return response
}

/**
 * Convert Organization to TenantInfo (legacy compatibility)
 * @deprecated Use Organization type directly
 * This function is kept for reference but is no longer used
 */
/*
function convertToTenantInfo(org: Organization): TenantInfo {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    subdomain: org.domain,
  }
}
*/

/**
 * Validate tenant data structure
 */
function isValidTenant(tenant: EdgeTenantInfo | TenantInfo): boolean {
  return (
    tenant &&
    typeof tenant.id === 'number' &&
    tenant.id > 0 &&
    typeof tenant.slug === 'string' &&
    tenant.slug.length > 0 &&
    tenant.slug.length < 100 &&
    /^[a-z0-9-]+$/.test(tenant.slug) &&
    typeof tenant.name === 'string' &&
    tenant.name.length > 0 &&
    tenant.name.length < 200
  )
}

/**
 * Validate user data structure
 */
function isValidUser(user: UserInfo): boolean {
  return (
    user &&
    typeof user.id === 'number' &&
    user.id > 0 &&
    typeof user.organization_id === 'number' &&
    user.organization_id > 0 &&
    typeof user.role === 'string' &&
    user.role.length > 0 &&
    typeof user.email === 'string' &&
    user.email.includes('@')
  )
}

/**
 * Check if route requires tenant resolution
 */
function requiresTenant(pathname: string): boolean {
  return (
    pathname.startsWith('/portal') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/api/') &&
      !PUBLIC_ROUTES.some(route => pathname.startsWith(route)))
  )
}

/**
 * Check if route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  // API routes that require auth
  if (pathname.startsWith('/api/')) {
    return !TENANT_PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  }

  // Frontend routes that require auth
  return PROTECTED_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(route)
  })
}

/**
 * Check if route requires admin access
 */
function requiresAdminAccess(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Verify user authentication via JWT token
 *
 * Performs comprehensive authentication check including:
 * 1. Extract JWT from cookie or Authorization header
 * 2. Verify JWT signature and expiration
 * 3. Validate JWT claims (issuer, audience)
 * 4. Verify tenant matches JWT organization_id (critical security check)
 * 5. Validate payload structure
 *
 * SECURITY CONSIDERATIONS:
 * - Uses HS256 algorithm for HMAC-based signatures
 * - Enforces tenant isolation (JWT must match current tenant)
 * - Validates all required claims to prevent token manipulation
 * - Logs all authentication failures for security monitoring
 *
 * @param request - Next.js request object
 * @param tenant - Current tenant/organization
 * @returns Authentication result with user info if successful
 *
 * @example
 * ```typescript
 * const authResult = await checkAuthentication(request, tenant);
 * if (authResult.authenticated) {
 *   console.log(`User ${authResult.user.name} authenticated`);
 *   console.log(`Role: ${authResult.user.role}`);
 * }
 * ```
 */
async function checkAuthentication(
  request: NextRequest,
  tenant: EdgeTenantInfo | TenantInfo
): Promise<{ authenticated: boolean; user?: UserInfo }> {
  try {
    // Get JWT token from cookie or Authorization header
    const tokenFromCookie = request.cookies.get('auth_token')?.value
    const authHeader = request.headers.get('authorization')
    const tokenFromHeader = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null
    const token = tokenFromCookie || tokenFromHeader

    if (!token) {
      return { authenticated: false }
    }

    // Verify JWT token with proper error handling
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'servicedesk',
      audience: 'servicedesk-users',
    })

    // CRITICAL: Validate token type is 'access' (not 'refresh')
    if (payload.type !== 'access') {
      captureAuthError(new Error('Invalid token type - expected access token'), {
        method: 'jwt',
        tokenType: payload.type as string
      })
      return { authenticated: false }
    }

    // CRITICAL: Validate tenant matches JWT
    if (payload.organization_id !== tenant.id) {
      captureAuthError(new Error('Tenant mismatch in JWT'), {
        username: payload.email as string,
        method: 'jwt'
      })
      return { authenticated: false }
    }

    // Validate payload structure
    if (
      typeof payload.id !== 'number' ||
      typeof payload.organization_id !== 'number' ||
      typeof payload.role !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return { authenticated: false }
    }

    const user: UserInfo = {
      id: payload.id as number,
      organization_id: payload.organization_id as number,
      tenant_slug: payload.tenant_slug as string,
      role: payload.role as string,
      name: (payload.name as string) || '',
      email: payload.email as string,
    }

    return { authenticated: true, user }
  } catch (error) {
    // Log authentication errors securely (don't expose sensitive data)
    captureAuthError(error, { method: 'jwt' })
    return { authenticated: false }
  }
}

/**
 * Check if user has admin access for the tenant
 */
function checkAdminAccess(user: UserInfo, tenant: EdgeTenantInfo | TenantInfo): boolean {
  if (!user || user.organization_id !== tenant.id) {
    return false
  }

  const adminRoles = ['super_admin', 'tenant_admin', 'team_manager', 'admin']
  return adminRoles.includes(user.role)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
