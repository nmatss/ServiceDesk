/**
 * Global Error Handling System
 * Centralized error handling for consistent API responses
 */

import type { NextResponse } from 'next/server'
import { z } from 'zod'
import logger from '../monitoring/structured-logger';

/**
 * Application Error Types
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly type: ErrorType
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly details?: unknown

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message)
    this.type = type
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.details = details

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorType.VALIDATION_ERROR, 400, true, details)
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, ErrorType.AUTHENTICATION_ERROR, 401, true)
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, ErrorType.AUTHORIZATION_ERROR, 403, true)
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, ErrorType.NOT_FOUND_ERROR, 404, true)
  }
}

/**
 * Conflict Error (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.CONFLICT_ERROR, 409, true)
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, ErrorType.DATABASE_ERROR, 500, false)
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, ErrorType.RATE_LIMIT_ERROR, 429, true)
  }
}

/**
 * External API Error
 */
export class ExternalAPIError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} unavailable`,
      ErrorType.EXTERNAL_API_ERROR,
      503,
      true
    )
  }
}

/**
 * Error Response Interface
 */
export interface ErrorResponse {
  success: false
  error: {
    type: ErrorType
    message: string
    details?: unknown
    timestamp: string
    path?: string
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(
  error: Error | AppError,
  path?: string
): ErrorResponse {
  const isAppError = error instanceof AppError

  return {
    success: false,
    error: {
      type: isAppError ? error.type : ErrorType.INTERNAL_ERROR,
      message: isAppError
        ? error.message
        : process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      details: isAppError ? error.details : undefined,
      timestamp: new Date().toISOString(),
      path,
    },
  }
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: Error | AppError): number {
  if (error instanceof AppError) {
    return error.statusCode
  }

  // Default status codes for known error types
  if (error instanceof z.ZodError) {
    return 400
  }

  return 500
}

/**
 * Log error appropriately
 */
export function logError(error: Error | AppError, context?: string): void {
  const isProduction = process.env.NODE_ENV === 'production'

  // In production, use structured logging
  if (isProduction) {
    // TODO: Integrate with logging service (e.g., Sentry, Winston, etc.)
    logger.error({
      timestamp: new Date().toISOString(),
      context,
      type: error instanceof AppError ? error.type : 'UNHANDLED_ERROR',
      message: error.message,
      stack: error.stack,
      isOperational: error instanceof AppError ? error.isOperational : false,
    })
  } else {
    // Development: detailed console output
    logger.error(`\n${'='.repeat(80)}`)
    logger.error(`ERROR${context ? ` in ${context}` : ''}`)
    logger.error('='.repeat(80))
    logger.error('Message', error.message)
    if (error instanceof AppError) {
      logger.error('Type', error.type)
      logger.error('Status', error.statusCode)
      logger.error('Operational', error.isOperational)
      if (error.details) {
        logger.error('Details', error.details)
      }
    }
    logger.error('\nStack')
    logger.error(error.stack)
    logger.error('='.repeat(80) + '\n')
  }
}

/**
 * Handle error in API route
 */
export function handleAPIError(
  error: Error | AppError,
  path?: string
): Response {
  logError(error, path)

  const statusCode = getStatusCode(error)
  const response = formatErrorResponse(error, path)

  return Response.json(response, { status: statusCode })
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args)
    } catch (error) {
      throw error instanceof AppError
        ? error
        : new AppError(
            error instanceof Error ? error.message : 'Unknown error',
            ErrorType.INTERNAL_ERROR,
            500,
            false
          )
    }
  }
}

/**
 * Try-catch wrapper with error transformation
 */
export async function tryCatch<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(
      errorMessage || (error instanceof Error ? error.message : 'Operation failed'),
      ErrorType.INTERNAL_ERROR,
      500,
      false
    )
  }
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  error: AppError | string
): asserts condition {
  if (!condition) {
    throw typeof error === 'string' ? new AppError(error) : error
  }
}

/**
 * Validate and parse Zod schema
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors: Record<string, string[]> = {}

    // Handle Zod error format
    const zodErrors = result.error.issues || []

    if (zodErrors.length === 0 && result.error.message) {
      // Fallback for different error formats
      errors['_general'] = [result.error.message]
    } else {
      zodErrors.forEach((err: any) => {
        const path = err.path?.join('.') || '_general'
        if (!errors[path]) {
          errors[path] = []
        }
        errors[path].push(err.message || 'Validation error')
      })
    }

    throw new ValidationError(
      `Validation failed${context ? ` for ${context}` : ''}`,
      errors
    )
  }

  return result.data
}
