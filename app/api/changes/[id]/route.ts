/**
 * Change Request API - Individual Change Operations
 *
 * Provides endpoints for managing individual Change Requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const updateChangeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  risk_assessment: z.string().optional().nullable(),
  impact_assessment: z.string().optional().nullable(),
  reason_for_change: z.string().optional().nullable(),
  business_justification: z.string().optional().nullable(),
  implementation_plan: z.string().optional().nullable(),
  backout_plan: z.string().optional().nullable(),
  test_plan: z.string().optional().nullable(),
  communication_plan: z.string().optional().nullable(),
  requested_start_date: z.string().optional().nullable(),
  requested_end_date: z.string().optional().nullable(),
  owner_id: z.number().int().positive().optional().nullable(),
  implementer_id: z.number().int().positive().optional().nullable(),
  affected_cis: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'under_review', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'rolled_back']).optional()
})

/**
 * GET /api/changes/[id] - Get Change Request Details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    const { id } = await params
    const changeId = parseInt(id)
    if (isNaN(changeId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get change request with related data
    const change = await executeQueryOne<Record<string, unknown>>(`
      SELECT
        cr.*,
        ct.name as change_type_name,
        ct.color as change_type_color,
        ct.requires_cab_approval,
        u_req.name as requester_name,
        u_req.email as requester_email,
        u_owner.name as owner_name,
        u_owner.email as owner_email,
        u_impl.name as implementer_name,
        u_impl.email as implementer_email
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      LEFT JOIN users u_req ON cr.requester_id = u_req.id
      LEFT JOIN users u_owner ON cr.owner_id = u_owner.id
      LEFT JOIN users u_impl ON cr.implementer_id = u_impl.id
      WHERE cr.id = ? AND cr.organization_id = ?
    `, [changeId, organizationId])

    if (!change) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não encontrada' },
        { status: 404 }
      )
    }

    // Get approvals
    const approvals = await executeQuery<Record<string, unknown>>(`
      SELECT
        a.*,
        u.name as approver_name,
        u.email as approver_email
      FROM change_request_approvals a
      LEFT JOIN users u ON a.approver_id = u.id
      WHERE a.change_request_id = ?
      ORDER BY a.approval_level ASC
    `, [changeId])

    // Get affected CIs
    const affectedCIs = await executeQuery<Record<string, unknown>>(`
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
    `, [changeId])

    // Get CAB meeting if scheduled
    const cabMeeting = await executeQueryOne<Record<string, unknown>>(`
      SELECT
        m.*,
        u.name as organizer_name
      FROM cab_meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      WHERE m.id = (
        SELECT cab_meeting_id FROM change_requests WHERE id = ?
      )
    `, [changeId])

    // Get history/comments
    const history = await executeQuery<Record<string, unknown>>(`
      SELECT
        c.*,
        u.name as author_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
      ORDER BY c.created_at DESC
    `, [changeId])

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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    const { id } = await params
    const changeId = parseInt(id)
    if (isNaN(changeId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const data = updateChangeSchema.parse(body)

    // Check if change exists
    const existingChange = await executeQueryOne<Record<string, unknown>>(
      `SELECT * FROM change_requests WHERE id = ? AND organization_id = ?`,
      [changeId, organizationId]
    )

    if (!existingChange) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não encontrada' },
        { status: 404 }
      )
    }

    // Check permissions - only requester, owner, implementer, or admin/manager can update
    const canUpdate =
      userId === existingChange.requester_id ||
      userId === existingChange.owner_id ||
      userId === existingChange.implementer_id ||
      ['admin', 'manager'].includes(role)

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

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(changeId, organizationId)

    await executeRun(`
      UPDATE change_requests
      SET ${updates.join(', ')}
      WHERE id = ? AND organization_id = ?
    `, values)

    // Get updated change
    const updatedChange = await executeQueryOne<Record<string, unknown>>(
      `SELECT * FROM change_requests WHERE id = ?`,
      [changeId]
    )

    logger.info(`Change request updated: ${changeId} by user ${userId}`)

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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    const { id } = await params
    const changeId = parseInt(id)
    if (isNaN(changeId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Check if change exists
    const change = await executeQueryOne<{ status: string; requester_id: number; change_number: string }>(
      `SELECT * FROM change_requests WHERE id = ? AND organization_id = ?`,
      [changeId, organizationId]
    )

    if (!change) {
      return NextResponse.json(
        { success: false, error: 'Requisição de mudança não encontrada' },
        { status: 404 }
      )
    }

    // Only allow cancellation of draft/submitted changes, or by admin
    const canCancel =
      ['draft', 'submitted', 'under_review'].includes(change.status) &&
      (userId === change.requester_id || role === 'admin')

    if (!canCancel && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas mudanças em rascunho ou submetidas podem ser canceladas' },
        { status: 403 }
      )
    }

    // Cancel instead of delete
    await executeRun(`
      UPDATE change_requests
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [changeId])

    logger.info(`Change request cancelled: ${change.change_number} by user ${userId}`)

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
