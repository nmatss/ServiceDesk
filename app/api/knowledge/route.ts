import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger';
import slugify from 'slugify'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category')
    const status = searchParams.get('status') || 'published'
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    const isPrivileged = ['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)

    let whereClause = 'WHERE (a.tenant_id = ? OR a.tenant_id IS NULL)'
    const params: (string | number)[] = [tenantContext.id]

    // Filter by status (only published articles for non-admin users)
    if (!isPrivileged) {
      whereClause += ' AND a.status = ?'
      params.push('published')
    } else if (status) {
      whereClause += ' AND a.status = ?'
      params.push(status)
    }

    // Search in title and content
    if (search) {
      whereClause += ' AND (a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    // Filter by category (name)
    if (category) {
      whereClause += ' AND c.name = ?'
      params.push(category)
    }

    const articles = await executeQuery(`
      SELECT
        a.id,
        a.title,
        a.content,
        a.summary as excerpt,
        c.name as category,
        a.status,
        a.view_count,
        a.helpful_votes as helpful_count,
        a.not_helpful_votes as not_helpful_count,
        a.created_at,
        a.updated_at,
        u.name as author_name
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    // Add tags to each article (comma-separated)
    for (const article of (articles as Array<Record<string, unknown>>)) {
      const tags = await executeQuery<{ name: string }>(`
        SELECT t.name
        FROM kb_tags t
        INNER JOIN kb_article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
        ORDER BY t.name
      `, [article.id as number])
      article.tags = tags.map(tag => tag.name).join(', ')
    }

    // Count total articles
    const totalResult = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      ${whereClause}
    `, params)
    const total = totalResult?.total ?? 0

    // Get categories
    const categories = await executeQuery(`
      SELECT c.name as category, COUNT(*) as count
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE (a.tenant_id = ? OR a.tenant_id IS NULL)
      ${isPrivileged ? '' : "AND a.status = 'published'"}
      GROUP BY c.name
      ORDER BY c.name
    `, [tenantContext.id])

    return NextResponse.json({
      success: true,
      articles,
      categories,
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total
      }
    })
  } catch (error) {
    logger.error('Error fetching knowledge articles', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    // Only admin users can create articles
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const { title, content, excerpt, category, tags, status } = await request.json()

    if (!title || !content) {
      return NextResponse.json({ error: 'Título e conteúdo são obrigatórios' }, { status: 400 })
    }

    let categoryId: number | null = null
    if (category) {
      const categoryRow = await executeQueryOne<{ id: number }>(
        'SELECT id FROM kb_categories WHERE name = ?',
        [category]
      )
      categoryId = categoryRow?.id ?? null
    }

    const baseSlug = slugify(title, { lower: true, strict: true })
    let slug = baseSlug
    let counter = 1
    while (true) {
      const existing = await executeQueryOne<{ id: number }>(
        'SELECT id FROM kb_articles WHERE slug = ?',
        [slug]
      )
      if (!existing) break
      slug = `${baseSlug}-${counter}`
      counter += 1
    }

    // Create article
    const result = await executeRun(`
      INSERT INTO kb_articles (title, slug, content, summary, category_id, status, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      slug,
      content,
      excerpt || null,
      categoryId,
      status || 'draft',
      userContext.id,
    ])

    let articleId = result.lastInsertRowid
    if (typeof articleId !== 'number') {
      const inserted = await executeQueryOne<{ id: number }>(`
        SELECT id
        FROM kb_articles
        WHERE title = ? AND author_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [title, userContext.id])
      articleId = inserted?.id
    }

    // Handle tags (comma-separated string)
    if (typeof tags === 'string' && tags.trim()) {
      const tagNames = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      for (const tagName of tagNames) {
        const tagSlug = slugify(tagName, { lower: true, strict: true })
        const existingTag = await executeQueryOne<{ id: number }>(
          'SELECT id FROM kb_tags WHERE slug = ?',
          [tagSlug]
        )
        let tagId = existingTag?.id
        if (!tagId) {
          const tagInsert = await executeRun(
            'INSERT INTO kb_tags (name, slug) VALUES (?, ?)',
            [tagName, tagSlug]
          )
          tagId = tagInsert.lastInsertRowid as number
        }
        if (typeof tagId === 'number') {
          await executeRun(
            'INSERT OR IGNORE INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)',
            [articleId, tagId]
          )
        }
      }
    }

    // Get created article with author info
    const newArticle = await executeQueryOne(`
      SELECT
        a.id,
        a.title,
        a.content,
        a.summary as excerpt,
        c.name as category,
        a.status,
        a.view_count,
        a.helpful_votes as helpful_count,
        a.not_helpful_votes as not_helpful_count,
        a.created_at,
        a.updated_at,
        u.name as author_name
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [articleId])

    return NextResponse.json({
      success: true,
      article: newArticle
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating knowledge article', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
