import { NextRequest, NextResponse } from 'next/server'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger';
import { isPrivileged } from '@/lib/auth/roles';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { slug } = await params
    const { auth, response: authResponse } = requireTenantUserContext(request);
    if (authResponse) return authResponse;
    const tenantId = auth.organizationId;

    const { was_helpful, comment } = await request.json()

    if (typeof was_helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo was_helpful é obrigatório e deve ser booleano' },
        { status: 400 }
      )
    }
    // Buscar artigo
    const article = await executeQueryOne<{ id: number }>(
      'SELECT id FROM kb_articles WHERE slug = ? AND status = ? AND (tenant_id = ? OR tenant_id IS NULL)',
      [slug, 'published', tenantId]
    )
    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Usar userId do contexto autenticado
    let userId = auth.userId || null
    let sessionId = null

    // Se não autenticado, usar session ID baseado no IP + User Agent
    if (!userId) {
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      sessionId = Buffer.from(`${ip}-${userAgent}`).toString('base64')
    }

    // Verificar se já existe feedback deste usuário/sessão para este artigo
    let existingFeedback: { id: number } | undefined
    if (userId) {
      existingFeedback = await executeQueryOne<{ id: number }>(
        'SELECT id FROM kb_article_feedback WHERE article_id = ? AND user_id = ?',
        [article.id, userId]
      )
    } else {
      existingFeedback = await executeQueryOne<{ id: number }>(
        'SELECT id FROM kb_article_feedback WHERE article_id = ? AND session_id = ?',
        [article.id, sessionId]
      )
    }

    if (existingFeedback) {
      // Atualizar feedback existente
      await executeRun(`
        UPDATE kb_article_feedback
        SET was_helpful = ?, comment = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [was_helpful ? 1 : 0, comment || null, existingFeedback.id])
    } else {
      // Criar novo feedback
      await executeRun(`
        INSERT INTO kb_article_feedback (
          article_id, user_id, session_id, was_helpful, comment,
          user_agent, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        article.id,
        userId,
        sessionId,
        was_helpful ? 1 : 0,
        comment || null,
        request.headers.get('user-agent') || 'unknown',
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      ])
    }

    // Buscar estatísticas atualizadas
    const stats = await executeQueryOne(`
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
    `, [article.id])

    return NextResponse.json({
      success: true,
      message: 'Feedback registrado com sucesso',
      stats
    })

  } catch (error) {
    logger.error('Error submitting feedback', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { slug } = await params
    const { auth, response: authResponse } = requireTenantUserContext(request);
    if (authResponse) return authResponse;
    const tenantId = auth.organizationId;

    // Buscar artigo
    const article = await executeQueryOne<{ id: number }>(
      'SELECT id FROM kb_articles WHERE slug = ? AND (tenant_id = ? OR tenant_id IS NULL)',
      [slug, tenantId]
    )
    if (!article) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      )
    }

    // Buscar estatísticas de feedback
    const stats = await executeQueryOne(`
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
    `, [article.id])

    // Buscar comentários de feedback (apenas para perfis privilegiados)
    let comments: unknown[] = []
    if (auth.role && isPrivileged(auth.role)) {
      comments = await executeQuery(`
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
      `, [article.id])
    }

    return NextResponse.json({
      success: true,
      stats,
      comments
    })

  } catch (error) {
    logger.error('Error fetching feedback', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
