/**
 * Known Errors (KEDB) API Route
 * GET: List known errors with filters
 * POST: Create a new known error
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { resolveTenantFromRequest } from '@/lib/tenant/resolver';
import problemQueries from '@/lib/db/queries/problem-queries';
import type {
  PermanentFixStatus,
  CreateKnownErrorInput,
  KnownErrorFilters,
} from '@/lib/types/problem';

export const dynamic = 'force-dynamic';

/**
 * GET /api/known-errors
 * List known errors with filters and pagination
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

    // Build filters
    const filters: KnownErrorFilters = {};

    const isActive = searchParams.get('is_active');
    if (isActive !== null) {
      filters.is_active = isActive === 'true';
    } else {
      // Default to showing only active known errors for regular users
      if (payload.role === 'user') {
        filters.is_active = true;
        filters.is_public = true; // Only show public KEs to end users
      }
    }

    const isPublic = searchParams.get('is_public');
    if (isPublic !== null) {
      filters.is_public = isPublic === 'true';
    }

    const permanentFixStatus = searchParams.get('permanent_fix_status');
    if (permanentFixStatus) {
      filters.permanent_fix_status = permanentFixStatus.includes(',')
        ? (permanentFixStatus.split(',') as PermanentFixStatus[])
        : (permanentFixStatus as PermanentFixStatus);
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
      tenant.organizationId,
      filters,
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching known errors:', error);
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

    // Only agents and admins can create known errors
    if (payload.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
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
      workaround_instructions: body.workaround_instructions,
      permanent_fix_status: body.permanent_fix_status,
      permanent_fix_eta: body.permanent_fix_eta,
      affected_cis: body.affected_cis,
      affected_services: body.affected_services,
      affected_versions: body.affected_versions,
      is_public: body.is_public,
    };

    // Create known error
    const knownError = await problemQueries.createKnownError(
      tenant.organizationId,
      payload.userId,
      input
    );

    // Return created known error with relations
    const knownErrorWithRelations = await problemQueries.getKnownErrorById(
      tenant.organizationId,
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
    console.error('Error creating known error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
