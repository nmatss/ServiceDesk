import db from '../db/connection';
import { Automation } from '../types/database';
import { createNotification } from '../notifications';
import { logAuditAction } from '../audit';

// Tipos para automação
interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

interface AutomationAction {
  type: 'assign_ticket' | 'change_status' | 'change_priority' | 'add_comment' | 'send_notification' | 'create_task' | 'escalate';
  parameters: Record<string, any>;
}

interface TriggerData {
  ticket_id?: number;
  user_id?: number;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  context?: Record<string, any>;
}

/**
 * Busca automações ativas por tipo de trigger
 */
export function getActiveAutomations(triggerType: string): Automation[] {
  try {
    return db.prepare(`
      SELECT * FROM automations
      WHERE trigger_type = ? AND is_active = 1
      ORDER BY created_at ASC
    `).all(triggerType) as Automation[];
  } catch (error) {
    console.error('Error getting active automations:', error);
    return [];
  }
}

/**
 * Executa automações para um trigger específico
 */
export async function executeAutomations(
  triggerType: string,
  triggerData: TriggerData
): Promise<boolean> {
  try {
    const automations = getActiveAutomations(triggerType);

    if (automations.length === 0) {
      return true;
    }

    console.log(`Executing ${automations.length} automations for trigger: ${triggerType}`);

    for (const automation of automations) {
      try {
        await executeAutomation(automation, triggerData);
      } catch (error) {
        console.error(`Error executing automation ${automation.id}:`, error);
        // Continue com outras automações mesmo se uma falhar
      }
    }

    return true;
  } catch (error) {
    console.error('Error executing automations:', error);
    return false;
  }
}

/**
 * Executa uma automação específica
 */
async function executeAutomation(
  automation: Automation,
  triggerData: TriggerData
): Promise<boolean> {
  try {
    const conditions = JSON.parse(automation.conditions);
    const actions = JSON.parse(automation.actions);

    // Verificar condições
    if (!evaluateConditions(conditions, triggerData)) {
      return false;
    }

    console.log(`Executing automation: ${automation.name}`);

    // Executar ações
    for (const action of actions) {
      await executeAction(action, triggerData);
    }

    // Atualizar contador de execução
    db.prepare(`
      UPDATE automations
      SET execution_count = execution_count + 1,
          last_executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(automation.id);

    // Log da execução
    logAuditAction({
      user_id: undefined,
      action: 'automation_executed',
      resource_type: 'automation',
      resource_id: automation.id,
      new_values: JSON.stringify({
        automation_name: automation.name,
        trigger_data: triggerData
      })
    });

    return true;
  } catch (error) {
    console.error(`Error executing automation ${automation.id}:`, error);
    return false;
  }
}

/**
 * Avalia condições da automação
 */
function evaluateConditions(
  conditions: AutomationCondition[] | { operator: 'AND' | 'OR'; conditions: AutomationCondition[] },
  triggerData: TriggerData
): boolean {
  try {
    // Se é um array simples, usar AND
    if (Array.isArray(conditions)) {
      return conditions.every(condition => evaluateCondition(condition, triggerData));
    }

    // Se tem operador lógico
    if (conditions.operator === 'AND') {
      return conditions.conditions.every(condition => evaluateCondition(condition, triggerData));
    } else if (conditions.operator === 'OR') {
      return conditions.conditions.some(condition => evaluateCondition(condition, triggerData));
    }

    return false;
  } catch (error) {
    console.error('Error evaluating conditions:', error);
    return false;
  }
}

/**
 * Avalia uma condição específica
 */
function evaluateCondition(condition: AutomationCondition, triggerData: TriggerData): boolean {
  try {
    const value = getFieldValue(condition.field, triggerData);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return false;
    }
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
}

/**
 * Busca valor de um campo nos dados do trigger
 */
function getFieldValue(field: string, triggerData: TriggerData): any {
  try {
    // Buscar em dados do ticket
    if (triggerData.ticket_id && field.startsWith('ticket.')) {
      const ticketField = field.replace('ticket.', '');
      const ticket = db.prepare(`
        SELECT t.*, c.name as category_name, p.name as priority_name, s.name as status_name
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        WHERE t.id = ?
      `).get(triggerData.ticket_id);

      return ticket ? (ticket as any)[ticketField] : null;
    }

    // Buscar em novos valores
    if (triggerData.new_values && field.startsWith('new.')) {
      const newField = field.replace('new.', '');
      return triggerData.new_values[newField];
    }

    // Buscar em valores antigos
    if (triggerData.old_values && field.startsWith('old.')) {
      const oldField = field.replace('old.', '');
      return triggerData.old_values[oldField];
    }

    // Buscar em contexto
    if (triggerData.context && field.startsWith('context.')) {
      const contextField = field.replace('context.', '');
      return triggerData.context[contextField];
    }

    // Campos especiais
    switch (field) {
      case 'user_id':
        return triggerData.user_id;
      case 'ticket_id':
        return triggerData.ticket_id;
      case 'current_time':
        return new Date().toISOString();
      case 'current_hour':
        return new Date().getHours();
      case 'current_day':
        return new Date().getDay(); // 0 = domingo, 1 = segunda, etc.
      default:
        return null;
    }
  } catch (error) {
    console.error('Error getting field value:', error);
    return null;
  }
}

/**
 * Executa uma ação específica
 */
async function executeAction(action: AutomationAction, triggerData: TriggerData): Promise<boolean> {
  try {
    switch (action.type) {
      case 'assign_ticket':
        return await assignTicket(action.parameters, triggerData);

      case 'change_status':
        return await changeTicketStatus(action.parameters, triggerData);

      case 'change_priority':
        return await changeTicketPriority(action.parameters, triggerData);

      case 'add_comment':
        return await addTicketComment(action.parameters, triggerData);

      case 'send_notification':
        return await sendNotification(action.parameters, triggerData);

      case 'escalate':
        return await escalateTicket(action.parameters, triggerData);

      default:
        console.warn(`Unknown action type: ${action.type}`);
        return false;
    }
  } catch (error) {
    console.error(`Error executing action ${action.type}:`, error);
    return false;
  }
}

/**
 * Atribui ticket a um agente
 */
async function assignTicket(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { agent_id } = parameters;
    if (!agent_id) return false;

    // Verificar se agente existe
    const agent = db.prepare('SELECT id FROM users WHERE id = ? AND role IN ("agent", "admin")').get(agent_id);
    if (!agent) return false;

    // Atualizar ticket
    db.prepare('UPDATE tickets SET assigned_to = ? WHERE id = ?').run(agent_id, triggerData.ticket_id);

    // Criar notificação
    createNotification({
      user_id: agent_id,
      ticket_id: triggerData.ticket_id,
      type: 'ticket_assigned',
      title: 'Ticket Atribuído Automaticamente',
      message: `Ticket #${triggerData.ticket_id} foi atribuído automaticamente para você`,
      is_read: false,
      sent_via_email: true
    });

    return true;
  } catch (error) {
    console.error('Error assigning ticket:', error);
    return false;
  }
}

