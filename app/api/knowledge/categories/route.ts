import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import slugify from 'slugify'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()

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
        (SELECT COUNT(*) FROM kb_articles WHERE category_id = kb_categories.id AND status = 'published') as article_count,
        created_at,
        updated_at
      FROM kb_categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `).all()

    return NextResponse.json({
      success: true,
      categories
    })

  } catch (error) {
    console.error('Error fetching categories:', error)
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

    const { name, description, icon, color, parent_id, sort_order } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Nome da categoria é obrigatório' },
        { status: 400 }
      )
    }

    const db = getDb()

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
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}