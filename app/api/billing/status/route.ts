import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { getSubscriptionStatus } from '@/lib/billing/subscription-manager';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.BILLING);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  try {
    const status = await getSubscriptionStatus(guard.auth.organizationId);
    return apiSuccess(status);
  } catch (error) {
    console.error('Billing status error:', error);
    return apiError('Failed to get billing status', 500);
  }
}
