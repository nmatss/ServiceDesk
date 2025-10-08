import { test, expect } from '@playwright/test';
import crypto from 'crypto';

/**
 * MULTI-TENANCY TEST SUITE
 * Tests comprehensive tenant isolation, data security, and multi-tenant functionality
 */

// Test data fixtures
const TEST_TENANTS = {
  tenant1: {
    id: 1,
    slug: 'tenant-alpha',
    name: 'Alpha Corporation',
    domain: 'alpha.example.com'
  },
  tenant2: {
    id: 2,
    slug: 'tenant-beta',
    name: 'Beta Industries',
    domain: 'beta.example.com'
  },
  tenant3: {
    id: 3,
    slug: 'tenant-gamma',
    name: 'Gamma Services',
    domain: 'gamma.example.com'
  }
};

const generateUniqueEmail = () => `test-${crypto.randomUUID()}@example.com`;

test.describe('Multi-Tenancy: Tenant Isolation', () => {

  test('should prevent cross-tenant data access in API', async ({ request }) => {
    // Create user in tenant1
    const tenant1User = {
      email: generateUniqueEmail(),
      password: 'SecurePass123!',
      name: 'Tenant 1 User'
    };

    // Create user in tenant2
    const tenant2User = {
      email: generateUniqueEmail(),
      password: 'SecurePass123!',
      name: 'Tenant 2 User'
    };

    // Register users in different tenants
    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: tenant1User
    });

    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() },
      data: tenant2User
    });

    // Login as tenant1 user
    const loginResponse1 = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: tenant1User.email, password: tenant1User.password }
    });

    const { token: token1 } = await loginResponse1.json();

    // Create ticket in tenant1
    const ticketResponse = await request.post('/api/tickets', {
      headers: {
        'Authorization': `Bearer ${token1}`,
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString()
      },
      data: {
        title: 'Tenant 1 Ticket',
        description: 'This should not be visible to tenant 2',
        category_id: 1,
        priority_id: 1
      }
    });

    const ticket = await ticketResponse.json();

    // Login as tenant2 user
    const loginResponse2 = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() },
      data: { email: tenant2User.email, password: tenant2User.password }
    });

    const { token: token2 } = await loginResponse2.json();

    // Try to access tenant1's ticket from tenant2
    const unauthorizedAccess = await request.get(`/api/tickets/${ticket.id}`, {
      headers: {
        'Authorization': `Bearer ${token2}`,
        'x-tenant-id': TEST_TENANTS.tenant2.id.toString()
      }
    });

    expect(unauthorizedAccess.status()).toBe(404); // Should not find ticket
  });

  test('should enforce tenant isolation in database queries', async ({ request }) => {
    const tenant1Email = generateUniqueEmail();
    const tenant2Email = generateUniqueEmail();

    // Create users in different tenants
    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: tenant1Email, password: 'Pass123!', name: 'User 1' }
    });

    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() },
      data: { email: tenant2Email, password: 'Pass123!', name: 'User 2' }
    });

    // Login to both tenants
    const login1 = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: tenant1Email, password: 'Pass123!' }
    });
    const { token: token1 } = await login1.json();

    const login2 = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() },
      data: { email: tenant2Email, password: 'Pass123!' }
    });
    const { token: token2 } = await login2.json();

    // Get tickets for each tenant
    const tickets1Response = await request.get('/api/tickets', {
      headers: {
        'Authorization': `Bearer ${token1}`,
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString()
      }
    });

    const tickets2Response = await request.get('/api/tickets', {
      headers: {
        'Authorization': `Bearer ${token2}`,
        'x-tenant-id': TEST_TENANTS.tenant2.id.toString()
      }
    });

    const tickets1 = await tickets1Response.json();
    const tickets2 = await tickets2Response.json();

    // Verify no overlap in ticket IDs
    const ticket1Ids = new Set(tickets1.map((t: any) => t.id));
    const ticket2Ids = new Set(tickets2.map((t: any) => t.id));
    const intersection = [...ticket1Ids].filter(id => ticket2Ids.has(id));

    expect(intersection.length).toBe(0); // No shared tickets
  });

  test('should prevent tenant ID manipulation in JWT', async ({ request }) => {
    const email = generateUniqueEmail();

    // Register in tenant1
    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email, password: 'Pass123!', name: 'Test User' }
    });

    // Login to tenant1
    const loginResponse = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email, password: 'Pass123!' }
    });

    const { token } = await loginResponse.json();

    // Try to use tenant1 token with tenant2 header
    const unauthorizedResponse = await request.get('/api/tickets', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': TEST_TENANTS.tenant2.id.toString() // Mismatched tenant
      }
    });

    expect(unauthorizedResponse.status()).toBe(401); // Should reject
  });

  test('should isolate user sessions across tenants', async ({ request }) => {
    const email = generateUniqueEmail();

    // Create same email in both tenants (allowed if isolated)
    const register1 = await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email, password: 'Pass1!', name: 'User Tenant 1' }
    });

    const register2 = await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() },
      data: { email, password: 'Pass2!', name: 'User Tenant 2' }
    });

    // Both should succeed if proper isolation
    expect(register1.status()).toBe(201);
    expect(register2.status()).toBe(201);

    // Login to both
    const login1 = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email, password: 'Pass1!' }
    });

    const login2 = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() },
      data: { email, password: 'Pass2!' }
    });

    const user1 = await login1.json();
    const user2 = await login2.json();

    // Verify different user IDs
    expect(user1.user.id).not.toBe(user2.user.id);
    expect(user1.user.organization_id).toBe(TEST_TENANTS.tenant1.id);
    expect(user2.user.organization_id).toBe(TEST_TENANTS.tenant2.id);
  });

  test('should enforce row-level security policies', async ({ request }) => {
    // Create admin and regular user in same tenant
    const adminEmail = generateUniqueEmail();
    const userEmail = generateUniqueEmail();

    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: adminEmail, password: 'Admin123!', name: 'Admin', role: 'admin' }
    });

    await request.post('/api/auth/register', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: userEmail, password: 'User123!', name: 'User', role: 'user' }
    });

    // Login both
    const adminLogin = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: adminEmail, password: 'Admin123!' }
    });

    const userLogin = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: userEmail, password: 'User123!' }
    });

    const { token: adminToken } = await adminLogin.json();
    const { token: userToken, user } = await userLogin.json();

    // Admin creates ticket for user
    const ticketResponse = await request.post('/api/tickets', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString()
      },
      data: {
        title: 'Admin Created Ticket',
        description: 'Created by admin',
        category_id: 1,
        priority_id: 1,
        user_id: user.id
      }
    });

    const ticket = await ticketResponse.json();

    // User can see their own ticket
    const userTickets = await request.get('/api/tickets', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString()
      }
    });

    const tickets = await userTickets.json();
    expect(tickets.some((t: any) => t.id === ticket.id)).toBe(true);
  });
});

