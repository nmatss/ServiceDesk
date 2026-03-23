/**
 * Banking Integration API Route
 * GET: Return banking integration config/status for the org
 * POST: Process a payment event (PIX confirmation, boleto payment)
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, type SqlParam } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireFeature } from '@/lib/billing/feature-gate';
import { isAdmin } from '@/lib/auth/roles';
import { logger } from '@/lib/monitoring/logger';
import { sqlNow } from '@/lib/db/adapter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/banking
 * Returns banking integration configuration and status for the organization
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  const featureGate = await requireFeature(auth.organizationId, 'integrations', 'full');
  if (featureGate) return featureGate;

  if (!isAdmin(auth.role)) {
    return apiError('Admin access required', 403);
  }

  try {
    const orgId = context.tenant.id;

    // Fetch banking-related integrations for this org
    const integrations = await executeQuery<{
      id: number;
      name: string;
      type: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, type, status, created_at, updated_at
       FROM integrations
       WHERE organization_id = ?
       AND type IN ('pix', 'boleto', 'banking')
       ORDER BY created_at DESC`,
      [orgId]
    );

    // Fetch recent integration logs for banking
    const recentLogs = await executeQuery<{
      id: number;
      integration_id: number;
      event_type: string;
      status: string;
      created_at: string;
    }>(
      `SELECT il.id, il.integration_id, il.event_type, il.status, il.created_at
       FROM integration_logs il
       INNER JOIN integrations i ON i.id = il.integration_id
       WHERE i.organization_id = ?
       AND i.type IN ('pix', 'boleto', 'banking')
       ORDER BY il.created_at DESC
       LIMIT 20`,
      [orgId]
    );

    // Check system-level banking settings
    const pixConfigured = await executeQueryOne<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = 'pix_client_id' AND organization_id IS NULL LIMIT 1`,
      []
    );
    const boletoConfigured = await executeQueryOne<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = 'boleto_client_id' AND organization_id IS NULL LIMIT 1`,
      []
    );

    return apiSuccess({
      integrations,
      recentLogs,
      config: {
        pixEnabled: !!pixConfigured?.value,
        boletoEnabled: !!boletoConfigured?.value,
      },
    });
  } catch (error) {
    logger.error('Error fetching banking integration status', error);
    return apiError('Failed to fetch banking integration status', 500);
  }
}

/**
 * POST /api/integrations/banking
 * Process a payment event (PIX confirmation, boleto payment notification)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  const featureGatePost = await requireFeature(auth.organizationId, 'integrations', 'full');
  if (featureGatePost) return featureGatePost;

  if (!isAdmin(auth.role)) {
    return apiError('Admin access required', 403);
  }

  try {
    const body = await request.json();
    const { eventType, payload } = body;

    if (!eventType || !payload) {
      return apiError('eventType and payload are required', 400);
    }

    const validEventTypes = ['pix_confirmation', 'boleto_payment', 'boleto_registration', 'pix_refund'];
    if (!validEventTypes.includes(eventType)) {
      return apiError(`Invalid eventType. Must be one of: ${validEventTypes.join(', ')}`, 400);
    }

    const orgId = context.tenant.id;

    // Find or create the banking integration record for this org
    let integration = await executeQueryOne<{ id: number }>(
      `SELECT id FROM integrations
       WHERE organization_id = ? AND type = 'banking'
       LIMIT 1`,
      [orgId]
    );

    if (!integration) {
      const result = await executeRun(
        `INSERT INTO integrations (organization_id, name, type, status, created_at, updated_at)
         VALUES (?, 'Banking Integration', 'banking', 'active', ${sqlNow()}, ${sqlNow()})`,
        [orgId]
      );
      integration = { id: Number(result.lastInsertRowid) };
    }

    // Log the payment event
    await executeRun(
      `INSERT INTO integration_logs (integration_id, event_type, status, request_data, created_at)
       VALUES (?, ?, 'received', ?, ${sqlNow()})`,
      [
        integration.id,
        eventType,
        JSON.stringify(payload),
      ]
    );

    // Audit log
    await executeRun(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id, created_at)
       VALUES (?, 'BANKING_EVENT_PROCESSED', 'integration', ?, ?, ?, ?, ${sqlNow()})`,
      [
        auth.userId,
        String(integration.id),
        JSON.stringify({ eventType, summary: payload.txid || payload.nossoNumero || 'N/A' }),
        request.headers.get('x-forwarded-for') || 'unknown',
        orgId,
      ]
    );

    logger.info('Banking payment event processed', {
      eventType,
      organizationId: orgId,
      userId: auth.userId,
      integrationId: integration.id,
    });

    return apiSuccess({
      message: 'Payment event processed successfully',
      eventType,
      integrationId: integration.id,
    });
  } catch (error) {
    logger.error('Error processing banking payment event', error);
    return apiError('Failed to process payment event', 500);
  }
}
