import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import db from '@/lib/db/connection';

// GET - Listar templates
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const categoryId = searchParams.get('category_id');
    const isActive = searchParams.get('is_active');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filtrar por tipo
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    // Filtrar por categoria
    if (categoryId) {
      whereClause += ' AND category_id = ?';
      params.push(parseInt(categoryId));
    }

    // Filtrar por status ativo
    if (isActive !== null) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Buscar templates
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

    // Contar total
    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM templates t
      ${whereClause}
    `).get(...params) as { total: number };

    return NextResponse.json({
      success: true,
      templates,
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total
      }
    });

  } catch (error) {
    console.error('Erro ao buscar templates:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar template
export async function POST(request: NextRequest) {
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

    // Apenas admins e agentes podem criar templates
    if (!['admin', 'agent'].includes(user.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

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

    // Verificar se categoria existe (se fornecida)
    if (category_id) {
      const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
      if (!category) {
        return NextResponse.json({
          error: 'Categoria não encontrada'
        }, { status: 404 });
      }
    }

    // Verificar se já existe template com o mesmo nome
    const existingTemplate = db.prepare(
      'SELECT id FROM templates WHERE name = ? AND type = ?'
    ).get(name, type);

    if (existingTemplate) {
      return NextResponse.json({
        error: 'Já existe um template com este nome para este tipo'
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
      message: 'Template criado com sucesso',
      template: newTemplate
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar template:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar template
export async function PUT(request: NextRequest) {
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

    // Verificar se template existe
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    // Verificar permissão
    if (!['admin', 'agent'].includes(user.role) && (template as any).created_by !== user.id) {
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
      message: 'Template atualizado com sucesso',
      template: updatedTemplate
    });

  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir template
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do template é obrigatório' }, { status: 400 });
    }

    // Verificar se template existe
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(parseInt(id));
    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    // Verificar permissão
    if (user.role !== 'admin' && (template as any).created_by !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se template está sendo usado
    const usageCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE template_used = ?
    `).get((template as any).name) as { count: number };

    if (usageCount.count > 0) {
      return NextResponse.json({
        error: `Template não pode ser excluído pois está sendo usado em ${usageCount.count} ticket(s)`
      }, { status: 409 });
    }

    // Excluir template
    db.prepare('DELETE FROM templates WHERE id = ?').run(parseInt(id));

    return NextResponse.json({
      success: true,
      message: 'Template excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir template:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}