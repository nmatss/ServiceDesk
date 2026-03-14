import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, sqlDateSub } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

/**
 * GET /api/admin/super/organizations/[id]/stats
 * Métricas detalhadas de uma organização
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId) || orgId <= 0) {
      return apiError('ID de organização inválido', 400);
    }

    const org = await executeQueryOne<{ id: number; name: string }>(
      'SELECT id, name FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!org) {
      return apiError('Organização não encontrada', 404);
    }

    const [ticketsByStatus, usersByRole, recentTickets] = await Promise.all([
      executeQuery<{ status_name: string; count: number }>(
        `SELECT
          s.name as status_name,
          COUNT(t.id) as count
        FROM statuses s
        LEFT JOIN tickets t ON t.status_id = s.id AND t.organization_id = ?
        GROUP BY s.id, s.name
        ORDER BY s.id`,
        [orgId]
      ),

      executeQuery<{ role: string; count: number }>(
        `SELECT
          role,
          COUNT(*) as count
        FROM users
        WHERE organization_id = ?
        GROUP BY role
        ORDER BY role`,
        [orgId]
      ),

      executeQueryOne<{ count: number }>(
        `SELECT COUNT(*) as count
        FROM tickets
        WHERE organization_id = ?
          AND created_at >= ${sqlDateSub(30)}`,
        [orgId]
      ),
    ]);

    const totalUsers = usersByRole.reduce((sum, r) => sum + r.count, 0);
    const totalTickets = ticketsByStatus.reduce((sum, s) => sum + s.count, 0);

    return apiSuccess({
      organization_id: orgId,
      organization_name: org.name,
      tickets: {
        total: totalTickets,
        by_status: ticketsByStatus,
        last_30_days: recentTickets?.count || 0,
      },
      users: {
        total: totalUsers,
        by_role: usersByRole,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao buscar métricas da organização: ${message}`, 500);
  }
}
