import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getTrustedClientIP } from '@/lib/api/get-client-ip';
import { createAuditLog } from '@/lib/audit/logger';
import { logger } from '@/lib/monitoring/logger';

const exportSchema = z.object({
  data_types: z.array(z.string().min(1)).optional(),
  format: z.enum(['json', 'csv', 'xml']).optional()
});

type ExportData = {
  user?: unknown;
  tickets?: unknown[];
  comments?: unknown[];
  consents?: unknown[];
  auditLogs?: unknown[];
};

async function exportUserData(userId: number, tenantId: number, dataTypes: string[]): Promise<ExportData> {
  const include = new Set(dataTypes);
  const exportData: ExportData = {};

  if (include.has('profile')) {
    const user = await executeQueryOne(
      `
        SELECT id, name, email, role, created_at, updated_at
        FROM users
        WHERE id = ? AND tenant_id = ?
      `,
      [userId, tenantId]
    );
    exportData.user = user;
    if (!user) {
      throw new Error('User not found');
    }
  }

  if (include.has('tickets')) {
    exportData.tickets = await executeQuery(
      `
        SELECT *
        FROM tickets
        WHERE user_id = ? AND tenant_id = ?
        ORDER BY created_at DESC
      `,
      [userId, tenantId]
    );
  }

  if (include.has('comments')) {
    exportData.comments = await executeQuery(
      `
        SELECT c.*
        FROM comments c
        INNER JOIN tickets t ON c.ticket_id = t.id
        WHERE c.user_id = ? AND t.tenant_id = ?
        ORDER BY c.created_at DESC
      `,
      [userId, tenantId]
    );
  }

  if (include.has('consents')) {
    exportData.consents = await executeQuery(
      `
        SELECT *
        FROM lgpd_consents
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [userId]
    );
  }

  if (include.has('audit_logs')) {
    exportData.auditLogs = await executeQuery(
      `
        SELECT *
        FROM audit_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1000
      `,
      [userId]
    );
  }

  return exportData;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;

  let payload: z.infer<typeof exportSchema>;
  try {
    payload = exportSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Payload inválido' },
      { status: 400 }
    );
  }

  const dataTypes = payload.data_types?.length
    ? payload.data_types
    : ['profile', 'tickets', 'comments', 'consents', 'audit_logs'];

  try {
    const exportData = await exportUserData(guard.auth.userId, guard.auth.organizationId, dataTypes);
    const exportJson = JSON.stringify(exportData);
    const ipAddress = getTrustedClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await executeRun(
      `
        INSERT INTO lgpd_data_portability_requests (
          user_id,
          request_date,
          status,
          data_types,
          format,
          file_size_bytes,
          completed_at,
          ip_address,
          user_agent
        ) VALUES (?, CURRENT_TIMESTAMP, 'completed', ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `,
      [
        guard.auth.userId,
        JSON.stringify(dataTypes),
        payload.format || 'json',
        Buffer.byteLength(exportJson, 'utf8'),
        ipAddress,
        userAgent
      ]
    );

    createAuditLog({
      user_id: guard.auth.userId,
      action: 'lgpd_data_export',
      resource_type: 'lgpd_data_portability',
      resource_id: undefined,
      new_values: JSON.stringify({ data_types: dataTypes, format: payload.format || 'json' }),
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return NextResponse.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    logger.error('Failed to export LGPD data', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao exportar dados' },
      { status: 500 }
    );
  }
}
