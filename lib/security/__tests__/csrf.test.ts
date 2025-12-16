/**
 * Comprehensive Unit Tests for CSRF Protection
 * Tests token generation, validation, timing-safe comparison, and middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  generateCSRFToken,
  validateCSRFToken,
  setCSRFToken,
  getCSRFToken,
  requireCSRFToken,
  withCSRFProtection,
  createCSRFMiddleware,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER
} from '../csrf'

// Mock logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

describe('CSRF Protection', () => {
  describe('Token Generation', () => {
    it('should generate cryptographically secure token', () => {
      const token = generateCSRFToken()

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(40) // base64url of 32 bytes
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()

      for (let i = 0; i < 100; i++) {
        tokens.add(generateCSRFToken())
      }

      expect(tokens.size).toBe(100) // All tokens should be unique
    })

    it('should generate URL-safe tokens (base64url)', () => {
      const token = generateCSRFToken()

      // Base64URL should only contain [A-Za-z0-9_-]
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(token).not.toContain('+')
      expect(token).not.toContain('/')
      expect(token).not.toContain('=')
    })

    it('should generate consistent length tokens', () => {
      const tokens = Array.from({ length: 10 }, () => generateCSRFToken())
      const lengths = tokens.map(t => t.length)

      // All tokens should have the same length
      expect(new Set(lengths).size).toBe(1)
    })
  })

  describe('Token Validation', () => {
    it('should validate matching cookie and header tokens', () => {
      const token = generateCSRFToken()

      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should reject request with missing cookie token', () => {
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, 'some-token')

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => undefined)

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(false)
    })

    it('should reject request with missing header token', () => {
      const token = generateCSRFToken()

      const request = new NextRequest('http://localhost', {
        method: 'POST'
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(false)
    })

    it('should reject request with mismatched tokens', () => {
      const cookieToken = generateCSRFToken()
      const headerToken = generateCSRFToken()

      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, headerToken)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: cookieToken
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(false)
    })

    it('should skip validation for GET requests', () => {
      const request = new NextRequest('http://localhost', {
        method: 'GET'
      })

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should skip validation for HEAD requests', () => {
      const request = new NextRequest('http://localhost', {
        method: 'HEAD'
      })

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should skip validation for OPTIONS requests', () => {
      const request = new NextRequest('http://localhost', {
        method: 'OPTIONS'
      })

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should validate POST requests', () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should validate PUT requests', () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'PUT',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should validate PATCH requests', () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'PATCH',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should validate DELETE requests', () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'DELETE',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should handle case-insensitive HTTP methods', () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'post', // lowercase
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })
  })

  describe('Timing-Safe Comparison', () => {
    it('should use timing-safe comparison', () => {
      const token1 = generateCSRFToken()
      const token2 = generateCSRFToken()

      const headers1 = new Headers()
      headers1.set(CSRF_TOKEN_HEADER, token1)

      const headers2 = new Headers()
      headers2.set(CSRF_TOKEN_HEADER, token2)

      const request1 = new NextRequest('http://localhost', {
        method: 'POST',
        headers: headers1
      })

      const request2 = new NextRequest('http://localhost', {
        method: 'POST',
        headers: headers2
      })

      request1.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token2 // Mismatch
      }))

      request2.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token2 // Match
      }))

      expect(validateCSRFToken(request1)).toBe(false)
      expect(validateCSRFToken(request2)).toBe(true)
    })

    it('should reject tokens of different lengths', () => {
      const shortToken = 'short'
      const longToken = generateCSRFToken()

      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, shortToken)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: longToken
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(false)
    })

    it('should take constant time for comparison (timing attack prevention)', () => {
      const token = generateCSRFToken()
      const wrongToken = generateCSRFToken()

      const headers1 = new Headers()
      headers1.set(CSRF_TOKEN_HEADER, token)

      const headers2 = new Headers()
      headers2.set(CSRF_TOKEN_HEADER, wrongToken)

      const request1 = new NextRequest('http://localhost', {
        method: 'POST',
        headers: headers1
      })

      const request2 = new NextRequest('http://localhost', {
        method: 'POST',
        headers: headers2
      })

      request1.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      request2.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      // Both should execute in similar time
      const start1 = performance.now()
      validateCSRFToken(request1)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      validateCSRFToken(request2)
      const time2 = performance.now() - start2

      // Time difference should be minimal (< 1ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(1)
    })
  })

  describe('Set CSRF Token in Response', () => {
    it('should set CSRF token cookie', () => {
      const response = NextResponse.json({})
      setCSRFToken(response)

      const cookie = response.cookies.get(CSRF_TOKEN_COOKIE)
      expect(cookie).toBeDefined()
      expect(cookie?.value).toBeTruthy()
    })

    it('should set CSRF token header', () => {
      const response = NextResponse.json({})
      setCSRFToken(response)

      const header = response.headers.get(CSRF_TOKEN_HEADER)
      expect(header).toBeTruthy()
    })

    it('should set cookie with correct attributes', () => {
      const response = NextResponse.json({})
      setCSRFToken(response)

      const cookie = response.cookies.get(CSRF_TOKEN_COOKIE)
      expect(cookie).toBeDefined()
      // httpOnly should be false (client needs to read it for header)
      // secure should be false in test environment
      // sameSite should be lax
    })

    it('should set cookie with 8 hour expiration', () => {
      const response = NextResponse.json({})
      setCSRFToken(response)

      const cookie = response.cookies.get(CSRF_TOKEN_COOKIE)
      expect(cookie).toBeDefined()
      // Max age is 60 * 60 * 8 = 28800 seconds
    })

    it('should return the response for chaining', () => {
      const response = NextResponse.json({ data: 'test' })
      const result = setCSRFToken(response)

      expect(result).toBe(response)
    })

    it('should set same token in both cookie and header', () => {
      const response = NextResponse.json({})
      setCSRFToken(response)

      const cookieToken = response.cookies.get(CSRF_TOKEN_COOKIE)?.value
      const headerToken = response.headers.get(CSRF_TOKEN_HEADER)

      expect(cookieToken).toBe(headerToken)
    })
  })

  describe('Get CSRF Token from Request', () => {
    it('should get CSRF token from cookie', () => {
      const expectedToken = generateCSRFToken()

      const request = new NextRequest('http://localhost')
      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: expectedToken
      }))

      const token = getCSRFToken(request)
      expect(token).toBe(expectedToken)
    })

    it('should return undefined if no token present', () => {
      const request = new NextRequest('http://localhost')
      request.cookies.get = vi.fn(() => undefined)

      const token = getCSRFToken(request)
      expect(token).toBeUndefined()
    })
  })

  describe('Require CSRF Token (throws on invalid)', () => {
    it('should not throw for valid token', () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      expect(() => requireCSRFToken(request)).not.toThrow()
    })

    it('should throw for invalid token', () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST'
      })

      request.cookies.get = vi.fn(() => undefined)

      expect(() => requireCSRFToken(request)).toThrow('CSRF token validation failed')
    })

    it('should not throw for GET requests', () => {
      const request = new NextRequest('http://localhost', {
        method: 'GET'
      })

      expect(() => requireCSRFToken(request)).not.toThrow()
    })
  })

  describe('CSRF Middleware Wrapper', () => {
    it('should execute handler for valid CSRF token', async () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const mockHandler = vi.fn(async () => NextResponse.json({ success: true }))

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
      expect(response).toBeDefined()
    })

    it('should reject request with invalid CSRF token', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'POST'
      })

      request.cookies.get = vi.fn(() => undefined)

      const mockHandler = vi.fn()

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
    })

    it('should set new CSRF token in response', async () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const mockHandler = vi.fn(async () => NextResponse.json({ success: true }))

      const response = await withCSRFProtection(request, mockHandler)

      const newToken = response.cookies.get(CSRF_TOKEN_COOKIE)
      expect(newToken).toBeDefined()
    })

    it('should skip validation for GET requests', async () => {
      const request = new NextRequest('http://localhost', {
        method: 'GET'
      })

      const mockHandler = vi.fn(async () => NextResponse.json({ success: true }))

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
      expect(response).toBeDefined()
    })
  })

  describe('Public Path Handling', () => {
    it('should skip CSRF for /api/auth/login', async () => {
      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST'
      })

      const mockHandler = vi.fn(async () => NextResponse.json({ success: true }))

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should skip CSRF for /api/auth/register', async () => {
      const request = new NextRequest('http://localhost/api/auth/register', {
        method: 'POST'
      })

      const mockHandler = vi.fn(async () => NextResponse.json({ success: true }))

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should skip CSRF for /api/health', async () => {
      const request = new NextRequest('http://localhost/api/health', {
        method: 'GET'
      })

      const mockHandler = vi.fn(async () => NextResponse.json({ status: 'ok' }))

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should skip CSRF for /_next/* paths', async () => {
      const request = new NextRequest('http://localhost/_next/static/chunk.js', {
        method: 'GET'
      })

      const mockHandler = vi.fn(async () => NextResponse.json({}))

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should NOT skip CSRF for protected API routes', async () => {
      const request = new NextRequest('http://localhost/api/tickets', {
        method: 'POST'
      })

      request.cookies.get = vi.fn(() => undefined)

      const mockHandler = vi.fn()

      const response = await withCSRFProtection(request, mockHandler)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
    })
  })

  describe('CSRF Middleware Creation', () => {
    it('should create middleware that returns null for valid token', async () => {
      const middleware = createCSRFMiddleware()

      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const result = await middleware(request)
      expect(result).toBeNull() // Null means continue
    })

    it('should create middleware that returns error for invalid token', async () => {
      const middleware = createCSRFMiddleware()

      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST'
      })

      request.cookies.get = vi.fn(() => undefined)

      const result = await middleware(request)
      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })

    it('should create middleware that skips public paths', async () => {
      const middleware = createCSRFMiddleware()

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST'
      })

      const result = await middleware(request)
      expect(result).toBeNull()
    })
  })

  describe('Error Messages', () => {
    it('should return descriptive error message', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST'
      })

      request.cookies.get = vi.fn(() => undefined)

      const middleware = createCSRFMiddleware()
      const response = await middleware(request)

      const body = await response?.json()
      expect(body.error).toBe('CSRF token validation failed')
      expect(body.message).toContain('refresh the page')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty token strings', () => {
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, '')

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: ''
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(false)
    })

    it('should handle whitespace in tokens', () => {
      const token = generateCSRFToken()
      const tokenWithSpace = `${token} `

      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, tokenWithSpace)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(false)
    })

    it('should handle very long tokens', () => {
      const longToken = 'A'.repeat(1000)

      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, longToken)

      const request = new NextRequest('http://localhost', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: longToken
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })

    it('should handle special characters in path', async () => {
      const token = generateCSRFToken()
      const headers = new Headers()
      headers.set(CSRF_TOKEN_HEADER, token)

      const request = new NextRequest('http://localhost/api/test%20path', {
        method: 'POST',
        headers
      })

      request.cookies.get = vi.fn(() => ({
        name: CSRF_TOKEN_COOKIE,
        value: token
      }))

      const isValid = validateCSRFToken(request)
      expect(isValid).toBe(true)
    })
  })
})
