import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test('login page loads with all visual elements', async ({ page }) => {
    await page.goto('http://localhost:4000/auth/login');

    // Check page title
    await expect(page.locator('h2')).toContainText('Bem-vindo de volta');

    // Check form elements exist
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check visual elements (static design - split screen layout)
    await expect(page.getByRole('heading', { name: 'ServiceDesk' })).toBeVisible(); // Blue side panel heading
    await expect(page.getByText('Sistema profissional de gestão de atendimento')).toBeVisible();

    // Check links
    await expect(page.locator('a[href="/auth/register"]')).toBeVisible();
  });

  test('register page loads with all visual elements', async ({ page }) => {
    await page.goto('http://localhost:4000/auth/register');

    // Check page title
    await expect(page.locator('h2')).toContainText('Criar Conta');

    // Check form elements exist
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check visual elements (static design - split screen layout)
    await expect(page.getByText('Junte-se a nós')).toBeVisible(); // Blue side panel heading
    await expect(page.getByText('Crie sua conta e comece a gerenciar seus tickets de forma profissional')).toBeVisible();

    // Check links
    await expect(page.locator('a[href="/auth/login"]')).toBeVisible();
  });

  test('login form has password toggle button', async ({ page }) => {
    await page.goto('http://localhost:4000/auth/login');

    const passwordInput = page.locator('input[name="password"]');

    // Check password input exists
    await expect(passwordInput).toBeVisible();

    // Check there are toggle buttons (eye icons) near the password field
    const toggleButtons = page.locator('button').filter({ has: page.locator('svg') });
    await expect(toggleButtons.first()).toBeVisible();
  });

  test('login form validation', async ({ page }) => {
    await page.goto('http://localhost:4000/auth/login');

    const submitButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // Try to submit empty form
    await submitButton.click();

    // HTML5 validation should prevent submission
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
  });
});
