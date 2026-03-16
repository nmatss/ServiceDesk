import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { createCheckoutSession } from '@/lib/billing/stripe-client';
import { getSubscriptionStatus } from '@/lib/billing/subscription-manager';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.BILLING);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  try {
    const { priceId } = await request.json();

    if (!priceId) {
      return apiError('priceId is required', 400);
    }

    const info = await getSubscriptionStatus(guard.auth.organizationId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await createCheckoutSession(
      guard.auth.organizationId,
      priceId,
      info.stripe_customer_id || undefined,
      `${appUrl}/admin/billing?success=true`,
      `${appUrl}/admin/billing?cancelled=true`
    );

    return apiSuccess({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return apiError('Failed to create checkout session', 500);
  }
}
