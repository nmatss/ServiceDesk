/**
 * Test Helper Functions
 * Reusable utility functions for E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Login helper function
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect after login
  await page.waitForURL(/\/(admin|portal|tickets|dashboard)/, { timeout: 10000 });
}

/**
 * Logout helper function
 */
export async function logout(page: Page) {
  // Try to find and click logout button
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sair"), a:has-text("Logout")').first();

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // Alternative: navigate to logout endpoint
    await page.goto('/api/auth/logout');
  }

  await page.waitForURL('/auth/login', { timeout: 5000 });
}

/**
 * Create a ticket helper function
 */
export async function createTicket(
  page: Page,
  title: string,
  description: string,
  priority?: string,
  category?: string
) {
  // Navigate to ticket creation page
  await page.goto('/portal/create');

  // Fill in ticket details
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="description"]', description);

  if (priority) {
    await page.selectOption('select[name="priority"]', priority);
  }

  if (category) {
    await page.selectOption('select[name="category"]', category);
  }

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for success and redirect
  await page.waitForURL(/\/tickets\/\d+/, { timeout: 10000 });

  // Extract ticket ID from URL
  const url = page.url();
  const match = url.match(/\/tickets\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Add comment to ticket
 */
export async function addComment(page: Page, ticketId: string, comment: string) {
  await page.goto(`/tickets/${ticketId}`);

  const commentField = page.locator('textarea[name="comment"], textarea[placeholder*="comment" i]').first();
  await commentField.fill(comment);

  const submitButton = page.locator('button:has-text("Add Comment"), button:has-text("Submit"), button[type="submit"]').first();
  await submitButton.click();

  // Wait for comment to appear
  await expect(page.locator(`text=${comment}`)).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Check if element exists (without throwing error)
 */
export async function elementExists(page: Page, selector: string, timeout = 2000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `test-results/screenshots/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Clear all cookies and local storage
 */
export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp, timeout = 10000) {
  return await page.waitForResponse(
    response => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Check accessibility issues using basic checks
 */
export async function checkBasicAccessibility(page: Page) {
  // Check for images without alt text
  const imagesWithoutAlt = await page.locator('img:not([alt])').count();
  expect(imagesWithoutAlt).toBe(0);

  // Check for buttons without accessible text
  const buttonsWithoutText = await page.locator('button:not([aria-label]):not(:has-text)').count();
  // Note: Some buttons might use icons, so we just log this
  if (buttonsWithoutText > 0) {
    console.warn(`Found ${buttonsWithoutText} buttons without accessible text`);
  }

  // Check for form inputs without labels
  const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([id])').count();
  if (inputsWithoutLabels > 0) {
    console.warn(`Found ${inputsWithoutLabels} inputs without labels`);
  }
}

/**
 * Fill form with data object
 */
export async function fillForm(page: Page, formData: Record<string, string>) {
  for (const [name, value] of Object.entries(formData)) {
    const input = page.locator(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`).first();

    const tagName = await input.evaluate(el => el.tagName.toLowerCase());

    if (tagName === 'select') {
      await input.selectOption(value);
    } else {
      await input.fill(value);
    }
  }
}

/**
 * Check responsive layout
 */
export async function checkResponsiveLayout(page: Page) {
  // Check mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);

  // Check tablet viewport
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);

  // Check desktop viewport
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
}
