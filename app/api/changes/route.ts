/**
 * Change Management API
 *
 * Provides endpoints for managing Change Requests according to ITIL 4.
 * Supports CAB (Change Advisory Board) workflow and approvals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db/connection'
import { verifyAuth } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

// Validation schemas
const createChangeSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  change_type_id: z.number().int().positive(),
  category: z.enum(['standard', 'normal', 'emergency']).default('normal'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  risk_level: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).default('medium'),
  impact: z.enum(['extensive', 'significant', 'moderate', 'minor', 'none']).default('moderate'),
  urgency: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  justification: z.string().optional(),
  business_case: z.string().optional(),
  implementation_plan: z.string().optional(),
  rollback_plan: z.string().optional(),
  test_plan: z.string().optional(),
  affected_services: z.string().optional(),
  affected_cis: z.array(z.number().int().positive()).optional(),
  scheduled_start_date: z.string().optional(),
  scheduled_end_date: z.string().optional(),
  downtime_required: z.boolean().default(false),
  downtime_duration: z.number().int().optional(),
  assignee_id: z.number().int().positive().optional(),
  assigned_team_id: z.number().int().positive().optional()
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'submitted', 'pending_assessment', 'pending_cab', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
  category: z.enum(['standard', 'normal', 'emergency']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  requester_id: z.coerce.number().int().positive().optional(),
  assignee_id: z.coerce.number().int().positive().optional(),
  my_changes: z.coerce.boolean().optional()
})

/**
 * Generate unique change number
 */
function generateChangeNumber(db: ReturnType<typeof getDatabase>): string {
  const result = db.prepare(
    `SELECT MAX(CAST(SUBSTR(change_number, 4) AS INTEGER)) as max_num
     FROM change_requests WHERE change_number LIKE 'CR-%'`
  ).get() as { max_num: number | null }

  const nextNum = (result?.max_num || 0) + 1
  return `CR-${String(nextNum).padStart(5, '0')}`
}

/**
 * Calculate risk score based on impact and probability
 */
function calculateRiskScore(impact: string, probability: string): number {
  const impactScores: Record<string, number> = { extensive: 5, significant: 4, moderate: 3, minor: 2, none: 1 }
  const probabilityScores: Record<string, number> = { very_high: 5, high: 4, medium: 3, low: 2, very_low: 1 }

  return (impactScores[impact] || 3) * (probabilityScores[probability] || 3)
}

