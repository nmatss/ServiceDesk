import Stripe from 'stripe';

const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (IS_BUILD_TIME) {
      return null as unknown as Stripe;
    }
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });
}

let _stripe: Stripe | null = null;

export function getStripeInstance(): Stripe {
  if (!_stripe) {
    _stripe = getStripe();
  }
  return _stripe;
}

export async function createCheckoutSession(
  orgId: number,
  priceId: string,
  customerId: string | undefined,
  successUrl: string,
  cancelUrl: string,
  quantity?: number
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeInstance();
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: quantity || 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: customerId || undefined,
    metadata: { organization_id: String(orgId) },
    allow_promotion_codes: true,
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeInstance();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripeInstance();
  return stripe.subscriptions.retrieve(subscriptionId);
}
