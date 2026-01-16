import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantId } from '@/lib/tenant/manager'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantId = getCurrentTenantId()
    const teamId = parseInt(params.id)
    const userId = parseInt(params.userId)
    if (isNaN(teamId) || isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID or user ID' },
        { status: 400 }
      )
    }

    // Check if user has assigned tickets in this team
    const assignedTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE assigned_to = ? AND assigned_team_id = ? AND tenant_id = ?
      AND status_id NOT IN (SELECT id FROM statuses WHERE is_final = 1 AND tenant_id = ?)
    `).get(userId, teamId, tenantId, tenantId) as { count: number } | undefined

    if (assignedTickets && assignedTickets.count > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove team member with active assigned tickets' },
        { status: 400 }
      )
    }

    // Remove user from team
    const result = db.prepare(`
      UPDATE team_members SET
        is_active = 0,
        left_at = CURRENT_TIMESTAMP
      WHERE team_id = ? AND user_id = ?
      AND team_id IN (SELECT id FROM teams WHERE tenant_id = ?)
    `).run(teamId, userId, tenantId)

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Team member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User removed from team successfully'
    })
  } catch (error) {
    logger.error('Error removing team member', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}