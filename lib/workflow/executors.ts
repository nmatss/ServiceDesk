/**
 * Real Node Executors Implementation
 * Provides actual functionality for workflow node execution
 */

import { WorkflowNode } from '@/lib/types/workflow';
import { ExecutionContext, NodeExecutor } from './engine';
import logger from '@/lib/monitoring/structured-logger';
import db from '@/lib/db/connection';

/**
 * Condition Node Executor
 * Evaluates conditions and determines execution path
 */
export class ConditionNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext) {
    const { field, operator, value } = node.configuration || {};

    if (!field || !operator) {
      throw new Error('Condition node requires field and operator configuration');
    }

    // Get actual value from context variables
    const fieldString = String(field);
    const actualValue = this.getFieldValue(context.getVariables(), fieldString);

    // Evaluate condition
    const operatorString = String(operator);
    let result = false;
    switch (operatorString) {
      case 'equals':
        result = actualValue === value;
        break;
      case 'not_equals':
        result = actualValue !== value;
        break;
      case 'contains':
        result = String(actualValue).includes(String(value));
        break;
      case 'not_contains':
        result = !String(actualValue).includes(String(value));
        break;
      case 'greater_than':
        result = Number(actualValue) > Number(value);
        break;
      case 'greater_than_or_equal':
        result = Number(actualValue) >= Number(value);
        break;
      case 'less_than':
        result = Number(actualValue) < Number(value);
        break;
      case 'less_than_or_equal':
        result = Number(actualValue) <= Number(value);
        break;
      case 'in':
        result = Array.isArray(value) && (value as any[]).includes(actualValue);
        break;
      case 'not_in':
        result = Array.isArray(value) && !(value as any[]).includes(actualValue);
        break;
      case 'is_null':
        result = actualValue == null;
        break;
      case 'is_not_null':
        result = actualValue != null;
        break;
      case 'regex':
        result = new RegExp(String(value)).test(String(actualValue));
        break;
      default:
        throw new Error(`Unknown operator: ${operatorString}`);
    }

    logger.info(`Condition evaluated: ${fieldString} ${operatorString} ${value} = ${result}`);

    return {
      action: 'continue' as const,
      outputData: {
        conditionResult: result,
        evaluatedField: fieldString,
        evaluatedValue: actualValue as string | number | boolean | null,
        expectedValue: value as string | number | boolean | null,
      },
    };
  }

  private getFieldValue(obj: Record<string, any>, field: string): any {
    return field.split('.').reduce((o, i) => o?.[i], obj);
  }
}

/**
 * Notification Node Executor
 * Sends notifications through various channels
 */
export class NotificationNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext) {
    const { channel, template, recipients, subject, message } = node.configuration || {};

    if (!channel || !recipients) {
      throw new Error('Notification node requires channel and recipients configuration');
    }

    // Parse recipients (can be user IDs or email addresses)
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    // Replace template variables
    const processedMessage = this.replaceVariables(String(message || template || ''), context.getVariables());
    const processedSubject = this.replaceVariables(String(subject || 'Workflow Notification'), context.getVariables());

