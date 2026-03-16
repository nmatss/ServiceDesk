import { executeQueryOne, executeRun, type SqlParam } from '@/lib/db/adapter';
import { sqlStartOfMonth } from '@/lib/db/adapter';

export interface PlanLimits {
  users: number;      // -1 = unlimited
  tickets_month: number; // -1 = unlimited
  ai: boolean;
  esm: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  basic:        { users: 3,  tickets_month: 100,  ai: false, esm: false },
  starter:      { users: 3,  tickets_month: 100,  ai: false, esm: false },
  professional: { users: 15, tickets_month: 1000, ai: true,  esm: true  },
  enterprise:   { users: -1, tickets_month: -1,   ai: true,  esm: true  },
};

export interface SubscriptionInfo {
  plan: string;
  status: string;
  expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  limits: PlanLimits;
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
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;

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

export async function checkLimit(orgId: number, resource: 'users' | 'tickets'): Promise<{ allowed: boolean; message?: string }> {
  const info = await getSubscriptionStatus(orgId);

  if (resource === 'users') {
    if (info.limits.users === -1) return { allowed: true };
    if (info.usage.users >= info.limits.users) {
      return { allowed: false, message: `Limite de ${info.limits.users} usuários do plano ${info.plan} atingido. Faça upgrade para adicionar mais.` };
    }
    return { allowed: true };
  }

  if (resource === 'tickets') {
    if (info.limits.tickets_month === -1) return { allowed: true };
    if (info.usage.tickets_this_month >= info.limits.tickets_month) {
      return { allowed: false, message: `Limite de ${info.limits.tickets_month} tickets/mês do plano ${info.plan} atingido. Faça upgrade para continuar.` };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

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
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;
  setClauses += ', max_users = ?, max_tickets_per_month = ?';
  params.push(limits.users, limits.tickets_month);

  params.push(orgId);

  await executeRun(`UPDATE organizations SET ${setClauses} WHERE id = ?`, params);
}

export async function cancelSubscription(orgId: number): Promise<void> {
  await executeRun(
    `UPDATE organizations SET subscription_status = 'cancelled' WHERE id = ?`,
    [orgId]
  );
}

export async function handlePaymentFailed(orgId: number): Promise<void> {
  await executeRun(
    `UPDATE organizations SET subscription_status = 'past_due' WHERE id = ?`,
    [orgId]
  );
}
