import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { id } = await params
    const articleId = parseInt(id)

    let whereClause = 'WHERE k.id = ? AND k.tenant_id = ?'
    const queryParams: (string | number)[] = [articleId, tenantContext.id]

    // Only published articles for non-admin users
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      whereClause += ' AND k.status = ?'
      queryParams.push('published')
    }

    const article = db.prepare(`
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
    `).get(tenantContext.id, ...queryParams)

    if (!article) {
      return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
    }

    // Increment view count
    db.prepare('UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = ?')
      .run(articleId)

    return NextResponse.json({
      success: true,
      article
    })
  } catch (error) {
    logger.error('Error fetching knowledge article', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Only admin users can update articles
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const { id } = await params
    const articleId = parseInt(id)
    const { title, content, excerpt, category, tags, status } = await request.json()

    // Verify article exists and belongs to tenant
    const existingArticle = db.prepare(
      'SELECT id FROM knowledge_articles WHERE id = ? AND tenant_id = ?'
    ).get(articleId, tenantContext.id)

    if (!existingArticle) {
      return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
    }

    // Update article
    db.prepare(`
      UPDATE knowledge_articles
      SET title = ?, content = ?, excerpt = ?, category = ?, tags = ?,
          status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(
      title,
      content,
      excerpt || null,
      category || 'Geral',
      tags || null,
      status || 'draft',
      articleId,
      tenantContext.id
    )

    // Get updated article with author info
    const updatedArticle = db.prepare(`
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
    `).get(tenantContext.id, articleId)

    return NextResponse.json({
      success: true,
      article: updatedArticle
    })
  } catch (error) {
    logger.error('Error updating knowledge article', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Only admin users can delete articles
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const { id } = await params
    const articleId = parseInt(id)

    // Verify article exists and belongs to tenant
    const existingArticle = db.prepare(
      'SELECT id FROM knowledge_articles WHERE id = ? AND tenant_id = ?'
    ).get(articleId, tenantContext.id)

    if (!existingArticle) {
      return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
    }

    // Delete article
    db.prepare('DELETE FROM knowledge_articles WHERE id = ? AND tenant_id = ?')
      .run(articleId, tenantContext.id)

    return NextResponse.json({
      success: true,
      message: 'Artigo excluído com sucesso'
    })
  } catch (error) {
    logger.error('Error deleting knowledge article', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}