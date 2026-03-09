import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQueryOne, executeRun, sqlNow, sqlFalse } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

/**
 * GET /api/admin/super/organizations/[id]
 * Detalhes de uma organização específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId) || orgId <= 0) {
      return apiError('ID de organização inválido', 400);
    }

    const org = await executeQueryOne(
      `SELECT
        o.id,
        o.name,
        o.slug,
        o.domain,
        o.settings,
        o.subscription_plan,
        o.subscription_status,
        o.subscription_expires_at,
        o.max_users,
        o.max_tickets_per_month,
        o.features,
        o.billing_email,
        o.is_active,
        o.created_at,
        o.updated_at,
        (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) as user_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.organization_id = o.id) as ticket_count
      FROM organizations o
      WHERE o.id = ?`,
      [orgId]
    );

    if (!org) {
      return apiError('Organização não encontrada', 404);
    }

    return apiSuccess(org);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao buscar organização: ${message}`, 500);
  }
}

const updateOrgSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .optional(),
  domain: z.string().max(255).optional().nullable(),
  subscription_plan: z.enum(['basic', 'professional', 'enterprise']).optional(),
  subscription_status: z.enum(['active', 'cancelled', 'suspended']).optional(),
  max_users: z.number().int().min(1).max(10000).optional(),
  max_tickets_per_month: z.number().int().min(1).max(1000000).optional(),
  billing_email: z.string().email('E-mail de cobrança inválido').optional().nullable(),
  settings: z.string().optional().nullable(),
  features: z.string().optional().nullable(),
});

/**
 * PUT /api/admin/super/organizations/[id]
 * Atualiza uma organização
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId) || orgId <= 0) {
      return apiError('ID de organização inválido', 400);
    }

    const existing = await executeQueryOne<{ id: number }>(
      'SELECT id FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!existing) {
      return apiError('Organização não encontrada', 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Corpo da requisição inválido (JSON malformado)', 400);
    }

    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e) => e.message).join('; ');
      return apiError(`Dados inválidos: ${errors}`, 400);
    }

    const data = parsed.data;

    if (data.slug) {
      const slugConflict = await executeQueryOne<{ id: number }>(
        'SELECT id FROM organizations WHERE slug = ? AND id != ?',
        [data.slug, orgId]
      );
      if (slugConflict) {
        return apiError('Já existe outra organização com este slug', 409);
      }
    }

    const setClauses: string[] = [];
    const updateParams: (string | number | null)[] = [];

    const fields: Array<{ key: keyof typeof data; column: string }> = [
      { key: 'name', column: 'name' },
      { key: 'slug', column: 'slug' },
      { key: 'domain', column: 'domain' },
      { key: 'subscription_plan', column: 'subscription_plan' },
      { key: 'subscription_status', column: 'subscription_status' },
      { key: 'max_users', column: 'max_users' },
      { key: 'max_tickets_per_month', column: 'max_tickets_per_month' },
      { key: 'billing_email', column: 'billing_email' },
      { key: 'settings', column: 'settings' },
      { key: 'features', column: 'features' },
    ];

    for (const field of fields) {
      if (data[field.key] !== undefined) {
        setClauses.push(`${field.column} = ?`);
        updateParams.push(data[field.key] as string | number | null);
      }
    }

    if (setClauses.length === 0) {
      return apiError('Nenhum campo para atualizar foi fornecido', 400);
    }

    const now = sqlNow();
    setClauses.push(`updated_at = ${now}`);
    updateParams.push(orgId);

    await executeRun(
      `UPDATE organizations SET ${setClauses.join(', ')} WHERE id = ?`,
      updateParams
    );

    const updated = await executeQueryOne(
      'SELECT * FROM organizations WHERE id = ?',
      [orgId]
    );

    return apiSuccess(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao atualizar organização: ${message}`, 500);
  }
}

/**
 * DELETE /api/admin/super/organizations/[id]
 * Desativa uma organização (soft delete - nunca exclui permanentemente)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const orgId = parseInt(id, 10);
    if (isNaN(orgId) || orgId <= 0) {
      return apiError('ID de organização inválido', 400);
    }

    if (orgId === 1) {
      return apiError('Não é permitido desativar a organização principal do sistema', 403);
    }

    const existing = await executeQueryOne<{ id: number }>(
      'SELECT id FROM organizations WHERE id = ?',
      [orgId]
    );
    if (!existing) {
      return apiError('Organização não encontrada', 404);
    }

    const now = sqlNow();
    await executeRun(
      `UPDATE organizations SET is_active = ${sqlFalse()}, subscription_status = 'suspended', updated_at = ${now} WHERE id = ?`,
      [orgId]
    );

    return apiSuccess({ message: 'Organização desativada com sucesso' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao desativar organização: ${message}`, 500);
  }
}
