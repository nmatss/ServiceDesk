/**
 * Self-Healing Runbook Detail API
 *
 * GET: Get runbook detail
 * PUT: Update a custom runbook
 * DELETE: Delete a custom runbook
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin } from '@/lib/auth/roles';
import { executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';
import { DEFAULT_RUNBOOKS, type Runbook } from '@/lib/self-healing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/self-healing/runbooks/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { organizationId, role } = guard.auth!;

  if (!isAdmin(role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;

  try {
    // Check custom runbooks first
    const customRunbooks = await getCustomRunbooks(organizationId);
    const custom = customRunbooks.find((r) => r.id === id);
    if (custom) {
      return apiSuccess({ runbook: { ...custom, is_custom: true } });
    }

    // Check default runbooks
    const defaultRb = DEFAULT_RUNBOOKS.find((r) => r.id === id);
    if (defaultRb) {
      return apiSuccess({ runbook: { ...defaultRb, is_custom: false } });
    }

    return apiError('Runbook nao encontrado', 404);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    return apiError(`Erro ao buscar runbook: ${errMsg}`, 500);
  }
}

/**
 * PUT /api/self-healing/runbooks/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { organizationId, userId, role } = guard.auth!;

  if (!isAdmin(role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const customRunbooks = await getCustomRunbooks(organizationId);
    const index = customRunbooks.findIndex((r) => r.id === id);

    // If it's a default runbook, create a custom override
    const isDefault = DEFAULT_RUNBOOKS.some((r) => r.id === id);

    if (index < 0 && !isDefault) {
      return apiError('Runbook nao encontrado', 404);
    }

    // Validate steps if provided
    if (body.steps) {
      if (!Array.isArray(body.steps) || body.steps.length === 0) {
        return apiError('Steps deve ser um array nao vazio', 400);
      }
      if (body.steps.length > 20) {
        return apiError('Runbook nao pode ter mais de 20 passos', 400);
      }

      const validTypes = ['webhook', 'api_call', 'wait', 'check_metric', 'notify', 'create_ticket', 'update_ci_status'];
      for (const step of body.steps) {
        if (!validTypes.includes(step.type)) {
          return apiError(`Tipo de passo invalido: ${step.type}`, 400);
        }
      }
    }

    const baseRunbook = index >= 0
      ? customRunbooks[index]
      : DEFAULT_RUNBOOKS.find((r) => r.id === id)!;

    const updated: Runbook = {
      ...baseRunbook,
      name: body.name ?? baseRunbook.name,
      description: body.description ?? baseRunbook.description,
      trigger: body.trigger ?? baseRunbook.trigger,
      risk: body.risk ?? baseRunbook.risk,
      enabled: body.enabled ?? baseRunbook.enabled,
      steps: body.steps
        ? body.steps.map((s: Record<string, unknown>, i: number) => ({
            order: s.order || i + 1,
            type: s.type,
            name: s.name || `Passo ${i + 1}`,
            config: s.config || {},
            timeout_ms: s.timeout_ms || 30000,
            continue_on_error: s.continue_on_error || false,
          }))
        : baseRunbook.steps,
      max_duration_ms: body.max_duration_ms ?? baseRunbook.max_duration_ms,
    };

    if (index >= 0) {
      customRunbooks[index] = updated;
    } else {
      customRunbooks.push(updated);
    }

    await saveCustomRunbooks(organizationId, customRunbooks);

    logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Runbook updated: ${updated.name}`, { orgId: organizationId, userId, runbookId: id });

    return apiSuccess({ runbook: { ...updated, is_custom: true } });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    return apiError(`Erro ao atualizar runbook: ${errMsg}`, 500);
  }
}

/**
 * DELETE /api/self-healing/runbooks/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { organizationId, userId, role } = guard.auth!;

  if (!isAdmin(role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;

  try {
    // Cannot delete default runbooks
    const isDefault = DEFAULT_RUNBOOKS.some((r) => r.id === id);
    if (isDefault) {
      // If there's a custom override, remove the override (revert to default)
      const customRunbooks = await getCustomRunbooks(organizationId);
      const index = customRunbooks.findIndex((r) => r.id === id);
      if (index >= 0) {
        customRunbooks.splice(index, 1);
        await saveCustomRunbooks(organizationId, customRunbooks);
        return apiSuccess({ message: 'Override customizado removido. Runbook padrao restaurado.' });
      }
      return apiError('Nao e possivel excluir runbooks padrao', 400);
    }

    const customRunbooks = await getCustomRunbooks(organizationId);
    const index = customRunbooks.findIndex((r) => r.id === id);
    if (index < 0) {
      return apiError('Runbook nao encontrado', 404);
    }

    customRunbooks.splice(index, 1);
    await saveCustomRunbooks(organizationId, customRunbooks);

    logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Runbook deleted: ${id}`, { orgId: organizationId, userId, runbookId: id });

    return apiSuccess({ message: 'Runbook excluido com sucesso' });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    return apiError(`Erro ao excluir runbook: ${errMsg}`, 500);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCustomRunbooks(orgId: number): Promise<Runbook[]> {
  const row = await executeQueryOne<{ value: string }>(
    "SELECT value FROM system_settings WHERE key = 'self_healing_custom_runbooks' AND organization_id = ?",
    [orgId]
  );
  if (!row?.value) return [];
  try {
    return JSON.parse(row.value) as Runbook[];
  } catch {
    return [];
  }
}

async function saveCustomRunbooks(orgId: number, runbooks: Runbook[]): Promise<void> {
  const value = JSON.stringify(runbooks);
  const existing = await executeQueryOne<{ id: number }>(
    "SELECT id FROM system_settings WHERE key = 'self_healing_custom_runbooks' AND organization_id = ?",
    [orgId]
  );
  if (existing) {
    await executeRun(
      `UPDATE system_settings SET value = ?, updated_at = ${sqlNow()} WHERE key = 'self_healing_custom_runbooks' AND organization_id = ?`,
      [value, orgId]
    );
  } else {
    await executeRun(
      `INSERT INTO system_settings (key, value, organization_id, created_at, updated_at) VALUES ('self_healing_custom_runbooks', ?, ?, ${sqlNow()}, ${sqlNow()})`,
      [value, orgId]
    );
  }
}
