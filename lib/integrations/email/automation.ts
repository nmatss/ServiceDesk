/**
 * Email Automation Rules Engine
 * Handle automated email workflows and business logic
 *
 * Features:
 * - Auto-create tickets from incoming emails
 * - Auto-respond with templates
 * - Routing rules based on sender/subject/content
 * - SLA notifications and escalations
 * - Auto-assignment based on rules
 * - Email threading and conversation tracking
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { sqlNow } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';
import { emailParser, ParsedEmail } from './parser';
import { emailSender } from './sender';

async function createTicket(data: any, organizationId: number) {
  const result = await executeRun(
    `INSERT INTO tickets (title, description, user_id, organization_id, category_id, priority_id, status_id, assigned_to, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()})`,
    [data.title, data.description, data.user_id, organizationId, data.category_id, data.priority_id, data.status_id, data.assigned_to || null]
  );
  return result.lastInsertRowid ? await executeQueryOne<any>('SELECT * FROM tickets WHERE id = ?', [result.lastInsertRowid]) : undefined;
}

async function addComment(data: any, _organizationId?: number) {
  const result = await executeRun(
    `INSERT INTO comments (ticket_id, user_id, content, is_internal, created_at)
     VALUES (?, ?, ?, ?, ${sqlNow()})`,
    [data.ticket_id, data.user_id, data.content, data.is_internal ? 1 : 0]
  );
  return result.lastInsertRowid;
}

async function getTicketById(ticketId: number, _organizationId?: number) {
  return await executeQueryOne<any>('SELECT * FROM tickets WHERE id = ?', [ticketId]);
}

async function updateTicket(data: any, _organizationId: number) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.status_id !== undefined) { fields.push('status_id = ?'); values.push(data.status_id); }
  if (data.assigned_to !== undefined) { fields.push('assigned_to = ?'); values.push(data.assigned_to); }
  if (fields.length > 0) {
    values.push(data.id);
    await executeRun(`UPDATE tickets SET ${fields.join(', ')}, updated_at = ${sqlNow()} WHERE id = ?`, values);
  }
}

export interface AutomationRule {
  id?: number;
  name: string;
  description?: string;
  tenantId: number;
  triggerType: 'incoming_email' | 'ticket_created' | 'ticket_updated' | 'sla_warning';
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'greaterThan' | 'lessThan';
  value: string | number;
  caseSensitive?: boolean;
}

export interface RuleAction {
  type: 'create_ticket' | 'add_comment' | 'send_email' | 'assign_to' | 'set_priority' | 'set_category' | 'set_status' | 'add_tag';
  params: Record<string, any>;
}

export interface TicketCreationParams {
  subject: string;
  description: string;
  priority?: string;
  category?: string;
  assignTo?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class EmailAutomation {
  /**
   * Process incoming email and apply automation rules
   */
  async processIncomingEmail(rawEmail: Buffer | string, tenantId: number = 1): Promise<{
    success: boolean;
    ticketId?: number;
    action?: string;
    error?: string;
  }> {
    try {
      // Parse email
      const parsedEmail = await emailParser.parse(rawEmail);

      logger.info('Processing incoming email', {
        from: parsedEmail.from.email,
        subject: parsedEmail.subject,
        hasTicketRef: !!parsedEmail.ticketReference,
      });

      // Check if auto-reply or bounce
      if (emailParser.isAutoReply(parsedEmail) || emailParser.isBounce(parsedEmail)) {
        logger.info('Ignoring auto-reply or bounce email');
        return { success: true, action: 'ignored_auto_reply' };
      }

      // Check if replying to existing ticket
      if (parsedEmail.ticketReference) {
        return await this.handleTicketReply(parsedEmail, tenantId);
      }

      // Create new ticket
      return await this.handleNewTicket(parsedEmail, tenantId);
    } catch (error) {
      logger.error('Error processing incoming email', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle reply to existing ticket
   */
  private async handleTicketReply(parsedEmail: ParsedEmail, tenantId: number): Promise<any> {
    try {
      const ticketId = parsedEmail.ticketReference!.ticketId;

      // Verify ticket exists
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        logger.warn('Ticket not found, creating new ticket', { ticketId });
        return await this.handleNewTicket(parsedEmail, tenantId);
      }

      // Get or create user
      const userId = parsedEmail.senderUser?.id || await this.getOrCreateUser(parsedEmail, tenantId);

      // Add comment to ticket
      const commentId = await addComment({
        ticket_id: ticketId,
        user_id: userId,
        content: parsedEmail.body.text || parsedEmail.body.html,
        is_internal: false,
      }, 1);

      logger.info('Comment added to ticket', { ticketId, commentId });

      // Send confirmation email
      await this.sendCommentConfirmation(ticketId, parsedEmail);

      // Notify assigned agent
      if (ticket.assigned_to) {
        await this.notifyAgentOfNewComment(ticketId, ticket.assigned_to);
      }

      // Check if ticket was closed and reopen it
      if (ticket.status_id === 4) { // Assuming 4 is closed status
        await updateTicket({ id: ticketId, status_id: 1 }, tenantId); // Reopen
        logger.info('Ticket reopened due to new comment', { ticketId });
      }

      return {
        success: true,
        ticketId,
        action: 'comment_added',
      };
    } catch (error) {
      logger.error('Error handling ticket reply', error);
      throw error;
    }
  }

  /**
   * Handle new ticket creation
   */
  private async handleNewTicket(parsedEmail: ParsedEmail, tenantId: number): Promise<any> {
    try {
      // Get or create user
      const userId = parsedEmail.senderUser?.id || await this.getOrCreateUser(parsedEmail, tenantId);

      // Extract ticket details
      const ticketData = await this.extractTicketData(parsedEmail, userId, tenantId);

      // Apply automation rules
      const rules = await this.getActiveRules(tenantId, 'incoming_email');
      const _appliedActions = await this.applyRules(parsedEmail, rules, ticketData);

      // Create ticket
      const ticket = await createTicket({
        title: ticketData.subject,
        description: ticketData.description,
        user_id: userId,
        organization_id: tenantId,
        category_id: Number(ticketData.category) || 1,
        priority_id: Number(ticketData.priority) || 2,
        status_id: 1, // Open
        assigned_to: ticketData.assignTo || undefined,
      }, tenantId);

      if (!ticket) {
        throw new Error('Failed to create ticket');
      }

      logger.info('Ticket created from email', {
        ticketId: ticket.id,
        from: parsedEmail.from.email,
        subject: parsedEmail.subject,
      });

      // Send confirmation email
      await this.sendTicketCreatedConfirmation(ticket.id, parsedEmail);

      // Notify assigned agent if assigned
      if (ticket.assigned_to) {
        await this.notifyAgentOfAssignment(ticket.id, ticket.assigned_to);
      }

      return {
        success: true,
        ticketId: ticket.id,
        action: 'ticket_created',
      };
    } catch (error) {
      logger.error('Error handling new ticket', error);
      throw error;
    }
  }

  /**
   * Extract ticket data from email
   */
  private async extractTicketData(
    parsedEmail: ParsedEmail,
    _userId: number,
    tenantId: number
  ): Promise<TicketCreationParams> {
    // Extract subject (clean it up)
    let subject = parsedEmail.subject;
    subject = subject.replace(/^(re:|fwd?:)\s*/gi, '').trim();

    // Extract description
    let description = parsedEmail.body.text || parsedEmail.body.html;

    // Truncate if too long
    if (description.length > 5000) {
      description = description.substring(0, 5000) + '\n\n... (truncated)';
    }

    // Determine priority from email priority or subject keywords
    let priority = this.detectPriority(parsedEmail);

    // Determine category from subject
    let category = await this.detectCategory(parsedEmail.subject, tenantId);

    return {
      subject,
      description,
      priority,
      category,
    };
  }

  /**
   * Detect priority from email
   */
  private detectPriority(email: ParsedEmail): string | undefined {
    // Check email priority
    if (email.priority === 'high') {
      return '3'; // High priority ID
    }

    // Check subject keywords
    const subject = email.subject.toLowerCase();
    const urgentKeywords = ['urgente', 'urgent', 'emergência', 'emergency', 'crítico', 'critical'];

    if (urgentKeywords.some(keyword => subject.includes(keyword))) {
      return '4'; // Critical priority ID
    }

    return undefined; // Use default
  }

  /**
   * Detect category from subject
   */
  private async detectCategory(subject: string, tenantId: number): Promise<string | undefined> {
    try {
      const categories = await executeQuery<any>(
        `SELECT id, name, keywords
         FROM categories
         WHERE tenant_id = ? OR tenant_id IS NULL
         ORDER BY tenant_id DESC`,
        [tenantId]
      );

      const lowerSubject = subject.toLowerCase();

      for (const category of categories) {
        if (category.keywords) {
          const keywords = category.keywords.toLowerCase().split(',');
          if (keywords.some((keyword: string) => lowerSubject.includes(keyword.trim()))) {
            return category.id.toString();
          }
        }
      }

      return undefined;
    } catch (error) {
      logger.error('Error detecting category', error);
      return undefined;
    }
  }

  /**
   * Get or create user from email
   */
  private async getOrCreateUser(parsedEmail: ParsedEmail, tenantId: number): Promise<number> {
    try {
      // Check if user exists
      const user = await executeQueryOne<{ id: number }>(
        `SELECT id FROM users
         WHERE LOWER(email) = LOWER(?) AND tenant_id = ?`,
        [parsedEmail.from.email, tenantId]
      );

      if (user) {
        return user.id;
      }

      // Create new user
      const name = parsedEmail.from.name || parsedEmail.from.email.split('@')[0];

      const result = await executeRun(
        `INSERT INTO users (email, name, role, tenant_id, is_active, created_at)
         VALUES (?, ?, 'user', ?, 1, ${sqlNow()})`,
        [parsedEmail.from.email, name, tenantId]
      );

      logger.info('User created from email', {
        userId: result.lastInsertRowid,
        email: parsedEmail.from.email,
      });

      return result.lastInsertRowid!;
    } catch (error) {
      logger.error('Error getting or creating user', error);
      throw new Error('Failed to get or create user');
    }
  }

  /**
   * Get active automation rules
   */
  private async getActiveRules(tenantId: number, triggerType: string): Promise<AutomationRule[]> {
    try {
      const rules = await executeQuery<any>(
        `SELECT * FROM email_automation_rules
         WHERE tenant_id = ? AND trigger_type = ? AND is_active = 1
         ORDER BY priority DESC, id ASC`,
        [tenantId, triggerType]
      );

      return rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        tenantId: rule.tenant_id,
        triggerType: rule.trigger_type,
        conditions: JSON.parse(rule.conditions || '[]'),
        actions: JSON.parse(rule.actions || '[]'),
        priority: rule.priority,
        isActive: rule.is_active === 1,
      }));
    } catch (error) {
      logger.error('Error getting automation rules', error);
      return [];
    }
  }

  /**
   * Apply automation rules
   */
  private async applyRules(
    email: ParsedEmail,
    rules: AutomationRule[],
    ticketData: TicketCreationParams
  ): Promise<string[]> {
    const appliedActions: string[] = [];

    for (const rule of rules) {
      if (this.evaluateConditions(email, rule.conditions)) {
        logger.debug('Automation rule matched', { ruleId: rule.id, ruleName: rule.name });

        for (const action of rule.actions) {
          this.applyAction(action, ticketData);
          appliedActions.push(`${rule.name}: ${action.type}`);
        }
      }
    }

    return appliedActions;
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(email: ParsedEmail, conditions: RuleCondition[]): boolean {
    if (conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      if (!this.evaluateCondition(email, condition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(email: ParsedEmail, condition: RuleCondition): boolean {
    let fieldValue: any;

    // Get field value
    switch (condition.field) {
      case 'from':
        fieldValue = email.from.email;
        break;
      case 'subject':
        fieldValue = email.subject;
        break;
      case 'body':
        fieldValue = email.body.text;
        break;
      case 'priority':
        fieldValue = email.priority;
        break;
      default:
        fieldValue = '';
    }

    // Convert to string for comparison
    const valueStr = String(fieldValue);
    const conditionValueStr = String(condition.value);

    // Apply case sensitivity
    const compareValue = condition.caseSensitive ? valueStr : valueStr.toLowerCase();
    const compareWith = condition.caseSensitive ? conditionValueStr : conditionValueStr.toLowerCase();

    // Evaluate operator
    switch (condition.operator) {
      case 'equals':
        return compareValue === compareWith;
      case 'contains':
        return compareValue.includes(compareWith);
      case 'startsWith':
        return compareValue.startsWith(compareWith);
      case 'endsWith':
        return compareValue.endsWith(compareWith);
      case 'matches':
        try {
          const regex = new RegExp(conditionValueStr, condition.caseSensitive ? '' : 'i');
          return regex.test(valueStr);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Apply automation action
   */
  private applyAction(action: RuleAction, ticketData: TicketCreationParams): void {
    switch (action.type) {
      case 'set_priority':
        ticketData.priority = action.params.priorityId;
        break;
      case 'set_category':
        ticketData.category = action.params.categoryId;
        break;
      case 'assign_to':
        ticketData.assignTo = action.params.userId;
        break;
      case 'add_tag':
        if (!ticketData.tags) {
          ticketData.tags = [];
        }
        ticketData.tags.push(action.params.tag);
        break;
    }
  }

  /**
   * Send ticket created confirmation
   */
  private async sendTicketCreatedConfirmation(ticketId: number, email: ParsedEmail): Promise<void> {
    try {
      const ticket = await getTicketById(ticketId);
      if (!ticket) return;

      await emailSender.queueTemplate(
        'ticket_created',
        email.from.email,
        {
          ticketNumber: `#${ticketId}`,
          ticket: {
            id: ticketId,
            title: ticket.title,
            description: ticket.description,
            priority: this.getPriorityName(ticket.priority_id),
            status: this.getStatusName(ticket.status_id),
            createdAt: ticket.created_at,
          },
          customer: {
            name: email.from.name || email.from.email,
            email: email.from.email,
          },
          tenant: {
            name: 'ServiceDesk',
            supportEmail: process.env.SUPPORT_EMAIL,
          },
        },
        1,
        { priority: 'high' }
      );
    } catch (error) {
      logger.error('Error sending ticket created confirmation', error);
    }
  }

  /**
   * Send comment confirmation
   */
  private async sendCommentConfirmation(ticketId: number, email: ParsedEmail): Promise<void> {
    try {
      const ticket = await getTicketById(ticketId);
      if (!ticket) return;

      await emailSender.queueTemplate(
        'ticket_updated',
        email.from.email,
        {
          ticketNumber: `#${ticketId}`,
          ticket: {
            id: ticketId,
            title: ticket.title,
            status: this.getStatusName(ticket.status_id),
          },
          customer: {
            name: email.from.name || email.from.email,
            email: email.from.email,
          },
          updateMessage: 'Seu comentário foi adicionado ao ticket.',
          tenant: {
            name: 'ServiceDesk',
            supportEmail: process.env.SUPPORT_EMAIL,
          },
        }
      );
    } catch (error) {
      logger.error('Error sending comment confirmation', error);
    }
  }

  /**
   * Notify agent of new comment
   */
  private async notifyAgentOfNewComment(
    ticketId: number,
    agentId: number
  ): Promise<void> {
    try {
      const agent = await executeQueryOne<{ email: string; name: string }>('SELECT email, name FROM users WHERE id = ?', [agentId]);
      if (!agent) return;

      const ticket = await getTicketById(ticketId);
      if (!ticket) return;

      await emailSender.queueTemplate(
        'new_comment',
        agent.email,
        {
          ticketNumber: `#${ticketId}`,
          ticket: {
            id: ticketId,
            title: ticket.title,
          },
          customer: {
            name: agent.name,
          },
          comment: {
            author: agent.name,
            content: 'New comment on ticket',
            createdAt: new Date(),
          },
          tenant: {
            name: 'ServiceDesk',
          },
        },
        1,
        { priority: 'normal' }
      );
    } catch (error) {
      logger.error('Error notifying agent of new comment', error);
    }
  }

  /**
   * Notify agent of assignment
   */
  private async notifyAgentOfAssignment(ticketId: number, agentId: number): Promise<void> {
    try {
      const agent = await executeQueryOne<{ email: string; name: string }>('SELECT email, name FROM users WHERE id = ?', [agentId]);
      if (!agent) return;

      const ticket = await getTicketById(ticketId);
      if (!ticket) return;

      await emailSender.queueTemplate(
        'ticket_updated',
        agent.email,
        {
          ticketNumber: `#${ticketId}`,
          ticket: {
            id: ticketId,
            title: ticket.title,
            status: this.getStatusName(ticket.status_id),
            assignedTo: agent.name,
          },
          customer: {
            name: agent.name,
            email: agent.email,
          },
          updateMessage: 'Este ticket foi atribuído a você.',
          tenant: {
            name: 'ServiceDesk',
          },
        },
        1,
        { priority: 'high' }
      );
    } catch (error) {
      logger.error('Error notifying agent of assignment', error);
    }
  }

  /**
   * Helper to get priority name
   */
  private getPriorityName(priorityId: number): string {
    const priorities: Record<number, string> = {
      1: 'Baixa',
      2: 'Média',
      3: 'Alta',
      4: 'Crítica',
    };
    return priorities[priorityId] || 'Média';
  }

  /**
   * Helper to get status name
   */
  private getStatusName(statusId: number): string {
    const statuses: Record<number, string> = {
      1: 'Aberto',
      2: 'Em Andamento',
      3: 'Resolvido',
      4: 'Fechado',
    };
    return statuses[statusId] || 'Aberto';
  }
}

// Singleton instance
export const emailAutomation = new EmailAutomation();
export default emailAutomation;
