import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { helpful } = await request.json()

    if (typeof helpful !== 'boolean') {
      return NextResponse.json({ error: 'Campo "helpful" deve ser boolean' }, { status: 400 })
    }

    // Verify article exists and belongs to tenant
    const article = db.prepare(
      'SELECT id FROM knowledge_articles WHERE id = ? AND tenant_id = ? AND status = ?'
    ).get(articleId, tenantContext.id, 'published')

    if (!article) {
      return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
    }

    // Check if user already provided feedback for this article
    const existingFeedback = db.prepare(`
      SELECT id, helpful FROM knowledge_feedback
      WHERE article_id = ? AND user_id = ? AND tenant_id = ?
    `).get(articleId, userContext.id, tenantContext.id)

    if (existingFeedback) {
      // Update existing feedback
      if (existingFeedback.helpful !== (helpful ? 1 : 0)) {
        // Update feedback
        db.prepare(`
          UPDATE knowledge_feedback
          SET helpful = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(helpful ? 1 : 0, existingFeedback.id)

        // Update article counters
        if (helpful) {
          // Changed from not helpful to helpful
          db.prepare(`
            UPDATE knowledge_articles
            SET helpful_count = helpful_count + 1,
                not_helpful_count = not_helpful_count - 1
            WHERE id = ?
          `).run(articleId)
        } else {
          // Changed from helpful to not helpful
          db.prepare(`
            UPDATE knowledge_articles
            SET helpful_count = helpful_count - 1,
                not_helpful_count = not_helpful_count + 1
            WHERE id = ?
          `).run(articleId)
        }
      }
    } else {
      // Create new feedback
      db.prepare(`
        INSERT INTO knowledge_feedback (article_id, user_id, helpful, tenant_id)
        VALUES (?, ?, ?, ?)
      `).run(articleId, userContext.id, helpful ? 1 : 0, tenantContext.id)

      // Update article counters
      if (helpful) {
        db.prepare(`
          UPDATE knowledge_articles
          SET helpful_count = helpful_count + 1
          WHERE id = ?
        `).run(articleId)
      } else {
        db.prepare(`
          UPDATE knowledge_articles
          SET not_helpful_count = not_helpful_count + 1
          WHERE id = ?
        `).run(articleId)
      }
    }

    // Get updated article stats
    const updatedArticle = db.prepare(`
      SELECT helpful_count, not_helpful_count
      FROM knowledge_articles
      WHERE id = ?
    `).get(articleId)

    return NextResponse.json({
      success: true,
      message: 'Feedback registrado com sucesso',
      stats: updatedArticle
    })
  } catch (error) {
    logger.error('Error submitting knowledge feedback', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}