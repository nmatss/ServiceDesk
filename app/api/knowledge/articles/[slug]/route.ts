import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const db = getDb()

    // Buscar artigo por slug
    const article = db.prepare(`
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
    `).get(params.slug)

    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Buscar tags do artigo
    const tags = db.prepare(`
      SELECT t.id, t.name, t.slug, t.color
      FROM kb_tags t
      INNER JOIN kb_article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
    `).all(article.id)

    // Buscar anexos
    const attachments = db.prepare(`
      SELECT id, filename, original_name, mime_type, file_size, alt_text
      FROM kb_article_attachments
      WHERE article_id = ?
      ORDER BY created_at ASC
    `).all(article.id)

    // Buscar artigos relacionados (mesma categoria)
    const relatedArticles = db.prepare(`
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
      ORDER BY a.view_count DESC, a.helpful_votes DESC
      LIMIT 5
    `).all(article.id, article.id)

    // Registrar visualização (audit log)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    let userId = null
    if (token) {
      try {
        const user = await verifyToken(token)
        userId = user?.id
      } catch (e) {
        // Ignorar erro de token para permitir visualização anônima
      }
    }

    // Inserir log de auditoria para incrementar view_count via trigger
    db.prepare(`
      INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address, user_agent)
      VALUES (?, 'kb_article', ?, 'view', ?, ?)
    `).run(
      userId,
      article.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    )

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
    console.error('Error fetching article:', error)
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

    const db = getDb()

    // Verificar se artigo existe
    const existingArticle = db.prepare('SELECT id, author_id FROM kb_articles WHERE slug = ?').get(params.slug)
    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar permissão (admin ou autor)
    if (user.role !== 'admin' && user.id !== existingArticle.author_id) {
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

    // Iniciar transação
    const transaction = db.transaction(() => {
      // Atualizar artigo
      db.prepare(`
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
            WHEN status = 'published' AND published_at IS NULL THEN datetime('now')
            WHEN status != 'published' THEN NULL
            ELSE published_at
          END
        WHERE id = ?
      `).run(
        title,
        content,
        summary,
        category_id || null,
        status,
        visibility,
        featured,
        search_keywords,
        meta_title,
        meta_description,
        existingArticle.id
      )

      // Remover tags antigas
      db.prepare('DELETE FROM kb_article_tags WHERE article_id = ?').run(existingArticle.id)

      // Adicionar novas tags
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          let tag = db.prepare('SELECT id FROM kb_tags WHERE slug = ?').get(tagSlug)

          if (!tag) {
            const tagResult = db.prepare('INSERT INTO kb_tags (name, slug) VALUES (?, ?)').run(tagName, tagSlug)
            tag = { id: tagResult.lastInsertRowid }
          }

          db.prepare('INSERT INTO kb_article_tags (article_id, tag_id) VALUES (?, ?)').run(existingArticle.id, tag.id)
        }
      }
    })

    transaction()

    return NextResponse.json({
      success: true,
      message: 'Artigo atualizado com sucesso'
    })

  } catch (error) {
    console.error('Error updating article:', error)
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
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem deletar artigos' },
        { status: 403 }
      )
    }

    const db = getDb()

    // Verificar se artigo existe
    const article = db.prepare('SELECT id FROM kb_articles WHERE slug = ?').get(params.slug)
    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Deletar artigo (cascata irá remover tags e feedback relacionados)
    db.prepare('DELETE FROM kb_articles WHERE id = ?').run(article.id)

    return NextResponse.json({
      success: true,
      message: 'Artigo deletado com sucesso'
    })

  } catch (error) {
    console.error('Error deleting article:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}