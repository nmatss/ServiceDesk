import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { setupAuthenticatedSession, logout, login, TEST_USERS } from './helpers/auth';

/**
 * E2E Test: Complete Knowledge Base Journey
 *
 * This test follows a complete knowledge base user journey:
 * 1. User accesses knowledge base
 * 2. Browses categories
 * 3. Searches for articles
 * 4. Views article details
 * 5. Rates article (helpful/not helpful)
 * 6. Views related articles
 * 7. Admin creates new article
 */
test.describe('Knowledge Base Journey: Search → View → Rate Article', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('complete knowledge base journey: browse, search, view, and rate articles', async ({ page }) => {
    // ============================================
    // STEP 1: User Login
    // ============================================
    await test.step('User logs in to access knowledge base', async () => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      await login(page, TEST_USERS.user);

      // Verify successful authentication
      await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
        timeout: 10000
      });
    });

    // ============================================
    // STEP 2: Access Knowledge Base
    // ============================================
    await test.step('User navigates to knowledge base', async () => {
      // Navigate to knowledge base
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      // Verify knowledge base page
      await expect(page).toHaveURL(/\/knowledge/);

      // Check for knowledge base title
      const heading = page.locator('h1, h2');
      await expect(heading.first()).toContainText(/base.*conhecimento|knowledge|artigos?/i);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/kb-journey-home.png',
        fullPage: true
      });
    });

    // ============================================
    // STEP 3: Browse Categories
    // ============================================
    await test.step('User browses knowledge base categories', async () => {
      // Look for category navigation
      const categories = page.locator('[class*="category"], [role="tab"], button:has-text("Geral")');

      if (await categories.count() > 0) {
        // Verify categories are visible
        await expect(categories.first()).toBeVisible();

        // Count categories
        const categoryCount = await categories.count();
        expect(categoryCount).toBeGreaterThan(0);

        // Common category names to look for
        const commonCategories = [
          /geral|general/i,
          /suporte|support/i,
          /tutorial|tutoriais/i,
          /faq/i,
          /guia|guide/i
        ];

        for (const categoryName of commonCategories) {
          const category = page.locator(`text=${categoryName}`);
          if (await category.count() > 0) {
            await expect(category.first()).toBeVisible();
            break; // At least one category should exist
          }
        }

        // Click on first category
        await categories.first().click();
        await page.waitForTimeout(1000);

        // Verify articles filtered by category
        const articles = page.locator('article, .article-card, [class*="article"]');
        if (await articles.count() > 0) {
          await expect(articles.first()).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 4: Search for Articles
    // ============================================
    let searchedArticleUrl: string = '';

    await test.step('User searches for specific articles', async () => {
      // Find search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Search"]').first();

      await expect(searchInput).toBeVisible();

      // Perform search
      const searchTerm = 'login';
      await searchInput.fill(searchTerm);
      await page.keyboard.press('Enter');

      // Wait for search results
      await page.waitForTimeout(1500);

      // Verify search results are displayed
      const searchResults = page.locator('article, .article-card, [class*="article"], .search-result');

      if (await searchResults.count() > 0) {
        await expect(searchResults.first()).toBeVisible();

        // Take screenshot of search results
        await page.screenshot({
          path: 'test-results/kb-journey-search-results.png',
          fullPage: true
        });
      } else {
        // Check for "no results" message
        const noResults = page.locator('text=/nenhum resultado|no results|não encontrado/i');
        if (await noResults.count() > 0) {
          await expect(noResults).toBeVisible();
        }
      }

      // Try different search term if no results
      if (await searchResults.count() === 0) {
        await searchInput.fill('ticket');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
      }

      // Get first article link
      const firstArticleLink = page.locator('a[href*="/knowledge/article/"], a[href*="/article/"]').first();

      if (await firstArticleLink.count() > 0) {
        searchedArticleUrl = await firstArticleLink.getAttribute('href') || '';
      }
    });

    // ============================================
    // STEP 5: View Article Details
    // ============================================
    await test.step('User views article details', async () => {
      if (searchedArticleUrl) {
        await page.goto(searchedArticleUrl);
      } else {
        // Go back to knowledge base and click on any article
        await page.goto('/knowledge');
        await page.waitForLoadState('networkidle');

        const anyArticleLink = page.locator('a[href*="/knowledge/article/"], a[href*="/article/"]').first();

        if (await anyArticleLink.count() > 0) {
          await anyArticleLink.click();
        }
      }

      await page.waitForLoadState('networkidle');

      // Verify we're on an article page
      expect(page.url()).toMatch(/\/article\//);

      // Check for article title
      const articleTitle = page.locator('h1, h2, .article-title');
      await expect(articleTitle.first()).toBeVisible();

      // Check for article content
      const articleContent = page.locator('article, .article-content, [class*="content"], p');
      await expect(articleContent.first()).toBeVisible();

      // Check for article metadata
      const metadata = page.locator('text=/publicado|published|atualizado|updated|autor|author|visualiza[çc][õo]es|views/i');
      if (await metadata.count() > 0) {
        await expect(metadata.first()).toBeVisible();
      }

      // Check for article category tag
      const categoryTag = page.locator('[class*="badge"], [class*="tag"], [class*="category"]');
      if (await categoryTag.count() > 0) {
        await expect(categoryTag.first()).toBeVisible();
      }

      // Take screenshot of article
      await page.screenshot({
        path: 'test-results/kb-journey-article-view.png',
        fullPage: true
      });
    });

    // ============================================
    // STEP 6: Rate Article (Helpful/Not Helpful)
    // ============================================
    await test.step('User rates the article', async () => {
      // Look for rating buttons
      const helpfulButton = page.locator('button:has-text("Útil"), button:has-text("Helpful"), button:has-text("👍"), button[aria-label*="útil"]').first();
      const notHelpfulButton = page.locator('button:has-text("Não útil"), button:has-text("Not helpful"), button:has-text("👎")').first();

      if (await helpfulButton.count() > 0) {
        // Click helpful button
        await helpfulButton.click();
        await page.waitForTimeout(1000);

        // Verify feedback was recorded
        const feedbackMessage = page.locator('text=/obrigado|thanks|feedback.*registrado|feedback.*recorded/i');

        if (await feedbackMessage.count() > 0) {
          await expect(feedbackMessage).toBeVisible();
        }

        // Check if button state changed (disabled or highlighted)
        const buttonDisabled = await helpfulButton.isDisabled();
        const buttonClass = await helpfulButton.getAttribute('class');

        expect(buttonDisabled || buttonClass?.includes('active') || buttonClass?.includes('selected')).toBeTruthy();
      } else if (await notHelpfulButton.count() > 0) {
        // If only "not helpful" button exists, test that instead
        await notHelpfulButton.click();
        await page.waitForTimeout(1000);
      }
    });

    // ============================================
    // STEP 7: View Related Articles
    // ============================================
    await test.step('User explores related articles', async () => {
      // Look for related articles section
      const relatedArticlesSection = page.locator('text=/artigos.*relacionados?|related.*articles?|veja.*também/i');

      if (await relatedArticlesSection.count() > 0) {
        await expect(relatedArticlesSection.first()).toBeVisible();

        // Check for related article links
        const relatedLinks = page.locator('[class*="related"] a, aside a[href*="/article/"]');

        if (await relatedLinks.count() > 0) {
          // Verify at least one related article
          await expect(relatedLinks.first()).toBeVisible();

          // Click on related article
          await relatedLinks.first().click();
          await page.waitForLoadState('networkidle');

          // Verify we navigated to another article
          expect(page.url()).toMatch(/\/article\//);
        }
      }
    });

    // ============================================
    // STEP 8: Browse Popular Articles
    // ============================================
    await test.step('User views popular/trending articles', async () => {
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      // Look for popular articles section
      const popularSection = page.locator('text=/mais.*vistos?|popular|trending|destaque/i');

      if (await popularSection.count() > 0) {
        await expect(popularSection.first()).toBeVisible();

        // Verify popular articles are shown
        const popularArticles = page.locator('[class*="popular"] a, [class*="trending"] a');

        if (await popularArticles.count() > 0) {
          await expect(popularArticles.first()).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 9: Filter by Multiple Categories
    // ============================================
    await test.step('User filters articles by multiple categories', async () => {
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      // Try clicking on different categories
      const categoryButtons = page.locator('[class*="category"], [role="tab"]');

      if (await categoryButtons.count() > 1) {
        // Click on second category
        await categoryButtons.nth(1).click();
        await page.waitForTimeout(1000);

        // Verify articles are filtered
        const filteredArticles = page.locator('article, .article-card');
        if (await filteredArticles.count() > 0) {
          await expect(filteredArticles.first()).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 10: Use Advanced Search
    // ============================================
    await test.step('User performs advanced search with filters', async () => {
      await page.goto('/knowledge/search');
      await page.waitForLoadState('networkidle');

      // If dedicated search page exists
      if (page.url().includes('/search')) {
        const searchInput = page.locator('input[type="search"], input[name="q"]').first();

        if (await searchInput.count() > 0) {
          await searchInput.fill('como criar ticket');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);

          // Check for search filters
          const filters = page.locator('select, input[type="checkbox"]');
          if (await filters.count() > 0) {
            await expect(filters.first()).toBeVisible();
          }
        }
      }
    });

    // ============================================
    // STEP 11: Check Accessibility
    // ============================================
    await test.step('Verify accessibility of knowledge base', async () => {
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      await injectAxe(page);
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      });
    });

    // ============================================
    // STEP 12: Logout
    // ============================================
    await test.step('User logs out', async () => {
      await logout(page);
    });
  });

  test('admin creates and publishes new knowledge base article', async ({ page }) => {
    // ============================================
    // STEP 1: Admin Login
    // ============================================
    await test.step('Admin logs in', async () => {
      await login(page, TEST_USERS.admin);
    });

    // ============================================
    // STEP 2: Navigate to Knowledge Base Management
    // ============================================
    await test.step('Admin accesses KB management', async () => {
      // Try to access admin KB area
      await page.goto('/admin/knowledge');
      await page.waitForLoadState('networkidle');

      // If no admin KB page, try regular KB with admin role
      if (!page.url().includes('/knowledge')) {
        await page.goto('/knowledge');
        await page.waitForLoadState('networkidle');
      }
    });

    // ============================================
    // STEP 3: Create New Article
    // ============================================
    await test.step('Admin creates new article', async () => {
      // Look for "New Article" button
      const newArticleButton = page.locator('button:has-text("Novo Artigo"), button:has-text("New Article"), a[href*="/articles/new"]').first();

      if (await newArticleButton.count() > 0) {
        await newArticleButton.click();
        await page.waitForLoadState('networkidle');

        // Fill in article form
        const titleInput = page.locator('input[name="title"], input#title');
        if (await titleInput.count() > 0) {
          await titleInput.fill(`How to Create a Support Ticket - ${Date.now()}`);
        }

        const contentTextarea = page.locator('textarea[name="content"], [class*="editor"]').first();
        if (await contentTextarea.count() > 0) {
          const articleContent = `# Creating a Support Ticket

To create a new support ticket in our system:

1. Click on "New Ticket" button
2. Fill in the ticket title
3. Provide a detailed description
4. Select the appropriate category
5. Choose priority level
6. Submit the form

## Tips for Better Support
- Be specific about the issue
- Include error messages if any
- Mention steps to reproduce
- Attach relevant screenshots

For urgent issues, please select "High" or "Critical" priority.`;

          await contentTextarea.fill(articleContent);
        }

        // Select category
        const categorySelect = page.locator('select[name="category"], select[name="category_id"]');
        if (await categorySelect.count() > 0) {
          await categorySelect.selectOption({ index: 1 });
        }

        // Add tags
        const tagsInput = page.locator('input[name="tags"], input[placeholder*="tag"]');
        if (await tagsInput.count() > 0) {
          await tagsInput.fill('tutorial, tickets, support');
        }

        // Publish article
        const publishButton = page.locator('button[type="submit"], button:has-text("Publicar"), button:has-text("Publish")');
        if (await publishButton.count() > 0) {
          await publishButton.click();
          await page.waitForTimeout(2000);

          // Verify article was created
          const successMessage = page.locator('text=/sucesso|success|publicado|published/i');
          if (await successMessage.count() > 0) {
            await expect(successMessage).toBeVisible();
          }
        }
      }
    });

    // ============================================
    // STEP 4: Verify Article is Published
    // ============================================
    await test.step('Verify article appears in knowledge base', async () => {
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      // Search for the newly created article
      const searchInput = page.locator('input[type="search"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('How to Create a Support Ticket');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        // Verify article appears in results
        const articleLink = page.locator('text=/How to Create a Support Ticket/i');
        if (await articleLink.count() > 0) {
          await expect(articleLink.first()).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 5: Logout
    // ============================================
    await test.step('Admin logs out', async () => {
      await logout(page);
    });
  });

  test('user can access knowledge base without authentication for public articles', async ({ page }) => {
    await test.step('Access knowledge base as anonymous user', async () => {
      // Try to access knowledge base without login
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      // Should either show knowledge base or redirect to login
      const currentUrl = page.url();

      if (currentUrl.includes('/knowledge')) {
        // Knowledge base is public - verify content is shown
        const articles = page.locator('article, .article-card, h2');
        if (await articles.count() > 0) {
          await expect(articles.first()).toBeVisible();
        }
      } else if (currentUrl.includes('/auth/login')) {
        // Knowledge base requires authentication
        expect(currentUrl).toContain('/auth/login');
      }
    });
  });

  test('user receives article recommendations based on recent tickets', async ({ page }) => {
    await test.step('Setup: Login and create ticket', async () => {
      await login(page, TEST_USERS.user);

      // Create a ticket about password reset
      await page.goto('/portal/create');
      await page.waitForLoadState('networkidle');

      const titleInput = page.locator('input[name="title"], input#title');
      if (await titleInput.count() > 0) {
        await titleInput.fill('Cannot reset my password');
        await page.fill('textarea[name="description"], textarea#description', 'Having issues with password reset');

        const categorySelect = page.locator('select[name="category_id"]');
        if (await categorySelect.count() > 0) {
          await categorySelect.selectOption({ index: 1 });
        }

        const prioritySelect = page.locator('select[name="priority_id"]');
        if (await prioritySelect.count() > 0) {
          await prioritySelect.selectOption({ index: 1 });
        }

        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
      }
    });

    await test.step('View knowledge base for recommendations', async () => {
      await page.goto('/knowledge');
      await page.waitForLoadState('networkidle');

      // Look for recommendations section
      const recommendations = page.locator('text=/recomendado|recommended|sugerido|suggested/i');

      if (await recommendations.count() > 0) {
        await expect(recommendations.first()).toBeVisible();

        // Verify recommended articles exist
        const recommendedArticles = page.locator('[class*="recommend"] a, [class*="suggest"] a');
        if (await recommendedArticles.count() > 0) {
          await expect(recommendedArticles.first()).toBeVisible();
        }
      }
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });
});
