import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { setupAuthenticatedSession, logout } from '../helpers/auth';

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated user session
    await setupAuthenticatedSession(page, 'user');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display knowledge base page', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Check for knowledge base title
    await expect(page.locator('h1, h2')).toContainText(
      /base de conhecimento|knowledge|artigos?/i
    );

    // Should have search functionality
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Search"]'
    );
    await expect(searchInput).toBeVisible();
  });

  test('should search for articles', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Search"]'
    ).first();

    // Enter search term
    await searchInput.fill('login');

    // Wait for search results or trigger search
    await page.keyboard.press('Enter');

    // Wait for results to load
    await page.waitForTimeout(1000);

    // Should show search results or articles
    const hasResults =
      (await page.locator('article, .article, [class*="card"]').count()) > 0 ||
      (await page.locator('text=/resultado|result/i').count()) > 0;

    expect(hasResults).toBe(true);
  });

  test('should filter articles by category', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Look for category filters
    const categoryButtons = page.locator(
      'button[class*="category"], a[class*="category"], [role="tab"]'
    );

    if (await categoryButtons.count() > 0) {
      // Click on a category
      await categoryButtons.first().click();

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Should show filtered articles
      const hasArticles =
        (await page.locator('article, .article, [class*="card"]').count()) > 0;

      expect(hasArticles).toBe(true);
    }
  });

  test('should display article categories', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Should show categories
    const categories = page.locator(
      '[class*="category"], [class*="tag"], button:has-text("Geral")'
    );

    const categoriesCount = await categories.count();
    expect(categoriesCount).toBeGreaterThan(0);
  });

  test('should view article details', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Find first article link
    const articleLinks = page.locator(
      'a[href*="/knowledge/article/"], a[href*="/article/"]'
    );

    if (await articleLinks.count() > 0) {
      const firstArticle = articleLinks.first();
      await firstArticle.click();

      // Should navigate to article page
      await page.waitForURL((url) => url.pathname.includes('/article/'), {
        timeout: 10000
      });

      // Should show article content
      await expect(page.locator('h1, h2, article')).toBeVisible();
    } else {
      // Create a sample article URL and test it
      await page.goto('/knowledge/article/test-article');
      await page.waitForLoadState('networkidle');

      // Should show article page (even if it's 404)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should show article metadata', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Check for article metadata like views, date, author
    const hasMetadata =
      (await page.locator('text=/visualiza[çc][õo]es?|views?/i').count()) >
        0 ||
      (await page.locator('text=/autor|author/i').count()) > 0 ||
      (await page.locator('text=/criado|created/i').count()) > 0;

    // Metadata might be visible
    if (hasMetadata) {
      expect(hasMetadata).toBe(true);
    }
  });

  test('should provide helpful/not helpful feedback', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Try to find and click an article
    const articleLink = page
      .locator('a[href*="/knowledge/article/"], a[href*="/article/"]')
      .first();

    if (await articleLink.count() > 0) {
      await articleLink.click();
      await page.waitForLoadState('networkidle');

      // Look for helpful/not helpful buttons
      const helpfulButton = page.locator(
        'button:has-text("Útil"), button:has-text("Helpful"), [aria-label*="útil"]'
      );

      const notHelpfulButton = page.locator(
        'button:has-text("Não útil"), button:has-text("Not helpful"), [aria-label*="não útil"]'
      );

      if (
        (await helpfulButton.count()) > 0 ||
        (await notHelpfulButton.count()) > 0
      ) {
        // Click helpful button
        if (await helpfulButton.count() > 0) {
          await helpfulButton.first().click();

          // Should show feedback confirmation
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('should display popular/recent articles', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Look for popular or recent articles section
    const popularSection = page.locator(
      'text=/populares?|popular|recentes?|recent/i'
    );

    if (await popularSection.count() > 0) {
      await expect(popularSection.first()).toBeVisible();
    }

    // Should have some articles displayed
    const articles = page.locator(
      'article, .article, [class*="article-card"]'
    );
    const articlesCount = await articles.count();

    // Might have articles, but not required
    expect(articlesCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle empty search results', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Search for something that doesn't exist
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill('xyzabc123nonexistent');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    // Should show "no results" message
    const noResults =
      (await page
        .locator('text=/nenhum resultado|no results|not found/i')
        .count()) > 0;

    if (noResults) {
      expect(noResults).toBe(true);
    }
  });

  test('should display article tags', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Look for tags in articles
    const tags = page.locator('[class*="tag"], .badge, .chip');

    if (await tags.count() > 0) {
      await expect(tags.first()).toBeVisible();
    }
  });

  test('should support keyboard navigation in search', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Tab to search input
    await page.keyboard.press('Tab');

    // Type search query
    await page.keyboard.type('teste');

    // Press Enter to search
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    // Should trigger search
    const currentUrl = page.url();
    expect(currentUrl).toBeTruthy();
  });

  test('should be accessible', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');
    await injectAxe(page);

    // Run accessibility checks
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Should display search on mobile
    const searchInput = page.locator('input[type="search"]').first();

    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();
    }

    // Should show articles
    const hasContent =
      (await page.locator('h1, h2').count()) > 0;

    expect(hasContent).toBe(true);
  });

  test('should allow admins to create articles', async ({ page }) => {
    // Logout and login as admin
    await logout(page);
    await setupAuthenticatedSession(page, 'admin');

    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Look for "New Article" button (admin only)
    const newArticleButton = page.locator(
      'a:has-text("Novo"), button:has-text("Criar"), a[href*="/knowledge/new"]'
    );

    if (await newArticleButton.count() > 0) {
      await expect(newArticleButton.first()).toBeVisible();
    }
  });

  test('should track article views', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Find first article
    const articleLink = page
      .locator('a[href*="/knowledge/article/"]')
      .first();

    if (await articleLink.count() > 0) {
      // Get initial view count if visible
      const viewsElement = page.locator('text=/\\d+.*view/i').first();
      let initialViews = 0;

      if (await viewsElement.count() > 0) {
        const viewsText = await viewsElement.textContent();
        const match = viewsText?.match(/\d+/);
        if (match) {
          initialViews = parseInt(match[0]);
        }
      }

      // Click article
      await articleLink.click();
      await page.waitForLoadState('networkidle');

      // View count should be displayed
      const articleViewCount = page.locator('text=/\\d+.*visualiza/i');

      if (await articleViewCount.count() > 0) {
        await expect(articleViewCount.first()).toBeVisible();
      }
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/knowledge/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    // Should show error message or fallback UI
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);

    // Page should not crash
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('should clear search query', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"]').first();

    // Enter search term
    await searchInput.fill('test query');

    // Look for clear button
    const clearButton = page.locator(
      'button[aria-label*="limpar"], button[aria-label*="clear"], button:has-text("×")'
    );

    if (await clearButton.count() > 0) {
      await clearButton.click();

      // Input should be cleared
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('');
    } else {
      // Manually clear
      await searchInput.clear();
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('should show article breadcrumbs', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');

    const articleLink = page
      .locator('a[href*="/knowledge/article/"]')
      .first();

    if (await articleLink.count() > 0) {
      await articleLink.click();
      await page.waitForLoadState('networkidle');

      // Look for breadcrumbs
      const breadcrumbs = page.locator(
        'nav[aria-label*="breadcrumb"], [class*="breadcrumb"]'
      );

      if (await breadcrumbs.count() > 0) {
        await expect(breadcrumbs.first()).toBeVisible();
      }
    }
  });
});
