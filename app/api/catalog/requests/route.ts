/**
 * Service Requests API
 *
 * Provides endpoints for creating and managing service requests from the catalog.
 * Supports ITIL Service Request Management with approvals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schemas
const createRequestSchema = z.object({
  catalog_item_id: z.number().int().positive(),
  form_data: z.record(z.string(), z.any()),
  justification: z.string().optional(),
  requested_date: z.string().optional(),
  on_behalf_of_id: z.number().int().positive().optional()
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'in_progress', 'fulfilled', 'cancelled', 'failed']).optional(),
  catalog_item_id: z.coerce.number().int().positive().optional(),
  requester_id: z.coerce.number().int().positive().optional(),
  my_requests: z.coerce.boolean().optional()
})

/**
 * Generate unique service request number
 */
async function generateRequestNumber(): Promise<string> {
  const result = await executeQueryOne<{ max_num: number | null }>(
    `SELECT MAX(CAST(SUBSTR(request_number, 4) AS INTEGER)) as max_num
     FROM service_requests WHERE request_number LIKE 'SR-%'`,
    []
  )

  const nextNum = (result?.max_num || 0) + 1
  return `SR-${String(nextNum).padStart(5, '0')}`
}

/**
 * GET /api/catalog/requests - List Service Requests
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
    let whereClause = 'WHERE sr.organization_id = ?'
    const queryParams: (string | number)[] = [organizationId]

    // Regular users can only see their own requests
    if (role === 'user' || params.my_requests) {
      whereClause += ' AND (sr.requester_id = ? OR sr.on_behalf_of_id = ?)'
      queryParams.push(userId, userId)
    }

    if (params.status) {
      whereClause += ' AND sr.status = ?'
      queryParams.push(params.status)
    }

    if (params.catalog_item_id) {
      whereClause += ' AND sr.catalog_item_id = ?'
      queryParams.push(params.catalog_item_id)
    }

    if (params.requester_id && role !== 'user') {
      whereClause += ' AND sr.requester_id = ?'
      queryParams.push(params.requester_id)
    }

    // Get total count
    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM service_requests sr ${whereClause}`,
      queryParams
    )

    // Get requests with related data
    const requests = await executeQuery<any>(
      `SELECT
        sr.*,
        sc.name as catalog_item_name,
        sc.icon as catalog_item_icon,
        sc.short_description as catalog_item_description,
        cat.name as category_name,
        u.name as requester_name,
        u.email as requester_email,
        ob.name as on_behalf_of_name
      FROM service_requests sr
      LEFT JOIN service_catalog_items sc ON sr.catalog_item_id = sc.id
      LEFT JOIN service_categories cat ON sc.category_id = cat.id
      LEFT JOIN users u ON sr.requester_id = u.id
      LEFT JOIN users ob ON sr.on_behalf_of_id = ob.id
      ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    )

    return NextResponse.json({
      success: true,
      service_requests: requests,
      pagination: {
        total: countResult?.total || 0,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil((countResult?.total || 0) / params.limit)
      }
    })
  } catch (error) {
    logger.error('Error listing service requests', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar solicitações' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/catalog/requests - Create Service Request
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!
    const userName = guard.auth!.name || ''
    const userEmail = guard.auth!.email

    const body = await request.json()
    const data = createRequestSchema.parse(body)

    // Get catalog item
    const catalogItem = await executeQueryOne<{
      id: number
      name: string
      requires_approval: boolean
      auto_approve_roles: string | null
      sla_policy_id: number | null
      estimated_fulfillment_time: number | null
      fulfillment_team_id: number | null
    }>(
      `SELECT * FROM service_catalog_items WHERE id = ? AND is_active = 1`,
      [data.catalog_item_id]
    )

    if (!catalogItem) {
      return NextResponse.json(
        { success: false, error: 'Item do catálogo não encontrado ou inativo' },
        { status: 404 }
      )
    }

    const requestNumber = await generateRequestNumber()

    // Check if approval is required
    let approvalStatus: 'pending' | 'not_required' = 'not_required'
    let status: 'submitted' | 'pending_approval' = 'submitted'

    if (catalogItem.requires_approval) {
      // Check if user role allows auto-approval
      const autoApproveRoles = catalogItem.auto_approve_roles
        ? JSON.parse(catalogItem.auto_approve_roles) as string[]
        : []

      if (autoApproveRoles.includes(role)) {
        approvalStatus = 'not_required'
        status = 'submitted'
      } else {
        approvalStatus = 'pending'
        status = 'pending_approval'
      }
    }

    const result = await executeRun(
      `INSERT INTO service_requests (
        request_number, catalog_item_id, requester_id, requester_name, requester_email,
        on_behalf_of_id, form_data, justification, requested_date, status, approval_status,
        organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestNumber,
        data.catalog_item_id,
        userId,
        userName,
        userEmail,
        data.on_behalf_of_id || null,
        JSON.stringify(data.form_data),
        data.justification || null,
        data.requested_date || null,
        status,
        approvalStatus,
        organizationId
      ]
    )

    // If approval is required, create approval record
    if (approvalStatus === 'pending') {
      await executeRun(
        `INSERT INTO service_request_approvals (
          service_request_id, approval_level, status
        ) VALUES (?, 1, 'pending')`,
        [result.lastInsertRowid]
      )
    }

    // Get created request
    const serviceRequest = await executeQueryOne<any>(
      `SELECT sr.*, sc.name as catalog_item_name
      FROM service_requests sr
      LEFT JOIN service_catalog_items sc ON sr.catalog_item_id = sc.id
      WHERE sr.id = ?`,
      [result.lastInsertRowid]
    )

    logger.info(`Service request created: ${requestNumber} by user ${userId}`)

    return NextResponse.json({
      success: true,
      service_request: serviceRequest,
      message: approvalStatus === 'pending'
        ? 'Solicitação criada e aguardando aprovação'
        : 'Solicitação criada com sucesso'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error creating service request', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar solicitação' },
      { status: 500 }
    )
  }
}