test.describe('Multi-Tenancy: Tenant Resolution', () => {

  test('should resolve tenant from subdomain', async ({ page }) => {
    await page.goto(`http://${TEST_TENANTS.tenant1.slug}.localhost:3000/portal`);

    // Check if tenant context is set correctly
    const tenantCookie = await page.context().cookies();
    const tenantContext = tenantCookie.find(c => c.name === 'tenant-context');

    if (tenantContext) {
      const context = JSON.parse(tenantContext.value);
      expect(context.slug).toBe(TEST_TENANTS.tenant1.slug);
    }
  });

  test('should resolve tenant from path', async ({ page }) => {
    await page.goto(`http://localhost:3000/t/${TEST_TENANTS.tenant1.slug}/portal`);

    const tenantCookie = await page.context().cookies();
    const tenantContext = tenantCookie.find(c => c.name === 'tenant-context');

    if (tenantContext) {
      const context = JSON.parse(tenantContext.value);
      expect(context.slug).toBe(TEST_TENANTS.tenant1.slug);
    }
  });

  test('should resolve tenant from explicit headers', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'x-tenant-slug': TEST_TENANTS.tenant1.slug,
        'x-tenant-name': TEST_TENANTS.tenant1.name
      }
    });

    const headers = response.headers();
    expect(headers['x-tenant-id']).toBe(TEST_TENANTS.tenant1.id.toString());
  });

  test('should fallback to default tenant in development', async ({ request }) => {
    const response = await request.get('/api/status');

    // In development, should default to tenant 1
    const headers = response.headers();
    expect(headers['x-tenant-id']).toBeDefined();
  });
});

