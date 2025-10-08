/**
 * SPRINT 2: Advanced Approval Manager
 * Multi-level approval logic with timeout handling, delegation, and no-login approval
 */

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { logger } from '../monitoring/logger';
import {
  WorkflowApproval,
  ApprovalNodeConfig,
  ApprovalTarget,
  EscalationConfig,
  ApprovalStatus,
  WorkflowExecution,
} from '@/lib/types/workflow';

export interface ApprovalRequest {
  executionId: number;
  stepId: string;
  config: ApprovalNodeConfig;
  requestedBy: number;
  ticketId?: number;
  context: Record<string, any>;
}

export interface ApprovalResponse {
  approvalId: number;
  approved: boolean;
  comments?: string;
  approverId: number;
  timestamp: Date;
}

export interface ApprovalLink {
  token: string;
  expiresAt: Date;
  approvalId: number;
}

export class ApprovalManager {
  private pendingApprovals: Map<number, ApprovalRequest> = new Map();
  private approvalTokens: Map<string, ApprovalLink> = new Map();
  private approvalTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private emailTransporter: nodemailer.Transporter;

  constructor(emailConfig?: nodemailer.TransportOptions) {
    // Initialize email transporter for approval notifications
    this.emailTransporter = nodemailer.createTransport(
      emailConfig || {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      }
    );
  }

  /**
   * Request approval with multi-level support
   */
  async requestApproval(request: ApprovalRequest): Promise<WorkflowApproval[]> {
    const { executionId, stepId, config, requestedBy, context } = request;

    // Store request
    this.pendingApprovals.set(executionId, request);

    // Create approval records based on approval type
    const approvals = await this.createApprovalRecords(
      executionId,
      stepId,
      config,
      requestedBy,
      context
    );

    // Send notifications to approvers
    await this.sendApprovalNotifications(approvals, config, context);

    // Setup timeout handlers
    if (config.autoApproveAfter) {
      this.setupApprovalTimeout(executionId, config.autoApproveAfter, approvals);
    }

    // Setup escalation if configured
    if (config.escalationConfig) {
      this.setupEscalation(executionId, config.escalationConfig, approvals, context);
    }

    return approvals;
  }

