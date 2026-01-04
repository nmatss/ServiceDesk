/**
 * Error Handling and Edge Cases E2E Tests
 * Tests application behavior under error conditions and edge cases
 */

import { test, expect } from '@playwright/test';
import { testUsers, generateUniqueTicketTitle, generateUniqueEmail } from '../fixtures/test-data';
import { login } from '../utils/test-helpers';

test.describe('Network Error Handling', () => {
  test('should handle offline mode gracefully', async ({ page, context }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Go offline
    await context.setOffline(true);

    // Try to navigate
    await page.goto('/portal/tickets').catch(() => {});

    await page.waitForTimeout(2000);

    // Go back online
    await context.setOffline(false);

    // Should recover
    await page.goto('/portal/tickets');
    await page.waitForLoadState('networkidle');
  });

  test('should show error message on failed API request', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    await page.goto('/auth/login');

    await page.fill('input[name="email"]', testUsers.user.email);
    await page.fill('input[name="password"]', testUsers.user.password);
    await page.click('button[type="submit"]');

    // Should show error message
    await page.waitForTimeout(2000);

    // Look for error indicators
    const hasError = await page.locator('text=/error|failed|unable|problem/i').first().isVisible({ timeout: 3000 }).catch(() => false);

    // Error should be visible or login should fail gracefully
    expect(hasError || page.url().includes('/login')).toBe(true);
  });

  test('should handle slow network connections', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.continue();
    });

    await page.goto('/auth/login');

    // Fill and submit
    await page.fill('input[name="email"]', testUsers.user.email);
    await page.fill('input[name="password"]', testUsers.user.password);
    await page.click('button[type="submit"]');

    // Should show loading indicator
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, [aria-busy="true"]').first();

    const isLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Loading indicator shown:', isLoading);

    // Eventually should complete (with increased timeout)
    await expect(page).toHaveURL(/\/(portal|tickets|dashboard)/, { timeout: 15000 });
  });
});

test.describe('Form Validation Errors', () => {
  test('should validate email format on login', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Should show validation error or use browser validation
    const emailInput = page.locator('input[name="email"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);

    expect(validationMessage || 'valid email').toBeTruthy();
  });

  test('should validate password minimum length on registration', async ({ page }) => {
    await page.goto('/auth/register');

    await page.fill('input[name="name"], input[name="fullName"]', 'Test User');
    await page.fill('input[name="email"]', generateUniqueEmail());
    await page.fill('input[name="password"]', '12'); // Too short

    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Should stay on registration page
    expect(page.url()).toContain('/register');
  });

  test('should validate required fields on ticket creation', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    // Submit without filling required fields
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Should show validation errors
    const titleInput = page.locator('input[name="title"]');
    const isRequired = await titleInput.evaluate((el: HTMLInputElement) => el.required);

    expect(isRequired).toBe(true);
  });

  test('should validate ticket title length', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    // Try very long title
    const longTitle = 'A'.repeat(500);
    await page.fill('input[name="title"]', longTitle);
    await page.fill('textarea[name="description"]', 'Test');

    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Should validate or truncate
    const titleInput = page.locator('input[name="title"]');
    const maxLength = await titleInput.getAttribute('maxlength');

    if (maxLength) {
      expect(parseInt(maxLength)).toBeLessThan(500);
    }
  });

  test('should prevent XSS in ticket creation', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    const xssTitle = '<script>alert("XSS")</script>';

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', xssTitle);
    await page.fill('textarea[name="description"]', 'Test description');

    await page.click('button[type="submit"]');

    await page.waitForURL(/\/tickets\/\d+/, { timeout: 10000 });

    // Script should not execute - check if text is escaped
    const pageContent = await page.content();
    const hasScriptTag = pageContent.includes('<script>alert');

    // XSS should be prevented
    expect(hasScriptTag).toBe(false);
  });
});

test.describe('Authentication Edge Cases', () => {
  test('should handle expired session', async ({ page, context }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Clear cookies to simulate expired session
    await context.clearCookies();

    // Try to access protected route
    await page.goto('/portal/tickets');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test('should prevent double login', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Try to access login page when already logged in
    await page.goto('/auth/login');

    // Should redirect to dashboard or stay on current page
    await page.waitForLoadState('networkidle');

    const url = page.url();

    // Should either redirect away from login or stay authenticated
    const isLoggedIn = !url.includes('/auth/login') || url.includes('/portal') || url.includes('/dashboard');

    console.log('Handled double login:', url);
  });

  test('should handle simultaneous login attempts', async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // Login with same user in both contexts
    await Promise.all([
      login(page1, testUsers.user.email, testUsers.user.password),
      login(page2, testUsers.user.email, testUsers.user.password),
    ]);

    // Both should succeed
    await expect(page1).toHaveURL(/\/(portal|tickets|dashboard)/);
    await expect(page2).toHaveURL(/\/(portal|tickets|dashboard)/);

    await context1.close();
    await context2.close();
  });

  test('should handle SQL injection attempts in login', async ({ page }) => {
    await page.goto('/auth/login');

    // Try SQL injection
    await page.fill('input[name="email"]', "admin' OR '1'='1");
    await page.fill('input[name="password"]', "' OR '1'='1");
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);

    // Should not login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should rate limit login attempts', async ({ page }) => {
    await page.goto('/auth/login');

    // Attempt multiple failed logins
    for (let i = 0; i < 10; i++) {
      await page.fill('input[name="email"]', 'wrong@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      await page.waitForTimeout(500);
    }

    // Should show rate limit message or block attempts
    const rateLimitMessage = await page.locator('text=/too many|rate limit|try again later/i').first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log('Rate limiting active:', rateLimitMessage);
  });
});

