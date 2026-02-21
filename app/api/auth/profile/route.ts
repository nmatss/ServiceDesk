import { NextRequest, NextResponse } from 'next/server'
import * as jose from 'jose'
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { validateJWTSecret } from '@/lib/config/env'
import { logger } from '@/lib/monitoring/logger';
import { stripHTML } from '@/lib/security/sanitize';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const JWT_SECRET = new TextEncoder().encode(validateJWTSecret())

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}

  const parsed: Record<string, string> = {}
  for (const cookie of cookieHeader.split(';')) {
    const trimmed = cookie.trim()
    if (!trimmed) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    parsed[key] = decodeURIComponent(value)
  }
  return parsed
}

function extractAuthToken(request: NextRequest): string | null {
  const cookieToken = request.cookies?.get?.('auth_token')?.value
  if (cookieToken) {
    return cookieToken
  }

  const cookieHeaderToken = parseCookieHeader(request.headers.get('cookie')).auth_token
  if (cookieHeaderToken) {
    return cookieHeaderToken
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }

  return null
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

function resolveUserId(payload: jose.JWTPayload): number | null {
  return (
    parsePositiveInt(payload.sub) ??
    parsePositiveInt((payload as Record<string, unknown>).id) ??
    parsePositiveInt((payload as Record<string, unknown>).user_id)
  )
}

function sanitizeField(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  return stripHTML(value).trim()
}

function isValidEmail(email: string): boolean {
  if (!email || email.includes(' ')) {
    return false
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function mapProfilePayload(user: Record<string, any>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    job_title: user.job_title ?? null,
    department: user.department ?? null,
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at,
  }
}

async function loadUserProfile(userId: number) {
  try {
    return await executeQueryOne<Record<string, any>>(`
      SELECT id, name, email, role, phone, job_title, department, avatar_url, created_at
      FROM users
      WHERE id = ?
    `, [userId]);
  } catch {
    return await executeQueryOne<Record<string, any>>(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = ?
    `, [userId]);
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const token = extractAuthToken(request)
    if (!token) {
      return NextResponse.json({ success: false, message: 'Token não fornecido' }, { status: 401 })
    }

    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    const userId = resolveUserId(payload)
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Token inválido' }, { status: 401 })
    }

    const user = await loadUserProfile(userId)

    if (!user) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 })
    }

    const profileData = mapProfilePayload(user)
    return NextResponse.json({
      success: true,
      user: profileData,
      ...profileData,
    })

  } catch (error) {
    logger.error('Erro ao buscar perfil', error)
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const token = extractAuthToken(request)
    if (!token) {
      return NextResponse.json({ success: false, message: 'Token não fornecido' }, { status: 401 })
    }

    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    const userId = resolveUserId(payload)
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()

    const currentUser = await loadUserProfile(userId)
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 })
    }

    const name = sanitizeField(body.name) ?? currentUser.name
    const email = (sanitizeField(body.email) ?? currentUser.email).toLowerCase()
    const phone = sanitizeField(body.phone)
    const jobTitle = sanitizeField(body.job_title)
    const department = sanitizeField(body.department)
    const avatarUrl = sanitizeField(body.avatar_url)

    if (!name || !email) {
      return NextResponse.json({ success: false, message: 'Nome e email são obrigatórios' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, message: 'Email inválido' }, { status: 400 })
    }

    if (email !== currentUser.email) {
      const existingUser = await executeQueryOne<{ id: number }>(`
        SELECT id FROM users WHERE email = ? AND id != ?
      `, [email, userId])
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'Email já está em uso' }, { status: 409 })
      }
    }

    try {
      await executeRun(`
        UPDATE users
        SET
          name = ?,
          email = ?,
          phone = ?,
          job_title = ?,
          department = ?,
          avatar_url = ?
        WHERE id = ?
      `, [name,
        email,
        phone ?? currentUser.phone ?? null,
        jobTitle ?? currentUser.job_title ?? null,
        department ?? currentUser.department ?? null,
        avatarUrl ?? currentUser.avatar_url ?? null,
        userId])
    } catch {
      await executeRun(`
        UPDATE users
        SET name = ?, email = ?
        WHERE id = ?
      `, [name, email, userId])
    }

    const updatedUser = await loadUserProfile(userId)
    const profileData = mapProfilePayload(updatedUser || { ...currentUser, name, email })

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      user: profileData,
      ...profileData,
    })

  } catch (error) {
    logger.error('Erro ao atualizar perfil', error)
    return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 })
  }
}
