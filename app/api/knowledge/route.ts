import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category')
    const status = searchParams.get('status') || 'published'
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    let whereClause = 'WHERE k.tenant_id = ?'
    const params = [tenantContext.id]

    // Filter by status (only published articles for non-admin users)
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      whereClause += ' AND k.status = ?'
      params.push('published')
    } else if (status) {
      whereClause += ' AND k.status = ?'
      params.push(status)
    }

    // Search in title and content
    if (search) {
      whereClause += ' AND (k.title LIKE ? OR k.content LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    // Filter by category
    if (category) {
      whereClause += ' AND k.category = ?'
      params.push(category)
    }

    const articles = db.prepare(`
      SELECT
        k.id,
        k.title,
        k.content,
        k.excerpt,
        k.category,
        k.tags,
        k.status,
        k.view_count,
        k.helpful_count,
        k.not_helpful_count,
        k.created_at,
        k.updated_at,
        u.name as author_name
      FROM knowledge_articles k
      LEFT JOIN users u ON k.author_id = u.id AND u.tenant_id = ?
      ${whereClause}
      ORDER BY k.created_at DESC
      LIMIT ? OFFSET ?
    `).all(tenantContext.id, ...params, limit, offset)

    // Count total articles
    const totalQuery = db.prepare(`
      SELECT COUNT(*) as total
      FROM knowledge_articles k
      ${whereClause}
    `)
    const { total } = totalQuery.get(...params) as { total: number }

    // Get categories
    const categories = db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM knowledge_articles
      WHERE tenant_id = ? AND status = 'published'
      GROUP BY category
      ORDER BY category
    `).all(tenantContext.id)

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
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Only admin users can create articles
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const { title, content, excerpt, category, tags, status } = await request.json()

    if (!title || !content) {
      return NextResponse.json({ error: 'Título e conteúdo são obrigatórios' }, { status: 400 })
    }

    // Create article
    const result = db.prepare(`
      INSERT INTO knowledge_articles (title, content, excerpt, category, tags,
                                    status, author_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      content,
      excerpt || null,
      category || 'Geral',
      tags || null,
      status || 'draft',
      userContext.id,
      tenantContext.id
    )

    // Get created article with author info
    const newArticle = db.prepare(`
      SELECT
        k.id,
        k.title,
        k.content,
        k.excerpt,
        k.category,
        k.tags,
        k.status,
        k.view_count,
        k.helpful_count,
        k.not_helpful_count,
        k.created_at,
        k.updated_at,
        u.name as author_name
      FROM knowledge_articles k
      LEFT JOIN users u ON k.author_id = u.id AND u.tenant_id = ?
      WHERE k.id = ?
    `).get(tenantContext.id, result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      article: newArticle
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating knowledge article', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}