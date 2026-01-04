import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import emailService from '@/lib/email/service'
import db from '@/lib/db/connection'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const offset = (page - 1) * limit

    // Build query
    let whereClause = 'WHERE tenant_id = ?'
    const queryParams: (string | number)[] = [tenantContext.id]

    if (status) {
      whereClause += ' AND status = ?'
      queryParams.push(status)
    }

    if (priority) {
      whereClause += ' AND priority = ?'
      queryParams.push(priority)
    }

    // Get emails from queue
    const emails = db.prepare(`
      SELECT
        id, to_email, cc_emails, bcc_emails, subject, template_type,
        priority, status, attempts, max_attempts, scheduled_at,
        sent_at, error_message, created_at
      FROM email_queue
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset)

    // Get total count
    const total = (db.prepare(`
      SELECT COUNT(*) as count
      FROM email_queue
      ${whereClause}
    `).get(...queryParams) as any)?.count || 0

    // Get statistics
    const stats = db.prepare(`
      SELECT
        status,
        priority,
        COUNT(*) as count
      FROM email_queue
      WHERE tenant_id = ?
      GROUP BY status, priority
    `).all(tenantContext.id)

    return NextResponse.json({
      success: true,
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    })

  } catch (error) {
    logger.error('Error fetching email queue', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    if (!['super_admin', 'tenant_admin'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const { action, limit = 10 } = await request.json()

    if (action === 'process') {
      // Process email queue
      await emailService.processEmailQueue(limit)

      return NextResponse.json({
        success: true,
        message: `Processando até ${limit} emails da fila`
      })
    }

    if (action === 'clear_failed') {
      // Clear failed emails older than 7 days
      const result = db.prepare(`
        DELETE FROM email_queue
        WHERE tenant_id = ?
          AND status = 'failed'
          AND created_at < datetime('now', '-7 days')
      `).run(tenantContext.id)

      return NextResponse.json({
        success: true,
        message: `${result.changes} emails falhados removidos`,
        deletedCount: result.changes
      })
    }

    if (action === 'retry_failed') {
      // Reset failed emails to pending (with attempts reset)
      const result = db.prepare(`
        UPDATE email_queue
        SET status = 'pending', attempts = 0, error_message = NULL
        WHERE tenant_id = ?
          AND status = 'failed'
          AND attempts < max_attempts
      `).run(tenantContext.id)

      return NextResponse.json({
        success: true,
        message: `${result.changes} emails adicionados novamente à fila`,
        retryCount: result.changes
      })
    }

    return NextResponse.json({
      error: 'Ação inválida'
    }, { status: 400 })

  } catch (error) {
    logger.error('Error processing email queue action', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}