/**
 * Knowledge Base Search API
 * Provides semantic search, hybrid search, faceted filtering,
 * auto-complete, and analytics tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { semanticSearchEngine } from '@/lib/knowledge/semantic-search'
import Fuse from 'fuse.js'
import type { KBArticle } from '@/lib/types/database'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const category = searchParams.get('category')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const minHelpfulVotes = searchParams.get('minHelpfulVotes')
    const status = searchParams.get('status') || 'published'
    const mode = searchParams.get('mode') || 'hybrid' // 'semantic', 'keyword', 'hybrid'
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const userId = searchParams.get('userId')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        suggestions: []
      })
    }

    const db = getDb()

    // Registrar busca para analytics
    db.prepare(`
      INSERT INTO analytics_daily_metrics (date, kb_searches_performed)
      VALUES (date('now'), 1)
      ON CONFLICT(date) DO UPDATE SET
        kb_searches_performed = kb_searches_performed + 1
    `).run()

    let whereClause = `WHERE a.status = ?`
    const params: any[] = [status]

    if (category) {
      whereClause += ' AND c.slug = ?'
      params.push(category)
    }

    // Buscar artigos para indexação
    const articleRows = db.prepare(`
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
        GROUP_CONCAT(DISTINCT t.name) as tags
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN kb_article_tags at ON a.id = at.article_id
      LEFT JOIN kb_tags t ON at.tag_id = t.id
      ${whereClause}
      GROUP BY a.id
    `).all(...params)

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
      const categoryRow = db.prepare('SELECT id FROM kb_categories WHERE slug = ?').get(category) as any
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

    let results: any[] = []

    // Use semantic/hybrid search if mode is not 'keyword'
    if (mode === 'semantic' || mode === 'hybrid') {
      try {
        const searchResults = await semanticSearchEngine.hybridSearch(query.trim(), articles, {
          limit: limit + offset,
          hybridMode: mode as any,
          filters,
          boostRecent: true,
        })

        results = searchResults.slice(offset, offset + limit).map(result => ({
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

        // Track search analytics
        semanticSearchEngine.trackSearch({
          query: query.trim(),
          resultsCount: results.length,
          userId,
          timestamp: new Date(),
          filters,
        })
      } catch (error) {
        logger.error('Semantic search error, falling back to keyword', error)
        // Fallback to keyword search
      }
    }

    // Fallback to Fuse.js keyword search if semantic fails or mode is 'keyword'
    if (results.length === 0 || mode === 'keyword') {
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

      const fuseResults = fuse.search(query.trim(), { limit: limit + offset })

      results = fuseResults.slice(offset, offset + limit).map(result => {
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
          matches: result.matches?.map(match => ({
            key: match.key,
            value: match.value,
            indices: match.indices
          }))
        }
      })

      results.sort((a, b) => b.score - a.score)
    }

    // Get facets for filtering
    const facets = semanticSearchEngine.getFacets(articles)

    // Buscar sugestões de categorias relacionadas
    const categoryQuery = query.toLowerCase()
    const categorySuggestions = db.prepare(`
      SELECT name, slug, icon, color
      FROM kb_categories
      WHERE LOWER(name) LIKE ? AND is_active = 1
      LIMIT 3
    `).all(`%${categoryQuery}%`)

    // Buscar termos de busca populares/sugeridos
    const popularTerms = db.prepare(`
      SELECT DISTINCT search_keywords
      FROM kb_articles
      WHERE search_keywords LIKE ? AND status = 'published'
      LIMIT 5
    `).all(`%${query}%`)

    const suggestions = popularTerms
      .map(term => term.search_keywords)
      .filter(keywords => keywords)
      .flatMap(keywords => keywords.split(','))
      .map(term => term.trim())
      .filter(term => term.toLowerCase().includes(query.toLowerCase()) && term.toLowerCase() !== query.toLowerCase())
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      query,
      mode,
      results: results,
      categorySuggestions,
      suggestions: [...new Set(suggestions)],
      facets: {
        categories: Array.from(facets.categories.entries()).map(([id, count]) => ({ id, count })),
        tags: Array.from(facets.tags.entries()).map(([tag, count]) => ({ tag, count })),
      },
      pagination: {
        limit,
        offset,
        total: results.length,
      },
      total: results.length
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
  try {
    const body = await request.json()
    const { query, articleId, position, userId } = body

    if (!query || !articleId) {
      return NextResponse.json(
        { error: 'Query and articleId are required' },
        { status: 400 }
      )
    }

    // Track the click in analytics
    semanticSearchEngine.trackSearch({
      query,
      resultsCount: 0,
      clickedArticleId: articleId,
      clickPosition: position,
      userId,
      timestamp: new Date(),
    })

    // Save to database for persistent analytics
    const db = getDb()
    db.prepare(`
      INSERT INTO analytics_daily_metrics (
        date,
        kb_article_views
      ) VALUES (date('now'), 1)
      ON CONFLICT(date) DO UPDATE SET
        kb_article_views = kb_article_views + 1
    `).run()

    // Update article view count
    db.prepare(`
      UPDATE kb_articles
      SET view_count = view_count + 1
      WHERE id = ?
    `).run(articleId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Click tracking error', error)
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    )
  }
}