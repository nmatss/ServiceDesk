/**
 * Hybrid Search System
 *
 * Combines semantic (vector) search with traditional keyword search
 * Provides relevance scoring, faceted filtering, and auto-complete
 */

import { VectorDatabase, SearchResult } from './vector-database';
import logger from '../monitoring/structured-logger';
import { executeQuery } from '../db/adapter';

export interface SearchFilters {
  query?: string;
  categories?: number[];
  priorities?: number[];
  statuses?: number[];
  assignedTo?: number[];
  users?: number[];
  dateFrom?: string;
  dateTo?: string;
  slaStatus?: 'compliant' | 'warning' | 'breach';
  tags?: string[];
  hasAttachments?: boolean;
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'status' | 'title';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface HybridSearchOptions {
  query: string;
  entityTypes?: ('ticket' | 'kb_article' | 'comment')[];
  semanticWeight?: number; // 0-1, how much to weight semantic results
  keywordWeight?: number; // 0-1, how much to weight keyword results
  maxResults?: number;
  threshold?: number;
  filters?: SearchFilters;
  includeFacets?: boolean;
  useCache?: boolean;
}

export interface HybridSearchResult {
  id: number;
  type: 'ticket' | 'kb_article' | 'comment';
  title: string;
  content: string;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  metadata?: any;
  highlights?: string[];
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
    selected?: boolean;
  }>;
}

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  total: number;
  processingTimeMs: number;
  facets?: SearchFacet[];
  suggestions?: string[];
  cacheHit?: boolean;
}

export interface AutoCompleteOptions {
  query: string;
  limit?: number;
  entityTypes?: string[];
  includeHistory?: boolean;
}

export interface AutoCompleteResult {
  suggestions: string[];
  entities: Array<{
    id: number;
    type: string;
    title: string;
    relevance: number;
  }>;
}

/**
 * Hybrid Search Engine
 */
export class HybridSearchEngine {
  private vectorDb: VectorDatabase;

  constructor(vectorDb: VectorDatabase) {
    this.vectorDb = vectorDb;
  }

