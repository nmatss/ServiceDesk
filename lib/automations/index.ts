import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { Automation } from '../types/database';
import { createNotification } from '../notifications';
import { logAuditAction } from '../audit';
import logger from '../monitoring/structured-logger';

// Limite de cascata de automacoes
const MAX_CASCADE_DEPTH = 10;

// Tipos para automacao
interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

interface AutomationAction {
  type: 'assign_ticket' | 'change_status' | 'change_priority' | 'add_comment' | 'send_notification' | 'create_task' | 'escalate' | 'send_webhook';
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
 * Busca automacoes ativas por tipo de trigger
 */
export async function getActiveAutomations(triggerType: string): Promise<Automation[]> {
  try {
    return await executeQuery<Automation>(`
      SELECT * FROM automations
      WHERE trigger_type = ? AND is_active = 1
      ORDER BY created_at ASC
    `, [triggerType]);
  } catch (error) {
    logger.error('Error getting active automations', error);
    return [];
  }
}

/**
 * Executa automacoes para um trigger especifico
 */
export async function executeAutomations(
  triggerType: string,
  triggerData: TriggerData,
  cascadeDepth: number = 0
): Promise<boolean> {
  try {
    // Verificar profundidade de cascata
    if (cascadeDepth >= MAX_CASCADE_DEPTH) {
      logger.warn(`Maximum cascade depth reached for trigger ${triggerType}`, { triggerData, cascadeDepth });
      return false;
    }

    const automations = await getActiveAutomations(triggerType);

    if (automations.length === 0) {
      return true;
    }

    logger.info(`Executing ${automations.length} automations for trigger: ${triggerType}`, { cascadeDepth });

    for (const automation of automations) {
      try {
        await executeAutomation(automation, triggerData, cascadeDepth);
      } catch (error) {
        logger.error(`Error executing automation ${automation.id}:`, error);
        // Continue com outras automacoes mesmo se uma falhar
      }
    }

    return true;
  } catch (error) {
    logger.error('Error executing automations', error);
    return false;
  }
}

/**
 * Executa uma automacao especifica
 */
async function executeAutomation(
  automation: Automation,
  triggerData: TriggerData,
  cascadeDepth: number = 0
): Promise<boolean> {
  try {
    const conditions = JSON.parse(automation.conditions);
    const actions = JSON.parse(automation.actions);

    // Verificar condicoes
    if (!await evaluateConditions(conditions, triggerData)) {
      return false;
    }

    logger.info(`Executing automation: ${automation.name}`, { cascadeDepth });

    // Executar acoes (passando cascadeDepth para acoes que podem disparar outras automacoes)
    for (const action of actions) {
      await executeAction(action, triggerData, cascadeDepth);
    }

    // Atualizar contador de execucao
    await executeRun(`
      UPDATE automations
      SET execution_count = execution_count + 1,
          last_executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [automation.id]);

    // Log da execucao
    await logAuditAction({
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
    logger.error(`Error executing automation ${automation.id}:`, error);
    return false;
  }
}

/**
 * Avalia condicoes da automacao
 */
async function evaluateConditions(
  conditions: AutomationCondition[] | { operator: 'AND' | 'OR'; conditions: AutomationCondition[] },
  triggerData: TriggerData
): Promise<boolean> {
  try {
    // Se e um array simples, usar AND
    if (Array.isArray(conditions)) {
      for (const condition of conditions) {
        if (!await evaluateCondition(condition, triggerData)) return false;
      }
      return true;
    }

    // Se tem operador logico
    if (conditions.operator === 'AND') {
      for (const condition of conditions.conditions) {
        if (!await evaluateCondition(condition, triggerData)) return false;
      }
      return true;
    } else if (conditions.operator === 'OR') {
      for (const condition of conditions.conditions) {
        if (await evaluateCondition(condition, triggerData)) return true;
      }
      return false;
    }

    return false;
  } catch (error) {
    logger.error('Error evaluating conditions', error);
    return false;
  }
}

/**
 * Avalia uma condicao especifica
 */
async function evaluateCondition(condition: AutomationCondition, triggerData: TriggerData): Promise<boolean> {
  try {
    const value = await getFieldValue(condition.field, triggerData);

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
    logger.error('Error evaluating condition', error);
    return false;
  }
}

/**
 * Busca valor de um campo nos dados do trigger
 */
async function getFieldValue(field: string, triggerData: TriggerData): Promise<any> {
  try {
    // Buscar em dados do ticket
    if (triggerData.ticket_id && field.startsWith('ticket.')) {
      const ticketField = field.replace('ticket.', '');
      const ticket = await executeQueryOne<any>(`
        SELECT t.*, c.name as category_name, p.name as priority_name, s.name as status_name
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        WHERE t.id = ?
      `, [triggerData.ticket_id]);

      return ticket ? ticket[ticketField] : null;
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
    logger.error('Error getting field value', error);
    return null;
  }
}

/**
 * Executa uma acao especifica
 */
async function executeAction(action: AutomationAction, triggerData: TriggerData, cascadeDepth: number = 0): Promise<boolean> {
  try {
    switch (action.type) {
      case 'assign_ticket':
        return await assignTicket(action.parameters, triggerData, cascadeDepth);

      case 'change_status':
        return await changeTicketStatus(action.parameters, triggerData, cascadeDepth);

      case 'change_priority':
        return await changeTicketPriority(action.parameters, triggerData, cascadeDepth);

      case 'add_comment':
        return await addTicketComment(action.parameters, triggerData, cascadeDepth);

      case 'send_notification':
        return await sendNotification(action.parameters, triggerData);

      case 'escalate':
        return await escalateTicket(action.parameters, triggerData, cascadeDepth);

      case 'send_webhook':
        return await sendWebhook(action.parameters, triggerData);

      default:
        logger.warn(`Unknown action type: ${action.type}`);
        return false;
    }
  } catch (error) {
    logger.error(`Error executing action ${action.type}:`, error);
    return false;
  }
}

/**
 * Envia webhook para sistema externo com retry exponential backoff
 */
async function sendWebhook(parameters: any, triggerData: TriggerData): Promise<boolean> {
  const { url, method = 'POST', headers = {}, max_retries = 3 } = parameters;
  if (!url) return false;

  const body = JSON.stringify({
    event: 'automation_webhook',
    timestamp: new Date().toISOString(),
    data: triggerData
  });

  let attempt = 0;

  while (attempt <= max_retries) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body
      });

      if (response.ok) {
        return true;
      }

      logger.warn(`Webhook attempt ${attempt + 1} failed with status ${response.status}`);
    } catch (error) {
      logger.warn(`Webhook attempt ${attempt + 1} failed with error`, error);
    }

    attempt++;
    if (attempt <= max_retries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.error(`Webhook failed after ${max_retries + 1} attempts: ${url}`);
  return false;
}

/**
 * Atribui ticket a um agente
 */
async function assignTicket(parameters: any, triggerData: TriggerData, cascadeDepth: number = 0): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { agent_id } = parameters;
    if (!agent_id) return false;

    // Verificar se agente existe
    const agent = await executeQueryOne<{ id: number }>(
      'SELECT id FROM users WHERE id = ? AND role IN (\'agent\', \'admin\')',
      [agent_id]
    );
    if (!agent) return false;

    // Buscar valores antigos
    const oldTicket = await executeQueryOne<any>(
      'SELECT assigned_to FROM tickets WHERE id = ?',
      [triggerData.ticket_id]
    );

    // Atualizar ticket
    await executeRun(
      'UPDATE tickets SET assigned_to = ? WHERE id = ?',
      [agent_id, triggerData.ticket_id]
    );

    // Criar notificacao
    await createNotification({
      user_id: agent_id,
      ticket_id: triggerData.ticket_id,
      type: 'ticket_assigned',
      title: 'Ticket Atribuido Automaticamente',
      message: `Ticket #${triggerData.ticket_id} foi atribuido automaticamente para voce`,
      is_read: false,
      sent_via_email: true
    });

    // Disparar automacoes em cascata (se houver)
    await executeAutomations('ticket_assigned', {
      ticket_id: triggerData.ticket_id,
      old_values: { assigned_to: oldTicket?.assigned_to },
      new_values: { assigned_to: agent_id },
      context: { action: 'assigned_by_automation' }
    }, cascadeDepth + 1);

    return true;
  } catch (error) {
    logger.error('Error assigning ticket', error);
    return false;
  }
}

