/**
 * CAB Meeting API - Individual Meeting Operations
 *
 * Manages individual CAB meetings, voting, and change approvals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  scheduled_date: z.string().optional(),
  scheduled_time: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  location: z.string().optional().nullable(),
  meeting_url: z.string().url().optional().nullable(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().optional().nullable(),
  decisions: z.string().optional().nullable()
})

const voteSchema = z.object({
  change_request_id: z.number().int().positive(),
  vote: z.enum(['approved', 'rejected', 'abstained', 'deferred']),
  comments: z.string().optional(),
  conditions: z.string().optional()
})

/**
 * GET /api/cab/[id] - Get CAB Meeting Details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const meetingId = parseInt(id)
    if (isNaN(meetingId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const db = getDatabase()

    // Get meeting details
    const meeting = db.prepare(`
      SELECT
        m.*,
        u.name as organizer_name,
        u.email as organizer_email
      FROM cab_meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      WHERE m.id = ? AND m.organization_id = ?
    `).get(meetingId, auth.user.organization_id) as Record<string, unknown> | undefined

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Reunião do CAB não encontrada' },
        { status: 404 }
      )
    }

    // Get change requests for this meeting
    const changeRequests = db.prepare(`
      SELECT
        cr.*,
        ct.name as change_type_name,
        u.name as requester_name,
        (SELECT COUNT(*) FROM change_request_approvals
         WHERE change_request_id = cr.id AND status = 'approved') as approval_count,
        (SELECT COUNT(*) FROM change_request_approvals
         WHERE change_request_id = cr.id AND status = 'rejected') as rejection_count
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      LEFT JOIN users u ON cr.requester_id = u.id
      WHERE cr.cab_meeting_id = ?
      ORDER BY cr.risk_score DESC, cr.priority
    `).all(meetingId)

    // Get CAB members
    const members = db.prepare(`
      SELECT
        cm.*,
        u.name as member_name,
        u.email as member_email,
        t.name as team_name
      FROM cab_members cm
      LEFT JOIN users u ON cm.user_id = u.id
      LEFT JOIN teams t ON cm.team_id = t.id
      WHERE cm.organization_id = ? AND cm.is_active = 1
      ORDER BY cm.role DESC, u.name
    `).all(auth.user.organization_id)

    // Get votes for each change request
    const votes = db.prepare(`
      SELECT
        cra.*,
        u.name as approver_name
      FROM change_request_approvals cra
      LEFT JOIN users u ON cra.approver_id = u.id
      LEFT JOIN change_requests cr ON cra.change_request_id = cr.id
      WHERE cr.cab_meeting_id = ?
    `).all(meetingId)

    // Check if current user is a CAB member
    const userMembership = db.prepare(`
      SELECT * FROM cab_members WHERE user_id = ? AND organization_id = ? AND is_active = 1
    `).get(auth.user.id, auth.user.organization_id)

    return NextResponse.json({
      success: true,
      meeting,
      change_requests: changeRequests,
      members,
      votes,
      user_membership: userMembership,
      can_vote: !!userMembership || ['admin', 'manager'].includes(auth.user.role)
    })
  } catch (error) {
    logger.error('Error fetching CAB meeting', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar reunião do CAB' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/cab/[id] - Update CAB Meeting
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    // Only admins and managers can update meetings
    if (!['admin', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Permissão negada' },
        { status: 403 }
      )
    }

    const { id } = await params
    const meetingId = parseInt(id)
    if (isNaN(meetingId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateMeetingSchema.parse(body)

    const db = getDatabase()

    // Check if meeting exists
    const existingMeeting = db.prepare(
      `SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?`
    ).get(meetingId, auth.user.organization_id)

    if (!existingMeeting) {
      return NextResponse.json(
        { success: false, error: 'Reunião do CAB não encontrada' },
        { status: 404 }
      )
    }

    // Build update query
    const updates: string[] = []
    const values: unknown[] = []

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma alteração fornecida' },
        { status: 400 }
      )
    }

    // Handle status changes
    if (data.status === 'completed') {
      updates.push('actual_end_time = CURRENT_TIMESTAMP')
    } else if (data.status === 'in_progress') {
      updates.push('actual_start_time = CURRENT_TIMESTAMP')
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(meetingId, auth.user.organization_id)

    db.prepare(`
      UPDATE cab_meetings
      SET ${updates.join(', ')}
      WHERE id = ? AND organization_id = ?
    `).run(...values)

    // If meeting is completed, update change request statuses based on votes
    if (data.status === 'completed') {
      // Get all change requests for this meeting and their vote tallies
      const changeRequests = db.prepare(`
        SELECT
          cr.id,
          (SELECT COUNT(*) FROM change_request_approvals WHERE change_request_id = cr.id AND status = 'approved') as approved,
          (SELECT COUNT(*) FROM change_request_approvals WHERE change_request_id = cr.id AND status = 'rejected') as rejected
        FROM change_requests cr
        WHERE cr.cab_meeting_id = ?
      `).all(meetingId) as Array<{ id: number; approved: number; rejected: number }>

      const updateStatus = db.prepare(`
        UPDATE change_requests SET status = ?, cab_approved_at = CURRENT_TIMESTAMP WHERE id = ?
      `)

      for (const cr of changeRequests) {
        if (cr.approved > cr.rejected) {
          updateStatus.run('approved', cr.id)
        } else if (cr.rejected > 0) {
          updateStatus.run('rejected', cr.id)
        }
      }
    }

    // Get updated meeting
    const updatedMeeting = db.prepare(
      `SELECT * FROM cab_meetings WHERE id = ?`
    ).get(meetingId)

    logger.info(`CAB meeting updated: ${meetingId} by user ${auth.user.id}`)

    return NextResponse.json({
      success: true,
      meeting: updatedMeeting,
      message: 'Reunião do CAB atualizada com sucesso'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error updating CAB meeting', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar reunião do CAB' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cab/[id] - Cancel CAB Meeting
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    // Only admins can cancel meetings
    if (auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem cancelar reuniões' },
        { status: 403 }
      )
    }

    const { id } = await params
    const meetingId = parseInt(id)
    if (isNaN(meetingId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const db = getDatabase()

    // Check if meeting exists
    const meeting = db.prepare(
      `SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?`
    ).get(meetingId, auth.user.organization_id) as { status: string } | undefined

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Reunião do CAB não encontrada' },
        { status: 404 }
      )
    }

    if (meeting.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Não é possível cancelar reuniões concluídas' },
        { status: 400 }
      )
    }

    // Cancel meeting
    db.prepare(`
      UPDATE cab_meetings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(meetingId)

    // Remove meeting reference from change requests
    db.prepare(`
      UPDATE change_requests SET cab_meeting_id = NULL, status = 'pending_cab'
      WHERE cab_meeting_id = ?
    `).run(meetingId)

    logger.info(`CAB meeting cancelled: ${meetingId} by user ${auth.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Reunião do CAB cancelada com sucesso'
    })
  } catch (error) {
    logger.error('Error cancelling CAB meeting', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao cancelar reunião do CAB' },
      { status: 500 }
    )
  }
}
