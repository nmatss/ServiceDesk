import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { verifyTokenFromCookies } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verificar autenticação via cookies httpOnly
    const decoded = await verifyTokenFromCookies(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    // Get tenant ID from authenticated user (fallback to 1 for dev)
    const tenantId = decoded.organization_id || 1

    const { searchParams } = new URL(request.url)
    const myTickets = searchParams.get('my_tickets') === 'true'

    // Build base query with tenant isolation
    let baseCondition = 'WHERE (t.tenant_id = ? OR t.tenant_id IS NULL)'
    const params: (number | string)[] = [tenantId]

    // If user is not admin, only show their tickets
    const adminRoles = ['admin', 'super_admin', 'tenant_admin', 'team_manager', 'agent']
    if (!adminRoles.includes(decoded.role) || myTickets) {
      baseCondition += ' AND t.user_id = ?'
      params.push(decoded.id)
    }

    // Get ticket statistics
    const statsQuery = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN s.name IN ('Novo', 'Aberto', 'new', 'open') THEN 1 END) as open,
        COUNT(CASE WHEN s.name IN ('Em Andamento', 'Em Progresso', 'in_progress') THEN 1 END) as in_progress,
        COUNT(CASE WHEN s.name IN ('Pendente', 'pending') THEN 1 END) as pending,
        COUNT(CASE WHEN s.name IN ('Resolvido', 'resolved') THEN 1 END) as resolved,
        COUNT(CASE WHEN s.name IN ('Fechado', 'closed') OR s.is_final = 1 THEN 1 END) as closed
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      ${baseCondition}
    `)

    const stats = statsQuery.get(...params) as {
      total: number
      open: number
      in_progress: number
      pending: number
      resolved: number
      closed: number
    }

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
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
