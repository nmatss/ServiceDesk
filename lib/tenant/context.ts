import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { validateJWTSecret } from '@/lib/config/env'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import logger from '../monitoring/structured-logger';

export interface TenantContext {
  id: number
  slug: string
  name: string
}

export interface UserContext {
  id: number
  tenant_id: number
  name?: string
  email?: string
  role: string
}

type DecodedTokenClaims = JwtPayload & {
  id?: number | string
  user_id?: number | string
  organization_id?: number | string
  tenant_id?: number | string
  tenant_slug?: string
  tenant_name?: string
  role?: string
  email?: string
  name?: string
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,100}$/.test(slug)
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

function extractAuthTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null
  }

  const tokenPart = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('auth_token='))

  if (!tokenPart) {
    return null
  }

  return decodeURIComponent(tokenPart.slice('auth_token='.length))
}

function verifyTokenClaims(token: string): DecodedTokenClaims | null {
  try {
    return jwt.verify(token, validateJWTSecret(), { algorithms: ['HS256'] }) as DecodedTokenClaims
  } catch {
    return null
  }
}

function extractTenantFromClaims(claims: DecodedTokenClaims): TenantContext | null {
  const tenantId = parsePositiveInt(claims.organization_id ?? claims.tenant_id)
  if (!tenantId) {
    return null
  }

  const slugFromToken =
    typeof claims.tenant_slug === 'string' && claims.tenant_slug.trim()
      ? claims.tenant_slug.trim().toLowerCase()
      : `org-${tenantId}`

  if (!isValidTenantSlug(slugFromToken)) {
    return null
  }

  return {
    id: tenantId,
    slug: slugFromToken,
    name:
      typeof claims.tenant_name === 'string' && claims.tenant_name.trim()
        ? claims.tenant_name.trim()
        : slugFromToken,
  }
}

function extractUserFromClaims(claims: DecodedTokenClaims): UserContext | null {
  const userId = parsePositiveInt(claims.id ?? claims.user_id)
  const tenantId = parsePositiveInt(claims.organization_id ?? claims.tenant_id)

  if (!userId || !tenantId || typeof claims.role !== 'string' || !claims.role.trim()) {
    return null
  }

  return {
    id: userId,
    tenant_id: tenantId,
    role: claims.role,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
  }
}

function extractTokenFromRequest(request: NextRequest): string | null {
  const tokenFromCookie =
    request.cookies?.get?.('auth_token')?.value ||
    null
  if (tokenFromCookie) {
    return tokenFromCookie
  }

  const tokenFromHeader = extractBearerToken(request.headers.get('authorization'))
  if (tokenFromHeader) {
    return tokenFromHeader
  }

  return extractAuthTokenFromCookieHeader(request.headers.get('cookie'))
}

/**
 * Get tenant context from middleware headers (for App Router)
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  try {
    const headersList = await headers()
    const token =
      extractBearerToken(headersList.get('authorization')) ||
      extractAuthTokenFromCookieHeader(headersList.get('cookie'))

    if (token) {
      const claims = verifyTokenClaims(token)
      if (claims) {
        const tenantFromToken = extractTenantFromClaims(claims)
        if (tenantFromToken) {
          return tenantFromToken
        }
      } else {
        logger.warn('Invalid auth token while extracting tenant context')
      }
    }

    const tenantId = headersList.get('x-tenant-id')
    const tenantSlug = headersList.get('x-tenant-slug')
    const tenantName = headersList.get('x-tenant-name')

    if (!tenantId || !tenantSlug || !tenantName) {
      return null
    }

    const parsedTenantId = parsePositiveInt(tenantId)
    if (!parsedTenantId || !isValidTenantSlug(tenantSlug)) {
      return null
    }

    return {
      id: parsedTenantId,
      slug: tenantSlug,
      name: tenantName
    }
  } catch (error) {
    logger.error('Error getting tenant context', error)
    return null
  }
}

/**
 * Get user context from middleware headers (for App Router)
 */
export async function getUserContext(): Promise<UserContext | null> {
  try {
    const headersList = await headers()
    const token =
      extractBearerToken(headersList.get('authorization')) ||
      extractAuthTokenFromCookieHeader(headersList.get('cookie'))

    if (token) {
      const claims = verifyTokenClaims(token)
      if (claims) {
        const userFromToken = extractUserFromClaims(claims)
        if (userFromToken) {
          return userFromToken
        }
      } else {
        logger.warn('Invalid auth token while extracting user context')
      }
    }

    const userId = headersList.get('x-user-id')
    const userRole = headersList.get('x-user-role')
    const tenantId = headersList.get('x-tenant-id')

    // Header fallback is only allowed in tests.
    if (process.env.NODE_ENV !== 'test') {
      return null
    }

    if (!userId || !userRole || !tenantId) {
      return null
    }

    const parsedUserId = parsePositiveInt(userId)
    const parsedTenantId = parsePositiveInt(tenantId)
    if (!parsedUserId || !parsedTenantId) {
      return null
    }

    return {
      id: parsedUserId,
      tenant_id: parsedTenantId,
      role: userRole
    }
  } catch (error) {
    logger.error('Error getting user context', error)
    return null
  }
}

