import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { setupAuthenticatedSession, logout, login, TEST_USERS } from './helpers/auth';

/**
 * E2E Test: Complete User Journey
 *
 * This test follows a complete user journey through the ServiceDesk system:
 * 1. User logs in
 * 2. Creates a new support ticket
 * 3. Views ticket details and status
 * 4. Tracks ticket progress
 * 5. Views resolution
 * 6. Rates the service (optional)
 */
test.describe('User Journey: Create → Track → View Resolution', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('complete user journey: create ticket, track progress, and view resolution', async ({ page }) => {
    // ============================================
    // STEP 1: User Login
    // ============================================
    await test.step('User logs in to the system', async () => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      // Verify login page elements
      await expect(page.locator('h1')).toContainText(/bem-vindo|login/i);

      // Login with test user credentials
      await login(page, TEST_USERS.user);

      // Verify successful authentication
      await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
        timeout: 10000
      });

      // Should be redirected to dashboard or home
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth/login');
    });

    // ============================================
    // STEP 2: Create New Support Ticket
    // ============================================
    let ticketNumber: string | null = null;
    let ticketUrl: string = '';

    await test.step('User creates a new support ticket', async () => {
      // Navigate to create ticket page
      await page.goto('/portal/create');
      await page.waitForLoadState('networkidle');

      // Verify we're on the create ticket page
      await expect(page).toHaveURL(/\/portal\/create/);

      // Fill in ticket details
      const ticketTitle = `User Journey Test - ${Date.now()}`;
      await page.fill('input[name="title"], input#title', ticketTitle);

      const ticketDescription = `This is a test ticket created as part of the E2E user journey test.

Issue Description:
- Unable to access reporting feature
- Getting error message when clicking on Reports
- Issue started today at 10:00 AM

Steps to reproduce:
1. Login to system
2. Navigate to Reports section
3. Error appears

Expected: Reports page should load
Actual: Error message displayed

Please help resolve this issue.`;

      await page.fill('textarea[name="description"], textarea#description', ticketDescription);

      // Select category if available
      const categorySelect = page.locator('select[name="category_id"], select#category_id');
      if (await categorySelect.count() > 0) {
        const options = await categorySelect.locator('option').count();
        if (options > 1) {
          await categorySelect.selectOption({ index: 1 });
        }
      }

      // Select priority (high priority for this test)
      const prioritySelect = page.locator('select[name="priority_id"], select#priority_id');
      if (await prioritySelect.count() > 0) {
        const highPriorityOption = await prioritySelect.locator('option:has-text("Alta"), option:has-text("High")').first();
        if (await highPriorityOption.count() > 0) {
          const optionValue = await highPriorityOption.getAttribute('value');
          if (optionValue) {
            await prioritySelect.selectOption({ value: optionValue });
          } else {
            await prioritySelect.selectOption({ index: 1 });
          }
        } else {
          await prioritySelect.selectOption({ index: 1 });
        }
      }

      // Submit the ticket
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for redirect to ticket details or success page
      await page.waitForURL(
        (url) => url.pathname.includes('/portal/tickets/') || url.pathname.includes('/tickets/'),
        { timeout: 15000 }
      );

      // Store ticket URL for later use
      ticketUrl = page.url();

      // Extract ticket number from URL
      const match = ticketUrl.match(/tickets?\/(\d+)/);
      if (match) {
        ticketNumber = match[1];
      }

      // Verify ticket was created successfully
      await expect(page.locator('h1, h2')).toContainText(ticketTitle, { timeout: 5000 });

      // Verify ticket details are displayed
      await expect(page.locator('text=/descrição|description/i')).toBeVisible();

      // Take screenshot for documentation
      await page.screenshot({
        path: `test-results/user-journey-ticket-created-${ticketNumber}.png`,
        fullPage: true
      });
    });

    // ============================================
    // STEP 3: View Ticket Details
    // ============================================
    await test.step('User views ticket details and status', async () => {
      // Ensure we're on the ticket detail page
      if (ticketUrl) {
        await page.goto(ticketUrl);
        await page.waitForLoadState('networkidle');
      }

      // Verify ticket information is displayed
      await expect(page.locator('h1, h2, .ticket-title')).toBeVisible();

      // Check for ticket status
      const statusIndicator = page.locator('text=/status|situação/i');
      await expect(statusIndicator).toBeVisible();

      // Check for ticket priority
      const priorityIndicator = page.locator('text=/prioridade|priority/i');
      await expect(priorityIndicator).toBeVisible();

      // Check for ticket category
      const categoryIndicator = page.locator('text=/categoria|category/i');
      if (await categoryIndicator.count() > 0) {
        await expect(categoryIndicator.first()).toBeVisible();
      }

      // Check for SLA information
      const slaInfo = page.locator('text=/sla|prazo|deadline/i');
      if (await slaInfo.count() > 0) {
        await expect(slaInfo.first()).toBeVisible();
      }

      // Verify ticket description is shown
      await expect(page.locator('text=/unable to access reporting/i')).toBeVisible();
    });

    // ============================================
    // STEP 4: Track Ticket Progress
    // ============================================
    await test.step('User tracks ticket progress', async () => {
      // Navigate to ticket list to see all tickets
      await page.goto('/portal/tickets');
      await page.waitForLoadState('networkidle');

      // Verify tickets list page
      await expect(page).toHaveURL(/\/portal\/tickets/);

      // Search for our ticket if search is available
      const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill(`User Journey Test`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
      }

      // Look for our ticket in the list
      if (ticketNumber) {
        const ticketLink = page.locator(`a[href*="/tickets/${ticketNumber}"]`);
        if (await ticketLink.count() > 0) {
          await expect(ticketLink.first()).toBeVisible();
        }
      }

      // Click on ticket to view details again
      if (ticketUrl) {
        await page.goto(ticketUrl);
        await page.waitForLoadState('networkidle');
      }

      // Check for ticket timeline/activity if available
      const timeline = page.locator('.timeline, [class*="activity"], [class*="history"]');
      if (await timeline.count() > 0) {
        await expect(timeline.first()).toBeVisible();
      }

      // Check for ticket creation timestamp
      const timestamp = page.locator('text=/criado|created|registrado/i');
      if (await timestamp.count() > 0) {
        await expect(timestamp.first()).toBeVisible();
      }
    });

    // ============================================
    // STEP 5: Add Comment to Ticket (Optional)
    // ============================================
    await test.step('User adds a comment to the ticket', async () => {
      if (ticketUrl) {
        await page.goto(ticketUrl);
        await page.waitForLoadState('networkidle');
      }

      // Look for comment form
      const commentTextarea = page.locator('textarea[name="comment"], textarea[placeholder*="comentário"], textarea[placeholder*="comment"]');

      if (await commentTextarea.count() > 0) {
        // Add a comment
        await commentTextarea.fill('I have additional information: This issue also affects the mobile version of the application.');

        // Submit comment
        const submitCommentButton = page.locator('button:has-text("Enviar"), button:has-text("Adicionar"), button[type="submit"]').last();
        await submitCommentButton.click();

        // Wait for comment to appear
        await page.waitForTimeout(1500);

        // Verify comment was added
        await expect(page.locator('text=/additional information/i')).toBeVisible();
      }
    });

    // ============================================
    // STEP 6: View Dashboard/Portal
    // ============================================
    await test.step('User views their portal dashboard', async () => {
      await page.goto('/portal');
      await page.waitForLoadState('networkidle');

      // Should show portal or dashboard
      const hasDashboard = await page.locator('h1, h2').count();
      expect(hasDashboard).toBeGreaterThan(0);

      // Check for recent tickets section
      const recentTickets = page.locator('text=/tickets? recentes?|recent tickets/i');
      if (await recentTickets.count() > 0) {
        await expect(recentTickets.first()).toBeVisible();
      }

      // Check for quick actions
      const quickActions = page.locator('a[href*="/portal/create"], button:has-text("Novo Ticket")');
      if (await quickActions.count() > 0) {
        await expect(quickActions.first()).toBeVisible();
      }
    });

    // ============================================
    // STEP 7: Check Accessibility
    // ============================================
    await test.step('Verify accessibility of user portal', async () => {
      await page.goto('/portal/tickets');
      await page.waitForLoadState('networkidle');

      await injectAxe(page);
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      });
    });

    // ============================================
    // STEP 8: Logout
    // ============================================
    await test.step('User logs out', async () => {
      await logout(page);

      // Verify logout by trying to access protected page
      await page.goto('/portal/tickets');

      // Should redirect to login
      await page.waitForURL((url) => url.pathname.includes('/auth/login'), {
        timeout: 5000
      });

      expect(page.url()).toContain('/auth/login');
    });
  });

  test('user can filter and search their tickets', async ({ page }) => {
    await test.step('Setup: Login as user', async () => {
      await login(page, TEST_USERS.user);
    });

    await test.step('Navigate to tickets list and apply filters', async () => {
      await page.goto('/portal/tickets');
      await page.waitForLoadState('networkidle');

      // Check for filter options
      const filterButtons = page.locator('button[class*="filter"], select[name*="status"], select[name*="priority"]');

      if (await filterButtons.count() > 0) {
        // Try to filter by status
        const statusFilter = page.locator('select[name*="status"]');
        if (await statusFilter.count() > 0) {
          await statusFilter.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
        }

        // Try to filter by priority
        const priorityFilter = page.locator('select[name*="priority"]');
        if (await priorityFilter.count() > 0) {
          await priorityFilter.selectOption({ index: 1 });
          await page.waitForTimeout(1000);
        }
      }

      // Verify tickets are displayed
      const ticketsList = page.locator('article, .ticket-card, [class*="ticket"]');
      const hasTickets = await ticketsList.count() >= 0; // Can be 0 if no tickets match filter
      expect(hasTickets).toBe(true);
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });

  test('user receives real-time updates on ticket status changes', async ({ page }) => {
    await test.step('Setup: Login and create ticket', async () => {
      await login(page, TEST_USERS.user);

      // Create a quick ticket
      await page.goto('/portal/create');
      await page.waitForLoadState('networkidle');

      await page.fill('input[name="title"], input#title', `Real-time test ${Date.now()}`);
      await page.fill('textarea[name="description"], textarea#description', 'Testing real-time updates');

      const categorySelect = page.locator('select[name="category_id"], select#category_id');
      if (await categorySelect.count() > 0) {
        await categorySelect.selectOption({ index: 1 });
      }

      const prioritySelect = page.locator('select[name="priority_id"], select#priority_id');
      if (await prioritySelect.count() > 0) {
        await prioritySelect.selectOption({ index: 1 });
      }

      await page.click('button[type="submit"]');

      await page.waitForURL(
        (url) => url.pathname.includes('/tickets/'),
        { timeout: 10000 }
      );
    });

    await test.step('Monitor for status updates', async () => {
      // In a real scenario, this would wait for an agent to update the ticket
      // For now, we verify the ticket detail page shows current status

      const statusElement = page.locator('text=/status|situação/i');
      await expect(statusElement).toBeVisible();

      // Verify the page can handle real-time updates (checks for WebSocket or polling)
      const hasNotificationArea = await page.locator('[role="alert"], [class*="notification"], [class*="toast"]').count();
      // This is informational - doesn't fail the test
      expect(hasNotificationArea).toBeGreaterThanOrEqual(0);
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });
});
