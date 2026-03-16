/**
 * Self-Healing Webhooks API
 *
 * POST: Receive monitoring webhooks from Sentry, Datadog, Prometheus, Grafana, custom.
 * Detects source by headers and normalizes payload.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import {
  getSelfHealingEngine,
  MonitorBridge,
  type MonitoringAlert,
} from '@/lib/self-healing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/self-healing/webhooks
 *
 * Receive a monitoring alert and trigger the self-healing pipeline.
 * Supports:
 * - Generic MonitoringAlert format (body.source field)
 * - Sentry webhook (detected by X-Sentry-Hook header)
 * - Datadog webhook (detected by DD-API-KEY or body.alert_type)
 * - Prometheus/Alertmanager (detected by body.alerts array)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WEBHOOK);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Auth: try tenant context, fall back to webhook secret for external integrations
    let orgId: number;
    let userId: number;

    const guard = requireTenantUserContext(request);
    if (guard.response) {
      // Not authenticated via JWT — check webhook secret
      const webhookSecret = request.headers.get('x-webhook-secret');
      const expectedSecret = process.env.SELF_HEALING_WEBHOOK_SECRET;

      if (!expectedSecret || webhookSecret !== expectedSecret) {
        return apiError('Nao autorizado. Forneca autenticacao JWT ou X-Webhook-Secret valido.', 401);
      }

      // Use org 1 and system user as defaults for webhook-only auth
      orgId = parseInt(request.headers.get('x-organization-id') || '1', 10);
      userId = parseInt(request.headers.get('x-user-id') || '1', 10);
    } else {
      orgId = guard.auth!.organizationId;
      userId = guard.auth!.userId;
    }

    const body = await request.json();

    // Detect source and normalize
    const alert = detectAndNormalize(request, body);
    if (!alert) {
      return apiError('Formato de alerta nao reconhecido', 400);
    }

    // Run the self-healing pipeline
    const engine = getSelfHealingEngine();
    const result = await engine.handleAlert(orgId, userId, alert);

    logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing Webhook] Processed alert: ${alert.title}`, {
        orgId,
        source: alert.source,
        severity: alert.severity,
        success: result.success,
        ticketId: result.ticket_id,
      });

    return apiSuccess(result, undefined, result.success ? 200 : 207);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro interno';
    logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing Webhook] Error: ${errMsg}`);
    return apiError(`Erro ao processar webhook: ${errMsg}`, 500);
  }
}

/**
 * Detect the source of the webhook and normalize the payload.
 */
function detectAndNormalize(
  request: NextRequest,
  body: Record<string, unknown>
): MonitoringAlert | null {
  // 1. Sentry: check for X-Sentry-Hook header
  if (request.headers.get('x-sentry-hook') || request.headers.get('sentry-hook')) {
    return MonitorBridge.parseSentryPayload(body);
  }

  // 2. Datadog: check for DD headers or alert_type field
  if (
    request.headers.get('dd-api-key') ||
    typeof body.alert_type === 'string' ||
    typeof body.alert_id === 'string'
  ) {
    return MonitorBridge.parseDatadogPayload(body);
  }

  // 3. Prometheus/Alertmanager: check for alerts array
  if (Array.isArray(body.alerts)) {
    return MonitorBridge.parsePrometheusPayload(body);
  }

  // 4. Generic/custom format: check for source field
  if (typeof body.source === 'string' && typeof body.title === 'string') {
    return {
      source: (body.source as MonitoringAlert['source']) || 'custom',
      severity: (body.severity as MonitoringAlert['severity']) || 'warning',
      title: body.title as string,
      description: (body.description as string) || '',
      service: body.service as string | undefined,
      metric_name: body.metric_name as string | undefined,
      threshold: typeof body.threshold === 'number' ? body.threshold : undefined,
      current_value: typeof body.current_value === 'number' ? body.current_value : undefined,
      tags: (body.tags as Record<string, string>) || {},
      raw_payload: body,
    };
  }

  // 5. Grafana: check for ruleName or ruleUrl
  if (typeof body.ruleName === 'string' || typeof body.ruleUrl === 'string') {
    const state = (body.state as string) || 'alerting';
    const severityMap: Record<string, MonitoringAlert['severity']> = {
      alerting: 'error',
      ok: 'info',
      pending: 'warning',
      no_data: 'warning',
    };

    return {
      source: 'grafana',
      severity: severityMap[state] || 'warning',
      title: (body.ruleName as string) || (body.title as string) || 'Grafana Alert',
      description: (body.message as string) || '',
      service: (body.tags as Record<string, string>)?.service || undefined,
      tags: (body.tags as Record<string, string>) || {},
      raw_payload: body,
    };
  }

  return null;
}
