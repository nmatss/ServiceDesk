/**
 * MFA Status API
 *
 * GET /api/auth/mfa/status - Get current MFA status for the authenticated user
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { mfaManager } from '@/lib/auth/mfa-manager';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const status = await mfaManager.getMFAStatus(auth!.userId);

    return apiSuccess(status);
  } catch (error) {
    return apiError('Erro ao obter status MFA', 500);
  }
}
