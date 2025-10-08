import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

// GET - Listar automações
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

    // Apenas admins podem gerenciar automações
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('is_active');
    const triggerType = searchParams.get('trigger_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filtrar por status ativo
    if (isActive !== null) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Filtrar por tipo de trigger
    if (triggerType) {
      whereClause += ' AND trigger_type = ?';
      params.push(triggerType);
    }

    // Buscar automações
    const automations = db.prepare(`
      SELECT
        a.*,
        u.name as created_by_name,
        u.email as created_by_email
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Contar total
    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM automations a
      ${whereClause}
    `).get(...params) as { total: number };

    // Estatísticas de execução
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_automations,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_automations,
        SUM(execution_count) as total_executions
      FROM automations
    `).get();

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
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar automação
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

    // Apenas admins podem criar automações
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

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

    // Verificar se já existe automação com o mesmo nome
    const existingAutomation = db.prepare(
      'SELECT id FROM automations WHERE name = ?'
    ).get(name);

    if (existingAutomation) {
      return NextResponse.json({
        error: 'Já existe uma automação com este nome'
      }, { status: 409 });
    }

    // Criar automação
    const insertAutomation = db.prepare(`
      INSERT INTO automations (
        name, description, trigger_type, conditions, actions, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertAutomation.run(
      name,
      description || null,
      trigger_type,
      JSON.stringify(conditions),
      JSON.stringify(actions),
      is_active ? 1 : 0,
      user.id
    );

    // Buscar automação criada
    const newAutomation = db.prepare(`
      SELECT
        a.*,
        u.name as created_by_name
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json({
      success: true,
      message: 'Automação criada com sucesso',
      automation: newAutomation
    }, { status: 201 });

  } catch (error) {
    logger.error('Erro ao criar automação', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar automação
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

    // Apenas admins podem atualizar automações
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

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

    // Verificar se automação existe
    const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 });
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
    const updateQuery = db.prepare(`
      UPDATE automations SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        trigger_type = COALESCE(?, trigger_type),
        conditions = COALESCE(?, conditions),
        actions = COALESCE(?, actions),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateQuery.run(
      name || null,
      description || null,
      trigger_type || null,
      conditions ? JSON.stringify(conditions) : null,
      actions ? JSON.stringify(actions) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    // Buscar automação atualizada
    const updatedAutomation = db.prepare(`
      SELECT
        a.*,
        u.name as created_by_name
      FROM automations a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `).get(id);

    return NextResponse.json({
      success: true,
      message: 'Automação atualizada com sucesso',
      automation: updatedAutomation
    });

  } catch (error) {
    logger.error('Erro ao atualizar automação', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir automação
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

    // Apenas admins podem excluir automações
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da automação é obrigatório' }, { status: 400 });
    }

    // Verificar se automação existe
    const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(parseInt(id));
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 });
    }

    // Excluir automação
    db.prepare('DELETE FROM automations WHERE id = ?').run(parseInt(id));

    return NextResponse.json({
      success: true,
      message: 'Automação excluída com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao excluir automação', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}