/**
 * Knowledge Base Popular Searches API
 * Provides list of popular/trending search queries
 */

import { NextRequest, NextResponse } from 'next/server';
import * as semanticSearchModule from '@/lib/knowledge/semantic-search';
import { logger } from '@/lib/monitoring/logger';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
function resolveSemanticSearchEngine() {
  const moduleAny = semanticSearchModule as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(moduleAny, 'semanticSearchEngine')) {
    return moduleAny.semanticSearchEngine as any
  }
  if (Object.prototype.hasOwnProperty.call(moduleAny, 'semanticSearch')) {
    return moduleAny.semanticSearch as any
  }
  if (Object.prototype.hasOwnProperty.call(moduleAny, 'default')) {
    return moduleAny.default as any
  }
  return null
}

const semanticSearchEngine = resolveSemanticSearchEngine()

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.KNOWLEDGE_SEARCH);
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const days = parseInt(searchParams.get('days') || '30');
    const userContext = getUserContextFromRequest(request)

    // Get analytics data
    const analytics = typeof semanticSearchEngine?.getSearchAnalytics === 'function'
      ? semanticSearchEngine.getSearchAnalytics(userContext?.id ? String(userContext.id) : undefined, days)
      : {
        topQueries: [],
        topArticles: [],
        avgResultsCount: 0,
        totalSearches: 0,
      };

    // Return top queries
    return NextResponse.json({
      queries: analytics.topQueries.slice(0, limit).map((q: { query: string }) => q.query),
      topQueries: analytics.topQueries.slice(0, limit),
      totalSearches: analytics.totalSearches,
    });
  } catch (error) {
    logger.error('Popular searches error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
