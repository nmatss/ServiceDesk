/**
 * Knowledge Base Search Autocomplete API
 * Provides auto-complete suggestions for search queries
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { semanticSearchEngine } from '@/lib/knowledge/semantic-search';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.KNOWLEDGE_SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (query.length < 2) {
      return NextResponse.json({
        suggestions: [],
      });
    }

    // Fetch published articles for suggestions
    const articles = db.prepare(`
      SELECT
        a.id,
        a.title,
        a.summary,
        a.content,
        a.category_id,
        a.author_id,
        a.status,
        a.visibility,
        a.view_count,
        a.helpful_votes,
        a.created_at,
        a.updated_at,
        GROUP_CONCAT(DISTINCT t.name) as tags
      FROM kb_articles a
      LEFT JOIN kb_article_tags at ON a.id = at.article_id
      LEFT JOIN kb_tags t ON at.tag_id = t.id
      WHERE a.status = 'published'
      GROUP BY a.id
      LIMIT 100
    `).all();

    // Convert to proper format
    const kbArticles = articles.map((row: any) => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
    }));

    // Get auto-complete suggestions from semantic search engine
    const suggestions = await semanticSearchEngine.getAutoCompleteSuggestions(
      query,
      kbArticles,
      limit
    );

    // Format suggestions with type information
    const formattedSuggestions = suggestions.map((text: any) => {
      // Determine suggestion type
      let type: 'article' | 'tag' | 'category' | 'query' = 'query';

      // Check if it's an article title
      const matchingArticle = kbArticles.find(
        (a: any) => a.title.toLowerCase() === text.toLowerCase()
      );
      if (matchingArticle) {
        type = 'article';
      } else {
        // Check if it's a tag
        const hasTag = kbArticles.some((a: any) =>
          a.tags?.some((t: string) => t.toLowerCase() === text.toLowerCase())
        );
        if (hasTag) {
          type = 'tag';
        }
      }

      return {
        text,
        type,
      };
    });

    return NextResponse.json({
      suggestions: formattedSuggestions,
    });
  } catch (error) {
    logger.error('Autocomplete error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
