/**
 * Knowledge Article Auto-Generation API
 * Generate articles from resolved tickets using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoGenerator } from '@/lib/knowledge/auto-generator';
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['admin', 'agent', 'super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response
    const userContext = guard.context!.user

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
      articleId = await autoGenerator.saveGeneratedArticle(article, userContext.id);
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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['admin', 'agent', 'super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response

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
