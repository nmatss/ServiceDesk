import { executeQueryOne, executeRun, type SqlParam } from '@/lib/db/adapter';
import { sqlStartOfMonth } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { PLAN_FEATURES, resolvePlanTier, getLegacyLimits, type LegacyPlanLimits } from './plans';
import { invalidateFeatureCache } from './feature-gate';

// ─── Legacy interface (used by existing billing status/admin pages) ─────────

export type { LegacyPlanLimits as PlanLimits };

/**
 * Legacy PLAN_LIMITS for backwards compatibility.
 * New code should use PLAN_FEATURES from plans.ts directly.
 */
export const PLAN_LIMITS: Record<string, LegacyPlanLimits> = {
  basic:        getLegacyLimits('basic'),
  starter:      getLegacyLimits('starter'),
  essencial:    getLegacyLimits('essencial'),
  professional: getLegacyLimits('professional'),
  enterprise:   getLegacyLimits('enterprise'),
};

// ─── Subscription Info ──────────────────────────────────────────────────────

export interface SubscriptionInfo {
  plan: string;
  status: string;
  expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  limits: LegacyPlanLimits;
  usage: {
    users: number;
    tickets_this_month: number;
  };
}

export async function getSubscriptionStatus(orgId: number): Promise<SubscriptionInfo> {
  const org = await executeQueryOne<{
    subscription_plan: string;
    subscription_status: string;
    subscription_expires_at: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }>(`
    SELECT subscription_plan, subscription_status, subscription_expires_at,
           stripe_customer_id, stripe_subscription_id
    FROM organizations WHERE id = ?
  `, [orgId]);

  const plan = org?.subscription_plan || 'basic';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  // Get current usage
  const userCount = await executeQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = true',
    [orgId]
  );

  const ticketCount = await executeQueryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM tickets
    WHERE tenant_id = ? AND created_at >= ${sqlStartOfMonth()}
  `, [orgId]);

  return {
    plan,
    status: org?.subscription_status || 'active',
    expires_at: org?.subscription_expires_at || null,
    stripe_customer_id: org?.stripe_customer_id || null,
    stripe_subscription_id: org?.stripe_subscription_id || null,
    limits,
    usage: {
      users: userCount?.count || 0,
      tickets_this_month: ticketCount?.count || 0,
    },
  };
}

// ─── Limit Checking ─────────────────────────────────────────────────────────

export async function checkLimit(orgId: number, resource: 'users' | 'tickets'): Promise<{ allowed: boolean; message?: string }> {
  const info = await getSubscriptionStatus(orgId);

  if (resource === 'users') {
    if (info.limits.users === -1) return { allowed: true };
    if (info.usage.users >= info.limits.users) {
      return { allowed: false, message: `Limite de ${info.limits.users} usuarios do plano ${info.plan} atingido. Faca upgrade para adicionar mais.` };
    }
    return { allowed: true };
  }

  if (resource === 'tickets') {
    if (info.limits.tickets_month === -1) return { allowed: true };
    if (info.usage.tickets_this_month >= info.limits.tickets_month) {
      return { allowed: false, message: `Limite de ${info.limits.tickets_month} tickets/mes do plano ${info.plan} atingido. Faca upgrade para continuar.` };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

// ─── Subscription Updates ───────────────────────────────────────────────────

export async function updateSubscription(
  orgId: number,
  plan: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  expiresAt?: string
): Promise<void> {
  const params: SqlParam[] = [plan, 'active'];
  let setClauses = 'subscription_plan = ?, subscription_status = ?';

  if (stripeCustomerId) {
    setClauses += ', stripe_customer_id = ?';
    params.push(stripeCustomerId);
  }
  if (stripeSubscriptionId) {
    setClauses += ', stripe_subscription_id = ?';
    params.push(stripeSubscriptionId);
  }
  if (expiresAt) {
    setClauses += ', subscription_expires_at = ?';
    params.push(expiresAt);
  }

  // Update max_users and max_tickets_per_month based on plan
  const tier = resolvePlanTier(plan);
  const features = PLAN_FEATURES[tier];
  setClauses += ', max_users = ?, max_tickets_per_month = ?';
  params.push(features.maxAgents, features.ticketsPerMonth);

  params.push(orgId);

  await executeRun(`UPDATE organizations SET ${setClauses} WHERE id = ?`, params);

  // Invalidate feature gate cache so new plan takes effect immediately
  invalidateFeatureCache(orgId);

  logger.info('Subscription updated', { orgId, plan, stripeCustomerId, stripeSubscriptionId });

  // Audit log
  try {
    await executeRun(
      `INSERT INTO audit_logs (organization_id, tenant_id, entity_type, entity_id, action, new_values)
       VALUES (?, ?, 'organization', ?, 'subscription_update', ?)`,
      [orgId, orgId, orgId, JSON.stringify({ plan, stripeCustomerId, stripeSubscriptionId, expiresAt })]
    );
  } catch (err) {
    logger.warn('Failed to write subscription audit log', err);
  }
}

export async function cancelSubscription(orgId: number): Promise<void> {
  await executeRun(
    `UPDATE organizations SET subscription_status = 'cancelled' WHERE id = ?`,
    [orgId]
  );

  invalidateFeatureCache(orgId);
  logger.info('Subscription cancelled', { orgId });

  try {
    await executeRun(
      `INSERT INTO audit_logs (organization_id, tenant_id, entity_type, entity_id, action, new_values)
       VALUES (?, ?, 'organization', ?, 'subscription_cancel', '{}')`,
      [orgId, orgId, orgId]
    );
  } catch (err) {
    logger.warn('Failed to write subscription cancel audit log', err);
  }
}

export async function handlePaymentFailed(orgId: number): Promise<void> {
  await executeRun(
    `UPDATE organizations SET subscription_status = 'past_due' WHERE id = ?`,
    [orgId]
  );

  invalidateFeatureCache(orgId);
  logger.info('Payment failed', { orgId });

  try {
    await executeRun(
      `INSERT INTO audit_logs (organization_id, tenant_id, entity_type, entity_id, action, new_values)
       VALUES (?, ?, 'organization', ?, 'payment_failed', '{}')`,
      [orgId, orgId, orgId]
    );
  } catch (err) {
    logger.warn('Failed to write payment failed audit log', err);
  }
}
