/**
 * Article Quality Analysis API
 * Analyze article quality, readability, completeness, and SEO
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { contentAnalyzer } from '@/lib/knowledge/content-analyzer';
import { logger } from '@/lib/monitoring/logger';
import { verifyAuth } from '@/lib/auth/sqlite-auth';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
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
    const auth = await verifyAuth(request);
    if (!auth.user || !['admin', 'agent', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const articleId = parseInt(params.id);

    // Get article
    const article = db.prepare(
      'SELECT * FROM kb_articles WHERE id = ?'
    ).get(articleId) as any;

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Parse tags if JSON
    let parsedTags = [];
    if (article.tags) {
      try {
        parsedTags = typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags;
      } catch {
        parsedTags = [];
      }
    }

    const articleWithParsedTags = { ...article, tags: parsedTags };

    // Analyze quality
    const qualityScore = await contentAnalyzer.analyzeArticleQuality(articleWithParsedTags);

    // Get readability metrics
    const readabilityMetrics = contentAnalyzer.calculateReadability(article.content || '');

    // Get content metrics
    const contentMetrics = contentAnalyzer.getContentMetrics(article.content || '');

    // Get improvement suggestions
    const suggestions = contentAnalyzer.suggestImprovements(articleWithParsedTags);

    return NextResponse.json({
      success: true,
      analysis: {
        qualityScore,
        readabilityMetrics,
        contentMetrics,
        suggestions,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error analyzing article', error);
    return NextResponse.json(
      { error: 'Failed to analyze article' },
      { status: 500 }
    );
  }
}

/**
 * Analyze article draft (without ID)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, content, summary, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const article = {
      title,
      content,
      summary,
      tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Analyze quality
    const qualityScore = await contentAnalyzer.analyzeArticleQuality(article);

    // Get readability metrics
    const readabilityMetrics = contentAnalyzer.calculateReadability(content);

    // Get content metrics
    const contentMetrics = contentAnalyzer.getContentMetrics(content);

    // Get improvement suggestions
    const suggestions = contentAnalyzer.suggestImprovements(article);

    return NextResponse.json({
      success: true,
      analysis: {
        qualityScore,
        readabilityMetrics,
        contentMetrics,
        suggestions,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error analyzing article draft', error);
    return NextResponse.json(
      { error: 'Failed to analyze article draft' },
      { status: 500 }
    );
  }
}
