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

    // Verificar se é admin
    const adminRoles = ['admin', 'super_admin', 'tenant_admin', 'team_manager']
    if (!adminRoles.includes(decoded.role)) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // SECURITY: Get tenant ID from authenticated user
    const tenantId = decoded.organization_id || 1

    // Buscar todos os tickets com informações relacionadas (com tenant isolation)
    const tickets = db.prepare(`
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
      WHERE t.tenant_id = ? OR t.tenant_id IS NULL
      ORDER BY t.created_at DESC
    `).all(tenantId)

    return NextResponse.json({
      success: true,
      tickets
    })
  } catch (error) {
    logger.error('Error fetching tickets', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

