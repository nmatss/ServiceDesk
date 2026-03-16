/**
 * Self-Healing Runbooks API
 *
 * GET: List all runbooks (default + custom)
 * POST: Create a custom runbook
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
 * GET /api/self-healing/runbooks
 * List all runbooks (default + org-custom).
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { organizationId, role } = guard.auth!;

  if (!isAdmin(role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  try {
    // Get custom runbooks from system_settings
    const customRunbooks = await getCustomRunbooks(organizationId);

    // Merge: custom runbooks can override defaults by ID
    const customIds = new Set(customRunbooks.map((r) => r.id));
    const defaults = DEFAULT_RUNBOOKS.filter((r) => !customIds.has(r.id));

    const allRunbooks = [
      ...defaults.map((r) => ({ ...r, is_custom: false })),
      ...customRunbooks.map((r) => ({ ...r, is_custom: true })),
    ];

    return apiSuccess({
      runbooks: allRunbooks,
      total: allRunbooks.length,
      default_count: defaults.length,
      custom_count: customRunbooks.length,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Error listing runbooks: ${errMsg}`);
    return apiError(`Erro ao listar runbooks: ${errMsg}`, 500);
  }
}

/**
 * POST /api/self-healing/runbooks
 * Create a custom runbook.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { organizationId, userId, role } = guard.auth!;

  if (!isAdmin(role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  try {
    const body = await request.json();

    // Validate runbook structure
    if (!body.id || !body.name || !body.trigger || !body.steps || !Array.isArray(body.steps)) {
      return apiError('Campos obrigatorios: id, name, trigger, steps (array)', 400);
    }

    if (body.steps.length === 0) {
      return apiError('Runbook deve ter pelo menos 1 passo', 400);
    }

    if (body.steps.length > 20) {
      return apiError('Runbook nao pode ter mais de 20 passos', 400);
    }

    // Validate step types
    const validTypes = ['webhook', 'api_call', 'wait', 'check_metric', 'notify', 'create_ticket', 'update_ci_status'];
    for (const step of body.steps) {
      if (!validTypes.includes(step.type)) {
        return apiError(`Tipo de passo invalido: ${step.type}. Validos: ${validTypes.join(', ')}`, 400);
      }
    }

    const newRunbook: Runbook = {
      id: body.id,
      name: body.name,
      description: body.description || '',
      trigger: body.trigger,
      risk: body.risk || 'medium',
      enabled: body.enabled ?? true,
      steps: body.steps.map((s: Record<string, unknown>, i: number) => ({
        order: s.order || i + 1,
        type: s.type,
        name: s.name || `Passo ${i + 1}`,
        config: s.config || {},
        timeout_ms: s.timeout_ms || 30000,
        continue_on_error: s.continue_on_error || false,
      })),
      max_duration_ms: body.max_duration_ms || 300000,
    };

    // Save to system_settings
    const customRunbooks = await getCustomRunbooks(organizationId);
    const existingIndex = customRunbooks.findIndex((r) => r.id === newRunbook.id);
    if (existingIndex >= 0) {
      return apiError(`Runbook com ID '${newRunbook.id}' ja existe. Use PUT para atualizar.`, 409);
    }

    customRunbooks.push(newRunbook);
    await saveCustomRunbooks(organizationId, customRunbooks);

    logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Custom runbook created: ${newRunbook.name}`, { orgId: organizationId, userId, runbookId: newRunbook.id });

    return apiSuccess({ runbook: { ...newRunbook, is_custom: true } }, undefined, 201);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Error creating runbook: ${errMsg}`);
    return apiError(`Erro ao criar runbook: ${errMsg}`, 500);
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
