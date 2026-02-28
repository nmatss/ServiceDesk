/**
 * Knowledge Base Search API
 * Provides semantic search, hybrid search, faceted filtering,
 * auto-complete, and analytics tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import * as semanticSearchModule from '@/lib/knowledge/semantic-search'
import Fuse from 'fuse.js'
import type { KBArticle } from '@/lib/types/database'
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne, executeRun, getDbType } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

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
type SearchMode = 'semantic' | 'keyword' | 'hybrid'
const MAX_SEARCH_LIMIT = 100

function buildKeywordResults(articles: KBArticle[], query: string, resultLimit: number) {
  const fuse = new Fuse(articles, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'summary', weight: 0.5 },
      { name: 'search_keywords', weight: 0.6 },
      { name: 'content', weight: 0.3 }
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2
  })

  const fuseResults = fuse.search(query, { limit: resultLimit })
  const mapped = fuseResults.map((result: any) => {
    const article = result.item
    const score = result.score || 0
    const popularityScore = (article.view_count * 0.1) + (article.helpful_votes * 0.5)
    const finalScore = (1 - score) + (popularityScore * 0.01)

    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      category: {
        name: (article as any).category_name,
        slug: (article as any).category_slug,
        color: (article as any).category_color
      },
      score: finalScore,
      matchType: 'keyword',
      matches: result.matches?.map((match: any) => ({
        key: match.key,
        value: match.value,
        indices: match.indices
      }))
    }
  })

  mapped.sort((a, b) => b.score - a.score)
  return mapped
}

function mergeSearchResults(primary: any[], secondary: any[]) {
  const resultMap = new Map<number | string, any>()

  for (const item of primary) {
    resultMap.set(item.id, item)
  }

  for (const item of secondary) {
    const existing = resultMap.get(item.id)
    if (!existing) {
      resultMap.set(item.id, item)
      continue
    }

    if (typeof item.score === 'number' && (typeof existing.score !== 'number' || item.score > existing.score)) {
      resultMap.set(item.id, { ...existing, ...item })
      continue
    }

    resultMap.set(item.id, {
      ...existing,
      highlights: existing.highlights || item.highlights,
      matches: existing.matches || item.matches,
    })
  }

  return Array.from(resultMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0))
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.KNOWLEDGE_SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const tenantId = guard.auth.organizationId;

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const category = searchParams.get('category')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const minHelpfulVotes = searchParams.get('minHelpfulVotes')
    const status = searchParams.get('status') || 'published'
    const requestedMode = searchParams.get('mode')
    const mode: SearchMode = requestedMode === 'semantic' || requestedMode === 'keyword' || requestedMode === 'hybrid'
      ? requestedMode
      : 'hybrid'
    const limit = Math.min(MAX_SEARCH_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const resultLimit = limit + offset
    const userId = searchParams.get('userId')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        suggestions: []
      })
    }
    // Registrar busca para analytics (best effort).
    try {
      await executeRun(`
        INSERT INTO analytics_daily_metrics (date, kb_searches_performed)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT(date) DO UPDATE SET
          kb_searches_performed = kb_searches_performed + 1
      `)
    } catch (error) {
      logger.warn('Failed to track knowledge search metric', error)
    }

    let whereClause = `WHERE a.status = ? AND (a.tenant_id = ? OR a.tenant_id IS NULL)`
    const params: any[] = [status, tenantId]

    if (category) {
      whereClause += ' AND c.slug = ?'
      params.push(category)
    }

    // Buscar artigos para indexação
    const dbType = getDbType();
    const tagsAggregate = dbType === 'postgresql'
      ? "COALESCE(string_agg(DISTINCT t.name, ','), '') as tags"
      : "GROUP_CONCAT(DISTINCT t.name) as tags";

    const articleRows = await executeQuery<any>(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.content,
        a.search_keywords,
        a.view_count,
        a.helpful_votes,
        a.not_helpful_votes,
        a.category_id,
        a.author_id,
        a.created_at,
        a.updated_at,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        ${tagsAggregate}
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN kb_article_tags at ON a.id = at.article_id
      LEFT JOIN kb_tags t ON at.tag_id = t.id
      ${whereClause}
      GROUP BY a.id
    `, params)

    // Convert to KBArticle format with tags array
    const articles: KBArticle[] = articleRows.map((row: any) => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
      status: row.status || 'published',
      visibility: row.visibility || 'public',
    }))

    // Build filters for semantic search
    const filters: any = {}
    if (category) {
      const categoryRow = await executeQueryOne<{ id: number }>(
        'SELECT id FROM kb_categories WHERE slug = ? AND (tenant_id = ? OR tenant_id IS NULL)',
        [category, tenantId]
      )
      if (categoryRow) {
        filters.categories = [categoryRow.id]
      }
    }
    if (tags && tags.length > 0) {
      filters.tags = tags
    }
    if (minHelpfulVotes) {
      filters.minHelpfulVotes = parseInt(minHelpfulVotes)
    }
    if (status) {
      filters.status = status
    }

    let rankedResults: any[] = []

    // Use semantic/hybrid search if mode is not 'keyword'
    if ((mode === 'semantic' || mode === 'hybrid') && typeof semanticSearchEngine?.hybridSearch === 'function') {
      try {
        const searchResults = await semanticSearchEngine.hybridSearch(query.trim(), articles as any, {
          limit: resultLimit,
          hybridMode: mode as any,
          filters,
          boostRecent: true,
        })

        rankedResults = searchResults.map((result: any) => ({
          id: result.article.id,
          title: result.article.title,
          slug: result.article.slug,
          summary: result.article.summary,
          category: {
            name: (result.article as any).category_name,
            slug: (result.article as any).category_slug,
            color: (result.article as any).category_color
          },
          score: result.score,
          matchType: result.matchType,
          highlights: result.highlights,
        }))
      } catch (error) {
        logger.error('Semantic search error, falling back to keyword', error)
        // Fallback to keyword search
      }
    }

    // Keyword results are used directly in keyword mode, merged in hybrid mode, and
    // used as fallback in semantic mode to preserve recall.
    if (mode === 'keyword' || mode === 'hybrid' || rankedResults.length === 0) {
      const keywordResults = buildKeywordResults(articles, query.trim(), resultLimit)
      if (mode === 'keyword') {
        rankedResults = keywordResults
      } else if (mode === 'hybrid') {
        rankedResults = mergeSearchResults(rankedResults, keywordResults)
      } else if (rankedResults.length === 0) {
        rankedResults = keywordResults
      }
    }

    if (typeof semanticSearchEngine?.trackSearch === 'function') {
      semanticSearchEngine.trackSearch({
        query: query.trim(),
        resultsCount: rankedResults.length,
        userId: userId || undefined,
        timestamp: new Date(),
        filters,
      })
    }

    const pagedResults = rankedResults.slice(offset, offset + limit)

    // Get facets for filtering
    const facets: { categories: Map<string, number>; tags: Map<string, number> } = typeof semanticSearchEngine?.getFacets === 'function'
      ? semanticSearchEngine.getFacets(articles as any)
      : (() => {
        const categories = new Map<string, number>()
        const tags = new Map<string, number>()

        for (const article of articles as any[]) {
          const categoryId = String(article.category_id ?? '')
          if (categoryId) {
            categories.set(categoryId, (categories.get(categoryId) || 0) + 1)
          }

          const articleTags = Array.isArray(article.tags) ? article.tags : []
          for (const tag of articleTags) {
            tags.set(tag, (tags.get(tag) || 0) + 1)
          }
        }

        return { categories, tags }
      })()

    // Buscar sugestões de categorias relacionadas
    const categoryQuery = query.toLowerCase()
    let categorySuggestions: Array<{ name: string; slug: string; icon: string | null; color: string | null }> = []
    try {
      categorySuggestions = await executeQuery(`
        SELECT name, slug, icon, color
        FROM kb_categories
        WHERE LOWER(name) LIKE ? AND is_active = 1
        AND (tenant_id = ? OR tenant_id IS NULL)
        LIMIT 3
      `, [`%${categoryQuery}%`, tenantId])
    } catch {
      const fallbackCategorySuggestions = await executeQuery<{ name: string; slug: string; color: string | null }>(`
        SELECT name, slug, color
        FROM kb_categories
        WHERE LOWER(name) LIKE ? AND is_active = 1
        AND (tenant_id = ? OR tenant_id IS NULL)
        LIMIT 3
      `, [`%${categoryQuery}%`, tenantId])

      categorySuggestions = fallbackCategorySuggestions.map((category: any) => ({
        ...category,
        icon: null,
      }))
    }

    // Buscar termos de busca populares/sugeridos
    const popularTerms = await executeQuery<{ search_keywords: string | null }>(`
      SELECT DISTINCT search_keywords
      FROM kb_articles
      WHERE search_keywords LIKE ? AND status = 'published'
      AND (tenant_id = ? OR tenant_id IS NULL)
      LIMIT 5
    `, [`%${query}%`, tenantId])

    const suggestions = popularTerms
      .map((term: any) => term.search_keywords)
      .filter((keywords: any) => keywords)
      .flatMap(keywords => keywords.split(','))
      .map((term: any) => term.trim())
      .filter((term: any) => term.toLowerCase().includes(query.toLowerCase()) && term.toLowerCase() !== query.toLowerCase())
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      query,
      mode,
      results: pagedResults,
      categorySuggestions,
      suggestions: [...new Set(suggestions)],
      facets: {
        categories: Array.from(facets.categories.entries()).map(([id, count]: [string, number]) => ({ id, count })),
        tags: Array.from(facets.tags.entries()).map(([tag, count]: [string, number]) => ({ tag, count })),
      },
      pagination: {
        limit,
        offset,
        total: rankedResults.length,
      },
      total: rankedResults.length
    })

  } catch (error) {
    logger.error('Error searching knowledge base', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/search
 * Track search result clicks for analytics
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.KNOWLEDGE_SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const tenantId = guard.auth.organizationId;

    const body = await request.json()
    const { query, articleId, position, userId } = body

    if (!query || !articleId) {
      return NextResponse.json(
        { error: 'Query and articleId are required' },
        { status: 400 }
      )
    }

    // Track the click in analytics
    if (typeof semanticSearchEngine?.trackSearch === 'function') {
      semanticSearchEngine.trackSearch({
        query,
        resultsCount: 0,
        clickedArticleId: articleId,
        clickPosition: position,
        userId: guard.auth.userId || userId,
        timestamp: new Date(),
      })
    }

    // Save to database for persistent analytics (best effort)
    try {
      await executeRun(`
        INSERT INTO analytics_daily_metrics (
          date,
          kb_article_views
        ) VALUES (CURRENT_DATE, 1)
        ON CONFLICT(date) DO UPDATE SET
          kb_article_views = kb_article_views + 1
      `)
    } catch (error) {
      logger.warn('Failed to track article view metric', error)
    }

    // Update article view count
    await executeRun(`
      UPDATE kb_articles
      SET view_count = view_count + 1
      WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)
    `, [articleId, tenantId])

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Click tracking error', error)
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    )
  }
}
