/**
 * Auto Documenter — Self-Healing Module
 *
 * Automatically creates/updates tickets and comments documenting
 * self-healing events, runbook executions, and verification results.
 */

import { executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';
import type { NormalizedAlert } from './monitor-bridge';
import type { CorrelationResult } from './incident-correlator';
import type { ExecutionResult, StepResult } from './runbook-executor';
import type { VerificationResult } from './remediation-verifier';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelfHealingEvent {
  alert: NormalizedAlert;
  correlation: CorrelationResult;
  execution: ExecutionResult | null;
  verification: VerificationResult | null;
  guardrail_blocked?: boolean;
  guardrail_reason?: string;
}

// ─── AutoDocumenter ──────────────────────────────────────────────────────────

export class AutoDocumenter {
  /**
   * Document a self-healing event by creating or updating a ticket.
   * Returns the ticket ID.
   */
  async document(orgId: number, userId: number, event: SelfHealingEvent): Promise<number> {
    try {
      // Check if there's an existing open ticket for this CI/service
      const existingTicketId = await this.findExistingTicket(orgId, event);

      if (existingTicketId) {
        await this.addCommentToTicket(existingTicketId, orgId, userId, event);
        logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Documented event as comment on ticket #${existingTicketId}`, { orgId, ticketId: existingTicketId, alertId: event.alert.id });
        return existingTicketId;
      }

      // Create new ticket
      const ticketId = await this.createTicket(orgId, userId, event);

      // Add step-by-step comments if runbook was executed
      if (event.execution) {
        await this.addExecutionComments(ticketId, orgId, userId, event.execution);
      }

      // Add verification comment
      if (event.verification) {
        await this.addVerificationComment(ticketId, orgId, userId, event.verification);
      }

      // Link to CI if available
      if (event.correlation.ci) {
        await this.linkTicketToCI(ticketId, event.correlation.ci.id);
      }

      // Add auto-healing tag
      await this.addTag(ticketId, orgId, 'auto-healing');
      await this.addTag(ticketId, orgId, event.alert.source);

      logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Created ticket #${ticketId} for event`, { orgId, ticketId, alertId: event.alert.id });

      return ticketId;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Error documenting event: ${errMsg}`, { orgId, alertId: event.alert.id });
      throw error;
    }
  }

  /**
   * Find an existing open ticket related to this event.
   */
  private async findExistingTicket(orgId: number, event: SelfHealingEvent): Promise<number | null> {
    // Check existing tickets from correlation
    if (event.correlation.existing_tickets.length > 0) {
      const openTicket = event.correlation.existing_tickets.find(
        (t) => t.status === 'open' || t.status === 'in_progress'
      );
      if (openTicket) return openTicket.id;
    }

    return null;
  }

  /**
   * Create a new ticket for the self-healing event.
   */
  private async createTicket(orgId: number, userId: number, event: SelfHealingEvent): Promise<number> {
    const title = `[Auto-Healing] ${event.alert.title}`;
    const description = this.buildDescription(event);
    const priority = event.alert.priority;
    const status = this.determineStatus(event);
    const ticketNumber = `SH-${Date.now().toString(36).toUpperCase()}`;

    const result = await executeRun(
      `INSERT INTO tickets (
        ticket_number, title, description, priority, status,
        organization_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()})`,
      [ticketNumber, title, description, priority, status, orgId, userId]
    );

    return result.lastInsertRowid || 0;
  }

  /**
   * Build a detailed description for the ticket.
   */
  private buildDescription(event: SelfHealingEvent): string {
    const lines: string[] = [];

    lines.push('## Evento de Auto-Healing\n');
    lines.push(`**Fonte:** ${event.alert.source}`);
    lines.push(`**Severidade:** ${event.alert.severity}`);
    lines.push(`**Servico:** ${event.alert.service}`);
    lines.push(`**Horario:** ${event.alert.timestamp}`);
    lines.push('');
    lines.push(`### Descricao do Alerta\n${event.alert.description}`);

    if (event.alert.metric_name) {
      lines.push('');
      lines.push(`### Metrica`);
      lines.push(`- **Nome:** ${event.alert.metric_name}`);
      if (event.alert.threshold != null) lines.push(`- **Threshold:** ${event.alert.threshold}`);
      if (event.alert.current_value != null) lines.push(`- **Valor Atual:** ${event.alert.current_value}`);
    }

    if (event.correlation.ci) {
      lines.push('');
      lines.push('### Item de Configuracao (CI)');
      lines.push(`- **Nome:** ${event.correlation.ci.name}`);
      lines.push(`- **Numero:** ${event.correlation.ci.ci_number}`);
      lines.push(`- **Tipo:** ${event.correlation.ci.ci_type_name}`);
      lines.push(`- **Status:** ${event.correlation.ci.status_name}`);
      if (event.correlation.ci.criticality) lines.push(`- **Criticidade:** ${event.correlation.ci.criticality}`);
    }

    lines.push('');
    lines.push('### Analise de Impacto');
    lines.push(`- **Raio de Impacto:** ${event.correlation.blast_radius} CIs afetados`);
    lines.push(`- **Nivel de Risco:** ${event.correlation.risk_level}`);
    if (event.correlation.related_cis.length > 0) {
      lines.push(`- **CIs Relacionados:** ${event.correlation.related_cis.map((c) => c.name).join(', ')}`);
    }

    if (event.execution) {
      lines.push('');
      lines.push('### Remediacao Executada');
      lines.push(`- **Runbook:** ${event.execution.runbook_name}`);
      lines.push(`- **Resultado:** ${event.execution.success ? 'Sucesso' : 'Falha'}`);
      lines.push(`- **Passos:** ${event.execution.steps_completed}/${event.execution.total_steps}`);
      lines.push(`- **Duracao:** ${event.execution.duration_ms}ms`);
      if (event.execution.abort_reason) {
        lines.push(`- **Motivo da Interrupcao:** ${event.execution.abort_reason}`);
      }
    }

    if (event.guardrail_blocked) {
      lines.push('');
      lines.push('### Guardrail Acionado');
      lines.push(`Remediacao automatica bloqueada: ${event.guardrail_reason}`);
      lines.push('**Acao necessaria:** Intervencao manual requerida.');
    }

    if (event.verification) {
      lines.push('');
      lines.push('### Verificacao');
      lines.push(`- **Verificado:** ${event.verification.verified ? 'Sim' : 'Nao'}`);
      lines.push(`- **Metodo:** ${event.verification.method}`);
      lines.push(`- **Detalhes:** ${event.verification.details}`);
    }

    return lines.join('\n');
  }

  /**
   * Add a comment to an existing ticket.
   */
  private async addCommentToTicket(
    ticketId: number,
    orgId: number,
    userId: number,
    event: SelfHealingEvent
  ): Promise<void> {
    const content = this.buildCommentContent(event);

    await executeRun(
      `INSERT INTO comments (
        ticket_id, user_id, content, is_internal, created_at
      ) VALUES (?, ?, ?, 1, ${sqlNow()})`,
      [ticketId, userId, content]
    );

    // Update ticket status if remediation resolved it
    if (event.verification?.verified) {
      await executeRun(
        `UPDATE tickets SET status = 'resolved', updated_at = ${sqlNow()} WHERE id = ? AND organization_id = ?`,
        [ticketId, orgId]
      );
    }
  }

  /**
   * Build comment content for an existing ticket.
   */
  private buildCommentContent(event: SelfHealingEvent): string {
    const lines: string[] = [];
    lines.push(`**[Auto-Healing] Novo evento detectado** (${new Date().toISOString()})\n`);
    lines.push(`Alerta: ${event.alert.title} (${event.alert.severity})`);
    lines.push(`Fonte: ${event.alert.source}`);

    if (event.execution) {
      lines.push(`\nRunbook executado: ${event.execution.runbook_name}`);
      lines.push(`Resultado: ${event.execution.success ? 'Sucesso' : 'Falha'} (${event.execution.duration_ms}ms)`);
    }

    if (event.verification) {
      lines.push(`\nVerificacao: ${event.verification.verified ? 'Confirmada' : 'Nao confirmada'}`);
    }

    if (event.guardrail_blocked) {
      lines.push(`\nGuardrail acionado: ${event.guardrail_reason}`);
    }

    return lines.join('\n');
  }

  /**
   * Add runbook execution step results as individual comments.
   */
  private async addExecutionComments(
    ticketId: number,
    orgId: number,
    userId: number,
    execution: ExecutionResult
  ): Promise<void> {
    for (const step of execution.results) {
      const content = this.buildStepComment(step, execution.runbook_name);
      await executeRun(
        `INSERT INTO comments (
          ticket_id, user_id, content, is_internal, created_at
        ) VALUES (?, ?, ?, 1, ${sqlNow()})`,
        [ticketId, userId, content]
      );
    }
  }

  /**
   * Build a comment for a single step result.
   */
  private buildStepComment(step: StepResult, runbookName: string): string {
    const statusIcon = step.success ? '[OK]' : '[FALHA]';
    const lines: string[] = [];
    lines.push(`**${statusIcon} Passo ${step.step_order}: ${step.step_name}** (${step.step_type})`);
    lines.push(`Duracao: ${step.duration_ms}ms`);

    if (step.error) {
      lines.push(`Erro: ${step.error}`);
    }

    if (step.output && typeof step.output === 'object') {
      const outputStr = JSON.stringify(step.output, null, 2);
      if (outputStr.length <= 500) {
        lines.push(`Saida: ${outputStr}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Add a verification result comment.
   */
  private async addVerificationComment(
    ticketId: number,
    orgId: number,
    userId: number,
    verification: VerificationResult
  ): Promise<void> {
    const lines: string[] = [];
    lines.push(`**[Verificacao] ${verification.verified ? 'Remediacao Confirmada' : 'Remediacao Nao Confirmada'}**\n`);
    lines.push(`Metodo: ${verification.method}`);
    lines.push(`Duracao: ${verification.duration_ms}ms`);
    lines.push(`Detalhes: ${verification.details}`);

    if (verification.checks_performed.length > 0) {
      lines.push('\nVerificacoes:');
      for (const check of verification.checks_performed) {
        lines.push(`- ${check.passed ? '[OK]' : '[FALHA]'} ${check.name}: ${check.details}`);
      }
    }

    await executeRun(
      `INSERT INTO comments (
        ticket_id, user_id, content, is_internal, created_at
      ) VALUES (?, ?, ?, 1, ${sqlNow()})`,
      [ticketId, userId, lines.join('\n')]
    );
  }

  /**
   * Link a ticket to a CI.
   */
  private async linkTicketToCI(ticketId: number, ciId: number): Promise<void> {
    try {
      await executeRun(
        `INSERT INTO ci_ticket_links (ci_id, ticket_id, link_type, created_at)
         VALUES (?, ?, 'incident', ${sqlNow()})`,
        [ciId, ticketId]
      );
    } catch {
      // Link may already exist — ignore duplicate errors
    }
  }

  /**
   * Add a tag to a ticket (creates tag if not exists).
   */
  private async addTag(ticketId: number, orgId: number, tagName: string): Promise<void> {
    try {
      // Find or create tag
      let tag = await executeQueryOne<{ id: number }>(
        'SELECT id FROM tags WHERE name = ? AND organization_id = ?',
        [tagName, orgId]
      );

      if (!tag) {
        const result = await executeRun(
          `INSERT INTO tags (name, organization_id, created_at) VALUES (?, ?, ${sqlNow()})`,
          [tagName, orgId]
        );
        tag = { id: result.lastInsertRowid || 0 };
      }

      if (tag.id) {
        await executeRun(
          'INSERT INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?)',
          [ticketId, tag.id]
        );
      }
    } catch {
      // Tag may already be linked — ignore
    }
  }

  /**
   * Determine ticket status based on event outcome.
   */
  private determineStatus(event: SelfHealingEvent): string {
    if (event.guardrail_blocked) return 'open';
    if (!event.execution) return 'open';
    if (!event.execution.success) return 'open';
    if (event.verification?.verified) return 'resolved';
    return 'in_progress';
  }
}
