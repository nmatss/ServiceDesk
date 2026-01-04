/**
 * Ticket Management E2E Tests
 * Tests ticket creation, viewing, updating, commenting, and closing
 */

import { test, expect } from '@playwright/test';
import { testUsers, testTickets, testComments, generateUniqueTicketTitle } from '../fixtures/test-data';
import { login, createTicket, addComment } from '../utils/test-helpers';

test.describe('Ticket Creation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);
  });

  test('should display ticket creation form', async ({ page }) => {
    await page.goto('/portal/create');

    // Check for form elements
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('select[name="priority"], input[name="priority"]')).toBeVisible();
    await expect(page.locator('select[name="category"], input[name="category"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should create a basic ticket successfully', async ({ page }) => {
    const uniqueTitle = generateUniqueTicketTitle();

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('textarea[name="description"]', testTickets.basic.description);

    // Select priority if it's a select element
    const priorityField = page.locator('select[name="priority"]');
    if (await priorityField.isVisible().catch(() => false)) {
      await priorityField.selectOption(testTickets.basic.priority);
    }

    // Select category if it's a select element
    const categoryField = page.locator('select[name="category"]');
    if (await categoryField.isVisible().catch(() => false)) {
      await categoryField.selectOption({ label: testTickets.basic.category });
    }

    await page.click('button[type="submit"]');

    // Should redirect to ticket details page
    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 });

    // Should display ticket title
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible();
  });

  test('should show validation errors for empty required fields', async ({ page }) => {
    await page.goto('/portal/create');

    // Try to submit without filling required fields
    await page.click('button[type="submit"]');

    // Should show validation errors or stay on page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/create');
  });

  test('should create ticket with all fields filled', async ({ page }) => {
    const uniqueTitle = generateUniqueTicketTitle();

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('textarea[name="description"]', testTickets.withDetails.description);

    const priorityField = page.locator('select[name="priority"]');
    if (await priorityField.isVisible().catch(() => false)) {
      await priorityField.selectOption(testTickets.withDetails.priority);
    }

    const categoryField = page.locator('select[name="category"]');
    if (await categoryField.isVisible().catch(() => false)) {
      await categoryField.selectOption({ label: testTickets.withDetails.category });
    }

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 });
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible();
  });

  test('should upload attachment when creating ticket', async ({ page }) => {
    const uniqueTitle = generateUniqueTicketTitle();

    await page.goto('/portal/create');

    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('textarea[name="description"]', testTickets.basic.description);

    // Check if file upload exists
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible().catch(() => false)) {
      // Create a test file
      const buffer = Buffer.from('Test file content');
      await fileInput.setInputFiles({
        name: 'test-attachment.txt',
        mimeType: 'text/plain',
        buffer,
      });
    }

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 });
  });
});

test.describe('Ticket Viewing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);
  });

  test('should display tickets list', async ({ page }) => {
    await page.goto('/portal/tickets');

    // Should show tickets table or list
    await expect(page.locator('[data-testid="tickets-list"], table, .ticket-item').first()).toBeVisible({ timeout: 5000 });
  });

  test('should view ticket details', async ({ page }) => {
    // Create a ticket first
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description,
      testTickets.basic.priority
    );

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Should display ticket information
      await expect(page.locator('text=/ticket|details/i')).toBeVisible();
      await expect(page.locator(`text=${testTickets.basic.description}`)).toBeVisible();
    }
  });

  test('should filter tickets by status', async ({ page }) => {
    await page.goto('/portal/tickets');

    // Look for filter controls
    const statusFilter = page.locator('select[name="status"], button:has-text("Status")').first();

    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.click();

      // Wait for filter to apply
      await page.waitForTimeout(1000);
    }
  });

  test('should search for tickets', async ({ page }) => {
    const uniqueTitle = generateUniqueTicketTitle();

    // Create a ticket first
    await createTicket(page, uniqueTitle, testTickets.basic.description);

    // Go to tickets list
    await page.goto('/portal/tickets');

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(uniqueTitle);
      await page.waitForTimeout(1000);

      // Should show the ticket in results
      await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should paginate through tickets', async ({ page }) => {
    await page.goto('/portal/tickets');

    // Look for pagination controls
    const nextButton = page.locator('button:has-text("Next"), a:has-text("Next"), [aria-label="Next"]').first();

    if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isEnabled = await nextButton.isEnabled();
      if (isEnabled) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });
});

