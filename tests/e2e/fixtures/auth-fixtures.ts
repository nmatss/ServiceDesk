/**
 * Authentication Fixtures
 * Provides authenticated page contexts for different user roles
 */

import { test as base, Page } from '@playwright/test';
import { testUsers } from './test-data';

type AuthFixtures = {
  adminPage: Page;
  agentPage: Page;
  userPage: Page;
};

export const test = base.extend<AuthFixtures>({
  // Admin authenticated page
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testUsers.admin.email);
    await page.fill('input[name="password"]', testUsers.admin.password);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL(/\/admin|\/dashboard/, { timeout: 10000 });

    await use(page);
    await context.close();
  },

  // Agent authenticated page
  agentPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as agent
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testUsers.agent.email);
    await page.fill('input[name="password"]', testUsers.agent.password);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL(/\/agent|\/tickets/, { timeout: 10000 });

    await use(page);
    await context.close();
  },

  // Regular user authenticated page
  userPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as user
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testUsers.user.email);
    await page.fill('input[name="password"]', testUsers.user.password);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL(/\/portal|\/tickets/, { timeout: 10000 });

    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
