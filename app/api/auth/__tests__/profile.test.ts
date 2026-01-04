/**
 * Profile Route Tests
 * Tests GET /api/auth/profile and PUT /api/auth/profile
 *
 * Coverage:
 * - Get authenticated user profile
 * - Update user profile
 * - Authentication requirement
 * - Field validation
 * - Email uniqueness check
 * - XSS prevention
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET as profileGET, PUT as profilePUT } from '@/app/api/auth/profile/route';
import {
  initTestDatabase,
  cleanupTestDatabase,
  resetTestData,
  createMockRequest,
  getResponseJSON,
  TEST_USERS,
  TEST_TENANT,
  getTestDb,
  generateTestToken
} from './helpers/test-utils';

// Mock database connection to use test database
vi.mock('@/lib/db/connection', () => ({
  default: {
    prepare: (...args: any[]) => getTestDb().prepare(...args),
    exec: (...args: any[]) => getTestDb().exec(...args),
  }
}));

// Mock db import
vi.mock('@/lib/db', () => ({
  db: {
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

describe('Profile Routes', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(() => {
    cleanupTestDatabase();
  });

  beforeEach(() => {
    resetTestData();
  });

  describe('GET /api/auth/profile', () => {
    describe('Successful Profile Retrieval', () => {
      it('should get authenticated user profile', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const response = await profileGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data).toBeDefined();
        expect(data.id).toBe(TEST_USERS.user.id);
        expect(data.email).toBe(TEST_USERS.user.email);
        expect(data.name).toBe(TEST_USERS.user.name);
        expect(data.role).toBe(TEST_USERS.user.role);
      });

      it('should not expose sensitive fields', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const response = await profileGET(request);
        const data = await getResponseJSON(response);

        // Should NOT include password hash
        expect(data.password_hash).toBeUndefined();
        expect(data.password).toBeUndefined();
        expect(data.locked_until).toBeUndefined();
        expect(data.failed_login_attempts).toBeUndefined();
      });

      it('should work for all user roles', async () => {
        for (const userRole of Object.keys(TEST_USERS)) {
          const user = TEST_USERS[userRole as keyof typeof TEST_USERS];
          const token = await generateTestToken(user.id);

          const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          const response = await profileGET(request);
          const data = await getResponseJSON(response);

          expect(response.status).toBe(200);
          expect(data.role).toBe(user.role);
          expect(data.email).toBe(user.email);
        }
      });
    });

    describe('Authentication Requirement', () => {
      it('should reject request without token', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'GET'
        });

        const response = await profileGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(401);
        expect(data.message).toBe('Token não fornecido');
      });

      it('should reject request with invalid token', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        });

        const response = await profileGET(request);
        expect(response.status).toBeGreaterThanOrEqual(401);
      });
    });

    describe('Error Handling', () => {
      it('should return 404 if user not found', async () => {
        const { SignJWT } = await import('jose');
        const JWT_SECRET = new TextEncoder().encode('test-jwt-secret-minimum-32-characters-long-for-testing');

        // Create token for non-existent user
        const token = await new SignJWT({
          sub: '999999' // Non-existent user ID
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setExpirationTime('1h')
          .sign(JWT_SECRET);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const response = await profileGET(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(404);
        expect(data.message).toBe('Usuário não encontrado');
      });
    });
  });

  describe('PUT /api/auth/profile', () => {
    describe('Successful Profile Update', () => {
      it('should update user name', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: 'Updated Name',
            email: TEST_USERS.user.email
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data.name).toBe('Updated Name');

        // Verify in database
        const db = getTestDb();
        const user = db.prepare('SELECT name FROM users WHERE id = ?')
          .get(TEST_USERS.user.id) as any;

        expect(user.name).toBe('Updated Name');
      });

      it('should update user email', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: TEST_USERS.user.name,
            email: 'newemail@test.com'
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data.email).toBe('newemail@test.com');

        // Verify in database
        const db = getTestDb();
        const user = db.prepare('SELECT email FROM users WHERE id = ?')
          .get(TEST_USERS.user.id) as any;

        expect(user.email).toBe('newemail@test.com');
      });

      it('should update both name and email', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: 'Completely New Name',
            email: 'completelynew@test.com'
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(200);
        expect(data.name).toBe('Completely New Name');
        expect(data.email).toBe('completelynew@test.com');
      });

      it('should return updated user data', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: 'New Name',
            email: TEST_USERS.user.email
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(data).toBeDefined();
        expect(data.id).toBe(TEST_USERS.user.id);
        expect(data.role).toBe(TEST_USERS.user.role);
        expect(data.created_at).toBeDefined();
      });
    });

    describe('Validation', () => {
      it('should reject update without name', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            email: TEST_USERS.user.email
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(400);
        expect(data.message).toContain('obrigatórios');
      });

      it('should reject update without email', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: TEST_USERS.user.name
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(400);
        expect(data.message).toContain('obrigatórios');
      });

      it('should reject update with empty name', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: '',
            email: TEST_USERS.user.email
          }
        });

        const response = await profilePUT(request);
        expect(response.status).toBe(400);
      });

      it('should reject update with empty email', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: TEST_USERS.user.name,
            email: ''
          }
        });

        const response = await profilePUT(request);
        expect(response.status).toBe(400);
      });
    });

    describe('Email Uniqueness', () => {
      it('should reject email that belongs to another user', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: TEST_USERS.user.name,
            email: TEST_USERS.admin.email // Try to use admin's email
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(response.status).toBe(409); // 409 Conflict
        expect(data.message).toContain('já está em uso');
      });

      it('should allow keeping same email', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: 'New Name But Same Email',
            email: TEST_USERS.user.email // Same email
          }
        });

        const response = await profilePUT(request);
        expect(response.status).toBe(200);
      });
    });

    describe('XSS Prevention', () => {
      it('should sanitize name to prevent XSS', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: '<script>alert("xss")</script>Hacker',
            email: TEST_USERS.user.email
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        // Name should not contain script tags
        expect(data.name).not.toContain('<script>');
        expect(data.name).not.toContain('</script>');

        // Verify in database
        const db = getTestDb();
        const user = db.prepare('SELECT name FROM users WHERE id = ?')
          .get(TEST_USERS.user.id) as any;

        expect(user.name).not.toContain('<script>');
      });

      it('should sanitize email to prevent XSS', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: TEST_USERS.user.name,
            email: 'test@test.com<script>alert(1)</script>'
          }
        });

        const response = await profilePUT(request);

        // Should reject due to invalid email format
        // OR should sanitize and store without script tag
        if (response.status === 200) {
          const data = await getResponseJSON(response);
          expect(data.email).not.toContain('<script>');
        } else {
          // Rejected due to invalid format
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      });
    });

    describe('Authentication Requirement', () => {
      it('should reject update without token', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          body: {
            name: 'New Name',
            email: 'new@test.com'
          }
        });

        const response = await profilePUT(request);
        expect(response.status).toBe(401);
      });

      it('should reject update with invalid token', async () => {
        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer invalid-token'
          },
          body: {
            name: 'New Name',
            email: 'new@test.com'
          }
        });

        const response = await profilePUT(request);
        expect(response.status).toBeGreaterThanOrEqual(401);
      });
    });

    describe('Security Features', () => {
      it('should not allow updating other user profiles', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        // Try to update, but the route should only update the authenticated user
        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: 'Hacker Name',
            email: 'hacker@test.com'
          }
        });

        await profilePUT(request);

        // Verify admin user was NOT modified
        const db = getTestDb();
        const admin = db.prepare('SELECT name, email FROM users WHERE id = ?')
          .get(TEST_USERS.admin.id) as any;

        expect(admin.name).toBe(TEST_USERS.admin.name);
        expect(admin.email).toBe(TEST_USERS.admin.email);
      });

      it('should not expose password hash in response', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: 'Updated Name',
            email: TEST_USERS.user.email
          }
        });

        const response = await profilePUT(request);
        const data = await getResponseJSON(response);

        expect(data.password_hash).toBeUndefined();
        expect(data.password).toBeUndefined();
      });

      it('should not allow role escalation via profile update', async () => {
        const token = await generateTestToken(TEST_USERS.user.id);

        const request = await createMockRequest('http://localhost:3000/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            name: TEST_USERS.user.name,
            email: TEST_USERS.user.email,
            role: 'admin' // Try to escalate to admin
          }
        });

        await profilePUT(request);

        // Verify role was NOT changed
        const db = getTestDb();
        const user = db.prepare('SELECT role FROM users WHERE id = ?')
          .get(TEST_USERS.user.id) as any;

        expect(user.role).toBe('user'); // Should still be 'user'
      });
    });
  });
});
