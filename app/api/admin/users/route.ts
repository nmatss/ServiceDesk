import { NextRequest, NextResponse } from 'next/server'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';
import { createRateLimitMiddleware } from '@/lib/rate-limit'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Rate limiting para operações admin
const adminRateLimit = createRateLimitMiddleware('api')

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_USER);
  if (rateLimitResponse) return rateLimitResponse;

  // Aplicar rate limiting
  const rateLimitResult = await adminRateLimit(request, '/api/admin/users')
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limit exceeded
  }
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é admin do tenant
    if (!['super_admin', 'tenant_admin'].includes(userContext.role)) {
      return NextResponse.json(
        { error: 'Acesso negado - permissão insuficiente' },
        { status: 403 }
      )
    }

    // Buscar usuários com contagem de tickets (apenas do tenant)
    const users = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        u.updated_at,
        COUNT(t.id) as tickets_count
      FROM users u
      LEFT JOIN tickets t ON u.id = t.user_id AND t.tenant_id = ?
      WHERE u.tenant_id = ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all(tenantContext.id, tenantContext.id)

    return NextResponse.json({
      success: true,
      users
    })
  } catch (error) {
    logger.error('Error fetching users', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

