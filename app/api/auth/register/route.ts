import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth/sqlite-auth'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { validateJWTSecret } from '@/lib/config/env'
import * as jose from 'jose'
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter'

const JWT_SECRET = new TextEncoder().encode(validateJWTSecret())

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting agressivo para registro (3/hora por IP)
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_REGISTER)
  if (rateLimitResponse) return rateLimitResponse
  try {
    const { name, email, password, tenant_slug, job_title, department, phone } = await request.json()
    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Nome, email e senha são obrigatórios'
      }, { status: 400 })
    }

    // Strong password validation - minimum 12 characters
    if (password.length < 12) {
      return NextResponse.json({
        success: false,
        error: 'A senha deve ter pelo menos 12 caracteres'
      }, { status: 400 })
    }

    // Password complexity requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return NextResponse.json({
        success: false,
        error: 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial'
      }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Email inválido'
      }, { status: 400 })
    }

    // Get tenant context from middleware or request body
    let tenantContext = getTenantContextFromRequest(request)

    // If no tenant context from middleware, try to resolve from tenant_slug
    if (!tenantContext && tenant_slug) {
      // In a real implementation, you would query the database for the tenant
      // For now, use default tenant for demo
      if (tenant_slug === 'empresa-demo') {
        tenantContext = {
          id: 1,
          slug: 'empresa-demo',
          name: 'Empresa Demo'
        }
      }
    }

    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant não encontrado'
      }, { status: 400 })
    }

    // Check if email already exists within the tenant
    const existingUser = db.prepare(`
      SELECT id FROM users
      WHERE email = ? AND tenant_id = ?
    `).get(email, tenantContext.id)

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Este email já está em uso nesta organização'
      }, { status: 409 })
    }

    // Check tenant user limits
    const userCount = db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE tenant_id = ? AND is_active = 1
    `).get(tenantContext.id) as { count: number }

    // Get tenant settings to check max users (for now, default to 50)
    const maxUsers = 50 // In production, get this from tenant settings

    if (userCount.count >= maxUsers) {
      return NextResponse.json({
        success: false,
        error: 'Limite de usuários atingido para esta organização'
      }, { status: 403 })
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user with tenant information
    const result = db.prepare(`
      INSERT INTO users (
        tenant_id, name, email, password_hash, role, job_title,
        department, phone, is_active, must_change_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).run(
      tenantContext.id,
      name,
      email,
      passwordHash,
      'user', // Default role for registration
      job_title || null,
      department || null,
      phone || null
    )

    const userId = result.lastInsertRowid as number

    // Get the created user
    const user = db.prepare(`
      SELECT id, tenant_id, name, email, role, job_title, department, phone, created_at
      FROM users WHERE id = ?
    `).get(userId) as {
      id: number
      tenant_id: number
      name: string
      email: string
      role: string
      job_title?: string
      department?: string
      phone?: string
      created_at: string
    }

    // SECURITY: Import enterprise token manager
    const {
      generateAccessToken,
      generateRefreshToken,
      setAuthCookies,
      generateDeviceFingerprint,
      getOrCreateDeviceId,
    } = await import('@/lib/auth/token-manager');

    // Generate device fingerprint and ID
    const deviceFingerprint = generateDeviceFingerprint(request);
    const deviceId = getOrCreateDeviceId(request);

    // Generate JWT with tenant information
    const tokenPayload = {
      user_id: user.id,
      tenant_id: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_slug: tenantContext.slug,
      device_fingerprint: deviceFingerprint,
    }

    // Generate access token (15 min) and refresh token (7 days)
    const accessToken = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload, deviceFingerprint);

    // Prepare user data for response
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      job_title: user.job_title,
      department: user.department,
      phone: user.phone,
      created_at: user.created_at
    }

    // SECURITY: Token is ONLY sent via httpOnly cookie - never exposed in JSON response
    // This prevents XSS attacks from stealing the token
    const response = NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso',
      // Note: tokens are NOT included here - they're sent only via httpOnly cookies below
      user: userData,
      tenant: {
        id: tenantContext.id,
        slug: tenantContext.slug,
        name: tenantContext.name
      }
    })

    // Set secure httpOnly cookies (access token, refresh token, device ID)
    setAuthCookies(response, accessToken, refreshToken, deviceId);

    // Set tenant context cookie for client-side access
    // IMPORTANT: Must use 'tenant-context' (hyphen) to match login, logout, middleware and edge-resolver
    response.cookies.set('tenant-context', JSON.stringify({
      id: tenantContext.id,
      slug: tenantContext.slug,
      name: tenantContext.name
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    })

    // Log user registration for audit
    db.prepare(`
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, 'user', ?, 'register', ?, ?, ?)
    `).run(
      tenantContext.id,
      user.id,
      user.id,
      JSON.stringify({
        registration_time: new Date().toISOString(),
        tenant: tenantContext.slug,
        role: user.role
      }),
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    )

    return response

  } catch (error) {
    logger.error('Register error', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

