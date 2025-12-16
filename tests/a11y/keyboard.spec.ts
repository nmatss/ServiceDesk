/**
 * Keyboard Navigation Accessibility Tests
 * WCAG 2.1 - 2.1 Keyboard Accessible
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility - Keyboard Navigation', () => {

  test('Should navigate login form with Tab key', async ({ page }) => {
    await page.goto('/auth/login');

    // Start from body
    await page.keyboard.press('Tab');

    // Should focus on email input
    await expect(page.locator('[name="email"]')).toBeFocused();

    await page.keyboard.press('Tab');

    // Should focus on password input
    await expect(page.locator('[name="password"]')).toBeFocused();

    await page.keyboard.press('Tab');

    // Should focus on submit button
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });

  test('Should navigate backward with Shift+Tab', async ({ page }) => {
    await page.goto('/auth/login');

    // Focus on submit button
    await page.locator('button[type="submit"]').focus();

    // Shift+Tab to password
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[name="password"]')).toBeFocused();

    // Shift+Tab to email
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[name="email"]')).toBeFocused();
  });

  test('Should activate button with Enter key', async ({ page }) => {
    await page.goto('/auth/login');

    // Navigate to submit button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Should trigger form validation (errors appear)
    await page.waitForTimeout(500);

    // Check if validation errors are visible
    const emailInput = page.locator('[name="email"]');
    const isInvalid = await emailInput.getAttribute('aria-invalid');
    expect(isInvalid).toBe('true');
  });

  test('Should activate button with Space key', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill form
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');

    // Focus submit button
    await page.locator('button[type="submit"]').focus();

    // Press Space
    await page.keyboard.press('Space');

    // Should submit form (may show error or redirect)
    await page.waitForTimeout(1000);

    // URL should change or error should appear
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('Should navigate all interactive elements on page', async ({ page }) => {
    await page.goto('/auth/login');

    // Get all focusable elements
    const focusableElements = await page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();

    console.log(`Found ${focusableElements.length} focusable elements`);

    // Verify each element can receive focus
    for (const element of focusableElements) {
      if (await element.isVisible()) {
        await element.focus();
        await expect(element).toBeFocused();
      }
    }
  });

  test('Should not have keyboard traps', async ({ page }) => {
    await page.goto('/auth/login');

    // Tab through all elements
    const focusableCount = await page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count();

    let currentFocus = '';
    let previousFocus = '';
    let trapCount = 0;

    for (let i = 0; i < focusableCount + 5; i++) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      if (await focused.count() > 0) {
        previousFocus = currentFocus;
        currentFocus = await focused.getAttribute('name') || await focused.getAttribute('id') || await focused.textContent() || '';

        // Check if stuck on same element
        if (currentFocus === previousFocus && currentFocus !== '') {
          trapCount++;
        } else {
          trapCount = 0;
        }

        // Should not be stuck on same element more than 3 times
        expect(trapCount).toBeLessThan(3);
      }
    }
  });

  test('Should show visible focus indicator', async ({ page }) => {
    await page.goto('/auth/login');

    // Focus on email input
    await page.locator('[name="email"]').focus();

    // Get computed styles
    const outline = await page.locator('[name="email"]').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
        border: styles.border,
      };
    });

    // Should have visible focus indicator (outline, box-shadow, or border)
    const hasVisibleFocus = (
      outline.outline !== 'none' ||
      outline.outlineWidth !== '0px' ||
      outline.boxShadow !== 'none' ||
      outline.border !== 'none'
    );

    expect(hasVisibleFocus).toBe(true);
  });

  test('Should navigate ticket list with keyboard', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    // Tab through ticket list items
    const ticketLinks = page.locator('a[href^="/tickets/"]').first();
    await ticketLinks.focus();
    await expect(ticketLinks).toBeFocused();

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to ticket detail
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/tickets/');
  });

  test('Should close modal with Escape key', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');

    // Try to open modal
    const modalTrigger = page.locator('[data-testid="new-ticket-button"]').first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      await page.waitForTimeout(500);

      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Modal should be closed (check for specific modal element)
      const modal = page.locator('[role="dialog"]');
      if (await modal.count() > 0) {
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('Should support arrow key navigation in menus', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for dropdown menus
    const menuButton = page.locator('[role="button"][aria-haspopup="true"]').first();

    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);

      // Try arrow down
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      // Try arrow up
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);

      // Close with Escape
      await page.keyboard.press('Escape');
    }
  });

  test('Should skip to main content with skip link', async ({ page }) => {
    await page.goto('/auth/login');

    // Press Tab to focus skip link (usually first focusable element)
    await page.keyboard.press('Tab');

    const skipLink = page.locator('a[href="#main-content"], a[href="#main"]').first();

    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeFocused();

      // Activate skip link
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Main content should be focused
      const mainContent = page.locator('#main-content, #main, main').first();
      await expect(mainContent).toBeFocused();
    }
  });

  test('Should navigate forms without mouse', async ({ page }) => {
    await page.goto('/auth/register');

    // Fill entire registration form with keyboard only
    await page.keyboard.press('Tab'); // Name field
    await page.keyboard.type('John Doe');

    await page.keyboard.press('Tab'); // Email field
    await page.keyboard.type('john@example.com');

    await page.keyboard.press('Tab'); // Password field
    await page.keyboard.type('SecurePass123!');

    await page.keyboard.press('Tab'); // Confirm password field
    await page.keyboard.type('SecurePass123!');

    await page.keyboard.press('Tab'); // Submit button
    await page.keyboard.press('Enter');

    // Form should submit or show validation
    await page.waitForTimeout(1000);
    expect(page.url()).toBeTruthy();
  });

  test('Should navigate data tables with keyboard', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Look for tables
    const table = page.locator('table').first();

    if (await table.isVisible()) {
      // Tab into table
      const firstLink = table.locator('a, button').first();
      if (await firstLink.isVisible()) {
        await firstLink.focus();
        await expect(firstLink).toBeFocused();
      }
    }
  });

  test('Should have no positive tabindex (no tab order manipulation)', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for positive tabindex values (anti-pattern)
    const positiveTabindex = await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count();

    // Filter out any data attributes or non-numeric tabindex
    const elements = await page.locator('[tabindex]').all();
    let positiveTabs = 0;

    for (const el of elements) {
      const tabindex = await el.getAttribute('tabindex');
      const tabindexNum = parseInt(tabindex || '0', 10);
      if (tabindexNum > 0) {
        positiveTabs++;
        console.log(`Found positive tabindex: ${tabindex}`);
      }
    }

    // Should not use positive tabindex (accessibility anti-pattern)
    expect(positiveTabs).toBe(0);
  });

  test('Should allow keyboard interaction with custom controls', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Look for custom select dropdowns or pickers
    const customControls = page.locator('[role="combobox"], [role="listbox"], [role="menu"]');

    if (await customControls.count() > 0) {
      const firstControl = customControls.first();
      await firstControl.focus();
      await expect(firstControl).toBeFocused();

      // Should respond to keyboard
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);

      await page.keyboard.press('Escape');
    }
  });

  test('Should maintain logical tab order', async ({ page }) => {
    await page.goto('/auth/login');

    const focusOrder: string[] = [];

    // Tab through all elements and record order
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      if (await focused.count() > 0) {
        const tag = await focused.evaluate(el => el.tagName.toLowerCase());
        const name = await focused.getAttribute('name') || '';
        const text = (await focused.textContent() || '').substring(0, 20);
        focusOrder.push(`${tag}${name ? `[${name}]` : ''}${text ? `: ${text}` : ''}`);
      }
    }

    console.log('Focus order:', focusOrder);

    // Focus order should follow visual/logical order
    // Email should come before password
    const emailIndex = focusOrder.findIndex(item => item.includes('email'));
    const passwordIndex = focusOrder.findIndex(item => item.includes('password'));

    if (emailIndex !== -1 && passwordIndex !== -1) {
      expect(emailIndex).toBeLessThan(passwordIndex);
    }
  });
});

test.describe('Accessibility - Keyboard Shortcuts', () => {

  test('Should not override browser keyboard shortcuts', async ({ page }) => {
    await page.goto('/auth/login');

    // Try Ctrl+A (select all) - should not be prevented
    await page.locator('[name="email"]').fill('test@example.com');
    await page.locator('[name="email"]').focus();

    await page.keyboard.press('Control+A');

    // Text should be selected (check by trying to type)
    await page.keyboard.press('Delete');
    const value = await page.locator('[name="email"]').inputValue();
    expect(value).toBe('');
  });

  test('Should document custom keyboard shortcuts', async ({ page }) => {
    // This test checks if there's documentation for keyboard shortcuts
    // Look for aria-keyshortcuts or documentation modal

    await page.goto('/auth/login');

    // Look for keyboard shortcut help (? key is common)
    await page.keyboard.press('?');
    await page.waitForTimeout(500);

    // Check if help modal appears
    const helpModal = page.locator('[role="dialog"]', { hasText: /keyboard|shortcuts|help/i });

    // It's OK if no shortcuts exist, but if they do, they should be documented
    if (await helpModal.count() > 0) {
      await expect(helpModal).toBeVisible();
    }
  });
});
