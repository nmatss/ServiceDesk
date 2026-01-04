/**
 * Repository Interfaces for Clean Architecture
 *
 * Defines contracts for data access layer following Repository Pattern.
 * Enables dependency injection, mocking, and testability.
 *
 * @module lib/interfaces/repositories
 */

import type {
  User,
  Ticket,
  TicketWithDetails,
  CreateUser,
  CreateTicket,
  UpdateUser,
  UpdateTicket,
  SLATracking,
  Notification,
  Comment,
  Attachment,
} from '@/lib/types/database';

// ========================================
// Base Repository Interface
// ========================================

/**
 * Generic repository interface for CRUD operations
 * @template T - Entity type
 */
export interface IRepository<T> {
  findById(id: number): Promise<T | null>;
  findAll(filters?: any): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
  count(filters?: any): Promise<number>;
}

// ========================================
// Ticket Repository Interface
// ========================================

export interface TicketFilters {
  status_id?: number;
  priority_id?: number;
  category_id?: number;
  user_id?: number;
  assigned_to?: number;
  organization_id?: number;
  sla_status?: 'on_track' | 'at_risk' | 'breached';
  search?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface TicketMetrics {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  by_priority: Record<string, number>;
  by_category: Record<string, number>;
  avg_resolution_time_hours: number;
  sla_compliance_rate: number;
}

export interface ITicketRepository extends IRepository<Ticket> {
  // Extended queries
  findByStatus(statusId: number, organizationId: number): Promise<Ticket[]>;
  findByUser(userId: number): Promise<Ticket[]>;
  findByAssignee(assigneeId: number): Promise<Ticket[]>;
  findWithDetails(id: number): Promise<TicketWithDetails | null>;
  findAllWithDetails(filters?: TicketFilters): Promise<TicketWithDetails[]>;

  // Aggregate queries
  countByStatus(organizationId: number): Promise<Record<string, number>>;
  countByPriority(organizationId: number): Promise<Record<string, number>>;
  getMetrics(organizationId: number, dateRange?: { start: string; end: string }): Promise<TicketMetrics>;

  // SLA related
  findSLABreached(organizationId: number): Promise<Ticket[]>;
  findSLAAtRisk(organizationId: number): Promise<Ticket[]>;

  // Assignment
  findUnassigned(organizationId: number): Promise<Ticket[]>;
  bulkAssign(ticketIds: number[], assigneeId: number): Promise<void>;

  // Soft delete
  softDelete(id: number): Promise<void>;
  restore(id: number): Promise<void>;
}

// ========================================
// User Repository Interface
// ========================================

export interface UserFilters {
  role?: string;
  organization_id?: number;
  is_active?: boolean;
  is_email_verified?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IUserRepository extends IRepository<User> {
  // Authentication
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<User | null>;

  // Role queries
  findByRole(role: string, organizationId?: number): Promise<User[]>;
  findAgents(organizationId: number): Promise<User[]>;
  findAdmins(organizationId: number): Promise<User[]>;

  // Security
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  incrementFailedLoginAttempts(userId: number): Promise<void>;
  resetFailedLoginAttempts(userId: number): Promise<void>;
  lockAccount(userId: number, until: string): Promise<void>;
  unlockAccount(userId: number): Promise<void>;

  // 2FA
  enable2FA(userId: number, secret: string): Promise<void>;
  disable2FA(userId: number): Promise<void>;

  // Activity tracking
  updateLastLogin(userId: number): Promise<void>;

  // Organization
  findByOrganization(organizationId: number): Promise<User[]>;
}

// ========================================
// Analytics Repository Interface
// ========================================

export interface DateRange {
  start: string;
  end: string;
}

export interface AgentPerformance {
  agent_id: number;
  agent_name: string;
  tickets_assigned: number;
  tickets_resolved: number;
  avg_resolution_time_hours: number;
  sla_compliance_rate: number;
  satisfaction_score: number;
}

export interface SLAMetrics {
  total_tickets: number;
  tickets_with_sla: number;
  on_track: number;
  at_risk: number;
  breached: number;
  compliance_rate: number;
  avg_response_time_hours: number;
  avg_resolution_time_hours: number;
}

export interface IAnalyticsRepository {
  // Ticket analytics
  getTicketMetrics(organizationId: number, dateRange?: DateRange): Promise<TicketMetrics>;
  getTicketTrends(organizationId: number, dateRange: DateRange, groupBy: 'day' | 'week' | 'month'): Promise<any[]>;

  // Agent performance
  getAgentPerformance(organizationId: number, dateRange?: DateRange): Promise<AgentPerformance[]>;
  getAgentWorkload(organizationId: number): Promise<{ agent_id: number; agent_name: string; open_tickets: number }[]>;

  // SLA analytics
  getSLACompliance(organizationId: number, dateRange?: DateRange): Promise<SLAMetrics>;

  // Category analytics
  getTicketsByCategory(organizationId: number, dateRange?: DateRange): Promise<{ category_name: string; count: number }[]>;

  // Time-based analytics
  getAverageResolutionTime(organizationId: number, dateRange?: DateRange): Promise<number>;
  getAverageFirstResponseTime(organizationId: number, dateRange?: DateRange): Promise<number>;
}

// ========================================
// Comment Repository Interface
// ========================================

export interface ICommentRepository extends IRepository<Comment> {
  findByTicket(ticketId: number): Promise<Comment[]>;
  findPublicByTicket(ticketId: number): Promise<Comment[]>;
  findInternalByTicket(ticketId: number): Promise<Comment[]>;
  countByTicket(ticketId: number): Promise<number>;
}

// ========================================
// Attachment Repository Interface
// ========================================

export interface IAttachmentRepository extends IRepository<Attachment> {
  findByTicket(ticketId: number): Promise<Attachment[]>;
  countByTicket(ticketId: number): Promise<number>;
  deleteByTicket(ticketId: number): Promise<void>;
}

// ========================================
// SLA Repository Interface
// ========================================

export interface ISLARepository {
  findByTicket(ticketId: number): Promise<SLATracking | null>;
  createTracking(ticketId: number, policyId: number): Promise<SLATracking>;
  updateTracking(trackingId: number, data: Partial<SLATracking>): Promise<SLATracking>;
  findBreached(organizationId: number): Promise<SLATracking[]>;
  findAtRisk(organizationId: number, hoursThreshold: number): Promise<SLATracking[]>;
}

// ========================================
// Notification Repository Interface
// ========================================

export interface INotificationRepository extends IRepository<Notification> {
  findByUser(userId: number, limit?: number): Promise<Notification[]>;
  findUnreadByUser(userId: number): Promise<Notification[]>;
  markAsRead(notificationId: number): Promise<void>;
  markAllAsRead(userId: number): Promise<void>;
  countUnread(userId: number): Promise<number>;
}
