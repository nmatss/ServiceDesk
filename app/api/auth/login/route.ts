import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/auth-service';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { captureAuthError } from '@/lib/monitoring/sentry-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';

interface TenantContext {
  id: number;
  slug: string;
  name: string;
}

interface LoginUserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  organization_id: number;
  last_login_at?: string;
  is_active: number | boolean;
  failed_login_attempts: number;
  locked_until?: string;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function resolveTenantContext(request: NextRequest, tenantSlug?: string): Promise<TenantContext | null> {
  const fromMiddleware = getTenantContextFromRequest(request);
  if (fromMiddleware) {
    return fromMiddleware;
  }

  if (tenantSlug) {
    const org = await executeQueryOne<{ id: number; name: string; slug: string }>(
      `SELECT id, name, slug FROM organizations WHERE slug = ? AND is_active = 1`
      ,
      [tenantSlug]
    );

    if (org) {
      return { id: org.id, slug: org.slug, name: org.name };
    }

    return null;
  }

  if (process.env.NODE_ENV !== 'production') {
    const defaultOrg = await executeQueryOne<{ id: number; name: string; slug: string }>(
      `SELECT id, name, slug FROM organizations WHERE is_active = 1 ORDER BY id LIMIT 1`
    );

    if (defaultOrg) {
      return { id: defaultOrg.id, slug: defaultOrg.slug, name: defaultOrg.name };
    }
  }

  return null;
}

async function getUserByEmailForTenant(email: string, tenantId: number): Promise<LoginUserRow | undefined> {
  try {
    return await executeQueryOne<LoginUserRow>(
      `
      SELECT id, name, email, password_hash, role, organization_id,
             last_login_at, is_active, failed_login_attempts, locked_until
      FROM users
      WHERE email = ? AND organization_id = ? AND is_active = 1
      `,
      [email, tenantId]
    );
  } catch {
    return await executeQueryOne<LoginUserRow>(
      `
      SELECT id, name, email, password_hash, role, tenant_id AS organization_id,
             last_login_at, is_active, failed_login_attempts, locked_until
      FROM users
      WHERE email = ? AND tenant_id = ? AND is_active = 1
      `,
      [email, tenantId]
    );
  }
}

async function runUserScopedUpdate(sqlOrg: string, sqlTenant: string, params: any[]): Promise<void> {
  try {
    await executeRun(sqlOrg, params);
  } catch {
    await executeRun(sqlTenant, params);
  }
}

async function insertLoginAttempt(params: {
  userId?: number;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  organizationId: number;
}): Promise<void> {
  const baseValues = [
    params.userId ?? null,
    params.email,
    params.ipAddress,
    params.userAgent,
    params.success ? 1 : 0,
    params.failureReason ?? null,
  ];

  try {
    await executeRun(
      `
      INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [...baseValues, params.organizationId]
    );
    return;
  } catch {
    await executeRun(
      `
      INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      baseValues
    );
  }
}

