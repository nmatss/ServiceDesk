import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { conversationEngine } from '@/lib/ai/conversation-engine';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ai/conversation/[id]
 * Get conversation history by session_id
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth.organizationId, 'ai', 'copilot');
    if (featureGate) return featureGate;

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return apiError('ID da sessão é obrigatório', 400);
    }

    const session = conversationEngine.getSession(id);

    if (!session) {
      return apiError('Sessão não encontrada', 404);
    }

    // Verify the session belongs to this user/org
    if (session.organizationId !== auth.organizationId || session.userId !== auth.userId) {
      return apiError('Acesso negado', 403);
    }

    return apiSuccess({
      session_id: session.sessionId,
      state: session.state,
      entities: session.entities,
      messages: session.messages.map(m => ({
        role: m.role,
        text: m.text,
        type: m.type,
        timestamp: m.timestamp.toISOString(),
        data: m.data,
      })),
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      ticket_id: session.createdTicketId,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno';
    return apiError(`Erro ao buscar sessão: ${errorMessage}`, 500);
  }
}

/**
 * DELETE /api/ai/conversation/[id]
 * End conversation / cleanup
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth.organizationId, 'ai', 'copilot');
    if (featureGate) return featureGate;

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return apiError('ID da sessão é obrigatório', 400);
    }

    const session = conversationEngine.getSession(id);

    if (session) {
      // Verify ownership
      if (session.organizationId !== auth.organizationId || session.userId !== auth.userId) {
        return apiError('Acesso negado', 403);
      }
    }

    const deleted = conversationEngine.endSession(id);

    return apiSuccess({ deleted, session_id: id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno';
    return apiError(`Erro ao encerrar sessão: ${errorMessage}`, 500);
  }
}
