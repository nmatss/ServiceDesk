/**
 * CI Impact Analysis API
 *
 * POST /api/cmdb/[id]/impact-analysis - Perform recursive dependency impact analysis
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { getImpactAnalysis } from '@/lib/db/queries/cmdb-queries';

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
    const ciId = parseInt(id, 10);
    if (isNaN(ciId)) {
      return apiError('ID invalido', 400);
    }

    const analysis = await getImpactAnalysis(auth!.organizationId, ciId);

    return apiSuccess(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao realizar analise de impacto';
    if (error instanceof Error && error.message.includes('not found')) {
      return apiError(message, 404);
    }
    return apiError(message, 500);
  }
}
