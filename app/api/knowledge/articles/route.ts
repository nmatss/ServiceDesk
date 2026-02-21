import { NextRequest, NextResponse } from 'next/server'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import slugify from 'slugify'
import { logger } from '@/lib/monitoring/logger'
import { jsonWithCache } from '@/lib/api/cache-headers'
import { cacheInvalidation } from '@/lib/api/cache'
import { sanitizeRequestBody } from '@/lib/api/sanitize-middleware'
import { executeQuery, executeQueryOne, executeTransaction, type DatabaseAdapter } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

async function awaitMaybe<T>(value: T | Promise<T>): Promise<T> {
  return value instanceof Promise ? await value : value;
}

async function txRun(tx: DatabaseAdapter, sql: string, params: any[]): Promise<void> {
  await awaitMaybe(tx.prepare(sql).run(...params));
}

async function txGet<T = any>(tx: DatabaseAdapter, sql: string, params: any[]): Promise<T | undefined> {
  return await awaitMaybe(tx.prepare(sql).get(...params)) as T | undefined;
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Resolve tenant from trusted context.
    const tenantContext = getTenantContextFromRequest(request)
    const tenantId = tenantContext?.id ?? (process.env.NODE_ENV === 'test' ? 1 : null)
    // Production traffic must always include tenant resolution.
    if (!tenantId) {
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
    const articles = await executeQuery<Record<string, unknown>>(`
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
    `, [...params, limit, offset])

    // Contar total de artigos
    const totalCount = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      ${whereClause}
    `, params)

    // Buscar tags para cada artigo
    for (const article of (articles as Array<Record<string, unknown>>)) {
      const tags = await executeQuery(`
        SELECT t.id, t.name, t.slug, t.color
        FROM kb_tags t
        INNER JOIN kb_article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
      `, [article.id as number])

      article.tags = tags
    }

    return jsonWithCache({
      success: true,
      articles,
      pagination: {
        page,
        limit,
        total: totalCount?.count ?? 0,
        totalPages: Math.ceil((totalCount?.count ?? 0) / limit)
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
    const guard = requireTenantUserContext(request, {
      requireRoles: ['admin', 'agent', 'super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

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
      const existing = await executeQueryOne(
        'SELECT id FROM kb_articles WHERE slug = ? AND tenant_id = ?',
        [slug, tenantContext.id]
      )
      if (!existing) break

      slug = `${baseSlug}-${counter}`
      counter++
    }

    const articleId = await executeTransaction(async (tx) => {
      const articleResult = await awaitMaybe(tx.prepare(`
        INSERT INTO kb_articles (
          title, slug, content, summary, category_id, author_id,
          status, visibility, featured, search_keywords, meta_title, meta_description,
          published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title,
        slug,
        content,
        summary ?? null,
        category_id || null,
        userContext.id,
        status,
        visibility,
        featured ? 1 : 0,
        search_keywords ?? null,
        meta_title ?? null,
        meta_description ?? null,
        status === 'published' ? new Date().toISOString() : null
      ))

      let articleId = articleResult.lastInsertRowid
      if (typeof articleId !== 'number') {
        const inserted = await txGet<{ id: number }>(
          tx,
          'SELECT id FROM kb_articles WHERE slug = ?',
          [slug]
        )
        articleId = inserted?.id
      }
      if (typeof articleId !== 'number') {
        throw new Error('Failed to resolve inserted article id')
      }

      // Processar tags
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          // Criar tag se não existir
          const tagSlug = slugify(tagName, { lower: true, strict: true })
          let tag = await txGet<{ id: number }>(tx, 'SELECT id FROM kb_tags WHERE slug = ?', [tagSlug])

          if (!tag) {
            await txRun(tx, 'INSERT INTO kb_tags (name, slug) VALUES (?, ?)', [tagName, tagSlug])
            tag = await txGet<{ id: number }>(tx, 'SELECT id FROM kb_tags WHERE slug = ?', [tagSlug])
            if (!tag) {
              throw new Error('Failed to create tag')
            }
          }

          // Associar tag ao artigo
          await txRun(
            tx,
            'INSERT INTO kb_article_tags (article_id, tag_id) VALUES (?, ?) ON CONFLICT(article_id, tag_id) DO NOTHING',
            [articleId, tag.id]
          )
        }
      }

      return articleId
    })

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
