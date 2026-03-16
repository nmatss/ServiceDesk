/**
 * Ticket Service Layer
 *
 * Business logic for ticket operations.
 * Enforces business rules, validates data, and coordinates between repositories.
 *
 * @module lib/services/ticket-service
 */

import type { ITicketRepository, IUserRepository } from '@/lib/interfaces/repositories';
import type { Ticket, CreateTicket } from '@/lib/types/database';
import { createAuditLog } from '@/lib/audit/logger';
import { createNotification } from '@/lib/notifications';
import { createSLATrackingForTicket } from '@/lib/sla/sla-service';
import { logger } from '@/lib/monitoring/structured-logger';

export interface CreateTicketDTO {
  title: string;
  description: string;
  user_id: number;
  assigned_to?: number;
  category_id: number;
  priority_id: number;
  status_id: number;
  organization_id: number;
  sla_policy_id?: number;
}

export interface UpdateTicketDTO {
  title?: string;
  description?: string;
  assigned_to?: number;
  category_id?: number;
  priority_id?: number;
  status_id?: number;
  sla_status?: 'on_track' | 'at_risk' | 'breached';
  resolved_at?: string;
}

export interface AssignTicketDTO {
  ticket_id: number;
  assignee_id: number;
  assigned_by: number;
}

export class TicketService {
  private ticketRepo: ITicketRepository;
  private userRepo: IUserRepository;

  constructor(ticketRepo: ITicketRepository, userRepo: IUserRepository) {
    this.ticketRepo = ticketRepo;
    this.userRepo = userRepo;
  }

