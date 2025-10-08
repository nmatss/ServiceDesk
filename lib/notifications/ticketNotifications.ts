import { getSocketServer } from '@/lib/socket/server'
import { getDb } from '@/lib/db'
import { logger } from '../monitoring/logger';

interface TicketData {
  id: number
  title: string
  description: string
  user_id: number
  assigned_to?: number
  category_id: number
  priority_id: number
  status_id: number
  created_at: string
  updated_at: string
}

interface CommentData {
  id: number
  ticket_id: number
  user_id: number
  content: string
  is_internal: boolean
  created_at: string
}

export class TicketNotificationManager {
  private db = getDb()

  // Notificar quando um ticket é criado
  async notifyTicketCreated(ticketData: TicketData) {
    const socketServer = getSocketServer()
    if (!socketServer) return

    try {
      // Buscar informações adicionais
      const ticketInfo = this.getTicketInfo(ticketData.id)

      // Notificar todos os agentes e admins sobre novo ticket
      const notification = {
        type: 'ticket_created',
        title: 'Novo ticket criado',
        message: `Ticket #${ticketData.id}: ${ticketData.title}`,
        data: {
          ticketId: ticketData.id,
          ...ticketInfo
        },
        timestamp: new Date().toISOString()
      }

      // Enviar para agentes e admins
      socketServer.getIO().to('agents').emit('notification', notification)

      logger.info(`📢 Notified agents about new ticket #${ticketData.id}`)

    } catch (error) {
      logger.error('Error notifying ticket creation', error)
    }
  }

  // Notificar quando um ticket é atribuído
  async notifyTicketAssigned(ticketId: number, assignedToUserId: number, assignedByUserId: number) {
    const socketServer = getSocketServer()
    if (!socketServer) return

    try {
      const ticketInfo = this.getTicketInfo(ticketId)
      const assignedBy = this.getUserInfo(assignedByUserId)

      const notification = {
        type: 'ticket_assigned',
        title: 'Ticket atribuído a você',
        message: `Ticket #${ticketId} foi atribuído a você por ${assignedBy?.name}`,
        data: {
          ticketId,
          assignedBy: assignedBy?.name,
          ...ticketInfo
        },
        timestamp: new Date().toISOString(),
        priority: 'medium' as const
      }

      // Enviar notificação específica para o usuário atribuído
      socketServer.getIO().to(`user_${assignedToUserId}`).emit('notification', notification)

      logger.info(`📢 Notified user ${assignedToUserId} about ticket assignment #${ticketId}`)

    } catch (error) {
      logger.error('Error notifying ticket assignment', error)
    }
  }

  // Notificar quando um ticket é atualizado
  async notifyTicketUpdated(ticketId: number, updatedByUserId: number, changes: any) {
    const socketServer = getSocketServer()
    if (!socketServer) return

    try {
      const ticketInfo = this.getTicketInfo(ticketId)
      const updatedBy = this.getUserInfo(updatedByUserId)

      // Determinar quais usuários devem ser notificados
      const usersToNotify = await this.getTicketStakeholders(ticketId)

      // Criar notificação baseada no tipo de mudança
      let title = 'Ticket atualizado'
      let message = `Ticket #${ticketId} foi atualizado por ${updatedBy?.name}`
      let priority: 'low' | 'medium' | 'high' = 'medium'

      if (changes.status_id) {
        const statusInfo = this.getStatusInfo(changes.status_id)
        title = 'Status do ticket alterado'
        message = `Ticket #${ticketId} mudou para: ${statusInfo?.name}`

        if (statusInfo?.is_final) {
          title = 'Ticket resolvido'
          message = `Ticket #${ticketId} foi resolvido`
          priority = 'high'
        }
      } else if (changes.priority_id) {
        const priorityInfo = this.getPriorityInfo(changes.priority_id)
        title = 'Prioridade alterada'
        message = `Ticket #${ticketId} teve sua prioridade alterada para: ${priorityInfo?.name}`

        if (priorityInfo?.level >= 3) {
          priority = 'high'
        }
      } else if (changes.assigned_to) {
        const assignee = this.getUserInfo(changes.assigned_to)
        title = 'Ticket reatribuído'
        message = `Ticket #${ticketId} foi atribuído para: ${assignee?.name}`
      }

      const notification = {
        type: 'ticket_updated',
        title,
        message,
        data: {
          ticketId,
          changes,
          updatedBy: updatedBy?.name,
          ...ticketInfo
        },
        timestamp: new Date().toISOString(),
        priority
      }

      // Notificar todos os stakeholders exceto quem fez a mudança
      for (const userId of usersToNotify) {
        if (userId !== updatedByUserId) {
          socketServer.getIO().to(`user_${userId}`).emit('notification', notification)
        }
      }

      // Notificar também a sala do ticket
      socketServer.getIO().to(`ticket_${ticketId}`).except(`user_${updatedByUserId}`).emit('notification', notification)

      logger.info(`📢 Notified stakeholders about ticket update #${ticketId}`)

    } catch (error) {
      logger.error('Error notifying ticket update', error)
    }
  }

