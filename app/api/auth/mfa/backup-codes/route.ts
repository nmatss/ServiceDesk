/**
 * MFA Backup Codes API
 *
 * POST /api/auth/mfa/backup-codes - Regenerate backup codes
 * Requires current TOTP code for confirmation
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
      return apiError('code TOTP e obrigatorio para regenerar codigos de backup', 400);
    }

    if (code.length > 20) {
      return apiError('code invalido', 400);
    }

    // Verify current TOTP before regenerating backup codes
    const verification = await mfaManager.verifyTOTP(auth!.userId, code);
    if (!verification.isValid) {
      return apiError('Codigo TOTP invalido. Confirme sua identidade.', 401);
    }

    const backupCodes = await mfaManager.generateNewBackupCodes(auth!.userId);

    if (!backupCodes) {
      return apiError('Erro ao gerar novos codigos de backup. MFA deve estar ativado.', 400);
    }

    return apiSuccess({ backupCodes });
  } catch (error) {
    return apiError('Erro ao gerar codigos de backup', 500);
  }
}
