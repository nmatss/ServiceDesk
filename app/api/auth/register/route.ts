import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/auth-service';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { stripHTML } from '@/lib/security/sanitize';

type TenantContext = { id: number; slug: string; name: string };

type RegisteredUserRow = {
  id: number;
  organization_id?: number;
  tenant_id?: number;
  name: string;
  email: string;
  role: string;
  job_title?: string | null;
  department?: string | null;
  phone?: string | null;
  created_at: string;
};

function sanitizePlainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return stripHTML(value).trim();
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  if (email.includes(' ')) return false;
  if (email.includes('..')) return false;

  const emailRegex = /^(?!.*\.\.)(?!\.)([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

async function resolveTenantContext(request: NextRequest, tenantSlug?: string): Promise<TenantContext | null> {
  const fromMiddleware = getTenantContextFromRequest(request);
  if (fromMiddleware) {
    return fromMiddleware;
  }

  if (tenantSlug) {
    const org = await executeQueryOne<{ id: number; slug: string; name: string }>(
      `SELECT id, slug, name FROM organizations WHERE slug = ? AND is_active = 1`,
      [tenantSlug]
    );

    if (org) {
      return { id: org.id, slug: org.slug, name: org.name };
    }

    return null;
  }

  if (process.env.NODE_ENV !== 'production') {
    const fallback = await executeQueryOne<{ id: number; slug: string; name: string }>(
      `SELECT id, slug, name FROM organizations WHERE is_active = 1 ORDER BY id LIMIT 1`
    );

    if (fallback) {
      return { id: fallback.id, slug: fallback.slug, name: fallback.name };
    }
  }

  return null;
}

async function userExists(email: string, tenantId: number): Promise<boolean> {
  try {
    const row = await executeQueryOne<{ id: number }>(
      `SELECT id FROM users WHERE email = ? AND organization_id = ?`,
      [email, tenantId]
    );
    return !!row;
  } catch {
    const row = await executeQueryOne<{ id: number }>(
      `SELECT id FROM users WHERE email = ? AND tenant_id = ?`,
      [email, tenantId]
    );
    return !!row;
  }
}

async function activeUserCount(tenantId: number): Promise<number> {
  try {
    const row = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM users WHERE organization_id = ? AND is_active = 1`,
      [tenantId]
    );
    return Number(row?.count ?? 0);
  } catch {
    const row = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND is_active = 1`,
      [tenantId]
    );
    return Number(row?.count ?? 0);
  }
}

async function insertUser(params: {
  tenantId: number;
  name: string;
  email: string;
  passwordHash: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
}): Promise<void> {
  try {
    await executeRun(
      `
      INSERT INTO users (
        organization_id, name, email, password_hash, role, job_title,
        department, phone, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        params.tenantId,
        params.name,
        params.email,
        params.passwordHash,
        'user',
        params.jobTitle || null,
        params.department || null,
        params.phone || null,
      ]
    );
    return;
  } catch {
    // Fallback for schemas without optional profile columns.
  }

  try {
    await executeRun(
      `
      INSERT INTO users (organization_id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      `,
      [params.tenantId, params.name, params.email, params.passwordHash, 'user']
    );
    return;
  } catch {
    await executeRun(
      `
      INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      `,
      [params.tenantId, params.name, params.email, params.passwordHash, 'user']
    );
  }
}

async function getRegisteredUser(email: string, tenantId: number): Promise<RegisteredUserRow | undefined> {
  try {
    return await executeQueryOne<RegisteredUserRow>(
      `
      SELECT id, organization_id, name, email, role, job_title, department, phone, created_at
      FROM users
      WHERE email = ? AND organization_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [email, tenantId]
    );
  } catch {
    return await executeQueryOne<RegisteredUserRow>(
      `
      SELECT id, tenant_id, name, email, role, job_title, department, phone, created_at
      FROM users
      WHERE email = ? AND tenant_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [email, tenantId]
    );
  }
}

async function insertRegistrationAudit(params: {
  tenantId: number;
  userId: number;
  tenantSlug: string;
  ipAddress: string;
  userAgent: string;
}): Promise<void> {
  const payload = JSON.stringify({
    registration_time: new Date().toISOString(),
    tenant: params.tenantSlug,
    role: 'user',
  });

  try {
    await executeRun(
      `
      INSERT INTO audit_logs (organization_id, tenant_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, 'user', ?, 'register', ?, ?, ?)
      `,
      [
        params.tenantId,
        params.tenantId,
        params.userId,
        params.userId,
        payload,
        params.ipAddress,
        params.userAgent,
      ]
    );
    return;
  } catch {
    // Fallback for schemas without organization_id on audit_logs.
  }

  try {
    await executeRun(
      `
      INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, ?, 'user', ?, 'register', ?, ?, ?)
      `,
      [params.tenantId, params.userId, params.userId, payload, params.ipAddress, params.userAgent]
    );
    return;
  } catch {
    await executeRun(
      `
      INSERT INTO audit_logs (user_id, entity_type, entity_id, action, new_values, ip_address, user_agent)
      VALUES (?, 'user', ?, 'register', ?, ?, ?)
      `,
      [params.userId, params.userId, payload, params.ipAddress, params.userAgent]
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_REGISTER);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { name, email, password, tenant_slug, job_title, department, phone } = await request.json();
    const sanitizedName = sanitizePlainText(name);
    const normalizedEmail = normalizeEmail(email);
    const sanitizedJobTitle = sanitizePlainText(job_title);
    const sanitizedDepartment = sanitizePlainText(department);
    const sanitizedPhone = sanitizePlainText(phone);
    const tenantSlug = sanitizePlainText(tenant_slug);

    if (!sanitizedName || !normalizedEmail || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nome, email e senha são obrigatórios',
        },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        {
          success: false,
          error: 'A senha deve ter pelo menos 12 caracteres',
        },
        { status: 400 }
      );
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial',
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email inválido',
        },
        { status: 400 }
      );
    }

    const tenantContext = await resolveTenantContext(request, tenantSlug);
    if (!tenantContext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant não encontrado',
        },
        { status: 400 }
      );
    }

    if (await userExists(normalizedEmail, tenantContext.id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este email já está em uso nesta organização',
        },
        { status: 409 }
      );
    }

    const count = await activeUserCount(tenantContext.id);
    const maxUsers = 50;

    if (count >= maxUsers) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limite de usuários atingido para esta organização',
        },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);

    await insertUser({
      tenantId: tenantContext.id,
      name: sanitizedName,
      email: normalizedEmail,
      passwordHash,
      jobTitle: sanitizedJobTitle,
      department: sanitizedDepartment,
      phone: sanitizedPhone,
    });

    const user = await getRegisteredUser(normalizedEmail, tenantContext.id);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Falha ao criar usuário',
        },
        { status: 500 }
      );
    }

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
      tenant_id: user.organization_id ?? user.tenant_id ?? tenantContext.id,
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
      message: 'Usuário criado com sucesso',
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.organization_id ?? user.tenant_id ?? tenantContext.id,
        organization_id: user.organization_id ?? user.tenant_id ?? tenantContext.id,
        job_title: user.job_title,
        department: user.department,
        phone: user.phone,
        created_at: user.created_at,
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

    await insertRegistrationAudit({
      tenantId: tenantContext.id,
      userId: user.id,
      tenantSlug: tenantContext.slug,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return response;
  } catch (error) {
    logger.error('Register error', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
