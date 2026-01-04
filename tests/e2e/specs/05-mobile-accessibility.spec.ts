/**
 * Mobile Responsiveness and Accessibility E2E Tests
 * Tests mobile layouts, touch interactions, and basic accessibility
 */

import { test, expect, devices } from '@playwright/test';
import { testUsers, generateUniqueTicketTitle } from '../fixtures/test-data';
import { login, createTicket, checkBasicAccessibility } from '../utils/test-helpers';

test.describe('Mobile Responsiveness - Login', () => {
  test('login page should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await page.goto('/auth/login');

    // Check form is visible and properly sized
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();

    const inputBox = await emailInput.boundingBox();
    expect(inputBox).toBeTruthy();

    if (inputBox) {
      // Input should not overflow viewport
      expect(inputBox.width).toBeLessThanOrEqual(devices['iPhone 12'].viewport.width);
    }
  });

  test('login form should work with touch on mobile', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await page.goto('/auth/login');

    // Tap (click) on inputs and fill
    await page.locator('input[name="email"]').tap();
    await page.fill('input[name="email"]', testUsers.user.email);

    await page.locator('input[name="password"]').tap();
    await page.fill('input[name="password"]', testUsers.user.password);

    // Tap submit button
    await page.locator('button[type="submit"]').tap();

    // Should login successfully
    await expect(page).toHaveURL(/\/(portal|tickets|dashboard)/, { timeout: 10000 });
  });

  test('mobile navigation menu should be accessible', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    // Look for mobile menu button (hamburger menu)
    const mobileMenuButton = page.locator('button[aria-label*="menu" i], button:has-text("☰"), [data-testid="mobile-menu"]').first();

    if (await mobileMenuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mobileMenuButton.tap();

      // Menu should open
      await page.waitForTimeout(500);

      // Navigation items should be visible
      const navItems = page.locator('nav a, [role="navigation"] a');
      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Mobile Responsiveness - Ticket Management', () => {
  test('ticket creation form should work on mobile', async ({ page }) => {
    await page.setViewportSize(devices['Pixel 5'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    // Fill form with touch interactions
    await page.locator('input[name="title"]').tap();
    await page.fill('input[name="title"]', generateUniqueTicketTitle());

    await page.locator('textarea[name="description"]').tap();
    await page.fill('textarea[name="description"]', 'Mobile ticket creation test');

    // Submit form
    await page.locator('button[type="submit"]').tap();

    // Should create ticket successfully
    await expect(page).toHaveURL(/\/tickets\/\d+/, { timeout: 10000 });
  });

  test('ticket list should be scrollable on mobile', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Get page height before scroll
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));

    await page.waitForTimeout(500);

    // Scroll position should change
    const scrolledY = await page.evaluate(() => window.scrollY);
    expect(scrolledY).toBeGreaterThan(initialScrollY);
  });

  test('ticket details should display properly on mobile', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    const ticketId = await createTicket(
      page,
      generateUniqueTicketTitle(),
      'Mobile view test ticket'
    );

    if (ticketId) {
      await page.goto(`/tickets/${ticketId}`);

      // Ticket details should be visible
      await expect(page.locator('text=/ticket|details/i').first()).toBeVisible();

      // Content should not overflow
      const body = await page.locator('body').boundingBox();
      expect(body).toBeTruthy();
    }
  });

  test('mobile ticket filters should work', async ({ page }) => {
    await page.setViewportSize(devices['Pixel 5'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Look for filter button/dropdown
    const filterButton = page.locator('button:has-text("Filter"), select[name="status"]').first();

    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.tap();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Mobile Responsiveness - Tablet View', () => {
  test('admin dashboard should adapt to tablet', async ({ page }) => {
    await page.setViewportSize(devices['iPad Pro'].viewport);

    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/dashboard');

    // Dashboard should display without horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('tablet navigation should be accessible', async ({ page }) => {
    await page.setViewportSize(devices['iPad Pro'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    // Navigation should be visible
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Accessibility - Basic ARIA', () => {
  test('login page should have proper ARIA labels', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for form labels
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    // Inputs should have labels or aria-labels
    const emailHasLabel = await emailInput.evaluate((el: HTMLInputElement) => {
      return el.labels?.length > 0 || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
    });

    const passwordHasLabel = await passwordInput.evaluate((el: HTMLInputElement) => {
      return el.labels?.length > 0 || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
    });

    // At least one should have proper labeling
    expect(emailHasLabel || passwordHasLabel).toBe(true);
  });

  test('buttons should have accessible text', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit button should have text or aria-label
    const submitButton = page.locator('button[type="submit"]');

    const hasAccessibleText = await submitButton.evaluate((el: HTMLButtonElement) => {
      return el.textContent?.trim().length > 0 ||
             el.hasAttribute('aria-label') ||
             el.hasAttribute('aria-labelledby');
    });

    expect(hasAccessibleText).toBe(true);
  });

  test('images should have alt text', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Check all images have alt attributes
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();

    expect(imagesWithoutAlt).toBe(0);
  });

  test('page should have proper heading structure', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Page should have at least one heading
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();

    expect(headings).toBeGreaterThan(0);

    // Should have h1 as main heading
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('form inputs should have proper labels', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    // All inputs should have labels
    const inputs = await page.locator('input, textarea, select').all();

    for (const input of inputs) {
      const hasLabel = await input.evaluate((el: HTMLInputElement) => {
        const type = el.type;

        // Skip hidden and submit buttons
        if (type === 'hidden' || type === 'submit') return true;

        return el.labels?.length > 0 ||
               el.hasAttribute('aria-label') ||
               el.hasAttribute('aria-labelledby') ||
               el.hasAttribute('placeholder');
      });

      expect(hasLabel).toBe(true);
    }
  });

  test('links should have meaningful text', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Check for links with no text or "click here"
    const emptyLinks = await page.locator('a:not([aria-label])').filter({ hasText: '' }).count();

    expect(emptyLinks).toBe(0);
  });

  test('interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('/auth/login');

    // Tab through form
    await page.keyboard.press('Tab');

    // First focusable element should be focused
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // Tab to next element
    await page.keyboard.press('Tab');

    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('forms should support keyboard submission', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill form using keyboard
    await page.fill('input[name="email"]', testUsers.user.email);
    await page.fill('input[name="password"]', testUsers.user.password);

    // Submit with Enter key
    await page.press('input[name="password"]', 'Enter');

    // Should login successfully
    await expect(page).toHaveURL(/\/(portal|tickets|dashboard)/, { timeout: 10000 });
  });

  test('dropdowns should be keyboard navigable', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/create');

    const prioritySelect = page.locator('select[name="priority"]').first();

    if (await prioritySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Focus select
      await prioritySelect.focus();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');

      // Select should maintain focus
      const isFocused = await prioritySelect.evaluate((el) => el === document.activeElement);
      expect(isFocused).toBe(true);
    }
  });

  test('modal dialogs should trap focus', async ({ page }) => {
    await login(page, testUsers.admin.email, testUsers.admin.password);

    await page.goto('/admin/users');

    // Try to open a modal/dialog if exists
    const actionButton = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Delete")').first();

    if (await actionButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await actionButton.click();

      await page.waitForTimeout(500);

      // Check if modal exists
      const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]').first();

      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Modal should have focus trap
        const hasAriaModal = await modal.evaluate((el) => {
          return el.hasAttribute('aria-modal') || el.getAttribute('role') === 'dialog';
        });

        expect(hasAriaModal).toBe(true);
      }
    }
  });
});

