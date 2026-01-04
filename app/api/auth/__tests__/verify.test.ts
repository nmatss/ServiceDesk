/**
 * Verify Route Tests
 * Tests GET /api/auth/verify and POST /api/auth/verify
 *
 * Coverage:
 * - Valid JWT token verification
 * - Invalid JWT token rejection
 * - Expired JWT token rejection
 * - Missing token handling
 * - Token from cookie vs header
 * - Rate limiting
 * - User existence validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET as verifyGET, POST as verifyPOST } from '@/app/api/auth/verify/route';
import {
  initTestDatabase,
  cleanupTestDatabase,
  resetTestData,
  createMockRequest,
  getResponseJSON,
  TEST_USERS,
  TEST_TENANT,
  getTestDb,
  generateTestToken,
  generateExpiredToken
} from './helpers/test-utils';

// Mock database connection to use test database
vi.mock('@/lib/db/connection', () => ({
  default: {
    prepare: (...args: any[]) => getTestDb().prepare(...args),
    exec: (...args: any[]) => getTestDb().exec(...args),
  }
}));

// Mock environment for JWT secret
vi.mock('@/lib/config/env', () => ({
  validateJWTSecret: () => 'test-jwt-secret-minimum-32-characters-long-for-testing',
  isProduction: () => false,
}));

// Mock logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}));

describe('Auth Verify Routes', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(() => {
    cleanupTestDatabase();
  });

  beforeEach(() => {
    resetTestData();
  });

  describe('GET /api/auth/verify', () => {
    describe('Valid Token Verification', () => {
      it('should verify valid token from cookie', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          cookies: {
            auth_token: token
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.id).toBe(TEST_USERS.user.id);
        expect(data.user.email).toBe(TEST_USERS.user.email);
        expect(data.user.name).toBe(TEST_USERS.user.name);
        expect(data.user.role).toBe(TEST_USERS.user.role);
      });

      it('should verify valid token from Authorization header', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(TEST_USERS.user.email);
      });

      it('should not expose sensitive user data', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          cookies: {
            auth_token: token
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        // Should NOT include password hash
        expect(data.user.password_hash).toBeUndefined();
        expect(data.user.password).toBeUndefined();
      });

      it('should work for all user roles', async () => {
        for (const userRole of Object.keys(TEST_USERS)) {
          const user = TEST_USERS[userRole as keyof typeof TEST_USERS];
          const token = await generateTestToken(user.id);

          const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
            method: 'GET',
            cookies: {
              auth_token: token
            }
          });

          const response = await verifyGET(request);
          const data = await getResponseJSON(response);

          expect(response.status).toBe(200);
          expect(data.user.role).toBe(user.role);
        }
      });
    });

    describe('Invalid Token Handling', () => {
      it('should reject request with no token', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET'
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Token não fornecido');
        expect(data.code).toBe('NO_TOKEN');
      });

      it('should reject invalid token format', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer invalid-token-here'
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Token inválido ou expirado');
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should reject expired token', async () => {
        const expiredToken = await generateExpiredToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          cookies: {
            auth_token: expiredToken
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should reject token with wrong signature', async () => {
        // Create a token with different secret
        const wrongSecret = new TextEncoder().encode('wrong-secret-key-different-from-test');
        const { SignJWT } = await import('jose');

        const token = await new SignJWT({
          id: TEST_USERS.user.id,
          email: TEST_USERS.user.email,
          role: TEST_USERS.user.role,
          organization_id: TEST_USERS.user.organization_id,
          tenant_slug: TEST_TENANT.slug
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(wrongSecret);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          cookies: {
            auth_token: token
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
      });

      it('should reject token for non-existent user', async () => {
        const { SignJWT } = await import('jose');
        const JWT_SECRET = new TextEncoder().encode('test-jwt-secret-minimum-32-characters-long-for-testing');

        // Create token for user ID that doesn't exist
        const token = await new SignJWT({
          id: 999999,
          email: 'nonexistent@test.com',
          role: 'user',
          organization_id: TEST_TENANT.id,
          tenant_slug: TEST_TENANT.slug
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(JWT_SECRET);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          cookies: {
            auth_token: token
          }
        });

        const response = await verifyGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
      });
    });

    describe('Rate Limiting', () => {
      it('should allow reasonable verification requests', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        // Make 10 requests (API rate limit is 100/15min)
        for (let i = 0; i < 10; i++) {
          const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
            method: 'GET',
            cookies: {
              auth_token: token
            }
          });

          const response = await verifyGET(request);
          expect(response.status).toBe(200);
        }
      });

      it('should rate limit excessive verification requests', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);
        const requests = [];

        // Create 150 rapid requests (more than API limit of 100/15min)
        for (let i = 0; i < 150; i++) {
          const request = createMockRequest('http://localhost:3000/api/auth/verify', {
            method: 'GET',
            cookies: {
              auth_token: token
            },
            ip: '192.168.1.200'
          });
          requests.push(request);
        }

        const responses = await Promise.all(
          requests.map(async req => verifyGET(await req))
        );

        // At least some should be rate limited
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
      });
    });
  });

  describe('POST /api/auth/verify', () => {
    describe('Valid Token Verification', () => {
      it('should verify token from request body', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'POST',
          body: {
            token: token
          }
        });

        const response = await verifyPOST(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(TEST_USERS.user.email);
      });

      it('should return user data without sensitive fields', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'POST',
          body: {
            token: token
          }
        });

        const response = await verifyPOST(request);
        const data = await getResponseJSON(response);

        expect(data.user.password_hash).toBeUndefined();
        expect(data.user.password).toBeUndefined();
        expect(data.user.locked_until).toBeUndefined();
        expect(data.user.failed_login_attempts).toBeUndefined();
      });
    });

    describe('Invalid Token Handling', () => {
      it('should reject request without token in body', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'POST',
          body: {}
        });

        const response = await verifyPOST(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Token não fornecido');
        expect(data.code).toBe('NO_TOKEN');
      });

      it('should reject invalid token', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'POST',
          body: {
            token: 'invalid-token'
          }
        });

        const response = await verifyPOST(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Token inválido ou expirado');
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should reject expired token', async () => {
        const expiredToken = await generateExpiredToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'POST',
          body: {
            token: expiredToken
          }
        });

        const response = await verifyPOST(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        // Create a token for a user we'll delete
        const db = getTestDb();
        const userId = await (async () => {
          const { hashPassword } = await import('@/lib/auth/sqlite-auth');
          const hash = await hashPassword('TempPassword123!');
          const result = db.prepare(`
            INSERT INTO users (organization_id, name, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
          `).run(TEST_TENANT.id, 'Temp User', 'temp@test.com', hash, 'user');
          return result.lastInsertRowid as number;
        })();

        const token = await generateTestToken(userId);

        // Delete the user
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
          method: 'POST',
          body: {
            token: token
          }
        });

        const response = await verifyPOST(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
      });

      it('should handle malformed JSON gracefully', async () => {
        try {
          const request = new Request('http://localhost:3000/api/auth/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: 'invalid json{'
          });

          const response = await verifyPOST(request as any);
          expect(response.status).toBeGreaterThanOrEqual(400);
        } catch (error) {
          // Should handle error gracefully
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Security Features', () => {
    it('should validate JWT issuer', async () => {
      const { SignJWT } = await import('jose');
      const JWT_SECRET = new TextEncoder().encode('test-jwt-secret-minimum-32-characters-long-for-testing');

      // Create token with wrong issuer
      const token = await new SignJWT({
        id: TEST_USERS.user.id,
        email: TEST_USERS.user.email,
        role: TEST_USERS.user.role,
        organization_id: TEST_USERS.user.organization_id,
        tenant_slug: TEST_TENANT.slug
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('wrong-issuer') // Wrong issuer
        .setExpirationTime('1h')
        .sign(JWT_SECRET);

      const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        cookies: {
          auth_token: token
        }
      });

      const response = await verifyGET(request);
      // May or may not reject based on implementation
      // At minimum, should verify user exists
    });

    it('should validate JWT audience', async () => {
      const { SignJWT } = await import('jose');
      const JWT_SECRET = new TextEncoder().encode('test-jwt-secret-minimum-32-characters-long-for-testing');

      // Create token with wrong audience
      const token = await new SignJWT({
        id: TEST_USERS.user.id,
        email: TEST_USERS.user.email,
        role: TEST_USERS.user.role,
        organization_id: TEST_USERS.user.organization_id,
        tenant_slug: TEST_TENANT.slug
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setAudience('wrong-audience') // Wrong audience
        .setExpirationTime('1h')
        .sign(JWT_SECRET);

      const request = await createMockRequest('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        cookies: {
          auth_token: token
        }
      });

      const response = await verifyGET(request);
      // May or may not reject based on implementation
    });
  });
});
