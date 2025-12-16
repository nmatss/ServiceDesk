/**
 * CAB Voting API
 *
 * Handles CAB member votes on change requests during CAB meetings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

const voteSchema = z.object({
  change_request_id: z.number().int().positive(),
  vote: z.enum(['approved', 'rejected', 'abstained', 'deferred']),
  comments: z.string().optional(),
  conditions: z.string().optional()
})

/**
 * POST /api/cab/[id]/vote - Submit CAB Vote
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body = await request.json()
    const data = voteSchema.parse(body)

    const db = getDatabase()

    // Verify meeting exists and is in progress
    const meeting = db.prepare(
      `SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?`
    ).get(meetingId, auth.user.organization_id) as { status: string } | undefined

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Reunião do CAB não encontrada' },
        { status: 404 }
      )
    }

    if (meeting.status !== 'in_progress' && meeting.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: 'Votação não permitida - reunião não está em andamento' },
        { status: 400 }
      )
    }

    // Verify user is a CAB member or admin/manager
    const isCabMember = db.prepare(`
      SELECT * FROM cab_members WHERE user_id = ? AND organization_id = ? AND is_active = 1
    `).get(auth.user.id, auth.user.organization_id)

    if (!isCabMember && !['admin', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Apenas membros do CAB podem votar' },
        { status: 403 }
      )
    }

    // Verify change request is part of this meeting
    const changeRequest = db.prepare(
      `SELECT * FROM change_requests WHERE id = ? AND cab_meeting_id = ?`
    ).get(data.change_request_id, meetingId)

    if (!changeRequest) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não faz parte desta reunião' },
        { status: 400 }
      )
    }

    // Check if user already voted
    const existingVote = db.prepare(`
      SELECT * FROM change_request_approvals
      WHERE change_request_id = ? AND approver_id = ?
    `).get(data.change_request_id, auth.user.id)

    if (existingVote) {
      // Update existing vote
      db.prepare(`
        UPDATE change_request_approvals
        SET status = ?, comments = ?, conditions = ?, decided_at = CURRENT_TIMESTAMP
        WHERE change_request_id = ? AND approver_id = ?
      `).run(
        data.vote,
        data.comments || null,
        data.conditions || null,
        data.change_request_id,
        auth.user.id
      )

      logger.info(`CAB vote updated: CR ${data.change_request_id} - ${data.vote} by user ${auth.user.id}`)

      return NextResponse.json({
        success: true,
        message: 'Voto atualizado com sucesso'
      })
    }

    // Create new vote
    db.prepare(`
      INSERT INTO change_request_approvals (
        change_request_id, approval_level, approver_type, approver_id,
        status, comments, conditions, decided_at
      ) VALUES (?, 1, 'cab', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      data.change_request_id,
      auth.user.id,
      data.vote,
      data.comments || null,
      data.conditions || null
    )

    // Get vote tally
    const voteTally = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'abstained' THEN 1 ELSE 0 END) as abstained,
        SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END) as deferred,
        COUNT(*) as total
      FROM change_request_approvals
      WHERE change_request_id = ?
    `).get(data.change_request_id)

    logger.info(`CAB vote recorded: CR ${data.change_request_id} - ${data.vote} by user ${auth.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Voto registrado com sucesso',
      vote_tally: voteTally
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error recording CAB vote', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar voto' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cab/[id]/vote - Get Vote Summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify meeting exists
    const meeting = db.prepare(
      `SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?`
    ).get(meetingId, auth.user.organization_id)

    if (!meeting) {
      return NextResponse.json(
        { success: false, error: 'Reunião do CAB não encontrada' },
        { status: 404 }
      )
    }

    // Get all votes for change requests in this meeting
    const votes = db.prepare(`
      SELECT
        cr.id as change_request_id,
        cr.change_number,
        cr.title,
        cra.approver_id,
        u.name as approver_name,
        cra.status as vote,
        cra.comments,
        cra.conditions,
        cra.decided_at
      FROM change_requests cr
      LEFT JOIN change_request_approvals cra ON cr.id = cra.change_request_id
      LEFT JOIN users u ON cra.approver_id = u.id
      WHERE cr.cab_meeting_id = ?
      ORDER BY cr.id, cra.decided_at
    `).all(meetingId)

    // Get vote tallies per change request
    const tallies = db.prepare(`
      SELECT
        cr.id as change_request_id,
        cr.change_number,
        cr.title,
        SUM(CASE WHEN cra.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN cra.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN cra.status = 'abstained' THEN 1 ELSE 0 END) as abstained,
        SUM(CASE WHEN cra.status = 'deferred' THEN 1 ELSE 0 END) as deferred,
        COUNT(cra.id) as total_votes
      FROM change_requests cr
      LEFT JOIN change_request_approvals cra ON cr.id = cra.change_request_id
      WHERE cr.cab_meeting_id = ?
      GROUP BY cr.id
    `).all(meetingId)

    // Get user's votes
    const userVotes = db.prepare(`
      SELECT
        cra.change_request_id,
        cra.status as vote,
        cra.comments,
        cra.conditions
      FROM change_request_approvals cra
      LEFT JOIN change_requests cr ON cra.change_request_id = cr.id
      WHERE cr.cab_meeting_id = ? AND cra.approver_id = ?
    `).all(meetingId, auth.user.id)

    return NextResponse.json({
      success: true,
      votes,
      tallies,
      user_votes: userVotes
    })
  } catch (error) {
    logger.error('Error fetching vote summary', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar resumo de votos' },
      { status: 500 }
    )
  }
}
