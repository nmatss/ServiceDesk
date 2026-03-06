import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { ADMIN_ROLES } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, { requireRoles: [...ADMIN_ROLES] })
    if (guard.response) return guard.response
    const tenantId = guard.auth!.organizationId

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
    const offset = (page - 1) * limit

    // Count total for pagination metadata
    const totalResult = await executeQuery<{ count: number }>(`
      SELECT COUNT(*) as count FROM tickets WHERE tenant_id = ?
    `, [tenantId])
    const total = totalResult[0]?.count || 0

    // Buscar tickets paginados com informações relacionadas (com tenant isolation)
    const tickets = await executeQuery(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        s.name as status,
        s.color as status_color,
        p.name as priority,
        p.color as priority_color,
        p.level as priority_level,
        c.name as category,
        c.color as category_color,
        u.name as user_name,
        u.email as user_email,
        agent.name as assigned_agent_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users agent ON t.assigned_to = agent.id
      WHERE t.tenant_id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `, [tenantId, limit, offset])

    return NextResponse.json({
      success: true,
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    logger.error('Error fetching tickets', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

