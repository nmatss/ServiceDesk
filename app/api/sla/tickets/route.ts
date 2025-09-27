import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'at_risk', 'breached', 'on_time'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query for tickets with SLA information
    let whereClause = 'WHERE t.tenant_id = ?'
    const params = [tenantContext.id]

    // Filter by SLA status if provided
    if (status === 'breached') {
      whereClause += ' AND (t.response_breached = 1 OR t.resolution_breached = 1)'
    } else if (status === 'at_risk') {
      whereClause += `
        AND (
          (t.response_due_at IS NOT NULL AND t.first_response_at IS NULL
           AND datetime('now') > datetime(t.response_due_at, '-30 minutes'))
          OR
          (t.resolution_due_at IS NOT NULL AND st.is_final = 0
           AND datetime('now') > datetime(t.resolution_due_at, '-60 minutes'))
        )
        AND t.response_breached = 0 AND t.resolution_breached = 0
      `
    } else if (status === 'on_time') {
      whereClause += `
        AND (
          (t.response_due_at IS NULL OR t.first_response_at IS NOT NULL OR datetime('now') <= t.response_due_at)
          AND (t.resolution_due_at IS NULL OR st.is_final = 1 OR datetime('now') <= t.resolution_due_at)
        )
        AND t.response_breached = 0 AND t.resolution_breached = 0
      `
    }

    const tickets = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.created_at,
        t.updated_at,
        t.response_due_at,
        t.resolution_due_at,
        t.first_response_at,
        t.response_breached,
        t.resolution_breached,
        st.name as status,
        st.is_final,
        p.name as priority,
        p.level as priority_level,
        c.name as category,
        u.name as user_name,
        sla.name as sla_policy_name,
        sla.response_time_minutes,
        sla.resolution_time_minutes,
        CASE
          WHEN t.response_breached = 1 OR t.resolution_breached = 1 THEN 'breached'
          WHEN (t.response_due_at IS NOT NULL AND t.first_response_at IS NULL
                AND datetime('now') > datetime(t.response_due_at, '-30 minutes'))
               OR (t.resolution_due_at IS NOT NULL AND st.is_final = 0
                   AND datetime('now') > datetime(t.resolution_due_at, '-60 minutes'))
          THEN 'at_risk'
          ELSE 'on_time'
        END as sla_status,
        CASE
          WHEN t.response_due_at IS NOT NULL AND t.first_response_at IS NULL THEN
            ROUND((julianday(t.response_due_at) - julianday('now')) * 24 * 60)
          WHEN t.resolution_due_at IS NOT NULL AND st.is_final = 0 THEN
            ROUND((julianday(t.resolution_due_at) - julianday('now')) * 24 * 60)
          ELSE NULL
        END as minutes_remaining
      FROM tickets t
      LEFT JOIN statuses st ON t.status_id = st.id AND st.tenant_id = ?
      LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
      LEFT JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
      LEFT JOIN sla_policies sla ON
        (sla.priority_id = t.priority_id OR sla.priority_id IS NULL)
        AND (sla.category_id = t.category_id OR sla.category_id IS NULL)
        AND sla.tenant_id = ? AND sla.is_active = 1
      ${whereClause}
      ORDER BY
        CASE
          WHEN t.response_breached = 1 OR t.resolution_breached = 1 THEN 1
          WHEN (t.response_due_at IS NOT NULL AND t.first_response_at IS NULL
                AND datetime('now') > datetime(t.response_due_at, '-30 minutes'))
               OR (t.resolution_due_at IS NOT NULL AND st.is_final = 0
                   AND datetime('now') > datetime(t.resolution_due_at, '-60 minutes'))
          THEN 2
          ELSE 3
        END,
        t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(
      tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id,
      ...params, limit, offset
    )

    // Get SLA statistics
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.response_breached = 1 OR t.resolution_breached = 1 THEN 1 ELSE 0 END) as breached_tickets,
        SUM(CASE
          WHEN (t.response_due_at IS NOT NULL AND t.first_response_at IS NULL
                AND datetime('now') > datetime(t.response_due_at, '-30 minutes'))
               OR (t.resolution_due_at IS NOT NULL AND st.is_final = 0
                   AND datetime('now') > datetime(t.resolution_due_at, '-60 minutes'))
               AND t.response_breached = 0 AND t.resolution_breached = 0
          THEN 1 ELSE 0 END) as at_risk_tickets,
        SUM(CASE
          WHEN (t.response_due_at IS NULL OR t.first_response_at IS NOT NULL OR datetime('now') <= t.response_due_at)
               AND (t.resolution_due_at IS NULL OR st.is_final = 1 OR datetime('now') <= t.resolution_due_at)
               AND t.response_breached = 0 AND t.resolution_breached = 0
          THEN 1 ELSE 0 END) as on_time_tickets,
        AVG(CASE
          WHEN t.first_response_at IS NOT NULL THEN
            ROUND((julianday(t.first_response_at) - julianday(t.created_at)) * 24 * 60)
          ELSE NULL
        END) as avg_response_time_minutes,
        AVG(CASE
          WHEN st.is_final = 1 THEN
            ROUND((julianday(t.updated_at) - julianday(t.created_at)) * 24 * 60)
          ELSE NULL
        END) as avg_resolution_time_minutes
      FROM tickets t
      LEFT JOIN statuses st ON t.status_id = st.id AND st.tenant_id = ?
      WHERE t.tenant_id = ?
    `).get(tenantContext.id, tenantContext.id)

    return NextResponse.json({
      success: true,
      tickets,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.total_tickets
      }
    })
  } catch (error) {
    console.error('Error fetching SLA ticket data:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}