  /**
   * Process approval response
   */
  async processApproval(
    approvalId: number,
    approverId: number,
    approved: boolean,
    comments?: string
  ): Promise<ApprovalResponse> {
    const approval = await this.getApproval(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    // Update approval status
    approval.status = approved ? 'approved' : 'rejected';
    approval.approverId = approverId;
    approval.comments = comments;
    approval.approvedAt = new Date();

    await this.updateApproval(approval);

    // Clear timeout for this approval
    const timeout = this.approvalTimeouts.get(approval.executionId);
    if (timeout) {
      clearTimeout(timeout);
      this.approvalTimeouts.delete(approval.executionId);
    }

    // Check if workflow can proceed
    const request = this.pendingApprovals.get(approval.executionId);
    if (request) {
      const canProceed = await this.checkApprovalCompletion(
        approval.executionId,
        request.config
      );

      if (canProceed || !approved) {
        // Remove pending approval
        this.pendingApprovals.delete(approval.executionId);
      }
    }

    return {
      approvalId,
      approved,
      comments,
      approverId,
      timestamp: new Date(),
    };
  }

  /**
   * Process approval via magic link (no-login approval)
   */
  async processApprovalByToken(
    token: string,
    approved: boolean,
    comments?: string
  ): Promise<ApprovalResponse> {
    const approvalLink = this.approvalTokens.get(token);
    if (!approvalLink) {
      throw new Error('Invalid or expired approval token');
    }

    if (new Date() > approvalLink.expiresAt) {
      this.approvalTokens.delete(token);
      throw new Error('Approval token has expired');
    }

    const approval = await this.getApproval(approvalLink.approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Process approval
    const response = await this.processApproval(
      approvalLink.approvalId,
      approval.approverId,
      approved,
      comments
    );

    // Invalidate token
    this.approvalTokens.delete(token);

    return response;
  }

  /**
   * Delegate approval to another user
   */
  async delegateApproval(
    approvalId: number,
    fromUserId: number,
    toUserId: number,
    reason?: string
  ): Promise<WorkflowApproval> {
    const approval = await this.getApproval(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    if (approval.approverId !== fromUserId) {
      throw new Error('Only the assigned approver can delegate');
    }

    const request = this.pendingApprovals.get(approval.executionId);
    if (!request?.config.allowDelegation) {
      throw new Error('Delegation is not allowed for this approval');
    }

    // Update approval record
    approval.metadata = {
      ...approval.metadata,
      originalApprover: fromUserId,
      delegatedTo: toUserId,
      delegationReason: reason,
    };
    approval.approverId = toUserId;
    approval.status = 'delegated';

    await this.updateApproval(approval);

    // Send notification to new approver
    await this.sendDelegationNotification(approval, toUserId, fromUserId, reason);

    return approval;
  }

  /**
   * Generate magic link for no-login approval
   */
  generateApprovalLink(approvalId: number, expiryHours: number = 48): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    this.approvalTokens.set(token, {
      token,
      expiresAt,
      approvalId,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/workflows/approve?token=${token}`;
  }

  /**
   * Generate WhatsApp approval message
   */
  generateWhatsAppMessage(approval: WorkflowApproval, context: Record<string, any>): string {
    const approveLink = this.generateApprovalLink(approval.id, 48);
    const rejectLink = this.generateApprovalLink(approval.id, 48);

    return `
*Approval Required*

Ticket: ${context.ticketTitle || 'N/A'}
Requester: ${context.requesterName || 'N/A'}

${context.description || 'Please review and approve this request.'}

To approve: ${approveLink}&action=approve
To reject: ${rejectLink}&action=reject

This link expires in 48 hours.
    `.trim();
  }

  /**
   * Create approval records based on approval type
   */
  private async createApprovalRecords(
    executionId: number,
    stepId: string,
    config: ApprovalNodeConfig,
    requestedBy: number,
    context: Record<string, any>
  ): Promise<WorkflowApproval[]> {
    const approvers = await this.resolveApprovers(config.approvers, context);
    const approvals: WorkflowApproval[] = [];

    for (const approver of approvers) {
      const approval: WorkflowApproval = {
        id: this.generateApprovalId(),
        executionId,
        stepId,
        approverId: approver.userId,
        status: 'pending',
        metadata: {
          approverType: approver.type,
          order: approver.order || 0,
          isOptional: approver.isOptional || false,
          attachments: [],
        },
        createdAt: new Date(),
      };

      approvals.push(approval);
      await this.saveApproval(approval);
    }

    return approvals;
  }

  /**
   * Resolve approvers from targets (user, role, department, dynamic)
   */
  private async resolveApprovers(
    targets: ApprovalTarget[],
    context: Record<string, any>
  ): Promise<Array<{ userId: number; type: string; order?: number; isOptional?: boolean }>> {
    const approvers: Array<{
      userId: number;
      type: string;
      order?: number;
      isOptional?: boolean;
    }> = [];

    for (const target of targets) {
      switch (target.type) {
        case 'user':
          approvers.push({
            userId: typeof target.value === 'number' ? target.value : parseInt(target.value as string),
            type: 'user',
            order: target.order,
            isOptional: target.isOptional,
          });
          break;

        case 'role':
          // Query users with specific role
          const roleUsers = await this.getUsersByRole(target.value as string);
          approvers.push(
            ...roleUsers.map((userId) => ({
              userId,
              type: 'role',
              order: target.order,
              isOptional: target.isOptional,
            }))
          );
          break;

        case 'department':
          // Query users in department
          const deptUsers = await this.getUsersByDepartment(target.value as number);
          approvers.push(
            ...deptUsers.map((userId) => ({
              userId,
              type: 'department',
              order: target.order,
              isOptional: target.isOptional,
            }))
          );
          break;

        case 'dynamic':
          // Resolve from context variable
          const dynamicUserId = this.resolveDynamicValue(target.value as string, context);
          if (dynamicUserId) {
            approvers.push({
              userId: parseInt(dynamicUserId as string),
              type: 'dynamic',
              order: target.order,
              isOptional: target.isOptional,
            });
          }
          break;
      }
    }

    return approvers;
  }

  /**
   * Send approval notifications via email and WhatsApp
   */
  private async sendApprovalNotifications(
    approvals: WorkflowApproval[],
    config: ApprovalNodeConfig,
    context: Record<string, any>
  ): Promise<void> {
    for (const approval of approvals) {
      const approver = await this.getUser(approval.approverId);
      if (!approver) continue;

      // Generate approval link
      const approvalLink = this.generateApprovalLink(approval.id, 48);

      // Send email notification
      if (approver.email) {
        await this.sendApprovalEmail(approver.email, approval, approvalLink, context);
      }

      // Send WhatsApp notification if phone number available
      if (approver.phone) {
        const whatsappMessage = this.generateWhatsAppMessage(approval, context);
        await this.sendWhatsAppMessage(approver.phone, whatsappMessage);
      }

      // Send in-app notification
      await this.sendInAppNotification(approval.approverId, approval, context);
    }
  }

  /**
   * Send approval email
   */
  private async sendApprovalEmail(
    email: string,
    approval: WorkflowApproval,
    approvalLink: string,
    context: Record<string, any>
  ): Promise<void> {
    const approveLink = `${approvalLink}&action=approve`;
    const rejectLink = `${approvalLink}&action=reject`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { background: #f9fafb; padding: 20px; margin-top: 20px; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .approve { background: #10b981; color: white; }
          .reject { background: #ef4444; color: white; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Approval Required</h1>
          </div>
          <div class="content">
            <h2>Ticket: ${context.ticketTitle || 'N/A'}</h2>
            <p><strong>Requester:</strong> ${context.requesterName || 'N/A'}</p>
            <p><strong>Priority:</strong> ${context.priority || 'Normal'}</p>
            <p><strong>Description:</strong></p>
            <p>${context.description || 'Please review and approve this request.'}</p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${approveLink}" class="button approve">Approve</a>
              <a href="${rejectLink}" class="button reject">Reject</a>
            </div>

            <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
              Or click here to review details: <a href="${approvalLink}">View Details</a>
            </p>
          </div>
          <div class="footer">
            <p>This approval link expires in 48 hours.</p>
            <p>ServiceDesk Workflow System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@servicedesk.com',
      to: email,
      subject: `Approval Required: ${context.ticketTitle || 'Ticket'}`,
      html,
    });
  }

  /**
   * Setup approval timeout with auto-approval or escalation
   */
  private setupApprovalTimeout(
    executionId: number,
    hours: number,
    approvals: WorkflowApproval[]
  ): void {
    const timeoutMs = hours * 60 * 60 * 1000;

    const timeout = setTimeout(async () => {
      const request = this.pendingApprovals.get(executionId);
      if (!request) return;

      // Auto-approve all pending approvals
      for (const approval of approvals) {
        if (approval.status === 'pending') {
          approval.status = 'timeout';
          approval.approvedAt = new Date();
          approval.comments = `Auto-approved after ${hours} hours timeout`;
          await this.updateApproval(approval);
        }
      }

      // Remove pending approval
      this.pendingApprovals.delete(executionId);

      // Notify workflow engine
      await this.notifyWorkflowEngine(executionId, 'timeout', {
        autoApproved: true,
        reason: 'timeout',
      });
    }, timeoutMs);

    this.approvalTimeouts.set(executionId, timeout);
  }

  /**
   * Setup escalation for approvals
   */
  private setupEscalation(
    executionId: number,
    escalationConfig: EscalationConfig,
    approvals: WorkflowApproval[],
    context: Record<string, any>
  ): void {
    escalationConfig.levels.forEach((level, index) => {
      const timeoutMs = level.timeoutHours * 60 * 60 * 1000;

      setTimeout(async () => {
        const request = this.pendingApprovals.get(executionId);
        if (!request) return; // Already completed

        // Check if still pending
        const pendingApprovals = approvals.filter((a) => a.status === 'pending');
        if (pendingApprovals.length === 0) return;

        // Escalate to next level approvers
        const escalatedApprovals = await this.createApprovalRecords(
          executionId,
          request.stepId,
          { ...request.config, approvers: level.approvers },
          request.requestedBy,
          context
        );

        // Send escalation notifications
        await this.sendEscalationNotifications(escalatedApprovals, level, context);

        // Handle timeout behavior
        if (index === escalationConfig.levels.length - 1) {
          // Last escalation level
          switch (escalationConfig.timeoutBehavior) {
            case 'auto_approve':
              pendingApprovals.forEach(async (a) => {
                a.status = 'approved';
                a.approvedAt = new Date();
                a.comments = 'Auto-approved after final escalation timeout';
                await this.updateApproval(a);
              });
              this.pendingApprovals.delete(executionId);
              break;
            case 'auto_reject':
              pendingApprovals.forEach(async (a) => {
                a.status = 'rejected';
                a.approvedAt = new Date();
                a.comments = 'Auto-rejected after final escalation timeout';
                await this.updateApproval(a);
              });
              this.pendingApprovals.delete(executionId);
              break;
            case 'notify':
              await this.sendTimeoutNotification(approvals, context);
              break;
          }
        }
      }, timeoutMs);
    });
  }

  /**
   * Check if approval process is complete
   */
  private async checkApprovalCompletion(
    executionId: number,
    config: ApprovalNodeConfig
  ): Promise<boolean> {
    const approvals = await this.getApprovalsByExecution(executionId);
    const { approvalType } = config;

    switch (approvalType) {
      case 'single':
        // Any one approval is enough
        return approvals.some((a) => a.status === 'approved');

      case 'multiple':
        // Sequential approvals - check order
        const orderedApprovals = approvals.sort(
          (a, b) => (a.metadata.order || 0) - (b.metadata.order || 0)
        );
        return orderedApprovals.every(
          (a) => a.status === 'approved' || a.metadata.isOptional
        );

      case 'majority':
        // More than 50% approved
        const approvedCount = approvals.filter((a) => a.status === 'approved').length;
        return approvedCount > approvals.length / 2;

      case 'unanimous':
        // All must approve
        return approvals.every(
          (a) => a.status === 'approved' || a.metadata.isOptional
        );

      default:
        return false;
    }
  }

  // Helper methods (to be implemented with actual database)
  private generateApprovalId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  private async getApproval(id: number): Promise<WorkflowApproval | null> {
    // TODO: Implement database query
    return null;
  }

  private async saveApproval(approval: WorkflowApproval): Promise<void> {
    // TODO: Implement database save
  }

  private async updateApproval(approval: WorkflowApproval): Promise<void> {
    // TODO: Implement database update
  }

  private async getApprovalsByExecution(executionId: number): Promise<WorkflowApproval[]> {
    // TODO: Implement database query
    return [];
  }

  private async getUser(userId: number): Promise<any> {
    // TODO: Implement user lookup
    return null;
  }

  private async getUsersByRole(role: string): Promise<number[]> {
    // TODO: Implement role-based user query
    return [];
  }

  private async getUsersByDepartment(departmentId: number): Promise<number[]> {
    // TODO: Implement department-based user query
    return [];
  }

  private resolveDynamicValue(expression: string, context: Record<string, any>): any {
    // Simple variable resolution - can be enhanced with full expression parser
    const varMatch = expression.match(/\$\{(.+?)\}/);
    if (varMatch) {
      const path = varMatch[1].split('.');
      return path.reduce((obj, key) => obj?.[key], context);
    }
    return expression;
  }

  private async sendWhatsAppMessage(phone: string, message: string): Promise<void> {
    // TODO: Implement WhatsApp API integration
    logger.info(`WhatsApp to ${phone}: ${message}`);
  }

  private async sendInAppNotification(
    userId: number,
    approval: WorkflowApproval,
    context: Record<string, any>
  ): Promise<void> {
    // TODO: Implement in-app notification
  }

  private async sendDelegationNotification(
    approval: WorkflowApproval,
    toUserId: number,
    fromUserId: number,
    reason?: string
  ): Promise<void> {
    // TODO: Implement delegation notification
  }

  private async sendEscalationNotifications(
    approvals: WorkflowApproval[],
    level: any,
    context: Record<string, any>
  ): Promise<void> {
    // TODO: Implement escalation notifications
  }

  private async sendTimeoutNotification(
    approvals: WorkflowApproval[],
    context: Record<string, any>
  ): Promise<void> {
    // TODO: Implement timeout notification
  }

  private async notifyWorkflowEngine(
    executionId: number,
    event: string,
    data: Record<string, any>
  ): Promise<void> {
    // TODO: Implement workflow engine notification
  }
}

export default ApprovalManager;
