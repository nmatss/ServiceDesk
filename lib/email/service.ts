import { createEmailTransporter, getFromAddress } from './config'
import { logger } from '../monitoring/logger';
import {
  emailTemplates,
  compileTemplate,
  TicketEmailData,
  UserEmailData
} from './templates'
import db from '@/lib/db/connection'

export interface EmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  text: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    contentType?: string
  }>
}

export interface QueuedEmail {
  id?: number
  tenant_id: number
  to_email: string
  cc_emails?: string
  bcc_emails?: string
  subject: string
  html_content: string
  text_content: string
  template_type: string
  template_data?: string
  attachments?: string
  priority: 'high' | 'medium' | 'low'
  scheduled_at?: Date
  attempts: number
  max_attempts: number
  status: 'pending' | 'sending' | 'sent' | 'failed'
  sent_at?: Date
  error_message?: string
  created_at: Date
}

class EmailService {
  private transporter: any

  constructor() {
    this.transporter = createEmailTransporter()
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: getFromAddress(),
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments
      }

      const result = await this.transporter.sendMail(mailOptions)

      if (process.env.NODE_ENV === 'development') {
        logger.info('📧 Email sent', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          messageId: result.messageId
        })
      }

      return true
    } catch (error) {
      logger.error('❌ Email sending failed', error)
      return false
    }
  }

  async queueEmail(email: Partial<QueuedEmail>): Promise<number | null> {
    try {
      const result = db.prepare(`
        INSERT INTO email_queue (
          tenant_id, to_email, cc_emails, bcc_emails, subject,
          html_content, text_content, template_type, template_data,
          attachments, priority, scheduled_at, attempts, max_attempts,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        email.tenant_id,
        email.to_email,
        email.cc_emails || null,
        email.bcc_emails || null,
        email.subject,
        email.html_content,
        email.text_content,
        email.template_type,
        email.template_data || null,
        email.attachments || null,
        email.priority || 'medium',
        email.scheduled_at || null,
        0, // attempts
        email.max_attempts || 3,
        'pending',
        new Date().toISOString()
      )

      return result.lastInsertRowid as number
    } catch (error) {
      logger.error('Error queueing email', error)
      return null
    }
  }

  async processEmailQueue(limit: number = 10): Promise<void> {
    try {
      const pendingEmails = db.prepare(`
        SELECT * FROM email_queue
        WHERE status = 'pending'
          AND attempts < max_attempts
          AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
        ORDER BY
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at ASC
        LIMIT ?
      `).all(limit) as QueuedEmail[]

      for (const email of pendingEmails) {
        await this.processQueuedEmail(email)
      }
    } catch (error) {
      logger.error('Error processing email queue', error)
    }
  }

  private async processQueuedEmail(email: QueuedEmail): Promise<void> {
    try {
      // Update status to sending
      db.prepare(`
        UPDATE email_queue
        SET status = 'sending', attempts = attempts + 1
        WHERE id = ?
      `).run(email.id)

      const emailOptions: EmailOptions = {
        to: email.to_email,
        cc: email.cc_emails ? email.cc_emails.split(',') : undefined,
        bcc: email.bcc_emails ? email.bcc_emails.split(',') : undefined,
        subject: email.subject,
        html: email.html_content,
        text: email.text_content,
        attachments: email.attachments ? JSON.parse(email.attachments) : undefined
      }

      const success = await this.sendEmail(emailOptions)

      if (success) {
        db.prepare(`
          UPDATE email_queue
          SET status = 'sent', sent_at = datetime('now')
          WHERE id = ?
        `).run(email.id)
      } else {
        const status = email.attempts >= email.max_attempts ? 'failed' : 'pending'
        db.prepare(`
          UPDATE email_queue
          SET status = ?, error_message = ?
          WHERE id = ?
        `).run(status, 'Failed to send email', email.id)
      }
    } catch (error) {
      const status = email.attempts >= email.max_attempts ? 'failed' : 'pending'
      db.prepare(`
        UPDATE email_queue
        SET status = ?, error_message = ?
        WHERE id = ?
      `).run(status, error instanceof Error ? error.message : 'Unknown error', email.id)
    }
  }

  async sendTicketCreatedEmail(data: TicketEmailData): Promise<boolean> {
    const template = emailTemplates.ticketCreated
    const subject = compileTemplate(template.subject, data)
    const html = compileTemplate(template.html, data)
    const text = compileTemplate(template.text, data)

    const queueId = await this.queueEmail({
      tenant_id: 1, // Should be dynamic based on tenant
      to_email: data.customer.email,
      subject,
      html_content: html,
      text_content: text,
      template_type: 'ticket_created',
      template_data: JSON.stringify(data),
      priority: 'high'
    })

    if (queueId) {
      // Process immediately for high priority emails
      await this.processEmailQueue(1)
      return true
    }

    return false
  }

  async sendTicketUpdatedEmail(data: TicketEmailData): Promise<boolean> {
    const template = emailTemplates.ticketUpdated
    const subject = compileTemplate(template.subject, data)
    const html = compileTemplate(template.html, data)
    const text = compileTemplate(template.text, data)

    const queueId = await this.queueEmail({
      tenant_id: 1,
      to_email: data.customer.email,
      subject,
      html_content: html,
      text_content: text,
      template_type: 'ticket_updated',
      template_data: JSON.stringify(data),
      priority: 'medium'
    })

    return !!queueId
  }

  async sendTicketResolvedEmail(data: TicketEmailData): Promise<boolean> {
    const template = emailTemplates.ticketResolved
    const subject = compileTemplate(template.subject, data)
    const html = compileTemplate(template.html, data)
    const text = compileTemplate(template.text, data)

    const queueId = await this.queueEmail({
      tenant_id: 1,
      to_email: data.customer.email,
      subject,
      html_content: html,
      text_content: text,
      template_type: 'ticket_resolved',
      template_data: JSON.stringify(data),
      priority: 'high'
    })

    if (queueId) {
      await this.processEmailQueue(1)
      return true
    }

    return false
  }

  async sendWelcomeEmail(data: UserEmailData): Promise<boolean> {
    const template = emailTemplates.welcomeUser
    const subject = compileTemplate(template.subject, data)
    const html = compileTemplate(template.html, data)
    const text = compileTemplate(template.text, data)

    const queueId = await this.queueEmail({
      tenant_id: 1,
      to_email: data.email,
      subject,
      html_content: html,
      text_content: text,
      template_type: 'welcome_user',
      template_data: JSON.stringify(data),
      priority: 'medium'
    })

    return !!queueId
  }

  async sendPasswordResetEmail(data: UserEmailData): Promise<boolean> {
    const template = emailTemplates.passwordReset
    const subject = compileTemplate(template.subject, data)
    const html = compileTemplate(template.html, data)
    const text = compileTemplate(template.text, data)

    const queueId = await this.queueEmail({
      tenant_id: 1,
      to_email: data.email,
      subject,
      html_content: html,
      text_content: text,
      template_type: 'password_reset',
      template_data: JSON.stringify(data),
      priority: 'high'
    })

    if (queueId) {
      await this.processEmailQueue(1)
      return true
    }

    return false
  }

  async getEmailStats(tenantId: number = 1): Promise<any> {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM email_queue
      WHERE tenant_id = ?
    `).get(tenantId)

    return stats
  }
}

// Create email queue table if it doesn't exist
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      to_email TEXT NOT NULL,
      cc_emails TEXT,
      bcc_emails TEXT,
      subject TEXT NOT NULL,
      html_content TEXT NOT NULL,
      text_content TEXT NOT NULL,
      template_type TEXT NOT NULL,
      template_data TEXT,
      attachments TEXT,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
      scheduled_at DATETIME,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
      sent_at DATETIME,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
    CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority);
    CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_email_queue_tenant ON email_queue(tenant_id);
  `)
} catch (error) {
  logger.error('Error creating email_queue table', error)
}

export const emailService = new EmailService()
export default emailService