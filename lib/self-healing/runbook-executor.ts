/**
 * Runbook Executor — Self-Healing Module
 *
 * Executes remediation runbooks: sequences of steps including webhooks,
 * API calls, waits, metric checks, notifications, ticket/CI updates.
 * All steps are logged to audit_logs.
 */

import { executeRun, executeQuery, sqlNow } from '@/lib/db/adapter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';
import { getAppUrl } from '@/lib/config/app-url';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RunbookStepType =
  | 'webhook'
  | 'api_call'
  | 'wait'
  | 'check_metric'
  | 'notify'
  | 'create_ticket'
  | 'update_ci_status';

export interface RunbookStep {
  order: number;
  type: RunbookStepType;
  name: string;
  config: Record<string, unknown>;
  timeout_ms?: number; // default 30000
  continue_on_error?: boolean;
}

export interface Runbook {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  risk: 'low' | 'medium' | 'high';
  enabled: boolean;
  steps: RunbookStep[];
  max_duration_ms?: number; // default 300000 (5min)
}

export interface ExecutionContext {
  alert_id: string;
  alert_title: string;
  service: string;
  ci_id?: number;
  ci_name?: string;
  severity: string;
  tags: Record<string, string>;
  organization_id: number;
  user_id: number;
}

export interface StepResult {
  step_order: number;
  step_name: string;
  step_type: RunbookStepType;
  success: boolean;
  duration_ms: number;
  output?: unknown;
  error?: string;
}

export interface ExecutionResult {
  runbook_id: string;
  runbook_name: string;
  success: boolean;
  steps_completed: number;
  total_steps: number;
  results: StepResult[];
  duration_ms: number;
  aborted: boolean;
  abort_reason?: string;
}

// ─── Default Runbooks ────────────────────────────────────────────────────────

export const DEFAULT_RUNBOOKS: Runbook[] = [
  {
    id: 'restart-service',
    name: 'Reiniciar Servico',
    description: 'Reinicia o servico afetado via webhook e verifica recuperacao.',
    trigger: 'service_down',
    risk: 'low',
    enabled: true,
    steps: [
      { order: 1, type: 'notify', name: 'Notificar equipe', config: { message: 'Iniciando reinicio automatico do servico {service}' } },
      { order: 2, type: 'webhook', name: 'Reiniciar servico', config: { method: 'POST', url_template: '{webhook_url}/restart', body: { service: '{service}' } }, timeout_ms: 30000 },
      { order: 3, type: 'wait', name: 'Aguardar estabilizacao', config: { seconds: 15 } },
      { order: 4, type: 'check_metric', name: 'Verificar saude', config: { check: 'service_health', expect: 'healthy' } },
      { order: 5, type: 'notify', name: 'Notificar resultado', config: { message: 'Servico {service} reiniciado com sucesso' } },
    ],
  },
  {
    id: 'clear-cache',
    name: 'Limpar Cache',
    description: 'Limpa cache quando uso de memoria esta acima do threshold.',
    trigger: 'high_memory',
    risk: 'low',
    enabled: true,
    steps: [
      { order: 1, type: 'notify', name: 'Notificar equipe', config: { message: 'Limpando cache do servico {service} - Memoria acima do limiar' } },
      { order: 2, type: 'api_call', name: 'Limpar cache', config: { method: 'POST', endpoint: '/api/health/clear-cache', body: { service: '{service}' } }, timeout_ms: 15000 },
      { order: 3, type: 'wait', name: 'Aguardar liberacao', config: { seconds: 10 } },
      { order: 4, type: 'check_metric', name: 'Verificar memoria', config: { check: 'memory_usage', threshold_pct: 80 } },
    ],
  },
  {
    id: 'scale-up',
    name: 'Escalar Recurso',
    description: 'Escala horizontalmente o servico quando CPU esta alta.',
    trigger: 'high_cpu',
    risk: 'medium',
    enabled: true,
    steps: [
      { order: 1, type: 'notify', name: 'Notificar equipe', config: { message: 'Escalando {service} - CPU acima do limiar' } },
      { order: 2, type: 'webhook', name: 'Escalar servico', config: { method: 'POST', url_template: '{webhook_url}/scale', body: { service: '{service}', action: 'scale_up', replicas: 2 } }, timeout_ms: 60000 },
      { order: 3, type: 'wait', name: 'Aguardar provisionamento', config: { seconds: 30 } },
      { order: 4, type: 'check_metric', name: 'Verificar CPU', config: { check: 'cpu_usage', threshold_pct: 80 } },
      { order: 5, type: 'notify', name: 'Notificar resultado', config: { message: 'Servico {service} escalado com sucesso' } },
    ],
  },
  {
    id: 'failover-db',
    name: 'Failover de Banco',
    description: 'Executa failover de banco de dados quando conexao falha.',
    trigger: 'db_connection_error',
    risk: 'high',
    enabled: true,
    steps: [
      { order: 1, type: 'notify', name: 'Notificar equipe - CRITICO', config: { message: 'CRITICO: Failover de banco iniciado para {service}', urgency: 'critical' } },
      { order: 2, type: 'webhook', name: 'Iniciar failover', config: { method: 'POST', url_template: '{webhook_url}/failover', body: { service: '{service}', type: 'database' } }, timeout_ms: 120000 },
      { order: 3, type: 'wait', name: 'Aguardar failover', config: { seconds: 30 } },
      { order: 4, type: 'check_metric', name: 'Verificar conexao DB', config: { check: 'db_connection', expect: 'connected' } },
      { order: 5, type: 'update_ci_status', name: 'Atualizar status CI', config: { status: 'degraded' } },
      { order: 6, type: 'notify', name: 'Notificar resultado', config: { message: 'Failover de banco para {service} concluido' } },
    ],
  },
  {
    id: 'revoke-session',
    name: 'Revogar Sessao',
    description: 'Revoga sessoes suspeitas quando detecta breach de seguranca.',
    trigger: 'security_breach',
    risk: 'medium',
    enabled: true,
    steps: [
      { order: 1, type: 'notify', name: 'Notificar seguranca', config: { message: 'SEGURANCA: Revogando sessoes suspeitas para {service}', urgency: 'critical' } },
      { order: 2, type: 'api_call', name: 'Revogar sessoes', config: { method: 'POST', endpoint: '/api/auth/revoke-sessions', body: { service: '{service}', reason: 'security_breach_auto' } }, timeout_ms: 15000 },
      { order: 3, type: 'notify', name: 'Notificar resultado', config: { message: 'Sessoes revogadas para {service}' } },
    ],
  },
];

