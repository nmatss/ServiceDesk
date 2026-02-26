import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/auth-service';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

async function writeUserAuditLog(params: {
  actorUserId: number;
  organizationId: number;
  targetUserId: number;
  action: 'update' | 'deactivate';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}) {
  const oldValues = params.oldValues ? JSON.stringify(params.oldValues) : null;
  const newValues = params.newValues ? JSON.stringify(params.newValues) : null;

  try {
    await executeRun(`
      INSERT INTO audit_logs (
        organization_id, tenant_id, user_id, entity_type, entity_id, action, old_values, new_values, ip_address, user_agent
      ) VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, ?)
    `, [params.organizationId,
      params.organizationId,
      params.actorUserId,
      params.targetUserId,
      params.action,
      oldValues,
      newValues,
      params.ipAddress,
      params.userAgent]);
    return;
  } catch {
    // Fallback for schemas without organization_id on audit logs.
  }

  await executeRun(`
    INSERT INTO audit_logs (
      tenant_id, user_id, entity_type, entity_id, action, old_values, new_values, ip_address, user_agent
    ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?)
  `, [params.organizationId,
    params.actorUserId,
    params.targetUserId,
    params.action,
    oldValues,
    newValues,
    params.ipAddress,
    params.userAgent]);
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active?: number;
  organization_id?: number;
  tenant_id?: number;
}

async function getUserById(userId: number, organizationId: number): Promise<UserRow | undefined> {
  try {
    return await executeQueryOne<UserRow>(
      'SELECT * FROM users WHERE id = ? AND organization_id = ?',
      [userId, organizationId]
    );
  } catch {
    return await executeQueryOne<UserRow>(
      'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
      [userId, organizationId]
    );
  }
}

async function getUserByEmail(email: string, organizationId: number): Promise<UserRow | undefined> {
  try {
    return await executeQueryOne<UserRow>(
      'SELECT * FROM users WHERE email = ? AND organization_id = ?',
      [email, organizationId]
    );
  } catch {
    return await executeQueryOne<UserRow>(
      'SELECT * FROM users WHERE email = ? AND tenant_id = ?',
      [email, organizationId]
    );
  }
}

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
    const adminRoles = ['admin', 'super_admin', 'tenant_admin'];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // SECURITY: Fail if organization_id is missing - prevent cross-tenant access
    if (!user.organization_id) {
      return NextResponse.json({ error: 'Organization ID não encontrado no token' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID do usuário inválido' }, { status: 400 });
    }

    const targetUser = await getUserById(userId, user.organization_id);
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
    const adminRoles = ['admin', 'super_admin', 'tenant_admin'];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID do usuário inválido' }, { status: 400 });
    }

    const targetUser = await getUserById(userId, user.organization_id);
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
      const existingUser = await getUserByEmail(email, user.organization_id);
      if (existingUser) {
        return NextResponse.json({ error: 'Email já está em uso' }, { status: 400 });
      }
    }

    // Build dynamic update query
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name.trim());
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email.trim());
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId, user.organization_id);

      try {
        await executeRun(
          `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
          values
        );
      } catch {
        await executeRun(
          `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
          values
        );
      }
    }

    const updatedUser = await getUserById(userId, user.organization_id);

    await writeUserAuditLog({
      actorUserId: user.id,
      organizationId: user.organization_id,
      targetUserId: userId,
      action: 'update',
      oldValues: {
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      newValues: {
        name: updatedUser?.name,
        email: updatedUser?.email,
        role: updatedUser?.role,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ success: true, user: updatedUser });
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
    const deleteAdminRoles = ['admin', 'super_admin', 'tenant_admin'];
    if (!deleteAdminRoles.includes(user.role)) {
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

    const targetUser = await getUserById(userId, user.organization_id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Soft-delete for auditability and to avoid orphaned relations.
    let success = false;
    try {
      success = (await executeRun(`
        UPDATE users
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `, [userId, user.organization_id])).changes > 0;
    } catch {
      success = (await executeRun(`
        UPDATE users
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `, [userId, user.organization_id])).changes > 0;
    }
    if (!success) {
      return NextResponse.json({ error: 'Erro ao deletar usuário' }, { status: 500 });
    }

    await writeUserAuditLog({
      actorUserId: user.id,
      organizationId: user.organization_id,
      targetUserId: userId,
      action: 'deactivate',
      oldValues: { is_active: targetUser.is_active ?? 1 },
      newValues: { is_active: 0 },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ success: true, message: 'Usuário desativado com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar usuário', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
