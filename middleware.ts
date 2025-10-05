import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as jose from 'jose'
import { getJWTSecret, isProduction } from './lib/config/env'
import { applySecurityHeaders, sanitizeHeaderValue } from './lib/security/headers'

// Get JWT secret securely
const JWT_SECRET = new TextEncoder().encode(getJWTSecret())

// Routes that don't require tenant resolution
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/status',
  '/api/auth',
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
  '/profile',
  '/analytics',
  '/knowledge/admin',
  '/api/tickets',
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

  // Extract tenant information from request
  const tenantInfo = extractTenantInfo(hostname, pathname, request)

  if (!tenantInfo.tenant) {
    // If no tenant found and route requires tenant, redirect to error page
    if (requiresTenant(pathname)) {
      return NextResponse.redirect(new URL('/tenant-not-found', request.url))
    }
    // Apply security headers and return
    return applySecurityHeaders(response)
  }

  // Validate tenant data before setting headers
  if (!isValidTenant(tenantInfo.tenant)) {
    console.error('Invalid tenant data detected', { hostname, pathname })
    return NextResponse.redirect(new URL('/tenant-not-found', request.url))
  }

  // Set tenant information in headers (sanitized)
  response.headers.set(
    'x-tenant-id',
    sanitizeHeaderValue(tenantInfo.tenant.id.toString())
  )
  response.headers.set(
    'x-tenant-slug',
    sanitizeHeaderValue(tenantInfo.tenant.slug)
  )
  response.headers.set(
    'x-tenant-name',
    sanitizeHeaderValue(tenantInfo.tenant.name)
  )

  // Handle authentication for protected routes
  if (requiresAuth(pathname)) {
    const authResult = await checkAuthentication(request, tenantInfo.tenant)

    if (!authResult.authenticated) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(
        new URL(`/landing?tenant=${tenantInfo.tenant.slug}`, request.url)
      )
    }

    // Validate user data
    if (!authResult.user || !isValidUser(authResult.user)) {
      console.error('Invalid user data detected')
      return NextResponse.json(
        { success: false, error: 'Invalid user session' },
        { status: 401 }
      )
    }

    // Check tenant-specific permissions
    if (requiresAdminAccess(pathname)) {
      const hasAdminAccess = checkAdminAccess(authResult.user, tenantInfo.tenant)
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
    id: tenantInfo.tenant.id,
    slug: tenantInfo.tenant.slug,
    name: tenantInfo.tenant.name.substring(0, 100), // Limit name length
  }

  response.cookies.set('tenant-context', JSON.stringify(tenantContext), {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  })

  // Apply security headers
  response = applySecurityHeaders(response)

  return response
}

/**
 * Extract tenant information from hostname and pathname
 */
function extractTenantInfo(
  hostname: string,
  pathname: string,
  request: NextRequest
): { tenant: TenantInfo | null; method: string } {
  // Method 0: Explicit headers (for API calls with authentication)
  const explicitTenantId = request.headers.get('x-tenant-id')
  const explicitTenantSlug = request.headers.get('x-tenant-slug')
  const explicitTenantName = request.headers.get('x-tenant-name')

  if (explicitTenantId && explicitTenantSlug && explicitTenantName) {
    const id = parseInt(explicitTenantId, 10)
    if (!isNaN(id) && id > 0) {
      return {
        tenant: {
          id,
          slug: sanitizeHeaderValue(explicitTenantSlug),
          name: sanitizeHeaderValue(explicitTenantName),
        },
        method: 'explicit-headers',
      }
    }
  }

  // Method 1: Subdomain-based tenant resolution
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\./)
  if (subdomainMatch && subdomainMatch[1] !== 'www') {
    const subdomain = subdomainMatch[1]
    // TODO: Query database for tenant by subdomain
    // For now, return default tenant for demo/localhost
    if (subdomain === 'demo' || subdomain === 'localhost') {
      return {
        tenant: {
          id: 1,
          slug: 'empresa-demo',
          name: 'Empresa Demo',
          subdomain: subdomain,
        },
        method: 'subdomain',
      }
    }
  }

  // Method 2: Path-based tenant resolution (fallback)
  const pathMatch = pathname.match(/^\/t\/([a-z0-9-]+)/)
  if (pathMatch) {
    const slug = pathMatch[1]
    // TODO: Query database for tenant by slug
    if (slug === 'empresa-demo') {
      return {
        tenant: {
          id: 1,
          slug: 'empresa-demo',
          name: 'Empresa Demo',
        },
        method: 'path',
      }
    }
  }

  // Method 3: Default tenant for development (only for frontend routes)
  if (!isProduction() && hostname.includes('localhost') && !pathname.startsWith('/api/')) {
    return {
      tenant: {
        id: 1,
        slug: 'empresa-demo',
        name: 'Empresa Demo',
      },
      method: 'default-dev',
    }
  }

  return { tenant: null, method: 'none' }
}

/**
 * Validate tenant data structure
 */
function isValidTenant(tenant: TenantInfo): boolean {
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
 * Check user authentication
 */
async function checkAuthentication(
  request: NextRequest,
  tenant: TenantInfo
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

    // CRITICAL: Validate tenant matches JWT
    if (payload.organization_id !== tenant.id) {
      // Use structured logging instead of console.error in production
      if (!isProduction()) {
        console.warn(
          `Tenant mismatch: JWT has ${payload.organization_id}, expected ${tenant.id}`
        )
      }
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
    if (!isProduction() && error instanceof Error) {
      console.error('Authentication error:', error.message)
    }
    return { authenticated: false }
  }
}

/**
 * Check if user has admin access for the tenant
 */
function checkAdminAccess(user: UserInfo, tenant: TenantInfo): boolean {
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
