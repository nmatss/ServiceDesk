import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Contexto de tenant não encontrado' },
        { status: 400 }
      )
    }

    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = await verifyToken(token)

    if (!decoded) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    if (decoded.role !== 'admin' && decoded.role !== 'tenant_admin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Verificar se usuário pertence ao tenant
    if (decoded.organization_id !== tenantContext.id) {
      return NextResponse.json(
        { error: 'Acesso negado a este tenant' },
        { status: 403 }
      )
    }

    const tenantId = tenantContext.id

    // Buscar estatísticas FILTRADAS POR TENANT
    const totalUsers = db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = ?'
    ).get(tenantId) as { count: number }

    const totalTickets = db.prepare(
      'SELECT COUNT(*) as count FROM tickets WHERE tenant_id = ?'
    ).get(tenantId) as { count: number }

    const openTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE t.tenant_id = ? AND s.is_final = 0
    `).get(tenantId, tenantId) as { count: number }

    const resolvedTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      WHERE t.tenant_id = ? AND s.is_final = 1
    `).get(tenantId, tenantId) as { count: number }

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
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

