import db from '../db/connection';
import { SLAPolicy, SLATracking, CreateSLAPolicy, CreateSLATracking, CreateEscalation, CreateNotification } from '../types/database';
import { logger } from '../monitoring/logger';

/**
 * Verifica se estamos dentro do horário comercial
 */
export function isBusinessHours(date: Date = new Date()): boolean {
  const hour = date.getHours();
  const day = date.getDay();

  // 0 = domingo, 6 = sábado
  const isWeekday = day >= 1 && day <= 5;
  const isBusinessHour = hour >= 9 && hour < 18;

  return isWeekday && isBusinessHour;
}

/**
 * Calcula o próximo horário comercial
 */
export function getNextBusinessHour(date: Date = new Date()): Date {
  const nextDate = new Date(date);

  // Se for fim de semana, vai para segunda
  if (nextDate.getDay() === 0) { // Domingo
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(9, 0, 0, 0);
  } else if (nextDate.getDay() === 6) { // Sábado
    nextDate.setDate(nextDate.getDate() + 2);
    nextDate.setHours(9, 0, 0, 0);
  }
  // Se for depois das 18h, vai para o próximo dia útil às 9h
  else if (nextDate.getHours() >= 18) {
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(9, 0, 0, 0);
  }
  // Se for antes das 9h, vai para as 9h do mesmo dia
  else if (nextDate.getHours() < 9) {
    nextDate.setHours(9, 0, 0, 0);
  }

  return nextDate;
}

/**
 * Adiciona minutos considerando horário comercial
 */
export function addBusinessMinutes(startDate: Date, minutes: number): Date {
  let currentDate = new Date(startDate);
  let remainingMinutes = minutes;

  while (remainingMinutes > 0) {
    if (!isBusinessHours(currentDate)) {
      currentDate = getNextBusinessHour(currentDate);
      continue;
    }

    const endOfBusinessDay = new Date(currentDate);
    endOfBusinessDay.setHours(18, 0, 0, 0);

    const minutesUntilEndOfDay = Math.floor((endOfBusinessDay.getTime() - currentDate.getTime()) / (1000 * 60));
    const minutesToAdd = Math.min(remainingMinutes, minutesUntilEndOfDay);

    currentDate.setMinutes(currentDate.getMinutes() + minutesToAdd);
    remainingMinutes -= minutesToAdd;

    if (remainingMinutes > 0) {
      // Vai para o próximo dia útil
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate = getNextBusinessHour(currentDate);
    }
  }

  return currentDate;
}

/**
 * Busca política de SLA aplicável para um ticket
 */
export function findApplicableSLAPolicy(priorityId: number, categoryId?: number): SLAPolicy | null {
  try {
    // Primeiro tenta encontrar uma política específica para categoria e prioridade
    if (categoryId) {
      const specificPolicy = db.prepare(`
        SELECT * FROM sla_policies
        WHERE is_active = 1
          AND priority_id = ?
          AND category_id = ?
        ORDER BY id
        LIMIT 1
      `).get(priorityId, categoryId) as SLAPolicy;

      if (specificPolicy) return specificPolicy;
    }

    // Senão, busca política geral para a prioridade
    const generalPolicy = db.prepare(`
      SELECT * FROM sla_policies
      WHERE is_active = 1
        AND priority_id = ?
        AND category_id IS NULL
      ORDER BY id
      LIMIT 1
    `).get(priorityId) as SLAPolicy;

    return generalPolicy || null;
  } catch (error) {
    logger.error('Error finding SLA policy', error);
    return null;
  }
}

/**
 * Cria tracking de SLA para um ticket
 */
