import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
interface Context {
  params: Promise<{
    id: string;
  }>;
}

// GET - Buscar política específica
export async function GET(request: NextRequest, { params }: Context) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const policy = db.prepare(`
      SELECT sp.*, p.name as priority_name, c.name as category_name
      FROM sla_policies sp
      LEFT JOIN priorities p ON sp.priority_id = p.id
      LEFT JOIN categories c ON sp.category_id = c.id
      WHERE sp.id = ?
    `).get((await params).id);

    if (!policy) {
      return NextResponse.json({ error: 'Política não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      policy
    });
  } catch (error) {
    logger.error('Error getting SLA policy', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar política
export async function PUT(request: NextRequest, { params }: Context) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      priority_id,
      category_id,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes,
      business_hours_only,
      is_active
    } = body;

    const updateQuery = db.prepare(`
      UPDATE sla_policies
      SET
        name = ?,
        description = ?,
        priority_id = ?,
        category_id = ?,
        response_time_minutes = ?,
        resolution_time_minutes = ?,
        escalation_time_minutes = ?,
        business_hours_only = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = updateQuery.run(
      name,
      description || null,
      priority_id,
      category_id || null,
      response_time_minutes,
      resolution_time_minutes,
      escalation_time_minutes || null,
      business_hours_only ? 1 : 0,
      is_active ? 1 : 0,
      (await params).id
    );

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Política não encontrada' }, { status: 404 });
    }

    const updatedPolicy = db.prepare(`
      SELECT sp.*, p.name as priority_name, c.name as category_name
      FROM sla_policies sp
      LEFT JOIN priorities p ON sp.priority_id = p.id
      LEFT JOIN categories c ON sp.category_id = c.id
      WHERE sp.id = ?
    `).get((await params).id);

    return NextResponse.json({
      success: true,
      policy: updatedPolicy
    });
  } catch (error) {
    logger.error('Error updating SLA policy', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Deletar política
export async function DELETE(request: NextRequest, { params }: Context) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verifica se há tickets usando esta política
    const ticketsUsingPolicy = db.prepare(`
      SELECT COUNT(*) as count
      FROM sla_tracking
      WHERE sla_policy_id = ?
    `).get((await params).id) as { count: number };

    if (ticketsUsingPolicy.count > 0) {
      return NextResponse.json({
        error: 'Não é possível deletar política que está sendo usada por tickets'
      }, { status: 400 });
    }

    const deleteQuery = db.prepare('DELETE FROM sla_policies WHERE id = ?');
    const result = deleteQuery.run((await params).id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Política não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Política deletada com sucesso'
    });
  } catch (error) {
    logger.error('Error deleting SLA policy', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}