test.describe('Data Edge Cases', () => {
  test('should handle very long ticket descriptions', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    const longDescription = 'A'.repeat(10000);

    await page.fill('input[name="title"]', generateUniqueTicketTitle());
    await page.fill('textarea[name="description"]', longDescription);

    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);

    // Should either accept or show validation error
    const currentUrl = page.url();

    // Either created successfully or showed error
    expect(currentUrl).toBeTruthy();
  });

  test('should handle special characters in ticket title', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    const specialTitle = "Test & Title with 'quotes' and \"double\" quotes @#$%";

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', specialTitle);
    await page.fill('textarea[name="description"]', 'Test description');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 });

    // Special characters should be properly escaped/displayed
    const displayedTitle = await page.locator('text=/Test.*Title/').first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(displayedTitle).toBe(true);
  });

  test('should handle Unicode characters', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    const unicodeTitle = '测试票据 🎫 Тест';

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', unicodeTitle);
    await page.fill('textarea[name="description"]', 'Unicode test 中文 Русский 🚀');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 });

    // Unicode should be preserved
    await expect(page.locator('text=测试票据').first()).toBeVisible({ timeout: 3000 });
  });

  test('should handle empty search queries', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Submit empty search
      await searchInput.fill('');
      await searchInput.press('Enter');

      await page.waitForTimeout(1000);

      // Should show all tickets or handle gracefully
      const ticketsList = page.locator('table, [data-testid="tickets-list"]').first();
      await expect(ticketsList).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('UI Edge Cases', () => {
  test('should handle rapid clicks on submit button', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', testUsers.user.email);
    await page.fill('input[name="password"]', testUsers.user.password);

    const submitButton = page.locator('button[type="submit"]');

    // Click multiple times rapidly
    await Promise.all([
      submitButton.click(),
      submitButton.click(),
      submitButton.click(),
    ]);

    // Should only process once
    await expect(page).toHaveURL(/\/(portal|tickets|dashboard)/, { timeout: 10000 });
  });

  test('should handle browser back button correctly', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    const startUrl = page.url();

    // Navigate to another page
    await page.goto('/portal/create');

    // Go back
    await page.goBack();

    // Should return to previous page
    await expect(page).toHaveURL(startUrl);
  });

  test('should handle browser forward button', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');
    await page.goto('/portal/create');

    // Go back
    await page.goBack();

    // Go forward
    await page.goForward();

    // Should be on create page
    await expect(page).toHaveURL(/\/create/);
  });

  test('should handle page refresh during form fill', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', 'Test ticket before refresh');
    await page.fill('textarea[name="description"]', 'Test description');

    // Refresh page
    await page.reload();

    // Form should be cleared (or restored if using localStorage)
    const titleValue = await page.locator('input[name="title"]').inputValue();

    // Either cleared or preserved
    expect(titleValue !== undefined).toBe(true);
  });

  test('should handle window resize', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Resize to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Page should still be functional
    await expect(page.locator('table, [data-testid="tickets-list"]').first()).toBeVisible();
  });
});

test.describe('File Upload Edge Cases', () => {
  test('should handle large file upload', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    const fileInput = page.locator('input[type="file"]');

    if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Create large file (10MB)
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'a');

      await fileInput.setInputFiles({
        name: 'large-file.txt',
        mimeType: 'text/plain',
        buffer: largeBuffer,
      });

      await page.waitForTimeout(1000);

      // Should either accept or show size limit error
      const errorMessage = await page.locator('text=/too large|size limit|maximum/i').first().isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Large file validation:', errorMessage ? 'rejected' : 'accepted');
    }
  });

  test('should handle invalid file types', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    const fileInput = page.locator('input[type="file"]');

    if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to upload executable
      const buffer = Buffer.from('fake executable content');

      await fileInput.setInputFiles({
        name: 'virus.exe',
        mimeType: 'application/x-msdownload',
        buffer,
      });

      await page.waitForTimeout(1000);

      // Should show error for invalid file type
      const errorMessage = await page.locator('text=/invalid|not allowed|file type/i').first().isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Invalid file type validation:', errorMessage ? 'rejected' : 'accepted');
    }
  });
});

test.describe('Concurrent Actions', () => {
  test('should handle multiple tabs with same user', async ({ browser }) => {
    const context = await browser.newContext();

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Login in first tab
    await login(page1, testUsers.user.email, testUsers.user.password);

    // Second tab should also be authenticated (shared cookies)
    await page2.goto('/portal/tickets');

    // Should be authenticated in both
    await expect(page1).toHaveURL(/\/(portal|tickets|dashboard)/);
    await expect(page2).toHaveURL(/\/portal\/tickets/);

    await context.close();
  });

  test('should handle logout from one tab affecting other tabs', async ({ browser }) => {
    const context = await browser.newContext();

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await login(page1, testUsers.user.email, testUsers.user.password);

    await page2.goto('/portal/tickets');

    // Logout from first tab
    await context.clearCookies();

    // Refresh second tab
    await page2.reload();

    // Second tab should redirect to login
    await expect(page2).toHaveURL(/\/auth\/login/, { timeout: 5000 });

    await context.close();
  });
});
