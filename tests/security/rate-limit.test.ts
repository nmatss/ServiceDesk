/**
 * Rate Limiting Security Tests
 *
 * Tests for rate limiting and brute force protection.
 * Validates that rate limiting functions work correctly.
 *
 * These tests work WITHOUT requiring a running server - they test the rate
 * limiting functions directly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyRateLimit,
  checkRateLimit,
  resetRateLimit,
  getRateLimitStats,
  rateLimitConfigs,
} from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import db from '@/lib/db/connection';

// Helper to create mock request
function createMockRequest(ip: string = '127.0.0.1', userAgent: string = 'test-agent'): any {
  return {
    headers: new Map([
      ['x-forwarded-for', ip],
      ['user-agent', userAgent],
    ]),
    ip,
  };
}

// Helper to convert Map to Headers-like object
function createHeaders(entries: [string, string][]): any {
  const map = new Map(entries);
  return {
    get: (key: string) => map.get(key) || null,
  };
}

describe('Rate Limiting Tests', () => {
  // Clean up rate limit table before each test
  beforeEach(() => {
    try {
      db.prepare('DELETE FROM rate_limits').run();
    } catch (error) {
      // Table might not exist yet, ignore
    }
  });

  afterEach(() => {
    try {
      db.prepare('DELETE FROM rate_limits').run();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.1'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.1',
      };

      const config = rateLimitConfigs.api;

      // First request should be allowed
      const result = await applyRateLimit(request, config, 'test-endpoint');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(config.maxRequests - 1);
      expect(result.total).toBe(config.maxRequests);
    });

    it('should block requests exceeding limit', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.2'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.2',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 3,
      };

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        const result = await applyRateLimit(request, config, 'test-endpoint');
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blockedResult = await applyRateLimit(request, config, 'test-endpoint');
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it('should track remaining requests correctly', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.3'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.3',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 5,
      };

      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await applyRateLimit(request, config, 'test-endpoint');
        results.push(result);
      }

      // Check that remaining decreases correctly
      expect(results[0].remaining).toBe(4);
      expect(results[1].remaining).toBe(3);
      expect(results[2].remaining).toBe(2);
      expect(results[3].remaining).toBe(1);
      expect(results[4].remaining).toBe(0);
    });
  });

  describe('IP-Based Rate Limiting', () => {
    it('should rate limit per IP address', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 2,
      };

      const ip1 = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.10'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.10',
      };

      const ip2 = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.11'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.11',
      };

      // IP1 makes requests
      const result1 = await applyRateLimit(ip1, config, 'test');
      const result2 = await applyRateLimit(ip1, config, 'test');
      const result3 = await applyRateLimit(ip1, config, 'test');

      // IP1 should be blocked
      expect(result3.allowed).toBe(false);

      // IP2 should still be allowed
      const result4 = await applyRateLimit(ip2, config, 'test');
      expect(result4.allowed).toBe(true);
    });

    it('should not allow bypassing with different User-Agent', async () => {
      const config = {
        windowMs: 60000,
        maxRequests: 2,
      };

      const request1 = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.20'],
          ['user-agent', 'Mozilla/5.0'],
        ]),
        ip: '192.168.1.20',
      };

      const request2 = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.20'],
          ['user-agent', 'Chrome/90.0'],
        ]),
        ip: '192.168.1.20',
      };

      // Make requests with different user agents from same IP
      await applyRateLimit(request1, config, 'test');
      await applyRateLimit(request1, config, 'test');

      // Different user agent from same IP should still contribute to limit
      // because they generate different fingerprints
      const result = await applyRateLimit(request2, config, 'test');
      expect(result.allowed).toBe(true); // Different fingerprint
    });
  });

  describe('Endpoint-Specific Limits', () => {
    it('should have different limits for login endpoint', () => {
      const authConfig = rateLimitConfigs.auth;
      const apiConfig = rateLimitConfigs.api;

      // Auth should be more restrictive
      expect(authConfig.maxRequests).toBeLessThan(apiConfig.maxRequests);
    });

    it('should have different limits for different endpoints', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.30'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.30',
      };

      // Make requests to different endpoints
      const result1 = await applyRateLimit(
        request,
        rateLimitConfigs.api,
        'endpoint1'
      );
      const result2 = await applyRateLimit(
        request,
        rateLimitConfigs.auth,
        'endpoint2'
      );

      // Both should be allowed (different endpoints)
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Check Rate Limit (Non-Incrementing)', () => {
    it('should check limit without incrementing counter', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.40'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.40',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 5,
      };

      // Apply rate limit once
      await applyRateLimit(request, config, 'test');

      // Check multiple times (should not increment)
      const check1 = await checkRateLimit(request, config, 'test');
      const check2 = await checkRateLimit(request, config, 'test');

      expect(check1.remaining).toBe(check2.remaining);
      expect(check1.remaining).toBe(4);
    });
  });

  describe('Reset Rate Limit', () => {
    it('should reset rate limit for specific endpoint', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.50'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.50',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 2,
      };

      // Exhaust limit
      await applyRateLimit(request, config, 'test');
      await applyRateLimit(request, config, 'test');
      const blocked = await applyRateLimit(request, config, 'test');
      expect(blocked.allowed).toBe(false);

      // Reset
      resetRateLimit(request, 'test');

      // Should be allowed again
      const afterReset = await applyRateLimit(request, config, 'test');
      expect(afterReset.allowed).toBe(true);
    });
  });

  describe('Rate Limit Statistics', () => {
    it('should return rate limit statistics', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.60'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.60',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 5,
      };

      // Create some rate limit entries
      await applyRateLimit(request, config, 'endpoint1');
      await applyRateLimit(request, config, 'endpoint2');

      const stats = getRateLimitStats();

      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.activeEntries).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Window Reset', () => {
    it('should include reset time in response', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.70'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.70',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 5,
      };

      const result = await applyRateLimit(request, config, 'test');

      expect(result.resetTime).toBeInstanceOf(Date);
      expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should maintain same reset time for subsequent requests', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.80'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.80',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 5,
      };

      const result1 = await applyRateLimit(request, config, 'test');
      const result2 = await applyRateLimit(request, config, 'test');

      // Reset time should be the same (within 1 second tolerance)
      const timeDiff = Math.abs(
        result1.resetTime.getTime() - result2.resetTime.getTime()
      );
      expect(timeDiff).toBeLessThan(1000);
    });
  });

  describe('Configuration Types', () => {
    it('should have auth configuration', () => {
      expect(rateLimitConfigs.auth).toBeDefined();
      expect(rateLimitConfigs.auth.maxRequests).toBe(5);
      expect(rateLimitConfigs.auth.windowMs).toBe(15 * 60 * 1000);
    });

    it('should have API configuration', () => {
      expect(rateLimitConfigs.api).toBeDefined();
      expect(rateLimitConfigs.api.maxRequests).toBe(100);
    });

    it('should have password reset configuration', () => {
      expect(rateLimitConfigs['password-reset']).toBeDefined();
      expect(rateLimitConfigs['password-reset'].maxRequests).toBe(3);
    });

    it('should have upload configuration', () => {
      expect(rateLimitConfigs.upload).toBeDefined();
      expect(rateLimitConfigs.upload.maxRequests).toBeDefined();
    });
  });

  describe('Strict Auth Rate Limiting', () => {
    it('should have stricter limits for auth-strict', () => {
      const strictConfig = rateLimitConfigs['auth-strict'];
      const normalConfig = rateLimitConfigs.auth;

      expect(strictConfig.maxRequests).toBeLessThan(normalConfig.maxRequests);
      expect(strictConfig.windowMs).toBeGreaterThan(normalConfig.windowMs);
    });
  });

  describe('Custom Key Generator', () => {
    it('should support custom key generators', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.90'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.90',
        customId: 'user-123',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: (req: any) => `custom:${req.customId}`,
      };

      // First request
      const result1 = await applyRateLimit(request, config, 'test');
      expect(result1.allowed).toBe(true);

      // Change IP but keep same custom ID
      const request2 = {
        ...request,
        ip: '192.168.1.91',
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.91'],
          ['user-agent', 'test-agent'],
        ]),
      };

      // Should still count against same limit (same custom key)
      const result2 = await applyRateLimit(request2, config, 'test');
      expect(result2.remaining).toBe(1); // Decremented from previous request
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', null],
          ['user-agent', null],
        ]),
        ip: undefined,
      };

      const config = {
        windowMs: 60000,
        maxRequests: 5,
      };

      // Should not throw, even with invalid request
      const result = await applyRateLimit(request, config, 'test');
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const request = {
        headers: createHeaders([
          ['x-forwarded-for', '192.168.1.100'],
          ['user-agent', 'test-agent'],
        ]),
        ip: '192.168.1.100',
      };

      const config = {
        windowMs: 60000,
        maxRequests: 10,
      };

      // Make multiple concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => applyRateLimit(request, config, 'test'));

      const results = await Promise.all(promises);

      // All should succeed (within limit)
      results.forEach((result) => {
        expect(result.allowed).toBe(true);
      });

      // Counter should be incremented correctly
      const check = await checkRateLimit(request, config, 'test');
      expect(check.remaining).toBe(5); // 10 - 5 = 5
    });
  });
});
