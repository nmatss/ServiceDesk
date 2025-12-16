/**
 * Safe Database Query Wrappers
 * Adds validation, error handling, and logging to database operations
 */

import type { Database, RunResult } from 'better-sqlite3'
import logger from '../monitoring/structured-logger';

/**
 * Query execution result
 */
export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
  rowsAffected?: number
}

/**
 * Transaction function type
 */
export type TransactionFn<T> = (db: Database) => T

/**
 * Safe query wrapper with error handling
 */
export function safeQuery<T>(
  operation: () => T,
  context?: string
): QueryResult<T> {
  try {
    const data = operation()
    return {
      success: true,
      data,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error'

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      logger.error(`Database error${context ? ` in ${context}` : ''}:`, errorMessage)
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Safe transaction wrapper
 * Automatically rolls back on error
 */
export function safeTransaction<T>(
  db: Database,
  fn: TransactionFn<T>,
  context?: string
): QueryResult<T> {
  try {
    const transaction = db.transaction(fn)
    const data = transaction(db)

    return {
      success: true,
      data,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown transaction error'

    if (process.env.NODE_ENV === 'development') {
      logger.error(
        `Transaction error${context ? ` in ${context}` : ''}:`,
        errorMessage
      )
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Validate ID parameter
 */
export function validateId(id: unknown, fieldName = 'id'): QueryResult<number> {
  if (typeof id !== 'number') {
    return {
      success: false,
      error: `${fieldName} must be a number`,
    }
  }

  if (!Number.isInteger(id)) {
    return {
      success: false,
      error: `${fieldName} must be an integer`,
    }
  }

  if (id <= 0) {
    return {
      success: false,
      error: `${fieldName} must be positive`,
    }
  }

  return {
    success: true,
    data: id,
  }
}

/**
 * Validate string parameter
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
  }
): QueryResult<string> {
  if (typeof value !== 'string') {
    return {
      success: false,
      error: `${fieldName} must be a string`,
    }
  }

  const trimmed = value.trim()

  if (options?.minLength && trimmed.length < options.minLength) {
    return {
      success: false,
      error: `${fieldName} must be at least ${options.minLength} characters`,
    }
  }

  if (options?.maxLength && trimmed.length > options.maxLength) {
    return {
      success: false,
      error: `${fieldName} must be at most ${options.maxLength} characters`,
    }
  }

  if (options?.pattern && !options.pattern.test(trimmed)) {
    return {
      success: false,
      error: `${fieldName} has invalid format`,
    }
  }

  return {
    success: true,
    data: trimmed,
  }
}

/**
 * Validate email
 */
export function validateEmail(email: unknown): QueryResult<string> {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  return validateString(email, 'email', {
    minLength: 3,
    maxLength: 255,
    pattern: emailPattern,
  })
}

/**
 * Sanitize string for database (additional layer of safety)
 */
export function sanitizeString(value: string, maxLength = 1000): string {
  return value
    .trim()
    .substring(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
}

/**
 * Check if query affected any rows
 */
export function wasAffected(result: RunResult): boolean {
  return result.changes > 0
}

/**
 * Get last inserted ID
 */
export function getLastInsertId(result: RunResult): number {
  if (typeof result.lastInsertRowid === 'number') {
    return result.lastInsertRowid
  }
  // bigint support
  return Number(result.lastInsertRowid)
}

/**
 * Validate organization/tenant ID match for multi-tenant security
 */
export function validateTenantAccess(
  resourceOrgId: number | undefined,
  userOrgId: number
): QueryResult<void> {
  if (resourceOrgId === undefined) {
    return {
      success: false,
      error: 'Resource organization ID not found',
    }
  }

  if (resourceOrgId !== userOrgId) {
    return {
      success: false,
      error: 'Access denied: resource belongs to different organization',
    }
  }

  return {
    success: true,
  }
}

/**
 * Build safe WHERE clause for multi-tenant queries
 * Always includes organization_id filter
 */
export function buildTenantWhereClause(
  organizationId: number,
  additionalConditions?: string[]
): { where: string; params: (string | number)[] } {
  const conditions = ['organization_id = ?']
  const params: (string | number)[] = [organizationId]

  if (additionalConditions && additionalConditions.length > 0) {
    conditions.push(...additionalConditions)
  }

  return {
    where: conditions.join(' AND '),
    params,
  }
}

/**
 * Paginate query results
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function paginateResults<T>(
  data: T[],
  params: PaginationParams = {}
): PaginatedResult<T> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 10))
  const total = data.length
  const totalPages = Math.ceil(total / limit)

  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit

  return {
    data: data.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  }
}
