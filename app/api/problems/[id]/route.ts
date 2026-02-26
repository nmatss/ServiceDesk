/**
 * Problem Detail API Route
 * GET: Get problem by ID
 * PUT: Update problem
 * DELETE: Delete problem
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/auth-service';
import { resolveTenantFromRequest } from '@/lib/tenant/resolver';
import problemQueries from '@/lib/db/queries/problem-queries';
import type { UpdateProblemInput } from '@/lib/types/problem';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/problems/[id]
 * Get problem by ID with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { id } = await params;
    const problemId = parseInt(id, 10);

    if (isNaN(problemId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid problem ID' },
        { status: 400 }
      );
    }

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

    // Fetch problem
    const problem = await problemQueries.getProblemById(
      tenant.organizationId,
      problemId
    );

    if (!problem) {
      return NextResponse.json(
        { success: false, error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Fetch activities and incidents
    const [activities, incidents] = await Promise.all([
      problemQueries.getProblemActivities(
        tenant.organizationId,
        problemId,
        payload.role !== 'user' // Include internal notes for agents/admins
      ),
      problemQueries.getProblemIncidents(tenant.organizationId, problemId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...problem,
        activities,
        incidents,
      },
    });
  } catch (error) {
    logger.error('Error fetching problem:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/problems/[id]
 * Update problem
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { id } = await params;
    const problemId = parseInt(id, 10);

    if (isNaN(problemId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid problem ID' },
        { status: 400 }
      );
    }

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

    // Only agents and admins can update problems
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

    // Check if problem exists
    const existingProblem = await problemQueries.getProblemById(
      tenant.organizationId,
      problemId
    );

    if (!existingProblem) {
      return NextResponse.json(
        { success: false, error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Build update input
    const input: UpdateProblemInput = {};

    if (body.title !== undefined) input.title = body.title;
    if (body.description !== undefined) input.description = body.description;
    if (body.status !== undefined) input.status = body.status;
    if (body.category_id !== undefined) input.category_id = body.category_id;
    if (body.priority_id !== undefined) input.priority_id = body.priority_id;
    if (body.impact !== undefined) input.impact = body.impact;
    if (body.urgency !== undefined) input.urgency = body.urgency;
    if (body.root_cause !== undefined) input.root_cause = body.root_cause;
    if (body.root_cause_category !== undefined) input.root_cause_category = body.root_cause_category;
    if (body.workaround !== undefined) input.workaround = body.workaround;
    if (body.resolution !== undefined) input.resolution = body.resolution;
    if (body.assigned_to !== undefined) input.assigned_to = body.assigned_to;
    if (body.assigned_group_id !== undefined) input.assigned_group_id = body.assigned_group_id;
    if (body.affected_services !== undefined) input.affected_services = body.affected_services;

    // Update problem
    const updatedProblem = await problemQueries.updateProblem(
      tenant.organizationId,
      problemId,
      payload.userId ?? 0,
      input
    );

    return NextResponse.json({
      success: true,
      data: updatedProblem,
    });
  } catch (error) {
    logger.error('Error updating problem:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/problems/[id]
 * Delete problem (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { id } = await params;
    const problemId = parseInt(id, 10);

    if (isNaN(problemId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid problem ID' },
        { status: 400 }
      );
    }

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

    // Only admins can delete problems
    const adminRoles = ['admin', 'super_admin', 'tenant_admin'];
    if (!adminRoles.includes(payload.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
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

    // Delete problem
    const deleted = await problemQueries.deleteProblem(
      tenant.organizationId,
      problemId
    );

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Problem not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Problem deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting problem:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
