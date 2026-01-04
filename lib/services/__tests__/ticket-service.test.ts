/**
 * Unit Tests for TicketService
 *
 * Tests business logic in isolation using mock repositories.
 * Demonstrates the testability benefits of service layer architecture.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicketService } from '../ticket-service';
import type { ITicketRepository, IUserRepository } from '@/lib/interfaces/repositories';
import type { Ticket, User } from '@/lib/types/database';

// Mock implementations
class MockTicketRepository implements Partial<ITicketRepository> {
  private tickets: Ticket[] = [];
  private nextId = 1;

  async findById(id: number): Promise<Ticket | null> {
    return this.tickets.find((t) => t.id === id) || null;
  }

  async findByAssignee(assigneeId: number): Promise<Ticket[]> {
    return this.tickets.filter((t) => t.assigned_to === assigneeId);
  }

  async create(data: Partial<Ticket>): Promise<Ticket> {
    const ticket: Ticket = {
      id: this.nextId++,
      title: data.title!,
      description: data.description!,
      user_id: data.user_id!,
      assigned_to: data.assigned_to,
      category_id: data.category_id!,
      priority_id: data.priority_id!,
      status_id: data.status_id!,
      organization_id: data.organization_id!,
      sla_policy_id: data.sla_policy_id,
      resolved_at: data.resolved_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Ticket;

    this.tickets.push(ticket);
    return ticket;
  }

  async update(id: number, data: Partial<Ticket>): Promise<Ticket> {
    const ticketIndex = this.tickets.findIndex((t) => t.id === id);
    if (ticketIndex === -1) {
      throw new Error('Ticket not found');
    }

    this.tickets[ticketIndex] = {
      ...this.tickets[ticketIndex],
      ...data,
      updated_at: new Date().toISOString(),
    };

    return this.tickets[ticketIndex];
  }

  async softDelete(id: number): Promise<void> {
    const ticket = this.tickets.find((t) => t.id === id);
    if (ticket) {
      (ticket as any).deleted_at = new Date().toISOString();
    }
  }

  reset() {
    this.tickets = [];
    this.nextId = 1;
  }
}

class MockUserRepository implements Partial<IUserRepository> {
  private users: User[] = [];

  async findById(id: number): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  addUser(user: User): void {
    this.users.push(user);
  }

  reset() {
    this.users = [];
  }
}

describe('TicketService', () => {
  let ticketService: TicketService;
  let mockTicketRepo: MockTicketRepository;
  let mockUserRepo: MockUserRepository;

  beforeEach(() => {
    mockTicketRepo = new MockTicketRepository();
    mockUserRepo = new MockUserRepository();
    ticketService = new TicketService(
      mockTicketRepo as any,
      mockUserRepo as any
    );
  });

  describe('createTicket', () => {
    it('should create a ticket successfully', async () => {
      // Arrange
      const activeUser: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(activeUser);

      const ticketData = {
        title: 'Test Ticket',
        description: 'Test Description',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      };

      // Act
      const ticket = await ticketService.createTicket(ticketData);

      // Assert
      expect(ticket).toBeDefined();
      expect(ticket.id).toBe(1);
      expect(ticket.title).toBe('Test Ticket');
      expect(ticket.user_id).toBe(1);
    });

    it('should throw error for invalid user', async () => {
      // Arrange
      const ticketData = {
        title: 'Test Ticket',
        description: 'Test Description',
        user_id: 999, // Non-existent user
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      };

      // Act & Assert
      await expect(ticketService.createTicket(ticketData)).rejects.toThrow(
        'Invalid or inactive user'
      );
    });

    it('should throw error for inactive user', async () => {
      // Arrange
      const inactiveUser: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: false, // Inactive
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(inactiveUser);

      const ticketData = {
        title: 'Test Ticket',
        description: 'Test Description',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      };

      // Act & Assert
      await expect(ticketService.createTicket(ticketData)).rejects.toThrow(
        'Invalid or inactive user'
      );
    });

    it('should throw error for critical ticket without assignee', async () => {
      // Arrange
      const activeUser: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(activeUser);

      const criticalTicketData = {
        title: 'Critical Issue',
        description: 'Production is down!',
        user_id: 1,
        category_id: 1,
        priority_id: 4, // Critical priority
        status_id: 1,
        organization_id: 1,
        // No assigned_to
      };

      // Act & Assert
      await expect(
        ticketService.createTicket(criticalTicketData)
      ).rejects.toThrow('Critical priority tickets must be assigned to an agent immediately');
    });

    it('should allow critical ticket with valid assignee', async () => {
      // Arrange
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const agent: User = {
        id: 2,
        name: 'Agent Smith',
        email: 'agent@example.com',
        role: 'agent',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(user);
      mockUserRepo.addUser(agent);

      const criticalTicketData = {
        title: 'Critical Issue',
        description: 'Production is down!',
        user_id: 1,
        assigned_to: 2,
        category_id: 1,
        priority_id: 4, // Critical
        status_id: 1,
        organization_id: 1,
      };

      // Act
      const ticket = await ticketService.createTicket(criticalTicketData);

      // Assert
      expect(ticket.assigned_to).toBe(2);
      expect(ticket.priority_id).toBe(4);
    });

    it('should throw error when agent capacity is exceeded', async () => {
      // Arrange
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const agent: User = {
        id: 2,
        name: 'Agent Smith',
        email: 'agent@example.com',
        role: 'agent',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(user);
      mockUserRepo.addUser(agent);

      // Create 20 tickets assigned to agent (at capacity)
      for (let i = 0; i < 20; i++) {
        await mockTicketRepo.create({
          title: `Ticket ${i}`,
          description: 'Test',
          user_id: 1,
          assigned_to: 2,
          category_id: 1,
          priority_id: 2,
          status_id: 1, // Open
          organization_id: 1,
        });
      }

      const newTicketData = {
        title: 'One More Ticket',
        description: 'Test',
        user_id: 1,
        assigned_to: 2,
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      };

      // Act & Assert
      await expect(
        ticketService.createTicket(newTicketData)
      ).rejects.toThrow('has reached maximum ticket capacity');
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket to agent successfully', async () => {
      // Arrange
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const agent: User = {
        id: 2,
        name: 'Agent Smith',
        email: 'agent@example.com',
        role: 'agent',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(user);
      mockUserRepo.addUser(agent);

      const ticket = await mockTicketRepo.create({
        title: 'Unassigned Ticket',
        description: 'Test',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      });

      // Act
      const assigned = await ticketService.assignTicket(ticket.id, 2, 1);

      // Assert
      expect(assigned.assigned_to).toBe(2);
    });

    it('should throw error when assigning non-existent ticket', async () => {
      // Act & Assert
      await expect(
        ticketService.assignTicket(999, 2, 1)
      ).rejects.toThrow('Ticket not found');
    });

    it('should throw error when assigning to non-agent role', async () => {
      // Arrange
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const regularUser: User = {
        id: 2,
        name: 'Regular User',
        email: 'user2@example.com',
        role: 'user', // Not an agent
        organization_id: 1,
        is_active: true,
        is_email_verified: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        two_factor_enabled: false,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockUserRepo.addUser(user);
      mockUserRepo.addUser(regularUser);

      const ticket = await mockTicketRepo.create({
        title: 'Test Ticket',
        description: 'Test',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      });

      // Act & Assert
      await expect(
        ticketService.assignTicket(ticket.id, 2, 1)
      ).rejects.toThrow('Only agents and admins can be assigned tickets');
    });
  });

  describe('closeTicket', () => {
    it('should close a resolved ticket', async () => {
      // Arrange
      const resolvedTicket = await mockTicketRepo.create({
        title: 'Resolved Ticket',
        description: 'Test',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 3, // Resolved
        organization_id: 1,
      });

      // Act
      const closed = await ticketService.closeTicket(resolvedTicket.id, 1);

      // Assert
      expect(closed.status_id).toBe(4); // Closed
    });

    it('should throw error when closing non-resolved ticket', async () => {
      // Arrange
      const openTicket = await mockTicketRepo.create({
        title: 'Open Ticket',
        description: 'Test',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 1, // Open (not resolved)
        organization_id: 1,
      });

      // Act & Assert
      await expect(
        ticketService.closeTicket(openTicket.id, 1)
      ).rejects.toThrow('Can only close tickets that are already resolved');
    });
  });

  describe('deleteTicket', () => {
    it('should soft delete a ticket', async () => {
      // Arrange
      const ticket = await mockTicketRepo.create({
        title: 'Test Ticket',
        description: 'Test',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 1,
        organization_id: 1,
      });

      // Act
      await ticketService.deleteTicket(ticket.id, 1);

      // Assert - ticket should be soft deleted
      const deletedTicket = await mockTicketRepo.findById(ticket.id);
      expect((deletedTicket as any)?.deleted_at).toBeDefined();
    });

    it('should throw error when deleting old resolved tickets', async () => {
      // Arrange
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const oldResolvedTicket = await mockTicketRepo.create({
        title: 'Old Resolved Ticket',
        description: 'Test',
        user_id: 1,
        category_id: 1,
        priority_id: 2,
        status_id: 3,
        organization_id: 1,
        resolved_at: oldDate.toISOString(),
      });

      // Act & Assert
      await expect(
        ticketService.deleteTicket(oldResolvedTicket.id, 1)
      ).rejects.toThrow('Cannot delete tickets resolved more than 30 days ago');
    });
  });
});
