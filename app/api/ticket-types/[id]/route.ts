import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantId } from '@/lib/tenant/manager'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getCurrentTenantId()
    const ticketTypeId = parseInt(params.id)
    if (isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ticket type ID' },
        { status: 400 }
      )
    }

    const ticketType = db.prepare(`
      SELECT * FROM ticket_types
      WHERE id = ? AND tenant_id = ?
    `).get(ticketTypeId, tenantId)

    if (!ticketType) {
      return NextResponse.json(
        { success: false, error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ticket_type: ticketType
    })
  } catch (error) {
    logger.error('Error fetching ticket type', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ticket type' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getCurrentTenantId()
    const ticketTypeId = parseInt(params.id)
    const data = await request.json()
    if (isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ticket type ID' },
        { status: 400 }
      )
    }

    // Check if ticket type exists and belongs to tenant
    const existingType = db.prepare(
      'SELECT id FROM ticket_types WHERE id = ? AND tenant_id = ?'
    ).get(ticketTypeId, tenantId)

    if (!existingType) {
      return NextResponse.json(
        { success: false, error: 'Ticket type not found' },
        { status: 404 }
      )
    }

    // Check if slug is unique (if being updated)
    if (data.slug) {
      const duplicateSlug = db.prepare(
        'SELECT id FROM ticket_types WHERE tenant_id = ? AND slug = ? AND id != ?'
      ).get(tenantId, data.slug, ticketTypeId)

      if (duplicateSlug) {
        return NextResponse.json(
          { success: false, error: 'Ticket type slug already exists' },
          { status: 400 }
        )
      }
    }

    // Update ticket type
    const updateTicketType = db.prepare(`
      UPDATE ticket_types SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        workflow_type = COALESCE(?, workflow_type),
        sla_required = COALESCE(?, sla_required),
        approval_required = COALESCE(?, approval_required),
        escalation_enabled = COALESCE(?, escalation_enabled),
        auto_assignment_enabled = COALESCE(?, auto_assignment_enabled),
        customer_visible = COALESCE(?, customer_visible),
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `)

    updateTicketType.run(
      data.name,
      data.slug,
      data.description,
      data.icon,
      data.color,
      data.workflow_type,
      data.sla_required !== undefined ? (data.sla_required ? 1 : 0) : null,
      data.approval_required !== undefined ? (data.approval_required ? 1 : 0) : null,
      data.escalation_enabled !== undefined ? (data.escalation_enabled ? 1 : 0) : null,
      data.auto_assignment_enabled !== undefined ? (data.auto_assignment_enabled ? 1 : 0) : null,
      data.customer_visible !== undefined ? (data.customer_visible ? 1 : 0) : null,
      data.sort_order,
      ticketTypeId,
      tenantId
    )

    // Get updated ticket type
    const updatedTicketType = db.prepare(
      'SELECT * FROM ticket_types WHERE id = ?'
    ).get(ticketTypeId)

    return NextResponse.json({
      success: true,
      ticket_type: updatedTicketType,
      message: 'Ticket type updated successfully'
    })
  } catch (error) {
    logger.error('Error updating ticket type', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update ticket type' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = getCurrentTenantId()
    const ticketTypeId = parseInt(params.id)
    if (isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ticket type ID' },
        { status: 400 }
      )
    }

    // Check if there are tickets using this type
    const ticketsCount = db.prepare(
      'SELECT COUNT(*) as count FROM tickets WHERE ticket_type_id = ? AND tenant_id = ?'
    ).get(ticketTypeId, tenantId)

    if (ticketsCount.count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete ticket type with existing tickets' },
        { status: 400 }
      )
    }

    // Soft delete ticket type
    db.prepare(
      'UPDATE ticket_types SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?'
    ).run(ticketTypeId, tenantId)

    return NextResponse.json({
      success: true,
      message: 'Ticket type deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting ticket type', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete ticket type' },
      { status: 500 }
    )
  }
}