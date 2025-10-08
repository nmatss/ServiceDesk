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

    // Buscar estatísticas
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    const totalTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number }
    const openTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN statuses s ON t.status_id = s.id
      WHERE s.name IN ('Novo', 'Em Andamento', 'Aguardando Cliente')
    `).get() as { count: number }
    const resolvedTickets = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN statuses s ON t.status_id = s.id
      WHERE s.name IN ('Resolvido', 'Fechado')
    `).get() as { count: number }

    const stats = {
      totalUsers: totalUsers.count,
      totalTickets: totalTickets.count,
      openTickets: openTickets.count,
      resolvedTickets: resolvedTickets.count
    }

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    logger.error('Error fetching stats', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

