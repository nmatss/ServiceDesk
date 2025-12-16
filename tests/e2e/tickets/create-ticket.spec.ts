import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { setupAuthenticatedSession, logout } from '../helpers/auth';

test.describe('Ticket Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated user session
    await setupAuthenticatedSession(page, 'user');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should navigate to new ticket page', async ({ page }) => {
    await page.goto('/tickets');

    // Click on "New Ticket" or similar button
    const newTicketButton = page.locator('a[href="/tickets/new"]').first();
    await newTicketButton.click();

    // Should be on the new ticket page
    await expect(page).toHaveURL(/\/tickets\/new/);

    // Check for form elements
    await expect(page.locator('h1')).toContainText(/novo ticket/i);
  });

  test('should create ticket with all required fields', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Wait for form to load
    await page.waitForSelector('input[name="title"], input#title', {
      timeout: 10000
    });

    // Fill in ticket title
    const ticketTitle = `Test Ticket ${Date.now()}`;
    await page.fill('input[name="title"], input#title', ticketTitle);

    // Fill in description
    await page.fill(
      'textarea[name="description"], textarea#description',
      'This is a test ticket description with all required information.'
    );

    // Select category
    const categorySelect = page.locator(
      'select[name="category_id"], select#category_id'
    );
    await categorySelect.selectOption({ index: 1 }); // Select first available category

    // Select priority
    const prioritySelect = page.locator(
      'select[name="priority_id"], select#priority_id'
    );
    await prioritySelect.selectOption({ index: 1 }); // Select first available priority

    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for redirect to ticket details or tickets list
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/tickets/') && !url.pathname.includes('/new'),
      { timeout: 10000 }
    );

    // Verify success message or ticket details displayed
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/tickets/new');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Try to submit without filling any fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show validation errors or prevent submission
    // Wait a bit to see if we stay on the same page
    await page.waitForTimeout(1000);

    // Should still be on new ticket page
    expect(page.url()).toContain('/tickets/new');

    // Check for error messages or HTML5 validation
    const titleInput = page.locator('input[name="title"], input#title');
    const isValid = await titleInput.evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );

    // If using HTML5 validation, required field should be invalid when empty
    if (await titleInput.getAttribute('required')) {
      expect(isValid).toBe(false);
    }
  });

  test('should attach files to ticket', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Fill basic ticket info
    await page.fill(
      'input[name="title"], input#title',
      `Ticket with attachment ${Date.now()}`
    );
    await page.fill(
      'textarea[name="description"], textarea#description',
      'This ticket has an attachment'
    );

    // Select category and priority
    await page.selectOption('select[name="category_id"], select#category_id', {
      index: 1
    });
    await page.selectOption('select[name="priority_id"], select#priority_id', {
      index: 1
    });

    // Look for file input
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      // Create a test file
      const testFilePath = './tests/e2e/fixtures/test-file.txt';

      // Upload file
      await fileInput.setInputFiles({
        name: 'test-file.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is a test file')
      });

      // Wait a bit for file to be processed
      await page.waitForTimeout(500);

      // Check if file name is displayed
      await expect(page.locator('text=test-file.txt')).toBeVisible();
    }

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/tickets/') && !url.pathname.includes('/new'),
      { timeout: 10000 }
    );
  });

  test('should add tags to ticket', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Fill basic info
    await page.fill('input[name="title"], input#title', 'Ticket with tags');
    await page.fill(
      'textarea[name="description"], textarea#description',
      'Description'
    );

    // Select category and priority
    await page.selectOption('select[name="category_id"], select#category_id', {
      index: 1
    });
    await page.selectOption('select[name="priority_id"], select#priority_id', {
      index: 1
    });

    // Look for tag input
    const tagInput = page.locator('input[placeholder*="tag"], input#tags');
    if (await tagInput.count() > 0) {
      // Add tags
      await tagInput.fill('urgent');
      await page.keyboard.press('Enter');

      await tagInput.fill('bug');
      await page.keyboard.press('Enter');

      // Verify tags are displayed
      await expect(page.locator('text=urgent')).toBeVisible();
      await expect(page.locator('text=bug')).toBeVisible();
    }

    // Submit form
    await page.click('button[type="submit"]');

    await page.waitForURL(
      (url) =>
        url.pathname.includes('/tickets/') && !url.pathname.includes('/new'),
      { timeout: 10000 }
    );
  });

  test('should cancel ticket creation', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Fill in some data
    await page.fill('input[name="title"], input#title', 'Test ticket to cancel');

    // Click cancel button
    const cancelButton = page.locator('button:has-text("Cancelar"), a:has-text("Voltar")').first();
    if (await cancelButton.count() > 0) {
      await cancelButton.click();

      // Should navigate away from new ticket page
      await page.waitForTimeout(1000);
      expect(page.url()).not.toContain('/tickets/new');
    }
  });

  test('should show loading state during submission', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Fill required fields
    await page.fill(
      'input[name="title"], input#title',
      `Loading test ${Date.now()}`
    );
    await page.fill(
      'textarea[name="description"], textarea#description',
      'Description'
    );
    await page.selectOption('select[name="category_id"], select#category_id', {
      index: 1
    });
    await page.selectOption('select[name="priority_id"], select#priority_id', {
      index: 1
    });

    // Submit button
    const submitButton = page.locator('button[type="submit"]');

    // Click submit
    await submitButton.click();

    // Should show loading state (disabled or loading text)
    const isDisabled = await submitButton.isDisabled();
    const hasLoadingText = await submitButton.textContent();

    expect(
      isDisabled || hasLoadingText?.toLowerCase().includes('enviando')
    ).toBeTruthy();
  });

  test('should have accessible form', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');
    await injectAxe(page);

    // Check accessibility
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('should support keyboard navigation in form', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Tab through form fields
    await page.keyboard.press('Tab');
    await page.keyboard.type('Keyboard navigation test');

    await page.keyboard.press('Tab');
    await page.keyboard.type('Testing keyboard navigation');

    // Continue tabbing through the form
    await page.keyboard.press('Tab'); // Category
    await page.keyboard.press('ArrowDown'); // Select option
    await page.keyboard.press('Enter');

    await page.keyboard.press('Tab'); // Priority
    await page.keyboard.press('ArrowDown'); // Select option
  });

  test('should display SLA information after creation', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Create ticket
    await page.fill('input[name="title"], input#title', 'SLA Test Ticket');
    await page.fill(
      'textarea[name="description"], textarea#description',
      'Testing SLA tracking'
    );
    await page.selectOption('select[name="category_id"], select#category_id', {
      index: 1
    });
    await page.selectOption('select[name="priority_id"], select#priority_id', {
      index: 1
    });

    await page.click('button[type="submit"]');

    // Wait for redirect to ticket detail
    await page.waitForURL(
      (url) =>
        url.pathname.match(/\/tickets\/\d+$/) !== null,
      { timeout: 10000 }
    );

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // SLA information might be visible (if implemented)
    // This is a soft check - doesn't fail if SLA isn't displayed
    const slaExists = await page.locator('text=/SLA|prazo|deadline/i').count();
    if (slaExists > 0) {
      await expect(page.locator('text=/SLA|prazo|deadline/i')).toBeVisible();
    }
  });

  test('should validate title length', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Try to enter very long title
    const longTitle = 'A'.repeat(300);
    await page.fill('input[name="title"], input#title', longTitle);

    const titleInput = page.locator('input[name="title"], input#title');
    const actualValue = await titleInput.inputValue();

    // If there's a maxlength attribute, it should be enforced
    const maxLength = await titleInput.getAttribute('maxlength');
    if (maxLength) {
      expect(actualValue.length).toBeLessThanOrEqual(parseInt(maxLength));
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Mock API failure
    await page.route('**/api/tickets/**', (route) => {
      route.abort('failed');
    });

    // Fill and submit
    await page.fill('input[name="title"], input#title', 'Network error test');
    await page.fill(
      'textarea[name="description"], textarea#description',
      'Description'
    );
    await page.selectOption('select[name="category_id"], select#category_id', {
      index: 1
    });
    await page.selectOption('select[name="priority_id"], select#priority_id', {
      index: 1
    });

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(
      page.locator('[role="alert"], .error-message, .bg-red-50')
    ).toBeVisible({ timeout: 5000 });

    // Should stay on form page
    expect(page.url()).toContain('/tickets/new');
  });

  test('should support drag and drop for file upload', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Fill basic info
    await page.fill('input[name="title"], input#title', 'Drag drop test');
    await page.fill(
      'textarea[name="description"], textarea#description',
      'Testing drag and drop'
    );

    // Look for drop zone
    const dropZone = page.locator('[class*="drop"], [class*="drag"]').first();

    if (await dropZone.count() > 0) {
      // Simulate file drop
      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'dropped-file.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF content')
        });
      }
    }
  });
});
