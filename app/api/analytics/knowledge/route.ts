import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { verifyToken } from '@/lib/auth/auth-service'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
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
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    // Calcular data de início
    let dateFilter = ''
    switch (period) {
      case '7d':
        dateFilter = "datetime('now', '-7 days')"
        break
      case '90d':
        dateFilter = "datetime('now', '-90 days')"
        break
      case '1y':
        dateFilter = "datetime('now', '-1 year')"
        break
      default:
        dateFilter = "datetime('now', '-30 days')"
    }

    // Estatísticas gerais da base de conhecimento
    const totalArticles = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM kb_articles
      WHERE status = 'published'
    `) || { count: 0 }

    const totalViews = await executeQueryOne<{ total: number }>(`
      SELECT SUM(view_count) as total FROM kb_articles
      WHERE status = 'published'
    `) || { total: 0 }

    const totalFeedback = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM kb_article_feedback
      WHERE created_at >= ${dateFilter}
    `) || { count: 0 }

    const helpfulFeedback = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM kb_article_feedback
      WHERE was_helpful = 1 AND created_at >= ${dateFilter}
    `) || { count: 0 }

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
      WHERE a.status = 'published'
      ORDER BY a.view_count DESC
      LIMIT 10
    `)

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
      WHERE a.status = 'published'
      AND (a.helpful_votes + a.not_helpful_votes) >= 5 -- Mínimo de 5 avaliações
      ORDER BY helpfulness_rate DESC, a.helpful_votes DESC
      LIMIT 10
    `)

    // Artigos por categoria
    const articlesByCategory = await executeQuery(`
      SELECT
        c.name as category,
        c.color,
        COUNT(a.id) as article_count,
        SUM(a.view_count) as total_views,
        AVG(a.view_count) as avg_views
      FROM kb_categories c
      LEFT JOIN kb_articles a ON c.id = a.category_id AND a.status = 'published'
      GROUP BY c.id, c.name, c.color
      ORDER BY article_count DESC
    `)

    // Tendência de visualizações (últimos 14 dias)
    const viewsTrend = await executeQuery(`
      SELECT
        DATE(al.created_at) as date,
        COUNT(*) as views
      FROM audit_logs al
      WHERE al.entity_type = 'kb_article'
      AND al.action = 'view'
      AND al.created_at >= datetime('now', '-14 days')
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
      WHERE a.status = 'published'
      AND (a.helpful_votes + a.not_helpful_votes) >= 3 -- Mínimo de 3 avaliações
      AND (a.helpful_votes * 100.0) / (a.helpful_votes + a.not_helpful_votes) < 60 -- Menos de 60% útil
      ORDER BY helpfulness_rate ASC
      LIMIT 10
    `)

    // Buscas mais populares (últimos 30 dias)
    const popularSearches = await executeQuery(`
      SELECT date, kb_searches_performed
      FROM analytics_daily_metrics
      WHERE date >= date('now', '-30 days')
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
      WHERE f.created_at >= ${dateFilter}
      AND f.comment IS NOT NULL
      ORDER BY f.created_at DESC
      LIMIT 20
    `)

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