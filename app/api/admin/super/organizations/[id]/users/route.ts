import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

/**
 * GET /api/admin/super/organizations/[id]/users
 * Lista paginada de usuários de uma organização específica
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

    const org = await executeQueryOne<{ id: number }>(
      'SELECT id FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!org) {
      return apiError('Organização não encontrada', 404);
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const search = searchParams.get('search')?.trim() || '';
    const role = searchParams.get('role') || '';

    const conditions: string[] = ['u.organization_id = ?'];
    const queryParams: (string | number)[] = [orgId];

    if (search) {
      const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push("(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
      const searchPattern = `%${escapedSearch}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    if (role) {
      conditions.push('u.role = ?');
      queryParams.push(role);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      queryParams
    );
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const users = await executeQuery(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    return apiSuccess(users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao listar usuários da organização: ${message}`, 500);
  }
}
