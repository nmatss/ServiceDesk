/**
 * Governance Audit Trail API
 *
 * Provides audit log data for governance and compliance tracking.
 * Supports filtering by date range, action type, user, and risk level.
 */

import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] })
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const dateRange = searchParams.get('dateRange') || '7d'
    const action = searchParams.get('action') || 'all'
    const riskLevel = searchParams.get('riskLevel') || 'all'
    const search = searchParams.get('search') || ''
const offset = (page - 1) * limit

    // Calculate date filter
    let dateFilter = ''
    switch (dateRange) {
      case '1h':
        dateFilter = "datetime('now', '-1 hour')"
        break
      case '24h':
        dateFilter = "datetime('now', '-1 day')"
        break
      case '7d':
        dateFilter = "datetime('now', '-7 days')"
        break
      case '30d':
        dateFilter = "datetime('now', '-30 days')"
        break
      default:
        dateFilter = "datetime('now', '-7 days')"
    }

    // Build WHERE clause
    const conditions: string[] = [
      `al.organization_id = ?`,
      `al.created_at >= ${dateFilter}`
    ]
    const params: (string | number)[] = [organizationId]

    if (action !== 'all') {
      conditions.push('al.action = ?')
      params.push(action)
    }

    if (riskLevel !== 'all') {
      conditions.push('al.risk_level = ?')
      params.push(riskLevel)
    }

    if (search) {
      conditions.push(`(
        u.name LIKE ? OR
        u.email LIKE ? OR
        al.resource_name LIKE ? OR
        al.action LIKE ?
      )`)
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Try to fetch from audit_logs table, fallback to generated data if table doesn't exist
    try {
      const countResult = await executeQueryOne<{ total: number }>(`
        SELECT COUNT(*) as total
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
      `, params) || { total: 0 }

      const logs = await executeQuery<{
        id: string
        timestamp: string
        user_id: string
        user_name: string
        user_email: string
        action: string
        resource_type: string
        resource_id: string
        resource_name: string
        ip_address: string
        user_agent: string
        old_values: string | null
        new_values: string | null
        status: string
        risk_level: string
      }>(`
        SELECT
          al.id,
          al.created_at as timestamp,
          al.user_id,
          u.name as user_name,
          u.email as user_email,
          al.action,
          al.resource_type,
          al.resource_id,
          al.resource_name,
          al.ip_address,
          al.user_agent,
          al.old_values,
          al.new_values,
          al.status,
          al.risk_level
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset])

      // Parse JSON fields
      const parsedLogs = logs.map(log => ({
        ...log,
        old_values: log.old_values ? JSON.parse(log.old_values) : null,
        new_values: log.new_values ? JSON.parse(log.new_values) : null
      }))

      return NextResponse.json({
        success: true,
        logs: parsedLogs,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      })
    } catch {
      // Table doesn't exist, return sample data
      const sampleLogs = generateSampleAuditLogs()

      return NextResponse.json({
        success: true,
        logs: sampleLogs,
        pagination: {
          page: 1,
          limit: 50,
          total: sampleLogs.length,
          totalPages: 1
        },
        notice: 'Usando dados de exemplo. A tabela audit_logs ainda não foi criada.'
      })
    }
  } catch (error) {
    logger.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar logs de auditoria' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, email } = guard.auth!

    const body = await request.json()
    const {
      action,
      resource_type,
      resource_id,
      resource_name,
      old_values,
      new_values,
      ip_address,
      user_agent,
      risk_level = 'low'
    } = body
try {
      const result = await executeRun(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, resource_type, resource_id,
          resource_name, ip_address, user_agent, old_values, new_values,
          status, risk_level, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, datetime('now'))
      `, [organizationId,
        userId,
        action,
        resource_type,
        resource_id,
        resource_name || '',
        ip_address || '',
        user_agent || '',
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        risk_level])

      return NextResponse.json({
        success: true,
        id: result.lastInsertRowid
      })
    } catch {
      // Table doesn't exist, log to console instead
      logger.info('[AUDIT]', {
        user: email,
        action,
        resource_type,
        resource_id,
        resource_name,
        timestamp: new Date().toISOString()
      })

      return NextResponse.json({
        success: true,
        logged: false,
        notice: 'Audit logged to console. Table audit_logs not available.'
      })
    }
  } catch (error) {
    logger.error('Error creating audit log:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar log de auditoria' },
      { status: 500 }
    )
  }
}

function generateSampleAuditLogs() {
  const now = Date.now()
  return [
    {
      id: '1',
      timestamp: new Date(now - 5 * 60000).toISOString(),
      user_id: '1',
      user_name: 'Admin Sistema',
      user_email: 'admin@empresa.com',
      action: 'UPDATE',
      resource_type: 'ticket',
      resource_id: '1234',
      resource_name: 'Ticket #1234',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 Chrome/120',
      old_values: { status: 'open' },
      new_values: { status: 'in_progress' },
      status: 'success',
      risk_level: 'low'
    },
    {
      id: '2',
      timestamp: new Date(now - 15 * 60000).toISOString(),
      user_id: '2',
      user_name: 'Maria Santos',
      user_email: 'maria@empresa.com',
      action: 'LOGIN',
      resource_type: 'session',
      resource_id: 'sess_abc123',
      resource_name: 'User Session',
      ip_address: '10.0.0.50',
      user_agent: 'Mozilla/5.0 Firefox/121',
      old_values: null,
      new_values: null,
      status: 'success',
      risk_level: 'low'
    },
    {
      id: '3',
      timestamp: new Date(now - 30 * 60000).toISOString(),
      user_id: '3',
      user_name: 'João Silva',
      user_email: 'joao@empresa.com',
      action: 'DELETE',
      resource_type: 'attachment',
      resource_id: 'att_456',
      resource_name: 'documento_confidencial.pdf',
      ip_address: '192.168.1.105',
      user_agent: 'Mozilla/5.0 Chrome/120',
      old_values: null,
      new_values: null,
      status: 'success',
      risk_level: 'medium'
    },
    {
      id: '4',
      timestamp: new Date(now - 45 * 60000).toISOString(),
      user_id: '4',
      user_name: 'Unknown',
      user_email: 'unknown@external.com',
      action: 'LOGIN_FAILED',
      resource_type: 'auth',
      resource_id: 'auth_789',
      resource_name: 'Authentication Attempt',
      ip_address: '203.0.113.50',
      user_agent: 'curl/7.88.1',
      old_values: null,
      new_values: null,
      status: 'failure',
      risk_level: 'high'
    },
    {
      id: '5',
      timestamp: new Date(now - 60 * 60000).toISOString(),
      user_id: '1',
      user_name: 'Admin Sistema',
      user_email: 'admin@empresa.com',
      action: 'PERMISSION_CHANGE',
      resource_type: 'user',
      resource_id: 'user_5',
      resource_name: 'Carlos Oliveira',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 Chrome/120',
      old_values: { role: 'user' },
      new_values: { role: 'agent' },
      status: 'success',
      risk_level: 'high'
    }
  ]
}