    // Send notifications based on channel
    const channelString = String(channel);
    const results: Array<{ recipient: string; channel: string; sent: boolean; error?: string }> = [];
    for (const recipient of recipientList) {
      try {
        const recipientStr = String(recipient);
        switch (channelString) {
          case 'email':
            await this.sendEmailNotification(recipientStr, processedSubject, processedMessage);
            results.push({ recipient: recipientStr, channel: 'email', sent: true });
            break;

          case 'in_app':
            await this.sendInAppNotification(recipientStr, processedSubject, processedMessage, context);
            results.push({ recipient: recipientStr, channel: 'in_app', sent: true });
            break;

          case 'sms':
            await this.sendSMSNotification(recipientStr, processedMessage);
            results.push({ recipient: recipientStr, channel: 'sms', sent: true });
            break;

          default:
            logger.warn(`Unknown notification channel: ${channelString}`);
            results.push({ recipient: recipientStr, channel: channelString, sent: false, error: 'Unknown channel' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to send notification to ${recipient}:`, error);
        results.push({ recipient: String(recipient), channel: channelString, sent: false, error: errorMessage });
      }
    }

    const sentCount = results.filter(r => r.sent).length;
    logger.info(`Sent ${sentCount}/${recipientList.length} notifications via ${channelString}`);

    return {
      action: 'continue' as const,
      outputData: {
        notificationsSent: sentCount,
        totalRecipients: recipientList.length,
        channel: channelString,
        results: results as any, // Type cast to satisfy StepDataValue
      },
    };
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], variables);
      return value !== undefined ? String(value) : match;
    });
  }

  private async sendEmailNotification(recipient: string, subject: string, message: string): Promise<void> {
    // Import email service if available
    try {
      const emailServiceModule = await import('@/lib/email/service');
      const emailService = emailServiceModule.default;
      if (emailService && typeof emailService.sendEmail === 'function') {
        await emailService.sendEmail({
          to: recipient,
          subject,
          html: message,
          text: message.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        });
      } else {
        throw new Error('Email service not available');
      }
    } catch (error) {
      logger.warn('Email service not available, notification not sent');
      throw new Error('Email service not configured');
    }
  }

  private async sendInAppNotification(
    userId: string | number,
    title: string,
    message: string,
    _context: ExecutionContext
  ): Promise<void> {
    // Create notification in database
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;

    try {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(numericUserId, 'workflow', title, message);
    } catch (error) {
      logger.error('Failed to create in-app notification:', error);
      throw error;
    }
  }

  private async sendSMSNotification(recipient: string, message: string): Promise<void> {
    // SMS implementation would go here
    logger.info(`SMS to ${recipient}: ${message}`);
    // Placeholder - would integrate with SMS provider like Twilio
  }
}

/**
 * Webhook Node Executor
 * Sends HTTP requests to external services
 */
export class WebhookNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext) {
    const { url, method, headers, body, timeout } = node.configuration || {};

    if (!url) {
      throw new Error('Webhook node requires url configuration');
    }

    // Replace variables in URL
    const urlString = String(url);
    const processedUrl = this.replaceVariables(urlString, context.getVariables());

    // Prepare request headers
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ServiceDesk-Workflow-Engine',
    };

    // Safely merge headers
    if (typeof headers === 'object' && headers !== null && !Array.isArray(headers)) {
      for (const [key, value] of Object.entries(headers)) {
        baseHeaders[key] = String(value);
      }
    }

    const requestHeaders: Record<string, string> = baseHeaders;

    // Prepare request body
    let requestBody: string | undefined;
    if (body) {
      if (typeof body === 'string') {
        requestBody = this.replaceVariables(body, context.getVariables());
      } else {
        requestBody = JSON.stringify(this.replaceObjectVariables(body, context.getVariables()));
      }
    } else {
      // Default: send context variables
      requestBody = JSON.stringify(context.getVariables());
    }

    // Make HTTP request
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutMs = typeof timeout === 'number' ? timeout : 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const methodString = method ? String(method).toUpperCase() : 'POST';
      const response = await fetch(processedUrl, {
        method: methodString,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      logger.info(`Webhook request to ${processedUrl}: ${response.status} (${responseTime}ms)`);

      return {
        action: 'continue' as const,
        outputData: {
          webhookStatus: response.status,
          webhookStatusText: response.statusText,
          webhookResponse: responseData,
          webhookResponseTime: responseTime,
          webhookSuccess: response.ok,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Webhook request failed: ${errorMessage}`);

      // Check if it's a network error that should be retried
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        return {
          action: 'retry' as const,
          errorMessage: `Webhook request failed: ${errorMessage}`,
          retryDelay: 5000,
        };
      }

      throw new Error(`Webhook request failed: ${errorMessage}`);
    }
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], variables);
      return value !== undefined ? String(value) : match;
    });
  }

  private replaceObjectVariables(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, variables);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceObjectVariables(item, variables));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceObjectVariables(value, variables);
      }
      return result;
    }
    return obj;
  }
}

/**
 * Action Node Executor
 * Executes predefined actions like ticket updates
 */
export class ActionNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext) {
    const { actionType, parameters } = node.configuration || {};

    if (!actionType) {
      throw new Error('Action node requires actionType configuration');
    }

