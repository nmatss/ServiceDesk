import { NextRequest, NextResponse } from 'next/server'
import { getTenantManager } from '@/lib/tenant/manager'
import { logger } from '@/lib/monitoring/logger';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const tenantId = guard.auth!.organizationId;

    const tenantManager = getTenantManager()
    const { searchParams } = new URL(request.url)
    const customerVisible = searchParams.get('customer_visible')

    let ticketTypes
    if (customerVisible === 'true') {
      // Only return customer-visible ticket types for landing page
      ticketTypes = tenantManager.getCustomerTicketTypes(tenantId)
    } else {
      // Return all ticket types for admin
      ticketTypes = tenantManager.getTicketTypesByTenant(tenantId)
    }

    // Add cache control headers
    const response = NextResponse.json({
      success: true,
      ticket_types: ticketTypes
    })

    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')

    return response
  } catch (error) {
    logger.error('Error fetching ticket types', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ticket types' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Require authentication with admin role
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin', 'tenant_admin'] });
    if (guard.response) return guard.response;
    const tenantId = guard.auth!.organizationId;

    const data = await request.json()
    // Validate required fields
    if (!data.name || !data.slug || !data.workflow_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug, workflow_type' },
        { status: 400 }
      )
    }

    // Check if slug already exists for this tenant
    const existingType = await executeQueryOne('SELECT id FROM ticket_types WHERE tenant_id = ? AND slug = ?', [tenantId, data.slug])

    if (existingType) {
      return NextResponse.json(
        { success: false, error: 'Ticket type slug already exists' },
        { status: 400 }
      )
    }

    // Create ticket type
    const result = await executeRun(`
      INSERT INTO ticket_types (
        tenant_id, name, slug, description, icon, color, workflow_type,
        sla_required, approval_required, escalation_enabled, auto_assignment_enabled,
        customer_visible, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [tenantId,
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
      data.sort_order || 999])

    // Get the created ticket type
    const ticketType = await executeQueryOne('SELECT * FROM ticket_types WHERE id = ?', [result.lastInsertRowid])

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