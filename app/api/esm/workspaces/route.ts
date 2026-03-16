/**
 * ESM Workspaces API
 *
 * GET  — List available ESM workspaces (departments configured for the org)
 * POST — Activate a workspace for the org (inserts categories + templates into DB)
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, type SqlParam } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';
import { ESM_WORKSPACES, type ESMWorkspace } from '@/lib/esm/workspace-templates';

export const dynamic = 'force-dynamic';

// ── GET /api/esm/workspaces ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  try {
    const orgId = auth.organizationId;

    // Fetch which workspaces are activated for this org (stored as system_settings)
    const activatedRows = await executeQuery<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM system_settings
       WHERE organization_id = ? AND setting_key LIKE 'esm_workspace_%'`,
      [orgId],
    );

    const activatedMap = new Map<string, boolean>();
    for (const row of activatedRows) {
      const wsId = row.setting_key.replace('esm_workspace_', '');
      activatedMap.set(wsId, row.setting_value === 'active');
    }

    // Count templates and recent requests per workspace
    const templateCounts = await executeQuery<{ workspace_id: string; cnt: number }>(
      `SELECT
         JSON_EXTRACT(custom_fields, '$.workspace_id') as workspace_id,
         COUNT(*) as cnt
       FROM tickets
       WHERE organization_id = ?
         AND custom_fields IS NOT NULL
         AND JSON_EXTRACT(custom_fields, '$.workspace_id') IS NOT NULL
       GROUP BY JSON_EXTRACT(custom_fields, '$.workspace_id')`,
      [orgId],
    ).catch(() => [] as { workspace_id: string; cnt: number }[]);

    const requestMap = new Map<string, number>();
    for (const row of templateCounts) {
      if (row.workspace_id) requestMap.set(row.workspace_id, row.cnt);
    }

    const workspaces = ESM_WORKSPACES.map((ws) => ({
      id: ws.id,
      name: ws.name,
      department: ws.department,
      icon: ws.icon,
      color: ws.color,
      description: ws.description,
      active: activatedMap.get(ws.id) ?? false,
      template_count: ws.templates.length,
      category_count: ws.categories.length,
      request_count: requestMap.get(ws.id) ?? 0,
    }));

    return apiSuccess(workspaces);
  } catch (error) {
    logger.error('Erro ao listar workspaces ESM', error);
    return apiError('Erro ao listar workspaces', 500);
  }
}

// ── POST /api/esm/workspaces ────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  try {
    const body = await request.json();
    const { workspace_id } = body as { workspace_id?: string };

    if (!workspace_id) {
      return apiError('workspace_id e obrigatorio', 400);
    }

    const workspace = ESM_WORKSPACES.find((w) => w.id === workspace_id);
    if (!workspace) {
      return apiError('Workspace nao encontrado', 404);
    }

    const orgId = auth.organizationId;

    // Check if already activated
    const existing = await executeQueryOne<{ setting_value: string }>(
      `SELECT setting_value FROM system_settings
       WHERE organization_id = ? AND setting_key = ?`,
      [orgId, `esm_workspace_${workspace_id}`],
    );

    if (existing?.setting_value === 'active') {
      return apiError('Workspace ja esta ativo', 409);
    }

    // Activate: insert setting
    if (existing) {
      await executeRun(
        `UPDATE system_settings SET setting_value = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = ? AND setting_key = ?`,
        [orgId, `esm_workspace_${workspace_id}`],
      );
    } else {
      await executeRun(
        `INSERT INTO system_settings (organization_id, setting_key, setting_value, created_at, updated_at)
         VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [orgId, `esm_workspace_${workspace_id}`],
      );
    }

    // Insert categories that don't exist yet
    for (const cat of workspace.categories) {
      const existingCat = await executeQueryOne<{ id: number }>(
        `SELECT id FROM categories WHERE name = ? AND organization_id = ?`,
        [cat.name, orgId],
      );
      if (!existingCat) {
        await executeRun(
          `INSERT INTO categories (name, description, organization_id, created_at, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [cat.name, cat.description, orgId],
        );
      }
    }

    logger.info(`ESM workspace ${workspace.name} ativado para org ${orgId}`);

    return apiSuccess({ activated: true, workspace_id }, undefined, 201);
  } catch (error) {
    logger.error('Erro ao ativar workspace ESM', error);
    return apiError('Erro ao ativar workspace', 500);
  }
}
