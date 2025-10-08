/**
 * Semantic Search Engine for Knowledge Base
 * Provides hybrid search (keyword + semantic), vector database integration,
 * auto-complete, faceted search, and analytics tracking
 */

import { openai } from '../ai/openai';
import type { KBArticle, KBCategory } from '../types/database';
import { logger } from '../monitoring/logger';

// Vector database interface (can be swapped for Pinecone, Weaviate, etc.)
interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

interface SearchFilters {
  categories?: string[];
  tags?: string[];
  author?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minHelpfulVotes?: number;
  status?: 'draft' | 'published' | 'archived';
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
  hybridMode?: 'semantic' | 'keyword' | 'hybrid';
  boostRecent?: boolean;
  includeUnpublished?: boolean;
}

interface SearchResult {
  article: KBArticle;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  highlights?: {
    title?: string[];
    content?: string[];
    tags?: string[];
  };
}

interface SearchAnalytics {
  query: string;
  resultsCount: number;
  clickedArticleId?: string;
  clickPosition?: number;
  userId?: string;
  timestamp: Date;
  filters?: SearchFilters;
}

/**
 * Semantic Search Engine
 */
export class SemanticSearchEngine {
  private vectorCache: Map<string, number[]> = new Map();
  private searchHistory: SearchAnalytics[] = [];

  /**
   * Generate embedding vector for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    if (this.vectorCache.has(text)) {
      return this.vectorCache.get(text)!;
    }

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache the embedding
      this.vectorCache.set(text, embedding);

      return embedding;
    } catch (error) {
      logger.error('Error generating embedding', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Keyword-based search using BM25 algorithm
   */
  private keywordSearch(
    query: string,
    articles: KBArticle[],
    limit: number = 10
  ): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results: SearchResult[] = [];

    for (const article of articles) {
      const titleText = article.title.toLowerCase();
      const contentText = article.content.toLowerCase();
      const tagsText = (article.tags || []).join(' ').toLowerCase();
      const combinedText = `${titleText} ${contentText} ${tagsText}`;

      // Calculate BM25 score (simplified version)
      let score = 0;
      const highlights: SearchResult['highlights'] = {
        title: [],
        content: [],
        tags: [],
      };

      for (const term of queryTerms) {
        // Title match (higher weight)
        if (titleText.includes(term)) {
          score += 3;
          highlights.title!.push(this.highlightText(article.title, term));
        }

        // Content match
        if (contentText.includes(term)) {
          score += 1;
          highlights.content!.push(this.highlightText(article.content, term, 150));
        }

        // Tag match
        if (tagsText.includes(term)) {
          score += 2;
          highlights.tags = article.tags?.filter(tag =>
            tag.toLowerCase().includes(term)
          );
        }
      }

      if (score > 0) {
        results.push({
          article,
          score,
          matchType: 'keyword',
          highlights,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Semantic search using vector embeddings
   */
  async semanticSearch(
    query: string,
    articles: KBArticle[],
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      const results: SearchResult[] = [];

      // Calculate similarity for each article
      for (const article of articles) {
        // Combine title, content, and tags for embedding
        const articleText = `${article.title}\n${article.content}\n${(article.tags || []).join(' ')}`;
        const articleEmbedding = await this.generateEmbedding(articleText);

        const similarity = this.cosineSimilarity(queryEmbedding, articleEmbedding);

        if (similarity > 0.5) { // Threshold for relevance
          results.push({
            article,
            score: similarity,
            matchType: 'semantic',
          });
        }
      }

      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error in semantic search', error);
      // Fallback to keyword search
      return this.keywordSearch(query, articles, limit);
    }
  }

  /**
   * Hybrid search combining keyword and semantic approaches
   */
  async hybridSearch(
    query: string,
    articles: KBArticle[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      hybridMode = 'hybrid',
      boostRecent = true,
      filters,
    } = options;

    // Apply filters
    let filteredArticles = this.applyFilters(articles, filters);

    // Perform both searches
    const keywordResults = this.keywordSearch(query, filteredArticles, limit * 2);
    const semanticResults = await this.semanticSearch(query, filteredArticles, limit * 2);

    // Combine results based on mode
    let combinedResults: SearchResult[];

    if (hybridMode === 'keyword') {
      combinedResults = keywordResults;
    } else if (hybridMode === 'semantic') {
      combinedResults = semanticResults;
    } else {
      // Hybrid: combine both with weighted scores
      const resultMap = new Map<string, SearchResult>();

      // Add keyword results with weight
      for (const result of keywordResults) {
        resultMap.set(result.article.id, {
          ...result,
          score: result.score * 0.4, // 40% weight for keyword
          matchType: 'hybrid',
        });
      }

      // Add or merge semantic results with weight
      for (const result of semanticResults) {
        const existing = resultMap.get(result.article.id);
        if (existing) {
          existing.score += result.score * 0.6; // 60% weight for semantic
        } else {
          resultMap.set(result.article.id, {
            ...result,
            score: result.score * 0.6,
            matchType: 'hybrid',
          });
        }
      }

      combinedResults = Array.from(resultMap.values());
    }

    // Apply recency boost
    if (boostRecent) {
      combinedResults = this.applyRecencyBoost(combinedResults);
    }

    // Apply quality boost (based on helpful votes, views)
    combinedResults = this.applyQualityBoost(combinedResults);

    // Sort by final score
    combinedResults.sort((a, b) => b.score - a.score);

    return combinedResults.slice(0, limit);
  }

  /**
   * Apply search filters
   */
  private applyFilters(articles: KBArticle[], filters?: SearchFilters): KBArticle[] {
    if (!filters) return articles;

    return articles.filter(article => {
      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!filters.categories.includes(article.category_id)) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const articleTags = article.tags || [];
        const hasTag = filters.tags.some(tag => articleTags.includes(tag));
        if (!hasTag) return false;
      }

      // Author filter
      if (filters.author && article.author_id !== filters.author) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const articleDate = new Date(article.created_at);
        if (articleDate < filters.dateFrom) return false;
      }

      if (filters.dateTo) {
        const articleDate = new Date(article.created_at);
        if (articleDate > filters.dateTo) return false;
      }

      // Helpful votes filter
      if (filters.minHelpfulVotes && article.helpful_votes < filters.minHelpfulVotes) {
        return false;
      }

      // Status filter
      if (filters.status && article.status !== filters.status) {
        return false;
      }

      return true;
    });
  }

