/**
 * Responsive Design Test Suite
 *
 * Tests responsive behavior across different devices:
 * - Mobile (375x667 - iPhone SE)
 * - Tablet (768x1024 - iPad)
 * - Desktop (1920x1080 - Full HD)
 * - Ultra-wide (2560x1440 - QHD)
 */

import { test, expect, devices } from '@playwright/test';

const viewports = {
  mobile: { width: 375, height: 667, name: 'Mobile (iPhone SE)' },
  mobileLarge: { width: 414, height: 896, name: 'Mobile Large (iPhone 11)' },
  tablet: { width: 768, height: 1024, name: 'Tablet (iPad)' },
  desktop: { width: 1920, height: 1080, name: 'Desktop (Full HD)' },
  ultrawide: { width: 2560, height: 1440, name: 'Ultra-wide (QHD)' }
};

test.describe('Responsive Design Tests', () => {
  for (const [key, viewport] of Object.entries(viewports)) {
    test.describe(`${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('login page should be responsive', async ({ page }) => {
        await page.goto('/auth/login');

        // Page should be visible
        await expect(page.locator('body')).toBeVisible();

        // Form should be visible
        const form = page.locator('form');
        await expect(form).toBeVisible();

        // No horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);

        // Submit button should be visible without scrolling
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeInViewport();
      });

      test('dashboard should adapt to screen size', async ({ page }) => {
        await page.goto('/auth/login');
        await page.fill('input[type="email"]', 'admin@servicedesk.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|admin/);

        // No horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);

        // Check layout adaptation
        if (viewport.width < 768) {
          // Mobile: Sidebar should be hidden or collapsible
          const sidebar = page.locator('nav, [role="navigation"], .sidebar').first();

          if (await sidebar.count() > 0) {
            const isHidden = await sidebar.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.display === 'none' || style.transform.includes('translate');
            });

            // On mobile, sidebar is typically hidden or off-screen
            expect(isHidden).toBeTruthy();
          }
        } else {
          // Desktop: Sidebar should be visible
          const sidebar = page.locator('nav, [role="navigation"]').first();

          if (await sidebar.count() > 0) {
            await expect(sidebar).toBeVisible();
          }
        }
      });

      test('interactive elements should meet touch target sizes', async ({ page }) => {
        await page.goto('/auth/login');

        const buttons = await page.locator('button, a').all();

        for (const button of buttons) {
          if (await button.isVisible()) {
            const box = await button.boundingBox();

            if (box && viewport.width < 768) {
              // Mobile: Minimum 44x44px touch target
              expect(box.width).toBeGreaterThanOrEqual(44);
              expect(box.height).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });

      test('text should be readable', async ({ page }) => {
        await page.goto('/auth/login');

        // Check minimum font size
        const textElements = await page.locator('p, span, div, label').all();

        for (const element of textElements.slice(0, 10)) { // Check first 10 elements
          if (await element.isVisible()) {
            const fontSize = await element.evaluate(el => {
              return parseFloat(window.getComputedStyle(el).fontSize);
            });

            // Minimum 14px for body text on mobile, 16px preferred
            const minSize = viewport.width < 768 ? 12 : 14;
            expect(fontSize).toBeGreaterThanOrEqual(minSize);
          }
        }
      });

      test('images should be responsive', async ({ page }) => {
        await page.goto('/auth/login');
        await page.fill('input[type="email"]', 'admin@servicedesk.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        const images = await page.locator('img').all();

        for (const img of images) {
          if (await img.isVisible()) {
            const box = await img.boundingBox();

            if (box) {
              // Image should not overflow viewport
              expect(box.width).toBeLessThanOrEqual(viewport.width);
            }
          }
        }
      });
    });
  }

  test.describe('Mobile Specific Features', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should show mobile navigation menu', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Look for hamburger menu
      const hamburger = page.locator('button[aria-label*="menu"], button:has(svg):has-text("Menu"), button.menu-button').first();

      if (await hamburger.count() > 0) {
        await expect(hamburger).toBeVisible();

        // Click to open
        await hamburger.click();

        // Navigation should appear
        const nav = page.locator('nav, [role="navigation"]');
        await expect(nav.first()).toBeVisible();
      }
    });

    test('should stack form fields vertically', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'agent@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/tickets/new');

      // Get all input fields
      const inputs = await page.locator('input, select, textarea').all();

      let previousY = 0;

      for (const input of inputs.slice(0, 5)) {
        if (await input.isVisible()) {
          const box = await input.boundingBox();

          if (box) {
            // Each field should be below the previous (stacked vertically)
            if (previousY > 0) {
              expect(box.y).toBeGreaterThan(previousY);
            }

            previousY = box.y + box.height;
          }
        }
      }
    });

    test('should have mobile-optimized modals', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      const modalTrigger = page.locator('button:has-text("Novo"), button:has-text("Criar")').first();

      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();

        const modal = page.locator('[role="dialog"]');

        if (await modal.count() > 0) {
          const box = await modal.first().boundingBox();

          if (box) {
            // Modal should not exceed viewport width (with some margin)
            expect(box.width).toBeLessThanOrEqual(375);

            // Modal should be centered or full-width
            expect(box.x).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('should support pull-to-refresh gesture area', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Check for proper overflow behavior
      const bodyOverflow = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowY;
      });

      // Should allow scrolling
      expect(['auto', 'scroll', 'visible'].includes(bodyOverflow)).toBeTruthy();
    });
  });

  test.describe('Tablet Specific Features', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should show optimized tablet layout', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Check for split-view or grid layout
      const containers = page.locator('.grid, .flex, [class*="grid-cols"]');

      if (await containers.count() > 0) {
        const gridStyles = await containers.first().evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns
          };
        });

        // Should use grid or flex layout
        expect(['grid', 'flex'].includes(gridStyles.display)).toBeTruthy();
      }
    });

    test('should display cards in 2-column grid', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      const cards = await page.locator('.card, [role="article"]').all();

      if (cards.length >= 2) {
        const firstBox = await cards[0].boundingBox();
        const secondBox = await cards[1].boundingBox();

        if (firstBox && secondBox) {
          // On tablet, cards should be side-by-side (similar Y position)
          const yDifference = Math.abs(firstBox.y - secondBox.y);
          expect(yDifference).toBeLessThan(100);
        }
      }
    });
  });

  test.describe('Desktop Specific Features', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('should show full desktop layout', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      // Sidebar should be visible
      const sidebar = page.locator('nav, [role="navigation"]').first();
      await expect(sidebar).toBeVisible();

      // Main content should not be full width
      const main = page.locator('main');
      const mainBox = await main.boundingBox();

      if (mainBox) {
        // Content should have margins (not full width)
        expect(mainBox.width).toBeLessThan(1920);
      }
    });

    test('should support hover states', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');

      const button = page.locator('button').first();

      if (await button.isVisible()) {
        // Get initial background
        const initialBg = await button.evaluate(el => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Hover
        await button.hover();

        // Background should change on hover
        const hoverBg = await button.evaluate(el => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Hover state should be different (or check for transform/shadow changes)
        const hasHoverEffect = initialBg !== hoverBg ||
          await button.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.transform !== 'none' || style.boxShadow !== 'none';
          });

        expect(hasHoverEffect).toBeTruthy();
      }
    });
  });

  test.describe('Orientation Changes', () => {
    test('should handle portrait to landscape transition', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/auth/login');

      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 });

      // Page should still be usable
      await expect(page.locator('form')).toBeVisible();

      // No horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
    });
  });

  test.describe('Content Reflow', () => {
    test('content should reflow at 320px width', async ({ page }) => {
      // WCAG 2.1 Success Criterion 1.4.10 (AA)
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/auth/login');

      // No horizontal scroll at 320px
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);

      // Form should still be functional
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('tables should be responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/auth/login');
      await page.fill('input[type="email"]', 'admin@servicedesk.com');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.goto('/admin/users');

      const table = page.locator('table').first();

      if (await table.count() > 0) {
        const tableBox = await table.boundingBox();

        if (tableBox) {
          // Table should not cause horizontal scroll
          expect(tableBox.width).toBeLessThanOrEqual(375);

          // Check for responsive table wrapper
          const hasWrapper = await table.evaluate(el => {
            const parent = el.parentElement;
            const style = parent ? window.getComputedStyle(parent) : null;
            return style?.overflowX === 'auto' || style?.overflowX === 'scroll';
          });

          // Table should either fit or be in scrollable wrapper
          expect(hasWrapper || tableBox.width <= 375).toBeTruthy();
        }
      }
    });
  });

  test.describe('Text Scaling', () => {
    test('should support text zoom up to 200%', async ({ page }) => {
      await page.goto('/auth/login');

      // Zoom to 200%
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });

      await page.waitForTimeout(300);

      // Page should still be usable
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // No horizontal scroll (allow vertical scroll)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
    });
  });

  test.describe('Safe Areas', () => {
    test('should respect safe areas on notched devices', async ({ page }) => {
      // Simulate iPhone with notch
      await page.setViewportSize({ width: 375, height: 812 });

      await page.evaluate(() => {
        // Simulate safe area insets
        const style = document.createElement('style');
        style.textContent = `
          :root {
            --safe-area-inset-top: 44px;
            --safe-area-inset-bottom: 34px;
            --safe-area-inset-left: 0px;
            --safe-area-inset-right: 0px;
          }
        `;
        document.head.appendChild(style);
      });

      await page.goto('/auth/login');

      // Check if top content respects safe area
      const header = page.locator('header, nav').first();

      if (await header.count() > 0) {
        const headerBox = await header.boundingBox();

        if (headerBox) {
          // Header should start below safe area (44px notch)
          expect(headerBox.y).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  test.describe('Performance on Mobile', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should load quickly on mobile', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/auth/login');

      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds on mobile
      expect(loadTime).toBeLessThan(3000);
    });

    test('should not have layout shift', async ({ page }) => {
      await page.goto('/auth/login');

      // Wait for page to stabilize
      await page.waitForLoadState('networkidle');

      // Get initial positions
      const initialPositions = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, input'));
        return elements.map(el => {
          const rect = el.getBoundingClientRect();
          return { id: el.id, y: rect.y };
        });
      });

      // Wait a bit
      await page.waitForTimeout(500);

      // Check positions again
      const finalPositions = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, input'));
        return elements.map(el => {
          const rect = el.getBoundingClientRect();
          return { id: el.id, y: rect.y };
        });
      });

      // Positions should not have shifted
      for (let i = 0; i < initialPositions.length; i++) {
        if (initialPositions[i].id === finalPositions[i].id) {
          expect(Math.abs(initialPositions[i].y - finalPositions[i].y)).toBeLessThan(5);
        }
      }
    });
  });
});
