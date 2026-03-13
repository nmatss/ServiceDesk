import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { HybridSearchEngine } from '@/lib/ai/hybrid-search';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import { logger } from '@/lib/monitoring/logger';
import { executeRun } from '@/lib/db/adapter';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Rate limiting for semantic search
const semanticSearchRateLimit = createRateLimitMiddleware('semantic-search');

// Initialize vector database (singleton pattern)
let vectorDbInstance: VectorDatabase | null = null;
let hybridSearchInstance: HybridSearchEngine | null = null;

async function getVectorDb(): Promise<VectorDatabase> {
  if (!vectorDbInstance) {
    vectorDbInstance = new VectorDatabase();
  }
  return vectorDbInstance;
}

async function getHybridSearch(): Promise<HybridSearchEngine> {
  if (!hybridSearchInstance) {
    const vectorDb = await getVectorDb();
    hybridSearchInstance = new HybridSearchEngine(vectorDb);
  }
  return hybridSearchInstance;
}

/**
 * POST /api/search/semantic
 * Perform semantic search using vector embeddings and hybrid search
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  // Apply rate limiting
  const rateLimitResult = await semanticSearchRateLimit(request, '/api/search/semantic');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    const body = await request.json();
    const {
      query,
      entityTypes = ['ticket', 'kb_article'],
      searchType = 'hybrid', // 'hybrid', 'semantic', 'keyword'
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      maxResults = 20,
      threshold = 0.6,
      filters = {},
      includeFacets = true,
      useCache = true
    } = body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'Query is too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Validate entity types
    const validEntityTypes = ['ticket', 'kb_article', 'comment'];
    const invalidTypes = entityTypes.filter((t: string) => !validEntityTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Invalid entity types: ${invalidTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Apply user-specific filters for non-admin users
    if (auth.role === 'user') {
      filters.users = [auth.userId];
    }

    const hybridSearch = await getHybridSearch();

    let results;

    if (searchType === 'hybrid') {
      // Hybrid search (semantic + keyword)
      results = await hybridSearch.search({
        query,
        entityTypes,
        semanticWeight,
        keywordWeight,
        maxResults,
        threshold,
        filters,
        includeFacets,
        useCache
      });
    } else if (searchType === 'semantic') {
      // Pure semantic search
      const vectorDb = await getVectorDb();
      const semanticResults = await vectorDb.searchSimilar(query, {
        entityTypes,
        maxResults,
        threshold,
        includeMetadata: true,
        useCache
      });

      results = {
        results: semanticResults.map(r => ({
          id: r.entityId,
          type: r.entityType,
          title: r.content || '',
          content: r.metadata?.description || '',
          score: r.similarityScore,
          semanticScore: r.similarityScore,
          metadata: r.metadata
        })),
        total: semanticResults.length,
        processingTimeMs: 0
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid searchType. Must be "hybrid" or "semantic"' },
        { status: 400 }
      );
    }

    // Log search for analytics
    try {
      await executeRun(`
        INSERT INTO search_history (user_id, query, results_count, search_mode)
        VALUES (?, ?, ?, ?)
      `, [auth.userId, query, results.total, searchType]);
    } catch (error) {
      logger.warn('Failed to log search history', error);
    }

    return NextResponse.json({
      success: true,
      searchType,
      query,
      ...results
    });

  } catch (error) {
    logger.error('Error in semantic search API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/semantic/stats
 * Get vector database statistics
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.SEARCH);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    if (!ADMIN_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const vectorDb = await getVectorDb();

    // Get embedding statistics
    const stats = await vectorDb.getStats();

    // Get cache statistics
    const cacheStats = vectorDb.getCacheStats();

    return NextResponse.json({
      success: true,
      embeddings: stats,
      cache: cacheStats
    });

  } catch (error) {
    logger.error('Error getting semantic search stats', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
