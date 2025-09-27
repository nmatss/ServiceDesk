import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: userIdParam } = await params
    const userId = parseInt(userIdParam)

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuário inválido' },
        { status: 400 }
      )
    }

    // Buscar tickets do usuário com informações relacionadas
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
        u.name as assigned_agent_name
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `).all(userId)

    return NextResponse.json({
      success: true,
      tickets
    })
  } catch (error) {
    console.error('Error fetching user tickets:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
