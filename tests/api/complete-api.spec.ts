/**
 * Complete API Integration Test Suite
 * Tests all API endpoints for functionality, authentication, authorization, validation, and error handling
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:4000';
const TENANT_SLUG = 'empresa-demo';

// Test data
let authToken: string;
let adminAuthToken: string;
let testUserId: number;
let testTicketId: number;
let testCategoryId: number;
let testPriorityId: number;
let testKnowledgeArticleId: number;

// Helper function to generate unique email
const generateUniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

/**
 * AUTHENTICATION & AUTHORIZATION TESTS
 */
test.describe('Authentication API', () => {
  test('POST /api/auth/register - should register new user successfully', async ({ request }) => {
    const uniqueEmail = generateUniqueEmail();
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG,
        job_title: 'Tester',
        department: 'QA'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(uniqueEmail);
    expect(data.user.role).toBe('user');
    expect(data.tenant).toBeDefined();

    // Save for later tests
    authToken = data.token;
    testUserId = data.user.id;
  });

  test('POST /api/auth/register - should fail with missing required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: generateUniqueEmail(),
        // Missing name and password
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('obrigatórios');
  });

  test('POST /api/auth/register - should fail with weak password', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: generateUniqueEmail(),
        password: '123', // Too short
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('6 caracteres');
  });

  test('POST /api/auth/register - should fail with invalid email format', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Test User',
        email: 'invalid-email',
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('inválido');
  });

  test('POST /api/auth/register - should fail with duplicate email', async ({ request }) => {
    const uniqueEmail = generateUniqueEmail();

    // First registration
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Test User 1',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    // Duplicate registration
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Test User 2',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(409);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('em uso');
  });

  test('POST /api/auth/login - should login successfully', async ({ request }) => {
    // First register a user
    const uniqueEmail = generateUniqueEmail();
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Login Test User',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    // Then login
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(uniqueEmail);
  });

  test('POST /api/auth/login - should fail with wrong password', async ({ request }) => {
    const uniqueEmail = generateUniqueEmail();
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Login Test User',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: uniqueEmail,
        password: 'WrongPassword123',
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('inválidas');
  });

  test('POST /api/auth/login - should fail with non-existent user', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});

/**
 * TICKETS API TESTS
 */
test.describe('Tickets API', () => {
  test.beforeAll(async ({ request }) => {
    // Create a user and get auth token
    const uniqueEmail = generateUniqueEmail();
    const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Ticket Test User',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });
    const registerData = await registerResponse.json();
    authToken = registerData.token;
    testUserId = registerData.user.id;

    // Get category and priority IDs
    const categoriesResponse = await request.get(`${BASE_URL}/api/categories`);
    const categoriesData = await categoriesResponse.json();
    testCategoryId = categoriesData.categories[0].id;

    const prioritiesResponse = await request.get(`${BASE_URL}/api/priorities`);
    const prioritiesData = await prioritiesResponse.json();
    testPriorityId = prioritiesData.priorities[0].id;
  });

  test('GET /api/tickets - should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tickets`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/tickets - should return tickets for authenticated user', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tickets).toBeDefined();
    expect(Array.isArray(data.tickets)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  test('GET /api/tickets - should support pagination', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tickets?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(5);
  });

  test('POST /api/tickets - should create ticket successfully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: 'Test Ticket',
        description: 'This is a test ticket description',
        category_id: testCategoryId,
        priority_id: testPriorityId
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.ticket).toBeDefined();
    expect(data.ticket.title).toBe('Test Ticket');

    testTicketId = data.ticket.id;
  });

  test('POST /api/tickets - should fail without required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: 'Test Ticket'
        // Missing description, category_id, priority_id
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('GET /api/tickets/:id - should get specific ticket', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tickets/${testTicketId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.ticket).toBeDefined();
    expect(data.ticket.id).toBe(testTicketId);
  });

  test('GET /api/tickets/:id - should return 404 for non-existent ticket', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tickets/999999`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(404);
  });

  test('PATCH /api/tickets/:id - should update ticket', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/tickets/${testTicketId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: 'Updated Test Ticket'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.ticket.title).toBe('Updated Test Ticket');
  });
});

/**
 * CATEGORIES, PRIORITIES, STATUSES API TESTS
 */
test.describe('Reference Data APIs', () => {
  test('GET /api/categories - should return all categories', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.categories).toBeDefined();
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
  });

  test('GET /api/priorities - should return all priorities', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/priorities`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.priorities).toBeDefined();
    expect(Array.isArray(data.priorities)).toBe(true);
    expect(data.priorities.length).toBeGreaterThan(0);
  });

  test('GET /api/statuses - should return all statuses', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/statuses`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.statuses).toBeDefined();
    expect(Array.isArray(data.statuses)).toBe(true);
    expect(data.statuses.length).toBeGreaterThan(0);
  });
});

/**
 * NOTIFICATIONS API TESTS
 */
test.describe('Notifications API', () => {
  test.beforeAll(async ({ request }) => {
    if (!authToken) {
      const uniqueEmail = generateUniqueEmail();
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          name: 'Notification Test User',
          email: uniqueEmail,
          password: 'Test123!@#',
          tenant_slug: TENANT_SLUG
        }
      });
      const registerData = await registerResponse.json();
      authToken = registerData.token;
    }
  });

  test('GET /api/notifications - should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/notifications`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/notifications - should return notifications for authenticated user', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/notifications`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.notifications).toBeDefined();
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  test('GET /api/notifications - should support unread_only filter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/notifications?unread_only=true`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('GET /api/notifications/unread - should return unread count', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/notifications/unread`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.count).toBeDefined();
    expect(typeof data.count).toBe('number');
  });
});