  // Notificar quando um comentário é adicionado
  async notifyCommentAdded(commentData: CommentData) {
    const socketServer = getSocketServer()
    if (!socketServer) return

    try {
      const ticketInfo = this.getTicketInfo(commentData.ticket_id)
      const author = this.getUserInfo(commentData.user_id)
      const usersToNotify = await this.getTicketStakeholders(commentData.ticket_id)

      const notification = {
        type: 'comment_added',
        title: commentData.is_internal ? 'Nova nota interna' : 'Novo comentário',
        message: `${author?.name} ${commentData.is_internal ? 'adicionou uma nota interna' : 'comentou'} no ticket #${commentData.ticket_id}`,
        data: {
          ticketId: commentData.ticket_id,
          commentId: commentData.id,
          author: author?.name,
          isInternal: commentData.is_internal,
          preview: commentData.content.substring(0, 100) + (commentData.content.length > 100 ? '...' : ''),
          ...ticketInfo
        },
        timestamp: new Date().toISOString()
      }

      // Se for nota interna, notificar apenas agentes e admins
      if (commentData.is_internal) {
        socketServer.getIO().to('agents').except(`user_${commentData.user_id}`).emit('notification', notification)
      } else {
        // Notificar todos os stakeholders
        for (const userId of usersToNotify) {
          if (userId !== commentData.user_id) {
            socketServer.getIO().to(`user_${userId}`).emit('notification', notification)
          }
        }
      }

      // Notificar também a sala do ticket
      socketServer.getIO().to(`ticket_${commentData.ticket_id}`).except(`user_${commentData.user_id}`).emit('notification', notification)

      logger.info(`📢 Notified about new comment on ticket #${commentData.ticket_id}`)

    } catch (error) {
      logger.error('Error notifying comment added', error)
    }
  }

  // Notificar sobre violações de SLA
  async notifySLAWarning(ticketId: number, slaType: 'response' | 'resolution', minutesLeft: number) {
    const socketServer = getSocketServer()
    if (!socketServer) return

    try {
      const ticketInfo = this.getTicketInfo(ticketId)

      const typeLabel = slaType === 'response' ? 'resposta' : 'resolução'
      const urgencyLabel = minutesLeft <= 15 ? 'CRÍTICO' : minutesLeft <= 60 ? 'URGENTE' : 'ATENÇÃO'

      const notification = {
        type: 'sla_warning',
        title: `⚠️ ${urgencyLabel}: SLA próximo do vencimento`,
        message: `Ticket #${ticketId} vence o SLA de ${typeLabel} em ${minutesLeft} minutos`,
        data: {
          ticketId,
          slaType,
          minutesLeft,
          ...ticketInfo
        },
        timestamp: new Date().toISOString(),
        priority: minutesLeft <= 15 ? 'high' as const : 'medium' as const
      }

      // Notificar agentes e admins
      socketServer.getIO().to('agents').emit('notification', notification)

      // Se crítico, notificar também o assigned_to especificamente
      if (minutesLeft <= 15 && ticketInfo?.assigned_to) {
        socketServer.getIO().to(`user_${ticketInfo.assigned_to}`).emit('notification', {
          ...notification,
          title: `🚨 CRÍTICO: SLA vencendo em ${minutesLeft} minutos`,
          priority: 'high'
        })
      }

      logger.info(`⚠️ Sent SLA warning for ticket #${ticketId} (${minutesLeft} minutes left)`)

    } catch (error) {
      logger.error('Error sending SLA warning', error)
    }
  }

  // Métodos auxiliares
  private getTicketInfo(ticketId: number) {
    try {
      return this.db.prepare(`
        SELECT
          t.*,
          c.name as category_name,
          p.name as priority_name,
          p.level as priority_level,
          s.name as status_name,
          s.is_final as status_is_final,
          u.name as creator_name,
          a.name as assignee_name
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = ?
      `).get(ticketId)
    } catch (error) {
      logger.error('Error getting ticket info', error)
      return null
    }
  }

  private getUserInfo(userId: number) {
    try {
      return this.db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId)
    } catch (error) {
      logger.error('Error getting user info', error)
      return null
    }
  }

  private getStatusInfo(statusId: number) {
    try {
      return this.db.prepare('SELECT id, name, is_final FROM statuses WHERE id = ?').get(statusId)
    } catch (error) {
      logger.error('Error getting status info', error)
      return null
    }
  }

  private getPriorityInfo(priorityId: number) {
    try {
      return this.db.prepare('SELECT id, name, level FROM priorities WHERE id = ?').get(priorityId)
    } catch (error) {
      logger.error('Error getting priority info', error)
      return null
    }
  }

  private async getTicketStakeholders(ticketId: number): Promise<number[]> {
    try {
      // Buscar todos os usuários relacionados ao ticket
      const stakeholders = this.db.prepare(`
        SELECT DISTINCT user_id as id FROM (
          -- Criador do ticket
          SELECT user_id FROM tickets WHERE id = ?
          UNION
          -- Usuário atribuído
          SELECT assigned_to as user_id FROM tickets WHERE id = ? AND assigned_to IS NOT NULL
          UNION
          -- Usuários que comentaram
          SELECT user_id FROM comments WHERE ticket_id = ?
        )
      `).all(ticketId, ticketId, ticketId)

      return stakeholders.map((s: any) => s.id).filter(Boolean)
    } catch (error) {
      logger.error('Error getting ticket stakeholders', error)
      return []
    }
  }
}

// Singleton instance
let notificationManager: TicketNotificationManager | null = null

export function getTicketNotificationManager(): TicketNotificationManager {
  if (!notificationManager) {
    notificationManager = new TicketNotificationManager()
  }
  return notificationManager
}