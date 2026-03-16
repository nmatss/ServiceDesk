/**
 * MFA Verify API
 *
 * POST /api/auth/mfa/verify - Verify a TOTP token, backup code, SMS, or email code
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
    const { code, method } = body;

    if (!code || typeof code !== 'string') {
      return apiError('code e obrigatorio', 400);
    }

    if (code.length > 20) {
      return apiError('code invalido', 400);
    }

    if (method && !['totp', 'backup_code', 'sms', 'email'].includes(method)) {
      return apiError('method invalido. Use: totp, backup_code, sms ou email', 400);
    }

    const result = await mfaManager.verifyMFA(auth!.userId, code, method);

    if (!result.isValid) {
      return apiError('Codigo MFA invalido', 401);
    }

    return apiSuccess({
      verified: true,
      method: result.method,
      ...(result.remaining_backup_codes !== undefined && {
        remaining_backup_codes: result.remaining_backup_codes,
      }),
    });
  } catch (error) {
    return apiError('Erro ao verificar MFA', 500);
  }
}
