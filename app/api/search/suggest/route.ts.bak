import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { HybridSearchEngine } from '@/lib/ai/hybrid-search';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import { logger } from '@/lib/monitoring/logger';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

// Rate limiting for suggestions
const suggestRateLimit = createRateLimitMiddleware('search-suggest');

// Singleton instances
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
 * GET /api/search/suggest?q=query&limit=5
 * Get auto-complete suggestions for search
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await suggestRateLimit(request, '/api/search/suggest');
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);
    const entityTypesParam = searchParams.get('entity_types');
    const includeHistory = searchParams.get('include_history') !== 'false';

    // Validate query
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        entities: []
      });
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: 'Query is too long (max 100 characters)' },
        { status: 400 }
      );
    }

    // Parse entity types
    const entityTypes = entityTypesParam
      ? entityTypesParam.split(',').filter(t => ['ticket', 'kb_article'].includes(t))
      : ['ticket', 'kb_article'];

    const hybridSearch = await getHybridSearch();

    // Get auto-complete suggestions
    const result = await hybridSearch.autoComplete({
      query,
      limit,
      entityTypes,
      includeHistory
    });

    return NextResponse.json({
      success: true,
      query,
      ...result
    });

  } catch (error) {
    logger.error('Error in search suggest API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/search/suggest
 * Advanced auto-complete with filters
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await suggestRateLimit(request, '/api/search/suggest');
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
      limit = 5,
      entityTypes = ['ticket', 'kb_article'],
      includeHistory = true,
      semanticSuggestions = false
    } = body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        entities: []
      });
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: 'Query is too long (max 100 characters)' },
        { status: 400 }
      );
    }

    const hybridSearch = await getHybridSearch();

    // Get auto-complete suggestions
    const result = await hybridSearch.autoComplete({
      query,
      limit: Math.min(limit, 10),
      entityTypes,
      includeHistory
    });

    // Optionally add semantic suggestions (similar queries)
    if (semanticSuggestions && query.length > 3) {
      try {
        const vectorDb = await getVectorDb();
        const similarResults = await vectorDb.searchSimilar(query, {
          entityTypes: ['ticket', 'kb_article'],
          maxResults: 3,
          threshold: 0.7,
          useCache: true
        });

        // Add titles of similar entities as suggestions
        const semanticSuggestionTexts = similarResults
          .filter(r => r.content && !result.suggestions.includes(r.content))
          .map(r => r.content!)
          .slice(0, 3);

        result.suggestions.push(...semanticSuggestionTexts);
        result.suggestions = result.suggestions.slice(0, limit);
      } catch (error) {
        logger.warn('Failed to get semantic suggestions', error);
      }
    }

    return NextResponse.json({
      success: true,
      query,
      ...result
    });

  } catch (error) {
    logger.error('Error in advanced search suggest API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
