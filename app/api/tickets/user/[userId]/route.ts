import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne } from '@/lib/db/adapter'
import { logger } from '@/lib/monitoring/logger'
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { z } from 'zod'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schema for userId parameter
const userIdSchema = z.coerce.number().int().min(1).max(2147483647)

/**
 * GET /api/tickets/user/[userId]
 *
 * Fetches all tickets for a specific user.
 * SECURITY: Requires authentication and validates ownership or admin role.
 *
 * @param userId - The ID of the user whose tickets to fetch
 * @returns List of tickets with related information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // SECURITY: Rate limiting
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
    if (rateLimitResponse) return rateLimitResponse;
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const authenticatedUser = guard.context!.user

    // 2. INPUT VALIDATION: Validate and sanitize userId parameter
    const { userId: userIdParam } = await params
    const userIdResult = userIdSchema.safeParse(userIdParam)

    if (!userIdResult.success) {
      logger.warn('Invalid userId parameter', { userId: userIdParam, errors: userIdResult.error })
      return NextResponse.json(
        { success: false, error: 'ID de usuário inválido' },
        { status: 400 }
      )
    }

    const userId = userIdResult.data

    // 3. AUTHORIZATION: user can only see own tickets unless role is elevated
    const isElevatedRole = ['admin', 'agent', 'manager', 'super_admin', 'tenant_admin', 'team_manager'].includes(authenticatedUser.role)
    if (!isElevatedRole && authenticatedUser.id !== userId) {
      logger.warn('Forbidden access attempt to user tickets', {
        requestingUserId: authenticatedUser.id,
        targetUserId: userId,
        requestingUserRole: authenticatedUser.role
      })
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // 4. VERIFY TARGET USER EXISTS AND BELONGS TO SAME TENANT
    const targetUser = await executeQueryOne<{ id: number }>(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
      [userId, tenantContext.id]
    )

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // 5. FETCH TICKETS with tenant filter for defense in depth
    const tickets = await executeQuery(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        s.name as status,
        s.color as status_color,
        p.name as priority,
        p.color as priority_color,
        c.name as category,
        c.color as category_color,
        u.name as assigned_agent_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
      LEFT JOIN users u ON t.assigned_to = u.id AND u.tenant_id = ?
      WHERE t.user_id = ? AND t.tenant_id = ?
      ORDER BY t.created_at DESC
    `, [tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id, userId, tenantContext.id])

    logger.info('User tickets fetched successfully', {
      userId,
      ticketCount: tickets.length,
      requestedBy: authenticatedUser.id
    })

    return NextResponse.json({
      success: true,
      tickets
    })
  } catch (error) {
    logger.error('Error fetching user tickets', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
