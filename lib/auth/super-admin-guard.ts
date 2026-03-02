/**
 * Super Admin Guard
 *
 * Verifica se o usuário autenticado pertence à organização master (id=1)
 * ou possui role 'super_admin'. Usado em todas as rotas /api/admin/super/*.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireTenantUserContext,
  type AuthGuardContext,
  type TenantUserRequestContext,
} from '@/lib/tenant/request-guard';
import { ROLES } from '@/lib/auth/roles';

type SuperAdminGuardSuccess = {
  context: TenantUserRequestContext;
  auth: AuthGuardContext;
  response?: undefined;
};

type SuperAdminGuardFailure = {
  context?: undefined;
  auth?: undefined;
  response: NextResponse;
};

export type SuperAdminGuardResult = SuperAdminGuardSuccess | SuperAdminGuardFailure;

/**
 * Requires the caller to be a Super Admin.
 *
 * A user is considered a super admin if:
 * - They belong to organization 1 (master org), OR
 * - Their role is 'super_admin'
 *
 * All /api/admin/super/* routes MUST call this guard.
 */
export function requireSuperAdmin(request: NextRequest): SuperAdminGuardResult {
  const guard = requireTenantUserContext(request);

  if (guard.response) {
    return guard;
  }

  const { auth, context } = guard;

  const isSuperAdmin =
    auth.organizationId === 1 || auth.role === ROLES.SUPER_ADMIN;

  if (!isSuperAdmin) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Acesso restrito ao Super Admin' },
        { status: 403 }
      ),
    };
  }

  return { context, auth };
}
