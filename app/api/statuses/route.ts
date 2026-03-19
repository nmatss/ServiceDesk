import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQuery, executeQueryOne, executeRun, RunResult } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { jsonWithCache } from '@/lib/api/cache-headers'
import { cacheInvalidation } from '@/lib/api/cache'
import { isAdmin } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, context, response } = requireTenantUserContext(request)
    if (response) return response

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
      `, [auth.organizationId])
    } catch (err) {
      logger.warn('Statuses GET: extended schema query failed, trying simple schema', err);
      try {
        statuses = await executeQuery(`
          SELECT id, name, description, color, is_final,
                 created_at, updated_at
          FROM statuses
          WHERE tenant_id = ?
          ORDER BY name
        `, [auth.organizationId])
      } catch (err) {
        logger.warn('Statuses GET: tenant_id query failed, trying organization_id', err);
        statuses = await executeQuery(`
          SELECT id, name, description, color, is_final,
                 created_at, updated_at
          FROM statuses
          WHERE organization_id = ?
          ORDER BY name
        `, [auth.organizationId])
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
    const { auth, context, response } = requireTenantUserContext(request)
    if (response) return response

    // Only admins can create statuses
    if (!isAdmin(auth.role)) {
      return NextResponse.json(
        { success: false, error: 'Permissão insuficiente' },
        { status: 403 }
      )
    }

    const { name, description, color, is_final, requires_comment, next_statuses } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }
    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Nome deve ter no máximo 100 caracteres' },
        { status: 400 }
      )
    }
    if (!color || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json(
        { success: false, error: 'Cor inválida (formato: #RRGGBB)' },
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
        auth.organizationId])
    } catch (err) {
      logger.warn('Statuses POST: extended schema insert failed, trying simple schema', err);
      try {
        result = await executeRun(`
          INSERT INTO statuses (name, description, color, is_final, tenant_id)
          VALUES (?, ?, ?, ?, ?)
        `, [name,
          description || null,
          color,
          is_final || false,
          auth.organizationId])
      } catch (err) {
        logger.warn('Statuses POST: tenant_id insert failed, trying organization_id', err);
        result = await executeRun(`
          INSERT INTO statuses (name, description, color, is_final, organization_id)
          VALUES (?, ?, ?, ?, ?)
        `, [name,
          description || null,
          color,
          is_final || false,
          auth.organizationId])
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
