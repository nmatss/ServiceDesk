import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/auth-service';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { executeQuery, executeQueryOne, executeRun, RunResult } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// GET - Buscar logs de auditoria
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Contexto de tenant não encontrado' }, { status: 400 });
    }

    // Apenas admins podem acessar logs de auditoria
    if (user.role !== 'admin' && user.role !== 'tenant_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
    }

    const tenantId = tenantContext.id;
    const auditColumns = await executeQuery<{ name?: string }>(`PRAGMA table_info(audit_logs)`);
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const explicitOffset = searchParams.get('offset');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = explicitOffset ? parseInt(explicitOffset) : Math.max(0, (page - 1) * limit);

    // FILTRAR POR TENANT - apenas logs de usuários do tenant
    let whereClause = 'WHERE COALESCE(u.organization_id, u.tenant_id) = ?';
    const params: any[] = [tenantId];

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

    // Filtrar por data de início
    if (startDate) {
      whereClause += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    // Filtrar por data de fim
    if (endDate) {
      whereClause += ' AND al.created_at <= ?';
      params.push(endDate);
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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar log de auditoria manual
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Contexto de tenant não encontrado' }, { status: 400 });
    }

    // Apenas admins podem criar logs manuais
    if (user.role !== 'admin' && user.role !== 'tenant_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
    }

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
      `, [user.id,
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
      `, [user.id,
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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Limpar logs antigos
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Contexto de tenant não encontrado' }, { status: 400 });
    }

    // Apenas admins podem limpar logs
    if (user.role !== 'admin' && user.role !== 'tenant_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Acesso negado a este tenant' }, { status: 403 });
    }

    const tenantId = tenantContext.id;

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
    `, [user.id,
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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
