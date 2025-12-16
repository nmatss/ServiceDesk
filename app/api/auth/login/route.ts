import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/sqlite-auth';
import db from '@/lib/db/connection';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { validateJWTSecret } from '@/lib/config/env';
import { captureAuthError } from '@/lib/monitoring/sentry-helpers';
import { applyRateLimit, rateLimitConfigs } from '@/lib/rate-limit';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(validateJWTSecret());

export async function POST(request: NextRequest) {
  try {
    // Aplicar rate limiting ANTES de processar a requisição
    const rateLimitResult = await applyRateLimit(request, rateLimitConfigs.auth, 'login');

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: rateLimitConfigs.auth.message,
        retryAfter: Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000)
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.total.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
          'Retry-After': Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000).toString()
        }
      });
    }

    const { email, password, tenant_slug } = await request.json();

    // Get tenant context from middleware or request body
    let tenantContext = getTenantContextFromRequest(request);

    // If no tenant context from middleware, try to resolve from tenant_slug or use default for development
    if (!tenantContext && tenant_slug) {
      // Query the database for the organization
      const org = db.prepare(`
        SELECT id, name, slug FROM organizations
        WHERE slug = ? AND is_active = 1
      `).get(tenant_slug) as { id: number; name: string; slug: string } | undefined;

      if (org) {
        tenantContext = {
          id: org.id,
          slug: org.slug,
          name: org.name
        };
      }
    }

    // In development, use default organization if no tenant context
    if (!tenantContext && process.env.NODE_ENV !== 'production') {
      const defaultOrg = db.prepare(`
        SELECT id, name, slug FROM organizations
        WHERE is_active = 1 ORDER BY id LIMIT 1
      `).get() as { id: number; name: string; slug: string } | undefined;

      if (defaultOrg) {
        tenantContext = {
          id: defaultOrg.id,
          slug: defaultOrg.slug,
          name: defaultOrg.name
        };
      }
    }

    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant não encontrado'
      }, { status: 400 });
    }

    // Query user with organization isolation and lockout fields
    const user = db.prepare(`
      SELECT id, name, email, password_hash, role, organization_id,
             last_login_at, is_active, failed_login_attempts, locked_until
      FROM users
      WHERE email = ? AND organization_id = ? AND is_active = 1
    `).get(email, tenantContext.id) as {
      id: number;
      name: string;
      email: string;
      password_hash: string;
      role: string;
      organization_id: number;
      last_login_at?: string;
      is_active: number;
      failed_login_attempts: number;
      locked_until?: string;
    } | undefined;

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // SECURITY: Check if account is locked
    if (user && user.locked_until) {
      const lockExpiration = new Date(user.locked_until);
      if (lockExpiration > new Date()) {
        const remainingMinutes = Math.ceil((lockExpiration.getTime() - Date.now()) / (60 * 1000));

        // Log failed attempt - account locked
        db.prepare(`
          INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason, organization_id)
          VALUES (?, ?, ?, ?, 0, 'account_locked', ?)
        `).run(user.id, email, ipAddress, userAgent, tenantContext.id);

        return NextResponse.json({
          success: false,
          error: `Conta temporariamente bloqueada. Tente novamente em ${remainingMinutes} minutos.`,
          locked_until: user.locked_until
        }, { status: 423 }); // 423 Locked
      } else {
        // Lock expired - reset failed attempts
        db.prepare(`
          UPDATE users
          SET failed_login_attempts = 0, locked_until = NULL
          WHERE id = ? AND organization_id = ?
        `).run(user.id, tenantContext.id);
      }
    }

    if (!user || !user.password_hash) {
      // Log failed attempt - user not found
      db.prepare(`
        INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason, organization_id)
        VALUES (?, ?, ?, 0, 'user_not_found', ?)
      `).run(email, ipAddress, userAgent, tenantContext.id);

      return NextResponse.json({
        success: false,
        error: 'Credenciais inválidas'
      }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      // SECURITY: Increment failed login attempts
      const newFailedAttempts = user.failed_login_attempts + 1;
      const MAX_FAILED_ATTEMPTS = 5;
      const LOCKOUT_DURATION_MINUTES = 15;

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock the account
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

        db.prepare(`
          UPDATE users
          SET failed_login_attempts = ?, locked_until = ?
          WHERE id = ? AND organization_id = ?
        `).run(newFailedAttempts, lockedUntil.toISOString(), user.id, tenantContext.id);

        // Log failed attempt - account now locked
        db.prepare(`
          INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason, organization_id)
          VALUES (?, ?, ?, ?, 0, 'invalid_password_account_locked', ?)
        `).run(user.id, email, ipAddress, userAgent, tenantContext.id);

        return NextResponse.json({
          success: false,
          error: `Muitas tentativas de login falhadas. Conta bloqueada por ${LOCKOUT_DURATION_MINUTES} minutos.`,
          locked_until: lockedUntil.toISOString()
        }, { status: 423 }); // 423 Locked
      } else {
        // Increment failed attempts but don't lock yet
        db.prepare(`
          UPDATE users
          SET failed_login_attempts = ?
          WHERE id = ? AND organization_id = ?
        `).run(newFailedAttempts, user.id, tenantContext.id);

        // Log failed attempt - invalid password
        db.prepare(`
          INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason, organization_id)
          VALUES (?, ?, ?, ?, 0, 'invalid_password', ?)
        `).run(user.id, email, ipAddress, userAgent, tenantContext.id);

        const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts;

        return NextResponse.json({
          success: false,
          error: 'Credenciais inválidas',
          remaining_attempts: remainingAttempts
        }, { status: 401 });
      }
    }

    // SECURITY: Reset failed login attempts on successful login
    // Update last login timestamp
    db.prepare(`
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = ? AND organization_id = ?
    `).run(user.id, tenantContext.id);

    // Log successful login attempt
    db.prepare(`
      INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, organization_id)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(user.id, email, ipAddress, userAgent, tenantContext.id);

    // Generate JWT with organization information
    // SECURITY: Using 15m expiration for access tokens (standardized)
    // This is a short-lived access token - refresh tokens should be used for longer sessions
    const tokenPayload = {
      id: user.id,
      organization_id: user.organization_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_slug: tenantContext.slug,
      type: 'access' // Explicitly mark as access token
    };

    const token = await new jose.SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('servicedesk')
      .setAudience('servicedesk-users')
      .setExpirationTime('15m') // Standardized to 15 minutes
      .sign(JWT_SECRET);

    // Prepare user data for response (exclude sensitive information)
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      last_login_at: user.last_login_at
    };

    // SECURITY: Token is ONLY sent via httpOnly cookie - never exposed in JSON response
    // This prevents XSS attacks from stealing the token
    const response = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      // Note: token is NOT included here - it's sent only via httpOnly cookie below
      user: userData,
      tenant: {
        id: tenantContext.id,
        slug: tenantContext.slug,
        name: tenantContext.name
      }
    });

    // Set secure httpOnly cookie with tenant context
    // SECURITY: 15 minutes for access token (standardized)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes (standardized)
      path: '/'
    });

    // Set tenant context cookie for client-side access
    // IMPORTANT: Must use 'tenant-context' (hyphen) to match edge-resolver.ts and middleware.ts
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
    });

    // Log successful login for audit
    db.prepare(`
      INSERT INTO audit_logs (organization_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, 'user', ?, 'login', ?, ?, ?)
    `).run(
      tenantContext.id,
      user.id,
      user.id,
      JSON.stringify({
        login_time: new Date().toISOString(),
        organization: tenantContext.slug
      }),
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return response;

  } catch (error) {
    console.error('Login error:', error);
    captureAuthError(error, { method: 'password' });
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
