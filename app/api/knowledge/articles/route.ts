import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import slugify from 'slugify'
import { logger } from '@/lib/monitoring/logger'
import { jsonWithCache } from '@/lib/api/cache-headers'
import { cacheInvalidation } from '@/lib/api/cache'
import { sanitizeRequestBody } from '@/lib/api/sanitize-middleware'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Get tenant context if available, otherwise use default
    const tenantContext = getTenantContextFromRequest(request)
    const tenantId = tenantContext?.id || 1; // Default to organization ID 1

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const status = searchParams.get('status') || 'published'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    // Support both single and multi-tenant setups
    let whereClause = 'WHERE (a.tenant_id = ? OR a.tenant_id IS NULL)'
    const params: any[] = [tenantId]

    // Filtro por status
    if (status) {
      whereClause += ' AND a.status = ?'
      params.push(status)
    }

    // Filtro por categoria
    if (category) {
      whereClause += ' AND c.slug = ? AND (c.tenant_id = ? OR c.tenant_id IS NULL)'
      params.push(category, tenantId)
    }

    // Filtro por busca
    if (search) {
      whereClause += ' AND (a.title LIKE ? OR a.search_keywords LIKE ? OR a.content LIKE ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    // Buscar artigos
    const articles = db.prepare(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.status,
        a.visibility,
        a.featured,
        a.view_count,
        a.helpful_votes,
        a.not_helpful_votes,
        a.published_at,
        a.created_at,
        a.updated_at,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        u.name as author_name
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      ${whereClause}
      ORDER BY a.featured DESC, a.published_at DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    // Contar total de artigos
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      ${whereClause}
    `).get(...params) as { count: number }

    // Buscar tags para cada artigo
    for (const article of (articles as Array<Record<string, unknown>>)) {
      const tags = db.prepare(`
        SELECT t.id, t.name, t.slug, t.color
        FROM kb_tags t
        INNER JOIN kb_article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
      `).all(article.id as number)

      article.tags = tags
    }

    return jsonWithCache({
      success: true,
      articles,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit)
      }
    }, 'STATIC') // Cache for 10 minutes

  } catch (error) {
    logger.error('Error fetching articles', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)
    if (!user || (user.role !== 'admin' && user.role !== 'agent')) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Sanitizar entrada do usuário para prevenir XSS
    const sanitized = await sanitizeRequestBody(body, {
      stripFields: ['title', 'meta_title', 'search_keywords'], // Títulos sem HTML
      htmlFields: ['content', 'summary', 'meta_description'], // Conteúdo pode ter HTML
    })

    const {
      title,
      content,
      summary,
      category_id,
      tags,
      status = 'draft',
      visibility = 'public',
      featured = false,
      search_keywords,
      meta_title,
      meta_description
    } = sanitized

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Título e conteúdo são obrigatórios' },
        { status: 400 }
      )
    }
    // Gerar slug único
    const baseSlug = slugify(title, { lower: true, strict: true })
    let slug = baseSlug
    let counter = 1

    while (true) {
      const existing = db.prepare('SELECT id FROM kb_articles WHERE slug = ?').get(slug)
      if (!existing) break

      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Iniciar transação
    const transaction = db.transaction(() => {
      // Criar artigo
      const articleResult = db.prepare(`
        INSERT INTO kb_articles (
          title, slug, content, summary, category_id, author_id,
          status, visibility, featured, search_keywords, meta_title, meta_description,
          published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title,
        slug,
        content,
        summary,
        category_id || null,
        user.id,
        status,
        visibility,
        featured,
        search_keywords,
        meta_title,
        meta_description,
        status === 'published' ? new Date().toISOString() : null
      )

      const articleId = articleResult.lastInsertRowid

      // Processar tags
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          // Criar tag se não existir
          const tagSlug = slugify(tagName, { lower: true, strict: true })
          let tag = db.prepare('SELECT id FROM kb_tags WHERE slug = ?').get(tagSlug) as { id: number } | undefined

          if (!tag) {
            const tagResult = db.prepare('INSERT INTO kb_tags (name, slug) VALUES (?, ?)').run(tagName, tagSlug)
            tag = { id: Number(tagResult.lastInsertRowid) }
          }

          // Associar tag ao artigo
          db.prepare('INSERT OR IGNORE INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)').run(articleId, tag.id)
        }
      }

      return articleId
    })

    const articleId = transaction()

    // Invalidate knowledge cache
    await cacheInvalidation.knowledgeBase()

    return NextResponse.json({
      success: true,
      message: 'Artigo criado com sucesso',
      articleId,
      slug
    })

  } catch (error) {
    logger.error('Error creating article', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}