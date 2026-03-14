import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, sqlDateSub, sqlDateAdd, sqlTrue, sqlFalse } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

interface OrgRow {
  id: number;
  name: string;
  slug: string;
  subscription_plan: string;
  subscription_status: string;
  is_active: number | boolean;
  created_at: string;
  user_count: number;
}

interface CountRow {
  count: number;
}

interface AlertItem {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      totalTickets,
      openTickets,
      ticketsLast30,
      recentOrgs,
      trialExpiring,
      inactiveWithUsers,
    ] = await Promise.all([
      executeQueryOne<CountRow>('SELECT COUNT(*) as count FROM organizations'),
      executeQueryOne<CountRow>(`SELECT COUNT(*) as count FROM organizations WHERE is_active = ${sqlTrue()}`),
      executeQueryOne<CountRow>('SELECT COUNT(*) as count FROM users'),
      executeQueryOne<CountRow>('SELECT COUNT(*) as count FROM tickets'),
      executeQueryOne<CountRow>(
        `SELECT COUNT(*) as count FROM tickets t
         JOIN statuses s ON t.status_id = s.id
         WHERE s.name IN ('open', 'new')`
      ),
      executeQueryOne<CountRow>(
        `SELECT COUNT(*) as count FROM tickets WHERE created_at >= ${sqlDateSub(30)}`
      ),
      executeQuery<OrgRow>(
        `SELECT o.*,
           (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
         FROM organizations o
         ORDER BY o.created_at DESC
         LIMIT 5`
      ),
      // Orgs with trial expiring in next 7 days
      executeQuery<{ name: string; slug: string; subscription_expires_at: string }>(
        `SELECT name, slug, subscription_expires_at
         FROM organizations
         WHERE subscription_status = 'trial'
           AND subscription_expires_at IS NOT NULL
           AND subscription_expires_at <= ${sqlDateAdd(7)}
           AND is_active = ${sqlTrue()}`
      ),
      // Inactive orgs that still have active users
      executeQuery<{ name: string; slug: string; user_count: number }>(
        `SELECT o.name, o.slug,
           (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = ${sqlTrue()}) as user_count
         FROM organizations o
         WHERE o.is_active = ${sqlFalse()}
         HAVING user_count > 0`
      ),
    ]);

    const alerts: AlertItem[] = [];

    for (const org of trialExpiring) {
      alerts.push({
        type: 'warning',
        title: 'Trial expirando',
        message: `A organização "${org.name}" (${org.slug}) tem trial expirando em ${new Date(org.subscription_expires_at).toLocaleDateString('pt-BR')}.`,
      });
    }

    for (const org of inactiveWithUsers) {
      alerts.push({
        type: 'error',
        title: 'Organização inativa com usuários',
        message: `A organização "${org.name}" (${org.slug}) está inativa mas possui ${org.user_count} usuário(s) ativo(s).`,
      });
    }

    return apiSuccess({
      stats: {
        total_orgs: totalOrgs?.count ?? 0,
        active_orgs: activeOrgs?.count ?? 0,
        total_users: totalUsers?.count ?? 0,
        total_tickets: totalTickets?.count ?? 0,
        open_tickets: openTickets?.count ?? 0,
        tickets_last_30_days: ticketsLast30?.count ?? 0,
      },
      recent_orgs: recentOrgs,
      alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    return apiError(message, 500);
  }
}
