import { NextRequest, NextResponse } from 'next/server'
import { executeQueryOne } from '@/lib/db/adapter';
import { verifyToken } from '@/lib/auth/auth-service'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'Contexto de tenant não encontrado' },
        { status: 400 }
      )
    }

    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = await verifyToken(token)

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    if (decoded.role !== 'admin' && decoded.role !== 'tenant_admin') {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Verificar se usuário pertence ao tenant
    if (decoded.organization_id !== tenantContext.id) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado a este tenant' },
        { status: 403 }
      )
    }

    const tenantId = tenantContext.id

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

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    logger.error('Error fetching stats', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