export function createSLATracking(ticketId: number, slaPolicy: SLAPolicy, ticketCreatedAt: Date): boolean {
  try {
    const now = new Date(ticketCreatedAt);

    // Calcula os prazos
    let responseDue: Date;
    let resolutionDue: Date;
    let escalationDue: Date | null = null;

    if (slaPolicy.business_hours_only) {
      responseDue = addBusinessMinutes(now, slaPolicy.response_time_hours * 60);
      resolutionDue = addBusinessMinutes(now, slaPolicy.resolution_time_hours * 60);
      if ((slaPolicy as any).escalation_time_minutes) {
        escalationDue = addBusinessMinutes(now, (slaPolicy as any).escalation_time_minutes);
      }
    } else {
      responseDue = new Date(now.getTime() + slaPolicy.response_time_hours * 60 * 60000);
      resolutionDue = new Date(now.getTime() + slaPolicy.resolution_time_hours * 60 * 60000);
      if ((slaPolicy as any).escalation_time_minutes) {
        escalationDue = new Date(now.getTime() + (slaPolicy as any).escalation_time_minutes * 60000);
      }
    }

    const insertTracking = db.prepare(`
      INSERT INTO sla_tracking (
        ticket_id, sla_policy_id, response_due_at, resolution_due_at, escalation_due_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertTracking.run(
      ticketId,
      slaPolicy.id,
      responseDue.toISOString(),
      resolutionDue.toISOString(),
      escalationDue?.toISOString() || null
    );

    return result.changes > 0;
  } catch (error) {
    logger.error('Error creating SLA tracking', error);
    return false;
  }
}

/**
 * Verifica tickets com SLA em risco
 */
export function checkSLABreaches(): SLATracking[] {
  try {
    const now = new Date().toISOString();

    const query = db.prepare(`
      SELECT st.*, t.title, t.user_id, sp.name as sla_name
      FROM sla_tracking st
      JOIN tickets t ON st.ticket_id = t.id
      JOIN sla_policies sp ON st.sla_policy_id = sp.id
      JOIN statuses s ON t.status_id = s.id
      WHERE s.is_final = 0
        AND (
          (st.response_due_at <= ? AND st.response_met = 0)
          OR
          (st.resolution_due_at <= ? AND st.resolution_met = 0)
        )
    `);

    return query.all(now, now) as SLATracking[];
  } catch (error) {
    logger.error('Error checking SLA breaches', error);
    return [];
  }
}

/**
 * Verifica tickets próximos do breach (warning)
 */
export function checkSLAWarnings(warningMinutes: number = 30): SLATracking[] {
  try {
    const warningTime = new Date(Date.now() + warningMinutes * 60000).toISOString();

    const query = db.prepare(`
      SELECT st.*, t.title, t.user_id, sp.name as sla_name
      FROM sla_tracking st
      JOIN tickets t ON st.ticket_id = t.id
      JOIN sla_policies sp ON st.sla_policy_id = sp.id
      JOIN statuses s ON t.status_id = s.id
      WHERE s.is_final = 0
        AND (
          (st.response_due_at <= ? AND st.response_due_at > ? AND st.response_met = 0)
          OR
          (st.resolution_due_at <= ? AND st.resolution_due_at > ? AND st.resolution_met = 0)
        )
    `);

    const now = new Date().toISOString();
    return query.all(warningTime, now, warningTime, now) as SLATracking[];
  } catch (error) {
    logger.error('Error checking SLA warnings', error);
    return [];
  }
}

/**
 * Marca primeira resposta como atendida
 */
export function markFirstResponse(ticketId: number, responseTime: number): boolean {
  try {
    const updateQuery = db.prepare(`
      UPDATE sla_tracking
      SET
        response_met = 1,
        response_time_minutes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ? AND response_met = 0
    `);

    const result = updateQuery.run(responseTime, ticketId);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error marking first response', error);
    return false;
  }
}

/**
 * Marca ticket como resolvido
 */
export function markResolution(ticketId: number, resolutionTime: number): boolean {
  try {
    const updateQuery = db.prepare(`
      UPDATE sla_tracking
      SET
        resolution_met = 1,
        resolution_time_minutes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ? AND resolution_met = 0
    `);

    const result = updateQuery.run(resolutionTime, ticketId);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error marking resolution', error);
    return false;
  }
}

/**
 * Escala um ticket automaticamente
 */
export function escalateTicket(ticketId: number, reason: string, escalationType: 'sla_breach' | 'manual' | 'priority_change' = 'sla_breach'): boolean {
  try {
    // Busca ticket e agente supervisor
    const ticket = db.prepare(`
      SELECT t.*, u.name as user_name, a.name as agent_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      WHERE t.id = ?
    `).get(ticketId) as any;

    if (!ticket) return false;

    // Busca um admin ou supervisor para escalar
    const supervisor = db.prepare(`
      SELECT id FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `).get() as { id: number };

    if (!supervisor) return false;

    // Cria a escalação
    const insertEscalation = db.prepare(`
      INSERT INTO escalations (
        ticket_id, escalation_type, escalated_from, escalated_to, reason
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const escalationResult = insertEscalation.run(
      ticketId,
      escalationType,
      ticket.assigned_to || null,
      supervisor.id,
      reason
    );

    // Atualiza o ticket para o supervisor
    const updateTicket = db.prepare(`
      UPDATE tickets
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateTicket.run(supervisor.id, ticketId);

    // Cria notificação para o supervisor
    const insertNotification = db.prepare(`
      INSERT INTO notifications (
        user_id, ticket_id, type, title, message, is_read, sent_via_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertNotification.run(
      supervisor.id,
      ticketId,
      'escalation',
      'Ticket Escalado',
      `Ticket #${ticketId} foi escalado: ${reason}`,
      false,
      true
    );

    return escalationResult.changes > 0;
  } catch (error) {
    logger.error('Error escalating ticket', error);
    return false;
  }
}

/**
 * Calcula métricas de SLA
 */
export function getSLAMetrics(startDate?: string, endDate?: string): any {
  try {
    const whereClause = startDate && endDate
      ? 'WHERE st.created_at BETWEEN ? AND ?'
      : '';

    const params = startDate && endDate ? [startDate, endDate] : [];

    const metricsQuery = db.prepare(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN st.response_met = 1 THEN 1 END) as response_met_count,
        COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) as resolution_met_count,
        AVG(CASE WHEN st.response_met = 1 THEN st.response_time_minutes END) as avg_response_time,
        AVG(CASE WHEN st.resolution_met = 1 THEN st.resolution_time_minutes END) as avg_resolution_time,
        COUNT(CASE WHEN st.response_due_at < CURRENT_TIMESTAMP AND st.response_met = 0 THEN 1 END) as response_breaches,
        COUNT(CASE WHEN st.resolution_due_at < CURRENT_TIMESTAMP AND st.resolution_met = 0 THEN 1 END) as resolution_breaches
      FROM sla_tracking st
      ${whereClause}
    `);

    const metrics = metricsQuery.get(...params) as any;

    // Calcula percentuais
    const responseCompliance = metrics.total_tickets > 0
      ? (metrics.response_met_count / metrics.total_tickets) * 100
      : 0;

    const resolutionCompliance = metrics.total_tickets > 0
      ? (metrics.resolution_met_count / metrics.total_tickets) * 100
      : 0;

    return {
      ...metrics,
      response_compliance_percentage: Math.round(responseCompliance * 100) / 100,
      resolution_compliance_percentage: Math.round(resolutionCompliance * 100) / 100
    };
  } catch (error) {
    logger.error('Error getting SLA metrics', error);
    return null;
  }
}

/**
 * Busca todas as políticas de SLA
 */
export function getAllSLAPolicies(): SLAPolicy[] {
  try {
    return db.prepare(`
      SELECT sp.*, p.name as priority_name, c.name as category_name
      FROM sla_policies sp
      LEFT JOIN priorities p ON sp.priority_id = p.id
      LEFT JOIN categories c ON sp.category_id = c.id
      ORDER BY sp.priority_id DESC, sp.created_at DESC
    `).all() as SLAPolicy[];
  } catch (error) {
    logger.error('Error getting SLA policies', error);
    return [];
  }
}

/**
 * Cria nova política de SLA
 */
export function createSLAPolicy(policy: CreateSLAPolicy): SLAPolicy | null {
  try {
    const insertQuery = db.prepare(`
      INSERT INTO sla_policies (
        name, description, priority_id, category_id,
        response_time_minutes, resolution_time_minutes, escalation_time_minutes,
        business_hours_only, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertQuery.run(
      policy.name,
      policy.description || null,
      policy.priority_id,
      policy.category_id || null,
      policy.response_time_hours,
      policy.resolution_time_hours,
      (policy as any).escalation_time_minutes || null,
      policy.business_hours_only ? 1 : 0,
      policy.is_active ? 1 : 0
    );

    if (result.lastInsertRowid) {
      return db.prepare('SELECT * FROM sla_policies WHERE id = ?')
        .get(result.lastInsertRowid) as SLAPolicy;
    }

    return null;
  } catch (error) {
    logger.error('Error creating SLA policy', error);
    return null;
  }
}

/**
 * Processo de monitoramento contínuo de SLA
 */
export function processSLAMonitoring(): void {
  try {
    // Verifica warnings
    const warnings = checkSLAWarnings(30); // 30 minutos antes
    warnings.forEach(tracking => {
      // Cria notificação de warning
      const insertNotification = db.prepare(`
        INSERT INTO notifications (
          user_id, ticket_id, type, title, message, is_read, sent_via_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const message = !(tracking as any).first_response_at
        ? `Ticket #${tracking.ticket_id} próximo do prazo de primeira resposta`
        : `Ticket #${tracking.ticket_id} próximo do prazo de resolução`;

      insertNotification.run(
        (tracking as any).user_id,
        tracking.ticket_id,
        'sla_warning',
        'Aviso de SLA',
        message,
        false,
        true
      );
    });

    // Verifica breaches
    const breaches = checkSLABreaches();
    breaches.forEach(tracking => {
      // Escala automaticamente tickets com breach
      const reason = !(tracking as any).first_response_at
        ? 'SLA de primeira resposta violado'
        : 'SLA de resolução violado';

      escalateTicket(tracking.ticket_id, reason, 'sla_breach');
    });

    logger.info(`SLA Monitoring: ${warnings.length} warnings, ${breaches.length} breaches processed`);
  } catch (error) {
    logger.error('Error in SLA monitoring', error);
  }
}