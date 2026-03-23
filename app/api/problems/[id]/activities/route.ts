/**
 * Problem Activities API Route
 * GET: List activities/timeline for a problem
 * POST: Add a comment/activity to a problem
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import problemQueries from '@/lib/db/queries/problem-queries';
import { ROLES } from '@/lib/auth/roles';
import type { AddActivityInput } from '@/lib/types/problem';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/problems/[id]/activities
 * List activities/timeline for a problem
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

    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    const featureGate = await requireFeature(auth.organizationId, 'itil', 'standard');
    if (featureGate) return featureGate;

    // Verify problem exists
    const problem = await problemQueries.getProblemById(
      auth.organizationId,
      problemId
    );

    if (!problem) {
      return NextResponse.json(
        { success: false, error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Determine if user can see internal notes
    const includeInternal = auth.role !== ROLES.USER;

    // Fetch activities
    const activities = await problemQueries.getProblemActivities(
      auth.organizationId,
      problemId,
      includeInternal
    );

    return NextResponse.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('Error fetching problem activities:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/problems/[id]/activities
 * Add a comment/activity to a problem
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    const featureGate = await requireFeature(auth.organizationId, 'itil', 'standard');
    if (featureGate) return featureGate;

    // Only agents and admins can add activities
    if (auth.role === ROLES.USER) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Verify problem exists
    const problem = await problemQueries.getProblemById(
      auth.organizationId,
      problemId
    );

    if (!problem) {
      return NextResponse.json(
        { success: false, error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();

    if (!body.description) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      );
    }

    const input: AddActivityInput = {
      type: body.activity_type || body.type || 'note',
      description: body.description,
      old_value: body.old_value,
      new_value: body.new_value,
      is_internal: body.is_internal !== false, // Default to internal
    };

    // Add activity
    const activity = await problemQueries.addProblemActivity(
      auth.organizationId,
      problemId,
      auth.userId,
      input
    );

    return NextResponse.json(
      {
        success: true,
        data: activity,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error adding problem activity:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
