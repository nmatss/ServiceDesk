/**
 * Self-Healing Engine — Main Orchestrator
 *
 * Full pipeline: bridge → correlate → find runbook → check guardrails → execute → verify → document
 *
 * Guardrails:
 * - Max 10 auto-remediations per hour per org
 * - Critical risk = require approval (no auto-execution)
 * - Respects org-level self-healing settings
 */

import { executeQueryOne } from '@/lib/db/adapter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';

import { MonitorBridge, type MonitoringAlert, type NormalizedAlert } from './monitor-bridge';
import { IncidentCorrelator, type CorrelationResult } from './incident-correlator';
import { RunbookExecutor, DEFAULT_RUNBOOKS, type Runbook, type ExecutionResult } from './runbook-executor';
import { RemediationVerifier, type VerificationResult } from './remediation-verifier';
import { AutoDocumenter, type SelfHealingEvent } from './auto-documenter';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelfHealingResult {
  success: boolean;
  alert_id: string | null;
  deduplicated: boolean;
  correlation: CorrelationResult | null;
  runbook_id: string | null;
  runbook_name: string | null;
  execution: ExecutionResult | null;
  verification: VerificationResult | null;
  ticket_id: number | null;
  guardrail_blocked: boolean;
  guardrail_reason: string | null;
  message: string;
  duration_ms: number;
}

export interface OrgSelfHealingSettings {
  enabled: boolean;
  max_remediations_per_hour: number;
  require_approval_high_risk: boolean;
  notification_emails: string[];
  custom_runbooks: Runbook[];
}

// ─── In-memory rate tracker ──────────────────────────────────────────────────

interface RateEntry {
  count: number;
  window_start: number;
}

const orgRateMap = new Map<number, RateEntry>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ─── SelfHealingEngine ──────────────────────────────────────────────────────

export class SelfHealingEngine {
  private bridge: MonitorBridge;
  private correlator: IncidentCorrelator;
  private executor: RunbookExecutor;
  private verifier: RemediationVerifier;
  private documenter: AutoDocumenter;

  constructor() {
    this.bridge = new MonitorBridge();
    this.correlator = new IncidentCorrelator();
    this.executor = new RunbookExecutor();
    this.verifier = new RemediationVerifier({ wait_before_check_ms: 10_000 }); // 10s for faster feedback
    this.documenter = new AutoDocumenter();
  }

