/**
 * API Route Helpers
 * Utility functions for building secure and consistent API endpoints
 */

import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  handleAPIError,
  validateOrThrow,
} from '../errors/error-handler'
import { applyRateLimit, rateLimitConfigs } from '../rate-limit'

/**
 * Extract and validate user from request headers
 * (Set by middleware after authentication)
 */
export interface AuthenticatedUser {
  id: number
  organization_id: number
  role: string
  email: string
}

export function getUserFromRequest(request: NextRequest): AuthenticatedUser {
  const userId = request.headers.get('x-user-id')
  const organizationId = request.headers.get('x-organization-id')
  const userRole = request.headers.get('x-user-role')

  if (!userId || !organizationId || !userRole) {
    throw new AuthenticationError('User not authenticated')
  }

  return {
    id: parseInt(userId, 10),
    organization_id: parseInt(organizationId, 10),
    role: userRole,
    email: '', // Not available in headers by default
  }
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
  const tenantId = request.headers.get('x-tenant-id')
  const tenantSlug = request.headers.get('x-tenant-slug')
  const tenantName = request.headers.get('x-tenant-name')

  if (!tenantId || !tenantSlug || !tenantName) {
    throw new AppError('Tenant context not found', undefined, 400)
  }

  return {
    id: parseInt(tenantId, 10),
    slug: tenantSlug,
    name: tenantName,
  }
}

/**
 * Check if user has admin role
 */
export function requireAdmin(user: AuthenticatedUser): void {
  const adminRoles = ['super_admin', 'tenant_admin', 'team_manager', 'admin']

  if (!adminRoles.includes(user.role)) {
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
 * Build success response
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
      return Response.json(successResponse(result), { status: 200 })
    } catch (error) {
      return handleAPIError(
        error instanceof Error ? error : new Error('Unknown error'),
        request.nextUrl.pathname
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
    console.error('Rate limit check failed:', error)
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
    const errorDetails = new Error(
      `Rate limit exceeded. Retry after ${retryAfter} seconds. ` +
      `Limit: ${result.total}, Remaining: ${result.remaining}, Reset: ${result.resetTime.toISOString()}`
    )
    throw new AppError(
      config.message || 'Rate limit exceeded',
      errorDetails,
      429
    )
  }
}