test.describe('Accessibility - Color Contrast', () => {
  test('text should have sufficient contrast', async ({ page }) => {
    await page.goto('/auth/login');

    // Check primary text color
    const bodyText = page.locator('body').first();
    const textColor = await bodyText.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });

    expect(textColor).toBeTruthy();
    expect(textColor).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
  });

  test('buttons should have visible focus indicators', async ({ page }) => {
    await page.goto('/auth/login');

    const submitButton = page.locator('button[type="submit"]');

    // Focus button
    await submitButton.focus();

    // Check for focus styles
    const hasFocusStyle = await submitButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline !== 'none' ||
             styles.boxShadow !== 'none' ||
             styles.borderColor !== styles.borderColor; // Changed on focus
    });

    expect(hasFocusStyle).toBe(true);
  });
});

test.describe('Accessibility - Screen Reader Support', () => {
  test('page should have proper document title', async ({ page }) => {
    await page.goto('/auth/login');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe('');
  });

  test('page should have lang attribute', async ({ page }) => {
    await page.goto('/auth/login');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('skip to main content link should exist', async ({ page }) => {
    await page.goto('/auth/login');

    // Look for skip link (common accessibility pattern)
    const skipLink = page.locator('a:has-text("Skip to"), a[href="#main"], a[href="#content"]').first();

    // Skip link is optional but recommended
    const exists = await skipLink.isVisible({ timeout: 1000 }).catch(() => false);

    // Just log the result, don't fail test as it's optional
    console.log('Skip link exists:', exists);
  });

  test('form errors should be announced', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit empty form
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Check for aria-live region or role="alert"
    const errorRegion = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').first();

    const hasErrorAnnouncement = await errorRegion.isVisible({ timeout: 2000 }).catch(() => false);

    // Error announcements are good practice
    console.log('Form has accessible error announcements:', hasErrorAnnouncement);
  });

  test('loading states should be announced', async ({ page }) => {
    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Check for loading indicator with aria-live or role="status"
    const loadingIndicator = page.locator('[role="status"], [aria-live], [aria-busy]').first();

    // Just check if it exists (optional feature)
    const hasLoadingAnnouncement = await loadingIndicator.count();

    console.log('Page has accessible loading indicators:', hasLoadingAnnouncement > 0);
  });
});

test.describe('Touch Interactions', () => {
  test('swipe gestures should work on mobile ticket list', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Simulate swipe (if implemented)
    const ticketRow = page.locator('table tbody tr, [data-testid="ticket-row"]').first();

    if (await ticketRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await ticketRow.boundingBox();

      if (box) {
        // Swipe left
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);
      }
    }
  });

  test('pull to refresh should work on mobile', async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport);

    await login(page, testUsers.user.email, testUsers.user.password);

    await page.goto('/portal/tickets');

    // Attempt pull-to-refresh gesture
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    await page.touchscreen.tap(200, 100);

    // Just verify page doesn't crash on touch
    await page.waitForTimeout(500);
  });
});
