/**
 * CAB (Change Advisory Board) API
 *
 * Manages CAB meetings, members, and change approvals according to ITIL 4.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schemas
const createMeetingSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  meeting_type: z.enum(['regular', 'emergency', 'ad_hoc']).default('regular'),
  scheduled_date: z.string().min(1, 'Data é obrigatória'),
  scheduled_time: z.string().min(1, 'Horário é obrigatório'),
  duration_minutes: z.number().int().positive().default(60),
  location: z.string().optional(),
  meeting_url: z.string().url().optional(),
  change_request_ids: z.array(z.number().int().positive()).optional(),
  attendee_ids: z.array(z.number().int().positive()).optional()
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  meeting_type: z.enum(['regular', 'emergency', 'ad_hoc']).optional(),
  upcoming: z.coerce.boolean().optional()
})

const voteSchema = z.object({
  change_request_id: z.number().int().positive(),
  vote: z.enum(['approved', 'rejected', 'abstained', 'deferred']),
  comments: z.string().optional(),
  conditions: z.string().optional()
})

/**
 * GET /api/cab - List CAB Meetings
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    // Only admins, managers, and CAB members can view meetings
    if (!['admin', 'manager'].includes(role)) {
      // Check if user is a CAB member
      const isCabMember = await executeQueryOne<{ result: number }>(
        `SELECT 1 as result FROM cab_members WHERE user_id = ? AND is_active = 1`,
        [userId]
      )

      if (!isCabMember) {
        return NextResponse.json(
          { success: false, error: 'Acesso restrito a membros do CAB' },
          { status: 403 }
        )
      }
    }

    const { searchParams } = new URL(request.url)
    const params = querySchema.parse(Object.fromEntries(searchParams))

    const offset = (params.page - 1) * params.limit

    // Build query
    let whereClause = 'WHERE m.organization_id = ?'
    const queryParams: (string | number)[] = [organizationId]

    if (params.status) {
      whereClause += ' AND m.status = ?'
      queryParams.push(params.status)
    }

    if (params.meeting_type) {
      whereClause += ' AND m.meeting_type = ?'
      queryParams.push(params.meeting_type)
    }

    if (params.upcoming) {
      whereClause += ' AND m.scheduled_date >= date("now") AND m.status = "scheduled"'
    }

    // Get total count
    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM cab_meetings m ${whereClause}`,
      queryParams
    )

    // Get meetings with organizer info
    const meetings = await executeQuery<any>(
      `SELECT
        m.*,
        u.name as organizer_name,
        u.email as organizer_email,
        (SELECT COUNT(*) FROM change_requests WHERE cab_meeting_id = m.id) as change_count,
        (SELECT COUNT(*) FROM cab_members cm
         LEFT JOIN users cu ON cm.user_id = cu.id
         WHERE cm.organization_id = m.organization_id AND cm.is_active = 1) as member_count
      FROM cab_meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      ${whereClause}
      ORDER BY m.scheduled_date DESC, m.scheduled_time DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    )

    // Get CAB configuration
    const cabConfig = await executeQueryOne<any>(
      `SELECT * FROM cab_configurations WHERE organization_id = ?`,
      [organizationId]
    )

    return NextResponse.json({
      success: true,
      meetings,
      cab_configuration: cabConfig,
      pagination: {
        total: countResult?.total || 0,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil((countResult?.total || 0) / params.limit)
      }
    })
  } catch (error) {
    logger.error('Error listing CAB meetings', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar reuniões do CAB' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cab - Create CAB Meeting
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    // Only admins and managers can create meetings
    if (!['admin', 'manager'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem criar reuniões do CAB' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createMeetingSchema.parse(body)

    // Create meeting
    const result = await executeRun(
      `INSERT INTO cab_meetings (
        title, description, meeting_type, scheduled_date, scheduled_time,
        duration_minutes, location, meeting_url, organizer_id, status, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [
        data.title,
        data.description || null,
        data.meeting_type,
        data.scheduled_date,
        data.scheduled_time,
        data.duration_minutes,
        data.location || null,
        data.meeting_url || null,
        userId,
        organizationId
      ]
    )

    const meetingId = result.lastInsertRowid

    // Link change requests to meeting
    if (data.change_request_ids && data.change_request_ids.length > 0) {
      for (const changeId of data.change_request_ids) {
        await executeRun(
          `UPDATE change_requests SET cab_meeting_id = ?, status = 'pending_cab'
          WHERE id = ? AND organization_id = ?`,
          [meetingId, changeId, organizationId]
        )
      }
    }

    // Get created meeting
    const meeting = await executeQueryOne<any>(
      `SELECT m.*, u.name as organizer_name
      FROM cab_meetings m
      LEFT JOIN users u ON m.organizer_id = u.id
      WHERE m.id = ?`,
      [meetingId]
    )

    logger.info(`CAB meeting created: ${data.title} by user ${userId}`)

    return NextResponse.json({
      success: true,
      meeting,
      message: 'Reunião do CAB criada com sucesso'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error creating CAB meeting', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar reunião do CAB' },
      { status: 500 }
    )
  }
}
