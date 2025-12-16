import { Page, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'agent' | 'user';
  tenant_slug?: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: 'admin@servicedesk.com',
    password: '123456',
    role: 'admin',
    tenant_slug: 'demo'
  },
  agent: {
    email: 'joao.silva@servicedesk.com',
    password: '123456',
    role: 'agent',
    tenant_slug: 'demo'
  },
  user: {
    email: 'teste@servicedesk.com',
    password: '123456',
    role: 'user',
    tenant_slug: 'demo'
  }
};

/**
 * Login helper - performs full login flow via UI
 */
export async function login(page: Page, user: TestUser) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  // Fill in credentials
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 10000
  });

  // Verify successful login by checking for auth cookie
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(
    (c) => c.name === 'auth_token' && c.httpOnly === true
  );

  expect(hasAuthCookie).toBe(true);
}

/**
 * Login via API - faster for tests that don't need to test login UI
 */
export async function loginViaAPI(page: Page, user: TestUser) {
  const response = await page.request.post('/api/auth/login', {
    data: {
      email: user.email,
      password: user.password,
      tenant_slug: user.tenant_slug || 'test-tenant'
    }
  });

  expect(response.ok()).toBe(true);

  const data = await response.json();
  expect(data.success).toBe(true);

  // Set cookies from response
  const setCookieHeaders = response.headers()['set-cookie'];
  if (setCookieHeaders) {
    const cookies = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : [setCookieHeaders];

    for (const cookie of cookies) {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      await page.context().addCookies([
        {
          name: name.trim(),
          value: value.trim(),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax'
        }
      ]);
    }
  }

  return data;
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // Try API logout first
  try {
    await page.request.post('/api/auth/logout');
  } catch (error) {
    // Ignore errors, cookies will be cleared anyway
  }

  // Clear all cookies
  await page.context().clearCookies();

  // Clear localStorage
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'auth_token');
}

/**
 * Get current user role from localStorage
 */
export async function getCurrentUserRole(page: Page): Promise<string | null> {
  return await page.evaluate(() => localStorage.getItem('user_role'));
}

/**
 * Verify user is redirected to login if not authenticated
 */
export async function expectRedirectToLogin(page: Page, protectedUrl: string) {
  await page.goto(protectedUrl);
  await page.waitForURL((url) => url.pathname.includes('/auth/login'), {
    timeout: 5000
  });
}

/**
 * Setup authenticated session for specific user role
 */
export async function setupAuthenticatedSession(
  page: Page,
  role: 'admin' | 'agent' | 'user'
) {
  const user = TEST_USERS[role];
  await loginViaAPI(page, user);
  return user;
}

/**
 * Verify httpOnly cookie security
 */
export async function verifySecureCookies(page: Page) {
  const cookies = await page.context().cookies();

  const authToken = cookies.find((c) => c.name === 'auth_token');
  const tenantContext = cookies.find((c) => c.name === 'tenant-context');

  // Auth token should be httpOnly
  expect(authToken).toBeDefined();
  expect(authToken?.httpOnly).toBe(true);

  // Tenant context should be accessible to JS (not httpOnly)
  if (tenantContext) {
    expect(tenantContext.httpOnly).toBe(false);
  }
}
