/**
 * Service Request Detail API
 *
 * GET  /api/catalog/requests/[id] - Get service request details
 * PUT  /api/catalog/requests/[id] - Update service request status
 * DELETE /api/catalog/requests/[id] - Cancel service request
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import {
  getServiceRequestById,
  updateServiceRequestStatus,
  cancelServiceRequest,
} from '@/lib/db/queries/catalog-queries';
import { ROLES } from '@/lib/auth/roles';

/**
 * GET /api/catalog/requests/[id] - Get service request details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth!.organizationId, 'itil', 'full');
    if (featureGate) return featureGate;

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return apiError('ID invalido', 400);
    }

    const serviceRequest = await getServiceRequestById(
      auth!.organizationId,
      requestId
    );

    if (!serviceRequest) {
      return apiError('Solicitacao de servico nao encontrada', 404);
    }

    // Regular users can only see their own requests
    if (
      auth!.role === ROLES.USER &&
      serviceRequest.requester_id !== auth!.userId &&
      serviceRequest.on_behalf_of_id !== auth!.userId
    ) {
      return apiError('Acesso negado', 403);
    }

    return apiSuccess(serviceRequest);
  } catch (error) {
    return apiError('Erro ao buscar solicitacao de servico', 500);
  }
}

/**
 * PUT /api/catalog/requests/[id] - Update service request status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth!.organizationId, 'itil', 'full');
    if (featureGate) return featureGate;

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return apiError('ID invalido', 400);
    }

    // Only agents, managers, and admins can update request status
    if (auth!.role === ROLES.USER) {
      return apiError('Permissao negada', 403);
    }

    const body = await request.json();
    const { status } = body;

    if (!status || typeof status !== 'string') {
      return apiError('status e obrigatorio', 400);
    }

    const validStatuses = [
      'submitted',
      'pending_approval',
      'approved',
      'in_progress',
      'fulfilled',
      'failed',
    ];
    if (!validStatuses.includes(status)) {
      return apiError(
        `status invalido. Valores aceitos: ${validStatuses.join(', ')}`,
        400
      );
    }

    // Verify request exists and belongs to org
    const existing = await getServiceRequestById(
      auth!.organizationId,
      requestId
    );
    if (!existing) {
      return apiError('Solicitacao de servico nao encontrada', 404);
    }

    const updated = await updateServiceRequestStatus(
      auth!.organizationId,
      requestId,
      status,
      auth!.userId
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError('Erro ao atualizar solicitacao de servico', 500);
  }
}

/**
 * DELETE /api/catalog/requests/[id] - Cancel service request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const featureGate = await requireFeature(auth!.organizationId, 'itil', 'full');
    if (featureGate) return featureGate;

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) {
      return apiError('ID invalido', 400);
    }

    // Verify request exists and belongs to org
    const existing = await getServiceRequestById(
      auth!.organizationId,
      requestId
    );
    if (!existing) {
      return apiError('Solicitacao de servico nao encontrada', 404);
    }

    // Only the requester or admins/agents can cancel
    if (
      auth!.role === ROLES.USER &&
      existing.requester_id !== auth!.userId
    ) {
      return apiError('Permissao negada', 403);
    }

    // Cannot cancel already fulfilled or cancelled requests
    if (existing.status === 'fulfilled' || existing.status === 'cancelled') {
      return apiError(
        'Nao e possivel cancelar solicitacoes ja finalizadas ou canceladas',
        400
      );
    }

    const result = await cancelServiceRequest(
      auth!.organizationId,
      requestId,
      auth!.userId
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError('Erro ao cancelar solicitacao de servico', 500);
  }
}
