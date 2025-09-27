import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    const db = getDb()

    // Buscar todos os usuários com role 'agent' ou 'admin'
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
          AND status NOT IN ('closed', 'resolved')
        ) as active_tickets,
        (
          SELECT COUNT(*)
          FROM tickets
          WHERE assigned_to = users.id
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
        ) as avg_rating
      FROM users
      WHERE role IN ('agent', 'admin')
      AND id != ?
      ORDER BY name ASC
    `).all(user.id)

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
      agents: formattedAgents,
      total: formattedAgents.length
    })

  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação e permissão de admin
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const user = await verifyToken(token)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Permissão negada. Apenas administradores podem criar agentes.' },
        { status: 403 }
      )
    }

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

    const db = getDb()

    // Verificar se email já existe
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já está em uso' },
        { status: 400 }
      )
    }

    // Criar hash da senha
    const bcrypt = require('bcrypt')
    const passwordHash = await bcrypt.hash(password, 12)

    // Inserir novo agente
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(name, email, passwordHash, role)

    const newAgent = db.prepare(`
      SELECT id, name, email, role, created_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid)

    return NextResponse.json({
      success: true,
      agent: newAgent,
      message: 'Agente criado com sucesso'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating agent:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}