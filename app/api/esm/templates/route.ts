/**
 * ESM Templates API
 *
 * GET  — List templates for a workspace (query param: workspace_id)
 * POST — Create a custom template for a workspace
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';
import { getWorkspaceById, type ESMTemplate, type ESMField } from '@/lib/esm/workspace-templates';

export const dynamic = 'force-dynamic';

// ── GET /api/esm/templates?workspace_id=... ─────────────────────────────────
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) {
    return apiError('workspace_id e obrigatorio', 400);
  }

  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) {
    return apiError('Workspace nao encontrado', 404);
  }

  try {
    const orgId = auth.organizationId;

    // Built-in templates from the workspace definition
    const builtIn: (ESMTemplate & { source: string })[] = workspace.templates.map((t) => ({
      ...t,
      source: 'builtin',
    }));

    // Custom templates stored in ticket_templates table
    const customRows = await executeQuery<{
      id: number;
      name: string;
      description: string;
      custom_fields: string;
    }>(
      `SELECT id, name, description, custom_fields
       FROM ticket_templates
       WHERE organization_id = ?
         AND custom_fields IS NOT NULL
         AND JSON_EXTRACT(custom_fields, '$.esm_workspace_id') = ?`,
      [orgId, workspaceId],
    ).catch(() => []);

    const customTemplates = customRows.map((row) => {
      const meta = JSON.parse(row.custom_fields || '{}');
      return {
        id: `custom-${row.id}`,
        name: row.name,
        description: row.description || '',
        category: meta.category || '',
        priority: meta.priority || 'medium',
        fields: (meta.fields || []) as ESMField[],
        source: 'custom' as const,
        db_id: row.id,
      };
    });

    return apiSuccess([...builtIn, ...customTemplates]);
  } catch (error) {
    logger.error('Erro ao listar templates ESM', error);
    return apiError('Erro ao listar templates', 500);
  }
}

// ── POST /api/esm/templates ─────────────────────────────────────────────────
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
    const {
      workspace_id,
      name,
      description,
      category,
      priority,
      fields,
    } = body as {
      workspace_id?: string;
      name?: string;
      description?: string;
      category?: string;
      priority?: string;
      fields?: ESMField[];
    };

    if (!workspace_id || !name) {
      return apiError('workspace_id e name sao obrigatorios', 400);
    }

    const workspace = getWorkspaceById(workspace_id);
    if (!workspace) {
      return apiError('Workspace nao encontrado', 404);
    }

    const orgId = auth.organizationId;

    const customFields = JSON.stringify({
      esm_workspace_id: workspace_id,
      category: category || '',
      priority: priority || 'medium',
      fields: fields || [],
    });

    const result = await executeRun(
      `INSERT INTO ticket_templates (name, description, custom_fields, organization_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, description || '', customFields, orgId],
    );

    logger.info(`Template ESM criado: ${name} (workspace ${workspace_id}, org ${orgId})`);

    return apiSuccess(
      {
        id: result.lastInsertRowid,
        name,
        description,
        workspace_id,
        category,
        priority,
        fields,
      },
      undefined,
      201,
    );
  } catch (error) {
    logger.error('Erro ao criar template ESM', error);
    return apiError('Erro ao criar template', 500);
  }
}
