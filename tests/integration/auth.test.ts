/**
 * Authentication API Integration Tests
 *
 * Tests all authentication endpoints including registration, login, logout,
 * password management, and token refresh.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { GET as verifyGET } from '@/app/api/auth/verify/route';
import { GET as profileGET, PUT as profilePUT } from '@/app/api/auth/profile/route';
import {
  TEST_TENANT,
  TEST_USERS,
  getTestDb,
  createMockRequest,
  getResponseJSON
} from './setup';

describe('Auth API Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'New User',
          email: 'newuser@test.com',
          password: 'SecurePass123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('newuser@test.com');
      expect(data.user.name).toBe('New User');
      expect(data.user.role).toBe('user');
      expect(data.token).toBeDefined();

      // Verify user was created in database
      const db = getTestDb();
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get('newuser@test.com');
      expect(user).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'test@test.com',
          password: '123',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('senha');
    });

    it('should reject registration with invalid email', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'invalid-email',
          password: 'SecurePass123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Email inválido');
    });

    it('should reject duplicate email registration', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Duplicate User',
          email: TEST_USERS.user.email, // Existing email
          password: 'SecurePass123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('já está em uso');
    });

    it('should reject registration with missing required fields', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          // Missing email and password
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should sanitize name to prevent XSS', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: '<script>alert("xss")</script>Test User',
          email: 'xss-test@test.com',
          password: 'SecurePass123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.user.name).not.toContain('<script>');
    });

    it('should set authentication cookies on successful registration', async () => {
      const request = await createMockRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Cookie Test User',
          email: 'cookie-test@test.com',
          password: 'SecurePass123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await registerPOST(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const request = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: TEST_USERS.user.email,
          password: TEST_USERS.user.password,
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await loginPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(TEST_USERS.user.email);
      expect(data.tenant).toBeDefined();
      expect(data.tenant.slug).toBe(TEST_TENANT.slug);
    });

    it('should reject login with invalid password', async () => {
      const request = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: TEST_USERS.user.email,
          password: 'WrongPassword123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await loginPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Credenciais inválidas');
    });

    it('should reject login with non-existent email', async () => {
      const request = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'nonexistent@test.com',
          password: 'SomePass123!',
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await loginPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Credenciais inválidas');
    });

    it('should update last_login_at on successful login', async () => {
      const db = getTestDb();
      const beforeLogin = db.prepare('SELECT last_login_at FROM users WHERE email = ?')
        .get(TEST_USERS.user.email) as any;

      const request = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: TEST_USERS.user.email,
          password: TEST_USERS.user.password,
          tenant_slug: TEST_TENANT.slug
        }
      });

      await loginPOST(request as any);

      const afterLogin = db.prepare('SELECT last_login_at FROM users WHERE email = ?')
        .get(TEST_USERS.user.email) as any;

      // last_login_at should be updated
      expect(afterLogin.last_login_at).toBeTruthy();
    });

    it('should create audit log entry on successful login', async () => {
      const request = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: TEST_USERS.user.email,
          password: TEST_USERS.user.password,
          tenant_slug: TEST_TENANT.slug
        }
      });

      await loginPOST(request as any);

      const db = getTestDb();
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'user' AND action = 'login'
        AND user_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(TEST_USERS.user.id);

      expect(auditLog).toBeDefined();
    });

    it('should lock account after multiple failed login attempts', async () => {
      const db = getTestDb();

      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        const request = await createMockRequest('/api/auth/login', {
          method: 'POST',
          body: {
            email: TEST_USERS.admin.email,
            password: 'WrongPassword!',
            tenant_slug: TEST_TENANT.slug
          }
        });

        await loginPOST(request as any);
      }

      // Check if account is locked
      const user = db.prepare('SELECT locked_until, failed_login_attempts FROM users WHERE email = ?')
        .get(TEST_USERS.admin.email) as any;

      expect(user.failed_login_attempts).toBeGreaterThanOrEqual(5);
      expect(user.locked_until).toBeTruthy();

      // Try to login again - should be rejected
      const lockedRequest = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password, // Correct password
          tenant_slug: TEST_TENANT.slug
        }
      });

      const response = await loginPOST(lockedRequest as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(423); // 423 Locked
      expect(data.locked).toBe(true);
    });

    it('should reset failed attempts counter on successful login', async () => {
      const db = getTestDb();

      // Set failed attempts manually
      db.prepare('UPDATE users SET failed_login_attempts = 3 WHERE email = ?')
        .run(TEST_USERS.user.email);

      const request = await createMockRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: TEST_USERS.user.email,
          password: TEST_USERS.user.password,
          tenant_slug: TEST_TENANT.slug
        }
      });

      await loginPOST(request as any);

      const user = db.prepare('SELECT failed_login_attempts FROM users WHERE email = ?')
        .get(TEST_USERS.user.email) as any;

      expect(user.failed_login_attempts).toBe(0);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify valid token', async () => {
      const request = await createMockRequest('/api/auth/verify', {
        method: 'GET',
        userId: TEST_USERS.user.id
      });

      const response = await verifyGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(TEST_USERS.user.email);
    });

    it('should reject invalid token', async () => {
      const request = await createMockRequest('/api/auth/verify', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token-here'
        }
      });

      const response = await verifyGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get authenticated user profile', async () => {
      const request = await createMockRequest('/api/auth/profile', {
        method: 'GET',
        userId: TEST_USERS.user.id
      });

      const response = await profileGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(TEST_USERS.user.email);
      expect(data.user.name).toBe(TEST_USERS.user.name);
    });

    it('should not expose password hash in profile', async () => {
      const request = await createMockRequest('/api/auth/profile', {
        method: 'GET',
        userId: TEST_USERS.user.id
      });

      const response = await profileGET(request as any);
      const data = await getResponseJSON(response);

      expect(data.user.password_hash).toBeUndefined();
      expect(data.user.password).toBeUndefined();
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update user profile', async () => {
      const request = await createMockRequest('/api/auth/profile', {
        method: 'PUT',
        userId: TEST_USERS.user.id,
        body: {
          name: 'Updated Name',
          phone: '+55 11 98765-4321'
        }
      });

      const response = await profilePUT(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify update in database
      const db = getTestDb();
      const user = db.prepare('SELECT name, phone FROM users WHERE id = ?')
        .get(TEST_USERS.user.id) as any;

      expect(user.name).toBe('Updated Name');
      expect(user.phone).toBe('+55 11 98765-4321');
    });

    it('should sanitize profile updates to prevent XSS', async () => {
      const request = await createMockRequest('/api/auth/profile', {
        method: 'PUT',
        userId: TEST_USERS.user.id,
        body: {
          name: '<script>alert("xss")</script>Hacker'
        }
      });

      const response = await profilePUT(request as any);

      expect(response.status).toBe(200);

      const db = getTestDb();
      const user = db.prepare('SELECT name FROM users WHERE id = ?')
        .get(TEST_USERS.user.id) as any;

      expect(user.name).not.toContain('<script>');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const request = await createMockRequest('/api/auth/logout', {
        method: 'POST',
        userId: TEST_USERS.user.id
      });

      const response = await logoutPOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should clear authentication cookies on logout', async () => {
      const request = await createMockRequest('/api/auth/logout', {
        method: 'POST',
        userId: TEST_USERS.user.id
      });

      const response = await logoutPOST(request as any);

      expect(response.status).toBe(200);
      // Cookies should be cleared (set to expire in the past)
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        expect(cookies).toContain('auth_token=');
      }
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
    });

    afterEach(() => {
      delete process.env.ENABLE_RATE_LIMIT_TESTS;
    });

    it('should rate limit excessive login attempts', async () => {
      const promises = [];

      // Attempt 20 rapid login requests
      for (let i = 0; i < 20; i++) {
        const request = createMockRequest('/api/auth/login', {
          method: 'POST',
          body: {
            email: 'rate-limit-test@test.com',
            password: 'Test123!',
            tenant_slug: TEST_TENANT.slug
          }
        });

        promises.push(request.then(req => loginPOST(req as any)));
      }

      const responses = await Promise.all(promises);

      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should rate limit excessive registration attempts', async () => {
      const promises = [];

      // Attempt 10 rapid registration requests
      for (let i = 0; i < 10; i++) {
        const request = createMockRequest('/api/auth/register', {
          method: 'POST',
          body: {
            name: `Rate Test ${i}`,
            email: `rate${i}@test.com`,
            password: 'Test123!',
            tenant_slug: TEST_TENANT.slug
          }
        });

        promises.push(request.then(req => registerPOST(req as any)));
      }

      const responses = await Promise.all(promises);

      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});
