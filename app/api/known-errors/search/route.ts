/**
 * Known Error Search API Route
 * GET: Search known errors by symptoms
 * Used for AI-powered suggestions when creating/viewing tickets
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import problemQueries from '@/lib/db/queries/problem-queries';
import { ROLES } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

/**
 * GET /api/known-errors/search
 * Search known errors by symptoms
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const symptoms = searchParams.get('symptoms');

    if (!query && !symptoms) {
      return NextResponse.json(
        { success: false, error: 'Query parameter (q) or symptoms are required' },
        { status: 400 }
      );
    }

    // Parse search terms
    let searchTerms: string[] = [];

    if (symptoms) {
      try {
        searchTerms = JSON.parse(symptoms);
      } catch {
        searchTerms = symptoms.split(',').map((s) => s.trim());
      }
    } else if (query) {
      // Split query into words for better matching
      searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2);
    }

    if (searchTerms.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Search known errors
    const knownErrors = await problemQueries.searchKnownErrorsBySymptoms(
      auth.organizationId,
      searchTerms
    );

    // Filter out non-active KEs for end users
    const filteredKnownErrors = auth.role === ROLES.USER
      ? knownErrors.filter((ke) => ke.status === 'active')
      : knownErrors;

    return NextResponse.json({
      success: true,
      data: filteredKnownErrors,
    });
  } catch (error) {
    logger.error('Error searching known errors:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
