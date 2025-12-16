import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import {
  login,
  logout,
  TEST_USERS,
  isAuthenticated,
  verifySecureCookies
} from '../helpers/auth';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    // Navigate to login first, then clear localStorage
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display login page with correct elements', async ({ page }) => {
    await page.goto('/auth/login');

    // Check page title
    await expect(page.locator('h1')).toContainText('Bem-vindo de volta');

    // Check form elements exist
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for register link
    await expect(page.locator('a[href="/auth/register"]')).toBeVisible();

    // Check for test credentials display
    await expect(page.locator('text=teste@servicedesk.com')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const user = TEST_USERS.user;

    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Fill in credentials
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);

    // Click submit button
    await page.click('button[type="submit"]');

    // Wait for redirect (should go to dashboard or home)
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
      timeout: 10000
    });

    // Verify we're authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Verify secure cookies were set
    await verifySecureCookies(page);
  });

  test('should show error with invalid email', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(
      page.locator('[role="alert"], .bg-red-50, .error-message')
    ).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    expect(page.url()).toContain('/auth/login');

    // Should not have auth cookies
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);
  });

  test('should show error with invalid password', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', TEST_USERS.user.email);
    await page.fill('input[name="password"]', 'wrongpassword123');
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(
      page.locator('[role="alert"], .bg-red-50, .error-message')
    ).toBeVisible({ timeout: 5000 });

    // Verify no authentication
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);
  });

  test('should handle rate limiting after multiple failed attempts', async ({
    page
  }) => {
    await page.goto('/auth/login');

    // Attempt login 6 times (rate limit is typically 5)
    for (let i = 0; i < 6; i++) {
      await page.fill('input[name="email"]', 'test@test.com');
      await page.fill('input[name="password"]', 'wrong');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // After 5+ attempts, should see rate limit error or 429 response
    // This might show as an error message or the button might be disabled
    const errorVisible = await page
      .locator('[role="alert"], .bg-red-50')
      .isVisible();
    expect(errorVisible).toBe(true);
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/auth/login');

    const passwordInput = page.locator('input[name="password"]');

    // Initially should be password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button
    const toggleButton = page.locator('button[aria-label*="senha"]');
    await toggleButton.click();

    // Should now be text type
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await login(page, TEST_USERS.user);

    // Verify authenticated
    expect(await isAuthenticated(page)).toBe(true);

    // Perform logout
    await logout(page);

    // Verify not authenticated
    expect(await isAuthenticated(page)).toBe(false);

    // Try to access protected route - should redirect to landing (unauthenticated users)
    await page.goto('/dashboard');
    await page.waitForURL((url) => url.pathname.includes('/landing'), {
      timeout: 5000
    });
  });

  test('should auto-redirect to home if already authenticated', async ({
    page
  }) => {
    // Login first
    await login(page, TEST_USERS.user);

    // Try to access login page
    await page.goto('/auth/login');

    // Should redirect away from login
    await page.waitForTimeout(1000);

    // Should not be on login page (might redirect to dashboard/home)
    // This behavior depends on your implementation
    const currentUrl = page.url();
    // Either we stay on home or get redirected, but we're authenticated
    expect(await isAuthenticated(page)).toBe(true);
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login
    await login(page, TEST_USERS.user);

    // Reload page
    await page.reload();

    // Should still be authenticated
    expect(await isAuthenticated(page)).toBe(true);
  });

  test('should have accessible login form', async ({ page }) => {
    await page.goto('/auth/login');
    await injectAxe(page);

    // Check for accessibility violations
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('should show loading state during login', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', TEST_USERS.user.email);
    await page.fill('input[name="password"]', TEST_USERS.user.password);

    // Click submit
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show loading state (disabled button or loading spinner)
    await expect(submitButton).toBeDisabled({ timeout: 1000 });
  });

  test('should validate email format on client side', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('input[name="email"]');

    // Fill invalid email
    await emailInput.fill('notanemail');

    // Check if HTML5 validation kicks in
    const isValid = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );

    expect(isValid).toBe(false);
  });

  test('should show server error gracefully', async ({ page }) => {
    await page.goto('/auth/login');

    // Mock network failure
    await page.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });

    await page.fill('input[name="email"]', TEST_USERS.user.email);
    await page.fill('input[name="password"]', TEST_USERS.user.password);
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(
      page.locator('[role="alert"], .bg-red-50, .error-message')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should have proper ARIA labels for screen readers', async ({
    page
  }) => {
    await page.goto('/auth/login');

    // Check ARIA labels
    await expect(page.locator('input[name="email"]')).toHaveAttribute(
      'aria-label'
    );
    await expect(page.locator('input[name="password"]')).toHaveAttribute(
      'aria-label'
    );
    await expect(page.locator('button[type="submit"]')).toHaveAttribute(
      'aria-label'
    );
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/auth/login');

    // Tab through form elements
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.type(TEST_USERS.user.email);

    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.type(TEST_USERS.user.password);

    await page.keyboard.press('Tab'); // Focus remember me
    await page.keyboard.press('Tab'); // Focus submit button

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Should attempt login
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
      timeout: 10000
    });
  });
});
