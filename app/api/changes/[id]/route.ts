/**
 * Change Request API - Individual Change Operations
 *
 * Provides endpoints for managing individual Change Requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

const updateChangeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  risk_level: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).optional(),
  impact: z.enum(['extensive', 'significant', 'moderate', 'minor', 'none']).optional(),
  urgency: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  justification: z.string().optional().nullable(),
  business_case: z.string().optional().nullable(),
  implementation_plan: z.string().optional().nullable(),
  rollback_plan: z.string().optional().nullable(),
  test_plan: z.string().optional().nullable(),
  affected_services: z.string().optional().nullable(),
  scheduled_start_date: z.string().optional().nullable(),
  scheduled_end_date: z.string().optional().nullable(),
  downtime_required: z.boolean().optional(),
  downtime_duration: z.number().int().optional().nullable(),
  assignee_id: z.number().int().positive().optional().nullable(),
  assigned_team_id: z.number().int().positive().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'pending_assessment', 'pending_cab', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled']).optional()
})

/**
 * GET /api/changes/[id] - Get Change Request Details
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
    const changeId = parseInt(id)
    if (isNaN(changeId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const db = getDatabase()

    // Get change request with related data
    const change = db.prepare(`
      SELECT
        cr.*,
        ct.name as change_type_name,
        ct.color as change_type_color,
        ct.requires_cab,
        ct.requires_manager_approval,
        u_req.name as requester_name,
        u_req.email as requester_email,
        u_ass.name as assignee_name,
        u_ass.email as assignee_email,
        t.name as team_name
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      LEFT JOIN users u_req ON cr.requester_id = u_req.id
      LEFT JOIN users u_ass ON cr.assignee_id = u_ass.id
      LEFT JOIN teams t ON cr.assigned_team_id = t.id
      WHERE cr.id = ? AND cr.organization_id = ?
    `).get(changeId, auth.user.organization_id) as Record<string, unknown> | undefined

    if (!change) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não encontrada' },
        { status: 404 }
      )
    }

    // Get approvals
    const approvals = db.prepare(`
      SELECT
        a.*,
        u.name as approver_name,
        u.email as approver_email
      FROM change_request_approvals a
      LEFT JOIN users u ON a.approver_id = u.id
      WHERE a.change_request_id = ?
      ORDER BY a.approval_level ASC
    `).all(changeId)

    // Get affected CIs
    const affectedCIs = db.prepare(`
      SELECT
        ci.id,
        ci.ci_number,
        ci.name,
        ct.name as ci_type,
        cs.name as status,
        cs.color as status_color
      FROM ci_ticket_links ctl
      LEFT JOIN configuration_items ci ON ctl.ci_id = ci.id
      LEFT JOIN ci_types ct ON ci.ci_type_id = ct.id
      LEFT JOIN ci_statuses cs ON ci.status_id = cs.id
      WHERE ctl.ticket_id = ? AND ctl.link_type = 'change'
    `).all(changeId)

    // Get CAB meeting if scheduled
    const cabMeeting = db.prepare(`
      SELECT
        m.*,
        u.name as organizer_name
      FROM cab_meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      WHERE m.id = (
        SELECT cab_meeting_id FROM change_requests WHERE id = ?
      )
    `).get(changeId)

    // Get history/comments
    const history = db.prepare(`
      SELECT
        c.*,
        u.name as author_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at DESC
    `).all(changeId)

    return NextResponse.json({
      success: true,
      change_request: change,
      approvals,
      affected_cis: affectedCIs,
      cab_meeting: cabMeeting,
      history
    })
  } catch (error) {
    logger.error('Error fetching change request', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar requisição de mudança' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/changes/[id] - Update Change Request
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const changeId = parseInt(id)
    if (isNaN(changeId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateChangeSchema.parse(body)

    const db = getDatabase()

    // Check if change exists
    const existingChange = db.prepare(
      `SELECT * FROM change_requests WHERE id = ? AND organization_id = ?`
    ).get(changeId, auth.user.organization_id) as Record<string, unknown> | undefined

    if (!existingChange) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não encontrada' },
        { status: 404 }
      )
    }

    // Check permissions - only requester, assignee, or admin/manager can update
    const canUpdate =
      auth.user.id === existingChange.requester_id ||
      auth.user.id === existingChange.assignee_id ||
      ['admin', 'manager'].includes(auth.user.role)

    if (!canUpdate) {
      return NextResponse.json(
        { success: false, error: 'Você não tem permissão para editar esta mudança' },
        { status: 403 }
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

    // Recalculate risk score if impact or risk_level changed
    if (data.impact || data.risk_level) {
      const impact = data.impact || existingChange.impact as string
      const riskLevel = data.risk_level || existingChange.risk_level as string

      const impactScores: Record<string, number> = { extensive: 5, significant: 4, moderate: 3, minor: 2, none: 1 }
      const riskScores: Record<string, number> = { very_high: 5, high: 4, medium: 3, low: 2, very_low: 1 }

      const riskScore = (impactScores[impact] || 3) * (riskScores[riskLevel] || 3)
      updates.push('risk_score = ?')
      values.push(riskScore)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(changeId, auth.user.organization_id)

    db.prepare(`
      UPDATE change_requests
      SET ${updates.join(', ')}
      WHERE id = ? AND organization_id = ?
    `).run(...values)

    // Get updated change
    const updatedChange = db.prepare(
      `SELECT * FROM change_requests WHERE id = ?`
    ).get(changeId)

    logger.info(`Change request updated: ${changeId} by user ${auth.user.id}`)

    return NextResponse.json({
      success: true,
      change_request: updatedChange,
      message: 'Requisição de mudança atualizada com sucesso'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error updating change request', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar requisição de mudança' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/changes/[id] - Cancel/Delete Change Request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const changeId = parseInt(id)
    if (isNaN(changeId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const db = getDatabase()

    // Check if change exists
    const change = db.prepare(
      `SELECT * FROM change_requests WHERE id = ? AND organization_id = ?`
    ).get(changeId, auth.user.organization_id) as { status: string; requester_id: number; change_number: string } | undefined

    if (!change) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não encontrada' },
        { status: 404 }
      )
    }

    // Only allow cancellation of draft/submitted changes, or by admin
    const canCancel =
      ['draft', 'submitted', 'pending_assessment'].includes(change.status) &&
      (auth.user.id === change.requester_id || auth.user.role === 'admin')

    if (!canCancel && auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas mudanças em rascunho ou submetidas podem ser canceladas' },
        { status: 403 }
      )
    }

    // Cancel instead of delete
    db.prepare(`
      UPDATE change_requests
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(auth.user.id, changeId)

    logger.info(`Change request cancelled: ${change.change_number} by user ${auth.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Requisição de mudança cancelada com sucesso'
    })
  } catch (error) {
    logger.error('Error cancelling change request', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao cancelar requisição de mudança' },
      { status: 500 }
    )
  }
}
