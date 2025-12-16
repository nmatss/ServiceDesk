import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import slugify from 'slugify'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const status = searchParams.get('status') || 'published'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    // Incluir tenant isolation na base da query
    let whereClause = 'WHERE a.tenant_id = ?'
    const params: any[] = [tenantContext.id]

    // Filtro por status
    if (status) {
      whereClause += ' AND a.status = ?'
      params.push(status)
    }

    // Filtro por categoria
    if (category) {
      whereClause += ' AND c.slug = ? AND c.tenant_id = ?'
      params.push(category, tenantContext.id)
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
      LEFT JOIN kb_categories c ON a.category_id = c.id AND c.tenant_id = a.tenant_id
      LEFT JOIN users u ON a.author_id = u.id AND u.tenant_id = a.tenant_id
      ${whereClause}
      ORDER BY a.featured DESC, a.published_at DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    // Contar total de artigos
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id AND c.tenant_id = a.tenant_id
      ${whereClause}
    `).get(...params) as { count: number }

    // Buscar tags para cada artigo
    for (const article of articles) {
      const tags = db.prepare(`
        SELECT t.id, t.name, t.slug, t.color
        FROM kb_tags t
        INNER JOIN kb_article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
      `).all(article.id)

      article.tags = tags
    }

    return NextResponse.json({
      success: true,
      articles,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit)
      }
    })

  } catch (error) {
    logger.error('Error fetching articles', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    } = await request.json()

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
          let tag = db.prepare('SELECT id FROM kb_tags WHERE slug = ?').get(tagSlug)

          if (!tag) {
            const tagResult = db.prepare('INSERT INTO kb_tags (name, slug) VALUES (?, ?)').run(tagName, tagSlug)
            tag = { id: tagResult.lastInsertRowid }
          }

          // Associar tag ao artigo
          db.prepare('INSERT OR IGNORE INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)').run(articleId, tag.id)
        }
      }

      return articleId
    })

    const articleId = transaction()

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