  /**
   * Perform hybrid search combining semantic and keyword approaches
   */
  async search(options: HybridSearchOptions): Promise<HybridSearchResponse> {
    const startTime = Date.now();
    const {
      query,
      entityTypes = ['ticket', 'kb_article'],
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      maxResults = 20,
      threshold = 0.6,
      filters = {},
      includeFacets = true,
      useCache = true
    } = options;

    try {
      // Validate weights
      const totalWeight = semanticWeight + keywordWeight;
      const normalizedSemanticWeight = semanticWeight / totalWeight;
      const normalizedKeywordWeight = keywordWeight / totalWeight;

      // Parallel execution of semantic and keyword searches
      const [semanticResults, keywordResults] = await Promise.all([
        this.performSemanticSearch(query, entityTypes, maxResults, threshold, useCache),
        this.performKeywordSearch(query, entityTypes, maxResults, filters)
      ]);

      // Merge and score results
      const mergedResults = this.mergeResults(
        semanticResults,
        keywordResults,
        normalizedSemanticWeight,
        normalizedKeywordWeight
      );

      // Sort by combined score and limit
      const sortedResults = mergedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      // Generate facets if requested
      let facets: SearchFacet[] | undefined;
      if (includeFacets && sortedResults.length > 0) {
        facets = await this.generateFacets(sortedResults, filters);
      }

      // Generate suggestions
      const suggestions = await this.generateSuggestions(query);

      const response: HybridSearchResponse = {
        results: sortedResults,
        total: sortedResults.length,
        processingTimeMs: Date.now() - startTime,
        facets,
        suggestions,
        cacheHit: false // TODO: implement search-level caching
      };

      logger.info('Hybrid search completed', {
        query,
        resultsCount: sortedResults.length,
        processingTimeMs: response.processingTimeMs
      });

      return response;

    } catch (error) {
      logger.error('Error in hybrid search', error);
      return {
        results: [],
        total: 0,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Perform semantic search using vector database
   */
  private async performSemanticSearch(
    query: string,
    entityTypes: string[],
    maxResults: number,
    threshold: number,
    useCache: boolean
  ): Promise<SearchResult[]> {
    try {
      const results = await this.vectorDb.searchSimilar(query, {
        entityTypes,
        maxResults: maxResults * 2, // Get more results for merging
        threshold,
        includeMetadata: true,
        useCache
      });

      return results;

    } catch (error) {
      logger.error('Error in semantic search', error);
      return [];
    }
  }

  /**
   * Perform traditional keyword search
   */
  private async performKeywordSearch(
    query: string,
    entityTypes: string[],
    maxResults: number,
    filters: SearchFilters
  ): Promise<Array<{ entityType: string; entityId: number; score: number; content?: string; metadata?: any }>> {
    const results: Array<{ entityType: string; entityId: number; score: number; content?: string; metadata?: any }> = [];

    try {
      const searchTerm = `%${query.trim()}%`;

      // Search tickets
      if (entityTypes.includes('ticket')) {
        const whereConditions: string[] = [
          `(LOWER(t.title) LIKE LOWER(?) OR LOWER(COALESCE(t.description, '')) LIKE LOWER(?))`
        ];
        const params: Array<string | number> = [searchTerm, searchTerm];

        if (filters.categories?.length) {
          whereConditions.push(`t.category_id IN (${filters.categories.map(() => '?').join(',')})`);
          params.push(...filters.categories);
        }
        if (filters.priorities?.length) {
          whereConditions.push(`t.priority_id IN (${filters.priorities.map(() => '?').join(',')})`);
          params.push(...filters.priorities);
        }
        if (filters.statuses?.length) {
          whereConditions.push(`t.status_id IN (${filters.statuses.map(() => '?').join(',')})`);
          params.push(...filters.statuses);
        }
        if (filters.assignedTo?.length) {
          whereConditions.push(`t.assigned_to IN (${filters.assignedTo.map(() => '?').join(',')})`);
          params.push(...filters.assignedTo);
        }
        if (filters.users?.length) {
          whereConditions.push(`t.user_id IN (${filters.users.map(() => '?').join(',')})`);
          params.push(...filters.users);
        }
        if (filters.dateFrom) {
          whereConditions.push(`t.created_at >= ?`);
          params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
          whereConditions.push(`t.created_at <= ?`);
          params.push(filters.dateTo);
        }

        const ticketResults = await executeQuery<{
          id: number;
          title: string;
          description: string | null;
          category_name?: string;
          priority_name?: string;
          status_name?: string;
        }>(`
          SELECT
            t.id,
            t.title,
            t.description,
            c.name AS category_name,
            p.name AS priority_name,
            s.name AS status_name
          FROM tickets t
          LEFT JOIN categories c ON c.id = t.category_id
          LEFT JOIN priorities p ON p.id = t.priority_id
          LEFT JOIN statuses s ON s.id = t.status_id
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY t.created_at DESC
          LIMIT ?
        `, [...params, maxResults]);

        ticketResults.forEach((ticket, index) => {
          // Calculate keyword score based on position and relevance
          const positionScore = 1 - (index / maxResults);
          const relevanceScore = this.calculateKeywordRelevance(query, `${ticket.title} ${ticket.description || ''}`);

          results.push({
            entityType: 'ticket',
            entityId: ticket.id,
            score: (positionScore + relevanceScore) / 2,
            content: ticket.title,
            metadata: {
              description: ticket.description?.substring(0, 200),
              category: ticket.category_name,
              priority: ticket.priority_name,
              status: ticket.status_name
            }
          });
        });
      }

      // Search knowledge base
      if (entityTypes.includes('kb_article')) {
        const kbResults = await executeQuery<{
          id: number;
          title: string;
          summary: string | null;
          content: string | null;
          category_name?: string;
          view_count?: number;
          helpful_count?: number;
        }>(`
          SELECT
            ka.id,
            ka.title,
            ka.summary,
            ka.content,
            c.name AS category_name,
            ka.view_count,
            ka.helpful_count
          FROM kb_articles ka
          LEFT JOIN categories c ON c.id = ka.category_id
          WHERE ka.status = 'published'
            AND (
              LOWER(ka.title) LIKE LOWER(?)
              OR LOWER(COALESCE(ka.summary, '')) LIKE LOWER(?)
              OR LOWER(COALESCE(ka.content, '')) LIKE LOWER(?)
            )
          ORDER BY ka.view_count DESC, ka.updated_at DESC
          LIMIT ?
        `, [searchTerm, searchTerm, searchTerm, maxResults]);

        kbResults.forEach((article, index) => {
          const positionScore = 1 - (index / maxResults);
          const relevanceScore = this.calculateKeywordRelevance(
            query,
            `${article.title} ${article.summary || ''} ${article.content || ''}`
          );

          results.push({
            entityType: 'kb_article',
            entityId: article.id,
            score: (positionScore + relevanceScore) / 2,
            content: article.title,
            metadata: {
              summary: article.summary,
              category: article.category_name,
              viewCount: article.view_count,
              helpfulCount: article.helpful_count
            }
          });
        });
      }

    } catch (error) {
      logger.error('Error in keyword search', error);
    }

    return results;
  }

  /**
   * Calculate keyword relevance score
   */
  private calculateKeywordRelevance(query: string, text: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const textLower = text.toLowerCase();

    if (queryTerms.length === 0) return 0;

    let matchCount = 0;
    let exactMatchBonus = 0;

    // Check for exact phrase match
    if (textLower.includes(query.toLowerCase())) {
      exactMatchBonus = 0.3;
    }

    // Count term matches
    queryTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    });

    const termCoverage = matchCount / queryTerms.length;
    return Math.min(1, termCoverage + exactMatchBonus);
  }

  /**
   * Merge semantic and keyword results with weighted scoring
   */
  private mergeResults(
    semanticResults: SearchResult[],
    keywordResults: Array<{ entityType: string; entityId: number; score: number; content?: string; metadata?: any }>,
    semanticWeight: number,
    keywordWeight: number
  ): HybridSearchResult[] {
    const resultMap = new Map<string, HybridSearchResult>();

    // Add semantic results
    semanticResults.forEach(result => {
      const key = `${result.entityType}_${result.entityId}`;
      resultMap.set(key, {
        id: result.entityId,
        type: result.entityType as 'ticket' | 'kb_article' | 'comment',
        title: result.content || '',
        content: (result.metadata?.description || result.metadata?.summary || '') as string,
        score: result.similarityScore * semanticWeight,
        semanticScore: result.similarityScore,
        keywordScore: 0,
        metadata: result.metadata
      });
    });

    // Merge keyword results
    keywordResults.forEach(result => {
      const key = `${result.entityType}_${result.entityId}`;
      const existing = resultMap.get(key);

      if (existing) {
        // Combine scores
        existing.keywordScore = result.score;
        existing.score += result.score * keywordWeight;
      } else {
        // Add new result from keyword search
        resultMap.set(key, {
          id: result.entityId,
          type: result.entityType as 'ticket' | 'kb_article' | 'comment',
          title: result.content || '',
          content: result.metadata?.description || result.metadata?.summary || '',
          score: result.score * keywordWeight,
          semanticScore: 0,
          keywordScore: result.score,
          metadata: result.metadata
        });
      }
    });

    return Array.from(resultMap.values());
  }

  /**
   * Generate facets for filtering
   */
  private async generateFacets(
    results: HybridSearchResult[],
    _currentFilters: SearchFilters
  ): Promise<SearchFacet[]> {
    const facets: SearchFacet[] = [];

    try {
      // Type facet
      const typeCounts = results.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      facets.push({
        field: 'type',
        values: Object.entries(typeCounts).map(([value, count]) => ({
          value,
          count,
          selected: false
        }))
      });

      // Category facet (for tickets and KB articles)
      const categoryMap = new Map<string, number>();
      results.forEach(r => {
        if (r.metadata?.category) {
          const current = categoryMap.get(r.metadata.category) || 0;
          categoryMap.set(r.metadata.category, current + 1);
        }
      });

      if (categoryMap.size > 0) {
        facets.push({
          field: 'category',
          values: Array.from(categoryMap.entries())
            .map(([value, count]) => ({ value, count, selected: false }))
            .sort((a, b) => b.count - a.count)
        });
      }

      // Priority facet (for tickets)
      const priorityMap = new Map<string, number>();
      results.forEach(r => {
        if (r.metadata?.priority) {
          const current = priorityMap.get(r.metadata.priority) || 0;
          priorityMap.set(r.metadata.priority, current + 1);
        }
      });

      if (priorityMap.size > 0) {
        facets.push({
          field: 'priority',
          values: Array.from(priorityMap.entries())
            .map(([value, count]) => ({ value, count, selected: false }))
            .sort((a, b) => b.count - a.count)
        });
      }

    } catch (error) {
      logger.error('Error generating facets', error);
    }

    return facets;
  }

  /**
   * Generate search suggestions
   */
  private async generateSuggestions(query: string): Promise<string[]> {
    try {
      // Get common search terms from database
      const suggestions = await executeQuery<{ query: string }>(`
        SELECT query, COUNT(*) AS usage_count
        FROM search_history
        WHERE LOWER(query) LIKE LOWER(?)
        GROUP BY query
        ORDER BY usage_count DESC
        LIMIT 5
      `, [`%${query}%`]);

      return suggestions.map((s) => s.query);

    } catch (error) {
      logger.error('Error generating suggestions', error);
      return [];
    }
  }

  /**
   * Auto-complete search
   */
  async autoComplete(options: AutoCompleteOptions): Promise<AutoCompleteResult> {
    const {
      query,
      limit = 5,
      entityTypes = ['ticket', 'kb_article'],
      includeHistory = true
    } = options;

    const suggestions: string[] = [];
    const entities: Array<{ id: number; type: string; title: string; relevance: number }> = [];

    try {
      // Get suggestions from search history
      if (includeHistory) {
        const historySuggestions = await this.generateSuggestions(query);
        suggestions.push(...historySuggestions);
      }

      // Get entity matches
      if (entityTypes.includes('ticket')) {
        const tickets = await executeQuery<{ id: number; title: string }>(`
          SELECT id, title
          FROM tickets
          WHERE LOWER(title) LIKE LOWER(?)
          ORDER BY created_at DESC
          LIMIT ?
        `, [`%${query}%`, limit]);

        tickets.forEach((t) => {
          entities.push({
            id: t.id,
            type: 'ticket',
            title: t.title,
            relevance: this.calculateKeywordRelevance(query, t.title)
          });
        });
      }

      if (entityTypes.includes('kb_article')) {
        const articles = await executeQuery<{ id: number; title: string }>(`
          SELECT id, title
          FROM kb_articles
          WHERE status = 'published' AND LOWER(title) LIKE LOWER(?)
          ORDER BY view_count DESC
          LIMIT ?
        `, [`%${query}%`, limit]);

        articles.forEach((a) => {
          entities.push({
            id: a.id,
            type: 'kb_article',
            title: a.title,
            relevance: this.calculateKeywordRelevance(query, a.title)
          });
        });
      }

      // Sort entities by relevance
      entities.sort((a, b) => b.relevance - a.relevance);

    } catch (error) {
      logger.error('Error in auto-complete', error);
    }

    return {
      suggestions: suggestions.slice(0, limit),
      entities: entities.slice(0, limit)
    };
  }
}

export default HybridSearchEngine;
