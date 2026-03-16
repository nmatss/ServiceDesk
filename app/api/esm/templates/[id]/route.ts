/**
 * ESM Template Detail API
 *
 * GET    — Template detail with all fields
 * PUT    — Update a custom template
 * DELETE — Delete a custom template
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';
import { ESM_WORKSPACES, type ESMField } from '@/lib/esm/workspace-templates';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Look up a built-in template by id across all workspaces.
 */
function findBuiltInTemplate(templateId: string) {
  for (const ws of ESM_WORKSPACES) {
    const t = ws.templates.find((tpl) => tpl.id === templateId);
    if (t) return { template: t, workspace: ws };
  }
  return null;
}

// ── GET /api/esm/templates/[id] ─────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  const { id } = await params;

  // Check built-in templates first
  const builtIn = findBuiltInTemplate(id);
  if (builtIn) {
    return apiSuccess({
      ...builtIn.template,
      workspace_id: builtIn.workspace.id,
      workspace_name: builtIn.workspace.name,
      source: 'builtin',
    });
  }

  // Check custom templates (id format: custom-<db_id>)
  if (id.startsWith('custom-')) {
    const dbId = parseInt(id.replace('custom-', ''), 10);
    if (isNaN(dbId)) return apiError('ID invalido', 400);

    try {
      const row = await executeQueryOne<{
        id: number;
        name: string;
        description: string;
        custom_fields: string;
      }>(
        `SELECT id, name, description, custom_fields
         FROM ticket_templates
         WHERE id = ? AND organization_id = ?`,
        [dbId, auth.organizationId],
      );

      if (!row) return apiError('Template nao encontrado', 404);

      const meta = JSON.parse(row.custom_fields || '{}');
      return apiSuccess({
        id: `custom-${row.id}`,
        db_id: row.id,
        name: row.name,
        description: row.description,
        category: meta.category || '',
        priority: meta.priority || 'medium',
        fields: meta.fields || [],
        workspace_id: meta.esm_workspace_id,
        source: 'custom',
      });
    } catch (error) {
      logger.error('Erro ao buscar template ESM', error);
      return apiError('Erro ao buscar template', 500);
    }
  }

  return apiError('Template nao encontrado', 404);
}

// ── PUT /api/esm/templates/[id] ─────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;

  // Only custom templates can be updated
  if (!id.startsWith('custom-')) {
    return apiError('Templates nativos nao podem ser editados', 400);
  }

  const dbId = parseInt(id.replace('custom-', ''), 10);
  if (isNaN(dbId)) return apiError('ID invalido', 400);

  try {
    const body = await request.json();
    const { name, description, category, priority, fields } = body as {
      name?: string;
      description?: string;
      category?: string;
      priority?: string;
      fields?: ESMField[];
    };

    const existing = await executeQueryOne<{ id: number; custom_fields: string }>(
      `SELECT id, custom_fields FROM ticket_templates WHERE id = ? AND organization_id = ?`,
      [dbId, auth.organizationId],
    );

    if (!existing) return apiError('Template nao encontrado', 404);

    const currentMeta = JSON.parse(existing.custom_fields || '{}');
    const newMeta = {
      ...currentMeta,
      ...(category !== undefined && { category }),
      ...(priority !== undefined && { priority }),
      ...(fields !== undefined && { fields }),
    };

    await executeRun(
      `UPDATE ticket_templates
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           custom_fields = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [name || null, description || null, JSON.stringify(newMeta), dbId, auth.organizationId],
    );

    logger.info(`Template ESM custom-${dbId} atualizado (org ${auth.organizationId})`);
    return apiSuccess({ id, updated: true });
  } catch (error) {
    logger.error('Erro ao atualizar template ESM', error);
    return apiError('Erro ao atualizar template', 500);
  }
}

// ── DELETE /api/esm/templates/[id] ──────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  const { id } = await params;

  if (!id.startsWith('custom-')) {
    return apiError('Templates nativos nao podem ser excluidos', 400);
  }

  const dbId = parseInt(id.replace('custom-', ''), 10);
  if (isNaN(dbId)) return apiError('ID invalido', 400);

  try {
    const result = await executeRun(
      `DELETE FROM ticket_templates WHERE id = ? AND organization_id = ?`,
      [dbId, auth.organizationId],
    );

    if (result.changes === 0) {
      return apiError('Template nao encontrado', 404);
    }

    logger.info(`Template ESM custom-${dbId} excluido (org ${auth.organizationId})`);
    return apiSuccess({ id, deleted: true });
  } catch (error) {
    logger.error('Erro ao excluir template ESM', error);
    return apiError('Erro ao excluir template', 500);
  }
}
