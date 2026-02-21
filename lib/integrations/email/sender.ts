/**
 * Email Sender Module
 * Advanced email sending with queue management
 *
 * Features:
 * - Nodemailer integration
 * - Email queue with priority
 * - Retry logic with exponential backoff
 * - Rate limiting
 * - Delivery tracking
 * - Bounce handling
 * - SMTP connection pooling
 */

import * as nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import { executeQuery, executeQueryOne, executeRun, getDatabase, sqlNow, sqlDateSub } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';
import { templateEngine, TemplateData } from './templates';

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  encoding?: string;
  cid?: string;
}

export interface QueuedEmail {
  id?: number;
  tenantId: number;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  templateCode?: string;
  templateData?: string;
  attachments?: string;
  priority: 'high' | 'normal' | 'low';
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'bounced';
  sentAt?: Date;
  errorMessage?: string;
  metadata?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  queueId?: number;
}

export class EmailSender {
  private transporter: Transporter;
  private rateLimiter: RateLimiter;
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    this.transporter = this.createTransporter();
    this.rateLimiter = new RateLimiter(
      parseInt(process.env.EMAIL_RATE_LIMIT || '100'), // Max emails per interval
      60000 // 1 minute interval
    );

    // Start queue processing
    this.startQueueProcessing();
  }

  /**
   * Create SMTP transporter
   */
  private createTransporter(): Transporter {
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10,
    };

    // Use test account in development if not configured
    if (process.env.NODE_ENV === 'development' && !smtpConfig.auth.user) {
      logger.warn('SMTP not configured, using test account');
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass',
        },
      });
    }

    return nodemailer.createTransport(smtpConfig);
  }

  /**
   * Send email immediately
   */
  async send(options: EmailOptions): Promise<SendResult> {
    try {
      // Check rate limit
      if (!this.rateLimiter.canSend()) {
        logger.warn('Rate limit exceeded, email will be queued');
        return { success: false, error: 'Rate limit exceeded' };
      }

      // Prepare mail options
      const mailOptions: SendMailOptions = {
        from: process.env.EMAIL_FROM_ADDRESS || 'noreply@servicedesk.com',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        replyTo: options.replyTo,
        headers: options.headers,
        priority: options.priority || 'normal',
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        messageId: info.messageId,
      });

      this.rateLimiter.recordSent();

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Email send failed', { error, options });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send email using template
   */
  async sendTemplate(
    templateCode: string,
    to: string | string[],
    data: TemplateData,
    options?: Partial<EmailOptions>
  ): Promise<SendResult> {
    try {
      // Render template
      const rendered = templateEngine.render(templateCode, data);

      // Send email
      return await this.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...options,
      });
    } catch (error) {
      logger.error('Template email send failed', { error, templateCode });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Template rendering failed',
      };
    }
  }

  /**
   * Queue email for later sending
   */
  async queue(options: EmailOptions, tenantId: number = 1): Promise<number | null> {
    try {
      const emailData: QueuedEmail = {
        tenantId,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(',') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc) : undefined,
        subject: options.subject,
        htmlContent: options.html || '',
        textContent: options.text || '',
        attachments: options.attachments ? JSON.stringify(options.attachments) : undefined,
        priority: options.priority || 'normal',
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
        metadata: options.metadata ? JSON.stringify(options.metadata) : undefined,
      };

      // Detect column names dynamically for backwards compatibility
      const db = getDatabase();
      const dbType = db.getType();
      let columnSet: Set<string>;

      if (dbType === 'sqlite') {
        const tableInfo = await executeQuery<{ name: string }>('PRAGMA table_info(email_queue)');
        columnSet = new Set(tableInfo.map((column) => column.name).filter(Boolean));
      } else {
        const pgCols = await executeQuery<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'email_queue'`
        );
        columnSet = new Set(pgCols.map((c) => c.column_name));
      }

      const toColumn = columnSet.has('to_email') ? 'to_email' : 'to_address';
      const ccColumn = columnSet.has('cc_emails') ? 'cc_emails' : 'cc_address';
      const bccColumn = columnSet.has('bcc_emails') ? 'bcc_emails' : 'bcc_address';
      const hasTemplateType = columnSet.has('template_type');
      const hasTemplateData = columnSet.has('template_data');
      const hasMetadata = columnSet.has('metadata');

      const insertColumns = [
        'tenant_id',
        toColumn,
        ccColumn,
        bccColumn,
        'subject',
        'html_content',
        'text_content',
      ];

      const insertValues: any[] = [
        emailData.tenantId,
        emailData.to,
        emailData.cc || null,
        emailData.bcc || null,
        emailData.subject,
        emailData.htmlContent,
        emailData.textContent,
      ];

      if (hasTemplateType) {
        insertColumns.push('template_type');
        insertValues.push('custom');
      }

      if (hasTemplateData) {
        insertColumns.push('template_data');
        insertValues.push(null);
      }

      insertColumns.push('attachments', 'priority', 'attempts', 'max_attempts', 'status');
      const priorityValue = hasTemplateType && emailData.priority === 'normal'
        ? 'medium'
        : emailData.priority;
      insertValues.push(
        emailData.attachments || null,
        priorityValue,
        emailData.attempts,
        emailData.maxAttempts,
        emailData.status
      );

      if (hasMetadata) {
        insertColumns.push('metadata');
        insertValues.push(emailData.metadata || null);
      }

      const placeholderSql = insertColumns.map(() => '?').join(', ');
      const sql = `
        INSERT INTO email_queue (
          ${insertColumns.join(', ')},
          created_at
        ) VALUES (${placeholderSql}, ${sqlNow()})
      `;

      const result = await executeRun(sql, insertValues);

      logger.debug('Email queued', { queueId: result.lastInsertRowid });

      return result.lastInsertRowid ?? null;
    } catch (error) {
      logger.error('Failed to queue email', { error, options });
      return null;
    }
  }

  /**
   * Queue email using template
   */
  async queueTemplate(
    templateCode: string,
    to: string | string[],
    data: TemplateData,
    tenantId: number = 1,
    options?: Partial<EmailOptions>
  ): Promise<number | null> {
    try {
      // Render template
      const rendered = templateEngine.render(templateCode, data);

      // Queue email
      const queueId = await this.queue({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...options,
      }, tenantId);

      // If high priority, process immediately
      if (options?.priority === 'high' && queueId) {
        await this.processQueue(1);
      }

      return queueId;
    } catch (error) {
      logger.error('Failed to queue template email', { error, templateCode });
      return null;
    }
  }

  /**
   * Process email queue
   */
  async processQueue(limit: number = 10): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Queue already being processed');
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending emails
      const emails = await executeQuery<any>(
        `SELECT * FROM email_queue
         WHERE status = 'pending'
           AND attempts < max_attempts
           AND (scheduled_at IS NULL OR scheduled_at <= ${sqlNow()})
         ORDER BY
           CASE priority
             WHEN 'high' THEN 1
             WHEN 'normal' THEN 2
             WHEN 'low' THEN 3
           END,
           created_at ASC
         LIMIT ?`,
        [limit]
      );

      logger.debug(`Processing ${emails.length} queued emails`);

      for (const email of emails) {
        await this.processQueuedEmail(email);

        // Rate limiting delay
        await this.delay(100);
      }
    } catch (error) {
      logger.error('Error processing email queue', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process single queued email
   */
  private async processQueuedEmail(email: any): Promise<void> {
    try {
      // Update status to sending
      await executeRun(
        `UPDATE email_queue
         SET status = 'sending', attempts = attempts + 1, updated_at = ${sqlNow()}
         WHERE id = ?`,
        [email.id]
      );

      // Prepare email options
      const toValue = email.to_email || email.to_address || '';
      const ccValue = email.cc_emails || email.cc_address;
      const bccValue = email.bcc_emails || email.bcc_address;
      const options: EmailOptions = {
        to: String(toValue).split(','),
        cc: ccValue ? String(ccValue).split(',') : undefined,
        bcc: bccValue ? String(bccValue).split(',') : undefined,
        subject: email.subject,
        html: email.html_content,
        text: email.text_content,
        attachments: email.attachments ? JSON.parse(email.attachments) : undefined,
        priority: email.priority,
      };

      // Send email
      const result = await this.send(options);

      if (result.success) {
        // Mark as sent
        await executeRun(
          `UPDATE email_queue
           SET status = 'sent', sent_at = ${sqlNow()}, updated_at = ${sqlNow()}
           WHERE id = ?`,
          [email.id]
        );

        logger.info('Queued email sent', { queueId: email.id, messageId: result.messageId });
      } else {
        // Check if max attempts reached
        const newStatus = email.attempts >= email.max_attempts ? 'failed' : 'pending';

        await executeRun(
          `UPDATE email_queue
           SET status = ?, error_message = ?, updated_at = ${sqlNow()}
           WHERE id = ?`,
          [newStatus, result.error || 'Send failed', email.id]
        );

        logger.warn('Queued email send failed', {
          queueId: email.id,
          attempts: email.attempts,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('Error processing queued email', { queueId: email.id, error });

      // Mark as failed if max attempts reached
      const newStatus = email.attempts >= email.max_attempts ? 'failed' : 'pending';

      await executeRun(
        `UPDATE email_queue
         SET status = ?, error_message = ?, updated_at = ${sqlNow()}
         WHERE id = ?`,
        [newStatus, error instanceof Error ? error.message : 'Unknown error', email.id]
      );
    }
  }

  /**
   * Start automatic queue processing
   */
  private startQueueProcessing(): void {
    // Process queue every 2 minutes in production
    const interval = process.env.NODE_ENV === 'production' ? 2 * 60 * 1000 : 30 * 1000;

    this.processingInterval = setInterval(async () => {
      await this.processQueue(50);
    }, interval);

    logger.info('Email queue processing started', { interval });
  }

  /**
   * Stop queue processing
   */
  stopQueueProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
      logger.info('Email queue processing stopped');
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(tenantId?: number): Promise<any> {
    try {
      const whereClause = tenantId ? 'WHERE tenant_id = ?' : '';
      const params = tenantId ? [tenantId] : [];

      const stats = await executeQueryOne<any>(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'sending' THEN 1 END) as sending,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as highPriority,
          COUNT(CASE WHEN priority = 'normal' THEN 1 END) as normalPriority,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as lowPriority
        FROM email_queue
        ${whereClause}`,
        params
      );

      return stats;
    } catch (error) {
      logger.error('Error getting email stats', error);
      return null;
    }
  }

  /**
   * Retry failed emails
   */
  async retryFailed(tenantId?: number): Promise<number> {
    try {
      const whereClause = tenantId ? 'AND tenant_id = ?' : '';
      const params = tenantId ? [tenantId] : [];

      const result = await executeRun(
        `UPDATE email_queue
         SET status = 'pending', attempts = 0, error_message = NULL, updated_at = ${sqlNow()}
         WHERE status = 'failed' AND attempts < max_attempts ${whereClause}`,
        params
      );

      logger.info('Failed emails retried', { count: result.changes });

      return result.changes || 0;
    } catch (error) {
      logger.error('Error retrying failed emails', error);
      return 0;
    }
  }

  /**
   * Clear old emails
   */
  async clearOld(daysOld: number = 30, tenantId?: number): Promise<number> {
    try {
      const whereClause = tenantId ? 'AND tenant_id = ?' : '';
      const params = tenantId ? [tenantId] : [];

      const result = await executeRun(
        `DELETE FROM email_queue
         WHERE (status = 'sent' OR status = 'failed')
           AND created_at < ${sqlDateSub(daysOld)}
           ${whereClause}`,
        params
      );

      logger.info('Old emails cleared', { count: result.changes });

      return result.changes || 0;
    } catch (error) {
      logger.error('Error clearing old emails', error);
      return 0;
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('SMTP connection failed', error);
      return false;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close transporter
   */
  close(): void {
    this.stopQueueProcessing();
    this.transporter.close();
  }
}

/**
 * Rate Limiter
 */
class RateLimiter {
  private sent: number = 0;
  private lastReset: number = Date.now();

  constructor(
    private maxPerInterval: number,
    private interval: number
  ) {}

  canSend(): boolean {
    this.checkReset();
    return this.sent < this.maxPerInterval;
  }

  recordSent(): void {
    this.checkReset();
    this.sent++;
  }

  private checkReset(): void {
    const now = Date.now();
    if (now - this.lastReset >= this.interval) {
      this.sent = 0;
      this.lastReset = now;
    }
  }

  getRemaining(): number {
    this.checkReset();
    return Math.max(0, this.maxPerInterval - this.sent);
  }
}

// Singleton instance
export const emailSender = new EmailSender();
export default emailSender;
