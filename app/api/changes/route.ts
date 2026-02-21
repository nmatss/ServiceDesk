/**
 * Change Management API
 *
 * Provides endpoints for managing Change Requests according to ITIL 4.
 * Supports CAB (Change Advisory Board) workflow and approvals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schemas
const createChangeSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  change_type_id: z.number().int().positive(),
  category: z.enum(['standard', 'normal', 'emergency']).default('normal'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  risk_assessment: z.string().optional(),
  impact_assessment: z.string().optional(),
  reason_for_change: z.string().optional(),
  business_justification: z.string().optional(),
  implementation_plan: z.string().optional(),
  backout_plan: z.string().optional(),
  test_plan: z.string().optional(),
  communication_plan: z.string().optional(),
  affected_cis: z.string().optional(),
  requested_start_date: z.string().optional(),
  requested_end_date: z.string().optional(),
  owner_id: z.number().int().positive().optional(),
  implementer_id: z.number().int().positive().optional()
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'submitted', 'under_review', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'rolled_back']).optional(),
  category: z.enum(['standard', 'normal', 'emergency']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  requester_id: z.coerce.number().int().positive().optional(),
  owner_id: z.coerce.number().int().positive().optional(),
  my_changes: z.coerce.boolean().optional()
})

/**
 * Generate unique change number
 */
async function generateChangeNumber(): Promise<string> {
  const result = await executeQueryOne<{ max_num: number | null }>(
    `SELECT MAX(CAST(SUBSTR(change_number, 4) AS INTEGER)) as max_num
     FROM change_requests WHERE change_number LIKE 'CR-%'`,
    []
  )

  const nextNum = (result?.max_num || 0) + 1
  return `CR-${String(nextNum).padStart(5, '0')}`
}

/**
 * Calculate risk score based on risk_level
 */
function calculateRiskScore(riskLevel: string): number {
  const riskScores: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return riskScores[riskLevel] || 2
}

/**
 * GET /api/changes - List Change Requests
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    const { searchParams } = new URL(request.url)
    const params = querySchema.parse(Object.fromEntries(searchParams))

    const offset = (params.page - 1) * params.limit

    // Build query
    let whereClause = 'WHERE cr.organization_id = ?'
    const queryParams: (string | number)[] = [organizationId]

    // Regular users can only see their own changes
    if (role === 'user' || params.my_changes) {
      whereClause += ' AND cr.requester_id = ?'
      queryParams.push(userId)
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

    if (params.requester_id && role !== 'user') {
      whereClause += ' AND cr.requester_id = ?'
      queryParams.push(params.requester_id)
    }

    if (params.owner_id) {
      whereClause += ' AND cr.owner_id = ?'
      queryParams.push(params.owner_id)
    }

    // Get total count
    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM change_requests cr ${whereClause}`,
      queryParams
    )

    // Get change requests with related data
    const changes = await executeQuery<Record<string, unknown>>(`
      SELECT
        cr.*,
        ct.name as change_type_name,
        ct.color as change_type_color,
        u_req.name as requester_name,
        u_req.email as requester_email,
        u_owner.name as owner_name,
        u_impl.name as implementer_name
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      LEFT JOIN users u_req ON cr.requester_id = u_req.id
      LEFT JOIN users u_owner ON cr.owner_id = u_owner.id
      LEFT JOIN users u_impl ON cr.implementer_id = u_impl.id
      ${whereClause}
      ORDER BY
        CASE cr.category WHEN 'emergency' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        CASE cr.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        cr.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, params.limit, offset])

    // Get statistics
    const stats = await executeQueryOne<Record<string, unknown>>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN category = 'emergency' THEN 1 ELSE 0 END) as emergency
      FROM change_requests
      WHERE organization_id = ?
    `, [organizationId])

    return NextResponse.json({
      success: true,
      change_requests: changes,
      statistics: stats,
      pagination: {
        total: countResult?.total || 0,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil((countResult?.total || 0) / params.limit)
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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId } = guard.auth!

    const body = await request.json()
    const data = createChangeSchema.parse(body)

    const changeNumber = await generateChangeNumber()

    // Calculate risk score
    const riskScore = calculateRiskScore(data.risk_level)

    // Determine initial status based on category
    let initialStatus = 'draft'
    if (data.category === 'standard') {
      // Standard changes can be pre-approved
      initialStatus = 'scheduled'
    } else if (data.category === 'emergency') {
      // Emergency changes go directly to review
      initialStatus = 'under_review'
    }

    const result = await executeRun(`
      INSERT INTO change_requests (
        change_number, title, description, change_type_id, category, priority,
        risk_level, risk_assessment, impact_assessment,
        reason_for_change, business_justification,
        implementation_plan, backout_plan, test_plan, communication_plan,
        requested_start_date, requested_end_date,
        requester_id, owner_id, implementer_id,
        status, affected_cis, organization_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      changeNumber,
      data.title,
      data.description,
      data.change_type_id,
      data.category,
      data.priority,
      data.risk_level,
      data.risk_assessment || null,
      data.impact_assessment || null,
      data.reason_for_change || null,
      data.business_justification || null,
      data.implementation_plan || null,
      data.backout_plan || null,
      data.test_plan || null,
      data.communication_plan || null,
      data.requested_start_date || null,
      data.requested_end_date || null,
      userId,
      data.owner_id || null,
      data.implementer_id || null,
      initialStatus,
      data.affected_cis || null,
      organizationId
    ])

    // Link affected CIs if provided (affected_cis is a JSON string of CI IDs)
    if (data.affected_cis) {
      try {
        const ciIds: number[] = JSON.parse(data.affected_cis)
        if (Array.isArray(ciIds)) {
          for (const ciId of ciIds) {
            try {
              await executeRun(`
                INSERT INTO ci_ticket_links (ci_id, ticket_id, link_type, linked_by)
                VALUES (?, ?, 'change', ?)
              `, [ciId, result.lastInsertRowid, userId])
            } catch {
              // Ignore if CI doesn't exist
            }
          }
        }
      } catch {
        // Ignore if affected_cis is not valid JSON
      }
    }

    // For normal changes with high/critical risk, create CAB approval request
    if (data.category === 'normal' && riskScore >= 3) {
      await executeRun(`
        INSERT INTO change_request_approvals (
          change_request_id, approval_level, approver_type, status
        ) VALUES (?, 1, 'cab', 'pending')
      `, [result.lastInsertRowid])
    }

    // Get created change request
    const changeRequest = await executeQueryOne<Record<string, unknown>>(`
      SELECT cr.*, ct.name as change_type_name
      FROM change_requests cr
      LEFT JOIN change_types ct ON cr.change_type_id = ct.id
      WHERE cr.id = ?
    `, [result.lastInsertRowid])

    logger.info(`Change request created: ${changeNumber} by user ${userId}`)

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