    switch (actionType) {
      case 'update_ticket':
        return await this.updateTicket(parameters, context);

      case 'assign_ticket':
        return await this.assignTicket(parameters, context);

      case 'create_ticket':
        return await this.createTicket(parameters, context);

      case 'add_comment':
        return await this.addComment(parameters, context);

      case 'update_status':
        return await this.updateStatus(parameters, context);

      case 'update_priority':
        return await this.updatePriority(parameters, context);

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  private async updateTicket(params: any, context: ExecutionContext) {
    const ticketId = params.ticketId || context.getVariable('ticketId');
    if (!ticketId) {
      throw new Error('Ticket ID not provided');
    }

    const updates = params.updates || {};
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    if (setClauses.length > 0) {
      values.push(ticketId);
      db.prepare(`
        UPDATE tickets
        SET ${setClauses.join(', ')}, updated_at = datetime('now')
        WHERE id = ?
      `).run(...values);
    }

    return {
      action: 'continue' as const,
      outputData: { ticketUpdated: true, ticketId, updates },
    };
  }

  private async assignTicket(params: any, context: ExecutionContext) {
    const ticketId = params.ticketId || context.getVariable('ticketId');
    const assigneeId = params.assigneeId;

    if (!ticketId || !assigneeId) {
      throw new Error('Ticket ID and assignee ID required');
    }

    db.prepare(`
      UPDATE tickets
      SET assigned_to = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(assigneeId, ticketId);

    return {
      action: 'continue' as const,
      outputData: { ticketAssigned: true, ticketId, assigneeId },
    };
  }

  private async createTicket(params: any, _context: ExecutionContext) {
    const { title, description, categoryId, priorityId, requesterId } = params;

    if (!title) {
      throw new Error('Ticket title required');
    }

    const result = db.prepare(`
      INSERT INTO tickets (title, description, category_id, priority_id, requester_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(title, description, categoryId, priorityId, requesterId);

    return {
      action: 'continue' as const,
      outputData: { ticketCreated: true, ticketId: Number(result.lastInsertRowid) },
    };
  }

  private async addComment(params: any, context: ExecutionContext) {
    const ticketId = params.ticketId || context.getVariable('ticketId');
    const { content, authorId, isInternal } = params;

    if (!ticketId || !content) {
      throw new Error('Ticket ID and comment content required');
    }

    const result = db.prepare(`
      INSERT INTO comments (ticket_id, author_id, content, is_internal, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(ticketId, authorId, content, isInternal ? 1 : 0);

    return {
      action: 'continue' as const,
      outputData: { commentAdded: true, commentId: Number(result.lastInsertRowid) },
    };
  }

  private async updateStatus(params: any, context: ExecutionContext) {
    const ticketId = params.ticketId || context.getVariable('ticketId');
    const statusId = params.statusId;

    if (!ticketId || !statusId) {
      throw new Error('Ticket ID and status ID required');
    }

    db.prepare(`
      UPDATE tickets
      SET status_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(statusId, ticketId);

    return {
      action: 'continue' as const,
      outputData: { statusUpdated: true, ticketId, statusId },
    };
  }

  private async updatePriority(params: any, context: ExecutionContext) {
    const ticketId = params.ticketId || context.getVariable('ticketId');
    const priorityId = params.priorityId;

    if (!ticketId || !priorityId) {
      throw new Error('Ticket ID and priority ID required');
    }

    db.prepare(`
      UPDATE tickets
      SET priority_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(priorityId, ticketId);

    return {
      action: 'continue' as const,
      outputData: { priorityUpdated: true, ticketId, priorityId },
    };
  }
}

/**
 * Delay Node Executor
 * Pauses workflow execution for specified duration
 */
export class DelayNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, _context: ExecutionContext) {
    const { duration: rawDuration, unit } = node.configuration || {};

    if (!rawDuration) {
      throw new Error('Delay node requires duration configuration');
    }

    const duration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration);

    // Convert to milliseconds
    let delayMs: number;
    switch (unit) {
      case 'seconds':
        delayMs = duration * 1000;
        break;
      case 'minutes':
        delayMs = duration * 60 * 1000;
        break;
      case 'hours':
        delayMs = duration * 60 * 60 * 1000;
        break;
      case 'days':
        delayMs = duration * 24 * 60 * 60 * 1000;
        break;
      default:
        delayMs = duration; // Assume milliseconds
    }

    logger.info(`Delaying workflow execution for ${delayMs}ms`);
    await new Promise(resolve => setTimeout(resolve, delayMs));

    return {
      action: 'continue' as const,
      outputData: { delayCompleted: true, delayDuration: delayMs },
    };
  }
}

/**
 * Approval Node Executor
 * Waits for manual approval before continuing
 */
export class ApprovalNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext) {
    const { approvers, message, timeout } = node.configuration || {};

    if (!approvers || !Array.isArray(approvers) || approvers.length === 0) {
      throw new Error('Approval node requires approvers configuration');
    }

    // Create approval requests
    const approvalId = Date.now();
    for (const approverId of approvers) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, created_at)
        VALUES (?, 'approval_request', 'Approval Required', ?, datetime('now'))
      `).run(approverId, message || 'Workflow requires your approval');
    }

    logger.info(`Approval request created for ${approvers.length} approvers`);

    // Set timeout if specified
    if (timeout) {
      const timeoutMs = typeof timeout === 'number' ? timeout : Number(timeout);
      context.setVariable('approvalTimeout', Date.now() + timeoutMs);
    }

    // Wait for approval (execution will be paused)
    return {
      action: 'wait' as const,
      outputData: { approvalPending: true, approvalId, approvers },
    };
  }
}
