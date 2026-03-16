/**
 * Service Request Approval API
 *
 * POST /api/catalog/requests/[id]/approve - Approve a service request
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { approveServiceRequest } from '@/lib/db/queries/catalog-queries';

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

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return apiError('ID invalido', 400);
    }

    const body = await request.json();

    const result = await approveServiceRequest(
      auth!.organizationId,
      requestId,
      auth!.userId,
      body.comments || ''
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError('Erro ao aprovar solicitacao de servico', 500);
  }
}
