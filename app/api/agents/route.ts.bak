import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { verifyTokenFromCookies } from '@/lib/auth/sqlite-auth'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await verifyTokenFromCookies(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 400 }
      )
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json(
        { error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' },
        { status: 403 }
      )
    }

    const tenantId = tenantContext.id

    // Buscar agentes FILTRADOS POR TENANT (organization_id)
    const agents = db.prepare(`
      SELECT
        id,
        name,
        email,
        role,
        created_at,
        updated_at,
        (
          SELECT COUNT(*)
          FROM tickets
          WHERE assigned_to = users.id
          AND tenant_id = ?
          AND status NOT IN ('closed', 'resolved')
        ) as active_tickets,
        (
          SELECT COUNT(*)
          FROM tickets
          WHERE assigned_to = users.id
          AND tenant_id = ?
        ) as total_tickets,
        (
          SELECT AVG(
            CASE
              WHEN rating IS NOT NULL THEN rating
              ELSE NULL
            END
          )
          FROM satisfaction_surveys s
          JOIN tickets t ON s.ticket_id = t.id
          WHERE t.assigned_to = users.id
          AND t.tenant_id = ?
        ) as avg_rating
      FROM users
      WHERE role IN ('agent', 'admin')
      AND organization_id = ?
      AND id != ?
      ORDER BY name ASC
    `).all(tenantId, tenantId, tenantId, tenantId, user.id)

    // Formattar dados dos agentes
    const formattedAgents = agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      activeTickets: agent.active_tickets || 0,
      totalTickets: agent.total_tickets || 0,
      avgRating: agent.avg_rating ? parseFloat(agent.avg_rating.toFixed(2)) : null,
      isAvailable: agent.active_tickets < 10, // Lógica simples de disponibilidade
      status: agent.active_tickets === 0 ? 'available' :
              agent.active_tickets < 5 ? 'busy' : 'overloaded'
    }))

    return NextResponse.json({
      success: true,
      data: {
        agents: formattedAgents,
        total: formattedAgents.length
      }
    })

  } catch (error) {
    logger.error('Error fetching agents', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await verifyTokenFromCookies(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Verificar permissão de admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Permission denied. Only administrators can create agents.', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 400 }
      )
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json(
        { error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' },
        { status: 403 }
      )
    }

    const tenantId = tenantContext.id
    const { name, email, password, role = 'agent' } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['agent', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Role deve ser "agent" ou "admin"' },
        { status: 400 }
      )
    }
    // Verificar se email já existe no tenant
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND organization_id = ?').get(email, tenantId)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já está em uso neste tenant' },
        { status: 400 }
      )
    }

    // Criar hash da senha
    const bcrypt = require('bcrypt')
    const passwordHash = await bcrypt.hash(password, 12)

    // Inserir novo agente COM organization_id DO TENANT
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, organization_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(name, email, passwordHash, role, tenantId)

    const newAgent = db.prepare(`
      SELECT id, name, email, role, organization_id, created_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      data: newAgent,
      message: 'Agent created successfully'
    }, { status: 201 })

  } catch (error) {
    logger.error('Error creating agent', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}