/**
 * Altera status do ticket
 */
async function changeTicketStatus(parameters: any, triggerData: TriggerData, cascadeDepth: number = 0): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { status_id } = parameters;
    if (!status_id) return false;

    // Verificar se status existe
    const status = await executeQueryOne<{ id: number }>(
      'SELECT id FROM statuses WHERE id = ?',
      [status_id]
    );
    if (!status) return false;

    // Buscar valores antigos
    const oldTicket = await executeQueryOne<any>(
      'SELECT status_id FROM tickets WHERE id = ?',
      [triggerData.ticket_id]
    );

    // Atualizar ticket
    await executeRun(
      'UPDATE tickets SET status_id = ? WHERE id = ?',
      [status_id, triggerData.ticket_id]
    );

    // Disparar automacoes em cascata (se houver)
    await executeAutomations('ticket_updated', {
      ticket_id: triggerData.ticket_id,
      old_values: { status_id: oldTicket?.status_id },
      new_values: { status_id },
      context: { action: 'status_changed_by_automation' }
    }, cascadeDepth + 1);

    return true;
  } catch (error) {
    logger.error('Error changing ticket status', error);
    return false;
  }
}

/**
 * Altera prioridade do ticket
 */
async function changeTicketPriority(parameters: any, triggerData: TriggerData, cascadeDepth: number = 0): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { priority_id } = parameters;
    if (!priority_id) return false;

    // Verificar se prioridade existe
    const priority = await executeQueryOne<{ id: number }>(
      'SELECT id FROM priorities WHERE id = ?',
      [priority_id]
    );
    if (!priority) return false;

    // Buscar valores antigos
    const oldTicket = await executeQueryOne<any>(
      'SELECT priority_id FROM tickets WHERE id = ?',
      [triggerData.ticket_id]
    );

    // Atualizar ticket
    await executeRun(
      'UPDATE tickets SET priority_id = ? WHERE id = ?',
      [priority_id, triggerData.ticket_id]
    );

    // Disparar automacoes em cascata (se houver)
    await executeAutomations('ticket_updated', {
      ticket_id: triggerData.ticket_id,
      old_values: { priority_id: oldTicket?.priority_id },
      new_values: { priority_id },
      context: { action: 'priority_changed_by_automation' }
    }, cascadeDepth + 1);

    return true;
  } catch (error) {
    logger.error('Error changing ticket priority', error);
    return false;
  }
}

