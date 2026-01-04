/**
 * Dependency Injection Container
 *
 * Central registry for service instances using singleton pattern.
 * Enables dependency injection, testing with mocks, and loose coupling.
 *
 * @module lib/di/container
 */

import { TicketRepository } from '@/lib/repositories/ticket-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { TicketService } from '@/lib/services/ticket-service';
import { UserService } from '@/lib/services/user-service';
import type { ITicketRepository, IUserRepository } from '@/lib/interfaces/repositories';

/**
 * Service container for managing singleton instances
 */
class ServiceContainer {
  // Repository instances
  private ticketRepositoryInstance: ITicketRepository | null = null;
  private userRepositoryInstance: IUserRepository | null = null;

  // Service instances
  private ticketServiceInstance: TicketService | null = null;
  private userServiceInstance: UserService | null = null;

  /**
   * Get or create TicketRepository singleton
   */
  getTicketRepository(): ITicketRepository {
    if (!this.ticketRepositoryInstance) {
      this.ticketRepositoryInstance = new TicketRepository();
    }
    return this.ticketRepositoryInstance;
  }

  /**
   * Get or create UserRepository singleton
   */
  getUserRepository(): IUserRepository {
    if (!this.userRepositoryInstance) {
      this.userRepositoryInstance = new UserRepository();
    }
    return this.userRepositoryInstance;
  }

  /**
   * Get or create TicketService singleton
   */
  getTicketService(): TicketService {
    if (!this.ticketServiceInstance) {
      const ticketRepo = this.getTicketRepository();
      const userRepo = this.getUserRepository();
      this.ticketServiceInstance = new TicketService(ticketRepo, userRepo);
    }
    return this.ticketServiceInstance;
  }

  /**
   * Get or create UserService singleton
   */
  getUserService(): UserService {
    if (!this.userServiceInstance) {
      const userRepo = this.getUserRepository();
      this.userServiceInstance = new UserService(userRepo);
    }
    return this.userServiceInstance;
  }

  /**
   * Override TicketRepository (for testing)
   */
  setTicketRepository(repository: ITicketRepository): void {
    this.ticketRepositoryInstance = repository;
    // Invalidate dependent services
    this.ticketServiceInstance = null;
  }

  /**
   * Override UserRepository (for testing)
   */
  setUserRepository(repository: IUserRepository): void {
    this.userRepositoryInstance = repository;
    // Invalidate dependent services
    this.userServiceInstance = null;
    this.ticketServiceInstance = null;
  }

  /**
   * Override TicketService (for testing)
   */
  setTicketService(service: TicketService): void {
    this.ticketServiceInstance = service;
  }

  /**
   * Override UserService (for testing)
   */
  setUserService(service: UserService): void {
    this.userServiceInstance = service;
  }

  /**
   * Reset all instances (useful for testing)
   */
  reset(): void {
    this.ticketRepositoryInstance = null;
    this.userRepositoryInstance = null;
    this.ticketServiceInstance = null;
    this.userServiceInstance = null;
  }
}

// Export singleton container instance
export const container = new ServiceContainer();

// Convenience functions for common usage
export function getTicketService(): TicketService {
  return container.getTicketService();
}

export function getUserService(): UserService {
  return container.getUserService();
}

export function getTicketRepository(): ITicketRepository {
  return container.getTicketRepository();
}

export function getUserRepository(): IUserRepository {
  return container.getUserRepository();
}

// Testing utilities
export function setTicketService(service: TicketService): void {
  container.setTicketService(service);
}

export function setUserService(service: UserService): void {
  container.setUserService(service);
}

export function setTicketRepository(repository: ITicketRepository): void {
  container.setTicketRepository(repository);
}

export function setUserRepository(repository: IUserRepository): void {
  container.setUserRepository(repository);
}

export function resetContainer(): void {
  container.reset();
}
