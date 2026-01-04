/**
 * Admin Functions E2E Tests
 * Tests admin dashboard, user management, analytics, and settings
 */

import { test, expect } from '@playwright/test';
import { testUsers, generateUniqueEmail } from '../fixtures/test-data';
import { login } from '../utils/test-helpers';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display admin dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Should show dashboard elements
    await expect(page.locator('text=/dashboard/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display key metrics on dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Look for common dashboard metrics
    const metrics = [
      'text=/total.*tickets/i',
      'text=/open.*tickets/i',
      'text=/resolved/i',
      'text=/users/i',
    ];

    // At least some metrics should be visible
    let visibleCount = 0;
    for (const metric of metrics) {
      if (await page.locator(metric).first().isVisible({ timeout: 2000 }).catch(() => false)) {
        visibleCount++;
      }
    }

    expect(visibleCount).toBeGreaterThan(0);
  });

  test('should display charts and visualizations', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Look for chart elements (canvas, svg, or chart containers)
    const chartElements = page.locator('canvas, svg[class*="chart"], [class*="recharts"]');
    const chartCount = await chartElements.count();

    // Dashboard should have at least one chart
    expect(chartCount).toBeGreaterThan(0);
  });

  test('should navigate to different admin sections', async ({ page }) => {
    await page.goto('/admin');

    // Check for navigation links
    const adminSections = [
      { text: 'Tickets', url: '/tickets' },
      { text: 'Users', url: '/users' },
      { text: 'Settings', url: '/settings' },
    ];

    for (const section of adminSections) {
      const link = page.locator(`a:has-text("${section.text}")`).first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain(section.url);
      }
    }
  });

  test('should access ITIL dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard/itil');

    // Should display ITIL-specific metrics
    await expect(page.locator('text=/itil/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display users list', async ({ page }) => {
    await page.goto('/admin/users');

    // Should show users table
    await expect(page.locator('table, [data-testid="users-list"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display user details', async ({ page }) => {
    await page.goto('/admin/users');

    // Click on first user
    const firstUserRow = page.locator('table tbody tr, [data-testid="user-row"]').first();
    if (await firstUserRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstUserRow.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should search for users', async ({ page }) => {
    await page.goto('/admin/users');

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('admin');
      await page.waitForTimeout(1000);

      // Should show admin user
      await expect(page.locator('text=/admin/i')).toBeVisible();
    }
  });

  test('should navigate to create new user page', async ({ page }) => {
    await page.goto('/admin/users');

    const newUserButton = page.locator('a:has-text("New User"), a:has-text("Add User"), button:has-text("New User")').first();

    if (await newUserButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newUserButton.click();
      await expect(page).toHaveURL(/\/users\/new/);
    }
  });

  test('should create new user', async ({ page }) => {
    await page.goto('/admin/users/new');

    const uniqueEmail = generateUniqueEmail();

    await page.fill('input[name="name"]', 'Test Admin User');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', 'TestPassword123!');

    // Select role if available
    const roleSelect = page.locator('select[name="role"]');
    if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roleSelect.selectOption('agent');
    }

    await page.click('button[type="submit"]');

    // Should redirect to users list or user details
    await page.waitForURL(/\/users/, { timeout: 10000 });
  });

  test('should edit existing user', async ({ page }) => {
    await page.goto('/admin/users');

    // Find and click edit button for first user
    const editButton = page.locator('a[href*="/edit"], button:has-text("Edit")').first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      await expect(page).toHaveURL(/\/edit/);

      // Make a change
      const nameInput = page.locator('input[name="name"]');
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const currentValue = await nameInput.inputValue();
        await nameInput.fill(currentValue + ' Updated');

        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should filter users by role', async ({ page }) => {
    await page.goto('/admin/users');

    const roleFilter = page.locator('select[name="role"], button:has-text("Role")').first();

    if (await roleFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      if ((await roleFilter.tagName()) === 'SELECT') {
        await roleFilter.selectOption('admin');
      } else {
        await roleFilter.click();
        await page.locator('text=Admin').first().click();
      }

      await page.waitForTimeout(1000);
    }
  });

  test('should deactivate user', async ({ page }) => {
    await page.goto('/admin/users');

    const deactivateButton = page.locator('button:has-text("Deactivate"), button:has-text("Disable")').first();

    if (await deactivateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deactivateButton.click();

      // Confirm if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }

      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display analytics page', async ({ page }) => {
    await page.goto('/analytics');

    // Should show analytics content
    await expect(page.locator('text=/analytics|reports|statistics/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display ticket statistics', async ({ page }) => {
    await page.goto('/analytics');

    // Look for statistical data
    const statElements = page.locator('[class*="stat"], [data-testid*="stat"]');
    const count = await statElements.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should filter analytics by date range', async ({ page }) => {
    await page.goto('/analytics');

    const dateFilter = page.locator('input[type="date"], input[name*="date"]').first();

    if (await dateFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateFilter.fill('2024-01-01');
      await page.waitForTimeout(1000);
    }
  });

  test('should export analytics data', async ({ page }) => {
    await page.goto('/analytics');

    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click export button
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        exportButton.click(),
      ]);

      if (download) {
        expect(download.suggestedFilename()).toBeTruthy();
      }
    }
  });

  test('should display agent performance metrics', async ({ page }) => {
    await page.goto('/admin/dashboard/itil');

    // Look for agent-related metrics
    await expect(page.locator('text=/agent|performance/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should display SLA compliance metrics', async ({ page }) => {
    await page.goto('/admin/sla');

    // Should show SLA information
    await expect(page.locator('text=/sla/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display settings page', async ({ page }) => {
    await page.goto('/admin/settings');

    // Should show settings content
    await expect(page.locator('text=/settings|configuration/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to SLA settings', async ({ page }) => {
    await page.goto('/admin/settings');

    const slaLink = page.locator('a:has-text("SLA")').first();

    if (await slaLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slaLink.click();
      await expect(page).toHaveURL(/\/sla/);
    }
  });

  test('should navigate to automations settings', async ({ page }) => {
    await page.goto('/admin/settings');

    const automationsLink = page.locator('a:has-text("Automation")').first();

    if (await automationsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await automationsLink.click();
      await expect(page).toHaveURL(/\/automation/);
    }
  });

  test('should navigate to templates settings', async ({ page }) => {
    await page.goto('/admin/settings');

    const templatesLink = page.locator('a:has-text("Template")').first();

    if (await templatesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templatesLink.click();
      await expect(page).toHaveURL(/\/template/);
    }
  });

  test('should update system settings', async ({ page }) => {
    await page.goto('/admin/settings');

    const settingInput = page.locator('input[type="text"], input[type="number"]').first();

    if (await settingInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentValue = await settingInput.inputValue();
      await settingInput.fill('Updated Value');

      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display reports page', async ({ page }) => {
    await page.goto('/admin/reports');

    // Should show reports content
    await expect(page.locator('text=/reports/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should generate ticket report', async ({ page }) => {
    await page.goto('/admin/reports');

    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Report")').first();

    if (await generateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('should view ticket trends', async ({ page }) => {
    await page.goto('/reports/tickets');

    // Should display ticket trends
    await expect(page.locator('canvas, svg, [class*="chart"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('should view performance reports', async ({ page }) => {
    await page.goto('/reports/my-performance');

    // Should display performance data
    await expect(page.locator('text=/performance/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Teams Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display teams page', async ({ page }) => {
    await page.goto('/admin/teams');

    // Should show teams content
    await expect(page.locator('text=/teams/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should view team members', async ({ page }) => {
    await page.goto('/admin/teams');

    const teamRow = page.locator('table tbody tr, [data-testid="team-row"]').first();

    if (await teamRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await teamRow.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Knowledge Base Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display knowledge base page', async ({ page }) => {
    await page.goto('/admin/knowledge');

    // Should show knowledge base content
    await expect(page.locator('text=/knowledge/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should create new article', async ({ page }) => {
    await page.goto('/admin/knowledge');

    const newArticleButton = page.locator('a:has-text("New Article"), button:has-text("New Article")').first();

    if (await newArticleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newArticleButton.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('CMDB Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);
  });

  test('should display CMDB page', async ({ page }) => {
    await page.goto('/admin/cmdb');

    // Should show CMDB content
    await expect(page.locator('text=/cmdb|configuration/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to create new CI', async ({ page }) => {
    await page.goto('/admin/cmdb');

    const newCIButton = page.locator('a:has-text("New"), button:has-text("Add")').first();

    if (await newCIButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newCIButton.click();
      await page.waitForURL(/\/cmdb\/new/, { timeout: 5000 });
    }
  });
});
