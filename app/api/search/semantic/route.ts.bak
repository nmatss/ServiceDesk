import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { HybridSearchEngine } from '@/lib/ai/hybrid-search';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

// Rate limiting for semantic search
const semanticSearchRateLimit = createRateLimitMiddleware('semantic-search');

// Initialize vector database (singleton pattern)
let vectorDbInstance: VectorDatabase | null = null;
let hybridSearchInstance: HybridSearchEngine | null = null;

async function getVectorDb(): Promise<VectorDatabase> {
  if (!vectorDbInstance) {
    const database = await open({
      filename: './servicedesk.db',
      driver: sqlite3.Database
    });
    vectorDbInstance = new VectorDatabase(database);
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
  // Apply rate limiting
  const rateLimitResult = await semanticSearchRateLimit(request, '/api/search/semantic');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
    if (user.role === 'user') {
      filters.users = [user.id];
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
      db.prepare(`
        INSERT INTO search_history (user_id, query, filters, result_count)
        VALUES (?, ?, ?, ?)
      `).run(user.id, query, JSON.stringify({ searchType, entityTypes, filters }), results.total);
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
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
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
