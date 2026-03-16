/**
 * Agent Guardrails for Autonomous AI Agent
 *
 * Safety checks that must pass before the agent can auto-resolve a ticket.
 * Prevents runaway automation and ensures human oversight for sensitive cases.
 */

import { logger } from '@/lib/monitoring/logger';
import { executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import { sqlNow } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import type { IntentType } from './intent-resolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
}

export interface AgentConfig {
  enabled: boolean;
  allowedIntents: IntentType[];
  dailyLimit: number;
  maxPriority: number; // max priority level for auto-resolve (1=low, 4=critical)
}

const DEFAULT_CONFIG: AgentConfig = {
  enabled: true,
  allowedIntents: [
    'password_reset',
    'account_unlock',
    'access_request',
    'software_install',
    'information_query',
    'troubleshooting',
    'status_inquiry',
  ],
  dailyLimit: 50,
  maxPriority: 2, // only low and medium
};

// ---------------------------------------------------------------------------
// AgentGuardrails
// ---------------------------------------------------------------------------

export class AgentGuardrails {
  /**
   * Load agent config from system_settings for the given org.
   */
  async getConfig(orgId: number): Promise<AgentConfig> {
    try {
      const row = await executeQueryOne<{ value: string }>(
        `SELECT value FROM system_settings WHERE key = ? AND organization_id = ?`,
        ['ai_agent_config', orgId] as SqlParam[]
      );
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return {
          enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
          allowedIntents: parsed.allowedIntents ?? DEFAULT_CONFIG.allowedIntents,
          dailyLimit: parsed.dailyLimit ?? DEFAULT_CONFIG.dailyLimit,
          maxPriority: parsed.maxPriority ?? DEFAULT_CONFIG.maxPriority,
        };
      }
    } catch {
      // Use defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Run all guardrail checks. Returns { allowed: true } if all pass.
   */
  async canAutoResolve(
    orgId: number,
    ticketId: number,
    intent: { type: IntentType },
  ): Promise<GuardrailResult> {
    // 1. Load config
    const config = await this.getConfig(orgId);

    // 2. Is AI agent enabled for this org?
    if (!config.enabled) {
      return { allowed: false, reason: 'Agente AI desabilitado para esta organização' };
    }

    // 3. Is this intent type allowed?
    if (!config.allowedIntents.includes(intent.type)) {
      return {
        allowed: false,
        reason: `Tipo de intenção "${intent.type}" não permitido para resolução automática`,
      };
    }

    // 4. Check daily auto-resolution limit
    const todayStart = getDatabaseType() === 'postgresql'
      ? "CURRENT_DATE"
      : "date('now')";

    const countRow = await executeQueryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ticket_activities
       WHERE organization_id = ?
         AND activity_type = 'ai_auto_resolved'
         AND created_at >= ${todayStart}`,
      [orgId] as SqlParam[]
    );
    const todayCount = countRow?.cnt ?? 0;
    if (todayCount >= config.dailyLimit) {
      return {
        allowed: false,
        reason: `Limite diário de ${config.dailyLimit} resoluções automáticas atingido (${todayCount} hoje)`,
      };
    }

    // 5. Check ticket priority (critical tickets always escalate)
    const ticket = await executeQueryOne<{
      priority_id: number | null;
      assigned_to: number | null;
      status: string;
    }>(
      `SELECT t.priority_id, t.assigned_to, s.name as status
       FROM tickets t
       LEFT JOIN statuses s ON t.status_id = s.id
       WHERE t.id = ? AND t.organization_id = ?`,
      [ticketId, orgId] as SqlParam[]
    );

    if (!ticket) {
      return { allowed: false, reason: 'Ticket não encontrado' };
    }

    // Priority: 1=low, 2=medium, 3=high, 4=critical (or similar)
    if (ticket.priority_id && ticket.priority_id > config.maxPriority) {
      return {
        allowed: false,
        reason: `Prioridade do ticket (${ticket.priority_id}) acima do limite para resolução automática (max: ${config.maxPriority})`,
      };
    }

    // 6. Don't override if a human agent is already assigned
    if (ticket.assigned_to) {
      return {
        allowed: false,
        reason: `Ticket já atribuído ao agente #${ticket.assigned_to}`,
      };
    }

    // 7. Don't resolve already closed/resolved tickets
    const finalStatuses = ['resolved', 'closed', 'cancelled', 'resolvido', 'fechado', 'cancelado'];
    if (ticket.status && finalStatuses.includes(ticket.status.toLowerCase())) {
      return {
        allowed: false,
        reason: `Ticket já em status final: ${ticket.status}`,
      };
    }

    logger.info(`Guardrails passed for ticket #${ticketId}`, {
      type: 'ai_agent',
      ticketId,
      orgId,
      intentType: intent.type,
    });

    return { allowed: true };
  }
}

export const agentGuardrails = new AgentGuardrails();
export { DEFAULT_CONFIG };
