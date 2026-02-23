import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQuery, executeRun } from '@/lib/db/adapter';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';
import { createAuditLog } from '@/lib/audit/logger';
import { logger } from '@/lib/monitoring/logger';

const consentSchema = z.object({
  consent_type: z.enum([
    'data_processing',
    'marketing',
    'analytics',
    'cookies',
    'sharing_third_parties',
    'profiling',
    'automated_decisions'
  ]),
  purpose: z.string().min(3).max(500),
  legal_basis: z.enum([
    'consent',
    'contract',
    'legal_obligation',
    'vital_interests',
    'public_task',
    'legitimate_interests'
  ]),
  is_given: z.boolean(),
  consent_method: z.enum(['web', 'api', 'email', 'phone', 'in_person']).optional(),
  expires_at: z.string().datetime().optional(),
  evidence: z.record(z.string(), z.unknown()).optional()
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  try {
    const consents = await executeQuery(
      `
        SELECT
          id,
          consent_type,
          purpose,
          legal_basis,
          is_given,
          consent_method,
          consent_evidence,
          ip_address,
          user_agent,
          expires_at,
          withdrawn_at,
          withdrawal_reason,
          created_at
        FROM lgpd_consents
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [guard.auth.userId]
    );

    return NextResponse.json({ success: true, consents });
  } catch (error) {
    logger.error('Failed to list LGPD consents', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar consentimentos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  let payload: z.infer<typeof consentSchema>;
  try {
    payload = consentSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Payload inválido' },
      { status: 400 }
    );
  }

  try {
    const ipAddress = getTrustedClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const evidence = {
      timestamp: new Date().toISOString(),
      method: payload.consent_method || 'api',
      ...payload.evidence,
      ipAddress,
      userAgent
    };

    const expiresAt = payload.expires_at ? new Date(payload.expires_at).toISOString() : null;

    await executeRun(
      `
        INSERT INTO lgpd_consents (
          user_id,
          consent_type,
          purpose,
          legal_basis,
          is_given,
          consent_method,
          consent_evidence,
          ip_address,
          user_agent,
          expires_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        guard.auth.userId,
        payload.consent_type,
        payload.purpose,
        payload.legal_basis,
        payload.is_given ? 1 : 0,
        payload.consent_method || 'api',
        JSON.stringify(evidence),
        ipAddress,
        userAgent,
        expiresAt
      ]
    );

    createAuditLog({
      user_id: guard.auth.userId,
      action: payload.is_given ? 'lgpd_consent_given' : 'lgpd_consent_withdrawn',
      resource_type: 'lgpd_consent',
      resource_id: undefined,
      new_values: JSON.stringify({
        consent_type: payload.consent_type,
        purpose: payload.purpose,
        legal_basis: payload.legal_basis,
        is_given: payload.is_given
      }),
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to record LGPD consent', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar consentimento' },
      { status: 500 }
    );
  }
}