  /**
   * Create a new ticket with business rule validation
   */
  async createTicket(data: CreateTicketDTO): Promise<Ticket> {
    // Business Rule 1: Validate user exists and is active
    const user = await this.userRepo.findById(data.user_id);
    if (!user || !user.is_active) {
      throw new Error('Invalid or inactive user');
    }

    // Business Rule 2: Critical priority tickets must be assigned immediately
    if (data.priority_id === 4 && !data.assigned_to) {
      throw new Error('Critical priority tickets must be assigned to an agent immediately');
    }

    // Business Rule 3: Validate assignee if provided
    if (data.assigned_to) {
      const assignee = await this.userRepo.findById(data.assigned_to);
      if (!assignee || !assignee.is_active) {
        throw new Error('Invalid or inactive assignee');
      }

      // Only agents and admins can be assigned tickets
      if (assignee.role !== 'agent' && assignee.role !== 'admin' && assignee.role !== 'tenant_admin') {
        throw new Error('Only agents and admins can be assigned tickets');
      }

      // Check assignee capacity (max 20 open tickets)
      const assigneeTickets = await this.ticketRepo.findByAssignee(data.assigned_to);
      const openTickets = assigneeTickets.filter(
        (t) => t.status_id !== 3 && t.status_id !== 4 // Not resolved or closed
      );

      if (openTickets.length >= 20) {
        throw new Error(`Agent ${assignee.name} has reached maximum ticket capacity (20 open tickets)`);
      }
    }

    // Create the ticket
    const ticket = await this.ticketRepo.create({
      title: data.title,
      description: data.description,
      user_id: data.user_id,
      assigned_to: data.assigned_to,
      category_id: data.category_id,
      priority_id: data.priority_id,
      status_id: data.status_id,
      organization_id: data.organization_id,
    });

    // SLA tracking, notifications, and audit logging (non-blocking)
    try {
      await createSLATrackingForTicket(ticket.id, data.priority_id, data.category_id);
    } catch (err) {
      logger.error('Failed to create SLA tracking for ticket', { ticketId: ticket.id, error: err });
    }

    try {
      if (data.assigned_to) {
        await createNotification({
          user_id: data.assigned_to,
          ticket_id: ticket.id,
          type: 'ticket_assigned',
          title: 'Novo ticket atribuído',
          message: `O ticket #${ticket.id} "${data.title}" foi atribuído a você.`,
          is_read: false,
          sent_via_email: false,
        });
      }
    } catch (err) {
      logger.error('Failed to send ticket creation notification', { ticketId: ticket.id, error: err });
    }

    try {
      await createAuditLog({
        user_id: data.user_id,
        organization_id: data.organization_id,
        action: 'ticket_created',
        resource_type: 'ticket',
        resource_id: ticket.id,
        new_values: JSON.stringify({ title: data.title, priority_id: data.priority_id, category_id: data.category_id, assigned_to: data.assigned_to }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket creation', { ticketId: ticket.id, error: err });
    }

    return ticket;
  }

  /**
   * Update ticket with business rules
   */
  async updateTicket(id: number, data: UpdateTicketDTO): Promise<Ticket> {
    const ticket = await this.ticketRepo.findById(id);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Business Rule: Cannot modify resolved or closed tickets without reopening
    if ((ticket.status_id === 3 || ticket.status_id === 4) && data.status_id && data.status_id !== ticket.status_id) {
      // Allow status change (reopening)
    } else if (ticket.status_id === 3 || ticket.status_id === 4) {
      throw new Error('Cannot modify resolved or closed tickets. Reopen the ticket first.');
    }

    // Business Rule: Resolving a ticket requires setting resolved_at
    if (data.status_id === 3 && !data.resolved_at) {
      data.resolved_at = new Date().toISOString();
    }

    // Business Rule: Validate assignee if changing assignment
    if (data.assigned_to !== undefined && data.assigned_to !== ticket.assigned_to) {
      if (data.assigned_to) {
        const assignee = await this.userRepo.findById(data.assigned_to);
        if (!assignee || !assignee.is_active) {
          throw new Error('Invalid or inactive assignee');
        }

        // Check capacity
        const assigneeTickets = await this.ticketRepo.findByAssignee(data.assigned_to);
        const openTickets = assigneeTickets.filter(
          (t) => t.id !== id && t.status_id !== 3 && t.status_id !== 4
        );

        if (openTickets.length >= 20) {
          throw new Error(`Agent ${assignee.name} has reached maximum ticket capacity (20 open tickets)`);
        }
      }
    }

    const updated = await this.ticketRepo.update(id, data);

    // PIR workflow: log resolution for future PIR implementation
    if (data.status_id === 3) {
      logger.info('Ticket resolved, PIR workflow pending implementation', { ticketId: id });
    }

    // Notifications for status and assignment changes (non-blocking)
    try {
      if (data.status_id && data.status_id !== ticket.status_id) {
        await createNotification({
          user_id: ticket.user_id,
          ticket_id: id,
          type: 'ticket_status_changed',
          title: 'Status do ticket alterado',
          message: `O status do ticket #${id} "${ticket.title}" foi atualizado.`,
          is_read: false,
          sent_via_email: false,
        });
      }

      if (data.assigned_to !== undefined && data.assigned_to !== ticket.assigned_to) {
        if (data.assigned_to) {
          await createNotification({
            user_id: data.assigned_to,
            ticket_id: id,
            type: 'ticket_assigned',
            title: 'Ticket atribuído a você',
            message: `O ticket #${id} "${ticket.title}" foi atribuído a você.`,
            is_read: false,
            sent_via_email: false,
          });
        }
        if (ticket.assigned_to) {
          await createNotification({
            user_id: ticket.assigned_to,
            ticket_id: id,
            type: 'ticket_unassigned',
            title: 'Ticket reatribuído',
            message: `O ticket #${id} "${ticket.title}" foi reatribuído a outro agente.`,
            is_read: false,
            sent_via_email: false,
          });
        }
      }
    } catch (err) {
      logger.error('Failed to send ticket update notifications', { ticketId: id, error: err });
    }

    // SLA tracking is automatic via application layer

    try {
      await createAuditLog({
        user_id: ticket.user_id,
        organization_id: ticket.organization_id,
        action: 'ticket_updated',
        resource_type: 'ticket',
        resource_id: id,
        old_values: JSON.stringify({ status_id: ticket.status_id, assigned_to: ticket.assigned_to, priority_id: ticket.priority_id }),
        new_values: JSON.stringify(data),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket update', { ticketId: id, error: err });
    }

    return updated;
  }

  /**
   * Assign ticket to an agent
   */
  async assignTicket(ticketId: number, assigneeId: number, assignedBy: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Cannot assign resolved/closed tickets
    if (ticket.status_id === 3 || ticket.status_id === 4) {
      throw new Error('Cannot assign resolved or closed tickets');
    }

    // Validate assignee
    const assignee = await this.userRepo.findById(assigneeId);
    if (!assignee || !assignee.is_active) {
      throw new Error('Invalid or inactive assignee');
    }

    // Role validation
    if (assignee.role !== 'agent' && assignee.role !== 'admin' && assignee.role !== 'tenant_admin') {
      throw new Error('Only agents and admins can be assigned tickets');
    }

    // Capacity check
    const assigneeTickets = await this.ticketRepo.findByAssignee(assigneeId);
    const openTickets = assigneeTickets.filter(
      (t) => t.id !== ticketId && t.status_id !== 3 && t.status_id !== 4
    );

    if (openTickets.length >= 20) {
      throw new Error(`Agent ${assignee.name} has reached maximum ticket capacity (20 open tickets)`);
    }

    // Update assignment
    const updated = await this.ticketRepo.update(ticketId, {
      assigned_to: assigneeId,
    });

    // Notifications (non-blocking)
    try {
      await createNotification({
        user_id: assigneeId,
        ticket_id: ticketId,
        type: 'ticket_assigned',
        title: 'Ticket atribuído a você',
        message: `O ticket #${ticketId} "${ticket.title}" foi atribuído a você.`,
        is_read: false,
        sent_via_email: false,
      });

      if (ticket.assigned_to && ticket.assigned_to !== assigneeId) {
        await createNotification({
          user_id: ticket.assigned_to,
          ticket_id: ticketId,
          type: 'ticket_unassigned',
          title: 'Ticket reatribuído',
          message: `O ticket #${ticketId} "${ticket.title}" foi reatribuído a outro agente.`,
          is_read: false,
          sent_via_email: false,
        });
      }
    } catch (err) {
      logger.error('Failed to send assignment notifications', { ticketId, error: err });
    }

    try {
      await createAuditLog({
        user_id: assignedBy,
        organization_id: ticket.organization_id,
        action: 'ticket_assigned',
        resource_type: 'ticket',
        resource_id: ticketId,
        old_values: JSON.stringify({ assigned_to: ticket.assigned_to }),
        new_values: JSON.stringify({ assigned_to: assigneeId }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket assignment', { ticketId, error: err });
    }

    return updated;
  }

  /**
   * Unassign ticket from agent
   */
  async unassignTicket(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (!ticket.assigned_to) {
      throw new Error('Ticket is not assigned to anyone');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      assigned_to: null as any,
    });

    // Notification to previous assignee (non-blocking)
    try {
      await createNotification({
        user_id: ticket.assigned_to,
        ticket_id: ticketId,
        type: 'ticket_unassigned',
        title: 'Ticket desatribuído',
        message: `O ticket #${ticketId} "${ticket.title}" foi desatribuído de você.`,
        is_read: false,
        sent_via_email: false,
      });
    } catch (err) {
      logger.error('Failed to send unassignment notification', { ticketId, error: err });
    }

    try {
      await createAuditLog({
        user_id: ticket.assigned_to,
        organization_id: ticket.organization_id,
        action: 'ticket_unassigned',
        resource_type: 'ticket',
        resource_id: ticketId,
        old_values: JSON.stringify({ assigned_to: ticket.assigned_to }),
        new_values: JSON.stringify({ assigned_to: null }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket unassignment', { ticketId, error: err });
    }

    return updated;
  }

  /**
   * Bulk assign tickets
   */
  async bulkAssignTickets(ticketIds: number[], assigneeId: number, assignedBy: number): Promise<void> {
    // Cap array input to prevent abuse
    ticketIds = ticketIds.slice(0, 50);

    // Validate assignee first
    const assignee = await this.userRepo.findById(assigneeId);
    if (!assignee || !assignee.is_active) {
      throw new Error('Invalid or inactive assignee');
    }

    if (assignee.role !== 'agent' && assignee.role !== 'admin' && assignee.role !== 'tenant_admin') {
      throw new Error('Only agents and admins can be assigned tickets');
    }

    // Check capacity
    const assigneeTickets = await this.ticketRepo.findByAssignee(assigneeId);
    const openTickets = assigneeTickets.filter((t) => t.status_id !== 3 && t.status_id !== 4);

    if (openTickets.length + ticketIds.length > 20) {
      throw new Error(
        `Bulk assignment would exceed agent capacity. Agent has ${openTickets.length} open tickets, attempting to add ${ticketIds.length} more (max: 20)`
      );
    }

    // Perform bulk assignment
    await this.ticketRepo.bulkAssign(ticketIds, assigneeId);

    // Notification to assignee (non-blocking)
    try {
      await createNotification({
        user_id: assigneeId,
        ticket_id: ticketIds[0],
        type: 'ticket_assigned',
        title: 'Tickets atribuídos em lote',
        message: `${ticketIds.length} tickets foram atribuídos a você.`,
        is_read: false,
        sent_via_email: false,
      });
    } catch (err) {
      logger.error('Failed to send bulk assignment notification', { ticketIds, error: err });
    }

    try {
      await createAuditLog({
        user_id: assignedBy,
        action: 'ticket_bulk_assigned',
        resource_type: 'ticket',
        new_values: JSON.stringify({ ticket_ids: ticketIds, assigned_to: assigneeId }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for bulk assignment', { ticketIds, error: err });
    }
  }

  /**
   * Close ticket
   */
  async closeTicket(ticketId: number, closedBy: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Business Rule: Can only close resolved tickets
    if (ticket.status_id !== 3) {
      throw new Error('Can only close tickets that are already resolved');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      status_id: 4, // Closed
    });

    // Archival not implemented yet
    // Satisfaction surveys handled separately

    // Closure notification (non-blocking)
    try {
      await createNotification({
        user_id: ticket.user_id,
        ticket_id: ticketId,
        type: 'ticket_closed',
        title: 'Ticket encerrado',
        message: `O ticket #${ticketId} "${ticket.title}" foi encerrado.`,
        is_read: false,
        sent_via_email: false,
      });
    } catch (err) {
      logger.error('Failed to send closure notification', { ticketId, error: err });
    }

    try {
      await createAuditLog({
        user_id: closedBy,
        organization_id: ticket.organization_id,
        action: 'ticket_closed',
        resource_type: 'ticket',
        resource_id: ticketId,
        old_values: JSON.stringify({ status_id: ticket.status_id }),
        new_values: JSON.stringify({ status_id: 4 }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket closure', { ticketId, error: err });
    }

    return updated;
  }

  /**
   * Reopen ticket
   */
  async reopenTicket(ticketId: number, reopenedBy: number, reason?: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Can only reopen resolved or closed tickets
    if (ticket.status_id !== 3 && ticket.status_id !== 4) {
      throw new Error('Can only reopen resolved or closed tickets');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      status_id: 1, // Open
      resolved_at: null as any,
    });

    // SLA tracking is recalculated automatically via application layer

    // Notifications and audit (non-blocking)
    try {
      if (ticket.assigned_to) {
        await createNotification({
          user_id: ticket.assigned_to,
          ticket_id: ticketId,
          type: 'ticket_reopened',
          title: 'Ticket reaberto',
          message: `O ticket #${ticketId} "${ticket.title}" foi reaberto.${reason ? ` Motivo: ${reason}` : ''}`,
          is_read: false,
          sent_via_email: false,
        });
      }
    } catch (err) {
      logger.error('Failed to send reopen notification', { ticketId, error: err });
    }

    try {
      await createAuditLog({
        user_id: reopenedBy,
        organization_id: ticket.organization_id,
        action: 'ticket_reopened',
        resource_type: 'ticket',
        resource_id: ticketId,
        old_values: JSON.stringify({ status_id: ticket.status_id }),
        new_values: JSON.stringify({ status_id: 1, reason }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket reopen', { ticketId, error: err });
    }

    return updated;
  }

  /**
   * Escalate ticket
   */
  async escalateTicket(ticketId: number, escalatedBy: number, reason: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Cannot escalate resolved/closed tickets
    if (ticket.status_id === 3 || ticket.status_id === 4) {
      throw new Error('Cannot escalate resolved or closed tickets');
    }

    const escalationLevel = (ticket.escalation_level || 0) + 1;

    const updated = await this.ticketRepo.update(ticketId, {
      escalation_level: escalationLevel,
      escalated_at: new Date().toISOString(),
      priority_id: Math.min((ticket.priority_id || 1) + 1, 4), // Increase priority, max is 4 (critical)
    });

    // Escalation manager lookup and reassignment not yet implemented
    // Escalation record in sla_escalations table not yet implemented

    // Escalation notifications (non-blocking)
    try {
      if (ticket.assigned_to) {
        await createNotification({
          user_id: ticket.assigned_to,
          ticket_id: ticketId,
          type: 'ticket_escalated',
          title: 'Ticket escalado',
          message: `O ticket #${ticketId} "${ticket.title}" foi escalado para nível ${escalationLevel}. Motivo: ${reason}`,
          is_read: false,
          sent_via_email: false,
        });
      }

      await createNotification({
        user_id: ticket.user_id,
        ticket_id: ticketId,
        type: 'ticket_escalated',
        title: 'Ticket escalado',
        message: `O ticket #${ticketId} "${ticket.title}" foi escalado para nível ${escalationLevel}.`,
        is_read: false,
        sent_via_email: false,
      });
    } catch (err) {
      logger.error('Failed to send escalation notifications', { ticketId, error: err });
    }

    try {
      await createAuditLog({
        user_id: escalatedBy,
        organization_id: ticket.organization_id,
        action: 'ticket_escalated',
        resource_type: 'ticket',
        resource_id: ticketId,
        old_values: JSON.stringify({ escalation_level: ticket.escalation_level || 0, priority_id: ticket.priority_id }),
        new_values: JSON.stringify({ escalation_level: escalationLevel, priority_id: updated.priority_id, reason }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket escalation', { ticketId, error: err });
    }

    return updated;
  }

  /**
   * Get tickets requiring attention (SLA at risk or breached)
   */
  async getTicketsRequiringAttention(organizationId: number): Promise<{
    at_risk: Ticket[];
    breached: Ticket[];
    unassigned: Ticket[];
  }> {
    const [atRisk, breached, unassigned] = await Promise.all([
      this.ticketRepo.findSLAAtRisk(organizationId),
      this.ticketRepo.findSLABreached(organizationId),
      this.ticketRepo.findUnassigned(organizationId),
    ]);

    return {
      at_risk: atRisk,
      breached: breached,
      unassigned: unassigned,
    };
  }

  /**
   * Get ticket metrics for dashboard
   */
  async getTicketMetrics(organizationId: number, dateRange?: { start: string; end: string }) {
    return this.ticketRepo.getMetrics(organizationId, dateRange);
  }

  /**
   * Get ticket by ID with details
   */
  async getTicketById(id: number) {
    return this.ticketRepo.findWithDetails(id);
  }

  /**
   * Get all tickets with details
   */
  async getAllTicketsWithDetails(filters?: any) {
    return this.ticketRepo.findAllWithDetails(filters);
  }

  /**
   * Delete ticket (soft delete)
   */
  async deleteTicket(ticketId: number, deletedBy: number): Promise<void> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Business Rule: Cannot delete resolved tickets older than 30 days
    if (ticket.resolved_at) {
      const resolvedDate = new Date(ticket.resolved_at);
      const daysSinceResolved = (Date.now() - resolvedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceResolved > 30) {
        throw new Error('Cannot delete tickets resolved more than 30 days ago. Use archival instead.');
      }
    }

    await this.ticketRepo.softDelete(ticketId);

    // Notification and audit (non-blocking)
    try {
      await createNotification({
        user_id: ticket.user_id,
        ticket_id: ticketId,
        type: 'ticket_deleted',
        title: 'Ticket excluído',
        message: `O ticket #${ticketId} "${ticket.title}" foi excluído.`,
        is_read: false,
        sent_via_email: false,
      });
    } catch (err) {
      logger.error('Failed to send deletion notification', { ticketId, error: err });
    }

    try {
      await createAuditLog({
        user_id: deletedBy,
        organization_id: ticket.organization_id,
        action: 'ticket_deleted',
        resource_type: 'ticket',
        resource_id: ticketId,
        old_values: JSON.stringify({ title: ticket.title, status_id: ticket.status_id }),
      });
    } catch (err) {
      logger.error('Failed to create audit log for ticket deletion', { ticketId, error: err });
    }
  }
}
