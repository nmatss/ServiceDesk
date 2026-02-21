/**
 * Article Review API
 * Submit reviews, ratings, and quality feedback for articles
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Submit article review
 */
export async function POST(request: NextRequest, context: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const params = await context.params;
    const articleId = parseInt(params.id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        { error: 'Invalid article id' },
        { status: 400 }
      );
    }
    const body = await request.json();
    const {
      status, // 'approved' | 'rejected' | 'changes_requested'
      rating, // 1-5
      comments,
      suggested_changes
    } = body;

    if (!status || !rating) {
      return NextResponse.json(
        { error: 'Status and rating are required' },
        { status: 400 }
      );
    }

    // Check if article exists
    const article = await executeQueryOne<Record<string, any>>(
      'SELECT * FROM kb_articles WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)',
      [articleId, tenantContext.id]
    );

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Create review record
    const result = await executeRun(
      `INSERT INTO kb_article_reviews (
        article_id, reviewer_id, status, rating,
        comments, suggested_changes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        articleId,
        userContext.id,
        status,
        rating,
        comments || null,
        suggested_changes ? JSON.stringify(suggested_changes) : null
      ]
    );

    // Update article status if approved
    if (status === 'approved') {
      await executeRun(
        `UPDATE kb_articles
         SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userContext.id, articleId]
      );
    }

    // Notify article author
    try {
      await executeRun(
        `INSERT INTO notifications (
          user_id, type, title, message, ticket_id, created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          article.author_id,
          'article_review',
          'Article Review Received',
          `Your article "${article.title}" has been reviewed: ${status}`,
          null
        ]
      );
    } catch (error) {
      logger.warn('Failed to create notification', error);
    }

    return NextResponse.json({
      success: true,
      reviewId: result.lastInsertRowid
    });
  } catch (error) {
    logger.error('Error submitting review', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}

/**
 * Get article reviews
 */
export async function GET(request: NextRequest, context: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant

    const params = await context.params;
    const articleId = parseInt(params.id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        { error: 'Invalid article id' },
        { status: 400 }
      );
    }

    const reviews = await executeQuery<any>(
      `SELECT
        r.*,
        u.name as reviewer_name,
        u.email as reviewer_email
      FROM kb_article_reviews r
      JOIN users u ON r.reviewer_id = u.id
      JOIN kb_articles a ON a.id = r.article_id
      WHERE r.article_id = ?
      AND (a.tenant_id = ? OR a.tenant_id IS NULL)
      ORDER BY r.created_at DESC`
    , [articleId, tenantContext.id]);

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Count statuses
    const statusCounts = reviews.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      reviews,
      summary: {
        total: reviews.length,
        avgRating: Math.round(avgRating * 10) / 10,
        statusCounts
      }
    });
  } catch (error) {
    logger.error('Error fetching reviews', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
