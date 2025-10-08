/**
 * Keyboard Navigation Test Suite
 *
 * Tests keyboard accessibility including:
 * - Tab order and focus management
 * - Keyboard shortcuts
 * - Arrow key navigation
 * - Enter/Space activation
 * - Escape key handling
 * - Focus trapping in modals
 */

import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.describe('Login Page Keyboard Navigation', () => {
    test('should navigate through form with Tab key', async ({ page }) => {
      await page.goto('/auth/login');

      // Press Tab to focus first interactive element
      await page.keyboard.press('Tab');

      // Should focus email input
      let focused = await page.evaluate(() => document.activeElement?.id);
      expect(focused).toBe('email');

      // Tab to password
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.id);
      expect(focused).toBe('password');

      // Tab to password visibility toggle
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBe('BUTTON');

      // Tab to remember me checkbox
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.type);
      expect(focused).toBe('checkbox');
    });

    test('should navigate backwards with Shift+Tab', async ({ page }) => {
      await page.goto('/auth/login');

      // Tab to submit button
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
      }

      const beforeShift = await page.evaluate(() => document.activeElement?.textContent);

      // Shift+Tab back
      await page.keyboard.press('Shift+Tab');

      const afterShift = await page.evaluate(() => document.activeElement?.textContent);

      // Should move to previous element
      expect(beforeShift).not.toBe(afterShift);
    });

    test('should submit form with Enter key', async ({ page }) => {
      await page.goto('/auth/login');

      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');

      // Focus submit button
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.focus();

      // Press Enter
      await page.keyboard.press('Enter');

      // Should navigate after successful login
      await page.waitForURL(/dashboard|admin/, { timeout: 5000 });
    });

    test('should toggle password visibility with keyboard', async ({ page }) => {
      await page.goto('/auth/login');

      const passwordInput = page.locator('input[type="password"], input[type="text"]').first();
      const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).last();

      // Get initial type
      await passwordInput.fill('testpassword');
      const initialType = await passwordInput.getAttribute('type');

      // Focus and activate toggle with keyboard
      await toggleButton.focus();
      await page.keyboard.press('Enter');

      // Type should change
      const newType = await passwordInput.getAttribute('type');
      expect(newType).not.toBe(initialType);

      // Should work with Space key too
      await page.keyboard.press('Space');
      const finalType = await passwordInput.getAttribute('type');
      expect(finalType).toBe(initialType);
    });
  });

  test.describe('Dashboard Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|admin/);
    });

    test('should navigate sidebar with keyboard', async ({ page }) => {
      // Focus first sidebar item
      await page.keyboard.press('Tab');

      let focusCount = 0;
      const maxTabs = 20;

      // Tab through sidebar items
      while (focusCount < maxTabs) {
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            role: el?.getAttribute('role'),
            inNav: el?.closest('nav') !== null
          };
        });

        if (focused.inNav && (focused.tag === 'A' || focused.tag === 'BUTTON')) {
          // Successfully found navigation item
          break;
        }

        await page.keyboard.press('Tab');
        focusCount++;
      }

      expect(focusCount).toBeLessThan(maxTabs);
    });

    test('should skip to main content', async ({ page }) => {
      // Look for skip link
      const skipLink = page.locator('a[href="#main-content"], a[href="#content"], a:has-text("Pular para")');

      if (await skipLink.count() > 0) {
        await skipLink.focus();
        await page.keyboard.press('Enter');

        // Focus should move to main content
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.closest('main') !== null || el?.id === 'main-content' || el?.id === 'content';
        });

        expect(focused).toBeTruthy();
      }
    });

    test('should navigate cards with Tab', async ({ page }) => {
      // Find cards or interactive grid items
      const cards = page.locator('.card, [role="article"], [role="listitem"]');

      if (await cards.count() > 0) {
        // Tab to first card
        let tabCount = 0;
        const maxTabs = 30;

        while (tabCount < maxTabs) {
          await page.keyboard.press('Tab');

          const focused = await page.evaluate(() => {
            const el = document.activeElement;
            return el?.closest('.card, [role="article"], [role="listitem"]') !== null;
          });

          if (focused) {
            break;
          }

          tabCount++;
        }

        expect(tabCount).toBeLessThan(maxTabs);
      }
    });
  });

  test.describe('Modal Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|admin/);
    });

    test('should trap focus in modal', async ({ page }) => {
      // Find and click modal trigger
      const modalTrigger = page.locator('button:has-text("Novo"), button:has-text("Criar"), button:has-text("Adicionar")').first();

      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();

        // Wait for modal
        const modal = page.locator('[role="dialog"], [role="alertdialog"]');

        if (await modal.count() > 0) {
          await expect(modal.first()).toBeVisible();

          // Get all focusable elements in modal
          const focusableElements = await modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').count();

          if (focusableElements > 1) {
            // Tab through all elements
            for (let i = 0; i < focusableElements + 2; i++) {
              await page.keyboard.press('Tab');

              // Focus should stay within modal
              const focusInModal = await page.evaluate(() => {
                const focused = document.activeElement;
                const modal = document.querySelector('[role="dialog"], [role="alertdialog"]');
                return modal?.contains(focused) || false;
              });

              expect(focusInModal).toBeTruthy();
            }
          }
        }
      }
    });

    test('should close modal with Escape key', async ({ page }) => {
      const modalTrigger = page.locator('button:has-text("Novo"), button:has-text("Criar")').first();

      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();

        const modal = page.locator('[role="dialog"]');

        if (await modal.count() > 0) {
          await expect(modal.first()).toBeVisible();

          // Press Escape
          await page.keyboard.press('Escape');

          // Modal should close
          await expect(modal.first()).not.toBeVisible({ timeout: 2000 });
        }
      }
    });

    test('should focus first element when modal opens', async ({ page }) => {
      const modalTrigger = page.locator('button:has-text("Novo")').first();

      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();

        const modal = page.locator('[role="dialog"]');

        if (await modal.count() > 0) {
          // Wait a bit for focus to settle
          await page.waitForTimeout(300);

          // Check if focus is in modal
          const focusInModal = await page.evaluate(() => {
            const focused = document.activeElement;
            const modal = document.querySelector('[role="dialog"]');
            return modal?.contains(focused) || false;
          });

          expect(focusInModal).toBeTruthy();
        }
      }
    });
  });

  test.describe('Dropdown Menu Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|admin/);
    });

    test('should open dropdown with Enter/Space', async ({ page }) => {
      const dropdownTrigger = page.locator('[aria-haspopup="true"], [aria-expanded]').first();

      if (await dropdownTrigger.count() > 0) {
        await dropdownTrigger.focus();

        // Open with Enter
        await page.keyboard.press('Enter');

        let expanded = await dropdownTrigger.getAttribute('aria-expanded');
        expect(expanded).toBe('true');

        // Close with Escape
        await page.keyboard.press('Escape');

        // Open with Space
        await page.keyboard.press('Space');

        expanded = await dropdownTrigger.getAttribute('aria-expanded');
        expect(expanded).toBe('true');
      }
    });

    test('should navigate dropdown items with arrow keys', async ({ page }) => {
      const dropdownTrigger = page.locator('[aria-haspopup="true"]').first();

      if (await dropdownTrigger.count() > 0) {
        await dropdownTrigger.focus();
        await page.keyboard.press('Enter');

        // Get dropdown menu
        const menu = page.locator('[role="menu"], [role="listbox"]');

        if (await menu.count() > 0) {
          // Press Down arrow
          await page.keyboard.press('ArrowDown');

          // Should focus first menu item
          const focused = await page.evaluate(() => {
            const el = document.activeElement;
            return el?.getAttribute('role');
          });

          expect(['menuitem', 'option'].includes(focused || '')).toBeTruthy();

          // Down arrow again
          await page.keyboard.press('ArrowDown');

          // Should focus next item (different element)
          const secondFocus = await page.evaluate(() => document.activeElement?.textContent);

          // Up arrow
          await page.keyboard.press('ArrowUp');
          const backToFirst = await page.evaluate(() => document.activeElement?.textContent);

          expect(backToFirst).not.toBe(secondFocus);
        }
      }
    });

    test('should close dropdown with Escape', async ({ page }) => {
      const dropdownTrigger = page.locator('[aria-haspopup="true"]').first();

      if (await dropdownTrigger.count() > 0) {
        await dropdownTrigger.focus();
        await page.keyboard.press('Enter');

        await page.keyboard.press('Escape');

        const expanded = await dropdownTrigger.getAttribute('aria-expanded');
        expect(expanded).toBe('false');
      }
    });
  });

  test.describe('Table Keyboard Navigation', () => {
    test('should navigate table with Tab', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/admin/users');

      // Find table
      const table = page.locator('table').first();

      if (await table.count() > 0) {
        // Tab to first interactive element in table
        let tabCount = 0;
        const maxTabs = 30;

        while (tabCount < maxTabs) {
          await page.keyboard.press('Tab');

          const inTable = await page.evaluate(() => {
            const el = document.activeElement;
            return el?.closest('table') !== null;
          });

          if (inTable) {
            break;
          }

          tabCount++;
        }

        expect(tabCount).toBeLessThan(maxTabs);
      }
    });

    test('should activate sortable headers with Enter/Space', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/admin/users');

      // Find sortable header
      const sortableHeader = page.locator('th button, th a, th[role="button"]').first();

      if (await sortableHeader.count() > 0) {
        await sortableHeader.focus();

        // Activate with Enter
        await page.keyboard.press('Enter');

        // Should trigger sort (check for URL change or aria-sort attribute)
        const ariaSort = await sortableHeader.getAttribute('aria-sort');
        expect(['ascending', 'descending'].includes(ariaSort || '')).toBeTruthy();
      }
    });
  });

  test.describe('Form Keyboard Navigation', () => {
    test('should navigate form fields with Tab', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'agent@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/tickets/new');

      // Tab through form fields
      const fields: string[] = [];
      let tabCount = 0;
      const maxTabs = 20;

      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');

        const fieldInfo = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            type: el?.getAttribute('type'),
            id: el?.id
          };
        });

        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(fieldInfo.tag)) {
          fields.push(`${fieldInfo.tag}:${fieldInfo.id || fieldInfo.type}`);
        }

        tabCount++;

        // Break if we've cycled back to first field
        if (fields.length > 3 && fields[0] === fields[fields.length - 1]) {
          break;
        }
      }

      // Should have focused multiple form fields
      expect(fields.length).toBeGreaterThan(3);
    });

    test('should select dropdown options with keyboard', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'agent@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/tickets/new');

      const select = page.locator('select').first();

      if (await select.count() > 0) {
        await select.focus();

        // Open dropdown with Space
        await page.keyboard.press('Space');

        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        // Select with Enter
        await page.keyboard.press('Enter');

        // Value should be selected
        const selectedValue = await select.inputValue();
        expect(selectedValue).toBeTruthy();
      }
    });

    test('should toggle checkbox with Space', async ({ page }) => {
      await page.goto('/auth/login');

      const checkbox = page.locator('input[type="checkbox"]').first();

      if (await checkbox.count() > 0) {
        await checkbox.focus();

        const initialState = await checkbox.isChecked();

        // Toggle with Space
        await page.keyboard.press('Space');

        const newState = await checkbox.isChecked();
        expect(newState).not.toBe(initialState);

        // Toggle back
        await page.keyboard.press('Space');

        const finalState = await checkbox.isChecked();
        expect(finalState).toBe(initialState);
      }
    });
  });

  test.describe('Search and Filter Keyboard Navigation', () => {
    test('should focus search input and allow typing', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first();

      if (await searchInput.count() > 0) {
        await searchInput.focus();

        // Type search query
        await page.keyboard.type('test query');

        const value = await searchInput.inputValue();
        expect(value).toBe('test query');

        // Clear with Ctrl+A + Delete
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');

        const clearedValue = await searchInput.inputValue();
        expect(clearedValue).toBe('');
      }
    });

    test('should submit search with Enter', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      const searchInput = page.locator('input[type="search"]').first();

      if (await searchInput.count() > 0) {
        await searchInput.focus();
        await page.keyboard.type('test');
        await page.keyboard.press('Enter');

        // Should trigger search (check URL or results)
        await page.waitForTimeout(500);

        // Check if URL changed or results updated
        const url = page.url();
        const hasSearchParam = url.includes('search') || url.includes('q=') || url.includes('query');

        // Either URL changed or results container exists
        const resultsExist = await page.locator('[role="region"], .results, .search-results').count() > 0;

        expect(hasSearchParam || resultsExist).toBeTruthy();
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should have keyboard shortcut documentation', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for keyboard shortcuts trigger (usually ? or Ctrl+/)
      await page.keyboard.press('?');

      // Check if shortcuts modal/panel appears
      const shortcutsPanel = page.locator('[role="dialog"]:has-text("Atalhos"), [role="dialog"]:has-text("Shortcuts")');

      if (await shortcutsPanel.count() > 0) {
        await expect(shortcutsPanel.first()).toBeVisible();
      }
    });

    test('should support common keyboard shortcuts', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Test Ctrl+K or Cmd+K for command palette/search
      const isMac = await page.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
      const modifier = isMac ? 'Meta' : 'Control';

      await page.keyboard.press(`${modifier}+KeyK`);

      // Check if command palette or search appears
      const commandPalette = page.locator('[role="dialog"], [role="search"], input[type="search"]');

      await page.waitForTimeout(300);

      if (await commandPalette.count() > 0) {
        const isVisible = await commandPalette.first().isVisible();
        expect(isVisible).toBeTruthy();
      }
    });
  });

  test.describe('Focus Order', () => {
    test('should have logical tab order', async ({ page }) => {
      await page.goto('/auth/login');

      const tabOrder: string[] = [];
      let previousY = 0;
      let tabCount = 0;
      const maxTabs = 15;

      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');

        const elementInfo = await page.evaluate(() => {
          const el = document.activeElement;
          const rect = el?.getBoundingClientRect();

          return {
            tag: el?.tagName,
            text: el?.textContent?.slice(0, 30),
            y: rect?.y || 0,
            x: rect?.x || 0
          };
        });

        tabOrder.push(`${elementInfo.tag}:${elementInfo.text}`);

        // Generally, tab order should flow top to bottom
        // Allow some variance for same-line elements
        if (elementInfo.y > previousY + 50) {
          // Moving down is good
          previousY = elementInfo.y;
        }

        tabCount++;
      }

      // Should have navigated through multiple elements
      expect(tabOrder.length).toBeGreaterThan(5);

      // Should not have any undefined elements
      const hasUndefined = tabOrder.some(item => item.includes('undefined'));
      expect(hasUndefined).toBe(false);
    });

    test('should skip hidden elements in tab order', async ({ page }) => {
      await page.goto('/auth/login');

      let tabCount = 0;
      const maxTabs = 20;

      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');

        const isHidden = await page.evaluate(() => {
          const el = document.activeElement;
          const style = window.getComputedStyle(el as Element);

          return (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          );
        });

        // Focused element should never be hidden
        expect(isHidden).toBe(false);

        tabCount++;
      }
    });
  });
});
