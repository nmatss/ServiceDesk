/**
 * Smoke Test Suite — 15 tests
 *
 * Validates the system is operational after deploy.
 * Target: < 2 minutes total execution time.
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:3000
 *   - Database seeded with admin@servicedesk.com / 123456
 *
 * Run:
 *   npx playwright test tests/e2e/smoke.spec.ts --project=chromium-desktop
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared state — login once, reuse auth cookies across all tests
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000';

const ADMIN_CREDENTIALS = {
  email: 'admin@servicedesk.com',
  password: '123456',
};

let authCookies: { name: string; value: string; domain: string; path: string }[] = [];
let createdTicketId: number | string | undefined;

// ---------------------------------------------------------------------------
// Setup: authenticate once before all tests
// ---------------------------------------------------------------------------

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login via API for speed
  const loginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      email: ADMIN_CREDENTIALS.email,
      password: ADMIN_CREDENTIALS.password,
    },
  });

  expect(loginResponse.ok(), 'Login request should succeed').toBe(true);

  const loginData = await loginResponse.json();
  expect(loginData.success, 'Login response should indicate success').toBe(true);

  // Capture cookies set by the login response
  const cookies = await context.cookies();
  authCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain || 'localhost',
    path: c.path || '/',
  }));

  await context.close();
});

// ---------------------------------------------------------------------------
// Helper: create a new browser context with auth cookies pre-loaded
// ---------------------------------------------------------------------------

async function authenticatedPage(browser: import('@playwright/test').Browser): Promise<{
  page: Page;
  context: import('@playwright/test').BrowserContext;
  request: APIRequestContext;
}> {
  const context = await browser.newContext();
  if (authCookies.length > 0) {
    await context.addCookies(authCookies);
  }
  const page = await context.newPage();
  return { page, context, request: page.request };
}

// ==========================================================================
// Group 1: Health & Connectivity (3 tests)
// ==========================================================================

test.describe('Health & Connectivity', () => {
  test('1 — API health/live endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/live`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
  });

  test('2 — Landing page loads and title contains "ServiceDesk"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The page should either show the app or redirect to login — either way it loaded
    const title = await page.title();
    const bodyText = await page.textContent('body');

    // Title or body should reference ServiceDesk
    const hasServiceDesk =
      title.toLowerCase().includes('servicedesk') ||
      (bodyText?.toLowerCase().includes('servicedesk') ?? false);

    expect(hasServiceDesk, 'Page should mention ServiceDesk').toBe(true);
  });

  test('3 — Login page renders with email input', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });
});

// ==========================================================================
// Group 2: Authentication (3 tests)
// ==========================================================================

test.describe('Authentication', () => {
  test('4 — Login with valid credentials succeeds', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Should navigate away from login page
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
      timeout: 15000,
    });

    // Verify auth cookie was set
    const cookies = await page.context().cookies();
    const hasAuth = cookies.some((c) => c.name === 'auth_token');
    expect(hasAuth, 'auth_token cookie should be present').toBe(true);
  });

  test('5 — Login with wrong password shows error message', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[name="password"]', 'wrong-password-999');
    await page.click('button[type="submit"]');

    // Should display an error alert
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Should remain on login page
    expect(page.url()).toContain('/auth/login');
  });

  test('6 — Protected page redirects unauthenticated user to login', async ({ browser }) => {
    // Fresh context with no cookies
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/admin');

    // Should redirect to login
    await page.waitForURL((url) => url.pathname.includes('/auth/login'), {
      timeout: 15000,
    });

    expect(page.url()).toContain('/auth/login');
    await context.close();
  });
});

// ==========================================================================
// Group 3: Core CRUD (4 tests)
// ==========================================================================

test.describe('Core CRUD', () => {
  test('7 — Dashboard loads after login', async ({ browser }) => {
    const { page, context } = await authenticatedPage(browser);

    // Admin users are redirected to /admin, agents to /dashboard
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // The page should have rendered meaningful content (heading or main section)
    const mainContent = page.locator('main, [role="main"], h1, h2').first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('8 — Ticket list page loads', async ({ browser }) => {
    const { page, context } = await authenticatedPage(browser);

    await page.goto('/tickets');
    await page.waitForLoadState('domcontentloaded');

    // Should show a table, list, or grid of tickets, or at least the page structure
    const content = page.locator('table, [role="grid"], [role="list"], main, [role="main"]').first();
    await expect(content).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('9 — Create ticket API returns 201', async ({ browser }) => {
    const { page, context, request } = await authenticatedPage(browser);

    // Navigate to a page first so cookies are sent
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const uniqueTitle = `Smoke Test Ticket ${Date.now()}`;
    const response = await request.post(`${BASE_URL}/api/tickets`, {
      data: {
        title: uniqueTitle,
        description: 'Automated smoke test — this ticket can be safely deleted.',
        priority_id: 3,
        category_id: 1,
      },
    });

    // Accept 200 or 201 — both indicate successful creation
    expect([200, 201]).toContain(response.status());

    const body = await response.json();
    expect(body.success).toBe(true);

    // Store ticket ID for the next test
    if (body.data?.id) {
      createdTicketId = body.data.id;
    } else if (body.data?.ticket?.id) {
      createdTicketId = body.data.ticket.id;
    }

    await context.close();
  });

  test('10 — Get ticket by ID returns correct data', async ({ browser }) => {
    // If ticket creation failed or was skipped, use a fallback approach
    const { page, context, request } = await authenticatedPage(browser);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    let ticketId = createdTicketId;

    // If we do not have a ticket ID from the previous test, list tickets and pick the first one
    if (!ticketId) {
      const listResponse = await request.get(`${BASE_URL}/api/tickets?limit=1`);
      if (listResponse.ok()) {
        const listBody = await listResponse.json();
        const tickets = listBody.data?.tickets || listBody.data || [];
        if (Array.isArray(tickets) && tickets.length > 0) {
          ticketId = tickets[0].id;
        }
      }
    }

    // Skip gracefully if no tickets exist at all
    test.skip(!ticketId, 'No tickets available to fetch');

    const response = await request.get(`${BASE_URL}/api/tickets/${ticketId}`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // The response should include at least an id and title
    const ticket = body.data.ticket || body.data;
    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('title');

    await context.close();
  });
});

// ==========================================================================
// Group 4: Admin (3 tests)
// ==========================================================================

test.describe('Admin', () => {
  test('11 — Admin page loads for admin user', async ({ browser }) => {
    const { page, context } = await authenticatedPage(browser);

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Admin page should render without redirecting back to login
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/auth/login');

    // Should have visible content
    const heading = page.locator('h1, h2, h3, [role="heading"]').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('12 — Admin users list returns data', async ({ browser }) => {
    const { page, context, request } = await authenticatedPage(browser);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const response = await request.get(`${BASE_URL}/api/users`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.success).toBe(true);

    // Should return an array of users
    const users = body.data?.users || body.data;
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);

    await context.close();
  });

  test('13 — Categories API returns array', async ({ browser }) => {
    const { page, context, request } = await authenticatedPage(browser);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const response = await request.get(`${BASE_URL}/api/categories`);
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.success).toBe(true);

    const categories = body.data?.categories || body.data;
    expect(Array.isArray(categories)).toBe(true);

    await context.close();
  });
});

// ==========================================================================
// Group 5: Critical Features (2 tests)
// ==========================================================================

test.describe('Critical Features', () => {
  test('14 — Knowledge base endpoint responds', async ({ browser }) => {
    const { page, context, request } = await authenticatedPage(browser);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Try the KB articles endpoint, or search endpoint
    const response = await request.get(`${BASE_URL}/api/knowledge/articles`);

    // Accept 200 (data found) or 404 (endpoint structure differs) — must not be 500
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
    }

    await context.close();
  });

  test('15 — Notifications endpoint responds', async ({ browser }) => {
    const { page, context, request } = await authenticatedPage(browser);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const response = await request.get(`${BASE_URL}/api/notifications`);

    // Must not be a server error
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
    }

    await context.close();
  });
});
