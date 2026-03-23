import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin } from '@/lib/auth/roles';
import { apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, RunResult } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
// GET - Buscar logs de auditoria
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem acessar logs de auditoria
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    // Feature gate: Security audit access
    const gate = await requireFeature(auth.organizationId, 'security', 'audit');
    if (gate) return gate;

    const tenantId = auth.organizationId;
    let auditColumns: { name?: string }[];
    if (getDatabaseType() === 'sqlite') {
      auditColumns = await executeQuery<{ name?: string }>(`PRAGMA table_info(audit_logs)`);
    } else {
      auditColumns = await executeQuery<{ name?: string }>(
        `SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_name = ?`,
        ['audit_logs']
      );
    }
    const hasResourceType = auditColumns.some((column) => column.name === 'resource_type');
    const hasResourceId = auditColumns.some((column) => column.name === 'resource_id');
    const resourceTypeExpr = hasResourceType ? 'al.resource_type' : 'al.entity_type';
    const resourceIdExpr = hasResourceId ? 'al.resource_id' : 'al.entity_id';

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resource_type') || searchParams.get('entity_type');
    const resourceId = searchParams.get('resource_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200);
    const explicitOffset = searchParams.get('offset');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = explicitOffset ? parseInt(explicitOffset) : Math.max(0, (page - 1) * limit);

    // FILTRAR POR TENANT - apenas logs de usuários do tenant
    let whereClause = 'WHERE COALESCE(u.organization_id, u.tenant_id) = ?';
    const params: (string | number)[] = [tenantId];

    // Filtrar por usuário
    if (userId) {
      whereClause += ' AND al.user_id = ?';
      params.push(parseInt(userId));
    }

    // Filtrar por ação
    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }

    // Filtrar por tipo de recurso
    if (resourceType) {
      whereClause += ` AND (${resourceTypeExpr} = ? OR al.entity_type = ?)`;
      params.push(resourceType);
      params.push(resourceType);
    }

    // Filtrar por ID do recurso
    if (resourceId) {
      whereClause += ` AND ${resourceIdExpr} = ?`;
      params.push(parseInt(resourceId));
    }

    // Filtrar por data de início (validate ISO date format)
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        whereClause += ' AND al.created_at >= ?';
        params.push(parsedStart.toISOString());
      }
    }

    // Filtrar por data de fim (validate ISO date format)
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        whereClause += ' AND al.created_at <= ?';
        params.push(parsedEnd.toISOString());
      }
    }

    // Buscar logs de auditoria FILTRADOS POR TENANT
    const auditLogs = await executeQuery(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Contar total FILTRADO POR TENANT
    const { total } = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
    `, params) || { total: 0 };

    // Estatísticas por ação FILTRADAS POR TENANT
    const actionStats = await executeQuery(`
      SELECT
        al.action,
        COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      GROUP BY al.action
      ORDER BY count DESC
    `, params);

    // Estatísticas por tipo de recurso FILTRADAS POR TENANT
    const resourceStats = await executeQuery(`
      SELECT
        ${resourceTypeExpr} as resource_type,
        COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      GROUP BY ${resourceTypeExpr}
      ORDER BY count DESC
    `, params);

    // Usuários mais ativos FILTRADOS POR TENANT
    const activeUsers = await executeQuery(`
      SELECT
        u.name,
        u.email,
        COUNT(al.id) as action_count
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      ${whereClause}
      GROUP BY u.id, u.name, u.email
      ORDER BY action_count DESC
      LIMIT 10
    `, params);

    return NextResponse.json({
      success: true,
      logs: auditLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total
      },
      stats: {
        actions: actionStats,
        resources: resourceStats,
        active_users: activeUsers
      }
    });

  } catch (error) {
    logger.error('Erro ao buscar logs de auditoria', error);
    return apiError('Erro interno do servidor', 500);
  }
}

// POST - Criar log de auditoria manual
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem criar logs manuais
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    // Feature gate: Security audit access
    const gate = await requireFeature(auth.organizationId, 'security', 'audit');
    if (gate) return gate;

    const body = await request.json();
    const {
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      notes: _notes
    } = body;

    // Validar dados obrigatórios
    if (!action || !resource_type) {
      return NextResponse.json({
        error: 'Ação e tipo de recurso são obrigatórios'
      }, { status: 400 });
    }

    // Capturar IP e User Agent da requisição
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let result: RunResult;
    try {
      result = await executeRun(`
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id,
          old_values, new_values, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [auth.userId,
        action,
        resource_type,
        resource_id || null,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        ip,
        userAgent]);
    } catch {
      result = await executeRun(`
        INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id,
          old_values, new_values, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [auth.userId,
        action,
        resource_type,
        resource_id || null,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        ip,
        userAgent]);
    }

    // Buscar log criado
    const newLog = await executeQueryOne(`
      SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?
    `, [result.lastInsertRowid]);

    return NextResponse.json({
      success: true,
      message: 'Log de auditoria criado com sucesso',
      log: newLog
    }, { status: 201 });

  } catch (error) {
    logger.error('Erro ao criar log de auditoria', error);
    return apiError('Erro interno do servidor', 500);
  }
}

// DELETE - Limpar logs antigos
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins podem limpar logs
    if (!isAdmin(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    // Feature gate: Security audit access
    const gateDelete = await requireFeature(auth.organizationId, 'security', 'audit');
    if (gateDelete) return gateDelete;

    const tenantId = auth.organizationId;

    const { searchParams } = new URL(request.url);
    const daysOld = parseInt(searchParams.get('days_old') || '90');

    // Validar parâmetro
    if (daysOld < 30) {
      return NextResponse.json({
        error: 'Não é possível excluir logs com menos de 30 dias'
      }, { status: 400 });
    }

    // Calcular data de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Contar logs que serão excluídos DO TENANT
    const { count: _count } = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at < ? AND u.organization_id = ?
    `, [cutoffDate.toISOString(), tenantId]) || { count: 0 };

    // Excluir logs antigos APENAS DO TENANT
    const deleteResult = await executeRun(`
      DELETE FROM audit_logs
      WHERE id IN (
        SELECT al.id FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.created_at < ? AND u.organization_id = ?
      )
    `, [cutoffDate.toISOString(), tenantId]);

    // Registrar a limpeza
    await executeRun(`
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id,
        new_values, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [auth.userId,
      'cleanup',
      'audit_logs',
      null,
      JSON.stringify({
        days_old: daysOld,
        deleted_count: deleteResult.changes,
        cutoff_date: cutoffDate.toISOString()
      }),
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown']);

    return NextResponse.json({
      success: true,
      message: `${deleteResult.changes} logs de auditoria foram excluídos`,
      deleted_count: deleteResult.changes,
      cutoff_date: cutoffDate.toISOString()
    });

  } catch (error) {
    logger.error('Erro ao limpar logs de auditoria', error);
    return apiError('Erro interno do servidor', 500);
  }
}