// ─── RunbookExecutor ─────────────────────────────────────────────────────────

const DEFAULT_STEP_TIMEOUT_MS = 30_000;
const DEFAULT_RUNBOOK_TIMEOUT_MS = 300_000;

export class RunbookExecutor {
  /**
   * Execute a runbook with full step-by-step tracking.
   */
  async execute(
    orgId: number,
    runbook: Runbook,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const results: StepResult[] = [];
    let aborted = false;
    let abortReason: string | undefined;
    const maxDuration = runbook.max_duration_ms || DEFAULT_RUNBOOK_TIMEOUT_MS;

    logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Executing runbook: ${runbook.name}`, { orgId, runbookId: runbook.id, alertId: context.alert_id, steps: runbook.steps.length });

    // Audit: start
    await this.auditLog(orgId, context.user_id, 'self_healing_runbook_start', {
      runbook_id: runbook.id,
      runbook_name: runbook.name,
      alert_id: context.alert_id,
      service: context.service,
    });

    for (const step of runbook.steps) {
      // Check total runbook timeout
      if (Date.now() - startTime > maxDuration) {
        aborted = true;
        abortReason = `Timeout do runbook excedido (${maxDuration}ms)`;
        break;
      }

      const stepResult = await this.executeStep(step, context);
      results.push(stepResult);

      // Audit each step
      await this.auditLog(orgId, context.user_id, 'self_healing_step_complete', {
        runbook_id: runbook.id,
        step_order: step.order,
        step_name: step.name,
        step_type: step.type,
        success: stepResult.success,
        duration_ms: stepResult.duration_ms,
        error: stepResult.error,
      });

      // Abort on failure unless continue_on_error
      if (!stepResult.success && !step.continue_on_error) {
        aborted = true;
        abortReason = `Passo ${step.order} (${step.name}) falhou: ${stepResult.error}`;
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const allSuccess = !aborted && results.every((r) => r.success);

    // Audit: end
    await this.auditLog(orgId, context.user_id, 'self_healing_runbook_end', {
      runbook_id: runbook.id,
      runbook_name: runbook.name,
      success: allSuccess,
      steps_completed: results.length,
      total_steps: runbook.steps.length,
      duration_ms: totalDuration,
      aborted,
      abort_reason: abortReason,
    });

    logger.log(allSuccess ? LogLevel.INFO : LogLevel.WARN, EventType.SYSTEM, `[Self-Healing] Runbook ${allSuccess ? 'completed' : 'failed'}: ${runbook.name}`, { orgId, runbookId: runbook.id, success: allSuccess, duration: totalDuration });

    return {
      runbook_id: runbook.id,
      runbook_name: runbook.name,
      success: allSuccess,
      steps_completed: results.length,
      total_steps: runbook.steps.length,
      results,
      duration_ms: totalDuration,
      aborted,
      abort_reason: abortReason,
    };
  }

  /**
   * Execute a single runbook step.
   */
  private async executeStep(step: RunbookStep, context: ExecutionContext): Promise<StepResult> {
    const start = Date.now();
    const timeout = step.timeout_ms || DEFAULT_STEP_TIMEOUT_MS;

    try {
      const output = await this.withTimeout(
        this.runStepAction(step, context),
        timeout,
        `Timeout no passo ${step.name} (${timeout}ms)`
      );

      return {
        step_order: step.order,
        step_name: step.name,
        step_type: step.type,
        success: true,
        duration_ms: Date.now() - start,
        output,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        step_order: step.order,
        step_name: step.name,
        step_type: step.type,
        success: false,
        duration_ms: Date.now() - start,
        error: errMsg,
      };
    }
  }

  /**
   * Run the actual step action based on type.
   */
  private async runStepAction(step: RunbookStep, context: ExecutionContext): Promise<unknown> {
    const config = this.interpolateConfig(step.config, context);

    switch (step.type) {
      case 'webhook':
        return this.executeWebhook(config);

      case 'api_call':
        return this.executeApiCall(config);

      case 'wait':
        return this.executeWait(config);

      case 'check_metric':
        return this.executeCheckMetric(config);

      case 'notify':
        return this.executeNotify(config, context);

      case 'create_ticket':
        return this.executeCreateTicket(config, context);

      case 'update_ci_status':
        return this.executeUpdateCIStatus(config, context);

      default:
        throw new Error(`Tipo de passo desconhecido: ${step.type}`);
    }
  }

  /**
   * Execute a webhook step (external POST call).
   */
  private async executeWebhook(config: Record<string, unknown>): Promise<unknown> {
    const url = config.url_template as string;
    if (!url) throw new Error('URL do webhook nao configurada');

    const method = (config.method as string) || 'POST';
    const body = config.body as Record<string, unknown> | undefined;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Webhook falhou: ${response.status} ${text.slice(0, 200)}`);
    }

    return { status: response.status, ok: true };
  }

  /**
   * Execute an internal API call step.
   */
  private async executeApiCall(config: Record<string, unknown>): Promise<unknown> {
    const endpoint = config.endpoint as string;
    if (!endpoint) throw new Error('Endpoint da API nao configurado');

    const method = (config.method as string) || 'GET';
    const body = config.body as Record<string, unknown> | undefined;

    // Internal API call - use relative URL with base
    const baseUrl = getAppUrl();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`API call falhou: ${response.status} ${JSON.stringify(data).slice(0, 200)}`);
    }

    return data;
  }

  /**
   * Execute a wait step.
   */
  private async executeWait(config: Record<string, unknown>): Promise<unknown> {
    const seconds = (config.seconds as number) || 5;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return { waited_seconds: seconds };
  }

  /**
   * Execute a metric check step.
   * In a real implementation, this would query Prometheus/Datadog.
   * Here we do a simple health check.
   */
  private async executeCheckMetric(config: Record<string, unknown>): Promise<unknown> {
    const check = config.check as string;

    // Try internal health endpoint
    if (check === 'service_health' || check === 'db_connection') {
      const baseUrl = getAppUrl();
      try {
        const response = await fetch(`${baseUrl}/api/health/ready`, { method: 'GET' });
        if (response.ok) {
          return { check, status: 'healthy' };
        }
        throw new Error(`Health check retornou ${response.status}`);
      } catch (error) {
        throw new Error(`Health check falhou: ${error instanceof Error ? error.message : 'desconhecido'}`);
      }
    }

    // For external metrics, we'd integrate with monitoring APIs
    // For now, log that check was requested
    return { check, status: 'checked', note: 'Verificacao simulada - integre com seu sistema de monitoramento' };
  }

  /**
   * Execute a notification step.
   */
  private async executeNotify(config: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const message = config.message as string;
    const urgency = (config.urgency as string) || 'normal';

    logger.log(urgency === 'critical' ? LogLevel.WARN : LogLevel.INFO, EventType.SYSTEM, `[Self-Healing Notify] ${message}`, { orgId: context.organization_id, alertId: context.alert_id, urgency });

    // In production, this would call the notification system
    return { notified: true, message, urgency };
  }

  /**
   * Execute a create-ticket step.
   */
  private async executeCreateTicket(config: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const title = (config.title as string) || `[Auto-Healing] ${context.alert_title}`;
    const description = (config.description as string) || `Ticket criado automaticamente pelo sistema de auto-healing.\nServico: ${context.service}\nAlerta: ${context.alert_title}`;
    const priority = (config.priority as string) || context.severity;

    const ticketNumber = `SH-${Date.now().toString(36).toUpperCase()}`;

    const result = await executeRun(
      `INSERT INTO tickets (ticket_number, title, description, priority, status, organization_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ${sqlNow()}, ${sqlNow()})`,
      [ticketNumber, title, description, priority, context.organization_id, context.user_id]
    );

    return { ticket_id: result.lastInsertRowid, ticket_number: ticketNumber };
  }

  /**
   * Execute a CI status update step.
   */
  private async executeUpdateCIStatus(config: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    if (!context.ci_id) return { updated: false, reason: 'Nenhum CI associado' };

    const targetStatus = config.status as string;
    if (!targetStatus) throw new Error('Status alvo nao configurado');

    // Find the status ID
    const statusRows = await executeQuery<{ id: number }>(
      'SELECT id FROM ci_statuses WHERE name = ? LIMIT 1',
      [targetStatus]
    );

    if (statusRows.length === 0) {
      return { updated: false, reason: `Status '${targetStatus}' nao encontrado` };
    }

    await executeRun(
      `UPDATE configuration_items SET status_id = ?, updated_at = ${sqlNow()} WHERE id = ? AND organization_id = ?`,
      [statusRows[0].id, context.ci_id, context.organization_id]
    );

    return { updated: true, ci_id: context.ci_id, new_status: targetStatus };
  }

  /**
   * Interpolate context variables in config values.
   * Replaces {service}, {alert_title}, {ci_name}, {webhook_url}, etc.
   */
  private interpolateConfig(config: Record<string, unknown>, context: ExecutionContext): Record<string, unknown> {
    const vars: Record<string, string> = {
      service: context.service || 'unknown',
      alert_title: context.alert_title || '',
      alert_id: context.alert_id || '',
      ci_name: context.ci_name || '',
      ci_id: context.ci_id?.toString() || '',
      severity: context.severity || '',
      organization_id: context.organization_id.toString(),
      webhook_url: (context.tags.webhook_url as string) || process.env.SELF_HEALING_WEBHOOK_URL || '',
    };

    return this.deepInterpolate(config, vars);
  }

  private deepInterpolate(obj: unknown, vars: Record<string, string>): Record<string, unknown> {
    if (typeof obj === 'string') {
      let result = obj;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      return result as unknown as Record<string, unknown>;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepInterpolate(item, vars)) as unknown as Record<string, unknown>;
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.deepInterpolate(value, vars);
      }
      return result;
    }
    return obj as unknown as Record<string, unknown>;
  }

  /**
   * Wrap a promise with a timeout.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Log to audit_logs table.
   */
  private async auditLog(
    orgId: number,
    userId: number,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await executeRun(
        `INSERT INTO audit_logs (organization_id, user_id, action, details, created_at)
         VALUES (?, ?, ?, ?, ${sqlNow()})`,
        [orgId, userId, action, JSON.stringify(details)]
      );
    } catch (error) {
      // Don't let audit log failures break the runbook
      logger.log(LogLevel.WARN, EventType.ERROR, `[Self-Healing] Failed to write audit log: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  /**
   * Find a matching runbook for a given trigger.
   */
  static findRunbook(trigger: string, customRunbooks: Runbook[] = []): Runbook | null {
    const allRunbooks = [...customRunbooks, ...DEFAULT_RUNBOOKS];
    return allRunbooks.find((rb) => rb.trigger === trigger && rb.enabled) || null;
  }

  /**
   * Determine the trigger type from an alert.
   */
  static determineTrigger(alert: { severity: string; title: string; metric_name: string | null; tags: Record<string, string> }): string {
    const titleLower = alert.title.toLowerCase();
    const metricLower = (alert.metric_name || '').toLowerCase();

    // Service down
    if (titleLower.includes('down') || titleLower.includes('unreachable') || titleLower.includes('unavailable')) {
      return 'service_down';
    }

    // High memory
    if (titleLower.includes('memory') || metricLower.includes('memory') || metricLower.includes('mem')) {
      return 'high_memory';
    }

    // High CPU
    if (titleLower.includes('cpu') || metricLower.includes('cpu')) {
      return 'high_cpu';
    }

    // DB connection issues
    if (titleLower.includes('database') || titleLower.includes('db') || titleLower.includes('connection') || titleLower.includes('postgres')) {
      return 'db_connection_error';
    }

    // Security
    if (titleLower.includes('security') || titleLower.includes('breach') || titleLower.includes('intrusion') || titleLower.includes('unauthorized')) {
      return 'security_breach';
    }

    return 'unknown';
  }
}
