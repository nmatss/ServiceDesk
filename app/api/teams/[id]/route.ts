import { NextRequest, NextResponse } from 'next/server'
import { getTenantManager } from '@/lib/tenant/manager'
import { executeQueryOne, executeRun } from '@/lib/db/adapter'
import { logger } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantId = guard.context!.tenant.id

    const tenantManager = getTenantManager()
    const teamId = parseInt(params.id)

    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }

    const team = tenantManager.getTeamById(teamId, tenantId)

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Get team members
    const members = tenantManager.getTeamMembers(teamId)

    return NextResponse.json({
      success: true,
      team,
      members
    })
  } catch (error) {
    logger.error('Error fetching team', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response
    const tenantId = guard.context!.tenant.id

    const teamId = parseInt(params.id)
    const data = await request.json()
    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }

    // Verify team belongs to tenant
    const existingTeam = await executeQueryOne(
      'SELECT id FROM teams WHERE id = ? AND tenant_id = ?',
      [teamId, tenantId]
    )

    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Update team
    const updateTeamQuery = `
      UPDATE teams SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        team_type = COALESCE(?, team_type),
        specializations = COALESCE(?, specializations),
        capabilities = COALESCE(?, capabilities),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        manager_id = ?,
        sla_response_time = ?,
        max_concurrent_tickets = COALESCE(?, max_concurrent_tickets),
        auto_assignment_enabled = COALESCE(?, auto_assignment_enabled),
        assignment_algorithm = COALESCE(?, assignment_algorithm),
        business_hours = ?,
        contact_email = ?,
        contact_phone = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `

    await executeRun(updateTeamQuery, [
      data.name,
      data.description,
      data.team_type,
      data.specializations ? JSON.stringify(data.specializations) : null,
      data.capabilities ? JSON.stringify(data.capabilities) : null,
      data.icon,
      data.color,
      data.manager_id || null,
      data.sla_response_time || null,
      data.max_concurrent_tickets,
      data.auto_assignment_enabled,
      data.assignment_algorithm,
      data.business_hours ? JSON.stringify(data.business_hours) : null,
      data.contact_email || null,
      data.contact_phone || null,
      teamId,
      tenantId
    ])

    // Get updated team
    const tenantManager = getTenantManager()
    const updatedTeam = tenantManager.getTeamById(teamId, tenantId)

    return NextResponse.json({
      success: true,
      team: updatedTeam,
      message: 'Team updated successfully'
    })
  } catch (error) {
    logger.error('Error updating team', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update team' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, {
      requireRoles: ['super_admin', 'tenant_admin', 'team_manager'],
    })
    if (guard.response) return guard.response
    const tenantId = guard.context!.tenant.id

    const teamId = parseInt(params.id)
    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }

    // Check if team has assigned tickets
    const ticketsCount = await executeQueryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM tickets WHERE assigned_team_id = ? AND tenant_id = ?',
      [teamId, tenantId]
    )

    if (ticketsCount && ticketsCount.count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete team with assigned tickets' },
        { status: 400 }
      )
    }

    // Soft delete team
    await executeRun(
      'UPDATE teams SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
      [teamId, tenantId]
    )

    return NextResponse.json({
      success: true,
      message: 'Team deleted successfully'
    })
  } catch (error) {
    logger.error('Error deleting team', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete team' },
      { status: 500 }
    )
  }
}
