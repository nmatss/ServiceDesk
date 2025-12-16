/**
 * Email Parser Module
 * Handles incoming email parsing from IMAP/POP3 or webhooks
 *
 * Features:
 * - Parse email headers, body, attachments
 * - Extract sender information and match to users
 * - Handle email threading and reply detection
 * - Detect ticket references in subject/body
 * - Support for HTML and plain text emails
 * - Attachment extraction and validation
 */

import { simpleParser, Attachment, AddressObject } from 'mailparser';
import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';

export interface ParsedEmail {
  // Header information
  messageId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  date: Date;

  // Threading information
  inReplyTo?: string;
  references: string[];

  // Body content
  body: {
    text: string;
    html: string;
  };

  // Attachments
  attachments: ParsedAttachment[];

  // Metadata
  headers: Record<string, string | string[]>;
  priority?: 'high' | 'normal' | 'low';

  // Ticket reference detection
  ticketReference?: {
    ticketId: number;
    ticketNumber: string;
    foundIn: 'subject' | 'body' | 'references';
  };

  // User matching
  senderUser?: {
    id: number;
    email: string;
    name: string;
    tenantId: number;
  };
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId?: string;
  inline: boolean;
}

export class EmailParser {
  /**
   * Parse raw email buffer
   */
  async parse(rawEmail: Buffer | string): Promise<ParsedEmail> {
    try {
      const parsed = await simpleParser(rawEmail);

      const parsedEmail: ParsedEmail = {
        messageId: parsed.messageId || this.generateMessageId(),
        from: this.parseAddress(parsed.from),
        to: this.parseAddressList(parsed.to),
        cc: this.parseAddressList(parsed.cc),
        bcc: this.parseAddressList(parsed.bcc),
        replyTo: parsed.replyTo ? this.parseAddress(parsed.replyTo) : undefined,
        subject: parsed.subject || '(No Subject)',
        date: parsed.date || new Date(),
        inReplyTo: parsed.inReplyTo,
        references: this.parseReferences(parsed.references),
        body: {
          text: parsed.text || '',
          html: typeof parsed.html === 'string' ? parsed.html : '',
        },
        attachments: this.parseAttachments(parsed.attachments),
        headers: this.parseHeaders(parsed.headers),
        priority: this.parsePriority(parsed.priority, parsed.headers),
      };

      // Detect ticket reference
      parsedEmail.ticketReference = this.detectTicketReference(parsedEmail);

      // Match sender to existing user
      parsedEmail.senderUser = await this.findUserByEmail(parsedEmail.from.email);

      return parsedEmail;
    } catch (error) {
      logger.error('Error parsing email', error);
      throw new Error(`Email parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse email address from AddressObject
   */
  private parseAddress(address: AddressObject | AddressObject[] | undefined): EmailAddress {
    if (!address) {
      return { email: 'unknown@unknown.com' };
    }

    const addr = Array.isArray(address) ? address[0] : address;
    const firstAddress = addr?.value?.[0];

    if (!firstAddress) {
      return { email: 'unknown@unknown.com' };
    }

    return {
      name: firstAddress.name || undefined,
      email: firstAddress.address || 'unknown@unknown.com',
    };
  }

  /**
   * Parse list of email addresses
   */
  private parseAddressList(addresses: AddressObject | AddressObject[] | undefined): EmailAddress[] {
    if (!addresses) {
      return [];
    }

    const addrArray = Array.isArray(addresses) ? addresses : [addresses];
    const result: EmailAddress[] = [];

    for (const addr of addrArray) {
      if (addr.value) {
        for (const item of addr.value) {
          result.push({
            name: item.name || undefined,
            email: item.address || 'unknown@unknown.com',
          });
        }
      }
    }

    return result;
  }

  /**
   * Parse email references for threading
   */
  private parseReferences(references: string | string[] | undefined): string[] {
    if (!references) {
      return [];
    }

    if (typeof references === 'string') {
      return references.split(/\s+/).filter(ref => ref.trim().length > 0);
    }

    return references;
  }

  /**
   * Parse attachments
   */
  private parseAttachments(attachments: Attachment[] | undefined): ParsedAttachment[] {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    return attachments.map(att => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      content: att.content,
      contentId: att.contentId,
      inline: att.contentDisposition === 'inline',
    }));
  }

  /**
   * Parse email headers
   */
  private parseHeaders(headers: Map<string, any> | undefined): Record<string, string | string[]> {
    if (!headers) {
      return {};
    }

    const result: Record<string, string | string[]> = {};

    headers.forEach((value: any, key: string) => {
      result[key.toLowerCase()] = value;
    });

    return result;
  }

  /**
   * Parse priority from headers
   */
  private parsePriority(
    priority: string | undefined,
    headers: Map<string, any> | undefined
  ): 'high' | 'normal' | 'low' {
    // Check X-Priority header (1-5 scale)
    const xPriority = headers?.get('x-priority');
    if (xPriority) {
      const priorityNum = parseInt(xPriority);
      if (priorityNum <= 2) return 'high';
      if (priorityNum >= 4) return 'low';
      return 'normal';
    }

    // Check Priority header
    if (priority) {
      const lowerPriority = priority.toLowerCase();
      if (lowerPriority.includes('high') || lowerPriority.includes('urgent')) {
        return 'high';
      }
      if (lowerPriority.includes('low')) {
        return 'low';
      }
    }

    // Check Importance header
    const importance = headers?.get('importance');
    if (importance) {
      const lowerImportance = importance.toLowerCase();
      if (lowerImportance === 'high') return 'high';
      if (lowerImportance === 'low') return 'low';
    }

    return 'normal';
  }

  /**
   * Detect ticket reference in email
   */
  private detectTicketReference(email: ParsedEmail): ParsedEmail['ticketReference'] {
    // Patterns to match: #123, [#123], Ticket #123, [Ticket: 123], etc.
    const patterns = [
      /#(\d+)/i,                           // #123
      /\[#(\d+)\]/i,                       // [#123]
      /ticket[:\s]+#?(\d+)/i,              // Ticket #123 or Ticket: 123
      /chamado[:\s]+#?(\d+)/i,             // Chamado #123
      /\[ticket[:\s]+(\d+)\]/i,            // [Ticket: 123]
      /\[chamado[:\s]+(\d+)\]/i,           // [Chamado: 123]
      /ticket-(\d+)/i,                     // ticket-123
      /TKT-(\d+)/i,                        // TKT-123
    ];

    // Try to match in subject first
    for (const pattern of patterns) {
      const match = email.subject.match(pattern);
      if (match && match[1]) {
        const ticketId = parseInt(match[1], 10);
        const ticketNumber = this.formatTicketNumber(ticketId);

        return {
          ticketId,
          ticketNumber,
          foundIn: 'subject',
        };
      }
    }

    // Try to match in body text
    for (const pattern of patterns) {
      const match = email.body.text.match(pattern);
      if (match && match[1]) {
        const ticketId = parseInt(match[1], 10);
        const ticketNumber = this.formatTicketNumber(ticketId);

        return {
          ticketId,
          ticketNumber,
          foundIn: 'body',
        };
      }
    }

    // Try to match in references (check if replying to a ticket email)
    if (email.references.length > 0) {
      for (const ref of email.references) {
        for (const pattern of patterns) {
          const match = ref.match(pattern);
          if (match && match[1]) {
            const ticketId = parseInt(match[1], 10);
            const ticketNumber = this.formatTicketNumber(ticketId);

            return {
              ticketId,
              ticketNumber,
              foundIn: 'references',
            };
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Find user by email address
   */
  private async findUserByEmail(email: string): Promise<ParsedEmail['senderUser']> {
    try {
      const user = db.prepare(`
        SELECT id, email, name, tenant_id
        FROM users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
      `).get(email) as { id: number; email: string; name: string; tenant_id: number } | undefined;

      if (!user) {
        return undefined;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenant_id,
      };
    } catch (error) {
      logger.error('Error finding user by email', { email, error });
      return undefined;
    }
  }

  /**
   * Format ticket number
   */
  private formatTicketNumber(ticketId: number): string {
    return `TKT-${String(ticketId).padStart(6, '0')}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@servicedesk.local>`;
  }

  /**
   * Extract plain text from HTML
   */
  extractTextFromHtml(html: string): string {
    // Remove HTML tags
    let text = html.replace(/<style[^>]*>.*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>.*?<\/script>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Validate email address
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if email is auto-reply or bounce
   */
  isAutoReply(email: ParsedEmail): boolean {
    // Check Auto-Submitted header
    const autoSubmitted = email.headers['auto-submitted'];
    if (autoSubmitted && autoSubmitted !== 'no') {
      return true;
    }

    // Check X-Autoreply header
    if (email.headers['x-autoreply']) {
      return true;
    }

    // Check subject for common auto-reply patterns
    const autoReplyPatterns = [
      /out of office/i,
      /automatic reply/i,
      /auto-reply/i,
      /vacation/i,
      /away/i,
      /autoreply/i,
    ];

    return autoReplyPatterns.some(pattern => pattern.test(email.subject));
  }

  /**
   * Check if email is a bounce notification
   */
  isBounce(email: ParsedEmail): boolean {
    // Check for bounce-related headers
    const bounceHeaders = [
      'x-failed-recipients',
      'x-bounced-address',
      'x-bounce-reason',
    ];

    for (const header of bounceHeaders) {
      if (email.headers[header]) {
        return true;
      }
    }

    // Check from address
    const bounceFromPatterns = [
      /mailer-daemon@/i,
      /postmaster@/i,
      /noreply@/i,
      /no-reply@/i,
    ];

    if (bounceFromPatterns.some(pattern => pattern.test(email.from.email))) {
      return true;
    }

    // Check subject
    const bounceSubjectPatterns = [
      /delivery failure/i,
      /delivery status notification/i,
      /undelivered mail/i,
      /returned mail/i,
      /mail delivery failed/i,
      /failure notice/i,
    ];

    return bounceSubjectPatterns.some(pattern => pattern.test(email.subject));
  }
}

// Singleton instance
export const emailParser = new EmailParser();
export default emailParser;