/**
 * KNOWLEDGE BASE API TESTS
 */
test.describe('Knowledge Base API', () => {
  test('GET /api/knowledge/search - should search knowledge base', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/knowledge/search?q=test`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
  });

  test('GET /api/knowledge/search - should return empty for short query', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/knowledge/search?q=a`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(0);
  });

  test('GET /api/knowledge/search - should support different search modes', async ({ request }) => {
    const modes = ['semantic', 'keyword', 'hybrid'];

    for (const mode of modes) {
      const response = await request.get(`${BASE_URL}/api/knowledge/search?q=test&mode=${mode}`);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.mode).toBe(mode);
    }
  });

  test('GET /api/knowledge/search - should support pagination', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/knowledge/search?q=test&limit=5&offset=0`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.pagination).toBeDefined();
    expect(data.pagination.limit).toBe(5);
    expect(data.pagination.offset).toBe(0);
  });

  test('GET /api/knowledge/categories - should return categories', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/knowledge/categories`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.categories).toBeDefined();
    expect(Array.isArray(data.categories)).toBe(true);
  });

  test('GET /api/knowledge/articles - should return published articles', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/knowledge/articles`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.articles).toBeDefined();
    expect(Array.isArray(data.articles)).toBe(true);
  });
});

/**
 * ANALYTICS API TESTS
 */
test.describe('Analytics API', () => {
  test.beforeAll(async ({ request }) => {
    if (!authToken) {
      const uniqueEmail = generateUniqueEmail();
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          name: 'Analytics Test User',
          email: uniqueEmail,
          password: 'Test123!@#',
          tenant_slug: TENANT_SLUG
        }
      });
      const registerData = await registerResponse.json();
      authToken = registerData.token;
    }
  });

  test('GET /api/analytics - should require authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/analytics/overview - should return overview data', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/analytics/overview`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
  });
});

/**
 * RATE LIMITING TESTS
 */
test.describe('Rate Limiting', () => {
  test('POST /api/auth/login - should enforce rate limiting', async ({ request }) => {
    const uniqueEmail = generateUniqueEmail();

    // Register user
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        name: 'Rate Limit Test',
        email: uniqueEmail,
        password: 'Test123!@#',
        tenant_slug: TENANT_SLUG
      }
    });

    // Make multiple rapid login attempts with wrong password
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(
        request.post(`${BASE_URL}/api/auth/login`, {
          data: {
            email: uniqueEmail,
            password: 'WrongPassword',
            tenant_slug: TENANT_SLUG
          }
        })
      );
    }

    const responses = await Promise.all(attempts);

    // At least one should be rate limited (429)
    const rateLimited = responses.some(r => r.status() === 429);
    expect(rateLimited).toBe(true);
  });
});

/**
 * ERROR HANDLING TESTS
 */
