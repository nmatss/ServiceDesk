import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';
import { createAuditLog } from '@/lib/audit/logger';
import { logger } from '@/lib/monitoring/logger';

const erasureSchema = z.object({
  reason: z.enum([
    'consent_withdrawn',
    'purpose_fulfilled',
    'unlawful_processing',
    'retention_expired',
    'objection'
  ]),
  data_types: z.array(z.string().min(1)).optional(),
  confirm: z.literal(true)
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  let payload: z.infer<typeof erasureSchema>;
  try {
    payload = erasureSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Confirmação obrigatória e payload inválido' },
      { status: 400 }
    );
  }

  const dataTypes = payload.data_types?.length ? payload.data_types : ['profile', 'comments', 'consents'];
  const ipAddress = getTrustedClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const user = await executeQueryOne<{ id: number; email: string; name: string }>(
      `
        SELECT id, email, name
        FROM users
        WHERE id = ? AND tenant_id = ?
      `,
      [guard.auth.userId, guard.auth.organizationId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const hashInput = `${user.id}:${user.email}:${user.name}`;
    const dataHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    const erasureId = await executeTransaction(async (db) => {
      await db.run(
        `
          INSERT INTO lgpd_data_erasure_requests (
            user_id,
            request_date,
            request_reason,
            status,
            data_types,
            requested_by,
            reviewed_by,
            reviewed_at,
            completed_at,
            completion_metadata,
            ip_address,
            user_agent,
            created_at,
            updated_at
          ) VALUES (?, CURRENT_TIMESTAMP, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [
          guard.auth.userId,
          payload.reason,
          JSON.stringify(dataTypes),
          guard.auth.userId,
          guard.auth.userId,
          JSON.stringify({ immediate: true })
        ]
      );

      const row = await db.get<{ id: number }>(
        `
          SELECT id
          FROM lgpd_data_erasure_requests
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        [guard.auth.userId]
      );

      return row?.id ?? null;
    });

    await executeTransaction(async (db) => {
      await db.run(
        `
          UPDATE users SET
            name = 'Usuário Anonimizado',
            email = 'anonymized_' || id || '@deleted.local',
            password_hash = NULL,
            avatar_url = NULL,
            metadata = NULL,
            is_active = 0
          WHERE id = ? AND tenant_id = ?
        `,
        [guard.auth.userId, guard.auth.organizationId]
      );

      await db.run(
        `
          UPDATE comments SET
            content = '[CONTEÚDO REMOVIDO POR SOLICITAÇÃO DO USUÁRIO]'
          WHERE user_id = ? AND tenant_id = ?
        `,
        [guard.auth.userId, guard.auth.organizationId]
      );

      await db.run(
        `
          UPDATE lgpd_consents SET
            is_given = 0,
            withdrawn_at = CURRENT_TIMESTAMP,
            withdrawal_reason = 'User requested data deletion'
          WHERE user_id = ?
        `,
        [guard.auth.userId]
      );

      if (erasureId) {
        await db.run(
          `
            UPDATE lgpd_data_erasure_requests
            SET status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                completion_metadata = ?
            WHERE id = ?
          `,
          [JSON.stringify({ anonymized: true, data_types: dataTypes }), erasureId]
        );

        await db.run(
          `
            INSERT INTO lgpd_anonymized_users (
              original_user_id,
              anonymization_method,
              retention_reason,
              deletion_request_id,
              data_hash,
              kept_fields,
              created_at
            ) VALUES (?, 'pseudonymization', 'legal_obligation', ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          [guard.auth.userId, erasureId, dataHash, JSON.stringify(['id', 'created_at'])]
        );
      }
    });

    createAuditLog({
      user_id: guard.auth.userId,
      action: 'lgpd_data_erasure',
      resource_type: 'lgpd_data_erasure',
      resource_id: erasureId ?? undefined,
      new_values: JSON.stringify({ reason: payload.reason, data_types: dataTypes }),
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to process LGPD erasure request', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar exclusão' },
      { status: 500 }
    );
  }
}
