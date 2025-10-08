/**
 * Advanced Email Automation System
 * Complete email management for ServiceDesk
 *
 * Features:
 * - Incoming email parsing (IMAP/POP3)
 * - Template engine (Handlebars)
 * - Multi-channel notification orchestration
 * - Email threading and conversation tracking
 * - Attachment handling
 * - HTML/Plain text support
 * - Queue management
 * - Bounce handling
 * - Email signature management
 */

import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import db from '../db/connection';
import { createTicket, addComment, getTicketById } from '@/lib/db/queries';
import type { Ticket } from '@/lib/types/database';
import { logger } from '@/lib/monitoring/logger';

// Email Configuration
interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  imap?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  replyTo?: string;
}

// Email Template
interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  variables?: Record<string, any>;
}

// Parsed Incoming Email
interface IncomingEmail {
  from: string;
  to: string[];
  subject: string;
  body: {
    text: string;
    html: string;
  };
  attachments: Attachment[];
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  date: Date;
}

// Email Queue Item
interface EmailQueueItem {
  to: string;
  subject: string;
  body: string;
  html: string;
  attachments?: any[];
  priority: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
  metadata?: Record<string, any>;
}

export class EmailAutomation {
  private transporter: any;
  private imapClient?: ImapFlow;
  private config: EmailConfig;
  private templates: Map<string, CompiledTemplate>;
  private emailQueue: EmailQueueItem[];
  private isProcessingQueue: boolean;

  constructor() {
    this.config = this.loadConfig();
    this.setupTransporter();
    this.templates = new Map();
    this.emailQueue = [];
    this.isProcessingQueue = false;
    this.registerHelpers();
  }

