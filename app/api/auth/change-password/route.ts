import { NextRequest, NextResponse } from 'next/server'
import * as jose from 'jose'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { validateJWTSecret } from '@/lib/config/env'
import { logger } from '@/lib/monitoring/logger'
import { passwordPolicyManager } from '@/lib/auth/password-policies';

const JWT_SECRET = new TextEncoder().encode(validateJWTSecret())

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Token não fornecido' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    const userId = payload.sub as string
    const organizationId = payload.organizationId as number | undefined

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Senha atual e nova senha são obrigatórias' }, { status: 400 })
    }

    // SECURITY FIX: Buscar usuário com tenant check (organization_id)
    // This prevents users from changing passwords across tenant boundaries
    const userQuery = organizationId
      ? db.prepare(`
          SELECT id, password_hash, role, organization_id
          FROM users
          WHERE id = ? AND organization_id = ?
        `)
      : db.prepare(`
          SELECT id, password_hash, role, organization_id
          FROM users
          WHERE id = ?
        `);

    const user = (organizationId
      ? userQuery.get(parseInt(userId), organizationId)
      : userQuery.get(parseInt(userId))
    ) as { id: number; password_hash: string; role: string; organization_id: number } | undefined

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ message: 'Senha atual incorreta' }, { status: 400 })
    }

    // SECURITY FIX: Apply password policy validation
    // Use the password policy manager to validate against configured policies
    const policyResult = passwordPolicyManager.validatePassword(
      newPassword,
      user.role,
      user.id
    )

    if (!policyResult.isValid) {
      return NextResponse.json({
        message: 'A nova senha não atende aos requisitos de segurança',
        errors: policyResult.errors
      }, { status: 400 })
    }

    // Hash da nova senha
    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    // Atualizar senha com timestamp de alteração
    db.prepare(`
      UPDATE users
      SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, parseInt(userId))

    // SECURITY FIX: Store password in history to prevent reuse
    await passwordPolicyManager.storePasswordHistory(user.id, newPasswordHash)

    return NextResponse.json({
      message: 'Senha alterada com sucesso',
      passwordStrength: {
        score: policyResult.score,
        recommendations: policyResult.recommendations
      }
    })

  } catch (error) {
    logger.error('Erro ao alterar senha', error)
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 })
  }
}