/**
 * Security Tests - CSRF Protection
 *
 * Tests CSRF token validation and protection mechanisms
 */

import { test, expect } from '@playwright/test';

test.describe('CSRF Protection', () => {
  test('should reject POST requests without CSRF token', async ({ request }) => {
    // First login to get auth token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
        tenant_slug: 'empresa-demo',
      },
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try to make a POST request without CSRF token
    const response = await request.post('/api/tickets/create', {
      headers: {
        Authorization: `Bearer ${token}`,
        // Missing x-csrf-token header
      },
      data: {
        title: 'Test Ticket',
        description: 'Test Description',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });

  test('should reject POST requests with invalid CSRF token', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
        tenant_slug: 'empresa-demo',
      },
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try with invalid CSRF token
    const response = await request.post('/api/tickets/create', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': 'invalid_token',
      },
      data: {
        title: 'Test Ticket',
        description: 'Test Description',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });

  test('should accept GET requests without CSRF token', async ({ request }) => {
    // GET requests should not require CSRF tokens
    const response = await request.get('/api/categories');

    // Should not be blocked by CSRF (may fail auth, but not CSRF)
    expect(response.status()).not.toBe(403);
  });

  test('should set CSRF token in response headers', async ({ request }) => {
    const response = await request.get('/api/health');

    const csrfToken = response.headers()['x-csrf-token'];
    expect(csrfToken).toBeTruthy();
    expect(csrfToken?.length).toBeGreaterThan(20); // Should be a substantial token
  });

  test('should set CSRF token in cookies', async ({ request }) => {
    const response = await request.get('/api/health');

    const cookies = response.headers()['set-cookie'];
    expect(cookies).toBeTruthy();

    const csrfCookie = cookies?.toString();
    expect(csrfCookie).toContain('csrf_token');
  });

  test('should validate CSRF token matches between cookie and header', async ({ request }) => {
    // Get CSRF token from initial request
    const initialResponse = await request.get('/api/health');
    const csrfToken = initialResponse.headers()['x-csrf-token'];

    if (!csrfToken) {
      test.skip();
      return;
    }

    // Login with valid credentials
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
        tenant_slug: 'empresa-demo',
      },
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Make request with mismatched CSRF tokens
    const response = await request.post('/api/tickets/create', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': 'different_token',
        Cookie: `csrf_token=${csrfToken}`,
      },
      data: {
        title: 'Test Ticket',
        description: 'Test Description',
      },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('CSRF Edge Cases', () => {
  test('should allow login without CSRF token (public endpoint)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
        tenant_slug: 'empresa-demo',
      },
    });

    // Should not be blocked by CSRF (may fail auth for other reasons)
    expect(response.status()).not.toBe(403);
  });

  test('should allow registration without CSRF token (public endpoint)', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        tenant_slug: 'empresa-demo',
      },
    });

    // Should not be blocked by CSRF
    expect(response.status()).not.toBe(403);
  });

  test('should reject PUT requests without CSRF token', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
        tenant_slug: 'empresa-demo',
      },
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    const response = await request.put('/api/tickets/1', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        title: 'Updated Title',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });

  test('should reject DELETE requests without CSRF token', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpassword',
        tenant_slug: 'empresa-demo',
      },
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    const response = await request.delete('/api/tickets/1', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });
});
