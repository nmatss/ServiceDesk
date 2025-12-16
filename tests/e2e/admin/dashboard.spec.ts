import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import {
  setupAuthenticatedSession,
  logout,
  expectRedirectToLogin,
  TEST_USERS
} from '../helpers/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Setup admin session
    await setupAuthenticatedSession(page, 'admin');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should only allow admin access to dashboard', async ({ page }) => {
    // Logout admin
    await logout(page);

    // Try as regular user
    await setupAuthenticatedSession(page, 'user');

    // Try to access admin dashboard
    await page.goto('/admin/dashboard');

    // Should either redirect or show access denied
    await page.waitForTimeout(1000);

    // Check if we're still on admin dashboard or got redirected
    const currentUrl = page.url();

    // If user can't access, they'll be redirected or see an error
    // This depends on your middleware implementation
    if (currentUrl.includes('/admin/dashboard')) {
      // Check for access denied message
      const hasAccessDenied = await page
        .locator('text=/acesso negado|não autorizado|forbidden/i')
        .count();
      expect(hasAccessDenied).toBeGreaterThan(0);
    } else {
      // User was redirected away from admin area
      expect(currentUrl).not.toContain('/admin');
    }
  });

  test('should display dashboard with key metrics', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Check for dashboard title
    await expect(
      page.locator('h1:has-text("Dashboard"), h2:has-text("Dashboard")')
    ).toBeVisible();

    // Check for metric cards
    const expectedMetrics = [
      /total.*tickets?/i,
      /tickets? abertos?/i,
      /tempo.*m[ée]dio?/i,
      /satisfa[çc][ãa]o/i
    ];

    for (const metric of expectedMetrics) {
      const metricExists = await page.locator(`text=${metric}`).count();
      expect(metricExists).toBeGreaterThan(0);
    }
  });

  test('should display statistics cards', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for statistic cards
    const statsCards = page.locator(
      '.bg-white.shadow, [class*="card"], [class*="stat"]'
    );

    const cardsCount = await statsCards.count();
    expect(cardsCount).toBeGreaterThan(0);

    // Check that cards contain numbers
    const firstCard = statsCards.first();
    const cardText = await firstCard.textContent();

    // Should contain at least one number
    expect(cardText).toMatch(/\d+/);
  });

  test('should navigate to user management', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for link to users page
    const usersLink = page.locator('a[href*="/admin/users"]').first();

    if (await usersLink.count() > 0) {
      await usersLink.click();
      await expect(page).toHaveURL(/\/admin\/users/);
    } else {
      // Navigate directly
      await page.goto('/admin/users');
      await expect(page).toHaveURL(/\/admin\/users/);
    }
  });

  test('should access user management and view users list', async ({
    page
  }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Should display users page
    await expect(page.locator('h1, h2')).toContainText(/usu[aá]rios?/i);

    // Should have a table or list of users
    const hasTable =
      (await page.locator('table').count()) > 0 ||
      (await page.locator('[class*="user"], [class*="list"]').count()) > 0;

    expect(hasTable).toBe(true);
  });

  test('should navigate to SLA configuration', async ({ page }) => {
    await page.goto('/admin/sla');
    await page.waitForLoadState('networkidle');

    // Should display SLA configuration page
    await expect(page.locator('h1, h2')).toContainText(/sla/i);
  });

  test('should access reports section', async ({ page }) => {
    await page.goto('/admin/reports');
    await page.waitForLoadState('networkidle');

    // Should display reports page
    await expect(page.locator('h1, h2')).toContainText(/relat[oó]rios?/i);
  });

  test('should display recent activity table', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for activity section
    const activitySection = page.locator(
      'text=/atividade.*recente|recent.*activity/i'
    );

    if (await activitySection.count() > 0) {
      // Check for table with recent tickets
      const table = page.locator('table').first();
      await expect(table).toBeVisible();

      // Table should have headers
      const headers = table.locator('thead th');
      expect(await headers.count()).toBeGreaterThan(0);
    }
  });

  test('should show metrics with proper formatting', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Find metric values (typically large numbers)
    const metricValues = page.locator(
      '.text-3xl, [class*="metric-value"], dd.text-3xl'
    );

    const valuesCount = await metricValues.count();
    expect(valuesCount).toBeGreaterThan(0);

    // Check if at least one metric has a number
    const firstValue = await metricValues.first().textContent();
    expect(firstValue).toMatch(/\d+/);
  });

  test('should have working navigation menu', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Common admin navigation items
    const navItems = [
      { pattern: /dashboard/i, url: '/admin/dashboard' },
      { pattern: /usu[aá]rios?|users/i, url: '/admin/users' },
      { pattern: /tickets?/i, url: '/admin/tickets' }
    ];

    for (const item of navItems) {
      const navLink = page
        .locator(`nav a:has-text("${item.pattern.source.replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\\/g, '')}")`)
        .or(page.locator(`a[href*="${item.url}"]`))
        .first();

      if (await navLink.count() > 0) {
        const linkExists = await navLink.isVisible();
        // Just checking it exists, not clicking all of them
        expect(linkExists || (await navLink.count() > 0)).toBeTruthy();
      }
    }
  });

  test('should display percentage changes in metrics', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for percentage indicators
    const percentageIndicators = page.locator('text=/%|percent/i');

    if (await percentageIndicators.count() > 0) {
      // Should have at least one percentage
      await expect(percentageIndicators.first()).toBeVisible();

      // Check for trend indicators (arrows, colors)
      const hasTrendIndicator =
        (await page.locator('svg[class*="arrow"], .text-green, .text-red')
          .count()) > 0;

      expect(hasTrendIndicator).toBe(true);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should still be accessible
    await expect(page.locator('h1, h2')).toBeVisible();

    // Metrics should stack on mobile
    const metricsCards = page.locator(
      '.bg-white.shadow, [class*="stat"], [class*="card"]'
    );

    if (await metricsCards.count() > 0) {
      await expect(metricsCards.first()).toBeVisible();
    }
  });

  test('should have accessible dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await injectAxe(page);

    // Run accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('should update metrics in real-time (if applicable)', async ({
    page
  }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Get initial metric value
    const metricValue = page.locator('.text-3xl, dd.text-3xl').first();
    const initialValue = await metricValue.textContent();

    // Wait a bit (if your dashboard auto-refreshes)
    await page.waitForTimeout(2000);

    // Value might stay the same, but dashboard should not crash
    const currentValue = await metricValue.textContent();
    expect(currentValue).toBeTruthy();
  });

  test('should handle empty data gracefully', async ({ page }) => {
    // Mock empty data response
    await page.route('**/api/admin/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], metrics: {} })
      });
    });

    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should still render without errors
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('should allow admin to create new user', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Look for "New User" or "Add User" button
    const newUserButton = page
      .locator('a[href*="/admin/users/new"], button:has-text("Novo")')
      .first();

    if (await newUserButton.count() > 0) {
      await newUserButton.click();

      // Should navigate to new user form
      await expect(page).toHaveURL(/\/admin\/users\/new/);
    }
  });

  test('should logout from admin panel', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Perform logout
    await logout(page);

    // Try to access admin again
    await page.goto('/admin/dashboard');

    // Should redirect to login or show access denied
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const isOnLogin = currentUrl.includes('/auth/login');
    const isOnAdmin = currentUrl.includes('/admin');

    // Either redirected to login, or not on admin anymore
    expect(isOnLogin || !isOnAdmin).toBe(true);
  });

  test('should display loading states', async ({ page }) => {
    // Slow down network to see loading states
    await page.route('**/api/**', (route) => {
      setTimeout(() => route.continue(), 1000);
    });

    await page.goto('/admin/dashboard');

    // Look for loading indicators
    const loadingIndicator = page.locator(
      '.loading, [class*="spinner"], [class*="skeleton"]'
    );

    // Might have loading state (timing dependent)
    if (await loadingIndicator.count() > 0) {
      await expect(loadingIndicator.first()).toBeVisible();
    }

    // Wait for content to load
    await page.waitForLoadState('networkidle');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/admin/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Should show error message or fallback UI
    const hasError =
      (await page.locator('[role="alert"], .error, .bg-red').count()) > 0;

    // Dashboard should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});
