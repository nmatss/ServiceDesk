/**
 * Unit Tests for Error Handler
 */

import { describe, it, expect, vi } from 'vitest'
import {
  ErrorType,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  RateLimitError,
  ExternalAPIError,
  formatErrorResponse,
  getStatusCode,
  validateOrThrow,
  assert,
} from '../error-handler'
import { z } from 'zod'

describe('AppError', () => {
  it('should create error with correct properties', () => {
    const error = new AppError(
      'Test error',
      ErrorType.INTERNAL_ERROR,
      500,
      true,
      { detail: 'test' }
    )

    expect(error.message).toBe('Test error')
    expect(error.type).toBe(ErrorType.INTERNAL_ERROR)
    expect(error.statusCode).toBe(500)
    expect(error.isOperational).toBe(true)
    expect(error.details).toEqual({ detail: 'test' })
  })

  it('should use default values', () => {
    const error = new AppError('Test error')

    expect(error.type).toBe(ErrorType.INTERNAL_ERROR)
    expect(error.statusCode).toBe(500)
    expect(error.isOperational).toBe(true)
  })
})

describe('Specific Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input', { field: 'email' })

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR)
      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Invalid input')
      expect(error.details).toEqual({ field: 'email' })
      expect(error.isOperational).toBe(true)
    })
  })

  describe('AuthenticationError', () => {
    it('should create authentication error with 401 status', () => {
      const error = new AuthenticationError()

      expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR)
      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Authentication required')
    })

    it('should accept custom message', () => {
      const error = new AuthenticationError('Invalid token')

      expect(error.message).toBe('Invalid token')
    })
  })

  describe('AuthorizationError', () => {
    it('should create authorization error with 403 status', () => {
      const error = new AuthorizationError()

      expect(error.type).toBe(ErrorType.AUTHORIZATION_ERROR)
      expect(error.statusCode).toBe(403)
      expect(error.message).toBe('Insufficient permissions')
    })

    it('should accept custom message', () => {
      const error = new AuthorizationError('Admin access required')

      expect(error.message).toBe('Admin access required')
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('User')

      expect(error.type).toBe(ErrorType.NOT_FOUND_ERROR)
      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('User not found')
    })
  })

  describe('ConflictError', () => {
    it('should create conflict error with 409 status', () => {
      const error = new ConflictError('Email already exists')

      expect(error.type).toBe(ErrorType.CONFLICT_ERROR)
      expect(error.statusCode).toBe(409)
      expect(error.message).toBe('Email already exists')
    })
  })

  describe('DatabaseError', () => {
    it('should create database error with 500 status', () => {
      const error = new DatabaseError()

      expect(error.type).toBe(ErrorType.DATABASE_ERROR)
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(false)
    })
  })

  describe('RateLimitError', () => {
    it('should create rate limit error with 429 status', () => {
      const error = new RateLimitError()

      expect(error.type).toBe(ErrorType.RATE_LIMIT_ERROR)
      expect(error.statusCode).toBe(429)
      expect(error.message).toBe('Too many requests')
    })
  })

  describe('ExternalAPIError', () => {
    it('should create external API error with 503 status', () => {
      const error = new ExternalAPIError('OpenAI')

      expect(error.type).toBe(ErrorType.EXTERNAL_API_ERROR)
      expect(error.statusCode).toBe(503)
      expect(error.message).toBe('External service OpenAI unavailable')
    })

    it('should accept custom message', () => {
      const error = new ExternalAPIError('OpenAI', 'API rate limit exceeded')

      expect(error.message).toBe('API rate limit exceeded')
    })
  })
})

describe('formatErrorResponse', () => {
  it('should format AppError correctly', () => {
    const error = new ValidationError('Invalid email', { email: ['Invalid format'] })
    const response = formatErrorResponse(error, '/api/users')

    expect(response.success).toBe(false)
    expect(response.error.type).toBe(ErrorType.VALIDATION_ERROR)
    expect(response.error.message).toBe('Invalid email')
    expect(response.error.details).toEqual({ email: ['Invalid format'] })
    expect(response.error.path).toBe('/api/users')
    expect(response.error.timestamp).toBeDefined()
  })

  it('should format generic Error in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const error = new Error('Database connection failed')
    const response = formatErrorResponse(error)

    expect(response.error.type).toBe(ErrorType.INTERNAL_ERROR)
    expect(response.error.message).toBe('An unexpected error occurred')
    expect(response.error.details).toBeUndefined()

    process.env.NODE_ENV = originalEnv
  })

  it('should format generic Error in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const error = new Error('Database connection failed')
    const response = formatErrorResponse(error)

    expect(response.error.message).toBe('Database connection failed')

    process.env.NODE_ENV = originalEnv
  })
})

