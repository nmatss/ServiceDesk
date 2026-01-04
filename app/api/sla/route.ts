import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { verifyTokenFromCookies } from '@/lib/auth/sqlite-auth'
import { logger } from '@/lib/monitoring/logger'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Verificar autenticação via cookies httpOnly
    const decoded = await verifyTokenFromCookies(request)
    if (!decoded) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Get tenant ID from authenticated user (fallback to 1 for dev)
    const tenantId = decoded.organization_id || 1

    // Get SLA policies
    const slaList = db.prepare(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.priority_id,
        s.category_id,
        s.business_hours_only,
        s.response_time_minutes,
        s.resolution_time_minutes,
        s.escalation_time_minutes,
        s.is_active,
        s.created_at,
        s.updated_at,
        p.name as priority_name,
        c.name as category_name
      FROM sla_policies s
      LEFT JOIN priorities p ON s.priority_id = p.id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.tenant_id = ? OR s.tenant_id IS NULL
      ORDER BY s.name
    `).all(tenantId)

    return NextResponse.json({
      success: true,
      sla_policies: slaList
    })
  } catch (error) {
    logger.error('Error fetching SLA policies', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // SECURITY: Verificar autenticação via cookies httpOnly
    const decoded = await verifyTokenFromCookies(request)
    if (!decoded) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Get tenant ID from authenticated user (fallback to 1 for dev)
    const tenantId = decoded.organization_id || 1

    // Only admin users can create SLA policies
    const adminRoles = ['admin', 'super_admin', 'tenant_admin', 'team_manager']
    if (!adminRoles.includes(decoded.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const {
      name,
      description,
      priority_id,
      category_id,
      business_hours_only,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes,
      is_active
    } = await request.json()

    if (!name || !response_time_minutes || !resolution_time_minutes) {
      return NextResponse.json({
        error: 'Nome, tempo de resposta e tempo de resolução são obrigatórios'
      }, { status: 400 })
    }

    // Validate priority and category if provided
    if (priority_id) {
      const priority = db.prepare('SELECT id FROM priorities WHERE id = ?')
        .get(priority_id)
      if (!priority) {
        return NextResponse.json({ error: 'Prioridade não encontrada' }, { status: 404 })
      }
    }

    if (category_id) {
      const category = db.prepare('SELECT id FROM categories WHERE id = ?')
        .get(category_id)
      if (!category) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
      }
    }

    // Create SLA policy
    const result = db.prepare(`
      INSERT INTO sla_policies (name, description, priority_id, category_id,
                               business_hours_only, response_time_minutes,
                               resolution_time_minutes, escalation_time_minutes,
                               is_active, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      priority_id || null,
      category_id || null,
      business_hours_only ? 1 : 0,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes || null,
      is_active !== false ? 1 : 0,
      tenantId
    )

    // Get created SLA policy with related data
    const newSlaPolicy = db.prepare(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.priority_id,
        s.category_id,
        s.business_hours_only,
        s.response_time_minutes,
        s.resolution_time_minutes,
        s.escalation_time_minutes,
        s.is_active,
        s.created_at,
        s.updated_at,
        p.name as priority_name,
        c.name as category_name
      FROM sla_policies s
      LEFT JOIN priorities p ON s.priority_id = p.id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      sla_policy: newSlaPolicy
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating SLA policy', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}