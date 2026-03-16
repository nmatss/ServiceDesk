import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQueryOne, executeRun, sqlNow, type SqlParam } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { isAdmin } from '@/lib/auth/roles';
import { INTENT_TYPES } from '@/lib/ai/intent-resolver';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

interface AgentConfigPayload {
  enabled: boolean;
  allowedIntents: string[];
  dailyLimit: number;
  maxPriority: number;
  autoResolveMin: number;
  suggestMin: number;
}

const CONFIG_KEY = 'ai_agent_config';
const THRESHOLDS_KEY = 'ai_agent_thresholds';

/**
 * GET /api/ai/agent/config
 * Returns the current AI agent configuration for the authenticated org.
 * Requires admin role.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { auth } = guard;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  try {
    const [configRow, thresholdsRow] = await Promise.all([
      executeQueryOne<{ value: string }>(
        `SELECT value FROM system_settings WHERE key = ? AND organization_id = ?`,
        [CONFIG_KEY, auth.organizationId] as SqlParam[]
      ),
      executeQueryOne<{ value: string }>(
        `SELECT value FROM system_settings WHERE key = ? AND organization_id = ?`,
        [THRESHOLDS_KEY, auth.organizationId] as SqlParam[]
      ),
    ]);

    const config = configRow?.value ? JSON.parse(configRow.value) : {
      enabled: true,
      allowedIntents: [...INTENT_TYPES].filter(t => t !== 'other'),
      dailyLimit: 50,
      maxPriority: 2,
    };

    const thresholds = thresholdsRow?.value ? JSON.parse(thresholdsRow.value) : {
      autoResolveMin: 85,
      suggestMin: 60,
    };

    return apiSuccess({
      ...config,
      ...thresholds,
      availableIntents: INTENT_TYPES.filter(t => t !== 'other'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error fetching AI agent config: ${message}`);
    return apiError('Erro ao buscar configuração do Agente AI', 500);
  }
}

/**
 * PUT /api/ai/agent/config
 * Updates the AI agent configuration for the authenticated org.
 * Requires admin role.
 */
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireTenantUserContext(request);
  if (guard.response) return guard.response;
  const { auth } = guard;

  if (!isAdmin(auth.role)) {
    return apiError('Acesso restrito a administradores', 403);
  }

  try {
    const body: Partial<AgentConfigPayload> = await request.json();

    // Validate
    if (body.dailyLimit !== undefined && (body.dailyLimit < 1 || body.dailyLimit > 500)) {
      return apiError('dailyLimit deve estar entre 1 e 500', 400);
    }
    if (body.maxPriority !== undefined && (body.maxPriority < 1 || body.maxPriority > 4)) {
      return apiError('maxPriority deve estar entre 1 e 4', 400);
    }
    if (body.autoResolveMin !== undefined && (body.autoResolveMin < 50 || body.autoResolveMin > 100)) {
      return apiError('autoResolveMin deve estar entre 50 e 100', 400);
    }
    if (body.suggestMin !== undefined && (body.suggestMin < 20 || body.suggestMin > 99)) {
      return apiError('suggestMin deve estar entre 20 e 99', 400);
    }
    if (body.allowedIntents) {
      const valid = INTENT_TYPES.filter(t => t !== 'other');
      for (const intent of body.allowedIntents) {
        if (!valid.includes(intent as typeof valid[number])) {
          return apiError(`Intenção inválida: ${intent}`, 400);
        }
      }
    }

    // Upsert config
    const configValue = JSON.stringify({
      enabled: body.enabled,
      allowedIntents: body.allowedIntents,
      dailyLimit: body.dailyLimit,
      maxPriority: body.maxPriority,
    });

    const thresholdsValue = JSON.stringify({
      autoResolveMin: body.autoResolveMin,
      suggestMin: body.suggestMin,
    });

    // Upsert pattern: try update, if 0 changes then insert
    for (const [key, value] of [[CONFIG_KEY, configValue], [THRESHOLDS_KEY, thresholdsValue]] as const) {
      const existing = await executeQueryOne<{ id: number }>(
        `SELECT id FROM system_settings WHERE key = ? AND organization_id = ?`,
        [key, auth.organizationId] as SqlParam[]
      );

      if (existing) {
        await executeRun(
          `UPDATE system_settings SET value = ?, updated_at = ${sqlNow()} WHERE key = ? AND organization_id = ?`,
          [value, key, auth.organizationId] as SqlParam[]
        );
      } else {
        await executeRun(
          `INSERT INTO system_settings (key, value, organization_id, created_at, updated_at)
           VALUES (?, ?, ?, ${sqlNow()}, ${sqlNow()})`,
          [key, value, auth.organizationId] as SqlParam[]
        );
      }
    }

    logger.info(`AI Agent config updated by user #${auth.userId}`, {
      type: 'ai_agent',
      orgId: auth.organizationId,
      userId: auth.userId,
    });

    return apiSuccess({ message: 'Configuração do Agente AI atualizada com sucesso' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Error updating AI agent config: ${message}`);
    return apiError('Erro ao atualizar configuração do Agente AI', 500);
  }
}
