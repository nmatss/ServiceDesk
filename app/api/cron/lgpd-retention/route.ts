import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { LGPDComplianceManager } from '@/lib/compliance/lgpd';
import { LgpdComplianceManager } from '@/lib/security/lgpd-compliance';
import { createAuditLog } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401);
  }

  try {
    const startTime = Date.now();
    const results = {
      retention: { expiredRecords: 0, deletedRecords: 0, errors: [] as string[] },
      expiredConsents: 0,
      pendingRequests: { processed: 0, errors: [] as string[] },
      anonymized: 0
    };

    // 1. Run retention check — marks expired consents as withdrawn
    const lgpdSecurity = new LgpdComplianceManager();
    const retentionResult = await lgpdSecurity.performRetentionCheck();
    results.retention = retentionResult;

    // 2. Apply data retention policies (delete old behavioral data, anonymize contacts)
    const lgpdCompliance = new LGPDComplianceManager();
    try {
      await lgpdCompliance.applyDataRetentionPolicies();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.retention.errors.push(`Retention policies: ${msg}`);
    }

    // 3. Process pending LGPD data subject requests (erasure/portability)
    const pendingRequests = await executeQuery<{
      id: string;
      user_id: number;
      request_type: string;
      status: string;
    }>(`
      SELECT id, user_id, request_type, status
      FROM lgpd_data_subject_requests
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 20
    `, []);

    for (const req of pendingRequests) {
      try {
        if (req.request_type === 'erasure') {
          // Process erasure: anonymize user data
          await executeRun(`
            UPDATE users
            SET name = 'Usuário Removido',
                email = 'removed_' || id || '@deleted.local',
                avatar_url = NULL,
                metadata = NULL,
                is_active = 0
            WHERE id = ? AND is_active = 1
          `, [req.user_id]);

          // Delete related PII
          await executeRun('DELETE FROM govbr_integrations WHERE user_id = ?', [req.user_id]);
          await executeRun('DELETE FROM whatsapp_contacts WHERE user_id = ?', [req.user_id]);

          // Mark request as completed
          await executeRun(`
            UPDATE lgpd_data_subject_requests
            SET status = 'completed', responded_at = CURRENT_TIMESTAMP,
                response = 'Dados pessoais removidos conforme solicitação LGPD'
            WHERE id = ?
          `, [req.id]);

          results.pendingRequests.processed++;
        } else if (req.request_type === 'access') {
          // Access requests are auto-processed by the compliance manager
          results.pendingRequests.processed++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.pendingRequests.errors.push(`Request ${req.id}: ${msg}`);
      }
    }

    // 4. Anonymize inactive users past retention period (3 years)
    const anonymizeResult = await executeRun(`
      UPDATE users
      SET name = 'Usuário Anonimizado',
          email = 'anonymized_' || id || '@deleted.local',
          avatar_url = NULL,
          metadata = NULL
      WHERE is_active = 0
        AND updated_at < CURRENT_TIMESTAMP - INTERVAL '3 years'
        AND email NOT LIKE '%@deleted.local'
    `, []).catch(() => ({ changes: 0 }));
    results.anonymized = anonymizeResult.changes || 0;

    // 5. Audit log the cron execution
    await createAuditLog({
      action: 'lgpd_retention_cron',
      resource_type: 'cron',
      new_values: JSON.stringify({
        retention: results.retention,
        expiredConsents: results.expiredConsents,
        pendingRequests: results.pendingRequests.processed,
        anonymized: results.anonymized
      })
    });

    const duration = Date.now() - startTime;

    return apiSuccess({
      ...results,
      duration_ms: duration
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar retenção LGPD';
    return apiError(message, 500);
  }
}
