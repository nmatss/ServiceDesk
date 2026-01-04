import { NextRequest, NextResponse } from 'next/server'
import { getTenantManager } from '@/lib/tenant/manager'
import { getCurrentTenantId } from '@/lib/tenant/manager'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    const tenantId = getCurrentTenantId()
    const tenantManager = getTenantManager()
    const teamId = parseInt(params.id)

    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }

    const members = tenantManager.getTeamMembers(teamId)

    return NextResponse.json({
      success: true,
      members
    })
  } catch (error) {
    logger.error('Error fetching team members', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    const tenantId = getCurrentTenantId()
    const tenantManager = getTenantManager()
    const teamId = parseInt(params.id)
    const data = await request.json()
    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }

    if (!data.user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 }
      )
    }

    // Verify team belongs to tenant
    const team = db.prepare(
      'SELECT id FROM teams WHERE id = ? AND tenant_id = ?'
    ).get(teamId, tenantId)

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Verify user belongs to tenant
    const user = db.prepare(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?'
    ).get(data.user_id, tenantId)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Add user to team
    tenantManager.addUserToTeam(teamId, data.user_id, data.role || 'member')

    // Update user specializations if provided
    if (data.specializations) {
      db.prepare(`
        UPDATE team_members SET
          specializations = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE team_id = ? AND user_id = ?
      `).run(
        JSON.stringify(data.specializations),
        teamId,
        data.user_id
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User added to team successfully'
    })
  } catch (error) {
    logger.error('Error adding team member', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add team member' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    const tenantId = getCurrentTenantId()
    const teamId = parseInt(params.id)
    const data = await request.json()
    if (isNaN(teamId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      )
    }

    if (!data.user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 }
      )
    }

    // Update team member
    const updateMember = db.prepare(`
      UPDATE team_members SET
        role = COALESCE(?, role),
        specializations = COALESCE(?, specializations),
        availability_status = COALESCE(?, availability_status),
        workload_percentage = COALESCE(?, workload_percentage)
      WHERE team_id = ? AND user_id = ?
      AND team_id IN (SELECT id FROM teams WHERE tenant_id = ?)
    `)

    const result = updateMember.run(
      data.role,
      data.specializations ? JSON.stringify(data.specializations) : null,
      data.availability_status,
      data.workload_percentage,
      teamId,
      data.user_id,
      tenantId
    )

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Team member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Team member updated successfully'
    })
  } catch (error) {
    logger.error('Error updating team member', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update team member' },
      { status: 500 }
    )
  }
}