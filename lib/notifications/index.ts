import db from '../db/connection';
import { CreateNotification, Notification, NotificationWithDetails } from '../types/database';
import logger from '../monitoring/structured-logger';

/**
 * Cria uma notificação
 */
export function createNotification(notification: CreateNotification): Notification | null {
  try {
    const insertQuery = db.prepare(`
      INSERT INTO notifications (
        user_id, ticket_id, type, title, message, is_read, sent_via_email, email_sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertQuery.run(
      notification.user_id,
      notification.ticket_id || null,
      notification.type,
      notification.title,
      notification.message,
      notification.is_read ? 1 : 0,
      notification.sent_via_email ? 1 : 0,
      notification.email_sent_at || null
    );

    if (result.lastInsertRowid) {
      return db.prepare('SELECT * FROM notifications WHERE id = ?')
        .get(result.lastInsertRowid) as Notification;
    }

    return null;
  } catch (error) {
    logger.error('Error creating notification', error);
    return null;
  }
}

/**
 * Busca notificações de um usuário
 */
export function getUserNotifications(
  userId: number,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    types?: string[];
  } = {}
): { notifications: NotificationWithDetails[]; total: number; unread: number } {
  try {
    const { unreadOnly = false, limit = 50, offset = 0, types } = options;

    let whereClause = 'WHERE n.user_id = ?';
    const params: any[] = [userId];

    if (unreadOnly) {
      whereClause += ' AND n.is_read = 0';
    }

    if (types && types.length > 0) {
      const placeholders = types.map(() => '?').join(',');
      whereClause += ` AND n.type IN (${placeholders})`;
      params.push(...types);
    }

    // Buscar notificações
    const notifications = db.prepare(`
      SELECT
        n.*,
        u.name as user_name,
        u.email as user_email,
        t.title as ticket_title,
        t.id as ticket_number
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      LEFT JOIN tickets t ON n.ticket_id = t.id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as NotificationWithDetails[];

    // Contar total
    const totalQuery = db.prepare(`
      SELECT COUNT(*) as total
      FROM notifications n
      ${whereClause}
    `);
    const { total } = totalQuery.get(...params) as { total: number };

    // Contar não lidas
    const unreadQuery = db.prepare(`
      SELECT COUNT(*) as unread
      FROM notifications n
      WHERE n.user_id = ? AND n.is_read = 0
    `);
    const { unread } = unreadQuery.get(userId) as { unread: number };

    return { notifications, total, unread };
  } catch (error) {
    logger.error('Error getting user notifications', error);
    return { notifications: [], total: 0, unread: 0 };
  }
}

/**
 * Marca notificações como lidas
 */
export function markAsRead(notificationIds: number[], userId: number): number {
  try {
    if (notificationIds.length === 0) return 0;

    const placeholders = notificationIds.map(() => '?').join(',');
    const updateQuery = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id IN (${placeholders}) AND user_id = ?
    `);

    const result = updateQuery.run(...notificationIds, userId);
    return result.changes;
  } catch (error) {
    logger.error('Error marking notifications as read', error);
    return 0;
  }
}

/**
 * Marca todas as notificações de um usuário como lidas
 */
export function markAllAsRead(userId: number): number {
  try {
    const updateQuery = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `);

    const result = updateQuery.run(userId);
    return result.changes;
  } catch (error) {
    logger.error('Error marking all notifications as read', error);
    return 0;
  }
}

/**
 * Deleta notificações antigas
 */
export function deleteOldNotifications(daysOld: number = 30): number {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleteQuery = db.prepare(`
      DELETE FROM notifications
      WHERE created_at < ? AND is_read = 1
    `);

    const result = deleteQuery.run(cutoffDate.toISOString());
    return result.changes;
  } catch (error) {
    logger.error('Error deleting old notifications', error);
    return 0;
  }
}

/**
 * Cria notificação de ticket atribuído
 */
export function notifyTicketAssigned(ticketId: number, assignedTo: number, assignedBy?: number): boolean {
  try {
    const ticket = db.prepare(`
      SELECT t.title, u.name as assigned_by_name
      FROM tickets t
      LEFT JOIN users u ON u.id = ?
      WHERE t.id = ?
    `).get(assignedBy || null, ticketId) as any;

    if (!ticket) return false;

    const assignedByText = assignedBy ? ` por ${ticket.assigned_by_name}` : '';

    return createNotification({
      user_id: assignedTo,
      ticket_id: ticketId,
      type: 'ticket_assigned',
      title: 'Ticket Atribuído',
      message: `Ticket #${ticketId} "${ticket.title}" foi atribuído para você${assignedByText}`,
      is_read: false,
      sent_via_email: true
    }) !== null;
  } catch (error) {
    logger.error('Error creating ticket assigned notification', error);
    return false;
  }
}

