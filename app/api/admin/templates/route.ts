import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromCookies } from '@/lib/auth/sqlite-auth';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// GET - Listar templates
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const user = await verifyTokenFromCookies(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' }, { status: 400 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' }, { status: 403 });
    }

    const tenantId = tenantContext.id;

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
    const templates = db.prepare(`
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
    `).all(...params, limit, offset);

    // Contar total FILTRADO POR TENANT
    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
    `).get(...params) as { total: number };

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
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST - Criar template
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const user = await verifyTokenFromCookies(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    // Apenas admins e agentes podem criar templates
    if (!['admin', 'agent', 'tenant_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied', code: 'PERMISSION_DENIED' }, { status: 403 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' }, { status: 400 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' }, { status: 403 });
    }

    const tenantId = tenantContext.id;

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
      const category = db.prepare('SELECT id FROM categories WHERE id = ? AND tenant_id = ?').get(category_id, tenantId);
      if (!category) {
        return NextResponse.json({
          error: 'Categoria não encontrada neste tenant'
        }, { status: 404 });
      }
    }

    // Verificar se já existe template com o mesmo nome NO TENANT
    const existingTemplate = db.prepare(`
      SELECT t.id FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.name = ? AND t.type = ? AND u.organization_id = ?
    `).get(name, type, tenantId);

    if (existingTemplate) {
      return NextResponse.json({
        error: 'Já existe um template com este nome para este tipo neste tenant'
      }, { status: 409 });
    }

    // Criar template
    const insertTemplate = db.prepare(`
      INSERT INTO templates (
        name, description, type, category_id, title_template,
        content_template, variables, is_active, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertTemplate.run(
      name,
      description || null,
      type,
      category_id || null,
      title_template || null,
      content_template,
      variables ? JSON.stringify(variables) : null,
      is_active ? 1 : 0,
      tags.length > 0 ? JSON.stringify(tags) : null,
      user.id
    );

    // Buscar template criado
    const newTemplate = db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json({
      success: true,
      data: newTemplate,
      message: 'Template created successfully'
    }, { status: 201 });

  } catch (error) {
    logger.error('Error creating template', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PUT - Atualizar template
export async function PUT(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const user = await verifyTokenFromCookies(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' }, { status: 400 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' }, { status: 403 });
    }

    const tenantId = tenantContext.id;

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
    const template = db.prepare(`
      SELECT t.* FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ? AND u.organization_id = ?
    `).get(id, tenantId);
    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado neste tenant' }, { status: 404 });
    }

    // Verificar permissão
    if (!['admin', 'agent', 'tenant_admin'].includes(user.role) && (template as any).created_by !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Atualizar template
    const updateQuery = db.prepare(`
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
    `);

    updateQuery.run(
      name || null,
      description || null,
      category_id || null,
      title_template || null,
      content_template || null,
      variables ? JSON.stringify(variables) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      tags ? JSON.stringify(tags) : null,
      id
    );

    // Buscar template atualizado
    const updatedTemplate = db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(id);

    return NextResponse.json({
      success: true,
      data: updatedTemplate,
      message: 'Template updated successfully'
    });

  } catch (error) {
    logger.error('Error updating template', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// DELETE - Excluir template
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verificar autenticação
    const user = await verifyTokenFromCookies(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    // Verificar tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' }, { status: 400 });
    }

    // Verificar se usuário pertence ao tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json({ error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' }, { status: 403 });
    }

    const tenantId = tenantContext.id;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do template é obrigatório' }, { status: 400 });
    }

    // Verificar se template existe E PERTENCE AO TENANT
    const template = db.prepare(`
      SELECT t.* FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ? AND u.organization_id = ?
    `).get(parseInt(id), tenantId);
    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado neste tenant' }, { status: 404 });
    }

    // Verificar permissão
    if (user.role !== 'admin' && user.role !== 'tenant_admin' && (template as any).created_by !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se template está sendo usado NO TENANT
    // FIX: Use template ID instead of name for lookup
    const usageCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE template_id = ? AND tenant_id = ?
    `).get(parseInt(id), tenantId) as { count: number };

    if (usageCount.count > 0) {
      return NextResponse.json({
        error: `Template cannot be deleted because it is being used in ${usageCount.count} ticket(s)`,
        code: 'TEMPLATE_IN_USE'
      }, { status: 409 });
    }

    // Excluir template (já validado que pertence ao tenant)
    db.prepare('DELETE FROM templates WHERE id = ?').run(parseInt(id));

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting template', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}