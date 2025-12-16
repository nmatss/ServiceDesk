import { workflowEngine } from './engine';
import db from '../db/connection';
import logger from '../monitoring/structured-logger';

export class WorkflowScheduler {
  private intervals: Map<number, NodeJS.Timeout> = new Map();
  private isRunningWorkflows = false;
  private isRunningSLA = false;

  /**
   * Inicia scheduler para workflows time-based
   */
  start(): void {
    // Usar async loop em vez de setInterval
    this.runWorkflowLoop();
    this.runSLALoop();

    logger.info('Workflow scheduler started');
  }

  /**
   * Loop assíncrono para verificar workflows
   */
  private async runWorkflowLoop(): Promise<void> {
    while (true) {
      if (!this.isRunningWorkflows) {
        this.isRunningWorkflows = true;
        try {
          await this.checkTimeBasedWorkflows();
        } catch (error) {
          logger.error('Error in workflow loop', error);
        } finally {
          this.isRunningWorkflows = false;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 60 * 1000)); // 1 minuto
    }
  }

  /**
   * Loop assíncrono para verificar SLAs
   */
  private async runSLALoop(): Promise<void> {
    while (true) {
      if (!this.isRunningSLA) {
        this.isRunningSLA = true;
        try {
          await this.checkSLAWarnings();
        } catch (error) {
          logger.error('Error in SLA loop', error);
        } finally {
          this.isRunningSLA = false;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // 5 minutos
    }
  }

  /**
   * Verifica workflows que devem ser executados
   */
  private async checkTimeBasedWorkflows(): Promise<void> {
    const workflows = db.prepare(`
      SELECT * FROM workflows
      WHERE is_active = 1 AND trigger_type = 'time_based'
    `).all() as any[];

    for (const workflow of workflows) {
      try {
        const conditions = JSON.parse(workflow.trigger_conditions || '{}');

        if (this.shouldExecuteNow(conditions)) {
          await workflowEngine.executeWorkflow(
            workflow.id,
            {
              type: 'time_based',
              entityType: 'system',
              entityId: 0,
              data: { timestamp: new Date().toISOString() }
            },
            workflow.organization_id
          );
        }
      } catch (error) {
        logger.error(`Error checking workflow ${workflow.id}:`, error);
      }
    }
  }

  /**
   * Verifica se workflow deve ser executado agora
   */
  private shouldExecuteNow(conditions: any): boolean {
    const now = new Date();
    const { schedule } = conditions;

    if (!schedule) return false;

    // Daily schedule
    if (schedule.type === 'daily') {
      const targetHour = parseInt(schedule.hour || '0');
      const targetMinute = parseInt(schedule.minute || '0');

      return now.getHours() === targetHour && now.getMinutes() === targetMinute;
    }

    // Weekly schedule
    if (schedule.type === 'weekly') {
      const targetDay = parseInt(schedule.day_of_week || '1'); // 0 = Sunday
      const targetHour = parseInt(schedule.hour || '0');

      return now.getDay() === targetDay && now.getHours() === targetHour;
    }

    // Interval-based
    if (schedule.type === 'interval') {
      const intervalMinutes = parseInt(schedule.interval_minutes || '60');
      const lastRun = new Date(conditions.last_run || 0);
      const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / (60 * 1000);

      return minutesSinceLastRun >= intervalMinutes;
    }

    return false;
  }

  /**
   * Verifica SLAs próximos de vencimento
   */
  private async checkSLAWarnings(): Promise<void> {
    // Tickets com SLA de resposta próximo de vencer (< 2h)
    const responseDueSoon = db.prepare(`
      SELECT
        st.*,
        t.id as ticket_id,
        t.organization_id,
        t.assigned_to,
        ROUND((julianday(st.response_due_at) - julianday('now')) * 24 * 60) as minutes_until_breach
      FROM sla_tracking st
      INNER JOIN tickets t ON st.ticket_id = t.id
      WHERE st.response_met = 0
        AND st.response_due_at BETWEEN datetime('now') AND datetime('now', '+2 hours')
        AND t.status_id NOT IN (SELECT id FROM statuses WHERE is_final = 1)
    `).all() as any[];

    for (const sla of responseDueSoon) {
      await this.triggerSLAWarning(sla, 'response');
    }

    // Tickets com SLA de resolução próximo de vencer (< 4h)
    const resolutionDueSoon = db.prepare(`
      SELECT
        st.*,
        t.id as ticket_id,
        t.organization_id,
        t.assigned_to,
        ROUND((julianday(st.resolution_due_at) - julianday('now')) * 24 * 60) as minutes_until_breach
      FROM sla_tracking st
      INNER JOIN tickets t ON st.ticket_id = t.id
      WHERE st.resolution_met = 0
        AND st.resolution_due_at BETWEEN datetime('now') AND datetime('now', '+4 hours')
        AND t.status_id NOT IN (SELECT id FROM statuses WHERE is_final = 1)
    `).all() as any[];

    for (const sla of resolutionDueSoon) {
      await this.triggerSLAWarning(sla, 'resolution');
    }
  }

  /**
   * Dispara workflow de SLA warning
   */
  private async triggerSLAWarning(sla: any, type: 'response' | 'resolution'): Promise<void> {
    // Buscar workflow de SLA warning
    const workflow = db.prepare(`
      SELECT * FROM workflows
      WHERE trigger_type = 'sla_warning'
        AND is_active = 1
        AND organization_id = ?
      LIMIT 1
    `).get(sla.organization_id) as any;

    if (!workflow) {
      // Escalação padrão se não houver workflow
      await this.defaultSLAEscalation(sla, type);
      return;
    }

    // Executar workflow
    await workflowEngine.executeWorkflow(
      workflow.id,
      {
        type: 'sla_warning',
        entityType: 'ticket',
        entityId: sla.ticket_id,
        data: {
          sla_type: type,
          minutes_until_breach: sla.minutes_until_breach,
          sla_due_at: type === 'response' ? sla.response_due_at : sla.resolution_due_at
        }
      },
      sla.organization_id
    );
  }

  /**
   * Escalação padrão de SLA
   */
  private async defaultSLAEscalation(sla: any, type: string): Promise<void> {
    // Enviar notificação para agente
    if (sla.assigned_to) {
      db.prepare(`
        INSERT INTO notifications (
          user_id, ticket_id, type, title, message, organization_id
        ) VALUES (?, ?, 'sla_warning', ?, ?, ?)
      `).run(
        sla.assigned_to,
        sla.ticket_id,
        'SLA Warning',
        `Ticket #${sla.ticket_id} SLA ${type} vence em ${sla.minutes_until_breach} minutos`,
        sla.organization_id
      );
    }

    // Se < 30 minutos, escalar para manager
    if (sla.minutes_until_breach < 30) {
      const manager = db.prepare(`
        SELECT id FROM users
        WHERE organization_id = ? AND role = 'manager'
        LIMIT 1
      `).get(sla.organization_id) as any;

      if (manager) {
        db.prepare(`
          INSERT INTO escalations (
            ticket_id, escalation_type, escalated_to, reason, organization_id
          ) VALUES (?, 'sla_breach', ?, ?, ?)
        `).run(
          sla.ticket_id,
          manager.id,
          `SLA ${type} breach imminent`,
          sla.organization_id
        );
      }
    }
  }

  /**
   * Para o scheduler
   */
  stop(): void {
    for (const [, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    logger.info('Workflow scheduler stopped');
  }
}

export const workflowScheduler = new WorkflowScheduler();
