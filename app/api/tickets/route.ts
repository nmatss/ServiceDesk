import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { logger } from '@/lib/monitoring/logger';
import { getCachedTicketSearch, cacheTicketSearch } from '@/lib/cache/lru-cache';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

import { TICKET_MANAGEMENT_ROLES } from '@/lib/auth/roles';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

// Maximum limit to prevent DoS attacks
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const statusFilter = searchParams.get('status')
    // SECURITY: Cap limit to prevent DoS
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const offset = (page - 1) * limit

    // Check cache first
    const isAdmin = TICKET_MANAGEMENT_ROLES.includes(userContext.role)
    const cacheKey = { page, limit, isAdmin, userId: isAdmin ? 0 : userContext.id }
    const cached = getCachedTicketSearch<{ tickets: unknown[]; total: number }>(tenantContext.id, cacheKey)

    if (cached) {
      return NextResponse.json({
        success: true,
        tickets: cached.tickets,
        pagination: {
          page,
          limit,
          total: cached.total,
          pages: Math.ceil(cached.total / limit)
        },
        cached: true
      })
    }

    // OPTIMIZED: Single query with COUNT(*) OVER() - eliminates separate count query
    let query = `
      SELECT
        t.id,
        t.tenant_id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        s.name as status,
        s.id as status_id,
        s.color as status_color,
        p.name as priority,
        p.id as priority_id,
        c.name as category,
        c.id as category_id,
        u.name as user_name,
        u.id as user_id,
        COUNT(*) OVER() as total_count
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id AND s.tenant_id = ?
      LEFT JOIN priorities p ON t.priority_id = p.id AND p.tenant_id = ?
      LEFT JOIN categories c ON t.category_id = c.id AND c.tenant_id = ?
      LEFT JOIN users u ON t.user_id = u.id AND u.tenant_id = ?
      WHERE t.tenant_id = ?
    `

    const params: (number | string)[] = [
      tenantContext.id,
      tenantContext.id,
      tenantContext.id,
      tenantContext.id,
      tenantContext.id
    ]

    // Se não for admin, mostrar apenas tickets do usuário
    if (!isAdmin) {
      query += ' AND t.user_id = ?'
      params.push(userContext.id)
    }

    if (statusFilter) {
      const normalizedStatus = statusFilter.trim().toLowerCase()
      if (normalizedStatus === 'open') {
        query += ' AND t.status_id = ?'
        params.push(1)
      } else if (normalizedStatus === 'in-progress' || normalizedStatus === 'in_progress') {
        query += ' AND t.status_id = ?'
        params.push(2)
      } else if (normalizedStatus === 'resolved') {
        query += ' AND t.status_id = ?'
        params.push(3)
      } else if (normalizedStatus === 'closed') {
        query += ' AND t.status_id = ?'
        params.push(4)
      } else {
        const parsedStatusId = Number.parseInt(normalizedStatus, 10)
        if (Number.isInteger(parsedStatusId) && parsedStatusId > 0) {
          query += ' AND t.status_id = ?'
          params.push(parsedStatusId)
        }
      }
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const results = await executeQuery<{
      id: number;
      tenant_id: number;
      title: string;
      description: string;
      created_at: string;
      updated_at: string;
      status: string;
      status_id: number;
      status_color: string;
      priority: string;
      priority_id: number;
      category: string;
      category_id: number;
      user_name: string;
      user_id: number;
      total_count: number;
    }>(query, params)

    // Extract total from first row (all rows have same total_count)
    const total = results.length > 0 ? results[0].total_count : 0

    // Remove total_count from each ticket object for cleaner response
    const tickets = results.map(({ total_count, ...ticket }) => ticket)

    // Cache the results
    cacheTicketSearch(tenantContext.id, cacheKey, { tickets, total }, 60)

    const response = NextResponse.json({
      success: true,
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    logger.error('Error fetching tickets', error)
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
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const tenantContext = guard.context!.tenant
    const userContext = guard.context!.user

    const { title, description, category_id, priority_id } = await request.json()

    if (!title || !description || !category_id || !priority_id) {
      return NextResponse.json(
        { success: false, error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se categoria e prioridade existem e pertencem ao tenant
    const category = await executeQueryOne<{ id: number }>(
      'SELECT id FROM categories WHERE id = ? AND tenant_id = ?',
      [category_id, tenantContext.id]
    )
    const priority = await executeQueryOne<{ id: number }>(
      'SELECT id FROM priorities WHERE id = ? AND tenant_id = ?',
      [priority_id, tenantContext.id]
    )

    if (!category || !priority) {
      return NextResponse.json(
        { success: false, error: 'Categoria ou prioridade inválida' },
        { status: 400 }
      )
    }

    // Buscar status "Novo" para o tenant
    const status = await executeQueryOne<{ id: number }>(
      'SELECT id FROM statuses WHERE name = ? AND tenant_id = ?',
      ['Novo', tenantContext.id]
    )
    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status inicial não encontrado' },
        { status: 500 }
      )
    }

    // Criar ticket com tenant_id
    let createdTicketId: number | undefined
    try {
      const inserted = await executeQueryOne<{ id: number }>(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `, [
        title,
        description,
        userContext.id,
        category_id,
        priority_id,
        status.id,
        tenantContext.id
      ])
      createdTicketId = inserted?.id
    } catch {
      const result = await executeRun(`
        INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        title,
        description,
        userContext.id,
        category_id,
        priority_id,
        status.id,
        tenantContext.id
      ])
      if (typeof result.lastInsertRowid === 'number') {
        createdTicketId = result.lastInsertRowid
      }
    }

    if (!createdTicketId) {
      return NextResponse.json(
        { success: false, error: 'Falha ao criar ticket' },
        { status: 500 }
      )
    }

    // Buscar ticket criado com informações relacionadas
    const ticket = await executeQueryOne(`
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
    `, [tenantContext.id, tenantContext.id, tenantContext.id, tenantContext.id, createdTicketId, tenantContext.id])

    return NextResponse.json({
      success: true,
      ticket
    })
  } catch (error) {
    logger.error('Error creating ticket', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
