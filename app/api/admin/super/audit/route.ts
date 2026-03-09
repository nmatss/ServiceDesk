import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  created_at: 'a.created_at',
  entity_type: 'a.entity_type',
  action: 'a.action',
};

/**
 * GET /api/admin/super/audit
 * Lista paginada de logs de auditoria cross-tenant
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const orgId = searchParams.get('org_id') || '';
    const userId = searchParams.get('user_id') || '';
    const entityType = searchParams.get('entity_type') || '';
    const action = searchParams.get('action') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const search = searchParams.get('search')?.trim() || '';
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (orgId) {
      const parsedOrgId = parseInt(orgId, 10);
      if (!isNaN(parsedOrgId) && parsedOrgId > 0) {
        conditions.push('a.organization_id = ?');
        params.push(parsedOrgId);
      }
    }

    if (userId) {
      const parsedUserId = parseInt(userId, 10);
      if (!isNaN(parsedUserId) && parsedUserId > 0) {
        conditions.push('a.user_id = ?');
        params.push(parsedUserId);
      }
    }

    if (entityType) {
      conditions.push('a.entity_type = ?');
      params.push(entityType);
    }

    if (action) {
      conditions.push('a.action = ?');
      params.push(action);
    }

    if (dateFrom) {
      conditions.push('a.created_at >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('a.created_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    if (search) {
      const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push(
        "(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR o.name LIKE ? ESCAPE '\\' OR a.entity_type LIKE ? ESCAPE '\\' OR a.action LIKE ? ESCAPE '\\')"
      );
      const pattern = `%${escapedSearch}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = ALLOWED_SORT_COLUMNS[sort] || 'a.created_at';

    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN organizations o ON a.organization_id = o.id
       ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const logs = await executeQuery(
      `SELECT
        a.id,
        a.user_id,
        a.organization_id,
        a.entity_type,
        a.entity_id,
        a.action,
        a.old_values,
        a.new_values,
        a.ip_address,
        a.user_agent,
        a.created_at,
        u.name as user_name,
        u.email as user_email,
        o.name as organization_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN organizations o ON a.organization_id = o.id
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return apiSuccess(logs, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao listar logs de auditoria: ${message}`, 500);
  }
}
