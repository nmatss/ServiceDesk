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

    // TODO: Trigger SLA tracking creation
    // TODO: Send notification to assignee if assigned
    // TODO: Create audit log entry

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

    // TODO: If status changed to resolved, trigger PIR workflow
    // TODO: Send notifications
    // TODO: Update SLA tracking
    // TODO: Create audit log entry

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

    // TODO: Send notification to new assignee
    // TODO: Send notification to previous assignee if reassignment
    // TODO: Create audit log entry

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

    // TODO: Send notification to previous assignee
    // TODO: Create audit log entry

    return updated;
  }

  /**
   * Bulk assign tickets
   */
  async bulkAssignTickets(ticketIds: number[], assigneeId: number, assignedBy: number): Promise<void> {
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

    // TODO: Send notifications
    // TODO: Create audit log entries
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

    // TODO: Archive related data
    // TODO: Send closure notification
    // TODO: Update satisfaction survey status

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

    // TODO: Reset SLA tracking
    // TODO: Send notification to previous assignee
    // TODO: Create audit log entry with reason

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

    // TODO: Find escalation manager based on level
    // TODO: Reassign to escalation manager
    // TODO: Send escalation notifications
    // TODO: Create escalation record in sla_escalations table
    // TODO: Create audit log entry

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

    // TODO: Create audit log entry
    // TODO: Send notification to stakeholders
  }
}
