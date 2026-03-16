/**
 * MFA Setup API
 *
 * GET  /api/auth/mfa/setup - Generate TOTP secret and QR code for the user
 * POST /api/auth/mfa/setup - Verify TOTP token and enable MFA for the user
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { mfaManager } from '@/lib/auth/mfa-manager';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const setup = await mfaManager.generateTOTPSetup(auth!.userId);

    if (!setup) {
      return apiError('Erro ao gerar configuracao MFA', 500);
    }

    return apiSuccess({
      secret: setup.secret,
      qrCodeUrl: setup.qrCodeUrl,
      backupCodes: setup.backupCodes,
      manualEntryKey: setup.manualEntryKey,
    });
  } catch (error) {
    return apiError('Erro ao gerar configuracao MFA', 500);
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { auth } = guard;

    const body = await request.json();
    const { secret, token, backupCodes } = body;

    if (!secret || typeof secret !== 'string') {
      return apiError('secret e obrigatorio', 400);
    }

    if (!token || typeof token !== 'string') {
      return apiError('token e obrigatorio', 400);
    }

    if (!Array.isArray(backupCodes) || backupCodes.length === 0) {
      return apiError('backupCodes e obrigatorio', 400);
    }

    const success = await mfaManager.enableTOTP(
      auth!.userId,
      secret,
      token,
      backupCodes
    );

    if (!success) {
      return apiError('Token TOTP invalido. Verifique o codigo e tente novamente.', 400);
    }

    return apiSuccess({ enabled: true });
  } catch (error) {
    return apiError('Erro ao ativar MFA', 500);
  }
}