/**
 * Cria notificação de ticket atualizado
 */
export function notifyTicketUpdated(ticketId: number, userId: number, updateType: string): boolean {
  try {
    const ticket = db.prepare(`
      SELECT t.title, t.user_id, t.assigned_to
      FROM tickets t
      WHERE t.id = ?
    `).get(ticketId) as any;

    if (!ticket) return false;

    // Notificar o criador do ticket (se não for quem atualizou)
    if (ticket.user_id !== userId) {
      createNotification({
        user_id: ticket.user_id,
        ticket_id: ticketId,
        type: 'ticket_updated',
        title: 'Ticket Atualizado',
        message: `Seu ticket #${ticketId} "${ticket.title}" foi atualizado: ${updateType}`,
        is_read: false,
        sent_via_email: true
      });
    }

    // Notificar o agente responsável (se não for quem atualizou)
    if (ticket.assigned_to && ticket.assigned_to !== userId) {
      createNotification({
        user_id: ticket.assigned_to,
        ticket_id: ticketId,
        type: 'ticket_updated',
        title: 'Ticket Atualizado',
        message: `Ticket #${ticketId} "${ticket.title}" foi atualizado: ${updateType}`,
        is_read: false,
        sent_via_email: true
      });
    }

    return true;
  } catch (error) {
    logger.error('Error creating ticket updated notification', error);
    return false;
  }
}

/**
 * Cria notificação de comentário adicionado
 */
export function notifyCommentAdded(ticketId: number, commentAuthor: number, isInternal: boolean = false): boolean {
  try {
    const ticket = db.prepare(`
      SELECT t.title, t.user_id, t.assigned_to, u.name as author_name
      FROM tickets t
      LEFT JOIN users u ON u.id = ?
      WHERE t.id = ?
    `).get(commentAuthor, ticketId) as any;

    if (!ticket) return false;

    const recipients: number[] = [];

    // Se não for comentário interno, notificar o criador do ticket
    if (!isInternal && ticket.user_id !== commentAuthor) {
      recipients.push(ticket.user_id);
    }

    // Notificar o agente responsável (sempre, exceto se for o próprio autor)
    if (ticket.assigned_to && ticket.assigned_to !== commentAuthor) {
      recipients.push(ticket.assigned_to);
    }

    // Se for comentário interno, notificar outros agentes
    if (isInternal) {
      const agents = db.prepare(`
        SELECT id FROM users
        WHERE role IN ('admin', 'agent') AND id != ?
      `).all(commentAuthor) as { id: number }[];

      agents.forEach(agent => {
        if (!recipients.includes(agent.id)) {
          recipients.push(agent.id);
        }
      });
    }

    // Criar notificações
    recipients.forEach(userId => {
      createNotification({
        user_id: userId,
        ticket_id: ticketId,
        type: 'comment_added',
        title: isInternal ? 'Comentário Interno Adicionado' : 'Novo Comentário',
        message: `${ticket.author_name} adicionou um ${isInternal ? 'comentário interno' : 'comentário'} no ticket #${ticketId} "${ticket.title}"`,
        is_read: false,
        sent_via_email: !isInternal // Comentários internos não vão por email para usuários finais
      });
    });

    return true;
  } catch (error) {
    logger.error('Error creating comment notification', error);
    return false;
  }
}

/**
 * Cria notificação de SLA warning
 */
