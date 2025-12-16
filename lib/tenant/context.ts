import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
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

/**
 * Get tenant context from middleware headers (for App Router)
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  try {
    const headersList = await headers()
    const tenantId = headersList.get('x-tenant-id')
    const tenantSlug = headersList.get('x-tenant-slug')
    const tenantName = headersList.get('x-tenant-name')

    if (!tenantId || !tenantSlug || !tenantName) {
      return null
    }

    return {
      id: parseInt(tenantId),
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
    const userId = headersList.get('x-user-id')
    const userRole = headersList.get('x-user-role')
    const tenantId = headersList.get('x-tenant-id')

    if (!userId || !userRole || !tenantId) {
      return null
    }

    return {
      id: parseInt(userId),
      tenant_id: parseInt(tenantId),
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
    const tenantId = request.headers.get('x-tenant-id')
    const tenantSlug = request.headers.get('x-tenant-slug')
    const tenantName = request.headers.get('x-tenant-name')

    if (!tenantId || !tenantSlug || !tenantName) {
      return null
    }

    return {
      id: parseInt(tenantId),
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
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role')
    const tenantId = request.headers.get('x-tenant-id')

    if (!userId || !userRole || !tenantId) {
      return null
    }

    return {
      id: parseInt(userId),
      tenant_id: parseInt(tenantId),
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

  return ['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
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