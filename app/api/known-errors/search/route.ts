/**
 * Known Error Search API Route
 * GET: Search known errors by symptoms
 * Used for AI-powered suggestions when creating/viewing tickets
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { resolveTenantFromRequest } from '@/lib/tenant/resolver';
import problemQueries from '@/lib/db/queries/problem-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/known-errors/search
 * Search known errors by symptoms
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate via httpOnly cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Resolve tenant
    const tenant = await resolveTenantFromRequest(request);
    if (!tenant?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 400 }
      );
    }

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
      tenant.organizationId,
      searchTerms
    );

    // Filter out non-public KEs for end users
    const filteredKnownErrors = payload.role === 'user'
      ? knownErrors.filter((ke) => ke.is_public === 1)
      : knownErrors;

    return NextResponse.json({
      success: true,
      data: filteredKnownErrors,
    });
  } catch (error) {
    console.error('Error searching known errors:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
