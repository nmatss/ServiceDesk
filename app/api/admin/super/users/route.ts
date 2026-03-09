import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, sqlTrue, sqlFalse } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  name: 'u.name',
  email: 'u.email',
  created_at: 'u.created_at',
  last_login: 'u.last_login_at',
  role: 'u.role',
};

/**
 * GET /api/admin/super/users
 * Lista paginada de todos os usuários de todas as organizações
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_USER);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const search = searchParams.get('search')?.trim() || '';
    const orgId = searchParams.get('org_id') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push("(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
      const searchPattern = `%${escapedSearch}%`;
      params.push(searchPattern, searchPattern);
    }

    if (orgId) {
      const parsedOrgId = parseInt(orgId, 10);
      if (!isNaN(parsedOrgId) && parsedOrgId > 0) {
        conditions.push('u.organization_id = ?');
        params.push(parsedOrgId);
      }
    }

    if (role && ['admin', 'agent', 'user', 'manager', 'read_only', 'api_client', 'super_admin'].includes(role)) {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (status === 'active') {
      conditions.push(`u.is_active = ${sqlTrue()}`);
    } else if (status === 'inactive') {
      conditions.push(`u.is_active = ${sqlFalse()}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = ALLOWED_SORT_COLUMNS[sort] || 'u.created_at';

    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
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
        u.organization_id,
        o.name as organization_name,
        o.slug as organization_slug,
        u.last_login_at,
        u.created_at
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return apiSuccess(users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao listar usuários: ${message}`, 500);
  }
}
