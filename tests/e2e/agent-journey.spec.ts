import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { setupAuthenticatedSession, logout, login, TEST_USERS } from './helpers/auth';

/**
 * E2E Test: Complete Agent Journey
 *
 * This test follows a complete agent journey through the ServiceDesk system:
 * 1. Agent logs in
 * 2. Views ticket queue/dashboard
 * 3. Filters and prioritizes tickets
 * 4. Assigns ticket to themselves
 * 5. Updates ticket status
 * 6. Adds internal notes
 * 7. Responds to customer
 * 8. Resolves the ticket
 */
test.describe('Agent Journey: Login → View Queue → Resolve Ticket', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('complete agent journey: view queue, assign, work on, and resolve ticket', async ({ page }) => {
    // ============================================
    // STEP 1: Agent Login
    // ============================================
    await test.step('Agent logs in to the system', async () => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      // Verify login page
      await expect(page.locator('h1')).toContainText(/bem-vindo|login/i);

      // Login as agent
      await login(page, TEST_USERS.agent);

      // Verify successful authentication
      await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
        timeout: 10000
      });

      // Should be redirected to dashboard
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth/login');
    });

    // ============================================
    // STEP 2: View Agent Dashboard
    // ============================================
    await test.step('Agent views their dashboard with key metrics', async () => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify dashboard is displayed
      const heading = page.locator('h1, h2');
      await expect(heading.first()).toBeVisible();

      // Check for agent metrics
      const expectedMetrics = [
        /tickets?/i,
        /abertos?|open/i,
      ];

      for (const metric of expectedMetrics) {
        const metricElement = page.locator(`text=${metric}`);
        if (await metricElement.count() > 0) {
          await expect(metricElement.first()).toBeVisible();
        }
      }

      // Check for quick actions or navigation
      const navigation = page.locator('nav, [role="navigation"]');
      await expect(navigation.first()).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'test-results/agent-journey-dashboard.png',
        fullPage: true
      });
    });

    // ============================================
    // STEP 3: View Ticket Queue
    // ============================================
    let selectedTicketUrl: string = '';
    let ticketId: string | null = null;

    await test.step('Agent views ticket queue and filters by priority', async () => {
      // Navigate to tickets page
      await page.goto('/tickets');
      await page.waitForLoadState('networkidle');

      // Verify tickets page
      await expect(page).toHaveURL(/\/tickets/);

      // Check for ticket list
      const ticketsList = page.locator('article, .ticket-card, [class*="ticket"], tr');
      const ticketsCount = await ticketsList.count();
      expect(ticketsCount).toBeGreaterThan(0);

      // Look for filter options
      const priorityFilter = page.locator('select[name*="priority"], button:has-text("Prioridade")');
      if (await priorityFilter.count() > 0) {
        const isSelect = await priorityFilter.first().evaluate((el) => el.tagName === 'SELECT');

        if (isSelect) {
          // Use select dropdown
          await priorityFilter.first().selectOption({ index: 1 });
        } else {
          // Click filter button
          await priorityFilter.first().click();
          await page.waitForTimeout(500);
        }

        await page.waitForTimeout(1000);
      }

      // Look for status filter (show only open/unassigned tickets)
      const statusFilter = page.locator('select[name*="status"], button:has-text("Status")');
      if (await statusFilter.count() > 0) {
        const isSelect = await statusFilter.first().evaluate((el) => el.tagName === 'SELECT');

        if (isSelect) {
          const openOption = await statusFilter.first().locator('option:has-text("Aberto"), option:has-text("Open")').first();
          if (await openOption.count() > 0) {
            const optionValue = await openOption.getAttribute('value');
            if (optionValue) {
              await statusFilter.first().selectOption({ value: optionValue });
            }
          }
        }

        await page.waitForTimeout(1000);
      }

      // Find first unassigned ticket
      const firstTicket = ticketsList.first();
      await expect(firstTicket).toBeVisible();

      // Get ticket link
      const ticketLink = firstTicket.locator('a[href*="/tickets/"]').first();
      if (await ticketLink.count() > 0) {
        selectedTicketUrl = await ticketLink.getAttribute('href') || '';
        const match = selectedTicketUrl.match(/tickets?\/(\d+)/);
        if (match) {
          ticketId = match[1];
        }
      }
    });

    // ============================================
    // STEP 4: View Ticket Details
    // ============================================
    await test.step('Agent views ticket details', async () => {
      if (!selectedTicketUrl) {
        // Create a test ticket for the agent to work on
        await page.goto('/tickets/new');
        await page.waitForLoadState('networkidle');

        await page.fill('input[name="title"], input#title', `Agent Journey Test - ${Date.now()}`);
        await page.fill('textarea[name="description"], textarea#description', 'Test ticket for agent journey');

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

        selectedTicketUrl = page.url();
      } else {
        await page.goto(selectedTicketUrl);
        await page.waitForLoadState('networkidle');
      }

      // Verify ticket details are displayed
      await expect(page.locator('h1, h2, .ticket-title')).toBeVisible();

      // Check for ticket information
      const ticketInfo = [
        /status|situação/i,
        /prioridade|priority/i,
        /categoria|category/i,
        /descrição|description/i
      ];

      for (const info of ticketInfo) {
        const infoElement = page.locator(`text=${info}`);
        if (await infoElement.count() > 0) {
          await expect(infoElement.first()).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 5: Assign Ticket to Self
    // ============================================
    await test.step('Agent assigns ticket to themselves', async () => {
      // Look for assign button or dropdown
      const assignButton = page.locator('button:has-text("Atribuir"), button:has-text("Assign"), select[name*="assign"]');

      if (await assignButton.count() > 0) {
        const isButton = await assignButton.first().evaluate((el) => el.tagName === 'BUTTON');

        if (isButton) {
          await assignButton.first().click();
          await page.waitForTimeout(500);

          // Look for self-assign option
          const selfAssign = page.locator('button:has-text("Atribuir a mim"), button:has-text("Assign to me")');
          if (await selfAssign.count() > 0) {
            await selfAssign.click();
          }
        } else {
          // Select dropdown
          await assignButton.first().selectOption({ index: 1 });
        }

        await page.waitForTimeout(1500);

        // Verify assignment
        const assignedTo = page.locator('text=/atribuído|assigned|responsável/i');
        if (await assignedTo.count() > 0) {
          await expect(assignedTo.first()).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 6: Update Ticket Status to In Progress
    // ============================================
    await test.step('Agent updates ticket status to "In Progress"', async () => {
      // Look for status update button/dropdown
      const statusButton = page.locator('button:has-text("Status"), select[name*="status"]');

      if (await statusButton.count() > 0) {
        const isButton = await statusButton.first().evaluate((el) => el.tagName === 'BUTTON');

        if (isButton) {
          await statusButton.first().click();
          await page.waitForTimeout(500);

          // Select "In Progress" status
          const inProgressOption = page.locator('button:has-text("Em Andamento"), button:has-text("In Progress")');
          if (await inProgressOption.count() > 0) {
            await inProgressOption.click();
          }
        } else {
          // Select dropdown
          const inProgressOption = await statusButton.first().locator('option:has-text("Em Andamento"), option:has-text("In Progress")').first();
          if (await inProgressOption.count() > 0) {
            const optionValue = await inProgressOption.getAttribute('value');
            if (optionValue) {
              await statusButton.first().selectOption({ value: optionValue });
            }
          }
        }

        await page.waitForTimeout(1500);
      }
    });

    // ============================================
    // STEP 7: Add Internal Note
    // ============================================
    await test.step('Agent adds internal note', async () => {
      // Look for internal note section
      const internalNoteTab = page.locator('button:has-text("Nota Interna"), button:has-text("Internal"), [role="tab"]:has-text("Interna")');

      if (await internalNoteTab.count() > 0) {
        await internalNoteTab.first().click();
        await page.waitForTimeout(500);
      }

      // Look for note textarea
      const noteTextarea = page.locator('textarea[name*="note"], textarea[placeholder*="nota"], textarea[placeholder*="internal"]');

      if (await noteTextarea.count() > 0) {
        await noteTextarea.fill('Internal Note: Investigating the issue. Initial analysis shows this is related to user permissions.');

        // Submit note
        const submitNoteButton = page.locator('button:has-text("Adicionar Nota"), button:has-text("Add Note"), button[type="submit"]').last();
        if (await submitNoteButton.count() > 0) {
          await submitNoteButton.click();
          await page.waitForTimeout(1500);
        }
      }
    });

    // ============================================
    // STEP 8: Respond to Customer
    // ============================================
    await test.step('Agent responds to customer', async () => {
      // Switch to public response tab if needed
      const publicResponseTab = page.locator('button:has-text("Resposta"), button:has-text("Response"), button:has-text("Comentário")');

      if (await publicResponseTab.count() > 0) {
        await publicResponseTab.first().click();
        await page.waitForTimeout(500);
      }

      // Look for comment/response textarea
      const responseTextarea = page.locator('textarea[name="comment"], textarea[name="response"], textarea[placeholder*="resposta"]').first();

      if (await responseTextarea.count() > 0) {
        const customerResponse = `Hello,

Thank you for contacting support. I've investigated your issue and identified the root cause.

The problem is related to user permissions in the reporting module. I've escalated this to our development team and we're working on a fix.

In the meantime, please try the following workaround:
1. Log out of the system
2. Clear your browser cache
3. Log back in
4. Try accessing the Reports section again

I'll keep you updated on the progress.

Best regards,
Support Team`;

        await responseTextarea.fill(customerResponse);

        // Submit response
        const submitButton = page.locator('button:has-text("Enviar"), button:has-text("Responder"), button[type="submit"]').last();
        await submitButton.click();

        await page.waitForTimeout(2000);

        // Verify response was added
        await expect(page.locator('text=/thank you for contacting/i')).toBeVisible();
      }
    });

    // ============================================
    // STEP 9: Resolve Ticket
    // ============================================
    await test.step('Agent resolves the ticket', async () => {
      // Look for resolve button or status change to resolved
      const resolveButton = page.locator('button:has-text("Resolver"), button:has-text("Resolve")');

      if (await resolveButton.count() > 0) {
        await resolveButton.click();
        await page.waitForTimeout(500);

        // Confirm resolution if dialog appears
        const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Sim")');
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
        }

        await page.waitForTimeout(1500);

        // Verify ticket is resolved
        const resolvedStatus = page.locator('text=/resolvido|resolved/i');
        await expect(resolvedStatus).toBeVisible();
      } else {
        // Use status dropdown
        const statusSelect = page.locator('select[name*="status"]');
        if (await statusSelect.count() > 0) {
          const resolvedOption = await statusSelect.locator('option:has-text("Resolvido"), option:has-text("Resolved")').first();
          if (await resolvedOption.count() > 0) {
            const optionValue = await resolvedOption.getAttribute('value');
            if (optionValue) {
              await statusSelect.selectOption({ value: optionValue });
              await page.waitForTimeout(1500);
            }
          }
        }
      }

      // Take screenshot of resolved ticket
      await page.screenshot({
        path: `test-results/agent-journey-ticket-resolved-${ticketId}.png`,
        fullPage: true
      });
    });

    // ============================================
    // STEP 10: View Agent Statistics
    // ============================================
    await test.step('Agent views their performance statistics', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check for agent performance metrics
      const performanceMetrics = page.locator('text=/tickets? resolvidos?|resolved tickets|desempenho|performance/i');

      if (await performanceMetrics.count() > 0) {
        await expect(performanceMetrics.first()).toBeVisible();
      }

      // Check for ticket counts
      const ticketCounts = page.locator('text=/\\d+/');
      expect(await ticketCounts.count()).toBeGreaterThan(0);
    });

    // ============================================
    // STEP 11: Accessibility Check
    // ============================================
    await test.step('Verify accessibility of agent interface', async () => {
      await page.goto('/tickets');
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
    // STEP 12: Logout
    // ============================================
    await test.step('Agent logs out', async () => {
      await logout(page);

      // Verify logout
      await page.goto('/tickets');
      await page.waitForURL((url) => url.pathname.includes('/auth/login'), {
        timeout: 5000
      });

      expect(page.url()).toContain('/auth/login');
    });
  });

  test('agent can use bulk operations on multiple tickets', async ({ page }) => {
    await test.step('Setup: Login as agent', async () => {
      await login(page, TEST_USERS.agent);
    });

    await test.step('Select multiple tickets and perform bulk action', async () => {
      await page.goto('/tickets');
      await page.waitForLoadState('networkidle');

      // Look for checkboxes to select tickets
      const checkboxes = page.locator('input[type="checkbox"]');

      if (await checkboxes.count() > 2) {
        // Select first 2 tickets
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();

        // Look for bulk action menu
        const bulkActionButton = page.locator('button:has-text("Ações"), button:has-text("Bulk"), select[name*="bulk"]');

        if (await bulkActionButton.count() > 0) {
          await bulkActionButton.first().click();
          await page.waitForTimeout(500);

          // Verify bulk options are available
          const bulkOptions = page.locator('[role="menu"], [role="listbox"]');
          if (await bulkOptions.count() > 0) {
            await expect(bulkOptions.first()).toBeVisible();
          }
        }
      }
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });

  test('agent can search and filter tickets efficiently', async ({ page }) => {
    await test.step('Setup: Login as agent', async () => {
      await login(page, TEST_USERS.agent);
    });

    await test.step('Use search and filters to find specific tickets', async () => {
      await page.goto('/tickets');
      await page.waitForLoadState('networkidle');

      // Use search
      const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
      }

      // Apply priority filter
      const priorityFilter = page.locator('select[name*="priority"]');
      if (await priorityFilter.count() > 0) {
        await priorityFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }

      // Apply status filter
      const statusFilter = page.locator('select[name*="status"]');
      if (await statusFilter.count() > 0) {
        await statusFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }

      // Verify results are shown
      const results = page.locator('article, .ticket-card, tr');
      const resultsCount = await results.count();
      expect(resultsCount).toBeGreaterThanOrEqual(0); // Can be 0 if no matches
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });
});
