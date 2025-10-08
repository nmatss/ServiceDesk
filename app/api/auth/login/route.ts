import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/sqlite-auth';
import { getDb } from '@/lib/db';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import { validateJWTSecret } from '@/lib/config/env';
import { captureAuthError } from '@/lib/monitoring/sentry-helpers';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(validateJWTSecret());

// Rate limiting para login
const loginRateLimit = createRateLimitMiddleware('auth');

export async function POST(request: NextRequest) {
  // Aplicar rate limiting
  const rateLimitResult = await loginRateLimit(request, '/api/auth/login');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult; // Rate limit exceeded
  }
  try {
    const { email, password, tenant_slug } = await request.json();
    const db = getDb();

    // Get tenant context from middleware or request body
    let tenantContext = getTenantContextFromRequest(request);

    // If no tenant context from middleware, try to resolve from tenant_slug
    if (!tenantContext && tenant_slug) {
      // Query the database for the tenant
      const tenant = db.prepare(`
        SELECT id, name, slug FROM tenants
        WHERE slug = ? AND is_active = 1
      `).get(tenant_slug) as { id: number; name: string; slug: string } | undefined;

      if (tenant) {
        tenantContext = {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name
        };
      }
    }

    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant não encontrado'
      }, { status: 400 });
    }

    // Query user with tenant isolation
    const user = db.prepare(`
      SELECT id, name, email, password_hash, role, tenant_id,
             job_title, department, last_login_at, is_active
      FROM users
      WHERE email = ? AND tenant_id = ? AND is_active = 1
    `).get(email, tenantContext.id) as {
      id: number;
      name: string;
      email: string;
      password_hash: string;
      role: string;
      tenant_id: number;
      job_title?: string;
      department?: string;
      last_login_at?: string;
      is_active: number;
    } | undefined;

    if (!user || !user.password_hash) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais inválidas'
      }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais inválidas'
      }, { status: 401 });
    }

    // Update last login timestamp
    db.prepare(`
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(user.id, tenantContext.id);

    // Generate JWT with tenant information
    const tokenPayload = {
      user_id: user.id,
      tenant_id: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_slug: tenantContext.slug
    };

    const token = await new jose.SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h') // Extended for better UX
      .sign(JWT_SECRET);

    // Prepare user data for response (exclude sensitive information)
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      job_title: user.job_title,
      department: user.department,
      last_login_at: user.last_login_at
    };

    const response = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: userData,
      tenant: {
        id: tenantContext.id,
        slug: tenantContext.slug,
        name: tenantContext.name
      }
    });

    // Set secure httpOnly cookie with tenant context
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    });

    // Set tenant context cookie for client-side access
    response.cookies.set('tenant_context', JSON.stringify({
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
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, 'user', ?, 'login', ?, ?, ?)
    `).run(
      tenantContext.id,
      user.id,
      user.id,
      JSON.stringify({
        login_time: new Date().toISOString(),
        tenant: tenantContext.slug
      }),
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    return response;

  } catch (error) {
    captureAuthError(error, { method: 'password' });
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
