/**
 * ESM Workspace Detail API
 *
 * GET    — Get workspace detail with all templates
 * PUT    — Update workspace configuration (activate/deactivate)
 * DELETE — Deactivate workspace
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';
import { getWorkspaceById } from '@/lib/esm/workspace-templates';
import { ESM_WORKFLOW_DEFINITIONS } from '@/lib/esm/onboarding-flows';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/esm/workspaces/[id] ───────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  const { id } = await params;
  const workspace = getWorkspaceById(id);
  if (!workspace) {
    return apiError('Workspace nao encontrado', 404);
  }

  try {
    const orgId = auth.organizationId;

    // Check activation status
    const setting = await executeQueryOne<{ setting_value: string }>(
      `SELECT setting_value FROM system_settings
       WHERE organization_id = ? AND setting_key = ?`,
      [orgId, `esm_workspace_${id}`],
    );

    // Request counts per template
    const templateStats = await executeQuery<{ template_id: string; cnt: number }>(
      `SELECT
         JSON_EXTRACT(custom_fields, '$.template_id') as template_id,
         COUNT(*) as cnt
       FROM tickets
       WHERE organization_id = ?
         AND custom_fields IS NOT NULL
         AND JSON_EXTRACT(custom_fields, '$.workspace_id') = ?
       GROUP BY JSON_EXTRACT(custom_fields, '$.template_id')`,
      [orgId, id],
    ).catch(() => [] as { template_id: string; cnt: number }[]);

    const statsMap = new Map<string, number>();
    for (const row of templateStats) {
      if (row.template_id) statsMap.set(row.template_id, row.cnt);
    }

    // Enrich templates with usage counts
    const templates = workspace.templates.map((t) => ({
      ...t,
      usage_count: statsMap.get(t.id) ?? 0,
    }));

    // Linked workflows
    const workflows = ESM_WORKFLOW_DEFINITIONS.filter(
      (wf) => workspace.workflows.some((ww) => ww.id === wf.id),
    ).map((wf) => ({
      id: wf.id,
      name: wf.name,
      description: wf.description,
      steps: wf.steps.length,
    }));

    return apiSuccess({
      id: workspace.id,
      name: workspace.name,
      department: workspace.department,
      icon: workspace.icon,
      color: workspace.color,
      description: workspace.description,
      active: setting?.setting_value === 'active',
      categories: workspace.categories,
      templates,
      workflows,
      sla_defaults: workspace.sla_defaults,
    });
  } catch (error) {
    logger.error('Erro ao buscar workspace ESM', error);
    return apiError('Erro ao buscar workspace', 500);
  }
}

// ── PUT /api/esm/workspaces/[id] ───────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;
  const workspace = getWorkspaceById(id);
  if (!workspace) {
    return apiError('Workspace nao encontrado', 404);
  }

  try {
    const body = await request.json();
    const { active } = body as { active?: boolean };
    const orgId = auth.organizationId;
    const settingKey = `esm_workspace_${id}`;
    const newValue = active ? 'active' : 'inactive';

    const existing = await executeQueryOne<{ id: number }>(
      `SELECT id FROM system_settings WHERE organization_id = ? AND setting_key = ?`,
      [orgId, settingKey],
    );

    if (existing) {
      await executeRun(
        `UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = ? AND setting_key = ?`,
        [newValue, orgId, settingKey],
      );
    } else {
      await executeRun(
        `INSERT INTO system_settings (organization_id, setting_key, setting_value, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [orgId, settingKey, newValue],
      );
    }

    logger.info(`ESM workspace ${id} ${newValue} para org ${orgId}`);
    return apiSuccess({ id, active: active ?? false });
  } catch (error) {
    logger.error('Erro ao atualizar workspace ESM', error);
    return apiError('Erro ao atualizar workspace', 500);
  }
}

// ── DELETE /api/esm/workspaces/[id] ─────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;
  const orgId = auth.organizationId;

  try {
    await executeRun(
      `UPDATE system_settings SET setting_value = 'inactive', updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND setting_key = ?`,
      [orgId, `esm_workspace_${id}`],
    );

    logger.info(`ESM workspace ${id} desativado para org ${orgId}`);
    return apiSuccess({ id, active: false });
  } catch (error) {
    logger.error('Erro ao desativar workspace ESM', error);
    return apiError('Erro ao desativar workspace', 500);
  }
}
