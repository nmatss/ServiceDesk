import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';
import { createAuditLog } from '@/lib/audit/logger';
import { logger } from '@/lib/monitoring/logger';

const paramSchema = z.object({
  id: z.coerce.number().int().min(1)
});

const revokeSchema = z.object({
  reason: z.string().max(500).optional()
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  const { id } = await params;
  const parsedParams = paramSchema.safeParse({ id });
  if (!parsedParams.success) {
    return NextResponse.json(
      { success: false, error: 'ID inválido' },
      { status: 400 }
    );
  }

  let payload: z.infer<typeof revokeSchema> = {};
  try {
    payload = revokeSchema.parse(await request.json());
  } catch {
    payload = {};
  }

  try {
    const consent = await executeQueryOne<{ id: number; user_id: number; is_given: number }>(
      'SELECT id, user_id, is_given FROM lgpd_consents WHERE id = ?',
      [parsedParams.data.id]
    );

    if (!consent || consent.user_id !== guard.auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Consentimento não encontrado' },
        { status: 404 }
      );
    }

    if (consent.is_given === 0) {
      return NextResponse.json({ success: true, alreadyRevoked: true });
    }

    const ipAddress = getTrustedClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await executeRun(
      `
        UPDATE lgpd_consents
        SET
          is_given = 0,
          withdrawn_at = CURRENT_TIMESTAMP,
          withdrawal_reason = ?
        WHERE id = ? AND user_id = ?
      `,
      [payload.reason || 'User request', parsedParams.data.id, guard.auth.userId]
    );

    createAuditLog({
      user_id: guard.auth.userId,
      action: 'lgpd_consent_withdrawn',
      resource_type: 'lgpd_consent',
      resource_id: parsedParams.data.id,
      new_values: JSON.stringify({ reason: payload.reason || 'User request' }),
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to revoke LGPD consent', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao revogar consentimento' },
      { status: 500 }
    );
  }
}
