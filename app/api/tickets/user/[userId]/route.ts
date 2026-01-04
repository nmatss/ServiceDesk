import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger'
import { verifyTokenFromCookies } from '@/lib/auth/sqlite-auth'
import { hasOwnershipOrAdmin, validateTenantIsolation } from '@/lib/auth/permissions'
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
    // 1. AUTHENTICATION: Verify user is logged in
    const authenticatedUser = await verifyTokenFromCookies(request)
    if (!authenticatedUser) {
      logger.warn('Unauthorized access attempt to user tickets endpoint')
      return NextResponse.json(
        { success: false, error: 'Autenticação necessária' },
        { status: 401 }
      )
    }

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

    // 3. AUTHORIZATION: Verify user can access this resource
    // User can only see their own tickets unless they're an admin
    if (!hasOwnershipOrAdmin(authenticatedUser, userId)) {
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

    // 4. VERIFY TARGET USER EXISTS AND BELONGS TO SAME ORGANIZATION
    const targetUser = db.prepare(
      'SELECT id, organization_id FROM users WHERE id = ?'
    ).get(userId) as { id: number; organization_id: number } | undefined

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // 5. TENANT ISOLATION: Ensure user belongs to same organization
    if (!validateTenantIsolation(authenticatedUser.organization_id, targetUser.organization_id)) {
      logger.warn('Cross-tenant access attempt detected', {
        requestingUserOrgId: authenticatedUser.organization_id,
        targetUserOrgId: targetUser.organization_id
      })
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // 6. FETCH TICKETS: Query with organization filter for defense in depth
    const tickets = db.prepare(`
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
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.user_id = ? AND t.organization_id = ?
      ORDER BY t.created_at DESC
    `).all(userId, authenticatedUser.organization_id)

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
