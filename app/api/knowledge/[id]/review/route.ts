/**
 * Article Review API
 * Submit reviews, ratings, and quality feedback for articles
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';
import { verifyAuth } from '@/lib/auth/sqlite-auth';

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
    const auth = await verifyAuth(request);
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const articleId = parseInt(params.id);
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
    const article = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(articleId) as any;

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Create review record
    const result = db.prepare(
      `INSERT INTO kb_article_reviews (
        article_id, reviewer_id, status, rating,
        comments, suggested_changes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      articleId,
      auth.user.id,
      status,
      rating,
      comments || null,
      suggested_changes ? JSON.stringify(suggested_changes) : null
    );

    // Update article status if approved
    if (status === 'approved') {
      db.prepare(
        `UPDATE kb_articles
         SET reviewed_by = ?, reviewed_at = datetime('now')
         WHERE id = ?`
      ).run(auth.user.id, articleId);
    }

    // Notify article author
    try {
      db.prepare(
        `INSERT INTO notifications (
          user_id, type, title, message, ticket_id, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        article.author_id,
        'article_review',
        'Article Review Received',
        `Your article "${article.title}" has been reviewed: ${status}`,
        null
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
export async function GET(_request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const articleId = parseInt(params.id);

    const reviews = db.prepare(
      `SELECT
        r.*,
        u.name as reviewer_name,
        u.email as reviewer_email
      FROM kb_article_reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.article_id = ?
      ORDER BY r.created_at DESC`
    ).all(articleId) as any[];

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
