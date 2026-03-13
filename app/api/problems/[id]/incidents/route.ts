/**
 * Problem Incidents API Route
 * GET: List incidents linked to a problem
 * POST: Link an incident to a problem
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import problemQueries from '@/lib/db/queries/problem-queries';
import type { LinkIncidentInput } from '@/lib/types/problem';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/problems/[id]/incidents
 * List incidents linked to a problem
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

    // Fetch linked incidents
    const incidents = await problemQueries.getProblemIncidents(
      auth.organizationId,
      problemId
    );

    return NextResponse.json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    logger.error('Error fetching problem incidents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/problems/[id]/incidents
 * Link an incident to a problem
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

    // Only agents and admins can link incidents
    if (auth.role === 'user') {
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

    if (!body.ticket_id) {
      return NextResponse.json(
        { success: false, error: 'ticket_id is required' },
        { status: 400 }
      );
    }

    const input: LinkIncidentInput = {
      ticket_id: body.ticket_id,
      relationship_type: body.relationship_type || 'caused_by',
      notes: body.notes,
    };

    // Link incident
    const link = await problemQueries.linkIncidentToProblem(
      auth.organizationId,
      problemId,
      auth.userId,
      input
    );

    return NextResponse.json(
      {
        success: true,
        data: link,
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { success: false, error: 'Incident is already linked to this problem' },
        { status: 409 }
      );
    }

    logger.error('Error linking incident to problem:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/problems/[id]/incidents
 * Unlink an incident from a problem
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

    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    // Only agents and admins can unlink incidents
    if (auth.role === 'user') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get ticket_id from query params
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: 'ticket_id query parameter is required' },
        { status: 400 }
      );
    }

    // Unlink incident
    const unlinked = await problemQueries.unlinkIncidentFromProblem(
      auth.organizationId,
      problemId,
      parseInt(ticketId, 10)
    );

    if (!unlinked) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Incident unlinked successfully',
    });
  } catch (error) {
    logger.error('Error unlinking incident from problem:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
