/**
 * API Route Helpers
 * Utility functions for building secure and consistent API endpoints
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ErrorType,
  handleAPIError,
  validateOrThrow,
} from '../errors/error-handler'
import { applyRateLimit, rateLimitConfigs } from '../rate-limit'
import { validateJWTSecret } from '../config/env'
import { ADMIN_ROLES } from '../auth/roles'

/**
 * Extract and validate user from request headers
 * (Set by middleware after authentication)
 */
export interface AuthenticatedUser {
  id: number
  organization_id: number
  role: string
  email: string
  tenant_slug?: string
  name?: string
}

function parseHeaderUser(request: NextRequest): AuthenticatedUser | null {
  const userId = request.headers.get('x-user-id')
  const organizationId = request.headers.get('x-organization-id')
  const userRole = request.headers.get('x-user-role')

  if (!userId || !organizationId || !userRole) {
    return null
  }

  const parsedUserId = Number.parseInt(userId, 10)
  const parsedOrganizationId = Number.parseInt(organizationId, 10)

  if (
    Number.isNaN(parsedUserId) ||
    parsedUserId <= 0 ||
    Number.isNaN(parsedOrganizationId) ||
    parsedOrganizationId <= 0
  ) {
    throw new AuthenticationError('Invalid authentication headers')
  }

  return {
    id: parsedUserId,
    organization_id: parsedOrganizationId,
    role: userRole,
    email: request.headers.get('x-user-email') || '',
    tenant_slug: request.headers.get('x-tenant-slug') || undefined,
    name: request.headers.get('x-user-name') || undefined,
  }
}

function getRequestToken(request: NextRequest): string | null {
  const cookieToken = request.cookies?.get('auth_token')?.value
  if (cookieToken) {
    return cookieToken
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

function parseTokenUser(token: string): AuthenticatedUser {
  const payload = jwt.verify(token, validateJWTSecret(), {
    algorithms: ['HS256'],
  }) as JwtPayload

  // Accept legacy tokens without iss/aud, but reject explicit mismatches.
  if (typeof payload.iss === 'string' && payload.iss !== 'servicedesk') {
    throw new AuthenticationError('Invalid authentication token issuer')
  }

  const audienceClaim = payload.aud
  if (typeof audienceClaim === 'string' && audienceClaim !== 'servicedesk-users') {
    throw new AuthenticationError('Invalid authentication token audience')
  }
  if (Array.isArray(audienceClaim) && !audienceClaim.includes('servicedesk-users')) {
    throw new AuthenticationError('Invalid authentication token audience')
  }

  const id = typeof payload.id === 'number' ? payload.id : Number(payload.user_id)
  const organizationId =
    typeof payload.organization_id === 'number'
      ? payload.organization_id
      : Number(payload.tenant_id)

  if (
    !id ||
    Number.isNaN(id) ||
    !organizationId ||
    Number.isNaN(organizationId) ||
    typeof payload.role !== 'string' ||
    typeof payload.email !== 'string'
  ) {
    throw new AuthenticationError('Invalid authentication token payload')
  }

  return {
    id,
    organization_id: organizationId,
    role: payload.role,
    email: payload.email,
    tenant_slug:
      typeof payload.tenant_slug === 'string' ? payload.tenant_slug : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  }
}

export function getUserFromRequest(request: NextRequest): AuthenticatedUser {
  const headerUser = parseHeaderUser(request)
  const token = getRequestToken(request)

  if (!token) {
    if (process.env.NODE_ENV === 'test' && headerUser) {
      return headerUser
    }
    throw new AuthenticationError('User not authenticated')
  }

  const tokenUser = parseTokenUser(token)

  // Security: if both JWT and headers are present, they must match
  if (headerUser) {
    if (
      headerUser.id !== tokenUser.id ||
      headerUser.organization_id !== tokenUser.organization_id ||
      headerUser.role !== tokenUser.role
    ) {
      throw new AuthorizationError('Authentication header mismatch detected')
    }
  }

  return tokenUser
}

/**
 * Extract and validate tenant from request headers
 */
export interface RequestTenant {
  id: number
  slug: string
  name: string
}

export function getTenantFromRequest(request: NextRequest): RequestTenant {
  const token = getRequestToken(request)
  const tenantId = request.headers.get('x-tenant-id')
  const tenantSlug = request.headers.get('x-tenant-slug')
  const tenantName = request.headers.get('x-tenant-name')

  if (token) {
    const user = getUserFromRequest(request)

    if (tenantId) {
      const parsedHeaderTenantId = Number.parseInt(tenantId, 10)
      if (
        Number.isNaN(parsedHeaderTenantId) ||
        parsedHeaderTenantId <= 0 ||
        parsedHeaderTenantId !== user.organization_id
      ) {
        throw new AuthorizationError('Tenant header mismatch detected')
      }
    }

    return {
      id: user.organization_id,
      slug: user.tenant_slug || tenantSlug || `org-${user.organization_id}`,
      name: tenantName || `Organization ${user.organization_id}`,
    }
  }

  if (process.env.NODE_ENV === 'test' && tenantId && tenantSlug && tenantName) {
    const parsedTenantId = Number.parseInt(tenantId, 10)
    if (Number.isNaN(parsedTenantId) || parsedTenantId <= 0) {
      throw new AppError('Tenant context not found', undefined, 400)
    }
    return {
      id: parsedTenantId,
      slug: tenantSlug,
      name: tenantName,
    }
  }

  throw new AppError('Tenant context not found', undefined, 400)
}

/**
 * Check if user has admin role
 */
export function requireAdmin(user: AuthenticatedUser): void {
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new AuthorizationError('Admin access required')
  }
}

/**
 * Check if user has specific role
 */
export function requireRole(user: AuthenticatedUser, allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(`Required role: ${allowedRoles.join(', ')}`)
  }
}

