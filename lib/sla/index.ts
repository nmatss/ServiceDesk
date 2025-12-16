import db from '../db/connection';
import { SLAPolicy, SLATracking, CreateSLAPolicy } from '../types/database';
import logger from '../monitoring/structured-logger';
import { triggerSLABreach, triggerSLAWarning } from '../automations';

// Tipos estendidos para SLA (baseados no schema do banco)
interface ExtendedSLAPolicy extends SLAPolicy {
  response_time_minutes?: number;
  resolution_time_minutes?: number;
  escalation_time_minutes?: number;
}

interface ExtendedSLATracking extends SLATracking {
  title?: string;
  user_id?: number;
  sla_name?: string;
  first_response_at?: string;
}

interface TicketWithAssignment {
  id: number;
  user_id: number;
  assigned_to?: number;
  user_name: string;
  agent_name?: string;
}

interface SLAMetrics {
  total_tickets: number;
  response_met_count: number;
  resolution_met_count: number;
  avg_response_time: number | null;
  avg_resolution_time: number | null;
  response_breaches: number;
  resolution_breaches: number;
  response_compliance_percentage: number;
  resolution_compliance_percentage: number;
}

// Tipos para configuração de SLA
interface BusinessConfig {
  startHour: number;
  endHour: number;
  workDays: number[];
  timezone: string;
}

interface SLAConfig {
  businessConfig: BusinessConfig;
  holidays: string[];
}

