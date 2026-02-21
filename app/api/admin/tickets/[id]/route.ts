import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    // Verify authentication - admins and agents
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin', 'agent'] });
    if (guard.response) return guard.response;

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ success: false, error: 'ID do ticket inválido' }, { status: 400 });
    }

    const ticket = await executeQueryOne<Record<string, unknown>>(`
      SELECT
        t.*,
        u.name as user_name, u.email as user_email, u.role as user_role,
        a.name as assigned_agent_name, a.email as assigned_agent_email, a.role as assigned_agent_role,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.level as priority_level, p.color as priority_color,
        s.name as status_name, s.description as status_description, s.color as status_color, s.is_final as status_is_final
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.id = ? AND t.organization_id = ?
    `, [ticketId, guard.auth.organizationId]);

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    logger.error('Erro ao buscar ticket', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    // Verify authentication - admins and agents
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin', 'agent'] });
    if (guard.response) return guard.response;

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ success: false, error: 'ID do ticket inválido' }, { status: 400 });
    }

    // Check ticket exists and belongs to tenant
    const existing = await executeQueryOne<{ id: number }>(
      `SELECT id FROM tickets WHERE id = ? AND organization_id = ?`,
      [ticketId, guard.auth.organizationId]
    );
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Ticket não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, category_id, priority_id, status_id, assigned_to } = body;

    // Validar dados
    if (title && title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Título não pode estar vazio' }, { status: 400 });
    }

    if (description && description.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Descrição não pode estar vazia' }, { status: 400 });
    }

    // Build dynamic update query
    const fields: string[] = [];
    const values: unknown[] = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description.trim()); }
    if (category_id !== undefined) { fields.push('category_id = ?'); values.push(category_id); }
    if (priority_id !== undefined) { fields.push('priority_id = ?'); values.push(priority_id); }
    if (status_id !== undefined) { fields.push('status_id = ?'); values.push(status_id); }
    if (assigned_to !== undefined) { fields.push('assigned_to = ?'); values.push(assigned_to); }

    if (fields.length > 0) {
      values.push(ticketId, guard.auth.organizationId);
      await executeRun(
        `UPDATE tickets SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
        values
      );
    }

    // Return updated ticket
    const updatedTicket = await executeQueryOne<Record<string, unknown>>(
      `SELECT * FROM tickets WHERE id = ? AND organization_id = ?`,
      [ticketId, guard.auth.organizationId]
    );

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    logger.error('Erro ao atualizar ticket', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    // Only admins can delete tickets
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
    if (guard.response) return guard.response;

    const { id } = await params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      return NextResponse.json({ success: false, error: 'ID do ticket inválido' }, { status: 400 });
    }

    // Check ticket exists and belongs to tenant
    const existing = await executeQueryOne<{ id: number }>(
      `SELECT id FROM tickets WHERE id = ? AND organization_id = ?`,
      [ticketId, guard.auth.organizationId]
    );
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Ticket não encontrado' }, { status: 404 });
    }

    // SECURITY: Scoped delete by organization_id
    const result = await executeRun(
      `DELETE FROM tickets WHERE id = ? AND organization_id = ?`,
      [ticketId, guard.auth.organizationId]
    );

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Erro ao deletar ticket' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Ticket deletado com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar ticket', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
