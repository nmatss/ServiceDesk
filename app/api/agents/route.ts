import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    const tenantId = auth.organizationId;

    // Buscar agentes FILTRADOS POR TENANT (organization_id)
    const agents = await executeQuery(`
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
    `, [tenantId, tenantId, tenantId, tenantId, auth.userId])

    // Formattar dados dos agentes
    const formattedAgents = agents.map((agent: { id: number; name: string; email: string; role: string; active_tickets: number; resolved_tickets: number; total_tickets: number; avg_rating: number | null; created_at: string }) => ({
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
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    // Verificar permissão de admin
    if (!ADMIN_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: 'Permission denied. Only administrators can create agents.', code: 'PERMISSION_DENIED' },
        { status: 403 }
      )
    }

    const tenantId = auth.organizationId;
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
    const existingUser = await executeQueryOne('SELECT id FROM users WHERE email = ? AND organization_id = ?', [email, tenantId])
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já está em uso neste tenant' },
        { status: 400 }
      )
    }

    // Criar hash da senha
    const bcrypt = require('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 12)

    // Inserir novo agente COM organization_id DO TENANT
    const result = await executeRun(`
      INSERT INTO users (name, email, password_hash, role, organization_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()})
    `, [name, email, passwordHash, role, tenantId])

    const newAgent = await executeQueryOne(`
      SELECT id, name, email, role, organization_id, created_at
      FROM users WHERE id = ?
    `, [result.lastInsertRowid])

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
