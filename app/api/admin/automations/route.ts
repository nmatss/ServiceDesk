import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin } from '@/lib/auth/roles';
import { apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// GET - Listar automações
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem gerenciar automações
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('is_active');
    const triggerType = searchParams.get('trigger_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // FILTRAR POR TENANT - automations criadas por usuários do tenant
    let whereClause = 'WHERE u.organization_id = ?';
    const params: any[] = [tenantId];

    // Filtrar por status ativo
    if (isActive !== null) {
      whereClause += ' AND a.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Filtrar por tipo de trigger
    if (triggerType) {
      whereClause += ' AND a.trigger_type = ?';
      params.push(triggerType);
    }

    // Buscar automações FILTRADAS POR TENANT
    const automations = await executeQuery(`
      SELECT
        a.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Contar total FILTRADO POR TENANT
    const { total } = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
    `, params) || { total: 0 };

    // Estatísticas de execução FILTRADAS POR TENANT
    const stats = await executeQueryOne(`
      SELECT
        COUNT(*) as total_automations,
        COUNT(CASE WHEN a.is_active = 1 THEN 1 END) as active_automations,
        SUM(a.execution_count) as total_executions
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE u.organization_id = ?
    `, [tenantId]);

    return NextResponse.json({
      success: true,
      automations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total
      },
      stats
    });

  } catch (error) {
    logger.error('Erro ao buscar automações', error);
    return apiError('Erro interno do servidor', 500);
  }
}

// POST - Criar automação
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem criar automações
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const body = await request.json();
    const {
      name,
      description,
      trigger_type,
      conditions,
      actions,
      is_active = true
    } = body;

    // Validar dados obrigatórios
    if (!name || !trigger_type || !conditions || !actions) {
      return NextResponse.json({
        error: 'Nome, tipo de trigger, condições e ações são obrigatórios'
      }, { status: 400 });
    }

    // Validar tipo de trigger
    const validTriggers = ['ticket_created', 'ticket_updated', 'ticket_assigned', 'sla_warning', 'sla_breach', 'comment_added', 'time_based'];
    if (!validTriggers.includes(trigger_type)) {
      return NextResponse.json({
        error: 'Tipo de trigger inválido'
      }, { status: 400 });
    }

    // Validar formato JSON das condições e ações
    try {
      JSON.parse(JSON.stringify(conditions));
      JSON.parse(JSON.stringify(actions));
    } catch {
      return NextResponse.json({
        error: 'Formato inválido para condições ou ações'
      }, { status: 400 });
    }

    // Verificar se já existe automação com o mesmo nome NO TENANT
    const existingAutomation = await executeQueryOne(`
      SELECT a.id FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.name = ? AND u.organization_id = ?
    `, [name, tenantId]);

    if (existingAutomation) {
      return NextResponse.json({
        error: 'Já existe uma automação com este nome neste tenant'
      }, { status: 409 });
    }

    // Criar automação
    const result = await executeRun(`
      INSERT INTO automations (
        name, description, trigger_type, conditions, actions, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name,
      description || null,
      trigger_type,
      JSON.stringify(conditions),
      JSON.stringify(actions),
      is_active ? 1 : 0,
      auth.userId]);

    // Buscar automação criada
    const newAutomation = await executeQueryOne(`
      SELECT
        a.*,
        u.name as created_by_name
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `, [result.lastInsertRowid]);

    return NextResponse.json({
      success: true,
      message: 'Automação criada com sucesso',
      automation: newAutomation
    }, { status: 201 });

  } catch (error) {
    logger.error('Erro ao criar automação', error);
    return apiError('Erro interno do servidor', 500);
  }
}

// PUT - Atualizar automação
export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem atualizar automações
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const body = await request.json();
    const {
      id,
      name,
      description,
      trigger_type,
      conditions,
      actions,
      is_active
    } = body;

    // Validar ID
    if (!id) {
      return NextResponse.json({ error: 'ID da automação é obrigatório' }, { status: 400 });
    }

    // Verificar se automação existe E PERTENCE AO TENANT
    const automation = await executeQueryOne(`
      SELECT a.* FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ? AND u.organization_id = ?
    `, [id, tenantId]);
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada neste tenant' }, { status: 404 });
    }

    // Validar formato JSON se fornecido
    if (conditions) {
      try {
        JSON.parse(JSON.stringify(conditions));
      } catch {
        return NextResponse.json({
          error: 'Formato inválido para condições'
        }, { status: 400 });
      }
    }

    if (actions) {
      try {
        JSON.parse(JSON.stringify(actions));
      } catch {
        return NextResponse.json({
          error: 'Formato inválido para ações'
        }, { status: 400 });
      }
    }

    // Atualizar automação
    await executeRun(`
      UPDATE automations SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        trigger_type = COALESCE(?, trigger_type),
        conditions = COALESCE(?, conditions),
        actions = COALESCE(?, actions),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name || null,
      description || null,
      trigger_type || null,
      conditions ? JSON.stringify(conditions) : null,
      actions ? JSON.stringify(actions) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id]);

    // Buscar automação atualizada
    const updatedAutomation = await executeQueryOne(`
      SELECT
        a.*,
        u.name as created_by_name
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `, [id]);

    return NextResponse.json({
      success: true,
      message: 'Automação atualizada com sucesso',
      automation: updatedAutomation
    });

  } catch (error) {
    logger.error('Erro ao atualizar automação', error);
    return apiError('Erro interno do servidor', 500);
  }
}

// DELETE - Excluir automação
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem excluir automações
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da automação é obrigatório' }, { status: 400 });
    }

    // Verificar se automação existe E PERTENCE AO TENANT
    const automation = await executeQueryOne(`
      SELECT a.* FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ? AND u.organization_id = ?
    `, [parseInt(id), tenantId]);
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada neste tenant' }, { status: 404 });
    }

    // Excluir automação (já validado que pertence ao tenant)
    await executeRun('DELETE FROM automations WHERE id = ?', [parseInt(id)]);

    return NextResponse.json({
      success: true,
      message: 'Automação excluída com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao excluir automação', error);
    return apiError('Erro interno do servidor', 500);
  }
}
