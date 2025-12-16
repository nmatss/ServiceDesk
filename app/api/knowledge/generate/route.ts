/**
 * Knowledge Article Auto-Generation API
 * Generate articles from resolved tickets using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoGenerator } from '@/lib/knowledge/auto-generator';
import { logger } from '@/lib/monitoring/logger';
import { verifyAuth } from '@/lib/auth/sqlite-auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.user || !['admin', 'agent'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      ticket_ids,
      category_id,
      template_type,
      target_audience,
      priority_threshold,
      min_resolution_time,
      auto_save = false
    } = body;

    // Generate article
    const article = await autoGenerator.generateArticle({
      ticket_ids,
      category_id,
      priority_threshold,
      min_resolution_time,
      template_type,
      target_audience
    });

    // Optionally save to database
    let articleId: number | undefined;
    if (auto_save) {
      articleId = await autoGenerator.saveGeneratedArticle(article, auth.user.id);
    }

    return NextResponse.json({
      success: true,
      article: {
        ...article,
        id: articleId
      }
    });
  } catch (error) {
    logger.error('Error generating article', error);
    return NextResponse.json(
      {
        error: 'Failed to generate article',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get generation candidates
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.user || !['admin', 'agent'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const candidates = await autoGenerator.findGenerationCandidates();

    return NextResponse.json({
      success: true,
      candidates
    });
  } catch (error) {
    logger.error('Error finding generation candidates', error);
    return NextResponse.json(
      { error: 'Failed to find generation candidates' },
      { status: 500 }
    );
  }
}
