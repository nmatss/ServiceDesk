/**
 * Semantic Search API Route
 * Advanced knowledge base search with hybrid semantic + keyword search
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { HybridSearchEngine } from '@/lib/ai/hybrid-search';
import { logger } from '@/lib/monitoring/logger';

const vectorDb = new VectorDatabase(db as any);
const hybridSearch = new HybridSearchEngine(vectorDb);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const mode = searchParams.get('mode') || 'hybrid'; // semantic, keyword, hybrid
    // const category = searchParams.get('category'); // Reserved for future use
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    // const minHelpfulVotes = parseInt(searchParams.get('minHelpfulVotes') || '0'); // Reserved for future use

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Perform hybrid search
    const searchResults = await hybridSearch.search({
      query: query.trim(),
      entityTypes: ['kb_article'],
      semanticWeight: mode === 'semantic' ? 1.0 : mode === 'keyword' ? 0 : 0.6,
      keywordWeight: mode === 'keyword' ? 1.0 : mode === 'semantic' ? 0 : 0.4,
      maxResults: limit + offset,
      threshold: 0.5,
      filters: {
        tags,
        // Note: category and minHelpfulVotes are not part of SearchFilters
        // They would need to be added to the SearchFilters interface if needed
      } as any,
      includeFacets: true,
      useCache: true
    });

    // Paginate results
    const paginatedResults = searchResults.results.slice(offset, offset + limit);

    // Enrich results with article data
    const enrichedResults = await Promise.all(
      paginatedResults.map(async result => {
        try {
          const article = db.prepare(`
            SELECT
              a.*,
              c.name as category_name,
              u.name as author_name
            FROM kb_articles a
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.id = ? AND a.is_published = 1
          `).get(result.id);

          if (!article) return null;

          // Parse tags if JSON
          let parsedTags = [];
          if (article.tags) {
            try {
              parsedTags = typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags;
            } catch {
              parsedTags = [];
            }
          }

          return {
            ...article,
            tags: parsedTags,
            score: result.score,
            semanticScore: result.semanticScore,
            keywordScore: result.keywordScore,
            highlights: extractHighlights(article.content, query, 2)
          };
        } catch (error) {
          logger.error('Error enriching search result', error);
          return null;
        }
      })
    );

    const validResults = enrichedResults.filter(r => r !== null);

    // Track search analytics
    try {
      db.prepare(`
        INSERT INTO search_history (query, results_count, search_mode, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(query, validResults.length, mode);
    } catch (error) {
      logger.warn('Failed to track search analytics', error);
    }

    return NextResponse.json({
      results: validResults,
      total: validResults.length,
      query,
      mode,
      facets: searchResults.facets,
      suggestions: searchResults.suggestions,
      processingTimeMs: searchResults.processingTimeMs
    });
  } catch (error) {
    logger.error('Error in semantic search API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Track search click (for analytics)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, articleId, position, userId } = body;

    if (!query || !articleId) {
      return NextResponse.json(
        { error: 'Query and articleId are required' },
        { status: 400 }
      );
    }

    // Track click in analytics
    db.prepare(`
      INSERT INTO search_analytics (
        query, article_id, position, user_id, created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(query, articleId, position || 0, userId || null);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error tracking search click', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract highlights from content
 */
function extractHighlights(content: string, query: string, maxHighlights: number): string[] {
  const highlights: string[] = [];
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  if (queryTerms.length === 0) return highlights;

  // Split content into sentences
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

  // Score sentences by query term matches
  const scoredSentences = sentences.map(sentence => {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;

    queryTerms.forEach(term => {
      const matches = (lowerSentence.match(new RegExp(term, 'g')) || []).length;
      score += matches;
    });

    return { sentence, score };
  });

  // Get top scoring sentences
  const topSentences = scoredSentences
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxHighlights);

  topSentences.forEach(({ sentence }) => {
    // Truncate long sentences
    const maxLength = 150;
    if (sentence.length > maxLength) {
      // Find a good breaking point
      const truncated = sentence.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      highlights.push(lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated);
    } else {
      highlights.push(sentence);
    }
  });

  return highlights;
}
