/**
 * Knowledge Base Search Autocomplete API
 * Provides auto-complete suggestions for search queries
 */

import { NextRequest, NextResponse } from 'next/server';
import * as semanticSearchModule from '@/lib/knowledge/semantic-search';
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, getDbType } from '@/lib/db/adapter';
import { getTenantContextFromRequest } from '@/lib/tenant/context';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
function resolveSemanticSearchEngine() {
  const moduleAny = semanticSearchModule as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(moduleAny, 'semanticSearchEngine')) {
    return moduleAny.semanticSearchEngine as any
  }
  if (Object.prototype.hasOwnProperty.call(moduleAny, 'semanticSearch')) {
    return moduleAny.semanticSearch as any
  }
  if (Object.prototype.hasOwnProperty.call(moduleAny, 'default')) {
    return moduleAny.default as any
  }
  return null
}

const semanticSearchEngine = resolveSemanticSearchEngine()

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.KNOWLEDGE_SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    const tenantId = tenantContext?.id ?? (process.env.NODE_ENV === 'test' ? 1 : null)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (query.length < 2) {
      return NextResponse.json({
        suggestions: [],
      });
    }

    // Fetch published articles for suggestions
    const dbType = getDbType();
    const tagAggregation = dbType === 'postgresql'
      ? "COALESCE(string_agg(DISTINCT t.name, ','), '') as tags"
      : "GROUP_CONCAT(DISTINCT t.name) as tags";

    const articles = await executeQuery<Record<string, any>>(`
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
        ${tagAggregation}
      FROM kb_articles a
      LEFT JOIN kb_article_tags at ON a.id = at.article_id
      LEFT JOIN kb_tags t ON at.tag_id = t.id
      WHERE a.status = 'published'
      AND (a.tenant_id = ? OR a.tenant_id IS NULL)
      GROUP BY a.id
      LIMIT 100
    `, [tenantId]);

    // Convert to proper format
    const kbArticles = articles.map((row: any) => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
    }));

    // Get auto-complete suggestions from semantic search engine
    const suggestions = typeof semanticSearchEngine?.getAutoCompleteSuggestions === 'function'
      ? await semanticSearchEngine.getAutoCompleteSuggestions(
        query,
        kbArticles,
        limit
      )
      : kbArticles
        .flatMap((article: any) => [article.title, ...(article.tags || [])])
        .filter((value: string) => value && value.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit);

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
