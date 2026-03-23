import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, sqlDateSub, getDbType } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { conversationEngine } from '@/lib/ai/conversation-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/conversation/stats
 * Conversation statistics: deflection rate, volume, categories
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ANALYTICS);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth.organizationId, 'ai', 'copilot');
    if (featureGate) return featureGate;

    const orgId = auth.organizationId;

    // Active sessions count
    const activeSessions = conversationEngine.getActiveSessions(orgId);
    const activeCount = activeSessions.length;

    // Deflection events from analytics
    const deflectionToday = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM analytics_events
       WHERE organization_id = ?
         AND event_type = 'conversation_deflection'
         AND created_at >= ${sqlDateSub(1)}`,
      [orgId]
    );

    const deflectionWeek = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM analytics_events
       WHERE organization_id = ?
         AND event_type = 'conversation_deflection'
         AND created_at >= ${sqlDateSub(7)}`,
      [orgId]
    );

    const deflectionMonth = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM analytics_events
       WHERE organization_id = ?
         AND event_type = 'conversation_deflection'
         AND created_at >= ${sqlDateSub(30)}`,
      [orgId]
    );

    // Tickets created via conversation (look for pattern in description)
    const ticketsFromChat = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM tickets
       WHERE organization_id = ?
         AND description LIKE '%Assistente Virtual%'
         AND created_at >= ${sqlDateSub(30)}`,
      [orgId]
    );

    const totalConversations = (deflectionMonth?.count || 0) + (ticketsFromChat?.count || 0);
    const deflectionRate = totalConversations > 0
      ? Math.round(((deflectionMonth?.count || 0) / totalConversations) * 100)
      : 0;

    // Top categories from deflection events
    // Use database-appropriate JSON extraction
    const jsonExtract = getDbType() === 'postgresql'
      ? "event_data::json->>'category'"
      : "JSON_EXTRACT(event_data, '$.category')";

    const topCategories = await executeQuery<{ category: string; count: number }>(
      `SELECT
         ${jsonExtract} as category,
         COUNT(*) as count
       FROM analytics_events
       WHERE organization_id = ?
         AND event_type = 'conversation_deflection'
         AND created_at >= ${sqlDateSub(30)}
         AND ${jsonExtract} IS NOT NULL
       GROUP BY ${jsonExtract}
       ORDER BY count DESC
       LIMIT 5`,
      [orgId]
    ).catch(() => [] as { category: string; count: number }[]);

    // Average messages per active session
    const avgMessages = activeSessions.length > 0
      ? Math.round(activeSessions.reduce((sum, s) => sum + s.messages.length, 0) / activeSessions.length)
      : 0;

    return apiSuccess({
      active_sessions: activeCount,
      deflections: {
        today: deflectionToday?.count || 0,
        week: deflectionWeek?.count || 0,
        month: deflectionMonth?.count || 0,
      },
      tickets_from_chat: ticketsFromChat?.count || 0,
      deflection_rate: deflectionRate,
      avg_messages_per_session: avgMessages,
      top_categories: topCategories,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno';
    return apiError(`Erro ao buscar estatísticas: ${errorMessage}`, 500);
  }
}