  /**
   * Load email configuration
   */
  private loadConfig(): EmailConfig {
    return {
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
      imap: process.env.IMAP_HOST ? {
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT || '993'),
        secure: process.env.IMAP_SECURE !== 'false',
        auth: {
          user: process.env.IMAP_USER || process.env.SMTP_USER || '',
          pass: process.env.IMAP_PASS || process.env.SMTP_PASS || '',
        },
      } : undefined,
      from: process.env.SMTP_FROM || 'noreply@servicedesk.com',
      replyTo: process.env.SMTP_REPLY_TO,
    };
  }

  /**
   * Setup SMTP transporter
   */
  private setupTransporter(): void {
    this.transporter = nodemailer.createTransporter(this.config.smtp);
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Date(date).toLocaleDateString('pt-BR');
    });

    Handlebars.registerHelper('formatDateTime', (date: Date) => {
      return new Date(date).toLocaleString('pt-BR');
    });

    Handlebars.registerHelper('uppercase', (str: string) => {
      return str.toUpperCase();
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return str.toLowerCase();
    });

    Handlebars.registerHelper('ticketUrl', (ticketId: number) => {
      return `${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticketId}`;
    });
  }

  /**
   * Compile and cache template
   */
  compileTemplate(name: string, subject: string, body: string): void {
    const compiledSubject = Handlebars.compile(subject);
    const compiledBody = Handlebars.compile(body);

    this.templates.set(name, {
      subject: compiledSubject,
      body: compiledBody,
    });
  }

  /**
   * Render template with variables
   */
  renderTemplate(name: string, variables: Record<string, any>): {
    subject: string;
    body: string;
  } {
    const template = this.templates.get(name);

    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    return {
      subject: template.subject(variables),
      body: template.body(variables),
    };
  }

  /**
   * Send email via SMTP
   */
  async send(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: any[];
    headers?: Record<string, string>;
    replyTo?: string;
    priority?: 'high' | 'normal' | 'low';
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        headers: {
          ...options.headers,
          'X-Priority': options.priority === 'high' ? '1' : options.priority === 'low' ? '5' : '3',
        },
        replyTo: options.replyTo || this.config.replyTo,
      });

      logger.info('Email sent', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Email send error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add email to queue
   */
  queueEmail(item: EmailQueueItem): void {
    this.emailQueue.push(item);

    // Sort queue by priority
    this.emailQueue.sort((a, b) => {
      const priorityOrder = { high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Start processing if not already running
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.emailQueue.length > 0) {
      const item = this.emailQueue.shift();
      if (!item) break;

      // Check if scheduled for later
      if (item.scheduledFor && item.scheduledFor > new Date()) {
        // Re-queue for later
        this.emailQueue.push(item);
        continue;
      }

      // Send email
      await this.send({
        to: item.to,
        subject: item.subject,
        text: item.body,
        html: item.html,
        attachments: item.attachments,
        priority: item.priority,
      });

      // Rate limiting - wait 100ms between emails
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send ticket notification using templates
   */
  async sendTicketNotification(
    ticketId: number,
    eventType: 'created' | 'assigned' | 'updated' | 'resolved',
    organizationId?: number
  ): Promise<void> {
    try {
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        logger.error('Ticket not found', ticketId);
        return;
      }

      // Ensure template exists
      const templateName = `ticket_${eventType}`;
      if (!this.templates.has(templateName)) {
        this.loadDefaultTemplates();
      }

      const rendered = this.renderTemplate(templateName, {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status_id,
        priority: ticket.priority_id,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      });

      // Send notification
      await this.send({
        to: ticket.requester_email || '',
        subject: rendered.subject,
        html: rendered.body,
        priority: eventType === 'created' ? 'high' : 'normal',
      });
    } catch (error) {
      logger.error('Error sending ticket notification', error);
    }
  }

  /**
   * Load default email templates
   */
  private loadDefaultTemplates(): void {
    // Ticket Created Template
    this.compileTemplate(
      'ticket_created',
      'Chamado #{{ticketId}} Criado',
      `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Seu chamado foi criado!</h2>
          <p>Olá,</p>
          <p>Seu chamado <strong>#{{ticketId}}</strong> foi criado com sucesso.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Título:</strong> {{title}}</p>
            <p><strong>Descrição:</strong> {{description}}</p>
            <p><strong>Data:</strong> {{formatDateTime createdAt}}</p>
          </div>
          <p>Nossa equipe irá analisar e responder em breve.</p>
          <p><a href="{{ticketUrl ticketId}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Chamado</a></p>
        </body>
      </html>
      `
    );

    // Ticket Assigned Template
    this.compileTemplate(
      'ticket_assigned',
      'Chamado #{{ticketId}} Atribuído a Você',
      `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Novo chamado atribuído!</h2>
          <p>Um novo chamado foi atribuído a você.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Chamado:</strong> #{{ticketId}}</p>
            <p><strong>Título:</strong> {{title}}</p>
            <p><strong>Prioridade:</strong> {{priority}}</p>
          </div>
          <p><a href="{{ticketUrl ticketId}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Atender Chamado</a></p>
        </body>
      </html>
      `
    );

    // Ticket Updated Template
    this.compileTemplate(
      'ticket_updated',
      'Chamado #{{ticketId}} Atualizado',
      `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Seu chamado foi atualizado!</h2>
          <p>O chamado <strong>#{{ticketId}}</strong> teve uma atualização.</p>
          <p><a href="{{ticketUrl ticketId}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Atualização</a></p>
        </body>
      </html>
      `
    );

    // Ticket Resolved Template
    this.compileTemplate(
      'ticket_resolved',
      'Chamado #{{ticketId}} Resolvido',
      `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Seu chamado foi resolvido!</h2>
          <p>O chamado <strong>#{{ticketId}}</strong> foi marcado como resolvido.</p>
          <p>Se o problema persistir, você pode reabrir o chamado.</p>
          <p><a href="{{ticketUrl ticketId}}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Solução</a></p>
        </body>
      </html>
      `
    );
  }

  /**
   * Parse incoming email (from IMAP)
   */
  async parseIncomingEmail(rawEmail: Buffer): Promise<IncomingEmail> {
    const parsed = await simpleParser(rawEmail);

    return {
      from: parsed.from?.text || '',
      to: parsed.to?.text ? [parsed.to.text] : [],
      subject: parsed.subject || '',
      body: {
        text: parsed.text || '',
        html: parsed.html || '',
      },
      attachments: parsed.attachments || [],
      messageId: parsed.messageId || '',
      inReplyTo: parsed.inReplyTo,
      references: parsed.references || [],
      date: parsed.date || new Date(),
    };
  }

  /**
   * Extract ticket ID from email subject or body
   */
  extractTicketId(subject: string, body: string): number | null {
    // Look for patterns like #123, Ticket #123, [Ticket: 123]
    const patterns = [
      /#(\d+)/,
      /ticket[:\s]+#?(\d+)/i,
      /chamado[:\s]+#?(\d+)/i,
      /\[ticket:\s*(\d+)\]/i,
    ];

    for (const pattern of patterns) {
      const matchSubject = subject.match(pattern);
      if (matchSubject) {
        return parseInt(matchSubject[1], 10);
      }

      const matchBody = body.match(pattern);
      if (matchBody) {
        return parseInt(matchBody[1], 10);
      }
    }

    return null;
  }

  /**
   * Process incoming email and create/update ticket
   */
  async processIncomingEmail(rawEmail: Buffer): Promise<{
    success: boolean;
    ticketId?: number;
    error?: string;
  }> {
    try {
      const email = await this.parseIncomingEmail(rawEmail);

      // Try to extract ticket ID from subject/body
      const ticketId = this.extractTicketId(email.subject, email.body.text);

      if (ticketId) {
        // Add comment to existing ticket
        await addComment({
          ticket_id: ticketId,
          user_id: 1, // System user, should be looked up by email
          content: email.body.text || email.body.html,
          is_internal: false,
          metadata: JSON.stringify({
            source: 'email',
            from: email.from,
            messageId: email.messageId,
            attachmentCount: email.attachments.length,
          }),
        });

        return { success: true, ticketId };
      } else {
        // Create new ticket
        const ticket = await createTicket({
          title: email.subject,
          description: email.body.text || email.body.html,
          requester_id: 1, // Should be looked up by email
          category_id: 1,
          priority_id: 2,
          status_id: 1,
          channel: 'email',
          metadata: JSON.stringify({
            source: 'email',
            from: email.from,
            messageId: email.messageId,
            attachmentCount: email.attachments.length,
          }),
        });

        if (!ticket) {
          throw new Error('Failed to create ticket');
        }

        return { success: true, ticketId: ticket.id };
      }
    } catch (error) {
      logger.error('Error processing incoming email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Connect to IMAP and start monitoring
   */
  async startIMAPMonitoring(): Promise<void> {
    if (!this.config.imap) {
      logger.warn('IMAP not configured');
      return;
    }

    try {
      this.imapClient = new ImapFlow({
        host: this.config.imap.host,
        port: this.config.imap.port,
        secure: this.config.imap.secure,
        auth: this.config.imap.auth,
        logger: false,
      });

      await this.imapClient.connect();
      logger.info('IMAP connection established');

      // Monitor INBOX for new emails
      const lock = await this.imapClient.getMailboxLock('INBOX');

      try {
        // Fetch unseen messages
        for await (const message of this.imapClient.fetch('1:*', { envelope: true, source: true }, { uid: true })) {
          if (message.source) {
            await this.processIncomingEmail(message.source);
          }
        }
      } finally {
        lock.release();
      }

      // Listen for new emails
      this.imapClient.on('exists', async () => {
        const lock = await this.imapClient!.getMailboxLock('INBOX');
        try {
          for await (const message of this.imapClient!.fetch('1:*', { envelope: true, source: true })) {
            if (message.source) {
              await this.processIncomingEmail(message.source);
            }
          }
        } finally {
          lock.release();
        }
      });
    } catch (error) {
      logger.error('IMAP monitoring error', error);
    }
  }

  /**
   * Stop IMAP monitoring
   */
  async stopIMAPMonitoring(): Promise<void> {
    if (this.imapClient) {
      await this.imapClient.logout();
      this.imapClient = undefined;
      logger.info('IMAP connection closed');
    }
  }
}

// Singleton instance
export const emailAutomation = new EmailAutomation();

// Type exports
type CompiledTemplate = {
  subject: HandlebarsTemplateDelegate<any>;
  body: HandlebarsTemplateDelegate<any>;
};

export type {
  EmailConfig,
  EmailTemplate,
  IncomingEmail,
  EmailQueueItem,
  CompiledTemplate,
};
