import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { CreateNotification, Notification, NotificationWithDetails } from '../types/database';
import logger from '../monitoring/structured-logger';

/**
 * Cria uma notificacao
 */
export async function createNotification(notification: CreateNotification): Promise<Notification | null> {
  try {
    const result = await executeRun(`
      INSERT INTO notifications (
        user_id, ticket_id, type, title, message, is_read, sent_via_email, email_sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      notification.user_id,
      notification.ticket_id || null,
      notification.type,
      notification.title,
      notification.message,
      notification.is_read ? 1 : 0,
      notification.sent_via_email ? 1 : 0,
      notification.email_sent_at || null
    ]);

    if (result.lastInsertRowid) {
      return await executeQueryOne<Notification>(
        'SELECT * FROM notifications WHERE id = ?',
        [result.lastInsertRowid]
      ) || null;
    }

    return null;
  } catch (error) {
    logger.error('Error creating notification', error);
    return null;
  }
}

/**
 * Busca notificacoes de um usuario
 */
export async function getUserNotifications(
  userId: number,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    types?: string[];
  } = {}
): Promise<{ notifications: NotificationWithDetails[]; total: number; unread: number }> {
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

    // Buscar notificacoes
    const notifications = await executeQuery<NotificationWithDetails>(`
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
    `, [...params, limit, offset]);

    // Contar total
    const totalResult = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM notifications n
      ${whereClause}
    `, params);
    const total = totalResult?.total ?? 0;

    // Contar nao lidas
    const unreadResult = await executeQueryOne<{ unread: number }>(`
      SELECT COUNT(*) as unread
      FROM notifications n
      WHERE n.user_id = ? AND n.is_read = 0
    `, [userId]);
    const unread = unreadResult?.unread ?? 0;

    return { notifications, total, unread };
  } catch (error) {
    logger.error('Error getting user notifications', error);
    return { notifications: [], total: 0, unread: 0 };
  }
}

/**
 * Marca notificacoes como lidas
 */
export async function markAsRead(notificationIds: number[], userId: number): Promise<number> {
  try {
    if (notificationIds.length === 0) return 0;

    const placeholders = notificationIds.map(() => '?').join(',');
    const result = await executeRun(`
      UPDATE notifications
      SET is_read = 1
      WHERE id IN (${placeholders}) AND user_id = ?
    `, [...notificationIds, userId]);

    return result.changes;
  } catch (error) {
    logger.error('Error marking notifications as read', error);
    return 0;
  }
}

/**
 * Marca todas as notificacoes de um usuario como lidas
 */
export async function markAllAsRead(userId: number): Promise<number> {
  try {
    const result = await executeRun(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `, [userId]);

    return result.changes;
  } catch (error) {
    logger.error('Error marking all notifications as read', error);
    return 0;
  }
}

/**
 * Deleta notificacoes antigas
 */
export async function deleteOldNotifications(daysOld: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await executeRun(`
      DELETE FROM notifications
      WHERE created_at < ? AND is_read = 1
    `, [cutoffDate.toISOString()]);

    return result.changes;
  } catch (error) {
    logger.error('Error deleting old notifications', error);
    return 0;
  }
}

/**
 * Cria notificacao de ticket atribuido
 */
export async function notifyTicketAssigned(ticketId: number, assignedTo: number, assignedBy?: number): Promise<boolean> {
  try {
    const ticket = await executeQueryOne<any>(`
      SELECT t.title, u.name as assigned_by_name
      FROM tickets t
      LEFT JOIN users u ON u.id = ?
      WHERE t.id = ?
    `, [assignedBy || null, ticketId]);

    if (!ticket) return false;

    const assignedByText = assignedBy ? ` por ${ticket.assigned_by_name}` : '';

    return await createNotification({
      user_id: assignedTo,
      ticket_id: ticketId,
      type: 'ticket_assigned',
      title: 'Ticket Atribuido',
      message: `Ticket #${ticketId} "${ticket.title}" foi atribuido para voce${assignedByText}`,
      is_read: false,
      sent_via_email: true
    }) !== null;
  } catch (error) {
    logger.error('Error creating ticket assigned notification', error);
    return false;
  }
}