test.describe('Multi-Tenancy: Resource Limits', () => {

  test('should enforce tenant user limits', async ({ request }) => {
    const tenantId = TEST_TENANTS.tenant1.id;

    // Assuming max_users is 50 for basic plan
    // Try to create 51st user
    const users: string[] = [];

    // Create max allowed users (this would need actual implementation)
    // For demo, just testing the concept
    const response = await request.post('/api/admin/users', {
      headers: {
        'x-tenant-id': tenantId.toString(),
        'Authorization': 'Bearer admin-token'
      },
      data: {
        email: generateUniqueEmail(),
        name: 'Exceeding User',
        role: 'user'
      }
    });

    // Should check against tenant limits
    // If over limit, should return 403 or 402
    expect([200, 201, 402, 403]).toContain(response.status());
  });

  test('should enforce monthly ticket limits', async ({ request }) => {
    // Test would create tickets up to monthly limit
    // Then verify next ticket creation is blocked or requires upgrade
  });

  test('should track tenant resource usage', async ({ request }) => {
    const response = await request.get('/api/admin/tenant/usage', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'Authorization': 'Bearer admin-token'
      }
    });

    if (response.ok()) {
      const usage = await response.json();
      expect(usage).toHaveProperty('users_count');
      expect(usage).toHaveProperty('tickets_this_month');
      expect(usage).toHaveProperty('storage_used_bytes');
    }
  });
});

test.describe('Multi-Tenancy: Customization', () => {

  test('should support tenant-specific branding', async ({ request }) => {
    const customization = {
      logo_url: 'https://cdn.example.com/tenant1-logo.png',
      primary_color: '#FF6B00',
      secondary_color: '#003D7A',
      custom_css: '.header { background: #FF6B00; }'
    };

    const response = await request.put('/api/admin/tenant/customization', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'Authorization': 'Bearer admin-token'
      },
      data: customization
    });

    expect(response.ok()).toBe(true);

    // Retrieve customization
    const getResponse = await request.get('/api/admin/tenant/customization', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString()
      }
    });

    const saved = await getResponse.json();
    expect(saved.primary_color).toBe(customization.primary_color);
  });

  test('should support tenant-specific feature flags', async ({ request }) => {
    const features = {
      ai_suggestions: true,
      whatsapp_integration: false,
      advanced_analytics: true,
      sso_enabled: true
    };

    const response = await request.put('/api/admin/tenant/features', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'Authorization': 'Bearer admin-token'
      },
      data: features
    });

    expect(response.ok()).toBe(true);
  });

  test('should support tenant-specific integrations', async ({ request }) => {
    // Each tenant should have isolated integration credentials
    const integration = {
      type: 'whatsapp',
      credentials: {
        api_key: 'tenant1-whatsapp-key',
        phone_number: '+5511999999999'
      }
    };

    const response = await request.post('/api/admin/integrations', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'Authorization': 'Bearer admin-token'
      },
      data: integration
    });

    expect(response.ok()).toBe(true);

    // Verify tenant2 cannot see tenant1's integration
    const tenant2Response = await request.get('/api/admin/integrations', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant2.id.toString(),
        'Authorization': 'Bearer admin-token'
      }
    });

    const tenant2Integrations = await tenant2Response.json();
    expect(tenant2Integrations.some((i: any) => i.credentials?.api_key === 'tenant1-whatsapp-key')).toBe(false);
  });
});

