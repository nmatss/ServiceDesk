import { NextRequest, NextResponse } from 'next/server'
import { executeQueryOne } from '@/lib/db/adapter'
import { getDatabaseType } from '@/lib/db/config'
import { logger } from '@/lib/monitoring/logger'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { TICKET_MANAGEMENT_ROLES } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const CLOSED_BY_IS_FINAL_SQL = getDatabaseType() === 'postgresql'
  ? 's.is_final = TRUE'
  : 's.is_final = 1';

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { searchParams } = new URL(request.url)
    const myTickets = searchParams.get('my_tickets') === 'true'

    // Build base query with tenant isolation
    let baseCondition = 'WHERE t.tenant_id = ?'
    const params: (number | string)[] = [tenantContext.id]

    // If user is not admin, only show their tickets
    if (!TICKET_MANAGEMENT_ROLES.includes(userContext.role) || myTickets) {
      baseCondition += ' AND t.user_id = ?'
      params.push(userContext.id)
    }

    // Get ticket statistics
    const stats = await executeQueryOne<{
      total: number
      open: number
      in_progress: number
      pending: number
      resolved: number
      closed: number
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN s.name IN ('Novo', 'Aberto', 'new', 'open') THEN 1 END) as open,
        COUNT(CASE WHEN s.name IN ('Em Andamento', 'Em Progresso', 'in_progress') THEN 1 END) as in_progress,
        COUNT(CASE WHEN s.name IN ('Pendente', 'pending') THEN 1 END) as pending,
        COUNT(CASE WHEN s.name IN ('Resolvido', 'resolved') THEN 1 END) as resolved,
        COUNT(CASE WHEN s.name IN ('Fechado', 'closed') OR ${CLOSED_BY_IS_FINAL_SQL} THEN 1 END) as closed
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      ${baseCondition}
    `, params)

    return NextResponse.json({
      success: true,
      stats: {
        total: stats?.total || 0,
        open: stats?.open || 0,
        in_progress: stats?.in_progress || 0,
        pending: stats?.pending || 0,
        resolved: stats?.resolved || 0,
        closed: stats?.closed || 0
      }
    })
  } catch (error) {
    logger.error('Error fetching ticket stats', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
