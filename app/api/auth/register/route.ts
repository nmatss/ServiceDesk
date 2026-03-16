import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/auth-service';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { executeQueryOne, executeRun, sqlTrue } from '@/lib/db/adapter';
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
      `SELECT id, slug, name FROM organizations WHERE slug = ? AND is_active = ${sqlTrue()}`,
      [tenantSlug]
    );

    if (org) {
      return { id: org.id, slug: org.slug, name: org.name };
    }

    return null;
  }

  if (process.env.NODE_ENV !== 'production') {
    const fallback = await executeQueryOne<{ id: number; slug: string; name: string }>(
      `SELECT id, slug, name FROM organizations WHERE is_active = ${sqlTrue()} ORDER BY id LIMIT 1`
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
      `SELECT COUNT(*) AS count FROM users WHERE organization_id = ? AND is_active = ${sqlTrue()}`,
      [tenantId]
    );
    return Number(row?.count ?? 0);
  } catch {
    const row = await executeQueryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND is_active = ${sqlTrue()}`,
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

async function seedNewOrganization(orgId: number): Promise<void> {
  try {
    // Seed default statuses
    const statuses = ['Novo', 'Em Andamento', 'Aguardando', 'Resolvido', 'Fechado'];
    const statusColors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#6B7280'];
    for (let i = 0; i < statuses.length; i++) {
      await executeRun(
        `INSERT INTO statuses (name, color, tenant_id, sort_order) VALUES (?, ?, ?, ?)`,
        [statuses[i], statusColors[i], orgId, i + 1]
      );
    }

    // Seed default priorities
    const priorities = [
      { name: 'Baixa', color: '#10B981', level: 1 },
      { name: 'Média', color: '#F59E0B', level: 2 },
      { name: 'Alta', color: '#F97316', level: 3 },
      { name: 'Crítica', color: '#EF4444', level: 4 },
    ];
    for (const p of priorities) {
      await executeRun(
        `INSERT INTO priorities (name, color, level, tenant_id) VALUES (?, ?, ?, ?)`,
        [p.name, p.color, p.level, orgId]
      );
    }

    // Seed default categories
    const categories = ['Hardware', 'Software', 'Rede', 'Acesso', 'Email', 'Outros'];
    for (const cat of categories) {
      await executeRun(
        `INSERT INTO categories (name, tenant_id) VALUES (?, ?)`,
        [cat, orgId]
      );
    }
  } catch (error) {
    logger.error('Failed to seed new organization data', error);
    // Non-fatal — user can still use the system
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

    let isOrgCreator = false;
    let tenantContext = await resolveTenantContext(request, tenantSlug);

    // Self-service: auto-create organization for new signups
    if (!tenantContext) {
      try {
        const orgSlug = normalizedEmail.split('@')[0].replace(/[^a-z0-9-]/g, '-').substring(0, 50) + '-' + Date.now().toString(36);
        const orgName = sanitizedName ? `${sanitizedName}'s Organization` : 'Minha Organização';

        const inserted = await executeQueryOne<{ id: number }>(
          `INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
           VALUES (?, ?, 'starter', 'active', 3, 100, ${sqlTrue()})
           RETURNING id`,
          [orgName, orgSlug]
        );

        if (inserted) {
          tenantContext = { id: inserted.id, slug: orgSlug, name: orgName };
          isOrgCreator = true;

          // Seed default categories, priorities, statuses for the new org
          await seedNewOrganization(inserted.id);
        }
      } catch (orgError) {
        logger.error('Failed to auto-create organization', orgError);
      }
    }

    if (!tenantContext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível criar sua organização. Tente novamente.',
        },
        { status: 500 }
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

    // Check user limit based on subscription plan
    const { checkLimit } = await import('@/lib/billing/subscription-manager');
    const limitCheck = await checkLimit(tenantContext.id, 'users');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: limitCheck.message || 'Limite de usuários atingido para esta organização. Faça upgrade do seu plano.',
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

    // If user created the org, promote to admin
    if (isOrgCreator) {
      try {
        await executeRun(
          `UPDATE users SET role = 'admin' WHERE email = ? AND organization_id = ?`,
          [normalizedEmail, tenantContext.id]
        );
      } catch {
        await executeRun(
          `UPDATE users SET role = 'admin' WHERE email = ? AND tenant_id = ?`,
          [normalizedEmail, tenantContext.id]
        );
      }
    }

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