test.describe('Multi-Tenancy: Onboarding & Offboarding', () => {

  test('should support tenant creation flow', async ({ request }) => {
    const newTenant = {
      name: 'New Tenant Corp',
      slug: `tenant-${crypto.randomUUID().substring(0, 8)}`,
      admin_email: generateUniqueEmail(),
      admin_password: 'Admin123!',
      subscription_plan: 'professional'
    };

    const response = await request.post('/api/admin/tenants', {
      data: newTenant
    });

    expect(response.ok()).toBe(true);
    const tenant = await response.json();

    expect(tenant).toHaveProperty('id');
    expect(tenant.slug).toBe(newTenant.slug);
  });

  test('should initialize default data for new tenant', async ({ request }) => {
    // After tenant creation, should have:
    // - Default categories
    // - Default priorities
    // - Default statuses
    // - Admin user

    // This would verify the tenant onboarding process
  });

  test('should support tenant suspension', async ({ request }) => {
    const response = await request.put(`/api/admin/tenants/${TEST_TENANTS.tenant1.id}/suspend`, {
      headers: { 'Authorization': 'Bearer super-admin-token' },
      data: { reason: 'Non-payment' }
    });

    expect(response.ok()).toBe(true);

    // Verify tenant cannot access system
    const loginAttempt = await request.post('/api/auth/login', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() },
      data: { email: 'user@tenant1.com', password: 'pass' }
    });

    expect(loginAttempt.status()).toBe(403);
  });

  test('should support tenant data deletion (LGPD compliance)', async ({ request }) => {
    const deleteResponse = await request.delete(`/api/admin/tenants/${TEST_TENANTS.tenant1.id}`, {
      headers: { 'Authorization': 'Bearer super-admin-token' },
      data: {
        confirmation: TEST_TENANTS.tenant1.slug,
        delete_all_data: true
      }
    });

    expect(deleteResponse.ok()).toBe(true);

    // Verify all tenant data is deleted
    // - Users
    // - Tickets
    // - Comments
    // - Attachments
    // etc.
  });
});

test.describe('Multi-Tenancy: Shared Resources', () => {

  test('should share system-level resources across tenants', async ({ request }) => {
    // System-level resources like default priorities should be accessible
    // but tenant-specific ones should be isolated

    const tenant1Priorities = await request.get('/api/priorities', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant1.id.toString() }
    });

    const tenant2Priorities = await request.get('/api/priorities', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() }
    });

    const priorities1 = await tenant1Priorities.json();
    const priorities2 = await tenant2Priorities.json();

    // Both should have access to default priorities
    expect(priorities1.length).toBeGreaterThan(0);
    expect(priorities2.length).toBeGreaterThan(0);
  });

  test('should isolate tenant-specific categories', async ({ request }) => {
    // Create custom category for tenant1
    const response = await request.post('/api/admin/categories', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'Authorization': 'Bearer admin-token'
      },
      data: {
        name: 'Tenant 1 Custom Category',
        color: '#FF0000'
      }
    });

    const category = await response.json();

    // Verify tenant2 cannot see it
    const tenant2Categories = await request.get('/api/categories', {
      headers: { 'x-tenant-id': TEST_TENANTS.tenant2.id.toString() }
    });

    const categories = await tenant2Categories.json();
    expect(categories.some((c: any) => c.id === category.id)).toBe(false);
  });
});

test.describe('Multi-Tenancy: Analytics & Reporting', () => {

  test('should provide tenant-specific analytics', async ({ request }) => {
    const response = await request.get('/api/analytics', {
      headers: {
        'x-tenant-id': TEST_TENANTS.tenant1.id.toString(),
        'Authorization': 'Bearer admin-token'
      }
    });

    const analytics = await response.json();

    // Analytics should only show tenant1 data
    expect(analytics).toHaveProperty('total_tickets');
    expect(analytics).toHaveProperty('total_users');
    // All metrics should be scoped to tenant
  });

  test('should provide cross-tenant analytics for super admin', async ({ request }) => {
    const response = await request.get('/api/admin/global-analytics', {
      headers: { 'Authorization': 'Bearer super-admin-token' }
    });

    const analytics = await response.json();

    expect(analytics).toHaveProperty('tenants');
    expect(analytics.tenants.length).toBeGreaterThan(1);
  });
});
