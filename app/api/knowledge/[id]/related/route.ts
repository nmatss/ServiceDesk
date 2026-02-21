/**
 * Related Articles API
 * Find semantically similar articles using vector search
 */

import { NextRequest, NextResponse } from 'next/server';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { logger } from '@/lib/monitoring/logger';
import { executeQueryOne } from '@/lib/db/adapter';
import { getTenantContextFromRequest } from '@/lib/tenant/context';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const vectorDb = new VectorDatabase();

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    const tenantId = tenantContext?.id ?? (process.env.NODE_ENV === 'test' ? 1 : null)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const articleId = parseInt(params.id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        { error: 'Invalid article id' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    // Get the current article
    const article = await executeQueryOne<{
      id: number;
      title: string;
      content: string | null;
      summary: string | null;
    }>(
      `SELECT id, title, content, summary
       FROM kb_articles
       WHERE id = ? AND status = 'published'
       AND (tenant_id = ? OR tenant_id IS NULL)`
      , [articleId, tenantId]);

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Use article title and summary for semantic search
    const searchText = `${article.title} ${article.summary || ''}`;

    // Find similar articles
    const similarArticles = await vectorDb.findRelatedKnowledgeArticles(
      searchText,
      limit + 1 // Get one extra to filter out self
    );

    // Filter out the current article and enrich results
    const relatedArticles = await Promise.all(
      similarArticles
        .filter(result => result.entityId !== articleId)
        .slice(0, limit)
        .map(async result => {
          try {
            const relatedArticle = await executeQueryOne<Record<string, unknown>>(`
              SELECT
                a.id,
                a.title,
                a.summary,
                a.view_count,
                a.helpful_votes,
                c.name as category_name
              FROM kb_articles a
              LEFT JOIN kb_categories c ON a.category_id = c.id
              WHERE a.id = ? AND a.status = 'published'
              AND (a.tenant_id = ? OR a.tenant_id IS NULL)
            `, [result.entityId, tenantId]);

            if (!relatedArticle) return null;

            return {
              ...relatedArticle,
              similarityScore: result.similarityScore
            };
          } catch (error) {
            logger.error('Error fetching related article', error);
            return null;
          }
        })
    );

    const validArticles = relatedArticles.filter(a => a !== null);

    return NextResponse.json({
      success: true,
      articles: validArticles,
      total: validArticles.length
    });
  } catch (error) {
    logger.error('Error finding related articles', error);
    return NextResponse.json(
      { error: 'Failed to find related articles' },
      { status: 500 }
    );
  }
}
