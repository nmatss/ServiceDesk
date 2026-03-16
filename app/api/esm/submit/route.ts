/**
 * ESM Submit API
 *
 * POST — Submit an ESM request (creates a ticket from form data)
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';
import { departmentFormEngine } from '@/lib/esm/department-forms';
import { getWorkspaceById } from '@/lib/esm/workspace-templates';

export const dynamic = 'force-dynamic';

// ── POST /api/esm/submit ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  try {
    const body = await request.json();
    const { workspace_id, template_id, form_data } = body as {
      workspace_id?: string;
      template_id?: string;
      form_data?: Record<string, unknown>;
    };

    // ── Validate input ──────────────────────────────────────────────────
    if (!workspace_id || !template_id || !form_data) {
      return apiError('workspace_id, template_id e form_data sao obrigatorios', 400);
    }

    const workspace = getWorkspaceById(workspace_id);
    if (!workspace) {
      return apiError('Workspace nao encontrado', 404);
    }

    // Look up template
    const template = departmentFormEngine.getFormForTemplate(workspace_id, template_id);
    if (!template) {
      return apiError('Template nao encontrado', 404);
    }

    // ── Validate form data ──────────────────────────────────────────────
    const validation = departmentFormEngine.validateForm(template, form_data);
    if (!validation.valid) {
      return apiError(
        `Dados invalidos: ${validation.errors.map((e) => e.message).join('; ')}`,
        422,
      );
    }

    // ── Build ticket payload ────────────────────────────────────────────
    const payload = departmentFormEngine.buildTicketPayload(
      template,
      form_data,
      auth.userId,
      workspace_id,
    );

    const orgId = auth.organizationId;

    // Resolve category id
    const categoryRow = await executeQueryOne<{ id: number }>(
      `SELECT id FROM categories WHERE name = ? AND organization_id = ?`,
      [payload.category_name, orgId],
    );

    // Resolve priority id
    const priorityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const priorityName = payload.priority;
    const priorityRow = await executeQueryOne<{ id: number }>(
      `SELECT id FROM priorities WHERE name = ? AND organization_id = ?`,
      [priorityName, orgId],
    ).catch(() => null);

    // Fallback: get a default open status
    const statusRow = await executeQueryOne<{ id: number }>(
      `SELECT id FROM statuses WHERE name IN ('open', 'Aberto', 'aberto') AND organization_id = ? LIMIT 1`,
      [orgId],
    );

    // ── Insert ticket ───────────────────────────────────────────────────
    const customFieldsJson = JSON.stringify({
      ...payload.custom_fields,
      workspace_id: payload.workspace_id,
      template_id: payload.template_id,
      esm_department: workspace.department,
    });

    const result = await executeRun(
      `INSERT INTO tickets (
         title, description, status_id, priority_id, category_id,
         user_id, organization_id, custom_fields,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        payload.title,
        payload.description,
        statusRow?.id ?? 1,
        priorityRow?.id ?? priorityMap[priorityName] ?? 2,
        categoryRow?.id ?? null,
        auth.userId,
        orgId,
        customFieldsJson,
      ],
    );

    const ticketId = result.lastInsertRowid;

    // ── Record activity ─────────────────────────────────────────────────
    await executeRun(
      `INSERT INTO ticket_activities (
         ticket_id, user_id, activity_type, description,
         created_at
       ) VALUES (?, ?, 'created', ?, CURRENT_TIMESTAMP)`,
      [
        ticketId,
        auth.userId,
        `Solicitacao ESM criada via ${workspace.name} - ${template.name}`,
      ],
    ).catch(() => { /* activity logging is best-effort */ });

    logger.info(
      `ESM request criado: ticket #${ticketId} (${workspace.name}/${template.name}) por user ${auth.userId}`,
    );

    return apiSuccess(
      {
        ticket_id: ticketId,
        title: payload.title,
        workspace: workspace.name,
        template: template.name,
        department: workspace.department,
      },
      undefined,
      201,
    );
  } catch (error) {
    logger.error('Erro ao submeter solicitacao ESM', error);
    return apiError('Erro ao criar solicitacao', 500);
  }
}
