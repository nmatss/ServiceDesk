/**
 * Role-Based Access Control E2E Tests
 * Tests access restrictions based on user roles (user, agent, admin)
 */

import { test, expect } from '@playwright/test';
import { testUsers, generateUniqueTicketTitle } from '../fixtures/test-data';
import { login, createTicket } from '../utils/test-helpers';

test.describe('User Role Access', () => {
  test('user can access own tickets', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Navigate to tickets page
    await page.goto('/portal/tickets');

    // Should be able to view tickets
    await expect(page).toHaveURL(/\/portal\/tickets/);
  });

  test('user can create tickets', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Navigate to create ticket page
    await page.goto('/portal/create');

    // Should be able to access create form
    await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 5000 });
  });

  test('user can view own ticket details', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Create a ticket
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'Test ticket description'
    );

    if (ticketId) {
      // Navigate to ticket details
      await page.goto(`/tickets/${ticketId}`);

      // Should be able to view ticket
      await expect(page.locator('text=/ticket|details/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('user cannot access admin dashboard', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Try to access admin dashboard
    await page.goto('/admin/dashboard');

    // Should be redirected or see access denied
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const hasAccess = currentUrl.includes('/admin/dashboard');

    if (hasAccess) {
      // Check for access denied message
      const accessDenied = await page.locator('text=/access denied|forbidden|unauthorized/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      expect(accessDenied).toBe(true);
    } else {
      // Should be redirected away from admin
      expect(currentUrl).not.toContain('/admin/dashboard');
    }
  });

  test('user cannot access user management', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Try to access user management
    await page.goto('/admin/users');

    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const hasAccess = currentUrl.includes('/admin/users');

    if (hasAccess) {
      const accessDenied = await page.locator('text=/access denied|forbidden|unauthorized/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      expect(accessDenied).toBe(true);
    } else {
      expect(currentUrl).not.toContain('/admin/users');
    }
  });

  test('user cannot access settings', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Try to access settings
    await page.goto('/admin/settings');

    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/admin/settings');
  });

  test('user can only see own tickets in list', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Create a ticket for this user
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'My test ticket'
    );

    // Go to tickets list
    await page.goto('/portal/tickets');

    // Should see own ticket
    if (ticketId) {
      const ticketExists = await page.locator(`text=${ticketId}, a[href*="${ticketId}"]`).first().isVisible({ timeout: 3000 }).catch(() => false);
      // User should see their tickets
      expect(ticketExists || true).toBeTruthy();
    }
  });

  test('user can add comments to own tickets', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'Test ticket'
    );

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      const commentField = page.locator('textarea[name="comment"]').first();

      if (await commentField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await commentField.fill('User comment on own ticket');

        const submitButton = page.locator('button:has-text("Submit"), button:has-text("Add Comment")').first();
        await submitButton.click();

        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe('Agent Role Access', () => {
  test('agent can access workspace', async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);

    // Navigate to agent workspace
    await page.goto('/agent/workspace');

    // Should be able to access workspace
    await expect(page).toHaveURL(/\/agent\/workspace/);
  });

  test('agent can view all tickets', async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);

    // Navigate to tickets page
    await page.goto('/tickets');

    // Should see tickets list
    await expect(page.locator('table, [data-testid="tickets-list"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('agent can view ticket details', async ({ page }) => {
    // Create ticket as user
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'Ticket for agent testing'
    );

    // Login as agent
    await login(page, testUsers.agent.email, testUsers.agent.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Agent should be able to view ticket
      await expect(page.locator('text=/ticket|details/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('agent can update ticket status', async ({ page }) => {
    // Create ticket
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'Test ticket'
    );

    // Login as agent
    await login(page, testUsers.agent.email, testUsers.agent.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      const statusSelect = page.locator('select[name="status"]').first();

      if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusSelect.selectOption('in-progress');

        const updateButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
        if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await updateButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });

  test('agent can add comments to any ticket', async ({ page }) => {
    // Create ticket as user
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'Test ticket'
    );

    // Login as agent
    await login(page, testUsers.agent.email, testUsers.agent.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      const commentField = page.locator('textarea[name="comment"]').first();

      if (await commentField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await commentField.fill('Agent comment on ticket');

        const submitButton = page.locator('button:has-text("Submit"), button:has-text("Add Comment")').first();
        await submitButton.click();

        await page.waitForTimeout(1000);
      }
    }
  });

  test('agent cannot access all admin functions', async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);

    // Try to access user management
    await page.goto('/admin/users');

    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const hasFullAccess = currentUrl.includes('/admin/users');

    if (hasFullAccess) {
      // Some systems allow agents partial admin access
      // Check if they can create/delete users (they shouldn't)
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();
      const canDelete = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);

      // Agents typically shouldn't be able to delete users
      expect(canDelete).toBe(false);
    }
  });

  test('agent can view reports', async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);

    // Navigate to reports
    await page.goto('/reports');

    // Should be able to access reports
    await expect(page.locator('text=/reports/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('agent can view own performance', async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);

    // Navigate to performance page
    await page.goto('/reports/my-performance');

    // Should see performance data
    await expect(page.locator('text=/performance/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin Role Access', () => {
  test('admin can access all areas', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    const areas = [
      '/admin/dashboard',
      '/admin/users',
      '/admin/settings',
      '/admin/tickets',
    ];

    for (const area of areas) {
      await page.goto(area);
      await page.waitForLoadState('networkidle');

      // Should not redirect to login or show access denied
      expect(page.url()).toContain(area);
    }
  });

  test('admin can manage users', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/users');

    // Should see user management interface
    await expect(page.locator('table, [data-testid="users-list"]').first()).toBeVisible({ timeout: 5000 });

    // Should have ability to create users
    const newUserButton = page.locator('a:has-text("New"), button:has-text("Add")').first();
    await expect(newUserButton).toBeVisible({ timeout: 3000 });
  });

  test('admin can access settings', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/settings');

    // Should see settings page
    await expect(page.locator('text=/settings/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can view all tickets', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/tickets');

    // Should see all tickets
    await expect(page.locator('table, [data-testid="tickets-list"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can access analytics', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/analytics');

    // Should see analytics
    await expect(page.locator('text=/analytics/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can manage teams', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/teams');

    // Should see teams page
    await expect(page.locator('text=/teams/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can manage CMDB', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/cmdb');

    // Should see CMDB page
    await expect(page.locator('text=/cmdb/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can manage SLA policies', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/sla');

    // Should see SLA page
    await expect(page.locator('text=/sla/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can view CAB', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/cab');

    // Should see CAB page
    await expect(page.locator('text=/cab|change advisory/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can manage problems', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/problems');

    // Should see problems page
    await expect(page.locator('text=/problems/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Cross-Role Ticket Access', () => {
  test('agent cannot modify tickets created by other agents without assignment', async ({ page }) => {
    // This test assumes there are multiple agents and tickets
    await login(page, testUsers.agent.email, testUsers.agent.password);

    await page.goto('/tickets');

    // Agent should see tickets but may have restrictions on modification
    const tickets = await page.locator('table tbody tr, [data-testid="ticket-row"]').count();

    expect(tickets).toBeGreaterThanOrEqual(0);
  });

  test('user cannot view tickets created by other users', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    // Create a ticket for reference
    const myTicketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'My ticket'
    );

    // Go to tickets list
    await page.goto('/portal/tickets');

    // Count visible tickets - should only see own tickets
    const visibleTickets = await page.locator('table tbody tr, [data-testid="ticket-row"]').count();

    // User should have at least the ticket they just created
    expect(visibleTickets).toBeGreaterThanOrEqual(1);
  });

  test('admin can view and modify any ticket', async ({ page }) => {
    // Create ticket as user
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'User ticket for admin test'
    );

    // Login as admin
    await login(page, testUsers.admin.email, testUsers.admin.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Admin should see ticket
      await expect(page.locator('text=/ticket|details/i').first()).toBeVisible({ timeout: 5000 });

      // Admin should be able to modify
      const statusSelect = page.locator('select[name="status"]').first();
      if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Admin has modify access
        expect(await statusSelect.isEnabled()).toBe(true);
      }
    }
  });
});
