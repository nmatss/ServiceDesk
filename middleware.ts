import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as jose from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-for-jwt-development-only')

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
  '/auth'
]

// Routes that are tenant-specific but public (no auth required)
const TENANT_PUBLIC_ROUTES = [
  '/portal',
  '/api/ticket-types',
  '/api/categories',
  '/api/priorities',
  '/api/tickets/create'
]

// Admin routes that require authentication and tenant admin role
const ADMIN_ROUTES = [
  '/admin',
  '/api/teams',
  '/api/users',
  '/api/tenant'
]

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
  '/api/notifications'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Extract tenant information from request
  const tenantInfo = extractTenantInfo(hostname, pathname, request)

  if (!tenantInfo.tenant) {
    // If no tenant found and route requires tenant, redirect to error page
    if (requiresTenant(pathname)) {
      return NextResponse.redirect(new URL('/tenant-not-found', request.url))
    }
    return NextResponse.next()
  }

  // Create response with tenant headers
  const response = NextResponse.next()

  // Set tenant information in headers for API routes to access
  response.headers.set('x-tenant-id', tenantInfo.tenant.id.toString())
  response.headers.set('x-tenant-slug', tenantInfo.tenant.slug)
  response.headers.set('x-tenant-name', tenantInfo.tenant.name)

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
      return NextResponse.redirect(new URL(`/landing?tenant=${tenantInfo.tenant.slug}`, request.url))
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

    // Set user information in headers
    response.headers.set('x-user-id', authResult.user.id.toString())
    response.headers.set('x-user-role', authResult.user.role)
  }

  // Set tenant context cookie for client-side access
  response.cookies.set('tenant-context', JSON.stringify({
    id: tenantInfo.tenant.id,
    slug: tenantInfo.tenant.slug,
    name: tenantInfo.tenant.name
  }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 // 24 hours
  })

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}

/**
 * Extract tenant information from hostname and pathname
 */
function extractTenantInfo(hostname: string, pathname: string, request?: NextRequest): { tenant: any | null, method: string } {
  // Method 0: Explicit headers (for API calls with authentication)
  if (request) {
    const explicitTenantId = request.headers.get('x-tenant-id')
    const explicitTenantSlug = request.headers.get('x-tenant-slug')
    const explicitTenantName = request.headers.get('x-tenant-name')

    if (explicitTenantId && explicitTenantSlug && explicitTenantName) {
      return {
        tenant: {
          id: parseInt(explicitTenantId),
          slug: explicitTenantSlug,
          name: explicitTenantName
        },
        method: 'explicit-headers'
      }
    }
  }

  // Method 1: Subdomain-based tenant resolution
  // Example: demo.servicedesk.com -> tenant slug: 'demo'
  const subdomainMatch = hostname.match(/^([^.]+)\./)
  if (subdomainMatch && subdomainMatch[1] !== 'www') {
    const subdomain = subdomainMatch[1]
    // In a real implementation, you would query the database
    // For now, return default tenant for demo subdomain
    if (subdomain === 'demo' || subdomain === 'localhost') {
      return {
        tenant: {
          id: 1,
          slug: 'empresa-demo',
          name: 'Empresa Demo',
          subdomain: subdomain
        },
        method: 'subdomain'
      }
    }
  }

  // Method 2: Path-based tenant resolution (fallback)
  // Example: /t/demo/portal -> tenant slug: 'demo'
  const pathMatch = pathname.match(/^\/t\/([^\/]+)/)
  if (pathMatch) {
    const slug = pathMatch[1]
    if (slug === 'empresa-demo') {
      return {
        tenant: {
          id: 1,
          slug: 'empresa-demo',
          name: 'Empresa Demo'
        },
        method: 'path'
      }
    }
  }

  // Method 3: Default tenant for development (only for frontend routes)
  if (process.env.NODE_ENV === 'development' && hostname.includes('localhost') && !pathname.startsWith('/api/')) {
    return {
      tenant: {
        id: 1,
        slug: 'empresa-demo',
        name: 'Empresa Demo'
      },
      method: 'default-dev'
    }
  }

  return { tenant: null, method: 'none' }
}

/**
 * Check if route requires tenant resolution
 */
function requiresTenant(pathname: string): boolean {
  return (
    pathname.startsWith('/portal') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/api/') && !PUBLIC_ROUTES.some(route => pathname.startsWith(route)))
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
async function checkAuthentication(request: NextRequest, tenant: any): Promise<{ authenticated: boolean, user?: any }> {
  try {
    // Get JWT token from cookie
    const tokenFromCookie = request.cookies.get('auth_token')?.value
    const tokenFromHeader = request.headers.get('authorization')?.replace('Bearer ', '')
    const token = tokenFromCookie || tokenFromHeader

    if (!token) {
      return { authenticated: false }
    }

    // Verify JWT token
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)

    // Verify token belongs to the current tenant
    if (payload.tenant_id !== tenant.id) {
      return { authenticated: false }
    }

    const user = {
      id: payload.user_id,
      tenant_id: payload.tenant_id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    }

    return { authenticated: true, user }
  } catch (error) {
    console.error('Authentication error:', error)
    return { authenticated: false }
  }
}

/**
 * Check if user has admin access for the tenant
 */
function checkAdminAccess(user: any, tenant: any): boolean {
  if (!user || user.tenant_id !== tenant.id) {
    return false
  }

  return ['super_admin', 'tenant_admin', 'team_manager'].includes(user.role)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - exceto auth que são tratadas separadamente)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}