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
    const { priceId, planTier, billingPeriod } = await request.json();

    // Support new format: planTier + billingPeriod
    let resolvedPriceId = priceId;
    if (!resolvedPriceId && planTier) {
      const priceMap: Record<string, Record<string, string | undefined>> = {
        essencial: { monthly: process.env.STRIPE_PRICE_ESSENCIAL_MONTHLY, yearly: process.env.STRIPE_PRICE_ESSENCIAL_YEARLY },
        professional: { monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || process.env.STRIPE_PRICE_PROFESSIONAL, yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY },
        enterprise: { monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || process.env.STRIPE_PRICE_ENTERPRISE, yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY },
      };
      resolvedPriceId = priceMap[planTier]?.[billingPeriod || 'monthly'];
    }

    if (!resolvedPriceId) {
      return apiError('priceId or planTier is required', 400);
    }

    const info = await getSubscriptionStatus(guard.auth.organizationId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      console.error('NEXT_PUBLIC_APP_URL is not configured');
      return apiError('Server configuration error: APP_URL not set', 500);
    }

    const session = await createCheckoutSession(
      guard.auth.organizationId,
      resolvedPriceId,
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
