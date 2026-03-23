import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { conversationEngine } from '@/lib/ai/conversation-engine';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/conversation
 * Start or continue a conversation session
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AI_SUGGEST);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth.organizationId, 'ai', 'copilot');
    if (featureGate) return featureGate;

    const body = await request.json();
    const { session_id, message } = body as { session_id?: string; message?: string };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return apiError('Mensagem é obrigatória', 400);
    }

    if (message.length > 2000) {
      return apiError('Mensagem muito longa (máximo 2000 caracteres)', 400);
    }

    const sessionId = session_id || uuidv4();

    const result = await conversationEngine.processMessage(
      auth.organizationId,
      auth.userId,
      sessionId,
      message.trim()
    );

    return apiSuccess({
      session_id: sessionId,
      response: result.response,
      state: result.state,
      extracted_entities: result.entities,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno';
    return apiError(`Erro ao processar mensagem: ${errorMessage}`, 500);
  }
}
