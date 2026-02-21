import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { id } = await params
    const articleId = parseInt(id)
    const { helpful } = await request.json()

    if (typeof helpful !== 'boolean') {
      return NextResponse.json({ error: 'Campo "helpful" deve ser boolean' }, { status: 400 })
    }

    // Verify article exists and belongs to tenant
    const article = await executeQueryOne<{ id: number }>(
      'SELECT id FROM knowledge_articles WHERE id = ? AND tenant_id = ? AND status = ?',
      [articleId, tenantContext.id, 'published']
    )

    if (!article) {
      return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
    }

    // Check if user already provided feedback for this article
    const existingFeedback = await executeQueryOne<{ id: number; helpful: number }>(`
      SELECT id, helpful FROM knowledge_feedback
      WHERE article_id = ? AND user_id = ? AND tenant_id = ?
    `, [articleId, userContext.id, tenantContext.id])

    if (existingFeedback) {
      // Update existing feedback
      if (existingFeedback.helpful !== (helpful ? 1 : 0)) {
        // Update feedback
        await executeRun(`
          UPDATE knowledge_feedback
          SET helpful = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [helpful ? 1 : 0, existingFeedback.id])

        // Update article counters
        if (helpful) {
          // Changed from not helpful to helpful
          await executeRun(`
            UPDATE knowledge_articles
            SET helpful_count = helpful_count + 1,
                not_helpful_count = not_helpful_count - 1
            WHERE id = ?
          `, [articleId])
        } else {
          // Changed from helpful to not helpful
          await executeRun(`
            UPDATE knowledge_articles
            SET helpful_count = helpful_count - 1,
                not_helpful_count = not_helpful_count + 1
            WHERE id = ?
          `, [articleId])
        }
      }
    } else {
      // Create new feedback
      await executeRun(`
        INSERT INTO knowledge_feedback (article_id, user_id, helpful, tenant_id)
        VALUES (?, ?, ?, ?)
      `, [articleId, userContext.id, helpful ? 1 : 0, tenantContext.id])

      // Update article counters
      if (helpful) {
        await executeRun(`
          UPDATE knowledge_articles
          SET helpful_count = helpful_count + 1
          WHERE id = ?
        `, [articleId])
      } else {
        await executeRun(`
          UPDATE knowledge_articles
          SET not_helpful_count = not_helpful_count + 1
          WHERE id = ?
        `, [articleId])
      }
    }

    // Get updated article stats
    const updatedArticle = await executeQueryOne(`
      SELECT helpful_count, not_helpful_count
      FROM knowledge_articles
      WHERE id = ?
    `, [articleId])

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
