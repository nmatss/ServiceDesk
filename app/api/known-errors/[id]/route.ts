/**
 * Known Error Detail API Route
 * GET: Get known error by ID
 * PUT: Update known error
 * DELETE: Delete known error
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/auth-service';
import { resolveTenantFromRequest } from '@/lib/tenant/resolver';
import problemQueries from '@/lib/db/queries/problem-queries';
import type { UpdateKnownErrorInput } from '@/lib/types/problem';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/known-errors/[id]
 * Get known error by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { id } = await params;
    const knownErrorId = parseInt(id, 10);

    if (isNaN(knownErrorId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid known error ID' },
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

    // Fetch known error
    const knownError = await problemQueries.getKnownErrorById(
      tenant.organizationId,
      knownErrorId
    );

    if (!knownError) {
      return NextResponse.json(
        { success: false, error: 'Known error not found' },
        { status: 404 }
      );
    }

    // Check visibility for end users - only show active known errors
    if (payload.role === 'user' && knownError.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Known error not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: knownError,
    });
  } catch (error) {
    logger.error('Error fetching known error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/known-errors/[id]
 * Update known error
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { id } = await params;
    const knownErrorId = parseInt(id, 10);

    if (isNaN(knownErrorId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid known error ID' },
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

    // Only agents and admins can update known errors
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

    // Check if known error exists
    const existingKnownError = await problemQueries.getKnownErrorById(
      tenant.organizationId,
      knownErrorId
    );

    if (!existingKnownError) {
      return NextResponse.json(
        { success: false, error: 'Known error not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Build update input
    const input: UpdateKnownErrorInput = {};

    if (body.title !== undefined) input.title = body.title;
    if (body.description !== undefined) input.description = body.description;
    if (body.symptoms !== undefined) input.symptoms = body.symptoms;
    if (body.root_cause !== undefined) input.root_cause = body.root_cause;
    if (body.workaround !== undefined) input.workaround = body.workaround;
    if (body.permanent_fix !== undefined) input.permanent_fix = body.permanent_fix;
    if (body.status !== undefined) input.status = body.status;
    if (body.affected_cis !== undefined) input.affected_cis = body.affected_cis;

    // Update known error
    const updatedKnownError = await problemQueries.updateKnownError(
      tenant.organizationId,
      knownErrorId,
      input
    );

    return NextResponse.json({
      success: true,
      data: updatedKnownError,
    });
  } catch (error) {
    logger.error('Error updating known error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/known-errors/[id]
 * Delete known error (admin only - usually we just deactivate)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { id } = await params;
    const knownErrorId = parseInt(id, 10);

    if (isNaN(knownErrorId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid known error ID' },
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

    // Only admins can delete known errors
    if (payload.role !== 'admin') {
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

    // Instead of deleting, retire the known error
    await problemQueries.updateKnownError(
      tenant.organizationId,
      knownErrorId,
      { status: 'retired' }
    );

    return NextResponse.json({
      success: true,
      message: 'Known error retired successfully',
    });
  } catch (error) {
    logger.error('Error deleting known error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
