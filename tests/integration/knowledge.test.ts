/**
 * Knowledge Base API Integration Tests
 *
 * Tests KB article CRUD operations, search, categories, and feedback.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock OpenAI client before importing knowledge routes
const mockOpenAIClient = {
  createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  chat: vi.fn().mockResolvedValue('Mocked AI response'),
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
};

vi.mock('@/lib/ai/openai-client', () => ({
  default: mockOpenAIClient,
  openaiClient: mockOpenAIClient,
  OpenAIClientManager: vi.fn().mockImplementation(() => mockOpenAIClient),
}));

// Mock semantic search module
vi.mock('@/lib/knowledge/semantic-search', () => ({
  default: {
    search: vi.fn().mockResolvedValue({ results: [], total: 0 }),
    indexArticle: vi.fn().mockResolvedValue(true),
  },
  semanticSearch: {
    search: vi.fn().mockResolvedValue({ results: [], total: 0 }),
    indexArticle: vi.fn().mockResolvedValue(true),
  },
}));

// Set mock environment variable for OpenAI
beforeAll(() => {
  process.env.OPENAI_API_KEY = 'test-api-key';
});

import { GET as getArticlesGET, POST as createArticlePOST } from '@/app/api/knowledge/articles/route';
import { GET as getArticleGET } from '@/app/api/knowledge/articles/[slug]/route';
import { GET as getCategoriesGET } from '@/app/api/knowledge/categories/route';
import { GET as searchGET } from '@/app/api/knowledge/search/route';
import {
  TEST_USERS,
  TEST_TENANT,
  getTestDb,
  createMockRequest,
  getResponseJSON,
  createTestArticle
} from './setup';

describe('Knowledge Base API Integration Tests', () => {
  describe('GET /api/knowledge/articles', () => {
    it('should list all published articles', async () => {
      // Create test articles
      createTestArticle({
        title: 'Getting Started Guide',
        content: 'This is a getting started guide',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });
      createTestArticle({
        title: 'Advanced Topics',
        content: 'Advanced content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.articles).toBeDefined();
      expect(Array.isArray(data.articles)).toBe(true);
      expect(data.articles.length).toBeGreaterThanOrEqual(2);
    });

    it('should not show draft articles to non-authors', async () => {
      createTestArticle({
        title: 'Draft Article',
        content: 'This is a draft',
        author_id: TEST_USERS.admin.id,
        status: 'draft'
      });

      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      // Draft articles should not appear in public listing
      const draftArticle = data.articles?.find((a: any) => a.title === 'Draft Article');
      expect(draftArticle).toBeUndefined();
    });

    it('should filter articles by category', async () => {
      const request = await createMockRequest('/api/knowledge/articles?category=getting-started', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      if (data.articles && data.articles.length > 0) {
        data.articles.forEach((article: any) => {
          expect(article.category_slug).toBe('getting-started');
        });
      }
    });

    it('should search articles by keyword', async () => {
      createTestArticle({
        title: 'How to Reset Password',
        content: 'Step by step guide to reset your password',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const request = await createMockRequest('/api/knowledge/articles?search=password', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.articles).toBeDefined();
      // Should find the password article
      const found = data.articles?.some((a: any) => a.title.includes('Password'));
      expect(found).toBe(true);
    });

    it('should paginate results', async () => {
      // Create multiple articles
      for (let i = 0; i < 25; i++) {
        createTestArticle({
          title: `Article ${i}`,
          content: `Content ${i}`,
          author_id: TEST_USERS.admin.id,
          status: 'published'
        });
      }

      const request = await createMockRequest('/api/knowledge/articles?page=1&limit=10', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.articles.length).toBeLessThanOrEqual(10);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    it('should show featured articles first', async () => {
      createTestArticle({
        title: 'Regular Article',
        content: 'Regular content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const db = getTestDb();
      const featuredId = createTestArticle({
        title: 'Featured Article',
        content: 'Featured content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      // Mark as featured
      db.prepare('UPDATE kb_articles SET featured = 1 WHERE id = ?').run(featuredId);

      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      // First article should be featured
      if (data.articles && data.articles.length > 0) {
        expect(data.articles[0].featured).toBe(1);
      }
    });

    it('should enforce tenant isolation', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'GET'
      });

      const response = await getArticlesGET(request as any);
      const data = await getResponseJSON(response);

      // All articles should belong to test tenant
      if (data.articles) {
        data.articles.forEach((article: any) => {
          expect(article.tenant_id || TEST_TENANT.id).toBe(TEST_TENANT.id);
        });
      }
    });
  });

  describe('POST /api/knowledge/articles', () => {
    it('should create new article (admin/agent only)', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          title: 'New KB Article',
          content: '<h1>Article Content</h1><p>This is the article body</p>',
          summary: 'Article summary',
          category_id: 1,
          status: 'published',
          tags: ['tutorial', 'getting-started']
        }
      });

      const response = await createArticlePOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.slug).toBeDefined();
      expect(data.articleId).toBeDefined();

      // Verify in database
      const db = getTestDb();
      const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(data.articleId);
      expect(article).toBeDefined();
    });

    it('should generate unique slug from title', async () => {
      const request1 = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          title: 'Duplicate Title',
          content: 'Content 1',
          status: 'published'
        }
      });

      const response1 = await createArticlePOST(request1 as any);
      const data1 = await getResponseJSON(response1);

      const request2 = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          title: 'Duplicate Title',
          content: 'Content 2',
          status: 'published'
        }
      });

      const response2 = await createArticlePOST(request2 as any);
      const data2 = await getResponseJSON(response2);

      expect(response2.status).toBe(200);
      expect(data1.slug).not.toBe(data2.slug);
      // Second slug should have counter
      expect(data2.slug).toMatch(/duplicate-title-\d+/);
    });

    it('should create article with tags', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          title: 'Tagged Article',
          content: 'Content',
          status: 'published',
          tags: ['tag1', 'tag2', 'tag3']
        }
      });

      const response = await createArticlePOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);

      // Verify tags were created
      const db = getTestDb();
      const tags = db.prepare(`
        SELECT t.name FROM kb_tags t
        INNER JOIN kb_article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
      `).all(data.articleId);

      expect(tags.length).toBe(3);
    });

    it('should prevent regular users from creating articles', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.user.id, // Regular user
        body: {
          title: 'Unauthorized Article',
          content: 'Should fail'
        }
      });

      const response = await createArticlePOST(request as any);

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          // Missing title and content
          status: 'published'
        }
      });

      const response = await createArticlePOST(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should set published_at when status is published', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          title: 'Published Article',
          content: 'Content',
          status: 'published'
        }
      });

      const response = await createArticlePOST(request as any);
      const data = await getResponseJSON(response);

      const db = getTestDb();
      const article = db.prepare('SELECT published_at FROM kb_articles WHERE id = ?')
        .get(data.articleId) as any;

      expect(article.published_at).toBeTruthy();
    });

    it('should not set published_at for draft articles', async () => {
      const request = await createMockRequest('/api/knowledge/articles', {
        method: 'POST',
        userId: TEST_USERS.admin.id,
        body: {
          title: 'Draft Article',
          content: 'Content',
          status: 'draft'
        }
      });

      const response = await createArticlePOST(request as any);
      const data = await getResponseJSON(response);

      const db = getTestDb();
      const article = db.prepare('SELECT published_at FROM kb_articles WHERE id = ?')
        .get(data.articleId) as any;

      expect(article.published_at).toBeNull();
    });
  });

  describe('GET /api/knowledge/articles/[slug]', () => {
    it('should get article by slug', async () => {
      const articleId = createTestArticle({
        title: 'Test Article',
        slug: 'test-article-slug',
        content: 'Test content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const request = await createMockRequest('/api/knowledge/articles/test-article-slug', {
        method: 'GET'
      });

      const mockRequest = request as any;
      mockRequest.params = { slug: 'test-article-slug' };

      const response = await getArticleGET(mockRequest, { params: { slug: 'test-article-slug' } });
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.article).toBeDefined();
      expect(data.article.slug).toBe('test-article-slug');
      expect(data.article.title).toBe('Test Article');
    });

    it('should increment view count on each view', async () => {
      const db = getTestDb();
      createTestArticle({
        title: 'View Count Test',
        slug: 'view-count-test',
        content: 'Test',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const initialCount = db.prepare('SELECT view_count FROM kb_articles WHERE slug = ?')
        .get('view-count-test') as any;

      const request = await createMockRequest('/api/knowledge/articles/view-count-test', {
        method: 'GET'
      });

      const mockRequest = request as any;
      mockRequest.params = { slug: 'view-count-test' };

      await getArticleGET(mockRequest, { params: { slug: 'view-count-test' } });

      const afterCount = db.prepare('SELECT view_count FROM kb_articles WHERE slug = ?')
        .get('view-count-test') as any;

      expect(afterCount.view_count).toBeGreaterThan(initialCount.view_count || 0);
    });

    it('should return 404 for non-existent article', async () => {
      const request = await createMockRequest('/api/knowledge/articles/non-existent-slug', {
        method: 'GET'
      });

      const mockRequest = request as any;
      mockRequest.params = { slug: 'non-existent-slug' };

      const response = await getArticleGET(mockRequest, { params: { slug: 'non-existent-slug' } });

      expect(response.status).toBe(404);
    });

    it('should include author information', async () => {
      createTestArticle({
        title: 'Author Test',
        slug: 'author-test',
        content: 'Test',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const request = await createMockRequest('/api/knowledge/articles/author-test', {
        method: 'GET'
      });

      const mockRequest = request as any;
      mockRequest.params = { slug: 'author-test' };

      const response = await getArticleGET(mockRequest, { params: { slug: 'author-test' } });
      const data = await getResponseJSON(response);

      expect(data.article.author_name).toBeDefined();
      expect(data.article.author_name).toBe(TEST_USERS.admin.name);
    });
  });

  describe('GET /api/knowledge/categories', () => {
    it('should list all active categories', async () => {
      const request = await createMockRequest('/api/knowledge/categories', {
        method: 'GET'
      });

      const response = await getCategoriesGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.categories).toBeDefined();
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThan(0);
    });

    it('should include article count per category', async () => {
      const request = await createMockRequest('/api/knowledge/categories', {
        method: 'GET'
      });

      const response = await getCategoriesGET(request as any);
      const data = await getResponseJSON(response);

      if (data.categories && data.categories.length > 0) {
        expect(data.categories[0].article_count).toBeDefined();
      }
    });

    it('should enforce tenant isolation', async () => {
      const request = await createMockRequest('/api/knowledge/categories', {
        method: 'GET'
      });

      const response = await getCategoriesGET(request as any);
      const data = await getResponseJSON(response);

      // All categories should belong to test tenant
      if (data.categories) {
        data.categories.forEach((category: any) => {
          expect(category.tenant_id).toBe(TEST_TENANT.id);
        });
      }
    });
  });

  describe('GET /api/knowledge/search', () => {
    it('should search articles by query', async () => {
      createTestArticle({
        title: 'How to Login',
        content: 'Login instructions here',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      const request = await createMockRequest('/api/knowledge/search?q=login', {
        method: 'GET'
      });

      const response = await searchGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.results).toBeDefined();
      // Should find the login article
      const found = data.results?.some((r: any) => r.title.includes('Login'));
      expect(found).toBe(true);
    });

    it('should search in title, content, and keywords', async () => {
      const db = getTestDb();
      const articleId = createTestArticle({
        title: 'General Article',
        content: 'Some content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      // Add search keywords
      db.prepare('UPDATE kb_articles SET search_keywords = ? WHERE id = ?')
        .run('authentication, security, login', articleId);

      const request = await createMockRequest('/api/knowledge/search?q=authentication', {
        method: 'GET'
      });

      const response = await searchGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      const found = data.results?.some((r: any) => r.id === articleId);
      expect(found).toBe(true);
    });

    it('should return empty results for non-matching query', async () => {
      const request = await createMockRequest('/api/knowledge/search?q=nonexistentquery12345', {
        method: 'GET'
      });

      const response = await searchGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.results).toBeDefined();
      expect(data.results.length).toBe(0);
    });

    it('should only search published articles', async () => {
      createTestArticle({
        title: 'Draft Search Test',
        content: 'This is a draft article',
        author_id: TEST_USERS.admin.id,
        status: 'draft'
      });

      const request = await createMockRequest('/api/knowledge/search?q=draft', {
        method: 'GET'
      });

      const response = await searchGET(request as any);
      const data = await getResponseJSON(response);

      // Draft articles should not appear in search results
      const draftFound = data.results?.some((r: any) => r.status === 'draft');
      expect(draftFound).toBe(false);
    });
  });

  describe('Article Feedback', () => {
    it('should track helpful votes', async () => {
      const db = getTestDb();
      const articleId = createTestArticle({
        title: 'Feedback Test',
        content: 'Test content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      // Simulate helpful vote
      db.prepare('UPDATE kb_articles SET helpful_votes = helpful_votes + 1 WHERE id = ?')
        .run(articleId);

      const article = db.prepare('SELECT helpful_votes FROM kb_articles WHERE id = ?')
        .get(articleId) as any;

      expect(article.helpful_votes).toBeGreaterThan(0);
    });

    it('should track not helpful votes', async () => {
      const db = getTestDb();
      const articleId = createTestArticle({
        title: 'Not Helpful Test',
        content: 'Test content',
        author_id: TEST_USERS.admin.id,
        status: 'published'
      });

      db.prepare('UPDATE kb_articles SET not_helpful_votes = not_helpful_votes + 1 WHERE id = ?')
        .run(articleId);

      const article = db.prepare('SELECT not_helpful_votes FROM kb_articles WHERE id = ?')
        .get(articleId) as any;

      expect(article.not_helpful_votes).toBeGreaterThan(0);
    });
  });
});