async function insertLoginAudit(params: {
  organizationId: number;
  userId: number;
  ipAddress: string;
  userAgent: string;
  tenantSlug: string;
}): Promise<void> {
  const payload = JSON.stringify({
    login_time: new Date().toISOString(),
    organization: params.tenantSlug,
  });

  try {
    await executeRun(
      `
      INSERT INTO audit_logs (organization_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, 'user', ?, 'login', ?, ?, ?)
      `,
      [
        params.organizationId,
        params.userId,
        params.userId,
        payload,
        params.ipAddress,
        params.userAgent,
      ]
    );
    return;
  } catch {
    // PostgreSQL schema may not have organization_id on audit_logs.
  }

  try {
    await executeRun(
      `
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, 'user', ?, 'login', ?, ?, ?)
      `,
      [
        params.organizationId,
        params.userId,
        params.userId,
        payload,
        params.ipAddress,
        params.userAgent,
      ]
    );
    return;
  } catch {
    await executeRun(
      `
      INSERT INTO audit_logs (user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, 'user', ?, 'login', ?, ?, ?)
      `,
      [
        params.userId,
        params.userId,
        payload,
        params.ipAddress,
        params.userAgent,
      ]
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
    if (rateLimitResponse) return rateLimitResponse;

    const { email, password, tenant_slug } = await request.json();
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = normalizeString(password);
    const normalizedTenantSlug = normalizeString(tenant_slug);

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email e senha são obrigatórios',
        },
        { status: 400 }
      );
    }

    const tenantContext = await resolveTenantContext(request, normalizedTenantSlug);
    if (!tenantContext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant não encontrado',
        },
        { status: 400 }
      );
    }

    const user = await getUserByEmailForTenant(normalizedEmail, tenantContext.id);

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (user && user.locked_until) {
      const lockExpiration = new Date(user.locked_until);
      if (lockExpiration > new Date()) {
        const remainingMinutes = Math.ceil((lockExpiration.getTime() - Date.now()) / (60 * 1000));

        await insertLoginAttempt({
          userId: user.id,
          email: normalizedEmail,
          ipAddress,
          userAgent,
          success: false,
          failureReason: 'account_locked',
          organizationId: tenantContext.id,
        });

        return NextResponse.json(
          {
            success: false,
            error: `Conta temporariamente bloqueada. Tente novamente em ${remainingMinutes} minutos.`,
            locked: true,
            locked_until: user.locked_until,
          },
          { status: 423 }
        );
      }

      await runUserScopedUpdate(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ? AND organization_id = ?`,
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ? AND tenant_id = ?`,
        [user.id, tenantContext.id]
      );
    }

    if (!user || !user.password_hash) {
      await insertLoginAttempt({
        email: normalizedEmail,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'user_not_found',
        organizationId: tenantContext.id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Credenciais inválidas',
        },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(normalizedPassword, user.password_hash);

    if (!isValidPassword) {
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const MAX_FAILED_ATTEMPTS = 5;
      const LOCKOUT_DURATION_MINUTES = 15;

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

        await runUserScopedUpdate(
          `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ? AND organization_id = ?`,
          `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ? AND tenant_id = ?`,
          [newFailedAttempts, lockedUntil.toISOString(), user.id, tenantContext.id]
        );

        await insertLoginAttempt({
          userId: user.id,
          email: normalizedEmail,
          ipAddress,
          userAgent,
          success: false,
          failureReason: 'invalid_password_account_locked',
          organizationId: tenantContext.id,
        });

        return NextResponse.json(
          {
            success: false,
            error: `Muitas tentativas de login falhadas. Conta bloqueada por ${LOCKOUT_DURATION_MINUTES} minutos.`,
            locked: true,
            locked_until: lockedUntil.toISOString(),
          },
          { status: 423 }
        );
      }

      await runUserScopedUpdate(
        `UPDATE users SET failed_login_attempts = ? WHERE id = ? AND organization_id = ?`,
        `UPDATE users SET failed_login_attempts = ? WHERE id = ? AND tenant_id = ?`,
        [newFailedAttempts, user.id, tenantContext.id]
      );

      await insertLoginAttempt({
        userId: user.id,
        email: normalizedEmail,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'invalid_password',
        organizationId: tenantContext.id,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Credenciais inválidas',
          remaining_attempts: MAX_FAILED_ATTEMPTS - newFailedAttempts,
        },
        { status: 401 }
      );
    }

    await runUserScopedUpdate(
      `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = ? AND organization_id = ?
      `,
      `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = ? AND tenant_id = ?
      `,
      [user.id, tenantContext.id]
    );

    await insertLoginAttempt({
      userId: user.id,
      email: normalizedEmail,
      ipAddress,
      userAgent,
      success: true,
      organizationId: tenantContext.id,
    });

    const {
      generateAccessToken,
      generateRefreshToken,
      setAuthCookies,
      generateDeviceFingerprint,
      getOrCreateDeviceId,
    } = await import('@/lib/auth/token-manager');

    const deviceFingerprint = generateDeviceFingerprint(request);
    const deviceId = getOrCreateDeviceId(request);

    const tokenPayload = {
      user_id: user.id,
      tenant_id: user.organization_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_slug: tenantContext.slug,
      device_fingerprint: deviceFingerprint,
    };

    const accessToken = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload, deviceFingerprint);

    const response = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        last_login_at: user.last_login_at,
      },
      tenant: {
        id: tenantContext.id,
        slug: tenantContext.slug,
        name: tenantContext.name,
      },
    });

    setAuthCookies(response, accessToken, refreshToken, deviceId);

    response.cookies.set(
      'tenant-context',
      JSON.stringify({
        id: tenantContext.id,
        slug: tenantContext.slug,
        name: tenantContext.name,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      }
    );

    await insertLoginAudit({
      organizationId: tenantContext.id,
      userId: user.id,
      ipAddress,
      userAgent,
      tenantSlug: tenantContext.slug,
    });

    return response;
  } catch (error) {
    logger.error('Login error:', error);
    captureAuthError(error, { method: 'password' });

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
