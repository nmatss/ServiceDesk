import { NextRequest } from 'next/server'
import { executeQueryOne } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin } from '@/lib/auth/roles';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Verificar se é admin
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    // Buscar estatísticas FILTRADAS POR TENANT
    const totalUsers = await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [tenantId])

    const totalTickets = await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM tickets WHERE tenant_id = ?', [tenantId])

    const openTickets = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE t.tenant_id = ? AND s.is_final = 0
    `, [tenantId, tenantId])

    const resolvedTickets = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE t.tenant_id = ? AND s.is_final = 1
    `, [tenantId, tenantId])

    const stats = {
      totalUsers: totalUsers?.count ?? 0,
      totalTickets: totalTickets?.count ?? 0,
      openTickets: openTickets?.count ?? 0,
      resolvedTickets: resolvedTickets?.count ?? 0
    }

    return apiSuccess(stats);
  } catch (error) {
    logger.error('Error fetching stats', error)
    return apiError('Erro interno do servidor', 500);
  }
}
