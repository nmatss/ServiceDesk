/**
 * Change Request Approval API
 *
 * POST /api/changes/[id]/approve - Approve a change request
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { approveChangeRequest } from '@/lib/db/queries/change-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth!.organizationId, 'itil', 'standard');
    if (featureGate) return featureGate;

    const { id } = await params;
    const changeId = parseInt(id, 10);
    if (isNaN(changeId)) {
      return apiError('ID invalido', 400);
    }

    const body = await request.json();

    const result = await approveChangeRequest(
      auth!.organizationId,
      changeId,
      auth!.userId,
      body.comments || ''
    );

    if (!result) {
      return apiError('Solicitacao de mudanca nao encontrada', 404);
    }

    return apiSuccess(result);
  } catch (error) {
    return apiError('Erro ao aprovar solicitacao de mudanca', 500);
  }
}