describe('getStatusCode', () => {
  it('should return status code from AppError', () => {
    expect(getStatusCode(new ValidationError('test'))).toBe(400)
    expect(getStatusCode(new AuthenticationError())).toBe(401)
    expect(getStatusCode(new AuthorizationError())).toBe(403)
    expect(getStatusCode(new NotFoundError('User'))).toBe(404)
    expect(getStatusCode(new ConflictError('test'))).toBe(409)
    expect(getStatusCode(new RateLimitError())).toBe(429)
    expect(getStatusCode(new DatabaseError())).toBe(500)
    expect(getStatusCode(new ExternalAPIError('test'))).toBe(503)
  })

  it('should return 400 for Zod errors', () => {
    const schema = z.object({ email: z.string().email() })
    try {
      schema.parse({ email: 'invalid' })
    } catch (error) {
      expect(getStatusCode(error as Error)).toBe(400)
    }
  })

  it('should return 500 for generic errors', () => {
    const error = new Error('Unknown error')
    expect(getStatusCode(error)).toBe(500)
  })
})

describe('validateOrThrow', () => {
  const userSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().min(18),
  })

  it('should return validated data on success', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 25,
    }

    const result = validateOrThrow(userSchema, data)
    expect(result).toEqual(data)
  })

  it('should throw ValidationError on failure', () => {
    const invalidData = {
      name: '',
      email: 'invalid-email',
      age: 15,
    }

    expect(() => validateOrThrow(userSchema, invalidData)).toThrow(ValidationError)
  })

  it('should include field errors in details', () => {
    const invalidData = {
      name: '',
      email: 'invalid',
      age: 15,
    }

    try {
      validateOrThrow(userSchema, invalidData, 'user data')
      // Should not reach here
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      const validationError = error as ValidationError
      expect(validationError.message).toContain('user data')
      expect(validationError.details).toBeDefined()

      const details = validationError.details as Record<string, string[]>
      // Check that we have error details (either specific fields or _general)
      const hasFieldErrors = Object.keys(details).length > 0
      expect(hasFieldErrors).toBe(true)

      // Should have at least one error message
      const allErrors = Object.values(details).flat()
      expect(allErrors.length).toBeGreaterThan(0)
    }
  })
})

describe('assert', () => {
  it('should not throw on true condition', () => {
    expect(() => assert(true, 'Error message')).not.toThrow()
    expect(() => assert(1 === 1, new ValidationError('test'))).not.toThrow()
  })

  it('should throw string error on false condition', () => {
    expect(() => assert(false, 'Test error')).toThrow(AppError)
    expect(() => assert(false, 'Test error')).toThrow('Test error')
  })

  it('should throw AppError on false condition', () => {
    const customError = new ValidationError('Custom validation error')
    expect(() => assert(false, customError)).toThrow(ValidationError)
    expect(() => assert(false, customError)).toThrow('Custom validation error')
  })

  it('should act as type guard', () => {
    const value: string | null = 'test'
    assert(value !== null, 'Value is null')

    // TypeScript should now know value is string
    const uppercase: string = value.toUpperCase()
    expect(uppercase).toBe('TEST')
  })
})

describe('Error Integration Tests', () => {
  it('should handle error flow from validation to response', () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    })

    const invalidData = {
      email: 'invalid',
      password: 'short',
    }

    try {
      validateOrThrow(schema, invalidData, 'login credentials')
    } catch (error) {
      const statusCode = getStatusCode(error as Error)
      const response = formatErrorResponse(error as Error, '/api/auth/login')

      expect(statusCode).toBe(400)
      expect(response.success).toBe(false)
      expect(response.error.type).toBe(ErrorType.VALIDATION_ERROR)
      expect(response.error.message).toContain('login credentials')
      expect(response.error.path).toBe('/api/auth/login')
    }
  })

  it('should preserve error context through error chain', () => {
    const originalError = new NotFoundError('Ticket')
    const statusCode = getStatusCode(originalError)
    const response = formatErrorResponse(originalError, '/api/tickets/999')

    expect(statusCode).toBe(404)
    expect(response.error.type).toBe(ErrorType.NOT_FOUND_ERROR)
    expect(response.error.message).toBe('Ticket not found')
    expect(response.error.path).toBe('/api/tickets/999')
  })
})
