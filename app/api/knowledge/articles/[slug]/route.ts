import { NextRequest, NextResponse } from 'next/server'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne, executeRun, executeTransaction, type DatabaseAdapter } from '@/lib/db/adapter';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
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

    // Buscar artigo por slug
    const article = await executeQueryOne<{ id: number } & Record<string, any>>(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.content,
        a.content_type,
        a.status,
        a.visibility,
        a.featured,
        a.view_count,
        a.helpful_votes,
        a.not_helpful_votes,
        a.search_keywords,
        a.meta_title,
        a.meta_description,
        a.published_at,
        a.created_at,
        a.updated_at,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color,
        c.icon as category_icon,
        u.name as author_name,
        u.email as author_email,
        r.name as reviewer_name
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN users r ON a.reviewer_id = r.id
      WHERE a.slug = ? AND a.status = 'published'
      AND (a.tenant_id = ? OR a.tenant_id IS NULL)
    `, [params.slug, tenantId])

    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Buscar tags do artigo
    const tags = await executeQuery(`
      SELECT t.id, t.name, t.slug, t.color
      FROM kb_tags t
      INNER JOIN kb_article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
    `, [article.id])

    // Buscar anexos
    const attachments = await executeQuery(`
      SELECT id, filename, original_name, mime_type, file_size, alt_text
      FROM kb_article_attachments
      WHERE article_id = ?
      ORDER BY created_at ASC
    `, [article.id])

    // Buscar artigos relacionados (mesma categoria)
    const relatedArticles = await executeQuery(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.view_count,
        a.helpful_votes,
        a.not_helpful_votes
      FROM kb_articles a
      WHERE a.category_id = (
        SELECT category_id FROM kb_articles WHERE id = ?
      )
      AND a.id != ?
      AND a.status = 'published'
      AND (a.tenant_id = ? OR a.tenant_id IS NULL)
      ORDER BY a.view_count DESC, a.helpful_votes DESC
      LIMIT 5
    `, [article.id, article.id, tenantId])

    // Registrar visualização (audit log)
    const userContext = getUserContextFromRequest(request)
    const userId = userContext?.id || null

    // Inserir log de auditoria para incrementar view_count via trigger
    await executeRun(`
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, ip_address, user_agent)
      VALUES (?, ?, 'kb_article', ?, 'view', ?, ?)
    `, [
      tenantId,
      userId,
      article.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    ])

    return NextResponse.json({
      success: true,
      article: {
        ...article,
        tags,
        attachments,
        relatedArticles
      }
    })

  } catch (error) {
    logger.error('Error fetching article', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    // Verificar se artigo existe
    const existingArticle = await executeQueryOne<{ id: number; author_id: number }>(
      'SELECT id, author_id FROM kb_articles WHERE slug = ? AND tenant_id = ?',
      [params.slug, tenantContext.id]
    )
    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar permissão (admin ou autor)
    const hasElevatedAccess = ['admin', 'super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)
    if (!hasElevatedAccess && userContext.id !== existingArticle.author_id) {
      return NextResponse.json(
        { error: 'Você só pode editar seus próprios artigos' },
        { status: 403 }
      )
    }

    const {
      title,
      content,
      summary,
      category_id,
      tags,
      status,
      visibility,
      featured,
      search_keywords,
      meta_title,
      meta_description
    } = await request.json()

    await executeTransaction(async (tx) => {
      await txRun(tx, `
        UPDATE kb_articles SET
          title = ?,
          content = ?,
          summary = ?,
          category_id = ?,
          status = ?,
          visibility = ?,
          featured = ?,
          search_keywords = ?,
          meta_title = ?,
          meta_description = ?,
          published_at = CASE
            WHEN status = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP
            WHEN status != 'published' THEN NULL
            ELSE published_at
          END
        WHERE id = ? AND tenant_id = ?
      `, [
        title,
        content,
        summary ?? null,
        category_id || null,
        status,
        visibility,
        featured ? 1 : 0,
        search_keywords ?? null,
        meta_title ?? null,
        meta_description ?? null,
        existingArticle.id,
        tenantContext.id
      ])

      // Remover tags antigas
      await txRun(tx, 'DELETE FROM kb_article_tags WHERE article_id = ?', [existingArticle.id])

      // Adicionar novas tags
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          let tag = await txGet<{ id: number }>(tx, 'SELECT id FROM kb_tags WHERE slug = ?', [tagSlug])

          if (!tag) {
            await txRun(tx, 'INSERT INTO kb_tags (name, slug) VALUES (?, ?)', [tagName, tagSlug])
            tag = await txGet<{ id: number }>(tx, 'SELECT id FROM kb_tags WHERE slug = ?', [tagSlug])
            if (!tag) {
              throw new Error('Failed to create tag');
            }
          }

          await txRun(tx, 'INSERT INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)', [existingArticle.id, tag.id])
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Artigo atualizado com sucesso'
    })

  } catch (error) {
    logger.error('Error updating article', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['admin', 'super_admin', 'tenant_admin'],
    })
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant

    // Verificar se artigo existe
    const article = await executeQueryOne<{ id: number }>(
      'SELECT id FROM kb_articles WHERE slug = ? AND tenant_id = ?',
      [params.slug, tenantContext.id]
    )
    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Deletar artigo (cascata irá remover tags e feedback relacionados)
    await executeRun('DELETE FROM kb_articles WHERE id = ? AND tenant_id = ?', [article.id, tenantContext.id])

    return NextResponse.json({
      success: true,
      message: 'Artigo deletado com sucesso'
    })

  } catch (error) {
    logger.error('Error deleting article', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
