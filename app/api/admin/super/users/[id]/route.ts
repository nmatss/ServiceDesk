import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';

/**
 * GET /api/admin/super/users/[id]
 * Detalhes do usuário com info da organização e atividade recente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return apiError('ID de usuário inválido', 400);
    }

    const user = await executeQueryOne<{
      id: number;
      name: string;
      email: string;
      role: string;
      is_active: number;
      organization_id: number;
      organization_name: string;
      organization_slug: string;
      subscription_plan: string;
      last_login_at: string | null;
      created_at: string;
      updated_at: string;
      is_email_verified: number;
      two_factor_enabled: number;
      timezone: string;
      language: string;
    }>(
      `SELECT
        u.id, u.name, u.email, u.role, u.is_active,
        u.organization_id,
        o.name as organization_name,
        o.slug as organization_slug,
        o.subscription_plan,
        u.last_login_at, u.created_at, u.updated_at,
        u.is_email_verified, u.two_factor_enabled,
        u.timezone, u.language
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      return apiError('Usuário não encontrado', 404);
    }

    const recentActivity = await executeQuery<{
      id: number;
      entity_type: string;
      action: string;
      created_at: string;
    }>(
      `SELECT id, entity_type, action, created_at
       FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    return apiSuccess({
      ...user,
      recent_activity: recentActivity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao buscar usuário: ${message}`, 500);
  }
}

const actionSchema = z.object({
  action: z.enum(['reset_password', 'change_role', 'deactivate', 'activate']),
  new_role: z.string().optional(),
});

/**
 * PUT /api/admin/super/users/[id]
 * Ações administrativas: reset senha, alterar role, ativar/desativar
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return apiError('ID de usuário inválido', 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Corpo da requisição inválido (JSON malformado)', 400);
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join('; ');
      return apiError(`Dados inválidos: ${errors}`, 400);
    }

    const { action, new_role } = parsed.data;

    const user = await executeQueryOne<{ id: number; role: string; is_active: number }>(
      'SELECT id, role, is_active FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return apiError('Usuário não encontrado', 404);
    }

    const now = sqlNow();

    switch (action) {
      case 'reset_password': {
        const tempPassword = crypto.randomBytes(12).toString('base64url');
        const hash = await bcrypt.hash(tempPassword, 12);
        await executeRun(
          `UPDATE users SET password_hash = ?, password_changed_at = ${now}, updated_at = ${now} WHERE id = ?`,
          [hash, userId]
        );
        await executeRun(
          `INSERT INTO audit_logs (user_id, organization_id, entity_type, entity_id, action, new_values, created_at)
           VALUES (?, ?, 'user', ?, 'password_reset', '{"by":"super_admin"}', ${now})`,
          [guard.auth.userId, guard.auth.organizationId, userId]
        );
        return apiSuccess({ message: 'Senha redefinida com sucesso', temp_password: tempPassword });
      }

      case 'change_role': {
        const validRoles = ['admin', 'agent', 'user', 'manager', 'read_only', 'api_client'];
        if (!new_role || !validRoles.includes(new_role)) {
          return apiError(`Role inválida. Valores permitidos: ${validRoles.join(', ')}`, 400);
        }
        const oldRole = user.role;
        await executeRun(
          `UPDATE users SET role = ?, updated_at = ${now} WHERE id = ?`,
          [new_role, userId]
        );
        await executeRun(
          `INSERT INTO audit_logs (user_id, organization_id, entity_type, entity_id, action, old_values, new_values, created_at)
           VALUES (?, ?, 'user', ?, 'role_change', ?, ?, ${now})`,
          [
            guard.auth.userId,
            guard.auth.organizationId,
            userId,
            JSON.stringify({ role: oldRole }),
            JSON.stringify({ role: new_role }),
          ]
        );
        return apiSuccess({ message: `Role alterada de ${oldRole} para ${new_role}` });
      }

      case 'deactivate': {
        await executeRun(
          `UPDATE users SET is_active = 0, updated_at = ${now} WHERE id = ?`,
          [userId]
        );
        await executeRun(
          `INSERT INTO audit_logs (user_id, organization_id, entity_type, entity_id, action, new_values, created_at)
           VALUES (?, ?, 'user', ?, 'deactivate', '{"is_active":false}', ${now})`,
          [guard.auth.userId, guard.auth.organizationId, userId]
        );
        return apiSuccess({ message: 'Usuário desativado com sucesso' });
      }

      case 'activate': {
        await executeRun(
          `UPDATE users SET is_active = 1, updated_at = ${now} WHERE id = ?`,
          [userId]
        );
        await executeRun(
          `INSERT INTO audit_logs (user_id, organization_id, entity_type, entity_id, action, new_values, created_at)
           VALUES (?, ?, 'user', ?, 'activate', '{"is_active":true}', ${now})`,
          [guard.auth.userId, guard.auth.organizationId, userId]
        );
        return apiSuccess({ message: 'Usuário ativado com sucesso' });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao executar ação: ${message}`, 500);
  }
}
