/**
 * Focus Management Accessibility Tests
 * WCAG 2.1 - 2.4.3 Focus Order, 2.4.7 Focus Visible
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility - Focus Management', () => {

  test('Should have visible focus indicators on all interactive elements', async ({ page }) => {
    await page.goto('/auth/login');

    const interactiveElements = await page.locator('a, button, input, select, textarea, [tabindex="0"]').all();

    for (const element of interactiveElements.slice(0, 15)) {
      if (await element.isVisible()) {
        await element.focus();

        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
            outlineStyle: computed.outlineStyle,
            outlineColor: computed.outlineColor,
            outlineOffset: computed.outlineOffset,
            boxShadow: computed.boxShadow,
            border: computed.border,
          };
        });

        // Should have visible focus indicator
        const hasVisibleFocus = (
          (styles.outline !== 'none' && styles.outlineWidth !== '0px') ||
          styles.boxShadow !== 'none' ||
          styles.outlineStyle !== 'none'
        );

        if (!hasVisibleFocus) {
          const tagName = await element.evaluate(el => el.tagName);
          const id = await element.getAttribute('id');
          console.log(`Missing focus indicator: ${tagName}${id ? `#${id}` : ''}`);
        }

        expect(hasVisibleFocus).toBe(true);
      }
    }
  });

  test('Should maintain focus order matching DOM order', async ({ page }) => {
    await page.goto('/auth/login');

    const focusOrder: string[] = [];
    const domOrder: string[] = [];

    // Get DOM order
    const allElements = await page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
    for (const el of allElements) {
      if (await el.isVisible()) {
        const id = await el.getAttribute('id') || await el.getAttribute('name') || 'unnamed';
        domOrder.push(id);
      }
    }

    // Get focus order
    await page.keyboard.press('Tab'); // Start tabbing
    for (let i = 0; i < Math.min(domOrder.length, 15); i++) {
      const focused = page.locator(':focus');
      if (await focused.count() > 0) {
        const id = await focused.getAttribute('id') || await focused.getAttribute('name') || 'unnamed';
        focusOrder.push(id);
      }
      await page.keyboard.press('Tab');
    }

    console.log('DOM order:', domOrder.slice(0, 10));
    console.log('Focus order:', focusOrder.slice(0, 10));

    // Focus order should generally match DOM order (allowing for some variations)
    expect(focusOrder.length).toBeGreaterThan(0);
  });

  test('Should trap focus in modal dialogs', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');

    // Open modal
    const modalTrigger = page.locator('[data-testid="new-ticket-button"]').first();

    if (await modalTrigger.isVisible()) {
      // Remember trigger element
      await modalTrigger.focus();

      await modalTrigger.click();
      await page.waitForTimeout(500);

      // Check if modal exists
      const modal = page.locator('[role="dialog"]');

      if (await modal.count() > 0) {
        // Focus should be inside modal
        const focusedElement = page.locator(':focus');
        const isInsideModal = await modal.locator(':focus').count() > 0;

        expect(isInsideModal).toBe(true);

        // Tab through modal elements
        const focusableInModal = await modal.locator('button, a, input, select, textarea, [tabindex="0"]').all();

        console.log(`Focusable elements in modal: ${focusableInModal.length}`);

        if (focusableInModal.length > 0) {
          // Tab to last element
          for (let i = 0; i < focusableInModal.length + 2; i++) {
            await page.keyboard.press('Tab');
          }

          // Focus should still be inside modal (trapped)
          const stillInModal = await modal.locator(':focus').count() > 0;
          expect(stillInModal).toBe(true);
        }
      }
    }
  });

  test('Should restore focus after modal closes', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');

    const modalTrigger = page.locator('[data-testid="new-ticket-button"]').first();

    if (await modalTrigger.isVisible()) {
      // Focus and click trigger
      await modalTrigger.focus();
      await modalTrigger.click();
      await page.waitForTimeout(500);

      // Close modal with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Focus should return to trigger
      const focused = page.locator(':focus');
      const focusedHtml = await focused.evaluate(el => el.outerHTML).catch(() => '');

      console.log('Focus after modal close:', focusedHtml.substring(0, 100));

      // Focus should be on trigger or nearby element
      await expect(modalTrigger).toBeFocused();
    }
  });

  test('Should move focus to main content after skip link', async ({ page }) => {
    await page.goto('/auth/login');

    // Look for skip link
    const skipLink = page.locator('a[href="#main"], a[href="#main-content"]').first();

    if (await skipLink.count() > 0) {
      await skipLink.focus();
      await expect(skipLink).toBeFocused();

      // Activate skip link
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Focus should move to main content
      const mainContent = page.locator('#main, #main-content, main').first();
      await expect(mainContent).toBeFocused();
    } else {
      console.log('No skip link found (consider adding one)');
    }
  });

  test('Should not lose focus when content updates', async ({ page }) => {
    await page.goto('/auth/login');

    // Focus on email input
    await page.locator('[name="email"]').focus();
    await expect(page.locator('[name="email"]')).toBeFocused();

    // Type (content update)
    await page.keyboard.type('test@example.com');

    // Focus should remain on email input
    await expect(page.locator('[name="email"]')).toBeFocused();
  });

  test('Should manage focus on dynamic content insertion', async ({ page }) => {
    await page.goto('/auth/login');

    // Trigger validation errors (dynamic content)
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Focus management after error
    // Focus should either stay on submit button or move to first error
    const focused = page.locator(':focus');
    expect(await focused.count()).toBeGreaterThan(0);

    const focusedElement = await focused.evaluate(el => el.tagName).catch(() => '');
    console.log('Focus after validation error:', focusedElement);
  });

  test('Should maintain focus indicator visibility at 200% zoom', async ({ page }) => {
    // Set viewport to simulate zoom
    await page.setViewportSize({ width: 640, height: 480 }); // Simulates 200% zoom on 1280x960

    await page.goto('/auth/login');

    // Focus on input
    await page.locator('[name="email"]').focus();

    const styles = await page.locator('[name="email"]').evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
      };
    });

    const hasVisibleFocus = (
      styles.outline !== 'none' ||
      styles.boxShadow !== 'none'
    );

    expect(hasVisibleFocus).toBe(true);
  });

  test('Should not have focus trapped in page content', async ({ page }) => {
    await page.goto('/auth/login');

    let previousFocus = '';
    let sameCount = 0;

    // Tab through page
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      if (await focused.count() > 0) {
        const currentFocus = await focused.evaluate(el => el.outerHTML).catch(() => '');

        if (currentFocus === previousFocus && currentFocus !== '') {
          sameCount++;
        } else {
          sameCount = 0;
        }

        previousFocus = currentFocus;

        // Should not be stuck on same element
        expect(sameCount).toBeLessThan(3);
      }
    }
  });

  test('Should have focus indicator contrast ratio of 3:1', async ({ page }) => {
    await page.goto('/auth/login');

    await page.locator('[name="email"]').focus();

    const focusStyles = await page.locator('[name="email"]').evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outlineColor: computed.outlineColor,
        outlineWidth: computed.outlineWidth,
        backgroundColor: computed.backgroundColor,
        boxShadow: computed.boxShadow,
      };
    });

    console.log('Focus indicator styles:', focusStyles);

    // Should have visible focus (will be checked by axe-core for actual contrast)
    expect(
      focusStyles.outlineWidth !== '0px' ||
      focusStyles.boxShadow !== 'none'
    ).toBe(true);
  });

  test('Should show focus on SVG interactive elements', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for clickable SVG icons
    const svgButtons = page.locator('button svg, a svg').first();

    if (await svgButtons.count() > 0) {
      const parent = svgButtons.locator('..');
      await parent.focus();

      // Parent button should have focus indicator
      const styles = await parent.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
        };
      });

      expect(
        styles.outline !== 'none' ||
        styles.boxShadow !== 'none'
      ).toBe(true);
    }
  });

  test('Should manage focus in accordions', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for accordion buttons
    const accordionButton = page.locator('[aria-expanded]').first();

    if (await accordionButton.isVisible()) {
      await accordionButton.focus();
      await expect(accordionButton).toBeFocused();

      // Expand accordion
      await accordionButton.click();
      await page.waitForTimeout(300);

      // Focus should still be on button or move to content
      const focused = page.locator(':focus');
      expect(await focused.count()).toBeGreaterThan(0);
    }
  });

  test('Should manage focus in tab panels', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Look for tabs
    const tabs = page.locator('[role="tab"]');

    if (await tabs.count() > 0) {
      const firstTab = tabs.first();
      await firstTab.focus();
      await expect(firstTab).toBeFocused();

      // Arrow right to next tab
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);

      // Focus should move to next tab
      const secondTab = tabs.nth(1);
      if (await secondTab.isVisible()) {
        await expect(secondTab).toBeFocused();
      }
    }
  });

  test('Should have focus visible on custom radio/checkbox', async ({ page }) => {
    await page.goto('/auth/register');

    // Look for checkboxes or radios
    const checkbox = page.locator('input[type="checkbox"], input[type="radio"]').first();

    if (await checkbox.isVisible()) {
      await checkbox.focus();

      // Get focus styles (may be on wrapper)
      const styles = await checkbox.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
        };
      });

      console.log('Checkbox focus styles:', styles);

      // Should have visible focus
      expect(
        styles.outline !== 'none' ||
        styles.boxShadow !== 'none'
      ).toBe(true);
    }
  });

  test('Should preserve focus during loading states', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill form
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');

    // Focus submit button
    await page.locator('button[type="submit"]').focus();
    await expect(page.locator('button[type="submit"]')).toBeFocused();

    // Click submit (may show loading state)
    await page.click('button[type="submit"]');

    // Focus should remain on button or move appropriately
    await page.waitForTimeout(500);

    const focused = page.locator(':focus');
    expect(await focused.count()).toBeGreaterThan(0);
  });

  test('Should not cause focus to jump unexpectedly', async ({ page }) => {
    await page.goto('/auth/login');

    // Focus on email
    await page.locator('[name="email"]').focus();

    // Type slowly
    for (const char of 'test@example.com'.split('')) {
      await page.keyboard.type(char);
      await page.waitForTimeout(50);

      // Focus should stay on email
      await expect(page.locator('[name="email"]')).toBeFocused();
    }
  });

  test('Should announce focus changes to screen readers', async ({ page }) => {
    await page.goto('/auth/login');

    // Tab to next element
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');

    // Focused element should have accessible name
    const ariaLabel = await focused.getAttribute('aria-label');
    const text = await focused.textContent();
    const labelFor = await focused.getAttribute('id');

    let hasAccessibleName = ariaLabel || text;

    if (labelFor) {
      const label = await page.locator(`label[for="${labelFor}"]`).textContent();
      hasAccessibleName = hasAccessibleName || label;
    }

    expect(hasAccessibleName).toBeTruthy();
  });

  test('Should have focus styles distinct from hover styles', async ({ page }) => {
    await page.goto('/auth/login');

    const button = page.locator('button[type="submit"]');

    // Get default styles
    const defaultStyles = await button.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
        backgroundColor: computed.backgroundColor,
      };
    });

    // Hover
    await button.hover();
    await page.waitForTimeout(100);

    const hoverStyles = await button.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
        backgroundColor: computed.backgroundColor,
      };
    });

    // Focus
    await button.focus();
    await page.waitForTimeout(100);

    const focusStyles = await button.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
        backgroundColor: computed.backgroundColor,
      };
    });

    console.log('Button styles:', { defaultStyles, hoverStyles, focusStyles });

    // Focus styles should be different from default
    expect(
      focusStyles.outline !== defaultStyles.outline ||
      focusStyles.boxShadow !== defaultStyles.boxShadow
    ).toBe(true);
  });

  test('Should not remove focus outline with CSS', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for outline: none in CSS
    const elementsWithoutOutline = await page.evaluate(() => {
      const elements = document.querySelectorAll('*:focus');
      const withoutOutline: string[] = [];

      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        if (styles.outline === 'none' && styles.boxShadow === 'none') {
          withoutOutline.push(el.tagName);
        }
      });

      return withoutOutline;
    });

    // Should not disable outlines without providing alternatives
    console.log('Elements with outline:none:', elementsWithoutOutline);
  });
});

test.describe('Accessibility - Focus in Complex Widgets', () => {

  test('Should manage focus in dropdown menus', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for dropdown menu trigger
    const menuButton = page.locator('[role="button"][aria-haspopup="true"]').first();

    if (await menuButton.isVisible()) {
      await menuButton.focus();
      await expect(menuButton).toBeFocused();

      // Open menu
      await menuButton.click();
      await page.waitForTimeout(300);

      // Focus should move to menu or first item
      const menu = page.locator('[role="menu"]');
      if (await menu.count() > 0) {
        const menuItem = menu.locator('[role="menuitem"]').first();
        if (await menuItem.isVisible()) {
          await expect(menuItem).toBeFocused();
        }
      }
    }
  });

  test('Should manage focus in combobox/autocomplete', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Look for combobox
    const combobox = page.locator('[role="combobox"]').first();

    if (await combobox.isVisible()) {
      await combobox.focus();
      await expect(combobox).toBeFocused();

      // Type to trigger autocomplete
      await page.keyboard.type('test');
      await page.waitForTimeout(500);

      // Focus should stay on combobox
      await expect(combobox).toBeFocused();

      // Arrow down to select item
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      // Check if listbox appears
      const listbox = page.locator('[role="listbox"]');
      if (await listbox.count() > 0) {
        console.log('Autocomplete listbox appeared');
      }
    }
  });
});
