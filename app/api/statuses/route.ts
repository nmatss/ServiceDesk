import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest } from '@/lib/tenant/context'

export async function GET(request: NextRequest) {
  try {
    // Get tenant context from middleware
    const tenantContext = getTenantContextFromRequest(request)

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // Query statuses with tenant isolation
    const statuses = db.prepare(`
      SELECT id, name, description, color, is_final, is_initial,
             is_customer_visible, requires_comment, next_statuses,
             automated_actions, sort_order, status_type, slug,
             created_at, updated_at
      FROM statuses
      WHERE tenant_id = ? AND is_active_new = 1
      ORDER BY sort_order, name
    `).all(tenantContext.id)

    // Parse JSON fields
    const parsedStatuses = statuses.map(status => ({
      ...status,
      next_statuses: status.next_statuses ? JSON.parse(status.next_statuses) : null,
      automated_actions: status.automated_actions ? JSON.parse(status.automated_actions) : null
    }))

    return NextResponse.json({
      success: true,
      statuses: parsedStatuses
    })
  } catch (error) {
    console.error('Error fetching statuses:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const { name, description, color, is_final, requires_comment, next_statuses } = await request.json()

    if (!name || !color) {
      return NextResponse.json(
        { error: 'Nome e cor são obrigatórios' },
        { status: 400 }
      )
    }

    // Create new status with tenant isolation
    const result = db.prepare(`
      INSERT INTO statuses (name, description, color, is_final, requires_comment,
                           next_statuses, tenant_id, is_active_new)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      name,
      description || null,
      color,
      is_final || false,
      requires_comment || false,
      next_statuses ? JSON.stringify(next_statuses) : null,
      tenantContext.id
    )

    // Get created status
    const newStatus = db.prepare('SELECT * FROM statuses WHERE id = ?').get(result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      status: newStatus
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating status:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
