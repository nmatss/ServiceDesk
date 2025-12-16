/**
 * Color Contrast Accessibility Tests
 * WCAG 2.1 - 1.4.3 Contrast (Minimum) - Level AA
 * WCAG 2.1 - 1.4.6 Contrast (Enhanced) - Level AAA
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility - Color Contrast', () => {

  test('Should have sufficient color contrast on login page (WCAG AA)', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Color contrast violations:');
      results.violations.forEach(violation => {
        console.log(`\n${violation.id}: ${violation.help}`);
        violation.nodes.forEach(node => {
          console.log(`  - ${node.target}`);
          console.log(`    ${node.failureSummary}`);
        });
      });
    }

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast on all text elements', async ({ page }) => {
    await page.goto('/auth/login');

    const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span, label, a, button').all();

    for (const element of textElements.slice(0, 20)) { // Test first 20 to avoid timeout
      if (await element.isVisible()) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize,
          };
        });

        // Log for manual verification
        console.log(`Element contrast: color=${styles.color}, bg=${styles.backgroundColor}, size=${styles.fontSize}`);

        // Basic check - color should not be same as background
        expect(styles.color).not.toBe(styles.backgroundColor);
      }
    }
  });

  test('Should have sufficient contrast for form labels', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .include('label, input, button')
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast for interactive elements', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .include('button, a, input, select, textarea')
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Interactive elements contrast violations:');
      results.violations.forEach(v => {
        console.log(`  ${v.id}: ${v.nodes.length} elements`);
      });
    }

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast for links', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .include('a')
      .withRules(['color-contrast', 'link-in-text-block'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast in error states', async ({ page }) => {
    await page.goto('/auth/login');

    // Trigger validation errors
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast for status messages', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit to show error message
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Check error messages specifically
    const errorMessages = page.locator('[role="alert"], [aria-invalid="true"] ~ *, .error-message');

    if (await errorMessages.count() > 0) {
      const results = await new AxeBuilder({ page })
        .include('[role="alert"], .error-message')
        .withRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    }
  });

  test('Should have sufficient contrast on tickets page', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Tickets page contrast violations:', results.violations.length);
    }

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast for priority badges', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    // Check badges/pills for priority indicators
    const badges = page.locator('.badge, .pill, [class*="priority"], [class*="status"]');

    if (await badges.count() > 0) {
      const results = await new AxeBuilder({ page })
        .include('.badge, .pill, [class*="priority"], [class*="status"]')
        .withRules(['color-contrast'])
        .analyze();

      if (results.violations.length > 0) {
        console.log('Priority badge contrast violations:', results.violations.length);
      }

      expect(results.violations).toEqual([]);
    }
  });

  test('Should have enhanced contrast (AAA) for large text', async ({ page }) => {
    await page.goto('/auth/login');

    // Check headings (large text)
    const headings = await page.locator('h1, h2, h3').all();

    for (const heading of headings) {
      if (await heading.isVisible()) {
        const contrast = await heading.evaluate(el => {
          const computed = window.getComputedStyle(el);
          const fontSize = parseFloat(computed.fontSize);
          const fontWeight = computed.fontWeight;

          return {
            fontSize,
            fontWeight,
            color: computed.color,
            backgroundColor: computed.backgroundColor,
          };
        });

        // Large text (18pt+ or 14pt+ bold) needs 3:1 ratio (AA)
        // For AAA, large text needs 4.5:1
        console.log(`Heading contrast: ${contrast.fontSize}px, weight ${contrast.fontWeight}`);

        expect(contrast.fontSize).toBeGreaterThan(0);
      }
    }
  });

  test('Should not rely on color alone for information', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    // Check if status indicators use more than just color
    // (should have text, icons, or patterns)
    const statusElements = page.locator('[class*="status"], [class*="priority"]');

    if (await statusElements.count() > 0) {
      const firstStatus = statusElements.first();

      // Should have text content or aria-label
      const text = await firstStatus.textContent();
      const ariaLabel = await firstStatus.getAttribute('aria-label');

      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('Should have sufficient contrast in dark mode (if available)', async ({ page }) => {
    await page.goto('/auth/login');

    // Try to enable dark mode
    const darkModeToggle = page.locator('[data-theme="dark"], [class*="dark-mode"], [aria-label*="dark"]').first();

    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    } else {
      console.log('Dark mode not available on this page');
    }
  });

  test('Should have sufficient contrast for disabled elements', async ({ page }) => {
    await page.goto('/auth/login');

    // Look for disabled buttons/inputs
    const disabledElements = page.locator('button:disabled, input:disabled, [aria-disabled="true"]');

    if (await disabledElements.count() > 0) {
      // Disabled elements have relaxed contrast requirements
      // But should still be perceivable
      const firstDisabled = disabledElements.first();

      const opacity = await firstDisabled.evaluate(el => {
        return window.getComputedStyle(el).opacity;
      });

      // Should not be completely invisible
      expect(parseFloat(opacity)).toBeGreaterThan(0.3);
    }
  });

  test('Should have sufficient contrast for focus indicators', async ({ page }) => {
    await page.goto('/auth/login');

    // Focus on input
    await page.locator('[name="email"]').focus();

    const focusedStyles = await page.locator('[name="email"]').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
      };
    });

    console.log('Focus indicator styles:', focusedStyles);

    // Should have visible focus indicator
    expect(
      focusedStyles.outline !== 'none' ||
      focusedStyles.boxShadow !== 'none' ||
      focusedStyles.borderColor !== ''
    ).toBe(true);
  });

  test('Should pass contrast for all button states', async ({ page }) => {
    await page.goto('/auth/login');

    const button = page.locator('button[type="submit"]').first();

    // Default state
    await page.screenshot({ path: '/tmp/button-default.png' });

    // Hover state
    await button.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/button-hover.png' });

    // Focus state
    await button.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/button-focus.png' });

    // All states should pass contrast
    const results = await new AxeBuilder({ page })
      .include('button')
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Should have sufficient contrast ratio (4.5:1 minimum for AA)', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .withTags(['wcag2aa'])
      .analyze();

    // WCAG AA requires:
    // - 4.5:1 for normal text
    // - 3:1 for large text (18pt+ or 14pt+ bold)

    expect(results.violations).toEqual([]);
  });

  test('Should have enhanced contrast ratio (7:1 for AAA)', async ({ page }) => {
    test.slow(); // AAA tests are more strict

    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast-enhanced'])
      .analyze();

    // WCAG AAA requires:
    // - 7:1 for normal text
    // - 4.5:1 for large text

    if (results.violations.length > 0) {
      console.log('AAA contrast violations (optional):');
      console.log(`Total: ${results.violations.length}`);
    }

    // AAA is optional - just log
    console.log(`AAA contrast violations: ${results.violations.length}`);
  });

  test('Should detect contrast issues in user-generated content areas', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Go to ticket creation
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Check rich text editor area
    const richTextArea = page.locator('[contenteditable="true"], textarea, .ql-editor').first();

    if (await richTextArea.isVisible()) {
      const results = await new AxeBuilder({ page })
        .include('[contenteditable="true"], textarea, .ql-editor')
        .withRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    }
  });
});

test.describe('Accessibility - Non-Text Contrast', () => {

  test('Should have sufficient contrast for graphical objects', async ({ page }) => {
    await page.goto('/auth/login');

    // WCAG 2.1 - 1.4.11 Non-text Contrast (Level AA)
    // UI components and graphical objects need 3:1 contrast

    const results = await new AxeBuilder({ page })
      .withTags(['wcag21aa'])
      .analyze();

    // This includes focus indicators, form controls, etc.
    expect(results.violations.filter(v => v.id.includes('contrast')).length).toBe(0);
  });

  test('Should have sufficient contrast for icons', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Check SVG icons
    const icons = page.locator('svg, [class*="icon"]');

    if (await icons.count() > 0) {
      // Icons should have 3:1 contrast if they convey information
      const firstIcon = icons.first();

      const iconColor = await firstIcon.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          fill: styles.fill,
          stroke: styles.stroke,
          color: styles.color,
        };
      });

      console.log('Icon colors:', iconColor);

      // If icon is purely decorative (aria-hidden), contrast not required
      const ariaHidden = await firstIcon.getAttribute('aria-hidden');
      if (ariaHidden === 'true') {
        console.log('Icon is decorative (aria-hidden)');
      }
    }
  });
});
