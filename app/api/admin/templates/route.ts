import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { isAdmin, isPrivileged } from '@/lib/auth/roles';
import { apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// GET - Listar templates
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const tenantId = auth.organizationId;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const categoryId = searchParams.get('category_id');
    const isActive = searchParams.get('is_active');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // FILTRAR POR TENANT - templates criados por usuários do tenant
    let whereClause = 'WHERE u.organization_id = ?';
    const params: any[] = [tenantId];

    // Filtrar por tipo
    if (type) {
      whereClause += ' AND t.type = ?';
      params.push(type);
    }

    // Filtrar por categoria
    if (categoryId) {
      whereClause += ' AND t.category_id = ?';
      params.push(parseInt(categoryId));
    }

    // Filtrar por status ativo
    if (isActive !== null) {
      whereClause += ' AND t.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Buscar templates FILTRADOS POR TENANT
    const templates = await executeQuery(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Contar total FILTRADO POR TENANT
    const { total } = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
    `, params) || { total: 0 };

    return NextResponse.json({
      success: true,
      data: {
        templates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + limit) < total
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching templates', error);
    return apiError('Internal server error', 500);
  }
}

// POST - Criar template
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    // Apenas admins e agentes podem criar templates
    if (!isPrivileged(auth.role)) {
      return apiError('Acesso negado', 403);
    }

    const tenantId = auth.organizationId;

    const body = await request.json();
    const {
      name,
      description,
      type,
      category_id,
      title_template,
      content_template,
      variables,
      is_active = true,
      tags = []
    } = body;

    // Validar dados obrigatórios
    if (!name || !type || !content_template) {
      return NextResponse.json({
        error: 'Nome, tipo e conteúdo são obrigatórios'
      }, { status: 400 });
    }

    // Validar tipo
    const validTypes = ['ticket', 'comment', 'email', 'knowledge', 'response'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        error: 'Tipo de template inválido'
      }, { status: 400 });
    }

    // Verificar se categoria existe E PERTENCE AO TENANT (se fornecida)
    if (category_id) {
      const category = await executeQueryOne('SELECT id FROM categories WHERE id = ? AND tenant_id = ?', [category_id, tenantId]);
      if (!category) {
        return NextResponse.json({
          error: 'Categoria não encontrada neste tenant'
        }, { status: 404 });
      }
    }

    // Verificar se já existe template com o mesmo nome NO TENANT
    const existingTemplate = await executeQueryOne(`
      SELECT t.id FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.name = ? AND t.type = ? AND u.organization_id = ?
    `, [name, type, tenantId]);

    if (existingTemplate) {
      return NextResponse.json({
        error: 'Já existe um template com este nome para este tipo neste tenant'
      }, { status: 409 });
    }

    // Criar template
    const result = await executeRun(`
      INSERT INTO templates (
        name, description, type, category_id, title_template,
        content_template, variables, is_active, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name,
      description || null,
      type,
      category_id || null,
      title_template || null,
      content_template,
      variables ? JSON.stringify(variables) : null,
      is_active ? 1 : 0,
      tags.length > 0 ? JSON.stringify(tags) : null,
      auth.userId]);

    // Buscar template criado
    const newTemplate = await executeQueryOne(`
      SELECT
        t.*,
        c.name as category_name,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [result.lastInsertRowid]);

    return NextResponse.json({
      success: true,
      data: newTemplate,
      message: 'Template created successfully'
    }, { status: 201 });

  } catch (error) {
    logger.error('Error creating template', error);
    return apiError('Internal server error', 500);
  }
}

// PUT - Atualizar template
export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const tenantId = auth.organizationId;

    const body = await request.json();
    const {
      id,
      name,
      description,
      category_id,
      title_template,
      content_template,
      variables,
      is_active,
      tags
    } = body;

    // Validar ID
    if (!id) {
      return NextResponse.json({ error: 'ID do template é obrigatório' }, { status: 400 });
    }

    // Verificar se template existe E PERTENCE AO TENANT
    const template = await executeQueryOne(`
      SELECT t.* FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ? AND u.organization_id = ?
    `, [id, tenantId]);
    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado neste tenant' }, { status: 404 });
    }

    // Verificar permissão
    if (!isPrivileged(auth.role) && (template as any).created_by !== auth.userId) {
      return apiError('Acesso negado', 403);
    }

    // Atualizar template
    await executeRun(`
      UPDATE templates SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category_id = COALESCE(?, category_id),
        title_template = COALESCE(?, title_template),
        content_template = COALESCE(?, content_template),
        variables = COALESCE(?, variables),
        is_active = COALESCE(?, is_active),
        tags = COALESCE(?, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name || null,
      description || null,
      category_id || null,
      title_template || null,
      content_template || null,
      variables ? JSON.stringify(variables) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      tags ? JSON.stringify(tags) : null,
      id]);

    // Buscar template atualizado
    const updatedTemplate = await executeQueryOne(`
      SELECT
        t.*,
        c.name as category_name,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id]);

    return NextResponse.json({
      success: true,
      data: updatedTemplate,
      message: 'Template updated successfully'
    });

  } catch (error) {
    logger.error('Error updating template', error);
    return apiError('Internal server error', 500);
  }
}

// DELETE - Excluir template
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const tenantId = auth.organizationId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do template é obrigatório' }, { status: 400 });
    }

    // Verificar se template existe E PERTENCE AO TENANT
    const template = await executeQueryOne(`
      SELECT t.* FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ? AND u.organization_id = ?
    `, [parseInt(id), tenantId]);
    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado neste tenant' }, { status: 404 });
    }

    // Verificar permissão
    if (!isAdmin(auth.role) && (template as any).created_by !== auth.userId) {
      return apiError('Acesso negado', 403);
    }

    // Verificar se template está sendo usado NO TENANT
    const usageCount = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE template_id = ? AND tenant_id = ?
    `, [parseInt(id), tenantId]) || { count: 0 };

    if (usageCount.count > 0) {
      return NextResponse.json({
        error: `Template cannot be deleted because it is being used in ${usageCount.count} ticket(s)`,
        code: 'TEMPLATE_IN_USE'
      }, { status: 409 });
    }

    // Excluir template (já validado que pertence ao tenant)
    await executeRun('DELETE FROM templates WHERE id = ?', [parseInt(id)]);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting template', error);
    return apiError('Internal server error', 500);
  }
}
