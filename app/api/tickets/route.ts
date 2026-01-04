import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Query base considerando tenant isolation
    let query = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        s.name as status,
        p.name as priority,
        c.name as category,
        u.name as user_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
      LEFT JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
      WHERE t.tenant_id = ?
    `

    const params = [
      tenantContext.id, // statuses tenant_id
      tenantContext.id, // priorities tenant_id
      tenantContext.id, // categories tenant_id
      tenantContext.id, // users tenant_id
      tenantContext.id  // tickets tenant_id
    ]

    // Se não for admin, mostrar apenas tickets do usuário
    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
      query += ' AND t.user_id = ?'
      params.push(userContext.id)
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const tickets = db.prepare(query).all(...params)

    // Contar total de tickets
    let countQuery = 'SELECT COUNT(*) as total FROM tickets WHERE tenant_id = ?'
    let countParams = [tenantContext.id]

    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
      countQuery += ' AND user_id = ?'
      countParams.push(userContext.id)
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number }

    return NextResponse.json({
      success: true,
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error fetching tickets', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
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
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { title, description, category_id, priority_id } = await request.json()

    if (!title || !description || !category_id || !priority_id) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se categoria e prioridade existem e pertencem ao tenant
    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND tenant_id = ?').get(category_id, tenantContext.id)
    const priority = db.prepare('SELECT id FROM priorities WHERE id = ? AND tenant_id = ?').get(priority_id, tenantContext.id)

    if (!category || !priority) {
      return NextResponse.json(
        { error: 'Categoria ou prioridade inválida' },
        { status: 400 }
      )
    }

    // Buscar status "Novo" para o tenant
    const status = db.prepare('SELECT id FROM statuses WHERE name = ? AND tenant_id = ?').get('Novo', tenantContext.id) as { id: number } | undefined
    if (!status) {
      return NextResponse.json(
        { error: 'Status inicial não encontrado' },
        { status: 500 }
      )
    }

    // Criar ticket com tenant_id
    const insertTicket = db.prepare(`
      INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertTicket.run(
      title,
      description,
      userContext.id,
      category_id,
      priority_id,
      status.id,
      tenantContext.id
    )

    // Buscar ticket criado com informações relacionadas
    const ticket = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        s.name as status,
        p.name as priority,
        c.name as category,
        u.name as user_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
      LEFT JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
      WHERE t.id = ? AND t.tenant_id = ?
    `).get(tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id, result.lastInsertRowid, tenantContext.id)

    return NextResponse.json({
      success: true,
      ticket
    })
  } catch (error) {
    logger.error('Error creating ticket', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