/**
 * Altera status do ticket
 */
async function changeTicketStatus(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { status_id } = parameters;
    if (!status_id) return false;

    // Verificar se status existe
    const status = db.prepare('SELECT id FROM statuses WHERE id = ?').get(status_id);
    if (!status) return false;

    // Atualizar ticket
    db.prepare('UPDATE tickets SET status_id = ? WHERE id = ?').run(status_id, triggerData.ticket_id);

    return true;
  } catch (error) {
    console.error('Error changing ticket status:', error);
    return false;
  }
}

/**
 * Altera prioridade do ticket
 */
async function changeTicketPriority(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { priority_id } = parameters;
    if (!priority_id) return false;

    // Verificar se prioridade existe
    const priority = db.prepare('SELECT id FROM priorities WHERE id = ?').get(priority_id);
    if (!priority) return false;

    // Atualizar ticket
    db.prepare('UPDATE tickets SET priority_id = ? WHERE id = ?').run(priority_id, triggerData.ticket_id);

    return true;
  } catch (error) {
    console.error('Error changing ticket priority:', error);
    return false;
  }
}

/**
 * Adiciona comentário ao ticket
 */
async function addTicketComment(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { content, is_internal = false } = parameters;
    if (!content) return false;

    // Buscar usuário do sistema para comentários automáticos
    const systemUser = db.prepare('SELECT id FROM users WHERE role = "admin" LIMIT 1').get() as { id: number };
    if (!systemUser) return false;

    // Adicionar comentário
    db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal)
      VALUES (?, ?, ?, ?)
    `).run(triggerData.ticket_id, systemUser.id, content, is_internal ? 1 : 0);

    return true;
  } catch (error) {
    console.error('Error adding ticket comment:', error);
    return false;
  }
}

/**
 * Envia notificação
 */
async function sendNotification(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    const { user_id, title, message, send_email = true } = parameters;
    if (!user_id || !title || !message) return false;

    createNotification({
      user_id,
      ticket_id: triggerData.ticket_id,
      type: 'automation',
      title,
      message,
      is_read: false,
      sent_via_email: send_email
    });

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Escalona ticket
 */
async function escalateTicket(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { escalated_to, reason = 'Escalação automática' } = parameters;
    if (!escalated_to) return false;

    // Verificar se usuário existe
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND role IN ("agent", "admin")').get(escalated_to);
    if (!user) return false;

    // Buscar ticket atual
    const ticket = db.prepare('SELECT assigned_to FROM tickets WHERE id = ?').get(triggerData.ticket_id) as { assigned_to: number };

    // Registrar escalação
    db.prepare(`
      INSERT INTO sla_escalations (ticket_id, escalated_from, escalated_to, escalation_level, reason)
      VALUES (?, ?, ?, 1, ?)
    `).run(triggerData.ticket_id, ticket?.assigned_to || null, escalated_to, reason);

    // Atribuir ticket
    db.prepare('UPDATE tickets SET assigned_to = ? WHERE id = ?').run(escalated_to, triggerData.ticket_id);

    // Notificar novo responsável
    createNotification({
      user_id: escalated_to,
      ticket_id: triggerData.ticket_id,
      type: 'escalation',
      title: 'Ticket Escalado',
      message: `Ticket #${triggerData.ticket_id} foi escalado para você. Motivo: ${reason}`,
      is_read: false,
      sent_via_email: true
    });

    return true;
  } catch (error) {
    console.error('Error escalating ticket:', error);
    return false;
  }
}

