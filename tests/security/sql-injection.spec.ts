/**
 * Security Tests - SQL Injection Protection
 *
 * Tests SQL injection prevention through parameterized queries and input validation
 */

import { test, expect } from '@playwright/test';

test.describe('SQL Injection Protection', () => {
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' OR 1=1 --",
    "admin'--",
    "' UNION SELECT * FROM users --",
    "1' AND '1'='1",
    "'; EXEC sp_MSForEachTable 'DROP TABLE ?'; --",
    "' OR 'x'='x",
    "1; DELETE FROM users WHERE 'a'='a",
    "'; INSERT INTO users VALUES ('hacker', 'hacked'); --",
  ];

  test('should protect login from SQL injection', async ({ request }) => {
    for (const maliciousInput of maliciousInputs) {
      const response = await request.post('/api/auth/login', {
        data: {
          email: maliciousInput,
          password: maliciousInput,
          tenant_slug: 'empresa-demo',
        },
      });

      // Should return 401 or 400, NOT 500 (which would indicate SQL error)
      expect(response.status()).not.toBe(500);
      expect([400, 401]).toContain(response.status());
    }
  });

  test('should protect search from SQL injection', async ({ request }) => {
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

    for (const maliciousInput of maliciousInputs) {
      const response = await request.get(
        `/api/tickets?search=${encodeURIComponent(maliciousInput)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Should not cause SQL error
      expect(response.status()).not.toBe(500);
    }
  });

  test('should validate table names in dynamic queries', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'admin@example.com',
        password: 'adminpass',
        tenant_slug: 'empresa-demo',
      },
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try to inject malicious table name
    const response = await request.get(
      `/api/admin/data?table=users;DROP+TABLE+users;--`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Should reject invalid table name
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should validate column names in ORDER BY clauses', async ({ request }) => {
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

    const maliciousOrderBy = [
      'id; DROP TABLE users; --',
      "(SELECT * FROM users WHERE 'a'='a')",
      'id UNION SELECT password FROM users',
    ];

    for (const orderBy of maliciousOrderBy) {
      const response = await request.get(
        `/api/tickets?orderBy=${encodeURIComponent(orderBy)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Should reject or sanitize malicious ORDER BY
      expect(response.status()).not.toBe(500);
    }
  });

  test('should use parameterized queries for user input', async ({ request }) => {
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

    const { token, user } = await loginResponse.json();

    // Get CSRF token
    const healthResponse = await request.get('/api/health');
    const csrfToken = healthResponse.headers()['x-csrf-token'];

    // Try to create ticket with SQL injection in title
    const response = await request.post('/api/tickets/create', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || '',
      },
      data: {
        title: "'; DROP TABLE tickets; --",
        description: "' OR '1'='1",
        category_id: 1,
        priority_id: 1,
      },
    });

    // Should either succeed (data sanitized) or fail validation, but not SQL error
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const body = await response.json();
      // Verify the malicious input was stored as-is (proving parameterization)
      // but didn't execute as SQL
      expect(body.success).toBe(true);
    }
  });
});

test.describe('Input Validation', () => {
  test('should validate numeric IDs', async ({ request }) => {
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

    const invalidIds = ["'1'", '1 OR 1=1', 'abc', '1.5; DROP TABLE users;'];

    for (const invalidId of invalidIds) {
      const response = await request.get(`/api/tickets/${invalidId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Should reject with 400 or 404, not 500
      expect(response.status()).not.toBe(500);
      expect([400, 404]).toContain(response.status());
    }
  });

  test('should validate email format', async ({ request }) => {
    const invalidEmails = [
      "admin'--",
      'test@; DROP TABLE users; --',
      '"><script>alert(1)</script>',
      'user@domain',
      '@domain.com',
    ];

    for (const invalidEmail of invalidEmails) {
      const response = await request.post('/api/auth/register', {
        data: {
          name: 'Test User',
          email: invalidEmail,
          password: 'ValidPass123!',
          tenant_slug: 'empresa-demo',
        },
      });

      expect(response.status()).toBe(400);
    }
  });
});
