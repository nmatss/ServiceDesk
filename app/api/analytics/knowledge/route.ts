import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, sqlDatetimeSub, sqlDatetimeSubYears, sqlDateSub } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    // Calcular data de início
    let dateFilter = ''
    switch (period) {
      case '7d':
        dateFilter = sqlDatetimeSub(7)
        break
      case '90d':
        dateFilter = sqlDatetimeSub(90)
        break
      case '1y':
        dateFilter = sqlDatetimeSubYears(1)
        break
      default:
        dateFilter = sqlDatetimeSub(30)
    }

    const organizationId = auth.organizationId;

    // Estatísticas gerais da base de conhecimento
    const totalArticles = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM kb_articles
      WHERE organization_id = ? AND status = 'published'
    `, [organizationId]) || { count: 0 }

    const totalViews = await executeQueryOne<{ total: number }>(`
      SELECT SUM(view_count) as total FROM kb_articles
      WHERE organization_id = ? AND status = 'published'
    `, [organizationId]) || { total: 0 }

    const totalFeedback = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM kb_article_feedback f
      JOIN kb_articles a ON f.article_id = a.id
      WHERE a.organization_id = ? AND f.created_at >= ${dateFilter}
    `, [organizationId]) || { count: 0 }

    const helpfulFeedback = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM kb_article_feedback f
      JOIN kb_articles a ON f.article_id = a.id
      WHERE a.organization_id = ? AND f.was_helpful = 1 AND f.created_at >= ${dateFilter}
    `, [organizationId]) || { count: 0 }

    const helpfulnessRate = totalFeedback.count > 0
      ? Math.round((helpfulFeedback.count / totalFeedback.count) * 100)
      : 0

    // Artigos mais visualizados
    const mostViewedArticles = await executeQuery(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.view_count,
        a.helpful_votes,
        a.not_helpful_votes,
        c.name as category_name,
        c.color as category_color
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = ? AND a.status = 'published'
      ORDER BY a.view_count DESC
      LIMIT 10
    `, [organizationId])

    // Artigos mais úteis
    const mostHelpfulArticles = await executeQuery(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.helpful_votes,
        a.not_helpful_votes,
        a.view_count,
        c.name as category_name,
        c.color as category_color,
        ROUND((a.helpful_votes * 100.0) / NULLIF(a.helpful_votes + a.not_helpful_votes, 0), 1) as helpfulness_rate
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = ? AND a.status = 'published'
      AND (a.helpful_votes + a.not_helpful_votes) >= 5 -- Mínimo de 5 avaliações
      ORDER BY helpfulness_rate DESC, a.helpful_votes DESC
      LIMIT 10
    `, [organizationId])

    // Artigos por categoria
    const articlesByCategory = await executeQuery(`
      SELECT
        c.name as category,
        c.color,
        COUNT(a.id) as article_count,
        SUM(a.view_count) as total_views,
        AVG(a.view_count) as avg_views
      FROM kb_categories c
      LEFT JOIN kb_articles a ON c.id = a.category_id AND a.organization_id = ? AND a.status = 'published'
      GROUP BY c.id, c.name, c.color
      ORDER BY article_count DESC
    `, [organizationId])

    // Tendência de visualizações (últimos 14 dias)
    const viewsTrend = await executeQuery(`
      SELECT
        DATE(al.created_at) as date,
        COUNT(*) as views
      FROM audit_logs al
      WHERE al.entity_type = 'kb_article'
      AND al.action = 'view'
      AND al.created_at >= ${sqlDatetimeSub(14)}
      GROUP BY DATE(al.created_at)
      ORDER BY date ASC
    `)

    // Artigos que precisam de atenção (baixa avaliação)
    const articlesNeedingAttention = await executeQuery(`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.helpful_votes,
        a.not_helpful_votes,
        a.view_count,
        c.name as category_name,
        c.color as category_color,
        ROUND((a.helpful_votes * 100.0) / NULLIF(a.helpful_votes + a.not_helpful_votes, 0), 1) as helpfulness_rate
      FROM kb_articles a
      LEFT JOIN kb_categories c ON a.category_id = c.id
      WHERE a.organization_id = ? AND a.status = 'published'
      AND (a.helpful_votes + a.not_helpful_votes) >= 3 -- Mínimo de 3 avaliações
      AND (a.helpful_votes * 100.0) / (a.helpful_votes + a.not_helpful_votes) < 60 -- Menos de 60% útil
      ORDER BY helpfulness_rate ASC
      LIMIT 10
    `, [organizationId])

    // Buscas mais populares (últimos 30 dias)
    const popularSearches = await executeQuery(`
      SELECT date, kb_searches_performed
      FROM analytics_daily_metrics
      WHERE date >= ${sqlDateSub(30)}
      AND kb_searches_performed > 0
      ORDER BY date ASC
    `)

    const totalSearches = (popularSearches as any[]).reduce((sum: number, day: any) => sum + day.kb_searches_performed, 0) as number

    // Taxa de conversão (visualizações de artigos após busca)
    const searchToViewConversion = totalSearches > 0 && totalViews.total > 0
      ? Math.round((totalViews.total / totalSearches) * 100)
      : 0

    // Feedback recente
    const recentFeedback = await executeQuery(`
      SELECT
        f.was_helpful,
        f.comment,
        f.created_at,
        a.title as article_title,
        a.slug as article_slug,
        u.name as user_name
      FROM kb_article_feedback f
      INNER JOIN kb_articles a ON f.article_id = a.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE a.organization_id = ? AND f.created_at >= ${dateFilter}
      AND f.comment IS NOT NULL
      ORDER BY f.created_at DESC
      LIMIT 20
    `, [organizationId])

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalArticles: totalArticles.count,
          totalViews: totalViews.total || 0,
          totalFeedback: totalFeedback.count,
          helpfulnessRate,
          totalSearches,
          searchToViewConversion
        },
        topArticles: {
          mostViewed: mostViewedArticles,
          mostHelpful: mostHelpfulArticles,
          needingAttention: articlesNeedingAttention
        },
        distributions: {
          byCategory: articlesByCategory
        },
        trends: {
          views: viewsTrend,
          searches: popularSearches
        },
        feedback: {
          recent: recentFeedback.map((item: any) => ({
            ...item,
            user_name: item.user_name || 'Usuário anônimo'
          }))
        }
      },
      period
    })

  } catch (error) {
    logger.error('Error fetching knowledge analytics', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}