import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import jwt from 'jsonwebtoken'
import { validateJWTSecret } from '@/lib/config/env'
import { logger } from '@/lib/monitoring/logger';

const JWT_SECRET = validateJWTSecret()

function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as any
  } catch (error) {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    if (decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    // Buscar todos os tickets com informações relacionadas
    const tickets = db.prepare(`
      SELECT 
        t.id,
        t.title,
        t.description,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        s.name as status,
        s.color as status_color,
        p.name as priority,
        p.color as priority_color,
        c.name as category,
        c.color as category_color,
        u.name as user_name,
        u.email as user_email,
        agent.name as assigned_agent_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users agent ON t.assigned_to = agent.id
      ORDER BY t.created_at DESC
    `).all()

    return NextResponse.json({
      success: true,
      tickets
    })
  } catch (error) {
    logger.error('Error fetching tickets', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

