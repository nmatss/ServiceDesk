/**
 * Comprehensive Security & Compliance Test Suite
 *
 * This suite provides exhaustive security testing covering:
 * - OWASP Top 10 vulnerabilities
 * - LGPD/GDPR compliance features
 * - Authentication & Authorization
 * - Session Management
 * - Rate Limiting
 * - Input Validation & Sanitization
 * - Encryption
 * - Audit Logging
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const TEST_TENANT = 'empresa-demo';

// Test data
const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!@#',
    role: 'admin'
  },
  user: {
    email: 'user@example.com',
    password: 'User123!@#',
    role: 'user'
  },
  agent: {
    email: 'agent@example.com',
    password: 'Agent123!@#',
    role: 'agent'
  }
};

// ====================================================================================
// AUTHENTICATION & SESSION MANAGEMENT TESTS
// ====================================================================================

test.describe('Authentication Security', () => {
  test('should enforce password complexity requirements', async ({ request }) => {
    const weakPasswords = [
      'weak',              // Too short
      'password',          // No numbers, no uppercase, no special chars
      'Password1',         // No special chars
      'PASSWORD123!',      // No lowercase
      'password123!',      // No uppercase
      '12345678',          // No letters
    ];

    for (const password of weakPasswords) {
      const response = await request.post('/api/auth/register', {
        data: {
          name: 'Test User',
          email: `test${Math.random()}@example.com`,
          password,
          tenant_slug: TEST_TENANT
        }
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error || body.message).toBeTruthy();
    }
  });

  test('should accept strong passwords', async ({ request }) => {
    const strongPassword = 'SecureP@ssw0rd123!';
    const email = `strongpass${Date.now()}@example.com`;

    const response = await request.post('/api/auth/register', {
      data: {
        name: 'Strong Pass User',
        email,
        password: strongPassword,
        tenant_slug: TEST_TENANT
      }
    });

    // Should succeed or fail for reasons other than password strength
    expect([200, 201, 409]).toContain(response.status());
  });

  test('should rate limit login attempts', async ({ request }) => {
    const attempts = [];
    const maxAttempts = 10;

    // Make multiple failed login attempts
    for (let i = 0; i < maxAttempts; i++) {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
          tenant_slug: TEST_TENANT
        }
      });
      attempts.push(response.status());
    }

    // Should eventually hit rate limit (429)
    const rateLimited = attempts.some(status => status === 429);
    expect(rateLimited).toBe(true);
  });

  test('should invalidate JWT tokens on logout', async ({ request }) => {
    // Login
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Verify token works
    const verifyResponse = await request.get('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(verifyResponse.status()).toBe(200);

    // Logout
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    await request.post('/api/auth/logout', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || ''
      }
    });

    // Token should no longer work
    const afterLogoutResponse = await request.get('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(afterLogoutResponse.status()).toBe(401);
  });

  test('should enforce session timeout', async ({ request }) => {
    // This test would require waiting for session timeout
    // Skipping in automated tests but documenting the requirement
    test.skip();
  });

  test('should prevent password reuse', async ({ request }) => {
    // Register new user with initial password
    const email = `noreuse${Date.now()}@example.com`;
    const password1 = 'InitialP@ss123!';

    const registerResponse = await request.post('/api/auth/register', {
      data: {
        name: 'No Reuse User',
        email,
        password: password1,
        tenant_slug: TEST_TENANT
      }
    });

    if (![200, 201].includes(registerResponse.status())) {
      test.skip();
      return;
    }

    // Login
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email,
        password: password1,
        tenant_slug: TEST_TENANT
      }
    });

    const { token } = await loginResponse.json();
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    // Try to change to new password then back to original
    const password2 = 'NewP@ssword456!';

    // Change to new password
    await request.put('/api/auth/change-password', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || ''
      },
      data: {
        currentPassword: password1,
        newPassword: password2
      }
    });

    // Try to change back to original password
    const revertResponse = await request.put('/api/auth/change-password', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || ''
      },
      data: {
        currentPassword: password2,
        newPassword: password1
      }
    });

    // Should reject password reuse
    expect(revertResponse.status()).toBe(400);
  });
});

// ====================================================================================
// AUTHORIZATION & ACCESS CONTROL TESTS
// ====================================================================================

test.describe('Authorization & Access Control', () => {
  test('should enforce role-based access control (RBAC)', async ({ request }) => {
    // Login as regular user
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try to access admin-only endpoints
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/teams',
      '/api/admin/settings',
      '/api/analytics'
    ];

    for (const endpoint of adminEndpoints) {
      const response = await request.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Should be forbidden for non-admin users
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should prevent horizontal privilege escalation', async ({ request }) => {
    // Login as user1
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token, user } = await loginResponse.json();

    // Try to access another user's data
    const otherUserId = user.id + 1;
    const response = await request.get(`/api/users/${otherUserId}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Should be forbidden
    expect([401, 403, 404]).toContain(response.status());
  });

  test('should enforce tenant isolation', async ({ request }) => {
    // This test verifies that users from one tenant cannot access data from another
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try to access data with different tenant ID in headers
    const response = await request.get('/api/tickets', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': '999',  // Different tenant
        'x-tenant-slug': 'other-tenant'
      }
    });

    // Should only see data from user's own tenant
    if (response.status() === 200) {
      const body = await response.json();
      // Verify tenant isolation in response
      if (Array.isArray(body.tickets)) {
        body.tickets.forEach((ticket: any) => {
          expect(ticket.organization_id).not.toBe(999);
        });
      }
    }
  });
});

// ====================================================================================
// XSS (Cross-Site Scripting) PROTECTION TESTS
// ====================================================================================

test.describe('XSS Protection', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg/onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '<input onfocus=alert("XSS") autofocus>',
    '<select onfocus=alert("XSS") autofocus>',
    '<textarea onfocus=alert("XSS") autofocus>',
    '<marquee onstart=alert("XSS")>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<img src=`javascript:alert("XSS")`>',
  ];

  test('should sanitize user inputs in ticket creation', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    for (const payload of xssPayloads) {
      const response = await request.post('/api/tickets/create', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-csrf-token': csrfToken || ''
        },
        data: {
          title: payload,
          description: payload,
          category_id: 1,
          priority_id: 1
        }
      });

      // Should accept or reject, but not cause XSS
      expect(response.status()).not.toBe(500);

      if (response.status() === 200 || response.status() === 201) {
        const body = await response.json();
        // Verify XSS payload was sanitized
        if (body.ticket) {
          expect(body.ticket.title).not.toContain('<script>');
          expect(body.ticket.description).not.toContain('<script>');
        }
      }
    }
  });

  test('should set proper Content-Security-Policy headers', async ({ request }) => {
    const response = await request.get('/api/health');
    const csp = response.headers()['content-security-policy'];

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
  });

  test('should set X-Content-Type-Options header', async ({ request }) => {
    const response = await request.get('/api/health');
    const xContentType = response.headers()['x-content-type-options'];

    expect(xContentType).toBe('nosniff');
  });

  test('should set X-Frame-Options header', async ({ request }) => {
    const response = await request.get('/api/health');
    const xFrameOptions = response.headers()['x-frame-options'];

    expect(xFrameOptions).toBeTruthy();
    expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions);
  });
});

// ====================================================================================
// CSRF PROTECTION TESTS (Extended)
// ====================================================================================

test.describe('CSRF Protection - Extended', () => {
  test('should rotate CSRF tokens', async ({ request }) => {
    // Get first token
    const response1 = await request.get('/api/health');
    const token1 = response1.headers()['x-csrf-token'];

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get second token
    const response2 = await request.get('/api/health');
    const token2 = response2.headers()['x-csrf-token'];

    // Tokens should be different (rotated)
    expect(token1).not.toBe(token2);
  });

  test('should validate CSRF token format', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try various malformed CSRF tokens
    const malformedTokens = [
      '',
      'a',
      '12345',
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      null,
      undefined
    ];

    for (const csrfToken of malformedTokens) {
      const response = await request.post('/api/tickets/create', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-csrf-token': csrfToken as string
        },
        data: {
          title: 'Test',
          description: 'Test',
          category_id: 1,
          priority_id: 1
        }
      });

      expect(response.status()).toBe(403);
    }
  });
});

// ====================================================================================
// SQL INJECTION PROTECTION TESTS (Extended)
// ====================================================================================

test.describe('SQL Injection Protection - Extended', () => {
  const advancedSqlPayloads = [
    // Boolean-based blind
    "1' AND '1'='1' --",
    "1' AND '1'='2' --",

    // Time-based blind
    "1' AND SLEEP(5) --",
    "1'; WAITFOR DELAY '00:00:05' --",

    // Union-based
    "' UNION SELECT NULL, NULL, NULL --",
    "1' UNION ALL SELECT NULL,NULL,NULL,NULL,NULL --",

    // Stacked queries
    "1'; DELETE FROM users; --",
    "1'; INSERT INTO users VALUES ('hacker', 'hacked'); --",

    // Error-based
    "1' AND 1=CONVERT(int, (SELECT @@version)) --",
    "1' AND extractvalue(1, concat(0x7e, version())) --",

    // Second-order injection
    "admin'||'",
    "admin' + '",
  ];

  test('should protect against advanced SQL injection techniques', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    for (const payload of advancedSqlPayloads) {
      const response = await request.get(
        `/api/knowledge/search?q=${encodeURIComponent(payload)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Should not cause SQL error (500) or expose database structure
      expect(response.status()).not.toBe(500);
    }
  });

  test('should use parameterized queries for LIKE operations', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Special characters in LIKE queries
    const likePayloads = [
      '%',
      '_',
      '%%',
      '\\%',
      '\\_',
      '%_',
      "_%' OR '1'='1"
    ];

    for (const payload of likePayloads) {
      const response = await request.get(
        `/api/tickets?search=${encodeURIComponent(payload)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      expect(response.status()).not.toBe(500);
    }
  });
});

// ====================================================================================
// RATE LIMITING TESTS
// ====================================================================================

test.describe('Rate Limiting', () => {
  test('should rate limit API endpoints', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Make rapid requests to trigger rate limit
    const requests = [];
    for (let i = 0; i < 150; i++) {
      requests.push(
        request.get('/api/tickets', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      );
    }

    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());

    // Should include 429 (Too Many Requests)
    expect(statusCodes).toContain(429);

    // Check for rate limit headers
    const rateLimitedResponse = responses.find(r => r.status() === 429);
    if (rateLimitedResponse) {
      const headers = rateLimitedResponse.headers();
      expect(headers['x-ratelimit-limit']).toBeTruthy();
      expect(headers['x-ratelimit-remaining']).toBeTruthy();
      expect(headers['retry-after']).toBeTruthy();
    }
  });

  test('should have different rate limits for different user roles', async ({ request }) => {
    // Test that admin users have higher rate limits than regular users
    test.skip(); // Implementation-dependent
  });
});

// ====================================================================================
// SESSION SECURITY TESTS
// ====================================================================================

test.describe('Session Security', () => {
  test('should prevent session fixation attacks', async ({ request }) => {
    // Get session before login
    const preLoginResponse = await request.get('/api/health');
    const preLoginCookies = preLoginResponse.headers()['set-cookie'];

    // Login
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const postLoginCookies = loginResponse.headers()['set-cookie'];

    // Session ID should change after login
    expect(preLoginCookies).not.toBe(postLoginCookies);
  });

  test('should set secure cookie flags', async ({ request }) => {
    const response = await request.get('/api/health');
    const cookies = response.headers()['set-cookie'];

    if (cookies) {
      const cookieString = cookies.toString();

      // Check for security flags
      if (process.env.NODE_ENV === 'production') {
        expect(cookieString).toContain('Secure');
      }
      expect(cookieString).toContain('HttpOnly');
      expect(cookieString).toContain('SameSite');
    }
  });

  test('should track concurrent sessions', async ({ request }) => {
    // Login from "two different devices"
    const login1 = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
      }
    });

    const login2 = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) Safari/604.1'
      }
    });

    if (login1.status() !== 200 || login2.status() !== 200) {
      test.skip();
      return;
    }

    const { token: token1 } = await login1.json();
    const { token: token2 } = await login2.json();

    // Both tokens should be valid
    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();
    expect(token1).not.toBe(token2);
  });
});

// ====================================================================================
// INPUT VALIDATION & SANITIZATION TESTS
// ====================================================================================

test.describe('Input Validation & Sanitization', () => {
  test('should validate email addresses', async ({ request }) => {
    const invalidEmails = [
      'notanemail',
      '@nodomain.com',
      'user@',
      'user@domain',
      'user..name@domain.com',
      'user@domain..com',
    ];

    for (const email of invalidEmails) {
      const response = await request.post('/api/auth/register', {
        data: {
          name: 'Test User',
          email,
          password: 'ValidP@ss123!',
          tenant_slug: TEST_TENANT
        }
      });

      expect(response.status()).toBe(400);
    }
  });

  test('should validate and sanitize file uploads', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    // Try to upload potentially dangerous files
    const dangerousExtensions = [
      'shell.php',
      'malware.exe',
      'virus.bat',
      'script.js.exe',
      'image.php.jpg'
    ];

    for (const filename of dangerousExtensions) {
      const response = await request.post('/api/attachments/upload', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-csrf-token': csrfToken || ''
        },
        multipart: {
          file: {
            name: filename,
            mimeType: 'application/octet-stream',
            buffer: Buffer.from('<?php system($_GET["cmd"]); ?>')
          }
        }
      });

      // Should reject dangerous files
      expect([400, 403, 415]).toContain(response.status());
    }
  });

  test('should enforce maximum input lengths', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    // Try to submit extremely long inputs
    const veryLongString = 'A'.repeat(10000);

    const response = await request.post('/api/tickets/create', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || ''
      },
      data: {
        title: veryLongString,
        description: veryLongString,
        category_id: 1,
        priority_id: 1
      }
    });

    // Should reject or truncate
    expect([400, 413]).toContain(response.status());
  });
});

// ====================================================================================
// ENCRYPTION & DATA PROTECTION TESTS
// ====================================================================================

test.describe('Encryption & Data Protection', () => {
  test('should enforce HTTPS in production', async ({ request }) => {
    if (process.env.NODE_ENV !== 'production') {
      test.skip();
      return;
    }

    const response = await request.get('/api/health', {
      headers: {
        'X-Forwarded-Proto': 'http'
      }
    });

    // Should redirect to HTTPS or reject
    expect([301, 302, 403]).toContain(response.status());
  });

  test('should set HSTS headers', async ({ request }) => {
    const response = await request.get('/api/health');
    const hsts = response.headers()['strict-transport-security'];

    if (process.env.NODE_ENV === 'production') {
      expect(hsts).toBeTruthy();
      expect(hsts).toContain('max-age');
    }
  });

  test('should not expose sensitive data in responses', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const body = await loginResponse.json();

    // Should not include password or password hash
    expect(body.user?.password).toBeUndefined();
    expect(body.user?.password_hash).toBeUndefined();
    expect(body.user?.two_factor_secret).toBeUndefined();
  });

  test('should encrypt sensitive fields in database', async ({ request }) => {
    // This test would require direct database access
    // Documenting the requirement
    test.skip();
  });
});

// ====================================================================================
// AUDIT LOGGING TESTS
// ====================================================================================

test.describe('Audit Logging', () => {
  test('should log authentication attempts', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: 'WrongPassword123!',
        tenant_slug: TEST_TENANT
      }
    });

    // Login attempt should be logged (verification requires database access)
    // This test documents the requirement
    test.skip();
  });

  test('should log data access', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    await request.get('/api/tickets', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Data access should be logged
    test.skip();
  });

  test('should log security events', async ({ request }) => {
    // Try malicious input
    await request.post('/api/auth/login', {
      data: {
        email: "'; DROP TABLE users; --",
        password: "' OR '1'='1",
        tenant_slug: TEST_TENANT
      }
    });

    // Security event should be logged
    test.skip();
  });
});

// ====================================================================================
// LGPD/GDPR COMPLIANCE TESTS
// ====================================================================================

test.describe('LGPD/GDPR Compliance', () => {
  test('should support data export (right to portability)', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    const response = await request.post('/api/user/data-export', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || ''
      }
    });

    expect([200, 202]).toContain(response.status());
  });

  test('should support data deletion (right to erasure)', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();
    const csrfResponse = await request.get('/api/health');
    const csrfToken = csrfResponse.headers()['x-csrf-token'];

    const response = await request.post('/api/user/delete-account', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken || ''
      },
      data: {
        confirmation: true,
        reason: 'privacy_concerns'
      }
    });

    expect([200, 202, 404]).toContain(response.status());
  });

  test('should track consent for data processing', async ({ request }) => {
    const response = await request.get('/api/privacy/consent-status', {
      headers: {
        Authorization: 'Bearer valid-token-here'
      }
    });

    // Should return consent status
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.consents).toBeDefined();
    }
  });

  test('should provide privacy policy and terms', async ({ request }) => {
    const response = await request.get('/api/legal/privacy-policy');
    expect(response.status()).toBe(200);

    const termsResponse = await request.get('/api/legal/terms');
    expect(termsResponse.status()).toBe(200);
  });
});

// ====================================================================================
// ERROR HANDLING & INFORMATION DISCLOSURE TESTS
// ====================================================================================

test.describe('Error Handling & Information Disclosure', () => {
  test('should not expose stack traces in production', async ({ request }) => {
    // Trigger an error
    const response = await request.get('/api/nonexistent-endpoint');

    const body = await response.text();

    // Should not include stack traces or internal paths
    expect(body).not.toContain('at Object');
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('/home/');
    expect(body).not.toContain('C:\\');
  });

  test('should not expose database errors', async ({ request }) => {
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: TEST_USERS.user.email,
        password: TEST_USERS.user.password,
        tenant_slug: TEST_TENANT
      }
    });

    if (loginResponse.status() !== 200) {
      test.skip();
      return;
    }

    const { token } = await loginResponse.json();

    // Try to trigger a database error
    const response = await request.get('/api/tickets/999999999', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const body = await response.text();

    // Should not expose SQL errors or database structure
    expect(body.toLowerCase()).not.toContain('sqlite');
    expect(body.toLowerCase()).not.toContain('sql syntax');
    expect(body.toLowerCase()).not.toContain('table');
    expect(body.toLowerCase()).not.toContain('column');
  });

  test('should use generic error messages', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'nonexistent@example.com',
        password: 'password',
        tenant_slug: TEST_TENANT
      }
    });

    const body = await response.json();

    // Should not reveal whether email exists
    expect(body.error || body.message).not.toContain('does not exist');
    expect(body.error || body.message).not.toContain('not found');
  });
});

// ====================================================================================
// SECURITY HEADERS COMPREHENSIVE TESTS
// ====================================================================================

test.describe('Security Headers - Comprehensive', () => {
  test('should set all required security headers', async ({ request }) => {
    const response = await request.get('/api/health');
    const headers = response.headers();

    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'content-security-policy',
      'referrer-policy',
      'permissions-policy'
    ];

    for (const header of requiredHeaders) {
      expect(headers[header]).toBeTruthy();
    }
  });

  test('should set Permissions-Policy header', async ({ request }) => {
    const response = await request.get('/api/health');
    const permissionsPolicy = response.headers()['permissions-policy'];

    expect(permissionsPolicy).toBeTruthy();
    expect(permissionsPolicy).toContain('camera=()');
    expect(permissionsPolicy).toContain('microphone=()');
  });

  test('should set Referrer-Policy header', async ({ request }) => {
    const response = await request.get('/api/health');
    const referrerPolicy = response.headers()['referrer-policy'];

    expect(referrerPolicy).toBeTruthy();
    expect(['strict-origin-when-cross-origin', 'no-referrer']).toContain(referrerPolicy);
  });
});