export function notifySLAWarning(ticketId: number, warningType: 'response' | 'resolution'): boolean {
  try {
    const ticket = db.prepare(`
      SELECT t.title, t.user_id, t.assigned_to, st.response_due_at, st.resolution_due_at
      FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.id = ?
    `).get(ticketId) as any;

    if (!ticket) return false;

    const recipients: number[] = [];

    // Notificar o agente responsável
    if (ticket.assigned_to) {
      recipients.push(ticket.assigned_to);
    }

    // Notificar admins
    const admins = db.prepare(`
      SELECT id FROM users WHERE role = 'admin'
    `).all() as { id: number }[];

    admins.forEach(admin => {
      if (!recipients.includes(admin.id)) {
        recipients.push(admin.id);
      }
    });

    const dueDate = warningType === 'response' ? ticket.response_due_at : ticket.resolution_due_at;
    const timeType = warningType === 'response' ? 'primeira resposta' : 'resolução';

    recipients.forEach(userId => {
      createNotification({
        user_id: userId,
        ticket_id: ticketId,
        type: 'sla_warning',
        title: 'Aviso de SLA',
        message: `Ticket #${ticketId} "${ticket.title}" está próximo do prazo de ${timeType} (${new Date(dueDate).toLocaleString()})`,
        is_read: false,
        sent_via_email: true
      });
    });

    return true;
  } catch (error) {
    logger.error('Error creating SLA warning notification', error);
    return false;
  }
}

/**
 * Cria notificação de SLA breach
 */
export function notifySLABreach(ticketId: number, breachType: 'response' | 'resolution'): boolean {
  try {
    const ticket = db.prepare(`
      SELECT t.title, t.user_id, t.assigned_to
      FROM tickets t
      WHERE t.id = ?
    `).get(ticketId) as any;

    if (!ticket) return false;

    const recipients: number[] = [];

    // Notificar o agente responsável
    if (ticket.assigned_to) {
      recipients.push(ticket.assigned_to);
    }

    // Notificar admins
    const admins = db.prepare(`
      SELECT id FROM users WHERE role = 'admin'
    `).all() as { id: number }[];

    admins.forEach(admin => {
      if (!recipients.includes(admin.id)) {
        recipients.push(admin.id);
      }
    });

    const timeType = breachType === 'response' ? 'primeira resposta' : 'resolução';

    recipients.forEach(userId => {
      createNotification({
        user_id: userId,
        ticket_id: ticketId,
        type: 'sla_breach',
        title: 'SLA Violado',
        message: `CRÍTICO: Ticket #${ticketId} "${ticket.title}" violou o SLA de ${timeType}`,
        is_read: false,
        sent_via_email: true
      });
    });

    return true;
  } catch (error) {
    logger.error('Error creating SLA breach notification', error);
    return false;
  }
}

/**
 * Cria notificação de escalação
 */
export function notifyEscalation(ticketId: number, escalatedTo: number, reason: string): boolean {
  try {
    const ticket = db.prepare(`
      SELECT title FROM tickets WHERE id = ?
    `).get(ticketId) as { title: string };

    if (!ticket) return false;

    return createNotification({
      user_id: escalatedTo,
      ticket_id: ticketId,
      type: 'escalation',
      title: 'Ticket Escalado',
      message: `Ticket #${ticketId} "${ticket.title}" foi escalado para você. Motivo: ${reason}`,
      is_read: false,
      sent_via_email: true
    }) !== null;
  } catch (error) {
    logger.error('Error creating escalation notification', error);
    return false;
  }
}

/**
 * Estatísticas de notificações
 */
export function getNotificationStats(userId?: number): any {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (userId) {
      whereClause = 'WHERE user_id = ?';
      params.push(userId);
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread,
        COUNT(CASE WHEN type = 'ticket_assigned' THEN 1 END) as ticket_assigned,
        COUNT(CASE WHEN type = 'ticket_updated' THEN 1 END) as ticket_updated,
        COUNT(CASE WHEN type = 'sla_warning' THEN 1 END) as sla_warnings,
        COUNT(CASE WHEN type = 'sla_breach' THEN 1 END) as sla_breaches,
        COUNT(CASE WHEN type = 'escalation' THEN 1 END) as escalations,
        COUNT(CASE WHEN type = 'comment_added' THEN 1 END) as comments
      FROM notifications
      ${whereClause}
    `).get(...params);

    return stats;
  } catch (error) {
    logger.error('Error getting notification stats', error);
    return null;
  }
}

/**
 * Processo de limpeza automática de notificações antigas
 */
export function cleanupNotifications(): number {
  try {
    // Deletar notificações lidas com mais de 30 dias
    const deleted = deleteOldNotifications(30);

    logger.info(`Cleanup: ${deleted} old notifications deleted`);
    return deleted;
  } catch (error) {
    logger.error('Error in notification cleanup', error);
    return 0;
  }
}