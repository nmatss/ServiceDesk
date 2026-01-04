import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import slugify from 'slugify'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(_request: NextRequest) {
  try {
    // Get default tenant ID (works for both single and multi-tenant setups)
    const tenantId = 1; // Default organization ID

    // Buscar todas as categorias ativas
    const categories = db.prepare(`
      SELECT
        id,
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
    `).all(tenantId, tenantId)

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
      const existing = db.prepare('SELECT id FROM kb_categories WHERE slug = ?').get(slug)
      if (!existing) break

      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Criar categoria
    const result = db.prepare(`
      INSERT INTO kb_categories (name, slug, description, icon, color, parent_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, slug, description, icon || 'DocumentTextIcon', color || '#3B82F6', parent_id || null, sort_order || 0)

    return NextResponse.json({
      success: true,
      message: 'Categoria criada com sucesso',
      categoryId: result.lastInsertRowid
    })

  } catch (error) {
    logger.error('Error creating category', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}