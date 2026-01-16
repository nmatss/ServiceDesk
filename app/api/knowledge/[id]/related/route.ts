/**
 * Related Articles API
 * Find semantically similar articles using vector search
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const vectorDb = new VectorDatabase(db as any);

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
    const articleId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    // Get the current article
    const article = db.prepare(
      `SELECT id, title, content, summary FROM kb_articles WHERE id = ? AND is_published = 1`
    ).get(articleId) as any;

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
            const relatedArticle = db.prepare(`
              SELECT
                a.id,
                a.title,
                a.summary,
                a.view_count,
                a.helpful_count,
                c.name as category_name
              FROM kb_articles a
              LEFT JOIN categories c ON a.category_id = c.id
              WHERE a.id = ? AND a.is_published = 1
            `).get(result.entityId);

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