/**
 * Get tenant context from request headers (for API routes)
 */
export function getTenantContextFromRequest(request: NextRequest): TenantContext | null {
  try {
    const token = extractTokenFromRequest(request)
    if (token) {
      const claims = verifyTokenClaims(token)
      if (claims) {
        const tenantFromToken = extractTenantFromClaims(claims)
        if (tenantFromToken) {
          return tenantFromToken
        }
      } else {
        logger.warn('Invalid auth token while extracting tenant context from request')
        if (process.env.NODE_ENV !== 'test') {
          return null
        }
      }
    }

    const tenantId = request.headers.get('x-tenant-id')
    const tenantSlug = request.headers.get('x-tenant-slug')
    const tenantName = request.headers.get('x-tenant-name')

    if (!tenantId || !tenantSlug || !tenantName) {
      return null
    }

    const parsedTenantId = parsePositiveInt(tenantId)
    if (!parsedTenantId || !isValidTenantSlug(tenantSlug)) {
      return null
    }

    return {
      id: parsedTenantId,
      slug: tenantSlug,
      name: tenantName
    }
  } catch (error) {
    logger.error('Error getting tenant context from request', error)
    return null
  }
}

/**
 * Get user context from request headers (for API routes)
 */
export function getUserContextFromRequest(request: NextRequest): UserContext | null {
  try {
    const token = extractTokenFromRequest(request)
    if (token) {
      const claims = verifyTokenClaims(token)
      if (!claims) {
        logger.warn('Invalid auth token while extracting user context from request')
        if (process.env.NODE_ENV !== 'test') {
          return null
        }
      } else {
        const userFromToken = extractUserFromClaims(claims)
        if (userFromToken) {
          return userFromToken
        }

        if (process.env.NODE_ENV !== 'test') {
          return null
        }
      }
    }

    // Header fallback is only allowed in tests.
    if (process.env.NODE_ENV !== 'test') {
      return null
    }

    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const tenantId = request.headers.get('x-tenant-id')

    if (!userId || !userRole || !tenantId) {
      return null
    }

    const parsedUserId = parsePositiveInt(userId)
    const parsedTenantId = parsePositiveInt(tenantId)
    if (!parsedUserId || !parsedTenantId) {
      return null
    }

    return {
      id: parsedUserId,
      tenant_id: parsedTenantId,
      role: userRole
    }
  } catch (error) {
    logger.error('Error getting user context from request', error)
    return null
  }
}

/**
 * Ensure user has permission to access tenant resources
 */
export function validateTenantAccess(userContext: UserContext | null, tenantContext: TenantContext | null): boolean {
  if (!userContext || !tenantContext) {
    return false
  }

  return userContext.tenant_id === tenantContext.id
}

/**
 * Check if user has admin privileges
 */
export function isAdmin(userContext: UserContext | null): boolean {
  if (!userContext) {
    return false
  }

  return ADMIN_ROLES.includes(userContext.role)
}

/**
 * Check if user has specific role
 */
export function hasRole(userContext: UserContext | null, role: string): boolean {
  if (!userContext) {
    return false
  }

  return userContext.role === role
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userContext: UserContext | null, roles: string[]): boolean {
  if (!userContext) {
    return false
  }

  return roles.includes(userContext.role)
}

/**
 * Get tenant ID for database queries
 * SECURITY: No fallback - throws error if tenant context is missing
 * This ensures tenant isolation is always enforced
 */
export async function getCurrentTenantId(): Promise<number> {
  const tenantContext = await getTenantContext()

  if (!tenantContext) {
    logger.error('SECURITY: Attempted to access tenant ID without tenant context')
    throw new Error('Tenant context required - ensure middleware is properly configured')
  }

  return tenantContext.id
}

/**
 * Get user ID for database queries
 */
export async function getCurrentUserId(): Promise<number | null> {
  const userContext = await getUserContext()
  return userContext?.id || null
}

/**
 * Middleware response helper for unauthorized access
 */
export function createUnauthorizedResponse(message: string = 'Unauthorized') {
  return Response.json(
    { success: false, error: message },
    { status: 401 }
  )
}

/**
 * Middleware response helper for forbidden access
 */
export function createForbiddenResponse(message: string = 'Insufficient permissions') {
  return Response.json(
    { success: false, error: message },
    { status: 403 }
  )
}

/**
 * Middleware response helper for tenant not found
 */
export function createTenantNotFoundResponse(message: string = 'Tenant not found') {
  return Response.json(
    { success: false, error: message },
    { status: 404 }
  )
}
