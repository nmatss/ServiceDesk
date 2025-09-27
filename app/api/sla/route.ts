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
      LEFT JOIN priorities p ON s.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON s.category_id = c.id AND c.tenant_id = ?
      WHERE s.tenant_id = ?
      ORDER BY s.name
    `).all(tenantContext.id, tenantContext.id, tenantContext.id)

    return NextResponse.json({
      success: true,
      sla_policies: slaList
    })
  } catch (error) {
    console.error('Error fetching SLA policies:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Only admin users can create SLA policies
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
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
      const priority = db.prepare('SELECT id FROM priorities WHERE id = ? AND tenant_id = ?')
        .get(priority_id, tenantContext.id)
      if (!priority) {
        return NextResponse.json({ error: 'Prioridade não encontrada' }, { status: 404 })
      }
    }

    if (category_id) {
      const category = db.prepare('SELECT id FROM categories WHERE id = ? AND tenant_id = ?')
        .get(category_id, tenantContext.id)
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
      tenantContext.id
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
      LEFT JOIN priorities p ON s.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON s.category_id = c.id AND c.tenant_id = ?
      WHERE s.id = ?
    `).get(tenantContext.id, tenantContext.id, result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      sla_policy: newSlaPolicy
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating SLA policy:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}