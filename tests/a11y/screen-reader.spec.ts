/**
 * Screen Reader Compatibility Tests
 * WCAG 2.1 - ARIA, Semantic HTML, Landmarks
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility - Screen Reader Compatibility', () => {

  test('Should have proper ARIA labels on all interactive elements', async ({ page }) => {
    await page.goto('/auth/login');

    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');
      const textContent = (await button.textContent())?.trim();
      const title = await button.getAttribute('title');

      // Button must have accessible name
      const hasAccessibleName = ariaLabel || ariaLabelledBy || textContent || title;

      if (!hasAccessibleName) {
        const html = await button.evaluate(el => el.outerHTML);
        console.log('Button without accessible name:', html);
      }

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('Should have proper landmark regions', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for header/banner
    const header = page.locator('header, [role="banner"]');
    expect(await header.count()).toBeGreaterThan(0);

    // Check for main content
    const main = page.locator('main, [role="main"]');
    expect(await main.count()).toBeGreaterThan(0);

    // Footer may not be on all pages
    const footer = page.locator('footer, [role="contentinfo"]');
    // Don't require footer, just check it exists if present

    console.log(`Landmarks found - Header: ${await header.count()}, Main: ${await main.count()}, Footer: ${await footer.count()}`);
  });

  test('Should have navigation landmark', async ({ page }) => {
    // Login to access dashboard with navigation
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Check for navigation
    const nav = page.locator('nav, [role="navigation"]');
    expect(await nav.count()).toBeGreaterThan(0);

    // Navigation should have accessible name
    const firstNav = nav.first();
    const ariaLabel = await firstNav.getAttribute('aria-label');
    const ariaLabelledBy = await firstNav.getAttribute('aria-labelledby');

    expect(ariaLabel || ariaLabelledBy).toBeTruthy();
  });

  test('Should announce live regions for notifications', async ({ page }) => {
    await page.goto('/auth/login');

    // Look for live region for notifications
    const liveRegions = page.locator('[role="status"], [role="alert"], [aria-live]');

    if (await liveRegions.count() > 0) {
      const firstLiveRegion = liveRegions.first();

      const ariaLive = await firstLiveRegion.getAttribute('aria-live');
      const role = await firstLiveRegion.getAttribute('role');

      // Should have aria-live or appropriate role
      expect(ariaLive || role).toBeTruthy();

      // If aria-live, should be polite or assertive
      if (ariaLive) {
        expect(['polite', 'assertive']).toContain(ariaLive);
      }
    }
  });

  test('Should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/auth/login');

    // Get all headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

    const headingLevels: number[] = [];

    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const level = parseInt(tagName.replace('h', ''), 10);
      headingLevels.push(level);
    }

    console.log('Heading hierarchy:', headingLevels);

    // Should have at least one h1
    expect(headingLevels).toContain(1);

    // Check for skipped levels (h1 -> h3 without h2)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      // Should not skip more than 1 level down
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('Should have only one h1 per page', async ({ page }) => {
    await page.goto('/auth/login');

    const h1Count = await page.locator('h1').count();

    // Should have exactly 1 h1
    expect(h1Count).toBe(1);
  });

  test('Should have ARIA labels on form inputs', async ({ page }) => {
    await page.goto('/auth/login');

    const inputs = await page.locator('input, textarea, select').all();

    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const ariaDescribedBy = await input.getAttribute('aria-describedby');

      // Check if there's a label element
      let hasLabel = false;
      if (id) {
        const labelCount = await page.locator(`label[for="${id}"]`).count();
        hasLabel = labelCount > 0;
      }

      // Input must have accessible name
      const hasAccessibleName = ariaLabel || ariaLabelledBy || hasLabel;

      if (!hasAccessibleName) {
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type');
        console.log(`Input without accessible name: name="${name}" type="${type}"`);
      }

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('Should have ARIA describedby for form errors', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit form without filling to trigger errors
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const emailInput = page.locator('[name="email"]');

    // Should have aria-invalid
    const ariaInvalid = await emailInput.getAttribute('aria-invalid');
    expect(ariaInvalid).toBe('true');

    // Should have aria-describedby pointing to error message
    const ariaDescribedBy = await emailInput.getAttribute('aria-describedby');
    expect(ariaDescribedBy).toBeTruthy();

    if (ariaDescribedBy) {
      // Error message should exist
      const errorMessage = page.locator(`#${ariaDescribedBy}`);
      expect(await errorMessage.count()).toBeGreaterThan(0);

      // Error should be visible
      await expect(errorMessage).toBeVisible();
    }
  });

  test('Should have ARIA expanded on expandable elements', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for buttons that control expansion
    const expandButtons = page.locator('[aria-expanded]');

    if (await expandButtons.count() > 0) {
      const firstButton = expandButtons.first();

      const ariaExpanded = await firstButton.getAttribute('aria-expanded');
      expect(['true', 'false']).toContain(ariaExpanded || '');

      // Click to toggle
      await firstButton.click();
      await page.waitForTimeout(300);

      // aria-expanded should toggle
      const newAriaExpanded = await firstButton.getAttribute('aria-expanded');
      expect(newAriaExpanded).not.toBe(ariaExpanded);
    }
  });

  test('Should have ARIA controls on interactive elements', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for elements with aria-controls
    const controlElements = page.locator('[aria-controls]');

    if (await controlElements.count() > 0) {
      for (const element of await controlElements.all()) {
        const ariaControls = await element.getAttribute('aria-controls');

        if (ariaControls) {
          // Controlled element should exist
          const controlled = page.locator(`#${ariaControls}`);
          expect(await controlled.count()).toBeGreaterThan(0);
        }
      }
    }
  });

  test('Should have proper link text (no "click here")', async ({ page }) => {
    await page.goto('/auth/login');

    const links = await page.locator('a').all();

    for (const link of links) {
      const text = (await link.textContent())?.toLowerCase().trim() || '';
      const ariaLabel = (await link.getAttribute('aria-label'))?.toLowerCase() || '';

      // Should not use vague link text
      const hasVagueLinkText = (
        text === 'click here' ||
        text === 'here' ||
        text === 'read more' ||
        text === 'link' ||
        ariaLabel === 'click here'
      );

      if (hasVagueLinkText) {
        console.log('Vague link text found:', text || ariaLabel);
      }

      expect(hasVagueLinkText).toBe(false);
    }
  });

  test('Should have alt text on all images', async ({ page }) => {
    await page.goto('/auth/login');

    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Should have alt attribute (can be empty for decorative images)
      expect(alt !== null).toBe(true);

      // If role is presentation or none, alt should be empty
      if (role === 'presentation' || role === 'none') {
        expect(alt).toBe('');
      }
    }
  });

  test('Should have ARIA role on custom components', async ({ page }) => {
    await page.goto('/auth/login');

    // Look for divs that act as buttons
    const divButtons = page.locator('div[onclick], div[tabindex="0"]');

    if (await divButtons.count() > 0) {
      for (const div of await divButtons.all()) {
        const role = await div.getAttribute('role');

        // Should have appropriate role
        expect(role).toBeTruthy();
        console.log('Custom component role:', role);
      }
    }
  });

  test('Should have ARIA modal properties on dialogs', async ({ page }) => {
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

      // Check for modal/dialog
      const modal = page.locator('[role="dialog"], [role="alertdialog"]');

      if (await modal.count() > 0) {
        const firstModal = modal.first();

        // Should have aria-modal
        const ariaModal = await firstModal.getAttribute('aria-modal');
        expect(ariaModal).toBe('true');

        // Should have aria-labelledby or aria-label
        const ariaLabel = await firstModal.getAttribute('aria-label');
        const ariaLabelledBy = await firstModal.getAttribute('aria-labelledby');

        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test('Should announce page title changes on navigation', async ({ page }) => {
    await page.goto('/auth/login');

    const loginTitle = await page.title();
    expect(loginTitle).toBeTruthy();
    expect(loginTitle.length).toBeGreaterThan(0);

    // Navigate to another page
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    const dashboardTitle = await page.title();
    expect(dashboardTitle).toBeTruthy();

    // Titles should be different
    expect(dashboardTitle).not.toBe(loginTitle);

    console.log(`Login title: "${loginTitle}"`);
    console.log(`Dashboard title: "${dashboardTitle}"`);
  });

  test('Should have lang attribute on html element', async ({ page }) => {
    await page.goto('/auth/login');

    const htmlLang = await page.locator('html').getAttribute('lang');

    expect(htmlLang).toBeTruthy();
    expect(htmlLang?.length).toBeGreaterThan(0);

    // Should be valid language code (en, pt, es, etc)
    expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
  });

  test('Should have ARIA current on active navigation items', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for navigation with aria-current
    const currentNavItem = page.locator('[aria-current="page"], [aria-current="true"]');

    if (await currentNavItem.count() > 0) {
      // Should be visible
      await expect(currentNavItem.first()).toBeVisible();

      console.log(`Found ${await currentNavItem.count()} items with aria-current`);
    }
  });

  test('Should have accessible names for icon-only buttons', async ({ page }) => {
    await page.goto('/auth/login');

    // Look for buttons with no text (icon-only)
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const textContent = (await button.textContent())?.trim() || '';
      const hasVisibleText = textContent.length > 0;

      if (!hasVisibleText) {
        // Icon-only button must have aria-label
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');
        const title = await button.getAttribute('title');

        const hasAccessibleName = ariaLabel || ariaLabelledBy || title;

        if (!hasAccessibleName) {
          const html = await button.evaluate(el => el.outerHTML);
          console.log('Icon-only button without accessible name:', html);
        }

        expect(hasAccessibleName).toBeTruthy();
      }
    }
  });

  test('Should have status messages announced to screen readers', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit form to trigger error
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Look for status/alert role
    const statusMessages = page.locator('[role="status"], [role="alert"]');

    if (await statusMessages.count() > 0) {
      const firstStatus = statusMessages.first();

      // Should be in live region
      const ariaLive = await firstStatus.getAttribute('aria-live');
      const role = await firstStatus.getAttribute('role');

      expect(ariaLive || role).toBeTruthy();

      // Should be visible
      await expect(firstStatus).toBeVisible();
    }
  });

  test('Should not use ARIA when native HTML is sufficient', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for anti-patterns like <div role="button"> instead of <button>
    const divButtons = page.locator('div[role="button"]');
    const divButtonCount = await divButtons.count();

    if (divButtonCount > 0) {
      console.log(`Warning: Found ${divButtonCount} div[role="button"] - should use <button> instead`);
    }

    // This is a warning, not a failure - but good to track
    expect(divButtonCount).toBeLessThan(5);
  });

  test('Should have descriptive ARIA labels (not generic)', async ({ page }) => {
    await page.goto('/auth/login');

    const ariaLabels = await page.locator('[aria-label]').all();

    for (const element of ariaLabels) {
      const ariaLabel = await element.getAttribute('aria-label');

      if (ariaLabel) {
        // Should not be generic labels
        const isGeneric = (
          ariaLabel.toLowerCase() === 'button' ||
          ariaLabel.toLowerCase() === 'link' ||
          ariaLabel.toLowerCase() === 'input' ||
          ariaLabel.toLowerCase() === 'close' ||
          ariaLabel.toLowerCase() === 'submit'
        );

        if (isGeneric) {
          console.log('Generic aria-label found:', ariaLabel);
        }

        // Should be descriptive (more than 2 characters)
        expect(ariaLabel.length).toBeGreaterThan(2);
      }
    }
  });
});

test.describe('Accessibility - ARIA Practices', () => {

  test('Should use ARIA landmarks correctly', async ({ page }) => {
    // Login to access full app
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Check for proper landmark usage
    const landmarks = {
      banner: await page.locator('[role="banner"], header').count(),
      main: await page.locator('[role="main"], main').count(),
      navigation: await page.locator('[role="navigation"], nav').count(),
      contentinfo: await page.locator('[role="contentinfo"], footer').count(),
      complementary: await page.locator('[role="complementary"], aside').count(),
      search: await page.locator('[role="search"]').count(),
    };

    console.log('Landmarks found:', landmarks);

    // Should have required landmarks
    expect(landmarks.main).toBeGreaterThan(0);
    expect(landmarks.banner).toBeGreaterThan(0);
  });

  test('Should have unique landmark labels when multiple instances', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Check for multiple navigation landmarks
    const navs = await page.locator('nav, [role="navigation"]').all();

    if (navs.length > 1) {
      // Each should have unique label
      const labels: string[] = [];

      for (const nav of navs) {
        const ariaLabel = await nav.getAttribute('aria-label');
        const ariaLabelledBy = await nav.getAttribute('aria-labelledby');

        const label = ariaLabel || ariaLabelledBy || '';
        labels.push(label);
      }

      // All labels should be unique
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    }
  });
});
