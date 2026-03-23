/**
 * CI History API
 *
 * GET /api/cmdb/[id]/history - Get audit history for a configuration item
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { getCIHistory } from '@/lib/db/queries/cmdb-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth!.organizationId, 'itil', 'full');
    if (featureGate) return featureGate;

    const { id } = await params;
    const ciId = parseInt(id, 10);
    if (isNaN(ciId)) {
      return apiError('ID invalido', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10) || 50,
      100
    );

    const history = await getCIHistory(auth!.organizationId, ciId, limit);

    return apiSuccess(history);
  } catch (error) {
    return apiError('Erro ao buscar historico do item de configuracao', 500);
  }
}
