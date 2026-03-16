import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeInstance } from '@/lib/billing/stripe-client';
import { updateSubscription, cancelSubscription, handlePaymentFailed } from '@/lib/billing/subscription-manager';
import { executeQueryOne } from '@/lib/db/adapter';

export async function POST(request: NextRequest) {
  const stripe = getStripeInstance();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        const orgId = parseInt(session.metadata?.organization_id, 10);
        if (!orgId) break;

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
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
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
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
