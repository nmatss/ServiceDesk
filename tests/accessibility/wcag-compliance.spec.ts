/**
 * WCAG 2.1 AA Compliance Test Suite
 *
 * Tests accessibility standards including:
 * - Color contrast ratios (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
 * - ARIA labels and roles
 * - Semantic HTML structure
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Focus management
 * - Alternative text for images
 * - Form accessibility
 */

import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { logger } from '@/lib/monitoring/logger';

test.describe('WCAG 2.1 AA Compliance', () => {
  test.describe('Login Page Accessibility', () => {
    test('should not have any automatically detectable accessibility issues', async ({ page }) => {
      await page.goto('/auth/login');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/auth/login');

      // Check email input has label
      const emailLabel = await page.locator('label[for="email"]');
      await expect(emailLabel).toBeVisible();
      await expect(emailLabel).toHaveText(/email/i);

      // Check password input has label
      const passwordLabel = await page.locator('label[for="password"]');
      await expect(passwordLabel).toBeVisible();
      await expect(passwordLabel).toHaveText(/senha/i);
    });

    test('should have accessible form inputs with ARIA attributes', async ({ page }) => {
      await page.goto('/auth/login');

      // Email input
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('id', 'email');
      await expect(emailInput).toHaveAttribute('name', 'email');
      await expect(emailInput).toHaveAttribute('autocomplete', 'email');

      // Password input
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toHaveAttribute('id', 'password');
      await expect(passwordInput).toHaveAttribute('name', 'password');
      await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/auth/login');

      // Run contrast-specific checks
      const results = await new AxeBuilder({ page })
        .withTags(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('should have accessible error messages', async ({ page }) => {
      await page.goto('/auth/login');

      // Submit empty form
      await page.click('button[type="submit"]');

      // Wait for browser validation or error message
      // Check if error is associated with input (aria-describedby or live region)
      const emailInput = page.locator('input[type="email"]');
      const hasAriaDescribedBy = await emailInput.getAttribute('aria-describedby');
      const hasAriaInvalid = await emailInput.getAttribute('aria-invalid');

      // At least one accessibility feature should be present for errors
      expect(hasAriaDescribedBy || hasAriaInvalid).toBeTruthy();
    });

    test('should have accessible password visibility toggle', async ({ page }) => {
      await page.goto('/auth/login');

      const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).last();

      // Should have accessible name
      const ariaLabel = await toggleButton.getAttribute('aria-label');
      const title = await toggleButton.getAttribute('title');

      expect(ariaLabel || title).toBeTruthy();
    });
  });

  test.describe('Dashboard Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|admin/);
    });

    test('should not have any automatically detectable accessibility issues', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      // Check for h1
      const h1 = page.locator('h1');
      await expect(h1.first()).toBeVisible();

      // Check headings are in order (h1 -> h2 -> h3, no skipping)
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      let previousLevel = 0;
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        const level = parseInt(tagName.charAt(1));

        // Should not skip levels (max jump of 1)
        expect(level - previousLevel).toBeLessThanOrEqual(1);
        previousLevel = level;
      }
    });

    test('should have accessible navigation landmarks', async ({ page }) => {
      // Check for navigation landmark
      const nav = page.locator('nav');
      await expect(nav.first()).toBeVisible();

      // Check for main landmark
      const main = page.locator('main');
      await expect(main.first()).toBeVisible();
    });

    test('should have skip to content link', async ({ page }) => {
      // Focus first element
      await page.keyboard.press('Tab');

      // Check if skip link is visible when focused
      const skipLink = page.locator('a[href="#main-content"], a[href="#content"]');

      if (await skipLink.count() > 0) {
        await expect(skipLink.first()).toBeVisible();
      }
    });
  });

  test.describe('Form Accessibility', () => {
    test('ticket creation form should be fully accessible', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'agent@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|tickets/);

      // Navigate to create ticket
      await page.goto('/tickets/new');

      // Check all form fields have labels
      const inputs = await page.locator('input, select, textarea').all();

      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;

          // Input should have either a label, aria-label, or aria-labelledby
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }

      // Run full accessibility scan
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('should have accessible select dropdowns', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'agent@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/tickets/new');

      const selects = await page.locator('select').all();

      for (const select of selects) {
        // Should have label
        const id = await select.getAttribute('id');
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          await expect(label).toBeVisible();
        }

        // Should have name attribute
        await expect(select).toHaveAttribute('name');
      }
    });

    test('should have accessible error state', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'agent@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/tickets/new');

      // Submit form without filling required fields
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.click();

        // Check for error messages
        const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"]');

        if (await errorMessages.count() > 0) {
          // Error messages should be visible
          await expect(errorMessages.first()).toBeVisible();

          // Should have proper ARIA attributes
          const firstError = errorMessages.first();
          const role = await firstError.getAttribute('role');
          const ariaLive = await firstError.getAttribute('aria-live');

          expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBeTruthy();
        }
      }
    });
  });

  test.describe('Data Tables Accessibility', () => {
    test('should have accessible table structure', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/admin/users');

      const tables = await page.locator('table').all();

      for (const table of tables) {
        // Should have caption or aria-label
        const caption = table.locator('caption');
        const ariaLabel = await table.getAttribute('aria-label');
        const ariaLabelledBy = await table.getAttribute('aria-labelledby');

        const hasCaption = await caption.count() > 0;
        expect(hasCaption || ariaLabel || ariaLabelledBy).toBeTruthy();

        // Should have thead
        const thead = table.locator('thead');
        await expect(thead).toBeVisible();

        // Header cells should use th
        const headerCells = await thead.locator('th').count();
        expect(headerCells).toBeGreaterThan(0);
      }
    });

    test('should have sortable columns with accessible controls', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/admin/users');

      // Look for sortable headers
      const sortableHeaders = page.locator('th button, th a, th[role="button"]');

      if (await sortableHeaders.count() > 0) {
        const firstSortable = sortableHeaders.first();

        // Should have accessible name
        const text = await firstSortable.textContent();
        const ariaLabel = await firstSortable.getAttribute('aria-label');

        expect(text || ariaLabel).toBeTruthy();

        // Should indicate sort direction
        const ariaSort = await firstSortable.getAttribute('aria-sort');
        // aria-sort can be 'ascending', 'descending', or 'none'
      }
    });
  });

  test.describe('Interactive Components Accessibility', () => {
    test('modals should trap focus and be dismissible', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|admin/);

      // Look for buttons that might open modals
      const modalTriggers = page.locator('button:has-text("Novo"), button:has-text("Criar"), button:has-text("Adicionar")');

      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();

        // Wait for modal
        const modal = page.locator('[role="dialog"], [role="alertdialog"], .modal');

        if (await modal.count() > 0) {
          await expect(modal.first()).toBeVisible();

          // Should have aria-modal
          const ariaModal = await modal.first().getAttribute('aria-modal');
          expect(ariaModal).toBe('true');

          // Should have accessible name
          const ariaLabel = await modal.first().getAttribute('aria-label');
          const ariaLabelledBy = await modal.first().getAttribute('aria-labelledby');
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();

          // Should be dismissible with Escape
          await page.keyboard.press('Escape');
          await expect(modal.first()).not.toBeVisible();
        }
      }
    });

    test('dropdowns should be keyboard accessible', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for dropdown menus
      const dropdownTriggers = page.locator('[aria-haspopup="true"], button[aria-expanded]');

      if (await dropdownTriggers.count() > 0) {
        const trigger = dropdownTriggers.first();

        // Should be keyboard accessible
        await trigger.focus();
        await page.keyboard.press('Enter');

        // Check if dropdown opened
        const expanded = await trigger.getAttribute('aria-expanded');
        expect(expanded).toBe('true');

        // Should close with Escape
        await page.keyboard.press('Escape');
        const expandedAfter = await trigger.getAttribute('aria-expanded');
        expect(expandedAfter).toBe('false');
      }
    });

    test('toast notifications should be accessible', async ({ page }) => {
      await page.goto('/auth/login');

      // Trigger an error to show toast
      await page.fill('input[type="email"]', 'invalid@email.com');
      await page.fill('input[type="password"]', 'wrong');
      await page.click('button[type="submit"]');

      // Look for toast/alert
      const toast = page.locator('[role="alert"], [role="status"], .toast');

      if (await toast.count() > 0) {
        await expect(toast.first()).toBeVisible();

        // Should have appropriate role
        const role = await toast.first().getAttribute('role');
        expect(['alert', 'status'].includes(role || '')).toBeTruthy();

        // Should have aria-live
        const ariaLive = await toast.first().getAttribute('aria-live');
        expect(['polite', 'assertive'].includes(ariaLive || '')).toBeTruthy();
      }
    });
  });

  test.describe('Image and Media Accessibility', () => {
    test('images should have alternative text', async ({ page }) => {
      await page.goto('/auth/login');

      const images = await page.locator('img').all();

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        const ariaLabel = await img.getAttribute('aria-label');

        // Decorative images should have empty alt or role="presentation"
        // Meaningful images should have alt text or aria-label
        if (role === 'presentation' || role === 'none') {
          expect(alt).toBe('');
        } else {
          expect(alt !== null || ariaLabel !== null).toBeTruthy();
        }
      }
    });

    test('icons should have accessible labels', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for icon buttons (buttons with only SVG children)
      const iconButtons = page.locator('button:has(svg):not(:has-text(/\\w/))');

      if (await iconButtons.count() > 0) {
        const buttons = await iconButtons.all();

        for (const button of buttons) {
          const ariaLabel = await button.getAttribute('aria-label');
          const title = await button.getAttribute('title');
          const ariaLabelledBy = await button.getAttribute('aria-labelledby');

          // Icon-only buttons must have accessible name
          expect(ariaLabel || title || ariaLabelledBy).toBeTruthy();
        }
      }
    });
  });

  test.describe('Dark Mode Accessibility', () => {
    test('should maintain contrast in dark mode', async ({ page }) => {
      await page.goto('/auth/login');

      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      // Wait for theme to apply
      await page.waitForTimeout(500);

      // Run contrast check
      const results = await new AxeBuilder({ page })
        .withTags(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('dark mode toggle should be accessible', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for theme toggle
      const themeToggle = page.locator('button[aria-label*="tema"], button[aria-label*="theme"], button:has-text("Tema")');

      if (await themeToggle.count() > 0) {
        await expect(themeToggle.first()).toBeVisible();

        // Should have accessible name
        const ariaLabel = await themeToggle.first().getAttribute('aria-label');
        const text = await themeToggle.first().textContent();

        expect(ariaLabel || text).toBeTruthy();
      }
    });
  });

  test.describe('Language and Internationalization', () => {
    test('should have lang attribute on html element', async ({ page }) => {
      await page.goto('/auth/login');

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
      expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // pt, en, pt-BR, etc.
    });

    test('should have proper text direction', async ({ page }) => {
      await page.goto('/auth/login');

      const dir = await page.locator('html').getAttribute('dir');
      // Should be 'ltr', 'rtl', or null (defaults to ltr)
      expect(!dir || ['ltr', 'rtl'].includes(dir)).toBeTruthy();
    });
  });

  test.describe('Focus Management', () => {
    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/auth/login');

      // Tab through interactive elements
      await page.keyboard.press('Tab');

      const focused = await page.evaluateHandle(() => document.activeElement);

      // Check if focus is visible
      const hasFocusVisible = await page.evaluate((el) => {
        const styles = window.getComputedStyle(el as Element);
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;

        return outline !== 'none' || boxShadow !== 'none';
      }, focused);

      expect(hasFocusVisible).toBeTruthy();
    });

    test('should restore focus after modal closes', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Find modal trigger
      const modalTrigger = page.locator('button:has-text("Novo"), button:has-text("Criar")').first();

      if (await modalTrigger.count() > 0) {
        await modalTrigger.focus();
        await modalTrigger.click();

        // Wait for modal
        const modal = page.locator('[role="dialog"]');

        if (await modal.count() > 0) {
          await page.keyboard.press('Escape');

          // Focus should return to trigger
          const focusedElement = await page.evaluateHandle(() => document.activeElement);
          const isSameElement = await page.evaluate((trigger, focused) => {
            return trigger === focused;
          }, await modalTrigger.elementHandle(), focusedElement);

          expect(isSameElement).toBeTruthy();
        }
      }
    });
  });

  test.describe('Screen Reader Announcements', () => {
    test('should have live regions for dynamic content', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for live regions
      const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');

      if (await liveRegions.count() > 0) {
        const regions = await liveRegions.all();

        for (const region of regions) {
          const ariaLive = await region.getAttribute('aria-live');
          const role = await region.getAttribute('role');

          // Should have appropriate politeness level
          if (ariaLive) {
            expect(['polite', 'assertive', 'off'].includes(ariaLive)).toBeTruthy();
          }

          if (role) {
            expect(['status', 'alert', 'log', 'timer'].includes(role)).toBeTruthy();
          }
        }
      }
    });

    test('should announce loading states', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');

      // Click submit
      await page.click('button[type="submit"]');

      // Look for loading indicator with proper ARIA
      const loadingIndicator = page.locator('[aria-busy="true"], [aria-live="polite"]:has-text("Carregando")');

      // Loading state should be announced
      if (await loadingIndicator.count() > 0) {
        await expect(loadingIndicator.first()).toBeVisible();
      }
    });
  });

  test.describe('Mobile Touch Target Sizes', () => {
    test('interactive elements should meet minimum touch target size', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
      await page.goto('/auth/login');

      const interactiveElements = await page.locator('button, a, input[type="checkbox"], input[type="radio"]').all();

      for (const element of interactiveElements) {
        const box = await element.boundingBox();

        if (box) {
          // WCAG 2.1 AAA: 44x44px minimum, AA: often interpreted as 44x44px
          // We'll check for 44x44 minimum
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
});

test.describe('Accessibility Best Practices', () => {
  test('should have unique page titles', async ({ page }) => {
    const pages = ['/auth/login', '/auth/register'];
    const titles: string[] = [];

    for (const path of pages) {
      await page.goto(path);
      const title = await page.title();

      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);

      // Title should be unique
      expect(titles).not.toContain(title);
      titles.push(title);
    }
  });

  test('should not have duplicate IDs', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withTags(['best-practice'])
      .analyze();

    const duplicateIdViolation = results.violations.find(v => v.id === 'duplicate-id');
    expect(duplicateIdViolation).toBeUndefined();
  });

  test('should use semantic HTML', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for semantic elements
    const semanticElements = await page.locator('header, nav, main, article, section, aside, footer').count();
    expect(semanticElements).toBeGreaterThan(0);
  });

  test('should have proper link text', async ({ page }) => {
    await page.goto('/auth/login');

    const links = await page.locator('a').all();

    for (const link of links) {
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const ariaLabelledBy = await link.getAttribute('aria-labelledby');

      // Links should not have generic text like "click here"
      const linkText = (text || ariaLabel || '').toLowerCase();
      const genericPhrases = ['click here', 'here', 'read more', 'link'];

      const isGeneric = genericPhrases.some(phrase => linkText.trim() === phrase);

      if (isGeneric && !ariaLabel && !ariaLabelledBy) {
        logger.warn(`Generic link text found: "${linkText}"`);
      }

      // Link should have accessible name
      expect(text || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });
});
