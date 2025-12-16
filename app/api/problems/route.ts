/**
 * Problems API Route
 * GET: List problems with filters and pagination
 * POST: Create a new problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { resolveTenant } from '@/lib/tenant/resolver';
import problemQueries from '@/lib/db/queries/problem-queries';
import type {
  ProblemStatus,
  ProblemImpact,
  ProblemSourceType,
  CreateProblemInput,
  ProblemFilters,
  ProblemSortOptions,
} from '@/lib/types/problem';

export const dynamic = 'force-dynamic';

/**
 * GET /api/problems
 * List problems with filters and pagination
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
    const tenant = await resolveTenant(request);
    if (!tenant?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    // Build filters
    const filters: ProblemFilters = {};

    const status = searchParams.get('status');
    if (status) {
      filters.status = status.includes(',')
        ? (status.split(',') as ProblemStatus[])
        : (status as ProblemStatus);
    }

    const categoryId = searchParams.get('category_id');
    if (categoryId) {
      filters.category_id = parseInt(categoryId, 10);
    }

    const priorityId = searchParams.get('priority_id');
    if (priorityId) {
      filters.priority_id = parseInt(priorityId, 10);
    }

    const impact = searchParams.get('impact');
    if (impact) {
      filters.impact = impact.includes(',')
        ? (impact.split(',') as ProblemImpact[])
        : (impact as ProblemImpact);
    }

    const assignedTo = searchParams.get('assigned_to');
    if (assignedTo) {
      filters.assigned_to = parseInt(assignedTo, 10);
    }

    const assignedGroupId = searchParams.get('assigned_group_id');
    if (assignedGroupId) {
      filters.assigned_group_id = parseInt(assignedGroupId, 10);
    }

    const hasWorkaround = searchParams.get('has_workaround');
    if (hasWorkaround !== null) {
      filters.has_workaround = hasWorkaround === 'true';
    }

    const hasKnownError = searchParams.get('has_known_error');
    if (hasKnownError !== null) {
      filters.has_known_error = hasKnownError === 'true';
    }

    const sourceType = searchParams.get('source_type');
    if (sourceType) {
      filters.source_type = sourceType as ProblemSourceType;
    }

    const search = searchParams.get('search');
    if (search) {
      filters.search = search;
    }

    const createdAfter = searchParams.get('created_after');
    if (createdAfter) {
      filters.created_after = createdAfter;
    }

    const createdBefore = searchParams.get('created_before');
    if (createdBefore) {
      filters.created_before = createdBefore;
    }

    // Build sort options
    const sortField = searchParams.get('sort') || 'created_at';
    const sortDirection = searchParams.get('order') || 'desc';
    const sort: ProblemSortOptions = {
      field: sortField as any,
      direction: sortDirection as 'asc' | 'desc',
    };

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    // Fetch problems
    const result = await problemQueries.getProblems(
      tenant.organizationId,
      filters,
      sort,
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching problems:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/problems
 * Create a new problem
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

    // Only agents and admins can create problems
    if (payload.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Resolve tenant
    const tenant = await resolveTenant(request);
    if (!tenant?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Build input
    const input: CreateProblemInput = {
      title: body.title,
      description: body.description,
      category_id: body.category_id,
      priority_id: body.priority_id,
      impact: body.impact,
      urgency: body.urgency,
      source_type: body.source_type,
      source_incident_id: body.source_incident_id,
      assigned_to: body.assigned_to,
      assigned_group_id: body.assigned_group_id,
      symptoms: body.symptoms,
      affected_services: body.affected_services,
      affected_cis: body.affected_cis,
      business_impact: body.business_impact,
    };

    // Create problem
    const problem = await problemQueries.createProblem(
      tenant.organizationId,
      payload.userId,
      input
    );

    // Return created problem with relations
    const problemWithRelations = await problemQueries.getProblemById(
      tenant.organizationId,
      problem.id
    );

    return NextResponse.json(
      {
        success: true,
        data: problemWithRelations,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating problem:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