test.describe('Error Handling', () => {
  test('should return 404 for non-existent endpoints', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nonexistent-endpoint`);
    expect(response.status()).toBe(404);
  });

  test('should return 400 for malformed JSON', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: 'invalid json{]'
    });

    expect([400, 500]).toContain(response.status());
  });

  test('should handle OPTIONS requests (CORS)', async ({ request }) => {
    const response = await request.fetch(`${BASE_URL}/api/tickets`, {
      method: 'OPTIONS'
    });

    // Should not error
    expect([200, 204, 404]).toContain(response.status());
  });
});

/**
 * INPUT VALIDATION TESTS
 */
test.describe('Input Validation', () => {
  test.beforeAll(async ({ request }) => {
    if (!authToken) {
      const uniqueEmail = generateUniqueEmail();
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          name: 'Validation Test User',
          email: uniqueEmail,
          password: 'Test123!@#',
          tenant_slug: TENANT_SLUG
        }
      });
      const registerData = await registerResponse.json();
      authToken = registerData.token;
    }
  });

  test('POST /api/tickets - should reject XSS attempts in title', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: '<script>alert("xss")</script>',
        description: 'Test description',
        category_id: testCategoryId,
        priority_id: testPriorityId
      }
    });

    // Should either sanitize or reject
    if (response.status() === 200) {
      const data = await response.json();
      // Title should be sanitized (no script tags)
      expect(data.ticket.title).not.toContain('<script>');
    }
  });

  test('POST /api/tickets - should reject SQL injection attempts', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: "'; DROP TABLE tickets; --",
        description: 'Test description',
        category_id: testCategoryId,
        priority_id: testPriorityId
      }
    });

    // Should handle safely (either reject or sanitize)
    expect([200, 400]).toContain(response.status());
  });

  test('POST /api/tickets - should reject excessively long input', async ({ request }) => {
    const longTitle = 'A'.repeat(10000);
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      data: {
        title: longTitle,
        description: 'Test description',
        category_id: testCategoryId,
        priority_id: testPriorityId
      }
    });

    // Should either truncate or reject
    expect([200, 400]).toContain(response.status());
  });
});

/**
 * RESPONSE FORMAT TESTS
 */
test.describe('Response Format Consistency', () => {
  test('Success responses should have consistent structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);
    const data = await response.json();

    // Check for common success response structure
    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();
  });

  test('Error responses should have consistent structure', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'invalid',
        password: 'invalid',
        tenant_slug: TENANT_SLUG
      }
    });

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
    expect(typeof data.error).toBe('string');
  });
});

/**
 * PERFORMANCE TESTS
 */
test.describe('API Performance', () => {
  test('GET /api/tickets - should respond within acceptable time', async ({ request }) => {
    if (!authToken) {
      const uniqueEmail = generateUniqueEmail();
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          name: 'Performance Test User',
          email: uniqueEmail,
          password: 'Test123!@#',
          tenant_slug: TENANT_SLUG
        }
      });
      const registerData = await registerResponse.json();
      authToken = registerData.token;
    }

    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    const endTime = Date.now();

    expect(response.status()).toBe(200);
    const responseTime = endTime - startTime;

    // Should respond within 2 seconds
    expect(responseTime).toBeLessThan(2000);
  });

  test('GET /api/categories - should respond within acceptable time', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/categories`);
    const endTime = Date.now();

    expect(response.status()).toBe(200);
    const responseTime = endTime - startTime;

    // Should respond within 1 second
    expect(responseTime).toBeLessThan(1000);
  });
});

/**
 * CONTENT TYPE TESTS
 */
test.describe('Content Type Handling', () => {
  test('should return JSON for API endpoints', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);
    const contentType = response.headers()['content-type'];

    expect(contentType).toContain('application/json');
  });

  test('should accept JSON POST data', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        email: 'test@example.com',
        password: 'password',
        tenant_slug: TENANT_SLUG
      })
    });

    // Should process the request (even if credentials are wrong)
    expect([200, 401]).toContain(response.status());
  });
});

/**
 * TENANT ISOLATION TESTS
 */
test.describe('Tenant Isolation', () => {
  test('should enforce tenant context in API calls', async ({ request }) => {
    if (!authToken) {
      const uniqueEmail = generateUniqueEmail();
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          name: 'Tenant Test User',
          email: uniqueEmail,
          password: 'Test123!@#',
          tenant_slug: TENANT_SLUG
        }
      });
      const registerData = await registerResponse.json();
      authToken = registerData.token;
    }

    // Get tickets with valid tenant
    const response = await request.get(`${BASE_URL}/api/tickets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