  /**
   * Boost recent articles
   */
  private applyRecencyBoost(results: SearchResult[]): SearchResult[] {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    return results.map(result => {
      const articleAge = now - new Date(result.article.updated_at).getTime();
      const recencyFactor = Math.max(0, 1 - (articleAge / thirtyDaysMs));

      return {
        ...result,
        score: result.score * (1 + recencyFactor * 0.2), // Up to 20% boost
      };
    });
  }

  /**
   * Boost high-quality articles
   */
  private applyQualityBoost(results: SearchResult[]): SearchResult[] {
    return results.map(result => {
      const helpfulVotes = result.article.helpful_votes || 0;
      const views = result.article.view_count || 0;

      // Quality score based on engagement
      const qualityFactor = Math.min(1, (helpfulVotes * 0.1 + views * 0.001));

      return {
        ...result,
        score: result.score * (1 + qualityFactor * 0.3), // Up to 30% boost
      };
    });
  }

  /**
   * Highlight text matches
   */
  private highlightText(text: string, term: string, contextLength: number = 100): string {
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerText.indexOf(lowerTerm);

    if (index === -1) return '';

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + term.length + contextLength / 2);

    let excerpt = text.substring(start, end);
    if (start > 0) excerpt = '...' + excerpt;
    if (end < text.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * Get auto-complete suggestions
   */
  async getAutoCompleteSuggestions(
    partialQuery: string,
    articles: KBArticle[],
    limit: number = 5
  ): Promise<string[]> {
    const suggestions = new Set<string>();

    // Extract common phrases from article titles and tags
    for (const article of articles) {
      const title = article.title.toLowerCase();
      const tags = article.tags || [];

      // Match title phrases
      if (title.includes(partialQuery.toLowerCase())) {
        suggestions.add(article.title);
      }

      // Match tags
      for (const tag of tags) {
        if (tag.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(tag);
        }
      }
    }

    // Also check search history for common queries
    const historicalQueries = this.searchHistory
      .filter(h => h.query.toLowerCase().includes(partialQuery.toLowerCase()))
      .map(h => h.query);

    historicalQueries.forEach(q => suggestions.add(q));

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get faceted search data
   */
  getFacets(articles: KBArticle[]): {
    categories: Map<string, number>;
    tags: Map<string, number>;
    authors: Map<string, number>;
  } {
    const categories = new Map<string, number>();
    const tags = new Map<string, number>();
    const authors = new Map<string, number>();

    for (const article of articles) {
      // Count categories
      const catCount = categories.get(article.category_id) || 0;
      categories.set(article.category_id, catCount + 1);

      // Count tags
      if (article.tags) {
        for (const tag of article.tags) {
          const tagCount = tags.get(tag) || 0;
          tags.set(tag, tagCount + 1);
        }
      }

      // Count authors
      const authorCount = authors.get(article.author_id) || 0;
      authors.set(article.author_id, authorCount + 1);
    }

    return { categories, tags, authors };
  }

  /**
   * Track search analytics
   */
  trackSearch(analytics: SearchAnalytics): void {
    this.searchHistory.push(analytics);

    // Keep only last 1000 searches in memory
    if (this.searchHistory.length > 1000) {
      this.searchHistory.shift();
    }

    // In production, save to database
    // db.query('INSERT INTO search_analytics ...', analytics);
  }

  /**
   * Get search analytics
   */
  getSearchAnalytics(userId?: string, days: number = 30): {
    topQueries: Array<{ query: string; count: number }>;
    topArticles: Array<{ articleId: string; clicks: number }>;
    avgResultsCount: number;
    totalSearches: number;
  } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let filteredHistory = this.searchHistory.filter(
      h => h.timestamp >= cutoffDate
    );

    if (userId) {
      filteredHistory = filteredHistory.filter(h => h.userId === userId);
    }

    // Top queries
    const queryMap = new Map<string, number>();
    filteredHistory.forEach(h => {
      queryMap.set(h.query, (queryMap.get(h.query) || 0) + 1);
    });
    const topQueries = Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top clicked articles
    const articleMap = new Map<string, number>();
    filteredHistory
      .filter(h => h.clickedArticleId)
      .forEach(h => {
        articleMap.set(h.clickedArticleId!, (articleMap.get(h.clickedArticleId!) || 0) + 1);
      });
    const topArticles = Array.from(articleMap.entries())
      .map(([articleId, clicks]) => ({ articleId, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Average results
    const avgResultsCount = filteredHistory.length > 0
      ? filteredHistory.reduce((sum, h) => sum + h.resultsCount, 0) / filteredHistory.length
      : 0;

    return {
      topQueries,
      topArticles,
      avgResultsCount,
      totalSearches: filteredHistory.length,
    };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.vectorCache.clear();
  }
}

// Singleton instance
export const semanticSearchEngine = new SemanticSearchEngine();