  /**
   * Handle an incoming monitoring alert through the full pipeline.
   */
  async handleAlert(
    orgId: number,
    userId: number,
    alert: MonitoringAlert
  ): Promise<SelfHealingResult> {
    const startTime = Date.now();

    try {
      // 1. Process through monitor bridge (normalize + dedup)
      const bridgeResult = await this.bridge.processAlert(orgId, alert);

      if (!bridgeResult.success || bridgeResult.deduplicated || !bridgeResult.alert) {
        return {
          success: bridgeResult.success,
          alert_id: null,
          deduplicated: bridgeResult.deduplicated,
          correlation: null,
          runbook_id: null,
          runbook_name: null,
          execution: null,
          verification: null,
          ticket_id: null,
          guardrail_blocked: false,
          guardrail_reason: null,
          message: bridgeResult.message,
          duration_ms: Date.now() - startTime,
        };
      }

      const normalizedAlert = bridgeResult.alert;

      // 2. Check if self-healing is enabled for this org
      const settings = await this.getOrgSettings(orgId);
      if (!settings.enabled) {
        // Still document the alert, but don't auto-remediate
        const correlation = await this.correlator.correlate(orgId, normalizedAlert);
        const event: SelfHealingEvent = {
          alert: normalizedAlert,
          correlation,
          execution: null,
          verification: null,
          guardrail_blocked: true,
          guardrail_reason: 'Auto-healing desabilitado para esta organizacao',
        };
        const ticketId = await this.documenter.document(orgId, userId, event);

        return {
          success: true,
          alert_id: normalizedAlert.id,
          deduplicated: false,
          correlation,
          runbook_id: null,
          runbook_name: null,
          execution: null,
          verification: null,
          ticket_id: ticketId,
          guardrail_blocked: true,
          guardrail_reason: 'Auto-healing desabilitado para esta organizacao',
          message: 'Alerta registrado, mas auto-healing esta desabilitado',
          duration_ms: Date.now() - startTime,
        };
      }

      // 3. Correlate with CMDB and existing tickets
      const correlation = await this.correlator.correlate(orgId, normalizedAlert);

      // 4. Find matching runbook
      const trigger = RunbookExecutor.determineTrigger(normalizedAlert);
      const runbook = RunbookExecutor.findRunbook(trigger, settings.custom_runbooks);

      if (!runbook) {
        // No runbook found — document and escalate
        const event: SelfHealingEvent = {
          alert: normalizedAlert,
          correlation,
          execution: null,
          verification: null,
        };
        const ticketId = await this.documenter.document(orgId, userId, event);

        return {
          success: true,
          alert_id: normalizedAlert.id,
          deduplicated: false,
          correlation,
          runbook_id: null,
          runbook_name: null,
          execution: null,
          verification: null,
          ticket_id: ticketId,
          guardrail_blocked: false,
          guardrail_reason: null,
          message: `Nenhum runbook encontrado para trigger '${trigger}'. Ticket criado para tratamento manual.`,
          duration_ms: Date.now() - startTime,
        };
      }

      // 5. Check guardrails
      const guardrailResult = this.checkGuardrails(orgId, runbook, correlation, settings);
      if (guardrailResult.blocked) {
        const event: SelfHealingEvent = {
          alert: normalizedAlert,
          correlation,
          execution: null,
          verification: null,
          guardrail_blocked: true,
          guardrail_reason: guardrailResult.reason,
        };
        const ticketId = await this.documenter.document(orgId, userId, event);

        return {
          success: true,
          alert_id: normalizedAlert.id,
          deduplicated: false,
          correlation,
          runbook_id: runbook.id,
          runbook_name: runbook.name,
          execution: null,
          verification: null,
          ticket_id: ticketId,
          guardrail_blocked: true,
          guardrail_reason: guardrailResult.reason,
          message: `Guardrail acionado: ${guardrailResult.reason}`,
          duration_ms: Date.now() - startTime,
        };
      }

      // 6. Execute runbook
      this.incrementRate(orgId);

      const executionContext = {
        alert_id: normalizedAlert.id,
        alert_title: normalizedAlert.title,
        service: normalizedAlert.service,
        ci_id: correlation.ci?.id,
        ci_name: correlation.ci?.name,
        severity: normalizedAlert.severity,
        tags: normalizedAlert.tags,
        organization_id: orgId,
        user_id: userId,
      };

      const execution = await this.executor.execute(orgId, runbook, executionContext);

      // 7. Verify remediation (only if execution succeeded)
      let verification: VerificationResult | null = null;
      if (execution.success) {
        verification = await this.verifier.verify(orgId, execution, normalizedAlert);
      }

      // 8. Document everything
      const event: SelfHealingEvent = {
        alert: normalizedAlert,
        correlation,
        execution,
        verification,
      };
      const ticketId = await this.documenter.document(orgId, userId, event);

      const overallSuccess = execution.success && (verification?.verified ?? false);

      return {
        success: true,
        alert_id: normalizedAlert.id,
        deduplicated: false,
        correlation,
        runbook_id: runbook.id,
        runbook_name: runbook.name,
        execution,
        verification,
        ticket_id: ticketId,
        guardrail_blocked: false,
        guardrail_reason: null,
        message: overallSuccess
          ? `Remediacao automatica concluida com sucesso via runbook '${runbook.name}'`
          : `Remediacao via '${runbook.name}' ${execution.success ? 'executada mas verificacao falhou' : 'falhou'}`,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Pipeline error: ${errMsg}`, { orgId, alert });

      return {
        success: false,
        alert_id: null,
        deduplicated: false,
        correlation: null,
        runbook_id: null,
        runbook_name: null,
        execution: null,
        verification: null,
        ticket_id: null,
        guardrail_blocked: false,
        guardrail_reason: null,
        message: `Erro no pipeline de auto-healing: ${errMsg}`,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Get org-level self-healing settings from system_settings.
   */
  private async getOrgSettings(orgId: number): Promise<OrgSelfHealingSettings> {
    const defaults: OrgSelfHealingSettings = {
      enabled: true,
      max_remediations_per_hour: 10,
      require_approval_high_risk: true,
      notification_emails: [],
      custom_runbooks: [],
    };

    try {
      const row = await executeQueryOne<{ value: string }>(
        "SELECT value FROM system_settings WHERE key = 'self_healing_config' AND organization_id = ?",
        [orgId]
      );

      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return {
          enabled: parsed.enabled ?? defaults.enabled,
          max_remediations_per_hour: parsed.max_remediations_per_hour ?? defaults.max_remediations_per_hour,
          require_approval_high_risk: parsed.require_approval_high_risk ?? defaults.require_approval_high_risk,
          notification_emails: parsed.notification_emails ?? defaults.notification_emails,
          custom_runbooks: (parsed.custom_runbooks ?? []).map((rb: Runbook) => ({
            ...rb,
            enabled: rb.enabled ?? true,
          })),
        };
      }
    } catch {
      // Fall back to defaults
    }

    return defaults;
  }

  /**
   * Check guardrails before executing a runbook.
   */
  private checkGuardrails(
    orgId: number,
    runbook: Runbook,
    correlation: CorrelationResult,
    settings: OrgSelfHealingSettings
  ): { blocked: boolean; reason: string } {
    // Rate limit: max remediations per hour
    const rate = this.getRate(orgId);
    if (rate >= settings.max_remediations_per_hour) {
      return {
        blocked: true,
        reason: `Limite de ${settings.max_remediations_per_hour} remedicoes/hora atingido (atual: ${rate})`,
      };
    }

    // High-risk runbook + critical risk level = require approval
    if (
      settings.require_approval_high_risk &&
      (runbook.risk === 'high' || correlation.risk_level === 'critical')
    ) {
      return {
        blocked: true,
        reason: `Runbook de alto risco '${runbook.name}' requer aprovacao manual (risco: ${correlation.risk_level})`,
      };
    }

    return { blocked: false, reason: '' };
  }

  /**
   * Get current rate count for an org.
   */
  private getRate(orgId: number): number {
    const entry = orgRateMap.get(orgId);
    if (!entry) return 0;
    if (Date.now() - entry.window_start > RATE_WINDOW_MS) {
      orgRateMap.delete(orgId);
      return 0;
    }
    return entry.count;
  }

  /**
   * Increment rate count for an org.
   */
  private incrementRate(orgId: number): void {
    const existing = orgRateMap.get(orgId);
    if (!existing || Date.now() - existing.window_start > RATE_WINDOW_MS) {
      orgRateMap.set(orgId, { count: 1, window_start: Date.now() });
    } else {
      existing.count += 1;
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _engine: SelfHealingEngine | null = null;

export function getSelfHealingEngine(): SelfHealingEngine {
  if (!_engine) {
    _engine = new SelfHealingEngine();
  }
  return _engine;
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { MonitorBridge, type MonitoringAlert, type NormalizedAlert } from './monitor-bridge';
export { IncidentCorrelator, type CorrelationResult } from './incident-correlator';
export { RunbookExecutor, DEFAULT_RUNBOOKS, type Runbook, type ExecutionResult, type RunbookStep } from './runbook-executor';
export { RemediationVerifier, type VerificationResult } from './remediation-verifier';
export { AutoDocumenter, type SelfHealingEvent } from './auto-documenter';
