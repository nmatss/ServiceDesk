import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQuery, executeQueryOne, executeRun, RunResult } from '@/lib/db/adapter';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger'
import { jsonWithCache } from '@/lib/api/cache-headers'
import { cacheInvalidation } from '@/lib/api/cache'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Get tenant context from middleware
    const tenantContext = getTenantContextFromRequest(request)

    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // Query statuses with tenant isolation
    let statuses: unknown[]
    try {
      statuses = await executeQuery(`
        SELECT id, name, description, color, is_final, is_initial,
               is_customer_visible, requires_comment, next_statuses,
               automated_actions, sort_order, status_type, slug,
               created_at, updated_at
        FROM statuses
        WHERE tenant_id = ? AND is_active_new = 1
        ORDER BY sort_order, name
      `, [tenantContext.id])
    } catch {
      try {
        statuses = await executeQuery(`
          SELECT id, name, description, color, is_final,
                 created_at, updated_at
          FROM statuses
          WHERE tenant_id = ?
          ORDER BY name
        `, [tenantContext.id])
      } catch {
        statuses = await executeQuery(`
          SELECT id, name, description, color, is_final,
                 created_at, updated_at
          FROM statuses
          WHERE organization_id = ?
          ORDER BY name
        `, [tenantContext.id])
      }
    }

    // Parse JSON fields
    const parsedStatuses = (statuses as Array<Record<string, unknown>>).map((status: Record<string, unknown>) => ({
      ...status,
      next_statuses: status.next_statuses ? JSON.parse(status.next_statuses as string) : null,
      automated_actions: status.automated_actions ? JSON.parse(status.automated_actions as string) : null
    }))

    return jsonWithCache({
      success: true,
      statuses: parsedStatuses
    }, 'LONG_STATIC') // Cache for 30 minutes - statuses rarely change
  } catch (error) {
    logger.error('Error fetching statuses', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { success: false, error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // SECURITY: Require authentication for creating statuses
    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Only admins can create statuses
    if (!['super_admin', 'tenant_admin', 'admin'].includes(userContext.role)) {
      return NextResponse.json(
        { success: false, error: 'Permissão insuficiente' },
        { status: 403 }
      )
    }

    const { name, description, color, is_final, requires_comment, next_statuses } = await request.json()

    if (!name || !color) {
      return NextResponse.json(
        { success: false, error: 'Nome e cor são obrigatórios' },
        { status: 400 }
      )
    }

    // Create new status with tenant isolation
    let result: RunResult
    try {
      result = await executeRun(`
        INSERT INTO statuses (name, description, color, is_final, requires_comment,
                             next_statuses, tenant_id, is_active_new)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [name,
        description || null,
        color,
        is_final || false,
        requires_comment || false,
        next_statuses ? JSON.stringify(next_statuses) : null,
        tenantContext.id])
    } catch {
      try {
        result = await executeRun(`
          INSERT INTO statuses (name, description, color, is_final, tenant_id)
          VALUES (?, ?, ?, ?, ?)
        `, [name,
          description || null,
          color,
          is_final || false,
          tenantContext.id])
      } catch {
        result = await executeRun(`
          INSERT INTO statuses (name, description, color, is_final, organization_id)
          VALUES (?, ?, ?, ?, ?)
        `, [name,
          description || null,
          color,
          is_final || false,
          tenantContext.id])
      }
    }

    // Get created status
    const newStatus = await executeQueryOne('SELECT * FROM statuses WHERE id = ?', [result.lastInsertRowid])

    // Invalidate statuses cache
    await cacheInvalidation.byTag('statuses')

    return NextResponse.json({
      success: true,
      status: newStatus
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating status', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