// Cache simples em memória para evitar hits excessivos no banco
let configCache: {
  data: SLAConfig;
  expiresAt: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Configuração padrão (Fallback)
const DEFAULT_BUSINESS_CONFIG = {
  startHour: 9,
  endHour: 18,
  workDays: [1, 2, 3, 4, 5], // Seg-Sex
  timezone: 'America/Sao_Paulo'
};

const DEFAULT_HOLIDAYS = [
  '2024-01-01', '2024-12-25' // Minimo de feriados padrão
];

/**
 * Carrega configurações do SLA do banco (system_settings)
 */
function getSLAConfig(): SLAConfig {
  const now = Date.now();
  if (configCache && configCache.expiresAt > now) {
    return configCache.data;
  }

  try {
    const businessConfigRow = db.prepare("SELECT value FROM system_settings WHERE key = 'sla_business_hours'").get() as { value: string } | undefined;
    const holidaysRow = db.prepare("SELECT value FROM system_settings WHERE key = 'sla_holidays'").get() as { value: string } | undefined;

    const businessConfig: BusinessConfig = businessConfigRow ? JSON.parse(businessConfigRow.value) : DEFAULT_BUSINESS_CONFIG;
    const holidays: string[] = holidaysRow ? JSON.parse(holidaysRow.value) : DEFAULT_HOLIDAYS;

    const config: SLAConfig = { businessConfig, holidays };

    configCache = {
      data: config,
      expiresAt: now + CACHE_TTL_MS
    };

    return config;
  } catch (error) {
    logger.error('Error loading SLA config from DB, using defaults', error);
    return { businessConfig: DEFAULT_BUSINESS_CONFIG, holidays: DEFAULT_HOLIDAYS };
  }
}

function isHoliday(date: Date): boolean {
  const { holidays } = getSLAConfig();
  const dateString = date.toISOString().split('T')[0] || '';
  return holidays.includes(dateString);
}

/**
 * Verifica se estamos dentro do horário comercial
 */
export function isBusinessHours(date: Date = new Date()): boolean {
  const { businessConfig } = getSLAConfig();
  const hour = date.getHours();
  const day = date.getDay();

  const isWorkDay = businessConfig.workDays.includes(day);
  const isBusinessHour = hour >= businessConfig.startHour && hour < businessConfig.endHour;
  const isNotHoliday = !isHoliday(date);

  return isWorkDay && isBusinessHour && isNotHoliday;
}

/**
 * Calcula o próximo horário comercial
 */
export function getNextBusinessHour(date: Date = new Date()): Date {
  const { businessConfig } = getSLAConfig();
  let nextDate = new Date(date);

  // Avança até encontrar um dia útil
  while (true) {
    const day = nextDate.getDay();
    const isWorkDay = businessConfig.workDays.includes(day);
    const isNotHoliday = !isHoliday(nextDate);

    // Se é dia útil e não é feriado
    if (isWorkDay && isNotHoliday) {
      // Se for antes do início do expediente, ajusta para o início
      if (nextDate.getHours() < businessConfig.startHour) {
        nextDate.setHours(businessConfig.startHour, 0, 0, 0);
        return nextDate;
      }
      // Se for durante o expediente, retorna a própria data (se não foi modificado pelo loop)
      if (nextDate.getHours() < businessConfig.endHour) {
        return nextDate;
      }
      // Se passou do expediente, vai para o próximo dia (loop continua)
    }

    // Avança para o próximo dia às 9h
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(businessConfig.startHour, 0, 0, 0);
  }
}

/**
 * Adiciona minutos considerando horário comercial
 */
export function addBusinessMinutes(startDate: Date, minutes: number): Date {
  const { businessConfig } = getSLAConfig();
  let currentDate = new Date(startDate);

  // Se começar fora do horário comercial, avança para o próximo
  if (!isBusinessHours(currentDate)) {
    currentDate = getNextBusinessHour(currentDate);
  }

  let remainingMinutes = minutes;

  while (remainingMinutes > 0) {
    const endOfBusinessDay = new Date(currentDate);
    endOfBusinessDay.setHours(businessConfig.endHour, 0, 0, 0);

    const minutesUntilEndOfDay = Math.floor((endOfBusinessDay.getTime() - currentDate.getTime()) / (1000 * 60));

    if (minutesUntilEndOfDay > remainingMinutes) {
      currentDate.setMinutes(currentDate.getMinutes() + remainingMinutes);
      return currentDate;
    }

    // Consome o resto do dia
    remainingMinutes -= minutesUntilEndOfDay;

    // Avança para o próximo dia útil
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate = getNextBusinessHour(currentDate);
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
    const extendedPolicy = slaPolicy as ExtendedSLAPolicy;

    // Calcula os prazos
    let responseDue: Date;
    let resolutionDue: Date;
    let escalationDue: Date | null = null;

    // Converte horas para minutos se necessário
    const responseMinutes = extendedPolicy.response_time_minutes || slaPolicy.response_time_hours * 60;
    const resolutionMinutes = extendedPolicy.resolution_time_minutes || slaPolicy.resolution_time_hours * 60;

    if (slaPolicy.business_hours_only) {
      responseDue = addBusinessMinutes(now, responseMinutes);
      resolutionDue = addBusinessMinutes(now, resolutionMinutes);
      if (extendedPolicy.escalation_time_minutes) {
        escalationDue = addBusinessMinutes(now, extendedPolicy.escalation_time_minutes);
      }
    } else {
      responseDue = new Date(now.getTime() + responseMinutes * 60000);
      resolutionDue = new Date(now.getTime() + resolutionMinutes * 60000);
      if (extendedPolicy.escalation_time_minutes) {
        escalationDue = new Date(now.getTime() + extendedPolicy.escalation_time_minutes * 60000);
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
export function checkSLABreaches(): ExtendedSLATracking[] {
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

    return query.all(now, now) as ExtendedSLATracking[];
  } catch (error) {
    logger.error('Error checking SLA breaches', error);
    return [];
  }
}

/**
 * Verifica tickets próximos do breach (warning)
 */
export function checkSLAWarnings(warningMinutes: number = 30): ExtendedSLATracking[] {
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
    return query.all(warningTime, now, warningTime, now) as ExtendedSLATracking[];
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
    `).get(ticketId) as TicketWithAssignment | undefined;

    if (!ticket) return false;

    // Busca um admin ou supervisor para escalar
    const supervisor = db.prepare(`
      SELECT id FROM users
      WHERE role = 'admin'
      ORDER BY id
      LIMIT 1
    `).get() as { id: number } | undefined;

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
export function getSLAMetrics(startDate?: string, endDate?: string): SLAMetrics | null {
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

    const rawMetrics = metricsQuery.get(...params) as Omit<SLAMetrics, 'response_compliance_percentage' | 'resolution_compliance_percentage'> | undefined;

    if (!rawMetrics) return null;

    const metrics: Omit<SLAMetrics, 'response_compliance_percentage' | 'resolution_compliance_percentage'> = rawMetrics;

    // Calcula percentuais
    const responseCompliance = metrics.total_tickets > 0
      ? (metrics.response_met_count / metrics.total_tickets) * 100
      : 0;

    const resolutionCompliance = metrics.total_tickets > 0
      ? (metrics.resolution_met_count / metrics.total_tickets) * 100
      : 0;

    const result: SLAMetrics = {
      ...metrics,
      response_compliance_percentage: Math.round(responseCompliance * 100) / 100,
      resolution_compliance_percentage: Math.round(resolutionCompliance * 100) / 100
    };

    return result;
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
    const extendedPolicy = policy as CreateSLAPolicy & { escalation_time_minutes?: number };

    const insertQuery = db.prepare(`
      INSERT INTO sla_policies (
        name, description, priority_id, category_id,
        response_time_minutes, resolution_time_minutes, escalation_time_minutes,
        business_hours_only, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Converte horas para minutos para armazenamento
    const responseMinutes = policy.response_time_hours * 60;
    const resolutionMinutes = policy.resolution_time_hours * 60;

    const result = insertQuery.run(
      policy.name,
      policy.description || null,
      policy.priority_id,
      policy.category_id || null,
      responseMinutes,
      resolutionMinutes,
      extendedPolicy.escalation_time_minutes || null,
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
      // Dispara automação
      triggerSLAWarning(tracking.ticket_id, tracking);

      // Cria notificação de warning
      const insertNotification = db.prepare(`
        INSERT INTO notifications (
          user_id, ticket_id, type, title, message, is_read, sent_via_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const message = !tracking.first_response_at
        ? `Ticket #${tracking.ticket_id} próximo do prazo de primeira resposta`
        : `Ticket #${tracking.ticket_id} próximo do prazo de resolução`;

      insertNotification.run(
        tracking.user_id,
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
      // Dispara automação
      triggerSLABreach(tracking.ticket_id, tracking);

      // Escala automaticamente tickets com breach
      const reason = !tracking.first_response_at
        ? 'SLA de primeira resposta violado'
        : 'SLA de resolução violado';

      escalateTicket(tracking.ticket_id, reason, 'sla_breach');
    });

    logger.info(`SLA Monitoring: ${warnings.length} warnings, ${breaches.length} breaches processed`);
  } catch (error) {
    logger.error('Error in SLA monitoring', error);
  }
}

/**
 * Busca tickets com SLA em risco usando as novas colunas da tabela tickets
 */
export function getTicketsAtRisk(): any[] {
  try {
    const query = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.sla_deadline,
        t.sla_status,
        t.sla_policy_id,
        t.escalation_level,
        t.created_at,
        u.name as user_name,
        u.email as user_email,
        a.name as assigned_agent_name,
        p.name as priority_name,
        p.level as priority_level,
        c.name as category_name,
        s.name as status_name,
        sp.name as sla_policy_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_policies sp ON t.sla_policy_id = sp.id
      WHERE t.sla_status = 'at_risk'
        AND s.is_final = 0
      ORDER BY t.sla_deadline ASC
    `);

    return query.all();
  } catch (error) {
    logger.error('Error getting tickets at risk', error);
    return [];
  }
}

/**
 * Busca tickets com SLA violado usando as novas colunas da tabela tickets
 */
export function getTicketsBreached(): any[] {
  try {
    const query = db.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.sla_deadline,
        t.sla_status,
        t.sla_policy_id,
        t.escalation_level,
        t.created_at,
        u.name as user_name,
        u.email as user_email,
        a.name as assigned_agent_name,
        p.name as priority_name,
        p.level as priority_level,
        c.name as category_name,
        s.name as status_name,
        sp.name as sla_policy_name,
        CAST((julianday('now') - julianday(t.sla_deadline)) * 24 * 60 AS INTEGER) as breach_minutes
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN sla_policies sp ON t.sla_policy_id = sp.id
      WHERE t.sla_status = 'breached'
        AND s.is_final = 0
      ORDER BY t.sla_deadline ASC
    `);

    return query.all();
  } catch (error) {
    logger.error('Error getting breached tickets', error);
    return [];
  }
}

/**
 * Atualiza o status SLA de um ticket
 */
export function updateTicketSLAStatus(ticketId: number): boolean {
  try {
    const updateQuery = db.prepare(`
      UPDATE tickets
      SET sla_status = CASE
        WHEN sla_deadline IS NULL THEN NULL
        WHEN datetime('now') > datetime(sla_deadline) THEN 'breached'
        WHEN datetime('now') > datetime(sla_deadline, '-30 minutes') THEN 'at_risk'
        ELSE 'on_track'
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = updateQuery.run(ticketId);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error updating ticket SLA status', error);
    return false;
  }
}

/**
 * Atribui política de SLA a um ticket
 */
export function assignSLAPolicyToTicket(ticketId: number, policyId: number): boolean {
  try {
    const policy = db.prepare('SELECT * FROM sla_policies WHERE id = ? AND is_active = 1')
      .get(policyId) as SLAPolicy | undefined;

    if (!policy) {
      logger.error('SLA policy not found or inactive', { policyId });
      return false;
    }

    const ticket = db.prepare('SELECT created_at FROM tickets WHERE id = ?')
      .get(ticketId) as { created_at: string } | undefined;

    if (!ticket) {
      logger.error('Ticket not found', { ticketId });
      return false;
    }

    const createdAt = new Date(ticket.created_at);
    const resolutionMinutes = policy.resolution_time_hours * 60;
    const deadline = policy.business_hours_only
      ? addBusinessMinutes(createdAt, resolutionMinutes)
      : new Date(createdAt.getTime() + resolutionMinutes * 60000);

    const updateQuery = db.prepare(`
      UPDATE tickets
      SET
        sla_policy_id = ?,
        sla_deadline = ?,
        sla_status = 'on_track',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = updateQuery.run(policyId, deadline.toISOString(), ticketId);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error assigning SLA policy to ticket', error);
    return false;
  }
}