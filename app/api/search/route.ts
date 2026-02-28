import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { getCachedTicketSearch, cacheTicketSearch } from '@/lib/cache';
import { logger } from '@/lib/monitoring/logger';
import { HybridSearchEngine, type SearchFilters } from '@/lib/ai/hybrid-search';
import { VectorDatabase } from '@/lib/ai/vector-database';
import { executeQuery, executeRun } from '@/lib/db/adapter';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

let vectorDbInstance: VectorDatabase | null = null;
let hybridSearchInstance: HybridSearchEngine | null = null;

function getHybridSearch(): HybridSearchEngine {
  if (!vectorDbInstance) {
    vectorDbInstance = new VectorDatabase();
  }
  if (!hybridSearchInstance) {
    hybridSearchInstance = new HybridSearchEngine(vectorDbInstance);
  }
  return hybridSearchInstance;
}

function parseNumberList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
}

async function saveSearchHistory(
  userId: number,
  query: string,
  filters: Record<string, unknown>,
  resultCount: number,
  mode: string
) {
  await executeRun(
    `INSERT INTO search_history (user_id, query, results_count, search_mode)
     VALUES (?, ?, ?, ?)`,
    [userId, query, resultCount, mode]
  );
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const query = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const mode = searchParams.get('mode') || 'hybrid';

    if (action === 'history') {
      const history = await executeQuery<{
        query: string;
        results_count: number | null;
        search_mode: string | null;
        created_at: string;
      }>(
        `SELECT query, results_count, search_mode, created_at
         FROM search_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [auth.userId, limit]
      );

      return NextResponse.json({ success: true, history });
    }

    if (action === 'suggestions') {
      if (!query) {
        return NextResponse.json({ success: true, suggestions: [] });
      }

      const suggestions = await executeQuery<{ query: string }>(
        `SELECT query
         FROM search_history
         WHERE user_id = ? AND LOWER(query) LIKE LOWER(?)
         GROUP BY query
         ORDER BY MAX(created_at) DESC
         LIMIT ?`,
        [auth.userId, `%${query}%`, limit]
      );

      return NextResponse.json({
        success: true,
        suggestions: suggestions.map((row) => row.query)
      });
    }

    const filters: SearchFilters = {
      query,
      categories: parseNumberList(searchParams.get('categories')),
      priorities: parseNumberList(searchParams.get('priorities')),
      statuses: parseNumberList(searchParams.get('statuses')),
      assignedTo: parseNumberList(searchParams.get('assigned_to')),
      users: parseNumberList(searchParams.get('users')),
      dateFrom: searchParams.get('date_from') || undefined,
      dateTo: searchParams.get('date_to') || undefined,
      slaStatus: (searchParams.get('sla_status') as SearchFilters['slaStatus']) || undefined,
      hasAttachments:
        searchParams.get('has_attachments') === 'true'
          ? true
          : searchParams.get('has_attachments') === 'false'
            ? false
            : undefined,
      sortBy: (searchParams.get('sort_by') as SearchFilters['sortBy']) || 'created_at',
      sortOrder: (searchParams.get('sort_order') as SearchFilters['sortOrder']) || 'DESC',
      limit,
      offset,
    };

    if (auth.role === 'user') {
      filters.users = [auth.userId];
    }

    const hybridSearch = getHybridSearch();
    const includeUsers = action === 'global' && searchParams.get('include_users') !== 'false';
    const entityTypes =
      action === 'knowledge'
        ? ['kb_article']
        : action === 'global'
          ? ['ticket', 'kb_article']
          : ['ticket'];

    const cacheKey =
      action !== 'global' && action !== 'knowledge' && query
        ? {
            search_query: query,
            ...filters,
            user_role: auth.role,
            user_id: auth.role === 'user' ? auth.userId : null,
          }
        : null;

    let searchResult: Awaited<ReturnType<HybridSearchEngine['search']>> | null =
      cacheKey
        ? await getCachedTicketSearch(cacheKey)
        : null;

    if (!searchResult) {
      searchResult = await hybridSearch.search({
        query,
        entityTypes: entityTypes as Array<'ticket' | 'kb_article' | 'comment'>,
        maxResults: limit + offset,
        threshold: mode === 'semantic' ? 0.55 : 0.6,
        semanticWeight: mode === 'keyword' ? 0 : 0.7,
        keywordWeight: mode === 'semantic' ? 0 : 0.3,
        filters,
        includeFacets: true,
        useCache: true
      });

      if (cacheKey) {
        cacheTicketSearch(cacheKey, searchResult, 60);
      }
    }

    const paginatedResults = searchResult.results.slice(offset, offset + limit);

    if (query) {
      await saveSearchHistory(auth.userId, query, filters as Record<string, unknown>, paginatedResults.length, mode);
    }

    if (action === 'global') {
      let users: Array<{ id: number; name: string; email: string; role: string }> = [];

      if (includeUsers && query && auth.organizationId) {
        users = await executeQuery(
          `SELECT id, name, email, role
           FROM users
           WHERE organization_id = ? AND (LOWER(name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))
           ORDER BY name
           LIMIT ?`,
          [auth.organizationId, `%${query}%`, `%${query}%`, Math.max(1, Math.floor(limit / 2))]
        );
      }

      return NextResponse.json({
        success: true,
        query,
        results: {
          tickets: paginatedResults.filter((r) => r.type === 'ticket'),
          articles: paginatedResults.filter((r) => r.type === 'kb_article'),
          users,
          total: paginatedResults.length + users.length
        }
      });
    }

    return NextResponse.json({
      success: true,
      query,
      filters,
      results: paginatedResults,
      total: paginatedResults.length,
      facets: searchResult.facets,
      suggestions: searchResult.suggestions,
      processingTimeMs: searchResult.processingTimeMs
    });
  } catch (error) {
    logger.error('Error in search API', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const body = await request.json();
    const {
      type = 'tickets',
      query = '',
      filters = {},
      saveToHistory = true,
      mode = 'hybrid'
    } = body;

    const effectiveFilters: SearchFilters = { ...(filters || {}), query };
    if (auth.role === 'user') {
      effectiveFilters.users = [auth.userId];
    }

    const entityTypes =
      type === 'knowledge'
        ? ['kb_article']
        : type === 'global'
          ? ['ticket', 'kb_article']
          : ['ticket'];

    const hybridSearch = getHybridSearch();
    const searchResult = await hybridSearch.search({
      query,
      entityTypes: entityTypes as Array<'ticket' | 'kb_article' | 'comment'>,
      maxResults: Number(effectiveFilters.limit || 50),
      threshold: mode === 'semantic' ? 0.55 : 0.6,
      semanticWeight: mode === 'keyword' ? 0 : 0.7,
      keywordWeight: mode === 'semantic' ? 0 : 0.3,
      filters: effectiveFilters,
      includeFacets: true,
      useCache: true
    });

    if (saveToHistory && query.trim()) {
      await saveSearchHistory(
        auth.userId,
        query.trim(),
        effectiveFilters as Record<string, unknown>,
        searchResult.total,
        mode
      );
    }

    return NextResponse.json({
      success: true,
      type,
      query,
      results: searchResult.results,
      total: searchResult.total,
      facets: searchResult.facets,
      suggestions: searchResult.suggestions,
      processingTimeMs: searchResult.processingTimeMs
    });
  } catch (error) {
    logger.error('Error in advanced search API', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
