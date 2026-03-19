import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeInstance } from '@/lib/billing/stripe-client';
import { updateSubscription, cancelSubscription, handlePaymentFailed } from '@/lib/billing/subscription-manager';
import { executeQueryOne } from '@/lib/db/adapter';
import { apiError } from '@/lib/api/api-helpers';

export async function POST(request: NextRequest) {
  const stripe = getStripeInstance();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return apiError('Webhook not configured', 500);
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return apiError('Missing signature', 400);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return apiError('Invalid signature', 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = Number(session.metadata?.organization_id);
        if (!Number.isFinite(orgId) || orgId <= 0) break;

        // Get subscription details
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
          const priceId = subscription.items.data[0]?.price?.id;

          // Map price ID to plan name
          const plan = mapPriceIdToPlan(priceId);

          const periodEnd = new Date(subscription.items.data[0]?.current_period_end * 1000).toISOString();
          await updateSubscription(orgId, plan, customerId, subscriptionId, periodEnd);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string;
        if (!subscriptionId) break;

        const org = await executeQueryOne<{ id: number }>(
          'SELECT id FROM organizations WHERE stripe_subscription_id = ?',
          [subscriptionId]
        );
        if (org) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
          const periodEnd = new Date(subscription.items.data[0]?.current_period_end * 1000).toISOString();
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = mapPriceIdToPlan(priceId);
          await updateSubscription(org.id, plan, undefined, undefined, periodEnd);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string;
        if (!subscriptionId) break;

        const org = await executeQueryOne<{ id: number }>(
          'SELECT id FROM organizations WHERE stripe_subscription_id = ?',
          [subscriptionId]
        );
        if (org) {
          await handlePaymentFailed(org.id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const org = await executeQueryOne<{ id: number }>(
          'SELECT id FROM organizations WHERE stripe_subscription_id = ?',
          [subscription.id]
        );
        if (org) {
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const plan = mapPriceIdToPlan(priceId);
          const periodEnd = new Date(subscription.items.data[0]?.current_period_end * 1000).toISOString();
          await updateSubscription(org.id, plan, undefined, undefined, periodEnd);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const org = await executeQueryOne<{ id: number }>(
          'SELECT id FROM organizations WHERE stripe_subscription_id = ?',
          [subscription.id]
        );
        if (org) {
          await cancelSubscription(org.id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return apiError('Webhook processing failed', 500);
  }
}

function mapPriceIdToPlan(priceId: string | undefined): string {
  if (!priceId) return 'basic';

  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_PROFESSIONAL || '']: 'professional',
    [process.env.STRIPE_PRICE_ENTERPRISE || '']: 'enterprise',
  };

  return priceMap[priceId] || 'professional';
}
