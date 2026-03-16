/**
 * MFA Disable API
 *
 * POST /api/auth/mfa/disable - Disable MFA for the authenticated user
 * Requires current TOTP or backup code for confirmation
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { mfaManager } from '@/lib/auth/mfa-manager';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return apiError('code e obrigatorio para desativar MFA', 400);
    }

    if (code.length > 20) {
      return apiError('code invalido', 400);
    }

    // Verify current code before allowing disable
    const verification = await mfaManager.verifyMFA(auth!.userId, code);
    if (!verification.isValid) {
      return apiError('Codigo MFA invalido. Confirme sua identidade para desativar.', 401);
    }

    const success = await mfaManager.disableMFA(auth!.userId);

    if (!success) {
      return apiError('Erro ao desativar MFA', 500);
    }

    return apiSuccess({ disabled: true });
  } catch (error) {
    return apiError('Erro ao desativar MFA', 500);
  }
}
