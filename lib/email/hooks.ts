import emailService from './service'
import { TicketEmailData, UserEmailData } from './templates'
import db from '@/lib/db/connection'
import logger from '../monitoring/structured-logger';

// Interface for ticket database row
interface TicketRow {
  id: number
  ticket_number: string
  title: string
  description: string
  created_at: string
  priority_name: string
  status_name: string
  customer_name: string
  customer_email: string
  assigned_name: string | null
  tenant_name: string
}

// Helper function to get ticket data for email
export const getTicketEmailData = (ticketId: number): TicketEmailData | null => {
  try {
    const ticket = db.prepare(`
      SELECT
        t.id,
        t.ticket_number,
        t.title,
        t.description,
        t.created_at,
        p.name as priority_name,
        s.name as status_name,
        u.name as customer_name,
        u.email as customer_email,
        assigned.name as assigned_name,
        tenant.name as tenant_name
      FROM tickets t
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      LEFT JOIN tenants tenant ON t.tenant_id = tenant.id
      WHERE t.id = ?
    `).get(ticketId) as TicketRow | undefined

    if (!ticket) return null

    return {
      ticketNumber: ticket.ticket_number,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority_name,
      status: ticket.status_name,
      assignedTo: ticket.assigned_name ?? undefined,
      customer: {
        name: ticket.customer_name,
        email: ticket.customer_email
      },
      tenant: {
        name: ticket.tenant_name,
        supportEmail: 'suporte@servicedesk.com' // Should be configurable
      },
      urls: {
        ticketUrl: `${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.id}`,
        portalUrl: `${process.env.APP_URL || 'http://localhost:3000'}/portal`
      }
    }
  } catch (error) {
    logger.error('Error getting ticket email data', error)
    return null
  }
}

// Interface for user database row
interface UserRow {
  id: number
  name: string
  email: string
  tenant_name: string
}

// Helper function to get user data for email
export const getUserEmailData = (userId: number, includePassword = false): UserEmailData | null => {
  try {
    const user = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        tenant.name as tenant_name
      FROM users u
      LEFT JOIN tenants tenant ON u.tenant_id = tenant.id
      WHERE u.id = ?
    `).get(userId) as UserRow | undefined

    if (!user) return null

    return {
      name: user.name,
      email: user.email,
      password: includePassword ? generateTempPassword() : undefined,
      tenant: {
        name: user.tenant_name
      },
      urls: {
        loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login`,
        resetUrl: includePassword ? `${process.env.APP_URL || 'http://localhost:3000'}/reset-password` : undefined
      }
    }
  } catch (error) {
    logger.error('Error getting user email data', error)
    return null
  }
}

// Generate temporary password
const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Email hooks for ticket events
export const emailHooks = {
  // Ticket created
  onTicketCreated: async (ticketId: number): Promise<void> => {
    try {
      const ticketData = getTicketEmailData(ticketId)
      if (ticketData) {
        await emailService.sendTicketCreatedEmail(ticketData)
        logger.info(`📧 Ticket created email queued for ticket ${ticketData.ticketNumber}`)
      }
    } catch (error) {
      logger.error('Error sending ticket created email', error)
    }
  },

  // Ticket updated
  onTicketUpdated: async (ticketId: number): Promise<void> => {
    try {
      const ticketData = getTicketEmailData(ticketId)
      if (ticketData) {
        await emailService.sendTicketUpdatedEmail(ticketData)
        logger.info(`📧 Ticket updated email queued for ticket ${ticketData.ticketNumber}`)
      }
    } catch (error) {
      logger.error('Error sending ticket updated email', error)
    }
  },

  // Ticket resolved
  onTicketResolved: async (ticketId: number): Promise<void> => {
    try {
      const ticketData = getTicketEmailData(ticketId)
      if (ticketData) {
        await emailService.sendTicketResolvedEmail(ticketData)
        logger.info(`📧 Ticket resolved email queued for ticket ${ticketData.ticketNumber}`)
      }
    } catch (error) {
      logger.error('Error sending ticket resolved email', error)
    }
  },

  // Ticket assigned
  onTicketAssigned: async (ticketId: number, assignedUserId: number): Promise<void> => {
    try {
      const ticketData = getTicketEmailData(ticketId)
      const userData = getUserEmailData(assignedUserId)

      if (ticketData && userData) {
        // Send notification to assigned user
        const customData: TicketEmailData = {
          ...ticketData,
          customer: {
            name: userData.name,
            email: userData.email
          },
          urls: {
            ...ticketData.urls,
            ticketUrl: `${process.env.APP_URL || 'http://localhost:3000'}/admin/tickets/${ticketId}`
          }
        }

        await emailService.sendTicketUpdatedEmail(customData)
        logger.info(`📧 Ticket assignment email queued for user ${userData.name}`)
      }
    } catch (error) {
      logger.error('Error sending ticket assignment email', error)
    }
  },

  // User created
  onUserCreated: async (userId: number, tempPassword?: string): Promise<void> => {
    try {
      const userData = getUserEmailData(userId, !!tempPassword)
      if (userData) {
        if (tempPassword) {
          userData.password = tempPassword
        }
        await emailService.sendWelcomeEmail(userData)
        logger.info(`📧 Welcome email queued for user ${userData.email}`)
      }
    } catch (error) {
      logger.error('Error sending welcome email', error)
    }
  },

  // Password reset requested
  onPasswordResetRequested: async (userId: number, resetToken: string): Promise<void> => {
    try {
      const userData = getUserEmailData(userId)
      if (userData) {
        userData.resetToken = resetToken
        userData.urls.resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`

        await emailService.sendPasswordResetEmail(userData)
        logger.info(`📧 Password reset email queued for user ${userData.email}`)
      }
    } catch (error) {
      logger.error('Error sending password reset email', error)
    }
  },

  // Comment added (for internal notifications)
  onCommentAdded: async (ticketId: number, commentId: number): Promise<void> => {
    try {
      // Interface for comment database row
      interface CommentRow {
        content: string
        is_internal: number
        author_name: string
        author_email: string
      }

      // Get comment details
      const comment = db.prepare(`
        SELECT
          c.content,
          c.is_internal,
          u.name as author_name,
          u.email as author_email
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).get(commentId) as CommentRow | undefined

      if (!comment || comment.is_internal) {
        return // Don't send emails for internal comments
      }

      const ticketData = getTicketEmailData(ticketId)
      if (ticketData) {
        // Add comment to the email data
        const emailData: TicketEmailData = {
          ...ticketData,
          description: `Nova atualização por ${comment.author_name}:\n\n${comment.content}`
        }

        await emailService.sendTicketUpdatedEmail(emailData)
        logger.info(`📧 Comment notification email queued for ticket ${ticketData.ticketNumber}`)
      }
    } catch (error) {
      logger.error('Error sending comment notification email', error)
    }
  }
}

// Utility function to process email queue periodically
export const processEmailQueuePeriodically = async (): Promise<void> => {
  try {
    await emailService.processEmailQueue(50) // Process up to 50 emails
    logger.info('📧 Email queue processed')
  } catch (error) {
    logger.error('Error processing email queue', error)
  }
}

// Set up periodic email processing (every 2 minutes in production)
if (process.env.NODE_ENV === 'production') {
  setInterval(processEmailQueuePeriodically, 2 * 60 * 1000)
} else {
  // More frequent in development for testing
  setInterval(processEmailQueuePeriodically, 30 * 1000)
}

export default emailHooks