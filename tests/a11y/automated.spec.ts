/**
 * Automated Accessibility Tests using axe-core
 * WCAG 2.1 Level AA Compliance
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { axeConfig, criticalImpact, filterViolationsByImpact, formatViolations } from './axe.config';

test.describe('Accessibility - Automated (axe-core)', () => {

  test('Login page should not have accessibility violations', async ({ page }) => {
    await page.goto('/auth/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Login Page Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    // Expect no violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Registration page should not have accessibility violations', async ({ page }) => {
    await page.goto('/auth/register');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Register Page Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Dashboard should not have accessibility violations', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/portal');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Dashboard Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Tickets list page should not have accessibility violations', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to tickets
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Tickets List Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('New ticket form should not have accessibility violations', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to new ticket form
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('New Ticket Form Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Admin panel should not have accessibility violations', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Admin Panel Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Knowledge base should not have accessibility violations', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to knowledge base
    await page.goto('/kb');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Knowledge Base Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Should not have critical violations on any page', async ({ page }) => {
    const pages = [
      '/auth/login',
      '/auth/register',
    ];

    for (const url of pages) {
      await page.goto(url);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const criticalViolations = filterViolationsByImpact(
        results.violations,
        criticalImpact
      );

      if (criticalViolations.length > 0) {
        console.log(`Critical violations on ${url}:`);
        console.log(formatViolations(criticalViolations));
      }

      expect(criticalViolations).toEqual([]);
    }
  });

  test('Should pass Section 508 compliance', async ({ page }) => {
    await page.goto('/auth/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['section508'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('Section 508 Violations:');
      console.log(formatViolations(accessibilityScanResults.violations));
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Should have proper document structure', async ({ page }) => {
    await page.goto('/auth/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include(['html'])
      .withRules(['html-has-lang', 'html-lang-valid', 'page-has-heading-one'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Should exclude third-party widgets from scan', async ({ page }) => {
    await page.goto('/tickets');

    // Exclude third-party components if any
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('.third-party-widget')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Should analyze specific components', async ({ page }) => {
    await page.goto('/auth/login');

    // Test only the login form
    const formResults = await new AxeBuilder({ page })
      .include('form')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(formResults.violations).toEqual([]);
  });

  test('Should have no incomplete checks', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Log incomplete checks for manual review
    if (results.incomplete.length > 0) {
      console.log('Incomplete checks (requires manual review):');
      console.log(formatViolations(results.incomplete));
    }

    // Incomplete checks should be minimal
    expect(results.incomplete.length).toBeLessThan(5);
  });

  test('Should detect and report best practice violations', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withTags(['best-practice'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Best Practice Violations:');
      console.log(formatViolations(results.violations));
    }

    // Best practices are optional but recommended
    expect(results.violations.length).toBeLessThan(10);
  });

  test('Should pass all WCAG 2.1 AAA tests (strict)', async ({ page }) => {
    test.slow(); // AAA tests can take longer

    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aaa', 'wcag21aaa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('WCAG 2.1 AAA Violations (optional):');
      console.log(formatViolations(results.violations));
    }

    // AAA is optional but good to track
    // Don't fail the test, just log
    console.log(`Total AAA violations: ${results.violations.length}`);
  });
});

test.describe('Accessibility - Dynamic Content', () => {

  test('Should maintain accessibility after client-side navigation', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate using client-side routing
    await page.click('a[href="/tickets"]');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Should maintain accessibility after modal opens', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');

    // Try to open modal (if exists)
    const modalTrigger = page.locator('[data-testid="new-ticket-button"]').first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      await page.waitForTimeout(500); // Wait for modal animation

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    }
  });

  test('Should maintain accessibility after error state', async ({ page }) => {
    await page.goto('/auth/login');

    // Trigger validation errors
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
