import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import Fuse from 'fuse.js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '10')

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

    let whereClause = "WHERE a.status = 'published'"
    const params: any[] = []

    if (category) {
      whereClause += ' AND c.slug = ?'
      params.push(category)
    }

    // Buscar artigos para indexação do Fuse.js
    const articles = db.prepare(`
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
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      ${whereClause}
    `).all(...params)

    // Configurar Fuse.js para busca fuzzy
    const fuse = new Fuse(articles, {
      keys: [
        { name: 'title', weight: 0.7 },
        { name: 'summary', weight: 0.5 },
        { name: 'search_keywords', weight: 0.6 },
        { name: 'content', weight: 0.3 }
      ],
      threshold: 0.3, // 0 = perfeito, 1 = qualquer coisa
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2
    })

    // Realizar busca
    const fuseResults = fuse.search(query.trim(), { limit })

    // Processar resultados
    const results = fuseResults.map(result => {
      const article = result.item
      const score = result.score || 0

      // Calcular relevância baseada em score + popularidade
      const popularityScore = (article.view_count * 0.1) + (article.helpful_votes * 0.5)
      const finalScore = (1 - score) + (popularityScore * 0.01)

      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        category: {
          name: article.category_name,
          slug: article.category_slug,
          color: article.category_color
        },
        score: finalScore,
        matches: result.matches?.map(match => ({
          key: match.key,
          value: match.value,
          indices: match.indices
        }))
      }
    })

    // Ordenar por relevância
    results.sort((a, b) => b.score - a.score)

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
      results: results.slice(0, limit),
      categorySuggestions,
      suggestions: [...new Set(suggestions)], // Remove duplicatas
      total: results.length
    })

  } catch (error) {
    console.error('Error searching knowledge base:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}