/**
 * Cria notificacao de ticket atualizado
 */
export async function notifyTicketUpdated(ticketId: number, userId: number, updateType: string): Promise<boolean> {
  try {
    const ticket = await executeQueryOne<any>(`
      SELECT t.title, t.user_id, t.assigned_to
      FROM tickets t
      WHERE t.id = ?
    `, [ticketId]);

    if (!ticket) return false;

    // Notificar o criador do ticket (se nao for quem atualizou)
    if (ticket.user_id !== userId) {
      await createNotification({
        user_id: ticket.user_id,
        ticket_id: ticketId,
        type: 'ticket_updated',
        title: 'Ticket Atualizado',
        message: `Seu ticket #${ticketId} "${ticket.title}" foi atualizado: ${updateType}`,
        is_read: false,
        sent_via_email: true
      });
    }

    // Notificar o agente responsavel (se nao for quem atualizou)
    if (ticket.assigned_to && ticket.assigned_to !== userId) {
      await createNotification({
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
 * Cria notificacao de comentario adicionado
 */
export async function notifyCommentAdded(ticketId: number, commentAuthor: number, isInternal: boolean = false): Promise<boolean> {
  try {
    const ticket = await executeQueryOne<any>(`
      SELECT t.title, t.user_id, t.assigned_to, u.name as author_name
      FROM tickets t
      LEFT JOIN users u ON u.id = ?
      WHERE t.id = ?
    `, [commentAuthor, ticketId]);

    if (!ticket) return false;

    const recipients: number[] = [];

    // Se nao for comentario interno, notificar o criador do ticket
    if (!isInternal && ticket.user_id !== commentAuthor) {
      recipients.push(ticket.user_id);
    }

    // Notificar o agente responsavel (sempre, exceto se for o proprio autor)
    if (ticket.assigned_to && ticket.assigned_to !== commentAuthor) {
      recipients.push(ticket.assigned_to);
    }

    // Se for comentario interno, notificar outros agentes
    if (isInternal) {
      const agents = await executeQuery<{ id: number }>(`
        SELECT id FROM users
        WHERE role IN ('admin', 'agent') AND id != ?
      `, [commentAuthor]);

      agents.forEach(agent => {
        if (!recipients.includes(agent.id)) {
          recipients.push(agent.id);
        }
      });
    }

    // Criar notificacoes
    for (const recipientUserId of recipients) {
      await createNotification({
        user_id: recipientUserId,
        ticket_id: ticketId,
        type: 'comment_added',
        title: isInternal ? 'Comentario Interno Adicionado' : 'Novo Comentario',
        message: `${ticket.author_name} adicionou um ${isInternal ? 'comentario interno' : 'comentario'} no ticket #${ticketId} "${ticket.title}"`,
        is_read: false,
        sent_via_email: !isInternal
      });
    }

    return true;
  } catch (error) {
    logger.error('Error creating comment notification', error);
    return false;
  }
}

/**
 * Cria notificacao de SLA warning
 */
export async function notifySLAWarning(ticketId: number, warningType: 'response' | 'resolution'): Promise<boolean> {
  try {
    const ticket = await executeQueryOne<any>(`
      SELECT t.title, t.user_id, t.assigned_to, st.response_due_at, st.resolution_due_at
      FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.id = ?
    `, [ticketId]);

    if (!ticket) return false;

    const recipients: number[] = [];

    // Notificar o agente responsavel
    if (ticket.assigned_to) {
      recipients.push(ticket.assigned_to);
    }

    // Notificar admins
    const admins = await executeQuery<{ id: number }>(`
      SELECT id FROM users WHERE role = 'admin'
    `, []);

    admins.forEach(admin => {
      if (!recipients.includes(admin.id)) {
        recipients.push(admin.id);
      }
    });

    const dueDate = warningType === 'response' ? ticket.response_due_at : ticket.resolution_due_at;
    const timeType = warningType === 'response' ? 'primeira resposta' : 'resolucao';

    for (const recipientUserId of recipients) {
      await createNotification({
        user_id: recipientUserId,
        ticket_id: ticketId,
        type: 'sla_warning',
        title: 'Aviso de SLA',
        message: `Ticket #${ticketId} "${ticket.title}" esta proximo do prazo de ${timeType} (${new Date(dueDate).toLocaleString()})`,
        is_read: false,
        sent_via_email: true
      });
    }

    return true;
  } catch (error) {
    logger.error('Error creating SLA warning notification', error);
    return false;
  }
}

/**
 * Cria notificacao de SLA breach
 */
export async function notifySLABreach(ticketId: number, breachType: 'response' | 'resolution'): Promise<boolean> {
  try {
    const ticket = await executeQueryOne<any>(`
      SELECT t.title, t.user_id, t.assigned_to
      FROM tickets t
      WHERE t.id = ?
    `, [ticketId]);

    if (!ticket) return false;

    const recipients: number[] = [];

    // Notificar o agente responsavel
    if (ticket.assigned_to) {
      recipients.push(ticket.assigned_to);
    }

    // Notificar admins
    const admins = await executeQuery<{ id: number }>(`
      SELECT id FROM users WHERE role = 'admin'
    `, []);

    admins.forEach(admin => {
      if (!recipients.includes(admin.id)) {
        recipients.push(admin.id);
      }
    });

    const timeType = breachType === 'response' ? 'primeira resposta' : 'resolucao';

    for (const recipientUserId of recipients) {
      await createNotification({
        user_id: recipientUserId,
        ticket_id: ticketId,
        type: 'sla_breach',
        title: 'SLA Violado',
        message: `CRITICO: Ticket #${ticketId} "${ticket.title}" violou o SLA de ${timeType}`,
        is_read: false,
        sent_via_email: true
      });
    }

    return true;
  } catch (error) {
    logger.error('Error creating SLA breach notification', error);
    return false;
  }
}

/**
 * Cria notificacao de escalacao
 */
export async function notifyEscalation(ticketId: number, escalatedTo: number, reason: string): Promise<boolean> {
  try {
    const ticket = await executeQueryOne<{ title: string }>(
      'SELECT title FROM tickets WHERE id = ?',
      [ticketId]
    );

    if (!ticket) return false;

    return await createNotification({
      user_id: escalatedTo,
      ticket_id: ticketId,
      type: 'escalation',
      title: 'Ticket Escalado',
      message: `Ticket #${ticketId} "${ticket.title}" foi escalado para voce. Motivo: ${reason}`,
      is_read: false,
      sent_via_email: true
    }) !== null;
  } catch (error) {
    logger.error('Error creating escalation notification', error);
    return false;
  }
}

/**
 * Estatisticas de notificacoes
 */
export async function getNotificationStats(userId?: number): Promise<any> {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (userId) {
      whereClause = 'WHERE user_id = ?';
      params.push(userId);
    }

    const stats = await executeQueryOne<any>(`
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
    `, params);

    return stats || null;
  } catch (error) {
    logger.error('Error getting notification stats', error);
    return null;
  }
}

/**
 * Processo de limpeza automatica de notificacoes antigas
 */
export async function cleanupNotifications(): Promise<number> {
  try {
    // Deletar notificacoes lidas com mais de 30 dias
    const deleted = await deleteOldNotifications(30);

    logger.info(`Cleanup: ${deleted} old notifications deleted`);
    return deleted;
  } catch (error) {
    logger.error('Error in notification cleanup', error);
    return 0;
  }
}
