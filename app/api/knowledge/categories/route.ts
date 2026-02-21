import { NextRequest, NextResponse } from 'next/server'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import slugify from 'slugify'
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    const tenantId = tenantContext?.id ?? (process.env.NODE_ENV === 'test' ? 1 : null)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // Buscar todas as categorias ativas
    const categories = await executeQuery(`
      SELECT
        id,
        tenant_id,
        name,
        slug,
        description,
        icon,
        color,
        parent_id,
        sort_order,
        (SELECT COUNT(*) FROM kb_articles
         WHERE category_id = kb_categories.id
         AND status = 'published'
         AND (tenant_id = ? OR tenant_id IS NULL)
        ) as article_count,
        created_at,
        updated_at
      FROM kb_categories
      WHERE is_active = 1 AND (tenant_id = ? OR tenant_id IS NULL)
      ORDER BY sort_order ASC, name ASC
    `, [tenantId, tenantId])

    return NextResponse.json({
      success: true,
      categories
    })

  } catch (error) {
    logger.error('Error fetching categories', error)
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

    const { name, description, icon, color, parent_id, sort_order } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Nome da categoria é obrigatório' },
        { status: 400 }
      )
    }
    // Gerar slug único
    const baseSlug = slugify(name, { lower: true, strict: true })
    let slug = baseSlug
    let counter = 1

    while (true) {
      const existing = await executeQueryOne(
        'SELECT id FROM kb_categories WHERE slug = ? AND (tenant_id = ? OR tenant_id IS NULL)',
        [slug, tenantContext.id]
      )
      if (!existing) break

      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Criar categoria
    const result = await executeRun(`
      INSERT INTO kb_categories (tenant_id, name, slug, description, icon, color, parent_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [tenantContext.id, name, slug, description, icon || 'DocumentTextIcon', color || '#3B82F6', parent_id || null, sort_order || 0])

    let categoryId = result.lastInsertRowid;
    if (typeof categoryId !== 'number') {
      const inserted = await executeQueryOne<{ id: number }>(
        'SELECT id FROM kb_categories WHERE slug = ? AND (tenant_id = ? OR tenant_id IS NULL)',
        [slug, tenantContext.id]
      );
      categoryId = inserted?.id;
    }

    return NextResponse.json({
      success: true,
      message: 'Categoria criada com sucesso',
      categoryId
    })

  } catch (error) {
    logger.error('Error creating category', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