/**
 * GET /api/changes - List Change Requests
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = querySchema.parse(Object.fromEntries(searchParams))

    const db = getDatabase()
    const offset = (params.page - 1) * params.limit

    // Build query
    let whereClause = 'WHERE cr.organization_id = ?'
    const queryParams: (string | number)[] = [auth.user.organization_id]

    // Regular users can only see their own changes
    if (auth.user.role === 'user' || params.my_changes) {
      whereClause += ' AND cr.requester_id = ?'
      queryParams.push(auth.user.id)
    }

    if (params.status) {
      whereClause += ' AND cr.status = ?'
      queryParams.push(params.status)
    }

    if (params.category) {
      whereClause += ' AND cr.category = ?'
      queryParams.push(params.category)
    }

    if (params.priority) {
      whereClause += ' AND cr.priority = ?'
      queryParams.push(params.priority)
    }

    if (params.requester_id && auth.user.role !== 'user') {
      whereClause += ' AND cr.requester_id = ?'
      queryParams.push(params.requester_id)
    }

    if (params.assignee_id) {
      whereClause += ' AND cr.assignee_id = ?'
      queryParams.push(params.assignee_id)
    }

    // Get total count
    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM change_requests cr ${whereClause}`
    ).get(...queryParams) as { total: number }

    // Get change requests with related data
    const changes = db.prepare(`
      SELECT
        cr.*,
        ct.name as change_type_name,
        ct.color as change_type_color,
        u_req.name as requester_name,
        u_req.email as requester_email,
        u_ass.name as assignee_name,
        t.name as team_name
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      LEFT JOIN users u_req ON cr.requester_id = u_req.id
      LEFT JOIN users u_ass ON cr.assignee_id = u_ass.id
      LEFT JOIN teams t ON cr.assigned_team_id = t.id
      ${whereClause}
      ORDER BY
        CASE cr.category WHEN 'emergency' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        CASE cr.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        cr.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, params.limit, offset)

    // Get statistics
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending_cab' THEN 1 ELSE 0 END) as pending_cab,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN category = 'emergency' THEN 1 ELSE 0 END) as emergency
      FROM change_requests
      WHERE organization_id = ?
    `).get(auth.user.organization_id)

    return NextResponse.json({
      success: true,
      change_requests: changes,
      statistics: stats,
      pagination: {
        total: countResult.total,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil(countResult.total / params.limit)
      }
    })
  } catch (error) {
    logger.error('Error listing change requests', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar requisições de mudança' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/changes - Create Change Request
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = createChangeSchema.parse(body)

    const db = getDatabase()
    const changeNumber = generateChangeNumber(db)

    // Calculate risk score
    const riskScore = calculateRiskScore(data.impact, data.risk_level)

    // Determine initial status based on category
    let initialStatus = 'draft'
    if (data.category === 'standard') {
      // Standard changes can be pre-approved
      initialStatus = 'approved'
    } else if (data.category === 'emergency') {
      // Emergency changes go directly to assessment
      initialStatus = 'pending_assessment'
    }

    const result = db.prepare(`
      INSERT INTO change_requests (
        change_number, title, description, change_type_id, category, priority,
        risk_level, impact, urgency, risk_score, justification, business_case,
        implementation_plan, rollback_plan, test_plan, affected_services,
        scheduled_start_date, scheduled_end_date, downtime_required, downtime_duration,
        requester_id, requester_name, requester_email, assignee_id, assigned_team_id,
        status, organization_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      changeNumber,
      data.title,
      data.description,
      data.change_type_id,
      data.category,
      data.priority,
      data.risk_level,
      data.impact,
      data.urgency,
      riskScore,
      data.justification || null,
      data.business_case || null,
      data.implementation_plan || null,
      data.rollback_plan || null,
      data.test_plan || null,
      data.affected_services || null,
      data.scheduled_start_date || null,
      data.scheduled_end_date || null,
      data.downtime_required ? 1 : 0,
      data.downtime_duration || null,
      auth.user.id,
      auth.user.name,
      auth.user.email,
      data.assignee_id || null,
      data.assigned_team_id || null,
      initialStatus,
      auth.user.organization_id
    )

    // Link affected CIs if provided
    if (data.affected_cis && data.affected_cis.length > 0) {
      const linkCI = db.prepare(`
        INSERT INTO ci_ticket_links (ci_id, ticket_id, link_type, linked_by)
        VALUES (?, ?, 'change', ?)
      `)

      for (const ciId of data.affected_cis) {
        try {
          linkCI.run(ciId, result.lastInsertRowid, auth.user.id)
        } catch {
          // Ignore if CI doesn't exist
        }
      }
    }

    // For normal changes, create CAB approval request
    if (data.category === 'normal' && riskScore >= 9) {
      db.prepare(`
        INSERT INTO change_request_approvals (
          change_request_id, approval_level, approver_type, status
        ) VALUES (?, 1, 'cab', 'pending')
      `).run(result.lastInsertRowid)
    }

    // Get created change request
    const changeRequest = db.prepare(`
      SELECT cr.*, ct.name as change_type_name
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      WHERE cr.id = ?
    `).get(result.lastInsertRowid)

    logger.info(`Change request created: ${changeNumber} by user ${auth.user.id}`)

    return NextResponse.json({
      success: true,
      change_request: changeRequest,
      message: data.category === 'emergency'
        ? 'Mudança emergencial criada - requer aprovação imediata'
        : 'Requisição de mudança criada com sucesso'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error creating change request', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar requisição de mudança' },
      { status: 500 }
    )
  }
}