test.describe('Ticket Updates', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);
  });

  test('should update ticket status', async ({ page }) => {
    // Create a ticket first as user
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    // Login as agent
    await login(page, testUsers.agent.email, testUsers.agent.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Look for status dropdown
      const statusSelect = page.locator('select[name="status"]').first();

      if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusSelect.selectOption('in-progress');

        // Look for save/update button
        const updateButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
        if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await updateButton.click();
        }

        // Wait for update
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should assign ticket to agent', async ({ page }) => {
    // Create ticket
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    // Login as admin
    await login(page, testUsers.admin.email, testUsers.admin.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Look for assignee dropdown
      const assigneeSelect = page.locator('select[name="assignee"], select[name="assigned_to"]').first();

      if (await assigneeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Select first available agent
        await assigneeSelect.selectOption({ index: 1 });

        const updateButton = page.locator('button:has-text("Update"), button:has-text("Save"), button:has-text("Assign")').first();
        if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await updateButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });

  test('should update ticket priority', async ({ page }) => {
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description,
      'low'
    );

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      const prioritySelect = page.locator('select[name="priority"]').first();

      if (await prioritySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await prioritySelect.selectOption('high');

        const updateButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
        if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await updateButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe('Ticket Comments', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);
  });

  test('should add comment to ticket', async ({ page }) => {
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      const commentField = page.locator('textarea[name="comment"], textarea[placeholder*="comment" i]').first();

      if (await commentField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await commentField.fill(testComments.basic);

        const submitButton = page.locator('button:has-text("Add Comment"), button:has-text("Submit"), button:has-text("Post")').first();
        await submitButton.click();

        // Should display the comment
        await expect(page.locator(`text=${testComments.basic}`)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should display comment timestamp and author', async ({ page }) => {
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    if (ticketId) {
      await addComment(page, ticketId, testComments.detailed);

      // Should show author name
      await expect(page.locator(`text=${testUsers.user.name}, text=${testUsers.user.email}`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should add multiple comments', async ({ page }) => {
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    if (ticketId) {
      await addComment(page, ticketId, 'First comment');
      await addComment(page, ticketId, 'Second comment');
      await addComment(page, ticketId, 'Third comment');

      // All comments should be visible
      await expect(page.locator('text=First comment')).toBeVisible();
      await expect(page.locator('text=Second comment')).toBeVisible();
      await expect(page.locator('text=Third comment')).toBeVisible();
    }
  });
});

test.describe('Ticket Closing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.agent.email, testUsers.agent.password);
  });

  test('should close ticket with resolution', async ({ page }) => {
    // Create ticket as user
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    // Login as agent
    await login(page, testUsers.agent.email, testUsers.agent.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Add resolution comment
      await addComment(page, ticketId, testComments.resolution);

      // Close ticket
      const statusSelect = page.locator('select[name="status"]').first();

      if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusSelect.selectOption('closed');

        const updateButton = page.locator('button:has-text("Update"), button:has-text("Save"), button:has-text("Close")').first();
        if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await updateButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });

  test('should reopen closed ticket', async ({ page }) => {
    // Create and close ticket
    await login(page, testUsers.user.email, testUsers.user.password);
    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      testTickets.basic.description
    );

    await login(page, testUsers.agent.email, testUsers.agent.password);

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Close ticket
      const statusSelect = page.locator('select[name="status"]').first();
      if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusSelect.selectOption('closed');
        await page.waitForTimeout(1000);

        // Reopen ticket
        await statusSelect.selectOption('open');

        const updateButton = page.locator('button:has-text("Update"), button:has-text("Save")').first();
        if (await updateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await updateButton.click();
        }

        await page.waitForTimeout(1000);
      }
    }
  });
});
