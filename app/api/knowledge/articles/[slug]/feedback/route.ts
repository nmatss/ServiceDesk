import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { was_helpful, comment } = await request.json()

    if (typeof was_helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo was_helpful é obrigatório e deve ser booleano' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Buscar artigo
    const article = db.prepare('SELECT id FROM kb_articles WHERE slug = ? AND status = ?').get(params.slug, 'published')
    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se usuário está autenticado
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    let userId = null
    let sessionId = null

    if (token) {
      try {
        const user = await verifyToken(token)
        userId = user?.id
      } catch (e) {
        // Continuar como usuário anônimo
      }
    }

    // Se não autenticado, usar session ID baseado no IP + User Agent
    if (!userId) {
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      sessionId = Buffer.from(`${ip}-${userAgent}`).toString('base64')
    }

    // Verificar se já existe feedback deste usuário/sessão para este artigo
    let existingFeedback
    if (userId) {
      existingFeedback = db.prepare('SELECT id FROM kb_article_feedback WHERE article_id = ? AND user_id = ?').get(article.id, userId)
    } else {
      existingFeedback = db.prepare('SELECT id FROM kb_article_feedback WHERE article_id = ? AND session_id = ?').get(article.id, sessionId)
    }

    if (existingFeedback) {
      // Atualizar feedback existente
      db.prepare(`
        UPDATE kb_article_feedback
        SET was_helpful = ?, comment = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(was_helpful, comment || null, existingFeedback.id)
    } else {
      // Criar novo feedback
      db.prepare(`
        INSERT INTO kb_article_feedback (
          article_id, user_id, session_id, was_helpful, comment,
          user_agent, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        article.id,
        userId,
        sessionId,
        was_helpful,
        comment || null,
        request.headers.get('user-agent') || 'unknown',
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      )
    }

    // Buscar estatísticas atualizadas
    const stats = db.prepare(`
      SELECT
        helpful_votes,
        not_helpful_votes,
        (helpful_votes + not_helpful_votes) as total_votes,
        CASE
          WHEN (helpful_votes + not_helpful_votes) > 0
          THEN ROUND((helpful_votes * 100.0) / (helpful_votes + not_helpful_votes), 1)
          ELSE 0
        END as helpful_percentage
      FROM kb_articles
      WHERE id = ?
    `).get(article.id)

    return NextResponse.json({
      success: true,
      message: 'Feedback registrado com sucesso',
      stats
    })

  } catch (error) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const db = getDb()

    // Buscar artigo
    const article = db.prepare('SELECT id FROM kb_articles WHERE slug = ?').get(params.slug)
    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Buscar estatísticas de feedback
    const stats = db.prepare(`
      SELECT
        helpful_votes,
        not_helpful_votes,
        (helpful_votes + not_helpful_votes) as total_votes,
        CASE
          WHEN (helpful_votes + not_helpful_votes) > 0
          THEN ROUND((helpful_votes * 100.0) / (helpful_votes + not_helpful_votes), 1)
          ELSE 0
        END as helpful_percentage
      FROM kb_articles
      WHERE id = ?
    `).get(article.id)

    // Buscar comentários de feedback (apenas para admins/agentes)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    let comments = []
    if (token) {
      try {
        const user = await verifyToken(token)
        if (user && (user.role === 'admin' || user.role === 'agent')) {
          comments = db.prepare(`
            SELECT
              f.was_helpful,
              f.comment,
              f.created_at,
              u.name as user_name,
              u.email as user_email
            FROM kb_article_feedback f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.article_id = ? AND f.comment IS NOT NULL
            ORDER BY f.created_at DESC
            LIMIT 50
          `).all(article.id)
        }
      } catch (e) {
        // Ignorar erro de token
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      comments
    })

  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}