/**
 * Validate that user belongs to the same organization as the resource
 */
export function validateTenantAccess(
  user: AuthenticatedUser,
  resourceOrganizationId: number
): void {
  if (user.organization_id !== resourceOrganizationId) {
    throw new AuthorizationError('Access denied: resource belongs to different organization')
  }
}

/**
 * Parse and validate JSON body
 */
export async function parseJSONBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json()
    return validateOrThrow(schema, body, 'request body')
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError('Invalid JSON in request body')
  }
}

/**
 * Parse and validate query parameters
 */
export function parseQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T {
  const { searchParams } = request.nextUrl
  const params: Record<string, string | number> = {}

  searchParams.forEach((value, key) => {
    // Try to parse as number if it looks like one
    const numValue = Number(value)
    params[key] = !isNaN(numValue) && value !== '' ? numValue : value
  })

  return validateOrThrow(schema, params, 'query parameters')
}

/**
 * Build success response (plain object, for use with apiHandler)
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
  meta?: Record<string, unknown>
}

export function successResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    meta,
  }
}

/**
 * Standardized API success response (returns NextResponse)
 * Use for consistent { success: true, data, meta? } format.
 */
export function apiSuccess<T>(
  data: T,
  meta?: { page?: number; limit?: number; totalPages?: number; total?: number; [key: string]: unknown },
  status: number = 200
): NextResponse {
  return NextResponse.json(
    { success: true, data, ...(meta ? { meta } : {}) },
    { status }
  )
}

/**
 * Standardized API error response (returns NextResponse)
 * Use for consistent { success: false, error, code? } format.
 */
export function apiError(
  message: string,
  status: number = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, ...(code ? { code } : {}) },
    { status }
  )
}

/**
 * API route handler wrapper with error handling
 */
export function apiHandler<T = unknown>(
  handler: (request: NextRequest, context?: { params: Record<string, string> }) => Promise<T>
) {
  return async (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ): Promise<Response> => {
    try {
      const result = await handler(request, context)

      if (result instanceof Response) {
        return result
      }

      return Response.json(successResponse(result), { status: 200 })
    } catch (error) {
      let requestPath = '/api/unknown'

      if (request.nextUrl?.pathname) {
        requestPath = request.nextUrl.pathname
      } else if (request.url) {
        try {
          requestPath = new URL(request.url).pathname
        } catch {
          requestPath = request.url
        }
      }

      return handleAPIError(
        error instanceof Error ? error : new Error('Unknown error'),
        requestPath
      )
    }
  }
}

/**
 * Paginated response helper
 */
export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * CORS headers helper (if needed)
 */
export function addCORSHeaders(response: Response, allowedOrigins: string[]): Response {
  const origin = allowedOrigins[0] ?? '*' // Simplification - in production, check request origin

  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

/**
 * Method guard - ensure only specific HTTP methods are allowed
 */
export function requireMethod(request: NextRequest, allowedMethods: string[]): void {
  if (!allowedMethods.includes(request.method)) {
    throw new AppError(
      `Method ${request.method} not allowed. Allowed: ${allowedMethods.join(', ')}`,
      undefined,
      405
    )
  }
}

/**
 * Extract ID from URL params
 */
export function getIdFromParams(
  params: Record<string, string> | undefined,
  paramName = 'id'
): number {
  if (!params || !params[paramName]) {
    throw new ValidationError(`Missing ${paramName} parameter`)
  }

  const value = params[paramName]

  // Check if it's a valid integer string (no decimals)
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`Invalid ${paramName}: must be a positive integer`)
  }

  const id = parseInt(value, 10)

  if (isNaN(id) || id <= 0) {
    throw new ValidationError(`Invalid ${paramName}: must be a positive integer`)
  }

  return id
}

/**
 * Rate limiting check helper
 * Returns true if rate limit exceeded
 * @param request - Next.js request object
 * @param endpoint - Endpoint identifier for rate limiting
 * @param configType - Type of rate limit configuration to use (defaults to 'api')
 * @returns true if rate limit exceeded, false if within limits
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint: string,
  configType: keyof typeof rateLimitConfigs = 'api'
): Promise<boolean> {
  try {
    const config = rateLimitConfigs[configType]
    const result = await applyRateLimit(request, config, endpoint)
    return !result.allowed
  } catch (error) {
    // Log error but allow request through (fail-open for availability)
    if (typeof window === 'undefined') {
      try {
        const { structuredLogger } = require('../monitoring/structured-logger')
        structuredLogger.error('Rate limit check failed', { error: String(error) })
      } catch {
        // Fallback if logger unavailable
      }
    }
    return false
  }
}

/**
 * Apply rate limiting with automatic response handling
 * Throws AppError with 429 status if rate limit exceeded
 * @param request - Next.js request object
 * @param endpoint - Endpoint identifier for rate limiting
 * @param configType - Type of rate limit configuration to use
 */
export async function enforceRateLimit(
  request: NextRequest,
  endpoint: string,
  configType: keyof typeof rateLimitConfigs = 'api'
): Promise<void> {
  const config = rateLimitConfigs[configType]
  const result = await applyRateLimit(request, config, endpoint)

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime.getTime() - Date.now()) / 1000)
    const errorDetails = `Rate limit exceeded. Retry after ${retryAfter} seconds. ` +
      `Limit: ${result.total}, Remaining: ${result.remaining}, Reset: ${result.resetTime.toISOString()}`

    throw new AppError(
      config.message || 'Rate limit exceeded',
      ErrorType.RATE_LIMIT_ERROR,
      429,
      true,
      errorDetails
    )
  }
}
