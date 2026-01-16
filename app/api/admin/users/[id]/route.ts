import { NextRequest, NextResponse } from 'next/server';
import { userQueries } from '@/lib/db/queries';
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_USER);
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

    // Apenas admins podem acessar
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID do usuário inválido' }, { status: 400 });
    }

    const targetUser = userQueries.getById(userId, user.organization_id || 1);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user: targetUser });
  } catch (error) {
    logger.error('Erro ao buscar usuário', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_USER);
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

    // Apenas admins podem editar usuários
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID do usuário inválido' }, { status: 400 });
    }

    const targetUser = userQueries.getById(userId, user.organization_id || 1);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, role } = body;

    // Validar dados
    if (name && name.trim().length === 0) {
      return NextResponse.json({ error: 'Nome não pode estar vazio' }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    if (role && !['admin', 'agent', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 });
    }

    // Verificar se email já existe (se estiver sendo alterado)
    if (email && email !== targetUser.email) {
      const existingUser = userQueries.getByEmail(email, user.organization_id || 1);
      if (existingUser) {
        return NextResponse.json({ error: 'Email já está em uso' }, { status: 400 });
      }
    }

    const updatedUser = userQueries.update({
      id: userId,
      name: name?.trim(),
      email: email?.trim(),
      role
    }, user.organization_id || 1);

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    logger.error('Erro ao atualizar usuário', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_USER);
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

    // Apenas admins podem deletar usuários
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID do usuário inválido' }, { status: 400 });
    }

    // Não permitir deletar a si mesmo
    if (userId === user.id) {
      return NextResponse.json({ error: 'Não é possível deletar seu próprio usuário' }, { status: 400 });
    }

    const targetUser = userQueries.getById(userId, user.organization_id || 1);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const success = userQueries.delete(userId, user.organization_id || 1);
    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar usuário' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar usuário', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