/**
 * Adiciona comentario ao ticket
 */
async function addTicketComment(parameters: any, triggerData: TriggerData, cascadeDepth: number = 0): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { content, is_internal = false } = parameters;
    if (!content) return false;

    // Buscar usuario do sistema para comentarios automaticos
    const systemUser = await executeQueryOne<{ id: number }>(
      'SELECT id FROM users WHERE role = \'admin\' LIMIT 1',
      []
    );
    if (!systemUser) return false;

    // Adicionar comentario
    const result = await executeRun(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal)
      VALUES (?, ?, ?, ?)
    `, [triggerData.ticket_id, systemUser.id, content, is_internal ? 1 : 0]);

    // Disparar automacoes em cascata (se houver)
    await executeAutomations('comment_added', {
      ticket_id: triggerData.ticket_id,
      user_id: systemUser.id,
      new_values: { content, is_internal },
      context: { action: 'comment_added_by_automation', comment_id: result.lastInsertRowid }
    }, cascadeDepth + 1);

    return true;
  } catch (error) {
    logger.error('Error adding ticket comment', error);
    return false;
  }
}

/**
 * Envia notificacao
 */
async function sendNotification(parameters: any, triggerData: TriggerData): Promise<boolean> {
  try {
    const { user_id, title, message, send_email = true } = parameters;
    if (!user_id || !title || !message) return false;

    await createNotification({
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
    logger.error('Error sending notification', error);
    return false;
  }
}

/**
 * Escalona ticket
 */
async function escalateTicket(parameters: any, triggerData: TriggerData, cascadeDepth: number = 0): Promise<boolean> {
  try {
    if (!triggerData.ticket_id) return false;

    const { escalated_to, reason = 'Escalacao automatica' } = parameters;
    if (!escalated_to) return false;

    // Verificar se usuario existe
    const user = await executeQueryOne<{ id: number }>(
      'SELECT id FROM users WHERE id = ? AND role IN (\'agent\', \'admin\')',
      [escalated_to]
    );
    if (!user) return false;

    // Buscar ticket atual
    const ticket = await executeQueryOne<{ assigned_to: number }>(
      'SELECT assigned_to FROM tickets WHERE id = ?',
      [triggerData.ticket_id]
    );

    // Registrar escalacao
    await executeRun(`
      INSERT INTO sla_escalations (ticket_id, escalated_from, escalated_to, escalation_level, reason)
      VALUES (?, ?, ?, 1, ?)
    `, [triggerData.ticket_id, ticket?.assigned_to || null, escalated_to, reason]);

    // Atribuir ticket
    await executeRun(
      'UPDATE tickets SET assigned_to = ? WHERE id = ?',
      [escalated_to, triggerData.ticket_id]
    );

    // Notificar novo responsavel
    await createNotification({
      user_id: escalated_to,
      ticket_id: triggerData.ticket_id,
      type: 'escalation',
      title: 'Ticket Escalado',
      message: `Ticket #${triggerData.ticket_id} foi escalado para voce. Motivo: ${reason}`,
      is_read: false,
      sent_via_email: true
    });

    // Disparar automacoes em cascata (se houver)
    await executeAutomations('ticket_assigned', {
      ticket_id: triggerData.ticket_id,
      old_values: { assigned_to: ticket?.assigned_to },
      new_values: { assigned_to: escalated_to },
      context: { action: 'escalated_by_automation', reason }
    }, cascadeDepth + 1);

    return true;
  } catch (error) {
    logger.error('Error escalating ticket', error);
    return false;
  }
}

