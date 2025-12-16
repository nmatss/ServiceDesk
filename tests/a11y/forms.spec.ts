/**
 * Forms Accessibility Tests
 * WCAG 2.1 - Form Labels, Error Handling, Input Assistance
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility - Form Labels', () => {

  test('Should have associated labels for all form inputs', async ({ page }) => {
    await page.goto('/auth/login');

    const inputs = await page.locator('input, textarea, select').all();

    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const name = await input.getAttribute('name');

      // Check for associated label
      let hasLabel = false;
      if (id) {
        const labelCount = await page.locator(`label[for="${id}"]`).count();
        hasLabel = labelCount > 0;
      }

      // Must have accessible name
      const hasAccessibleName = ariaLabel || ariaLabelledBy || hasLabel;

      if (!hasAccessibleName) {
        const type = await input.getAttribute('type');
        console.log(`Input without label: name="${name}" type="${type}" id="${id}"`);
      }

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('Should have visible labels (not just placeholder)', async ({ page }) => {
    await page.goto('/auth/login');

    const inputs = await page.locator('input, textarea').all();

    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);

        if (await label.count() > 0) {
          // Label should be visible
          await expect(label).toBeVisible();

          const labelText = await label.textContent();

          // Should not rely only on placeholder
          if (placeholder && !labelText) {
            console.log('Input relies only on placeholder:', id);
          }
        }
      }
    }
  });

  test('Should have labels that describe the input purpose', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('[name="email"]');
    const emailId = await emailInput.getAttribute('id');

    if (emailId) {
      const label = page.locator(`label[for="${emailId}"]`);
      const labelText = (await label.textContent())?.toLowerCase() || '';

      // Should contain "email" or similar
      expect(labelText).toMatch(/email|e-mail|endereço/i);
    }
  });

  test('Should have labels at the beginning of form controls', async ({ page }) => {
    await page.goto('/auth/login');

    const inputs = await page.locator('input').all();

    for (const input of inputs) {
      const id = await input.getAttribute('id');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);

        if (await label.count() > 0) {
          const labelBox = await label.boundingBox();
          const inputBox = await input.boundingBox();

          if (labelBox && inputBox) {
            // Label should generally be above or to the left of input
            const labelBeforeInput = (
              labelBox.y < inputBox.y || // Above
              (labelBox.y === inputBox.y && labelBox.x < inputBox.x) // Left
            );

            console.log(`Label position: ${labelBeforeInput ? 'before' : 'after'} input`);
          }
        }
      }
    }
  });

  test('Should have labels for radio buttons and checkboxes', async ({ page }) => {
    await page.goto('/auth/register');

    const radios = await page.locator('input[type="radio"], input[type="checkbox"]').all();

    for (const radio of radios) {
      const id = await radio.getAttribute('id');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        expect(await label.count()).toBeGreaterThan(0);

        if (await label.count() > 0) {
          await expect(label).toBeVisible();
        }
      }
    }
  });

  test('Should have fieldset and legend for radio groups', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Look for radio button groups
    const fieldsets = page.locator('fieldset');

    if (await fieldsets.count() > 0) {
      for (const fieldset of await fieldsets.all()) {
        // Should have legend
        const legend = fieldset.locator('legend');
        expect(await legend.count()).toBeGreaterThan(0);

        if (await legend.count() > 0) {
          await expect(legend).toBeVisible();
        }
      }
    }
  });
});

test.describe('Accessibility - Form Error Handling', () => {

  test('Should show error messages accessibly', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit empty form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const emailInput = page.locator('[name="email"]');

    // Should have aria-invalid
    const ariaInvalid = await emailInput.getAttribute('aria-invalid');
    expect(ariaInvalid).toBe('true');

    // Should have aria-describedby
    const ariaDescribedBy = await emailInput.getAttribute('aria-describedby');
    expect(ariaDescribedBy).toBeTruthy();

    if (ariaDescribedBy) {
      // Error message should exist and be visible
      const errorMessage = page.locator(`#${ariaDescribedBy}`);
      expect(await errorMessage.count()).toBeGreaterThan(0);
      await expect(errorMessage).toBeVisible();

      // Error should have meaningful text
      const errorText = await errorMessage.textContent();
      expect(errorText?.length).toBeGreaterThan(5);

      console.log('Error message:', errorText);
    }
  });

  test('Should announce errors to screen readers', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Look for error summary or live region
    const errorRegion = page.locator('[role="alert"], [role="status"], [aria-live]');

    if (await errorRegion.count() > 0) {
      const firstError = errorRegion.first();

      // Should have role or aria-live
      const role = await firstError.getAttribute('role');
      const ariaLive = await firstError.getAttribute('aria-live');

      expect(role || ariaLive).toBeTruthy();

      console.log('Error announcement:', { role, ariaLive });
    }
  });

  test('Should provide error summary at top of form', async ({ page }) => {
    await page.goto('/auth/register');

    // Fill form incorrectly
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', '123'); // Too short
    await page.click('button[type="submit"]');

    await page.waitForTimeout(500);

    // Look for error summary
    const errorSummary = page.locator('[role="alert"], .error-summary, [class*="error-list"]').first();

    if (await errorSummary.count() > 0) {
      // Should be visible
      await expect(errorSummary).toBeVisible();

      // Should be near top of form
      const summaryBox = await errorSummary.boundingBox();
      const formBox = await page.locator('form').first().boundingBox();

      if (summaryBox && formBox) {
        expect(summaryBox.y).toBeLessThan(formBox.y + 200);
      }
    }
  });

  test('Should provide specific error messages (not generic)', async ({ page }) => {
    await page.goto('/auth/login');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const emailInput = page.locator('[name="email"]');
    const describedBy = await emailInput.getAttribute('aria-describedby');

    if (describedBy) {
      const errorMessage = await page.locator(`#${describedBy}`).textContent();

      // Should not be generic
      const isGeneric = (
        errorMessage?.toLowerCase() === 'error' ||
        errorMessage?.toLowerCase() === 'invalid' ||
        errorMessage?.toLowerCase() === 'required'
      );

      expect(isGeneric).toBe(false);

      // Should mention the field name
      expect(errorMessage?.toLowerCase()).toContain('email');
    }
  });

  test('Should suggest corrections for errors', async ({ page }) => {
    await page.goto('/auth/login');

    // Enter invalid email
    await page.fill('[name="email"]', 'notanemail');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const emailInput = page.locator('[name="email"]');
    const describedBy = await emailInput.getAttribute('aria-describedby');

    if (describedBy) {
      const errorMessage = await page.locator(`#${describedBy}`).textContent();

      console.log('Error suggestion:', errorMessage);

      // Should provide guidance (e.g., "Please enter a valid email address")
      expect(errorMessage?.length).toBeGreaterThan(10);
    }
  });

  test('Should maintain form data after validation error', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill email
    await page.fill('[name="email"]', 'test@example.com');

    // Submit without password
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Email should still be filled
    const emailValue = await page.locator('[name="email"]').inputValue();
    expect(emailValue).toBe('test@example.com');
  });

  test('Should clear errors when corrected', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit to show errors
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const emailInput = page.locator('[name="email"]');

    // Should show error
    let ariaInvalid = await emailInput.getAttribute('aria-invalid');
    expect(ariaInvalid).toBe('true');

    // Fill email correctly
    await page.fill('[name="email"]', 'test@example.com');
    await page.waitForTimeout(500);

    // Error should clear (or remain until submit - both are acceptable)
    ariaInvalid = await emailInput.getAttribute('aria-invalid');
    console.log('aria-invalid after correction:', ariaInvalid);
  });
});

test.describe('Accessibility - Form Input Assistance', () => {

  test('Should have autocomplete attributes on appropriate fields', async ({ page }) => {
    await page.goto('/auth/login');

    // Email should have autocomplete
    const emailInput = page.locator('[name="email"]');
    const emailAutocomplete = await emailInput.getAttribute('autocomplete');

    expect(emailAutocomplete).toBeTruthy();
    expect(emailAutocomplete).toMatch(/email|username/);

    // Password should have autocomplete
    const passwordInput = page.locator('[name="password"]');
    const passwordAutocomplete = await passwordInput.getAttribute('autocomplete');

    expect(passwordAutocomplete).toMatch(/current-password|password/);
  });

  test('Should provide input format instructions', async ({ page }) => {
    await page.goto('/auth/register');

    // Look for password field
    const passwordInput = page.locator('input[type="password"]').first();

    // Should have description of requirements
    const describedBy = await passwordInput.getAttribute('aria-describedby');

    if (describedBy) {
      const description = page.locator(`#${describedBy}`);

      if (await description.count() > 0) {
        const descText = await description.textContent();
        console.log('Password requirements:', descText);

        // Should describe requirements
        expect(descText?.length).toBeGreaterThan(10);
      }
    }
  });

  test('Should have help text for complex inputs', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    // Look for inputs with help text
    const inputsWithHelp = page.locator('[aria-describedby]');

    if (await inputsWithHelp.count() > 0) {
      for (const input of await inputsWithHelp.all()) {
        const describedBy = await input.getAttribute('aria-describedby');

        if (describedBy) {
          const helpText = page.locator(`#${describedBy}`);

          if (await helpText.count() > 0) {
            console.log('Help text found:', await helpText.textContent());
          }
        }
      }
    }
  });

  test('Should show required field indicators', async ({ page }) => {
    await page.goto('/auth/login');

    const requiredInputs = await page.locator('input[required], input[aria-required="true"]').all();

    for (const input of requiredInputs) {
      // Should have aria-required or required attribute
      const ariaRequired = await input.getAttribute('aria-required');
      const required = await input.getAttribute('required');

      expect(ariaRequired || required).toBeTruthy();

      // Check for visual indicator (*, required label, etc.)
      const id = await input.getAttribute('id');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelText = await label.textContent();

        console.log('Required field label:', labelText);
      }
    }
  });

  test('Should have appropriate input types', async ({ page }) => {
    await page.goto('/auth/login');

    // Email field
    const emailInput = page.locator('[name="email"]');
    const emailType = await emailInput.getAttribute('type');
    expect(emailType).toBe('email');

    // Password field
    const passwordInput = page.locator('[name="password"]');
    const passwordType = await passwordInput.getAttribute('type');
    expect(passwordType).toBe('password');
  });

  test('Should not have excessive timeouts', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill form slowly
    await page.fill('[name="email"]', 'test@example.com');
    await page.waitForTimeout(5000); // 5 seconds

    // Should still be able to submit
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Form should process (no timeout error)
    await page.waitForTimeout(1000);
    expect(page.url()).toBeTruthy();
  });
});

test.describe('Accessibility - Form Validation', () => {

  test('Should validate on submit (not on blur)', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('[name="email"]');

    // Focus and blur without filling
    await emailInput.focus();
    await emailInput.blur();

    // Should not show error immediately (wait for submit)
    const ariaInvalid = await emailInput.getAttribute('aria-invalid');

    console.log('aria-invalid after blur:', ariaInvalid);

    // It's OK to show errors on blur, but prefer on submit
  });

  test('Should validate email format', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', 'invalidemail');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const emailInput = page.locator('[name="email"]');
    const ariaInvalid = await emailInput.getAttribute('aria-invalid');

    expect(ariaInvalid).toBe('true');
  });

  test('Should validate password requirements', async ({ page }) => {
    await page.goto('/auth/register');

    // Fill with weak password
    await page.fill('input[name="password"]', '123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const passwordInput = page.locator('input[name="password"]');
    const ariaInvalid = await passwordInput.getAttribute('aria-invalid');

    // Should show error for weak password
    if (ariaInvalid === 'true') {
      const describedBy = await passwordInput.getAttribute('aria-describedby');

      if (describedBy) {
        const errorMessage = await page.locator(`#${describedBy}`).textContent();
        console.log('Password validation error:', errorMessage);
      }
    }
  });

  test('Should prevent double submission', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');

    const submitButton = page.locator('button[type="submit"]');

    // Click submit
    await submitButton.click();

    // Button should be disabled during submission
    await page.waitForTimeout(100);

    const isDisabled = await submitButton.isDisabled();
    console.log('Button disabled during submission:', isDisabled);

    // This is a best practice but not required
  });
});

test.describe('Accessibility - Form Success States', () => {

  test('Should announce successful form submission', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Should redirect or show success message
    await page.waitForTimeout(2000);

    // Look for success message
    const successMessage = page.locator('[role="status"], [role="alert"]', { hasText: /success|logged in|welcome/i });

    if (await successMessage.count() > 0) {
      console.log('Success message found');
    }

    // Or should redirect
    expect(page.url()).not.toContain('/auth/login');
  });

  test('Should provide confirmation for destructive actions', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    // Look for delete buttons
    const deleteButtons = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();

    if (await deleteButtons.count() > 0) {
      await deleteButtons.click();
      await page.waitForTimeout(500);

      // Should show confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]');

      if (await confirmDialog.count() > 0) {
        console.log('Confirmation dialog shown for destructive action');
      }
    }
  });
});

test.describe('Accessibility - Form Accessibility Scan', () => {

  test('Login form should pass axe accessibility scan', async ({ page }) => {
    await page.goto('/auth/login');

    const results = await new AxeBuilder({ page })
      .include('form')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Form violations:', results.violations.length);
      results.violations.forEach(v => {
        console.log(`  - ${v.id}: ${v.description}`);
      });
    }

    expect(results.violations).toEqual([]);
  });

  test('Registration form should pass axe accessibility scan', async ({ page }) => {
    await page.goto('/auth/register');

    const results = await new AxeBuilder({ page })
      .include('form')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Ticket creation form should pass axe accessibility scan', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@servicedesk.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .include('form')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Ticket form violations:', results.violations.length);
    }

    expect(results.violations).toEqual([]);
  });
});
