/**
 * Ticket Bulk Update API
 *
 * POST /api/tickets/bulk-update - Update multiple tickets at once
 * Requires agent or admin role
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { executeRun, executeTransaction, sqlNow } from '@/lib/db/adapter';
import type { SqlParam } from '@/lib/db/adapter';
import { canManageTickets } from '@/lib/auth/roles';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Only agents and admins can bulk-update tickets
    if (!canManageTickets(auth!.role)) {
      return apiError('Permissao insuficiente para atualizacao em lote', 403);
    }

    const body = await request.json();
    const { ticket_ids, updates } = body;

    // Validate ticket_ids
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return apiError('ticket_ids deve ser um array com pelo menos um ID', 400);
    }

    // Cap at 50 tickets
    const safeIds = ticket_ids.slice(0, 50);

    // Validate all IDs are numbers
    for (const id of safeIds) {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        return apiError('Todos os ticket_ids devem ser numeros inteiros positivos', 400);
      }
    }

    // Validate updates object
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return apiError('updates deve ser um objeto', 400);
    }

    const { status_id, priority_id, assigned_to, category_id } = updates;

    if (
      status_id === undefined &&
      priority_id === undefined &&
      assigned_to === undefined &&
      category_id === undefined
    ) {
      return apiError('Pelo menos um campo de atualizacao e necessario (status_id, priority_id, assigned_to, category_id)', 400);
    }

    // Validate update values are proper types
    if (status_id !== undefined && (typeof status_id !== 'number' || !Number.isInteger(status_id) || status_id <= 0)) {
      return apiError('status_id deve ser um numero inteiro positivo', 400);
    }
    if (priority_id !== undefined && (typeof priority_id !== 'number' || !Number.isInteger(priority_id) || priority_id <= 0)) {
      return apiError('priority_id deve ser um numero inteiro positivo', 400);
    }
    if (assigned_to !== undefined && assigned_to !== null && (typeof assigned_to !== 'number' || !Number.isInteger(assigned_to) || assigned_to <= 0)) {
      return apiError('assigned_to deve ser um numero inteiro positivo ou null', 400);
    }
    if (category_id !== undefined && category_id !== null && (typeof category_id !== 'number' || !Number.isInteger(category_id) || category_id <= 0)) {
      return apiError('category_id deve ser um numero inteiro positivo ou null', 400);
    }

    // Build update SET clause
    const setClauses: string[] = [];
    const baseParams: SqlParam[] = [];

    if (status_id !== undefined) {
      setClauses.push('status_id = ?');
      baseParams.push(status_id);
    }
    if (priority_id !== undefined) {
      setClauses.push('priority_id = ?');
      baseParams.push(priority_id);
    }
    if (assigned_to !== undefined) {
      setClauses.push('assigned_to = ?');
      baseParams.push(assigned_to);
    }
    if (category_id !== undefined) {
      setClauses.push('category_id = ?');
      baseParams.push(category_id);
    }

    setClauses.push(`updated_at = ${sqlNow()}`);

    const orgId = auth!.organizationId;

    // Use transaction for atomicity
    const updated = await executeTransaction(async () => {
      let count = 0;
      for (const ticketId of safeIds) {
        const result = await executeRun(
          `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ? AND organization_id = ?`,
          [...baseParams, ticketId, orgId]
        );
        count += result.changes;
      }
      return count;
    });

    return apiSuccess({ updated, requested: safeIds.length });
  } catch (error) {
    return apiError('Erro ao atualizar tickets em lote', 500);
  }
}
