/**
 * Authentication E2E Tests
 * Tests user registration, login, logout, and authentication flows
 */

import { test, expect } from '@playwright/test';
import { testUsers, generateUniqueEmail } from '../fixtures/test-data';
import { login, logout, clearSession } from '../utils/test-helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/auth/login');

    // Check page title
    await expect(page).toHaveTitle(/Login|ServiceDesk/i);

    // Check for login form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    // Should redirect to admin or dashboard
    await expect(page).toHaveURL(/\/(admin|dashboard|portal|tickets)/);

    // Should see user menu or profile
    const userIndicator = page.locator('[data-testid="user-menu"], button:has-text("admin"), [aria-label*="user" i]').first();
    await expect(userIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMessage = page.locator('text=/invalid|incorrect|wrong|error/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/auth/login');

    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // Should show validation errors or prevent submission
    const emailInput = page.locator('input[name="email"]');
    const isRequired = await emailInput.evaluate((el: HTMLInputElement) => el.required);

    if (isRequired) {
      // Browser validation should prevent submission
      expect(isRequired).toBe(true);
    } else {
      // Should show custom validation error
      const errorMessage = page.locator('text=/required|must|field/i').first();
      await expect(errorMessage).toBeVisible({ timeout: 3000 });
    }
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await login(page, testUsers.admin.email, testUsers.admin.password);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Logout
    await logout(page);

    // Should redirect to login page
    await expect(page).toHaveURL(/\/auth\/login/);

    // Should not be able to access protected routes
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should redirect to login when accessing protected route without authentication', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should display registration page', async ({ page }) => {
    await page.goto('/auth/register');

    // Check for registration form elements
    await expect(page.locator('input[name="name"], input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should register new user successfully', async ({ page }) => {
    await page.goto('/auth/register');

    const uniqueEmail = generateUniqueEmail();

    await page.fill('input[name="name"], input[name="fullName"]', testUsers.newUser.name);
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', testUsers.newUser.password);

    // Fill confirm password if exists
    const confirmPasswordField = page.locator('input[name="confirmPassword"]');
    if (await confirmPasswordField.isVisible().catch(() => false)) {
      await confirmPasswordField.fill(testUsers.newUser.password);
    }

    await page.click('button[type="submit"]');

    // Should redirect to login or dashboard
    await expect(page).toHaveURL(/\/(login|dashboard|portal|tickets)/, { timeout: 10000 });
  });

  test('should show error when registering with existing email', async ({ page }) => {
    await page.goto('/auth/register');

    // Try to register with existing admin email
    await page.fill('input[name="name"], input[name="fullName"]', 'Test User');
    await page.fill('input[name="email"]', testUsers.admin.email);
    await page.fill('input[name="password"]', 'Password123!');

    const confirmPasswordField = page.locator('input[name="confirmPassword"]');
    if (await confirmPasswordField.isVisible().catch(() => false)) {
      await confirmPasswordField.fill('Password123!');
    }

    await page.click('button[type="submit"]');

    // Should show error about existing user
    const errorMessage = page.locator('text=/exists|already|registered/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should validate password strength on registration', async ({ page }) => {
    await page.goto('/auth/register');

    await page.fill('input[name="name"], input[name="fullName"]', 'Test User');
    await page.fill('input[name="email"]', generateUniqueEmail());
    await page.fill('input[name="password"]', '123'); // Weak password

    const confirmPasswordField = page.locator('input[name="confirmPassword"]');
    if (await confirmPasswordField.isVisible().catch(() => false)) {
      await confirmPasswordField.fill('123');
    }

    await page.click('button[type="submit"]');

    // Should show password validation error or stay on page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth/register');
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login
    await login(page, testUsers.admin.email, testUsers.admin.password);

    // Get current URL
    const currentUrl = page.url();

    // Refresh page
    await page.reload();

    // Should still be on the same page (authenticated)
    await expect(page).toHaveURL(currentUrl);

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('should handle concurrent login attempts gracefully', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill credentials
    await page.fill('input[name="email"]', testUsers.admin.email);
    await page.fill('input[name="password"]', testUsers.admin.password);

    // Click submit multiple times
    const submitButton = page.locator('button[type="submit"]');
    await Promise.all([
      submitButton.click(),
      submitButton.click(),
      submitButton.click(),
    ]);

    // Should still login successfully without errors
    await expect(page).toHaveURL(/\/(admin|dashboard|portal|tickets)/, { timeout: 10000 });
  });
});

test.describe('Session Management', () => {
  test('should expire session after logout', async ({ page }) => {
    // Login
    await login(page, testUsers.user.email, testUsers.user.password);

    // Logout
    await logout(page);

    // Try to access protected route
    await page.goto('/portal/tickets');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should handle browser back button after logout', async ({ page }) => {
    // Login
    await login(page, testUsers.user.email, testUsers.user.password);

    const protectedUrl = page.url();

    // Logout
    await logout(page);

    // Try to go back
    await page.goBack();

    // Should redirect to login or stay on login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
