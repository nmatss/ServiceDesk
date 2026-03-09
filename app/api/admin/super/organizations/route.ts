import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, sqlNow, sqlTrue, sqlFalse } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  name: 'o.name',
  created_at: 'o.created_at',
  user_count: 'user_count',
  ticket_count: 'ticket_count',
};

/**
 * GET /api/admin/super/organizations
 * Lista paginada de organizações com filtros
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || 'all';
    const plan = searchParams.get('plan') || '';
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      const escapedSearch = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push("(o.name LIKE ? ESCAPE '\\' OR o.slug LIKE ? ESCAPE '\\' OR o.domain LIKE ? ESCAPE '\\')");
      const searchPattern = `%${escapedSearch}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (status === 'active') {
      conditions.push(`o.is_active = ${sqlTrue()}`);
    } else if (status === 'suspended') {
      conditions.push(`o.is_active = ${sqlFalse()}`);
    }

    if (plan && ['basic', 'professional', 'enterprise'].includes(plan)) {
      conditions.push('o.subscription_plan = ?');
      params.push(plan);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumn = ALLOWED_SORT_COLUMNS[sort] || 'o.created_at';

    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM organizations o ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const offset = (page - 1) * limit;
    const organizations = await executeQuery(
      `SELECT
        o.id,
        o.name,
        o.slug,
        o.domain,
        o.subscription_plan,
        o.subscription_status,
        o.subscription_expires_at,
        o.max_users,
        o.max_tickets_per_month,
        o.billing_email,
        o.is_active,
        o.created_at,
        o.updated_at,
        (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) as user_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.organization_id = o.id) as ticket_count
      FROM organizations o
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return apiSuccess(organizations, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao listar organizações: ${message}`, 500);
  }
}

const createOrgSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200),
  slug: z
    .string()
    .min(2, 'Slug deve ter no mínimo 2 caracteres')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  domain: z.string().max(255).optional().nullable(),
  subscription_plan: z.enum(['basic', 'professional', 'enterprise']).default('basic'),
  max_users: z.number().int().min(1).max(10000).default(50),
  max_tickets_per_month: z.number().int().min(1).max(1000000).default(1000),
  billing_email: z.string().email('E-mail de cobrança inválido').optional().nullable(),
});

/**
 * POST /api/admin/super/organizations
 * Cria uma nova organização
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Corpo da requisição inválido (JSON malformado)', 400);
    }

    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e) => e.message).join('; ');
      return apiError(`Dados inválidos: ${errors}`, 400);
    }

    const data = parsed.data;

    const existing = await executeQueryOne<{ id: number }>(
      'SELECT id FROM organizations WHERE slug = ?',
      [data.slug]
    );
    if (existing) {
      return apiError('Já existe uma organização com este slug', 409);
    }

    const now = sqlNow();
    const result = await executeRun(
      `INSERT INTO organizations (name, slug, domain, subscription_plan, subscription_status, max_users, max_tickets_per_month, billing_email, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 1, ${now}, ${now})`,
      [
        data.name,
        data.slug,
        data.domain || null,
        data.subscription_plan,
        data.max_users,
        data.max_tickets_per_month,
        data.billing_email || null,
      ]
    );

    const newOrg = await executeQueryOne(
      'SELECT * FROM organizations WHERE id = ?',
      [result.lastInsertRowid!]
    );

    return NextResponse.json(
      { success: true, data: newOrg },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao criar organização: ${message}`, 500);
  }
}
