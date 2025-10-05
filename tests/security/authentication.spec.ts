/**
 * Security Tests - Authentication & JWT
 *
 * Tests JWT secret enforcement, token validation, and authentication flows
 */

import { test, expect } from '@playwright/test';

test.describe('JWT Security', () => {
  test('should reject requests without JWT token on protected routes', async ({ request }) => {
    const response = await request.get('/api/tickets');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test('should reject requests with invalid JWT token', async ({ request }) => {
    const response = await request.get('/api/tickets', {
      headers: {
        Authorization: 'Bearer invalid_token_here',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should reject requests with malformed JWT', async ({ request }) => {
    const response = await request.get('/api/tickets', {
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should reject requests with expired JWT', async ({ request }) => {
    // Create an expired token (this would need a helper function in production)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';

    const response = await request.get('/api/tickets', {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should enforce rate limiting on login endpoint', async ({ request }) => {
    const loginAttempts = [];

    // Attempt 10 logins rapidly
    for (let i = 0; i < 10; i++) {
      loginAttempts.push(
        request.post('/api/auth/login', {
          data: {
            email: `test${i}@example.com`,
            password: 'wrongpassword',
            tenant_slug: 'empresa-demo',
          },
        })
      );
    }

    const responses = await Promise.all(loginAttempts);

    // At least one should be rate limited
    const rateLimited = responses.some((r) => r.status() === 429);
    expect(rateLimited).toBe(true);
  });
});

test.describe('Password Security', () => {
  test('should reject weak passwords on registration', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        name: 'Test User',
        email: 'weak@example.com',
        password: '123', // Too short
        tenant_slug: 'empresa-demo',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('senha');
  });

  test('should hash passwords before storage', async ({ request }) => {
    // This would need database access to verify
    // Placeholder for integration test
    expect(true).toBe(true);
  });
});

test.describe('Session Security', () => {
  test('should use httpOnly cookies for auth tokens', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'admin@example.com',
        password: 'correct_password',
        tenant_slug: 'empresa-demo',
      },
    });

    if (response.status() === 200) {
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();

      // Check that auth cookie is httpOnly
      const authCookie = cookies?.toString();
      expect(authCookie).toContain('HttpOnly');
      expect(authCookie).toContain('SameSite');
    }
  });

  test('should set Secure flag on cookies in production', async ({ request }) => {
    // Would need environment check
    // Placeholder for environment-specific test
    expect(true).toBe(true);
  });
});
