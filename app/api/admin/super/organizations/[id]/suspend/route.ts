import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

/**
 * POST /api/admin/super/organizations/[id]/suspend
 * Alterna o estado de suspensão de uma organização (suspender/reativar)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId) || orgId <= 0) {
      return apiError('ID de organização inválido', 400);
    }

    if (orgId === 1) {
      return apiError('Não é permitido suspender a organização principal do sistema', 403);
    }

    const org = await executeQueryOne<{
      id: number;
      is_active: number;
      subscription_status: string;
      name: string;
    }>(
      'SELECT id, is_active, subscription_status, name FROM organizations WHERE id = ?',
      [orgId]
    );

    if (!org) {
      return apiError('Organização não encontrada', 404);
    }

    const isCurrentlyActive = org.is_active === 1 || org.is_active === true as unknown as number;
    const newIsActive = isCurrentlyActive ? 0 : 1;
    const newStatus = isCurrentlyActive ? 'suspended' : 'active';

    const now = sqlNow();
    await executeRun(
      `UPDATE organizations SET is_active = ?, subscription_status = ?, updated_at = ${now} WHERE id = ?`,
      [newIsActive, newStatus, orgId]
    );

    const action = isCurrentlyActive ? 'suspensa' : 'reativada';

    return apiSuccess({
      id: orgId,
      name: org.name,
      is_active: newIsActive,
      subscription_status: newStatus,
      message: `Organização "${org.name}" ${action} com sucesso`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao alterar status da organização: ${message}`, 500);
  }
}
