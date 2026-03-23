import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { autonomousAgent } from '@/lib/ai/autonomous-agent';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/agent/resolve
 * Trigger the autonomous AI agent to process a specific ticket.
 *
 * Body: { ticket_id: number }
 * Returns: AgentResult with action taken, confidence, and response.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_CLASSIFY);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { auth } = guard;

  const featureGate = await requireFeature(auth.organizationId, 'ai', 'full');
  if (featureGate) return featureGate;

  try {
    const body = await request.json();
    const ticketId = body?.ticket_id;

    if (!ticketId || typeof ticketId !== 'number' || ticketId <= 0) {
      return apiError('ticket_id é obrigatório e deve ser um número positivo', 400);
    }

    const result = await autonomousAgent.processTicket(auth.organizationId, ticketId);

    logger.info(`AI Agent resolve endpoint called for ticket #${ticketId}`, {
      type: 'ai_agent',
      ticketId,
      orgId: auth.organizationId,
      userId: auth.userId,
      resolved: result.resolved,
      action: result.action_taken,
    });

    return apiSuccess(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`AI Agent resolve endpoint error: ${message}`, { error: message });
    return apiError('Erro interno ao processar ticket com Agente AI', 500);
  }
}
