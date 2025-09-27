import { NextRequest, NextResponse } from 'next/server'
import * as jose from 'jose'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-for-jwt-development-only')

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Token não fornecido' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    const userId = payload.sub as string

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Senha atual e nova senha são obrigatórias' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ message: 'Nova senha deve ter pelo menos 8 caracteres' }, { status: 400 })
    }

    // Buscar usuário atual
    const user = db.prepare(`
      SELECT id, password_hash
      FROM users
      WHERE id = ?
    `).get(parseInt(userId)) as { id: number; password_hash: string } | undefined

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ message: 'Senha atual incorreta' }, { status: 400 })
    }

    // Hash da nova senha
    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    // Atualizar senha
    db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `).run(newPasswordHash, parseInt(userId))

    return NextResponse.json({ message: 'Senha alterada com sucesso' })

  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 })
  }
}