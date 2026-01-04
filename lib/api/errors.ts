/**
 * Standardized Error Handling System
 * Enterprise-grade error management for APIs
 */

import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { ApiError, ApiResponse, ErrorCode, HTTP_STATUS, HttpStatus } from './types'
import logger from '../monitoring/structured-logger';

// Error detail types
export type ErrorDetailValue = string | number | boolean | null | string[] | number[] | { [key: string]: unknown } | Array<{ [key: string]: unknown }>;

export interface ErrorDetails {
  field?: string;
  value?: ErrorDetailValue;
  constraint?: string;
  code?: string;
  retryAfter?: number;
  service?: string;
  [key: string]: ErrorDetailValue | undefined;
}

// Custom Error Classes
export class ApiErrorBase extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: HttpStatus
  public readonly details?: ErrorDetails
  public readonly requestId: string

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: HttpStatus,
    details?: ErrorDetails,
    requestId?: string
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.requestId = requestId || uuidv4()

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toApiError(path: string): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
      path,
      requestId: this.requestId,
    }
  }
}

// Specific Error Types
export class ValidationError extends ApiErrorBase {
  constructor(message: string, details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.VALIDATION_ERROR, message, HTTP_STATUS.BAD_REQUEST, details, requestId)
  }
}

export class AuthenticationError extends ApiErrorBase {
  constructor(message: string = 'Authentication required', details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.UNAUTHORIZED, message, HTTP_STATUS.UNAUTHORIZED, details, requestId)
  }
}

export class AuthorizationError extends ApiErrorBase {
  constructor(message: string = 'Insufficient permissions', details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.FORBIDDEN, message, HTTP_STATUS.FORBIDDEN, details, requestId)
  }
}

export class NotFoundError extends ApiErrorBase {
  constructor(resource: string = 'Resource', details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.RESOURCE_NOT_FOUND, `${resource} not found`, HTTP_STATUS.NOT_FOUND, details, requestId)
  }
}

export class ConflictError extends ApiErrorBase {
  constructor(message: string, details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.RESOURCE_CONFLICT, message, HTTP_STATUS.CONFLICT, details, requestId)
  }
}

export class RateLimitError extends ApiErrorBase {
  constructor(retryAfter?: number, details?: ErrorDetails, requestId?: string) {
    const message = retryAfter
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
      : 'Rate limit exceeded'

    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, HTTP_STATUS.RATE_LIMITED, {
      retryAfter,
      ...details
    }, requestId)
  }
}

export class BusinessRuleError extends ApiErrorBase {
  constructor(message: string, details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.BUSINESS_RULE_VIOLATION, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, details, requestId)
  }
}

export class ExternalServiceError extends ApiErrorBase {
  constructor(service: string, message?: string, details?: ErrorDetails, requestId?: string) {
    const errorMessage = message || `External service ${service} is unavailable`
    super(ErrorCode.EXTERNAL_SERVICE_ERROR, errorMessage, HTTP_STATUS.BAD_GATEWAY, {
      service,
      ...details
    }, requestId)
  }
}

export class DatabaseError extends ApiErrorBase {
  constructor(operation: string, details?: ErrorDetails, requestId?: string) {
    super(ErrorCode.DATABASE_ERROR, `Database operation failed: ${operation}`, HTTP_STATUS.INTERNAL_ERROR, details, requestId)
  }
}

// Error Handler Factory
export class ErrorHandler {
  private static logError(error: ApiErrorBase | Error, path: string, requestId: string): void {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      requestId,
      path,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof ApiErrorBase && {
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
        }),
      },
    }

    logger.error('API Error', JSON.stringify(logData, null, 2))

    // In production, you would send this to your logging service
    // Example: Sentry, LogRocket, CloudWatch, etc.
    if (process.env.NODE_ENV === 'production') {
      // await logToExternalService(logData)
    }
  }

  public static handle(error: unknown, path: string, requestId?: string): NextResponse<ApiResponse> {
    const id = requestId || uuidv4()

    // Handle known API errors
    if (error instanceof ApiErrorBase) {
      this.logError(error, path, id)

      const response: ApiResponse = {
        success: false,
        error: error.toApiError(path),
      }

      return NextResponse.json(response, {
        status: error.statusCode,
        headers: {
          'X-Request-ID': id,
          'Content-Type': 'application/json',
        },
      })
    }

    // Handle validation errors from Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      this.logError(error as unknown as Error, path, id)

      const validationError = new ValidationError('Validation failed', {
        issues: (error as { issues: unknown }).issues as ErrorDetailValue,
      }, id)

      const response: ApiResponse = {
        success: false,
        error: validationError.toApiError(path),
      }

      return NextResponse.json(response, {
        status: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'X-Request-ID': id,
          'Content-Type': 'application/json',
        },
      })
    }

    // Handle unknown errors
    const unknownError = error instanceof Error ? error : new Error('Unknown error occurred')
    this.logError(unknownError, path, id)

    const apiError = new ApiErrorBase(
      ErrorCode.INTERNAL_ERROR,
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : unknownError.message,
      HTTP_STATUS.INTERNAL_ERROR,
      process.env.NODE_ENV !== 'production'
        ? { stack: unknownError.stack }
        : undefined,
      id
    )

    const response: ApiResponse = {
      success: false,
      error: apiError.toApiError(path),
    }

    return NextResponse.json(response, {
      status: HTTP_STATUS.INTERNAL_ERROR,
      headers: {
        'X-Request-ID': id,
        'Content-Type': 'application/json',
      },
    })
  }

  public static async handleAsync(
    asyncFn: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      return await asyncFn()
    } catch (error) {
      return this.handle(error, 'async-operation')
    }
  }
}

// Error Response Helpers
export function createErrorResponse(
  error: ApiErrorBase,
  path: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: error.toApiError(path),
  }

  return NextResponse.json(response, {
    status: error.statusCode,
    headers: {
      'X-Request-ID': error.requestId,
      'Content-Type': 'application/json',
    },
  })
}

export function createValidationErrorResponse(
  issues: Array<{ field: string; message: string; code: string }>,
  path: string,
  requestId?: string
): NextResponse<ApiResponse> {
  const error = new ValidationError('Validation failed', { issues }, requestId)
  return createErrorResponse(error, path)
}

// Error Boundaries for API Routes
export function withErrorBoundary<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  path?: string
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      return ErrorHandler.handle(error, path || 'unknown')
    }
  }
}

// HTTP Status Code Utilities
export function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500
}

export function isServerError(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600
}

export function getErrorCategory(statusCode: number): 'client' | 'server' | 'success' | 'redirect' {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'redirect'
  if (statusCode >= 400 && statusCode < 500) return 'client'
  if (statusCode >= 500 && statusCode < 600) return 'server'
  return 'client' // fallback
}

// Export error types for easy imports
export {
  ErrorCode,
  HTTP_STATUS,
}

export default ErrorHandler