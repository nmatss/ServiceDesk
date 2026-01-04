import { NextRequest, NextResponse } from 'next/server'
import * as jose from 'jose'
import { db } from '@/lib/db'
import { validateJWTSecret } from '@/lib/config/env'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const JWT_SECRET = new TextEncoder().encode(validateJWTSecret())

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Token não fornecido' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    const userId = payload.sub as string

    const user = db.prepare(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = ?
    `).get(parseInt(userId))

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)

  } catch (error) {
    logger.error('Erro ao buscar perfil', error)
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Token não fornecido' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    const userId = payload.sub as string

    const { name, email } = await request.json()

    if (!name || !email) {
      return NextResponse.json({ message: 'Nome e email são obrigatórios' }, { status: 400 })
    }

    // Verificar se email já existe para outro usuário
    const existingUser = db.prepare(`
      SELECT id FROM users WHERE email = ? AND id != ?
    `).get(email, parseInt(userId))

    if (existingUser) {
      return NextResponse.json({ message: 'Email já está em uso' }, { status: 409 })
    }

    // Atualizar usuário
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ?
    `).run(name, email, parseInt(userId))

    // Buscar usuário atualizado
    const updatedUser = db.prepare(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = ?
    `).get(parseInt(userId))

    return NextResponse.json(updatedUser)

  } catch (error) {
    logger.error('Erro ao atualizar perfil', error)
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 })
  }
}