/**
 * Triggers para eventos de ticket
 */
export async function triggerTicketCreated(ticketId: number, userId: number): Promise<boolean> {
  const ticket = db.prepare(`
    SELECT t.*, c.name as category_name, p.name as priority_name
    FROM tickets t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN priorities p ON t.priority_id = p.id
    WHERE t.id = ?
  `).get(ticketId);

  return executeAutomations('ticket_created', {
    ticket_id: ticketId,
    user_id: userId,
    new_values: ticket as any,
    context: { action: 'created' }
  });
}

export async function triggerTicketUpdated(
  ticketId: number,
  userId: number,
  oldValues: any,
  newValues: any
): Promise<boolean> {
  return executeAutomations('ticket_updated', {
    ticket_id: ticketId,
    user_id: userId,
    old_values: oldValues,
    new_values: newValues,
    context: { action: 'updated' }
  });
}

export async function triggerTicketAssigned(
  ticketId: number,
  assignedTo: number,
  assignedBy: number
): Promise<boolean> {
  return executeAutomations('ticket_assigned', {
    ticket_id: ticketId,
    user_id: assignedBy,
    new_values: { assigned_to: assignedTo },
    context: { action: 'assigned' }
  });
}

export async function triggerCommentAdded(
  ticketId: number,
  commentId: number,
  userId: number
): Promise<boolean> {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);

  return executeAutomations('comment_added', {
    ticket_id: ticketId,
    user_id: userId,
    new_values: comment as any,
    context: { action: 'comment_added', comment_id: commentId }
  });
}

/**
 * Cria automações padrão do sistema
 */
export function createDefaultAutomations(): boolean {
  try {
    const systemAdmin = db.prepare('SELECT id FROM users WHERE role = "admin" LIMIT 1').get() as { id: number };
    if (!systemAdmin) return false;

    const defaultAutomations = [
      {
        name: 'Auto-atribuição por categoria',
        description: 'Atribui automaticamente tickets de TI para agentes especializados',
        trigger_type: 'ticket_created',
        conditions: [
          { field: 'ticket.category_name', operator: 'equals', value: 'TI' }
        ],
        actions: [
          { type: 'assign_ticket', parameters: { agent_id: systemAdmin.id } }
        ],
        is_active: false // Criar como inativo para configuração manual
      },
      {
        name: 'Escalação por prioridade crítica',
        description: 'Escalona automaticamente tickets críticos não respondidos em 1 hora',
        trigger_type: 'sla_warning',
        conditions: [
          { field: 'ticket.priority_name', operator: 'equals', value: 'Crítica' }
        ],
        actions: [
          { type: 'escalate', parameters: { escalated_to: systemAdmin.id, reason: 'Prioridade crítica não atendida' } }
        ],
        is_active: false
      },
      {
        name: 'Notificação para comentários externos',
        description: 'Notifica o agente responsável quando usuário adiciona comentário',
        trigger_type: 'comment_added',
        conditions: [
          { field: 'new.is_internal', operator: 'equals', value: false }
        ],
        actions: [
          { type: 'send_notification', parameters: { user_id: 'ticket.assigned_to', title: 'Novo comentário do usuário', message: 'Um usuário adicionou um comentário ao ticket' } }
        ],
        is_active: true
      }
    ];

    for (const automation of defaultAutomations) {
      const exists = db.prepare('SELECT id FROM automations WHERE name = ?').get(automation.name);
      if (!exists) {
        db.prepare(`
          INSERT INTO automations (name, description, trigger_type, conditions, actions, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          automation.name,
          automation.description,
          automation.trigger_type,
          JSON.stringify(automation.conditions),
          JSON.stringify(automation.actions),
          automation.is_active ? 1 : 0,
          systemAdmin.id
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Error creating default automations:', error);
    return false;
  }
}