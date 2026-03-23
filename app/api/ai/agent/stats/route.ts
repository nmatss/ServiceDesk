import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { getDatabaseType } from '@/lib/db/config';
import { isAdmin } from '@/lib/auth/roles';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/agent/stats
 * Returns AI agent statistics: resolution rate, top intents, recent actions.
 * Requires admin role.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { auth } = guard;

  const featureGate = await requireFeature(auth.organizationId, 'ai', 'full');
  if (featureGate) return featureGate;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const orgId = auth.organizationId;
  const dbType = getDatabaseType();

  try {
    // Date boundaries
    const todayStart = dbType === 'postgresql' ? "CURRENT_DATE" : "date('now')";
    const weekAgo = dbType === 'postgresql'
      ? "NOW() - INTERVAL '7 days'"
      : "datetime('now', '-7 days')";
    const monthAgo = dbType === 'postgresql'
      ? "NOW() - INTERVAL '30 days'"
      : "datetime('now', '-30 days')";

    // Run all queries in parallel
    const [
      todayStats,
      weekStats,
      monthStats,
      topIntents,
      escalationReasons,
      recentActions,
    ] = await Promise.all([
      // Today's stats
      executeQueryOne<{ total: number; resolved: number; suggested: number; escalated: number }>(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN activity_type = 'ai_auto_resolved' THEN 1 END) as resolved,
           COUNT(CASE WHEN activity_type = 'ai_suggestion_posted' THEN 1 END) as suggested,
           COUNT(CASE WHEN activity_type = 'ai_escalated' THEN 1 END) as escalated
         FROM ticket_activities
         WHERE organization_id = ?
           AND activity_type IN ('ai_auto_resolved', 'ai_suggestion_posted', 'ai_escalated')
           AND created_at >= ${todayStart}`,
        [orgId] as SqlParam[]
      ),

      // Week stats
      executeQueryOne<{ total: number; resolved: number }>(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN activity_type = 'ai_auto_resolved' THEN 1 END) as resolved
         FROM ticket_activities
         WHERE organization_id = ?
           AND activity_type IN ('ai_auto_resolved', 'ai_suggestion_posted', 'ai_escalated')
           AND created_at >= ${weekAgo}`,
        [orgId] as SqlParam[]
      ),

      // Month stats
      executeQueryOne<{ total: number; resolved: number }>(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN activity_type = 'ai_auto_resolved' THEN 1 END) as resolved
         FROM ticket_activities
         WHERE organization_id = ?
           AND activity_type IN ('ai_auto_resolved', 'ai_suggestion_posted', 'ai_escalated')
           AND created_at >= ${monthAgo}`,
        [orgId] as SqlParam[]
      ),

      // Top intents resolved (extract intent from description)
      executeQuery<{ intent: string; count: number }>(
        dbType === 'postgresql'
          ? `SELECT
               SUBSTRING(description FROM 'Intenção: ([a-z_]+)') as intent,
               COUNT(*) as count
             FROM ticket_activities
             WHERE organization_id = $1
               AND activity_type = 'ai_auto_resolved'
               AND created_at >= ${monthAgo}
               AND description LIKE '%Intenção:%'
             GROUP BY intent
             ORDER BY count DESC
             LIMIT 10`
          : `SELECT
               SUBSTR(description,
                 INSTR(description, 'Intenção: ') + 11,
                 INSTR(SUBSTR(description, INSTR(description, 'Intenção: ') + 11), ' ') - 1
               ) as intent,
               COUNT(*) as count
             FROM ticket_activities
             WHERE organization_id = ?
               AND activity_type = 'ai_auto_resolved'
               AND created_at >= ${monthAgo}
               AND description LIKE '%Intenção:%'
             GROUP BY intent
             ORDER BY count DESC
             LIMIT 10`,
        [orgId] as SqlParam[]
      ),

      // Escalation reasons breakdown
      executeQuery<{ activity_type: string; count: number }>(
        `SELECT activity_type, COUNT(*) as count
         FROM ticket_activities
         WHERE organization_id = ?
           AND activity_type IN ('ai_auto_resolved', 'ai_suggestion_posted', 'ai_escalated')
           AND created_at >= ${monthAgo}
         GROUP BY activity_type
         ORDER BY count DESC`,
        [orgId] as SqlParam[]
      ),

      // Recent actions (last 20)
      executeQuery<{
        id: number;
        ticket_id: number;
        activity_type: string;
        description: string;
        created_at: string;
        ticket_title: string;
      }>(
        `SELECT ta.id, ta.ticket_id, ta.activity_type, ta.description, ta.created_at,
                t.title as ticket_title
         FROM ticket_activities ta
         LEFT JOIN tickets t ON ta.ticket_id = t.id
         WHERE ta.organization_id = ?
           AND ta.activity_type IN ('ai_auto_resolved', 'ai_suggestion_posted', 'ai_escalated')
         ORDER BY ta.created_at DESC
         LIMIT 20`,
        [orgId] as SqlParam[]
      ),
    ]);

    const today = todayStats ?? { total: 0, resolved: 0, suggested: 0, escalated: 0 };
    const week = weekStats ?? { total: 0, resolved: 0 };
    const month = monthStats ?? { total: 0, resolved: 0 };

    const resolutionRateToday = today.total > 0
      ? Math.round((today.resolved / today.total) * 100)
      : 0;
    const resolutionRateWeek = week.total > 0
      ? Math.round((week.resolved / week.total) * 100)
      : 0;
    const resolutionRateMonth = month.total > 0
      ? Math.round((month.resolved / month.total) * 100)
      : 0;

    return apiSuccess({
      today: {
        total: today.total,
        resolved: today.resolved,
        suggested: today.suggested,
        escalated: today.escalated,
        resolutionRate: resolutionRateToday,
      },
      week: {
        total: week.total,
        resolved: week.resolved,
        resolutionRate: resolutionRateWeek,
      },
      month: {
        total: month.total,
        resolved: month.resolved,
        resolutionRate: resolutionRateMonth,
      },
      topIntents: topIntents ?? [],
      actionBreakdown: escalationReasons ?? [],
      recentActions: recentActions ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error fetching AI agent stats: ${message}`);
    return apiError('Erro ao buscar estatísticas do Agente AI', 500);
  }
}
