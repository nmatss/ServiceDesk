import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { verifyTokenFromCookies } from '@/lib/auth/auth-service'
import { logger } from '@/lib/monitoring/logger'
import { ADMIN_ROLES } from '@/lib/auth/roles';

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

    // SECURITY: Get tenant ID from authenticated user - fail if missing
    const tenantId = decoded.organization_id
    if (!tenantId) {
      return NextResponse.json({ error: 'Organization ID não encontrado no token' }, { status: 401 })
    }

    // Get SLA policies
    const slaList = await executeQuery(`
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
    `, [tenantId])

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

    // SECURITY: Get tenant ID from authenticated user - fail if missing
    const tenantId = decoded.organization_id
    if (!tenantId) {
      return NextResponse.json({ error: 'Organization ID não encontrado no token' }, { status: 401 })
    }

    // Only admin users can create SLA policies
    if (!ADMIN_ROLES.includes(decoded.role)) {
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
      const priority = await executeQueryOne('SELECT id FROM priorities WHERE id = ?', [priority_id])
      if (!priority) {
        return NextResponse.json({ error: 'Prioridade não encontrada' }, { status: 404 })
      }
    }

    if (category_id) {
      const category = await executeQueryOne('SELECT id FROM categories WHERE id = ?', [category_id])
      if (!category) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
      }
    }

    // Create SLA policy
    const result = await executeRun(`
      INSERT INTO sla_policies (name, description, priority_id, category_id,
                               business_hours_only, response_time_minutes,
                               resolution_time_minutes, escalation_time_minutes,
                               is_active, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name,
      description || null,
      priority_id || null,
      category_id || null,
      business_hours_only ? 1 : 0,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes || null,
      is_active !== false ? 1 : 0,
      tenantId])

    // Get created SLA policy with related data
    const newSlaPolicy = await executeQueryOne(`
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
    `, [result.lastInsertRowid])

    return NextResponse.json({
      success: true,
      sla_policy: newSlaPolicy
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating SLA policy', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}