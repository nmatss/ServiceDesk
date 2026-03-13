/**
 * Known Errors (KEDB) API Route
 * GET: List known errors with filters
 * POST: Create a new known error
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import problemQueries from '@/lib/db/queries/problem-queries';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import type {
  KnownErrorStatus,
  CreateKnownErrorInput,
  KnownErrorFilters,
} from '@/lib/types/problem';

export const dynamic = 'force-dynamic';

/**
 * GET /api/known-errors
 * List known errors with filters and pagination
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

    // Build filters
    const filters: KnownErrorFilters = {};

    const status = searchParams.get('status');
    if (status) {
      filters.status = status.includes(',')
        ? (status.split(',') as KnownErrorStatus[])
        : (status as KnownErrorStatus);
    } else {
      // Default to showing only active known errors for regular users
      if (auth.role === 'user') {
        filters.status = 'active';
      }
    }

    const problemId = searchParams.get('problem_id');
    if (problemId) {
      filters.problem_id = parseInt(problemId, 10);
    }

    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // Fetch known errors
    const result = await problemQueries.getKnownErrors(
      auth.organizationId,
      filters,
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error fetching known errors:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/known-errors
 * Create a new known error
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    // Only agents and admins can create known errors
    if (auth.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.description || !body.symptoms || !body.root_cause || !body.workaround) {
      return NextResponse.json(
        {
          success: false,
          error: 'title, description, symptoms, root_cause, and workaround are required',
        },
        { status: 400 }
      );
    }

    // Validate symptoms is an array
    if (!Array.isArray(body.symptoms) || body.symptoms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'symptoms must be a non-empty array' },
        { status: 400 }
      );
    }

    // Build input
    const input: CreateKnownErrorInput = {
      title: body.title,
      description: body.description,
      problem_id: body.problem_id,
      symptoms: body.symptoms,
      root_cause: body.root_cause,
      workaround: body.workaround,
      permanent_fix: body.permanent_fix,
      status: body.status,
      affected_cis: body.affected_cis,
    };

    // Create known error
    const knownError = await problemQueries.createKnownError(
      auth.organizationId,
      auth.userId,
      input
    );

    // Return created known error with relations
    const knownErrorWithRelations = await problemQueries.getKnownErrorById(
      auth.organizationId,
      knownError.id
    );

    return NextResponse.json(
      {
        success: true,
        data: knownErrorWithRelations,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating known error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
