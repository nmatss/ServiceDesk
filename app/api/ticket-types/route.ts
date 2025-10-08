import { NextRequest, NextResponse } from 'next/server'
import { getTenantManager } from '@/lib/tenant/manager'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const tenantManager = getTenantManager()
    const { searchParams } = new URL(request.url)
    const customerVisible = searchParams.get('customer_visible')

    let ticketTypes
    if (customerVisible === 'true') {
      // Only return customer-visible ticket types for landing page
      ticketTypes = tenantManager.getCustomerTicketTypes(tenantContext.id)
    } else {
      // Return all ticket types for admin
      ticketTypes = tenantManager.getTicketTypesByTenant(tenantContext.id)
    }

    return NextResponse.json({
      success: true,
      ticket_types: ticketTypes
    })
  } catch (error) {
    logger.error('Error fetching ticket types', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ticket types' },
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

    const data = await request.json()
    const { getDb } = await import('@/lib/db')
    const db = getDb()

    // Validate required fields
    if (!data.name || !data.slug || !data.workflow_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug, workflow_type' },
        { status: 400 }
      )
    }

    // Check if slug already exists for this tenant
    const existingType = db.prepare(
      'SELECT id FROM ticket_types WHERE tenant_id = ? AND slug = ?'
    ).get(tenantContext.id, data.slug)

    if (existingType) {
      return NextResponse.json(
        { success: false, error: 'Ticket type slug already exists' },
        { status: 400 }
      )
    }

    // Create ticket type
    const result = db.prepare(`
      INSERT INTO ticket_types (
        tenant_id, name, slug, description, icon, color, workflow_type,
        sla_required, approval_required, escalation_enabled, auto_assignment_enabled,
        customer_visible, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenantContext.id,
      data.name,
      data.slug,
      data.description || null,
      data.icon || 'ExclamationTriangleIcon',
      data.color || '#3B82F6',
      data.workflow_type,
      data.sla_required !== false ? 1 : 0,
      data.approval_required === true ? 1 : 0,
      data.escalation_enabled !== false ? 1 : 0,
      data.auto_assignment_enabled === true ? 1 : 0,
      data.customer_visible !== false ? 1 : 0,
      data.sort_order || 999
    )

    // Get the created ticket type
    const ticketType = db.prepare(
      'SELECT * FROM ticket_types WHERE id = ?'
    ).get(result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      ticket_type: ticketType,
      message: 'Ticket type created successfully'
    })
  } catch (error) {
    logger.error('Error creating ticket type', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create ticket type' },
      { status: 500 }
    )
  }
}