/**
 * Triggers para eventos de ticket
 */
export async function triggerTicketCreated(ticketId: number, userId: number): Promise<boolean> {
  const ticket = await executeQueryOne<any>(`
    SELECT t.*, c.name as category_name, p.name as priority_name
    FROM tickets t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN priorities p ON t.priority_id = p.id
    WHERE t.id = ?
  `, [ticketId]);

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
  const comment = await executeQueryOne<any>(
    'SELECT * FROM comments WHERE id = ?',
    [commentId]
  );

  return executeAutomations('comment_added', {
    ticket_id: ticketId,
    user_id: userId,
    new_values: comment as any,
    context: { action: 'comment_added', comment_id: commentId }
  });
}

export async function triggerSLABreach(ticketId: number, slaTracking: any): Promise<boolean> {
  return executeAutomations('sla_breach', {
    ticket_id: ticketId,
    context: { action: 'breach', sla: slaTracking }
  });
}

export async function triggerSLAWarning(ticketId: number, slaTracking: any): Promise<boolean> {
  return executeAutomations('sla_warning', {
    ticket_id: ticketId,
    context: { action: 'warning', sla: slaTracking }
  });
}

/**
 * Cria automacoes padrao do sistema
 */
export async function createDefaultAutomations(): Promise<boolean> {
  try {
    const systemAdmin = await executeQueryOne<{ id: number }>(
      'SELECT id FROM users WHERE role = \'admin\' LIMIT 1',
      []
    );
    if (!systemAdmin) return false;

    const defaultAutomations = [
      {
        name: 'Auto-atribuicao por categoria',
        description: 'Atribui automaticamente tickets de TI para agentes especializados',
        trigger_type: 'ticket_created',
        conditions: [
          { field: 'ticket.category_name', operator: 'equals', value: 'TI' }
        ],
        actions: [
          { type: 'assign_ticket', parameters: { agent_id: systemAdmin.id } }
        ],
        is_active: false // Criar como inativo para configuracao manual
      },
      {
        name: 'Escalacao por prioridade critica',
        description: 'Escalona automaticamente tickets criticos nao respondidos em 1 hora',
        trigger_type: 'sla_warning',
        conditions: [
          { field: 'ticket.priority_name', operator: 'equals', value: 'Critica' }
        ],
        actions: [
          { type: 'escalate', parameters: { escalated_to: systemAdmin.id, reason: 'Prioridade critica nao atendida' } }
        ],
        is_active: false
      },
      {
        name: 'Notificacao para comentarios externos',
        description: 'Notifica o agente responsavel quando usuario adiciona comentario',
        trigger_type: 'comment_added',
        conditions: [
          { field: 'new.is_internal', operator: 'equals', value: false }
        ],
        actions: [
          { type: 'send_notification', parameters: { user_id: 'ticket.assigned_to', title: 'Novo comentario do usuario', message: 'Um usuario adicionou um comentario ao ticket' } }
        ],
        is_active: true
      }
    ];

    for (const automation of defaultAutomations) {
      const exists = await executeQueryOne<{ id: number }>(
        'SELECT id FROM automations WHERE name = ?',
        [automation.name]
      );
      if (!exists) {
        await executeRun(`
          INSERT INTO automations (name, description, trigger_type, conditions, actions, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          automation.name,
          automation.description,
          automation.trigger_type,
          JSON.stringify(automation.conditions),
          JSON.stringify(automation.actions),
          automation.is_active ? 1 : 0,
          systemAdmin.id
        ]);
      }
    }

    return true;
  } catch (error) {
    logger.error('Error creating default automations', error);
    return false;
  }
}
