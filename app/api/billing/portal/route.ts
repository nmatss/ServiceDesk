import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { createPortalSession } from '@/lib/billing/stripe-client';
import { getSubscriptionStatus } from '@/lib/billing/subscription-manager';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.BILLING);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  try {
    const info = await getSubscriptionStatus(guard.auth.organizationId);

    if (!info.stripe_customer_id) {
      return apiError('No Stripe customer found. Please subscribe to a plan first.', 400);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await createPortalSession(
      info.stripe_customer_id,
      `${appUrl}/admin/billing`
    );

    return apiSuccess({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return apiError('Failed to create portal session', 500);
  }
}
