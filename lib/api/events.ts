/**
 * Event-Driven Architecture Base
 * Enterprise-grade event system with pub/sub, event sourcing, and CQRS patterns
 */

import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { SystemEvent } from './types'
import logger from '../monitoring/structured-logger';

// Event Store Interface
interface EventStore {
  append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>
  getAllEvents(fromTimestamp?: string): Promise<DomainEvent[]>
  getEventsByType(eventType: string, fromTimestamp?: string): Promise<DomainEvent[]>
  createSnapshot(streamId: string, version: number, data: any): Promise<void>
  getSnapshot(streamId: string): Promise<EventSnapshot | null>
}

// Event Snapshot
interface EventSnapshot {
  streamId: string
  version: number
  data: any
  timestamp: string
}

// Domain Event
export interface DomainEvent<T = any> {
  id: string
  streamId: string
  eventType: string
  eventVersion: number
  data: T
  metadata?: Record<string, any>
  timestamp: string
  version: number
  causationId?: string
  correlationId?: string
  userId?: number
}

// Event Handler Interface
export interface EventHandler<T = any> {
  handle(event: DomainEvent<T>): Promise<void>
  canHandle(eventType: string): boolean
  priority?: number
}

// Aggregate Root
export abstract class AggregateRoot {
  private _version = 0
  private _uncommittedEvents: DomainEvent[] = []

  protected applyEvent(eventType: string, data: any, metadata?: Record<string, any>): void {
    const event: DomainEvent = {
      id: uuidv4(),
      streamId: this.getId(),
      eventType,
      eventVersion: 1,
      data,
      metadata,
      timestamp: new Date().toISOString(),
      version: this._version + 1,
    }

    this._uncommittedEvents.push(event)
    this._version++
    this.applyEventToState(event)
  }

  protected abstract applyEventToState(event: DomainEvent): void
  protected abstract getId(): string

  public getUncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents]
  }

  public markEventsAsCommitted(): void {
    this._uncommittedEvents = []
  }

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEventToState(event)
      this._version = event.version
    })
  }

  public getVersion(): number {
    return this._version
  }
}

// In-Memory Event Store
class MemoryEventStore implements EventStore {
  private events: Map<string, DomainEvent[]> = new Map()
  private snapshots: Map<string, EventSnapshot> = new Map()

  async append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    const existingEvents = this.events.get(streamId) || []

    if (expectedVersion !== undefined) {
      const currentVersion = existingEvents.length
      if (currentVersion !== expectedVersion) {
        throw new Error(`Concurrency conflict. Expected version ${expectedVersion}, but current version is ${currentVersion}`)
      }
    }

    this.events.set(streamId, [...existingEvents, ...events])
  }

  async getEvents(streamId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const events = this.events.get(streamId) || []
    return events.filter(event => event.version > fromVersion)
  }

  async getAllEvents(fromTimestamp?: string): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = []

    for (const events of this.events.values()) {
      allEvents.push(...events)
    }

    const filtered = fromTimestamp
      ? allEvents.filter(event => event.timestamp >= fromTimestamp)
      : allEvents

    return filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  async getEventsByType(eventType: string, fromTimestamp?: string): Promise<DomainEvent[]> {
    const allEvents = await this.getAllEvents(fromTimestamp)
    return allEvents.filter(event => event.eventType === eventType)
  }

  async createSnapshot(streamId: string, version: number, data: any): Promise<void> {
    const snapshot: EventSnapshot = {
      streamId,
      version,
      data,
      timestamp: new Date().toISOString(),
    }
    this.snapshots.set(streamId, snapshot)
  }

  async getSnapshot(streamId: string): Promise<EventSnapshot | null> {
    return this.snapshots.get(streamId) || null
  }
}

// Event Bus
export class EventBus extends EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map()
  private middlewares: EventMiddleware[] = []
  private eventStore: EventStore
  private isProcessing = false
  private eventQueue: DomainEvent[] = []

  constructor(eventStore?: EventStore) {
    super()
    this.eventStore = eventStore || new MemoryEventStore()
    this.setMaxListeners(0) // Remove limit
  }

  // Register event handler
  registerHandler(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }

    const handlers = this.handlers.get(eventType)!
    handlers.push(handler)

    // Sort by priority (higher priority first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  // Unregister event handler
  unregisterHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  // Register middleware
  registerMiddleware(middleware: EventMiddleware): void {
    this.middlewares.push(middleware)
    this.middlewares.sort((a, b) => (a.priority || 0) - (b.priority || 0))
  }

  // Publish event
  async publish(event: DomainEvent): Promise<void> {
    // Apply middlewares
    let processedEvent = event
    for (const middleware of this.middlewares) {
      processedEvent = await middleware.process(processedEvent)
    }

    // Store event
    await this.eventStore.append(event.streamId, [processedEvent])

    // Add to processing queue
    this.eventQueue.push(processedEvent)

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processEventQueue()
    }

    // Emit for real-time subscribers
    this.emit(event.eventType, processedEvent)
    this.emit('*', processedEvent) // Wildcard listener
  }

  // Process event queue
  private async processEventQueue(): Promise<void> {
    this.isProcessing = true

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!

      try {
        await this.handleEvent(event)
      } catch (error) {
        logger.error(`Error handling event ${event.eventType}:`, error)
        // Could implement retry logic or dead letter queue here
      }
    }

    this.isProcessing = false
  }

  // Handle individual event
  private async handleEvent(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || []
    const wildcardHandlers = this.handlers.get('*') || []

    const allHandlers = [...handlers, ...wildcardHandlers]

    // Execute handlers in parallel (for better performance)
    // In production, you might want sequential execution for some events
    await Promise.all(
      allHandlers.map(async handler => {
        try {
          if (handler.canHandle(event.eventType)) {
            await handler.handle(event)
          }
        } catch (error) {
          logger.error(`Handler error for event ${event.eventType}:`, error)
        }
      })
    )
  }

  // Get events from store
  async getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]> {
    return this.eventStore.getEvents(streamId, fromVersion)
  }

  // Get all events
  async getAllEvents(fromTimestamp?: string): Promise<DomainEvent[]> {
    return this.eventStore.getAllEvents(fromTimestamp)
  }

  // Replay events
  async replay(fromTimestamp?: string): Promise<void> {
    const events = await this.eventStore.getAllEvents(fromTimestamp)

    for (const event of events) {
      await this.handleEvent(event)
    }
  }

  // Create projection
  async createProjection<T>(
    projectionName: string,
    eventTypes: string[],
    reducer: (state: T, event: DomainEvent) => T,
    initialState: T
  ): Promise<T> {
    let state = initialState

    for (const eventType of eventTypes) {
      const events = await this.eventStore.getEventsByType(eventType)

      for (const event of events) {
        state = reducer(state, event)
      }
    }

    return state
  }
}

// Event Middleware
export interface EventMiddleware {
  process(event: DomainEvent): Promise<DomainEvent>
  priority?: number
}

// Audit Middleware
export class AuditMiddleware implements EventMiddleware {
  priority = 100

  async process(event: DomainEvent): Promise<DomainEvent> {
    // Add audit metadata
    return {
      ...event,
      metadata: {
        ...event.metadata,
        auditTrail: {
          timestamp: new Date().toISOString(),
          source: 'event-bus',
        },
      },
    }
  }
}

// Correlation Middleware
export class CorrelationMiddleware implements EventMiddleware {
  priority = 200

  async process(event: DomainEvent): Promise<DomainEvent> {
    // Ensure correlation ID is set
    if (!event.correlationId) {
      event.correlationId = uuidv4()
    }

    return event
  }
}

// Validation Middleware
export class ValidationMiddleware implements EventMiddleware {
  priority = 300

  async process(event: DomainEvent): Promise<DomainEvent> {
    // Validate event structure
    if (!event.id || !event.eventType || !event.streamId) {
      throw new Error('Invalid event structure')
    }

    return event
  }
}

// Event Handlers for ServiceDesk Domain

// Ticket Event Handler
export class TicketEventHandler implements EventHandler {
  priority = 100

  canHandle(eventType: string): boolean {
    return eventType.startsWith('ticket.')
  }

  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'ticket.created':
        await this.handleTicketCreated(event)
        break
      case 'ticket.updated':
        await this.handleTicketUpdated(event)
        break
      case 'ticket.assigned':
        await this.handleTicketAssigned(event)
        break
      case 'ticket.resolved':
        await this.handleTicketResolved(event)
        break
      case 'ticket.closed':
        await this.handleTicketClosed(event)
        break
    }
  }

  private async handleTicketCreated(event: DomainEvent): Promise<void> {
    logger.info('Handling ticket created', event.data)
    // Implement business logic: notifications, SLA tracking, etc.
  }

  private async handleTicketUpdated(event: DomainEvent): Promise<void> {
    logger.info('Handling ticket updated', event.data)
    // Implement business logic: audit logging, notifications, etc.
  }

  private async handleTicketAssigned(event: DomainEvent): Promise<void> {
    logger.info('Handling ticket assigned', event.data)
    // Implement business logic: notifications, workload tracking, etc.
  }

  private async handleTicketResolved(event: DomainEvent): Promise<void> {
    logger.info('Handling ticket resolved', event.data)
    // Implement business logic: SLA completion, satisfaction surveys, etc.
  }

  private async handleTicketClosed(event: DomainEvent): Promise<void> {
    logger.info('Handling ticket closed', event.data)
    // Implement business logic: analytics, archiving, etc.
  }
}

// Notification Event Handler
export class NotificationEventHandler implements EventHandler {
  priority = 200

  canHandle(eventType: string): boolean {
    return true // Handle all events for notifications
  }

  async handle(event: DomainEvent): Promise<void> {
    // Determine who should be notified based on event type and data
    const recipients = await this.getRecipientsForEvent(event)

    for (const recipient of recipients) {
      await this.sendNotification(recipient, event)
    }
  }

  private async getRecipientsForEvent(event: DomainEvent): Promise<number[]> {
    // Implement logic to determine notification recipients
    // This would typically query the database for relevant users
    return []
  }

  private async sendNotification(userId: number, event: DomainEvent): Promise<void> {
    // Implement notification sending logic
    logger.info(`Sending notification to user ${userId} for event ${event.eventType}`)
  }
}

// Analytics Event Handler
export class AnalyticsEventHandler implements EventHandler {
  priority = 50

  canHandle(eventType: string): boolean {
    return true // Collect analytics for all events
  }

  async handle(event: DomainEvent): Promise<void> {
    // Update analytics metrics based on event
    await this.updateMetrics(event)
  }

  private async updateMetrics(event: DomainEvent): Promise<void> {
    // Implement analytics collection logic
    logger.info(`Updating analytics metrics for event ${event.eventType}`)
  }
}

// Event Types Registry
export const EventTypes = {
  // Ticket Events
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_UNASSIGNED: 'ticket.unassigned',
  TICKET_STATUS_CHANGED: 'ticket.status_changed',
  TICKET_PRIORITY_CHANGED: 'ticket.priority_changed',
  TICKET_CATEGORY_CHANGED: 'ticket.category_changed',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_CLOSED: 'ticket.closed',
  TICKET_REOPENED: 'ticket.reopened',
  TICKET_ESCALATED: 'ticket.escalated',

  // Comment Events
  COMMENT_CREATED: 'comment.created',
  COMMENT_UPDATED: 'comment.updated',
  COMMENT_DELETED: 'comment.deleted',

  // User Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_ROLE_CHANGED: 'user.role_changed',

  // SLA Events
  SLA_WARNING: 'sla.warning',
  SLA_BREACH: 'sla.breach',
  SLA_RESOLUTION_WARNING: 'sla.resolution_warning',
  SLA_RESOLUTION_BREACH: 'sla.resolution_breach',

  // System Events
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_MAINTENANCE_START: 'system.maintenance_start',
  SYSTEM_MAINTENANCE_END: 'system.maintenance_end',

  // Integration Events
  INTEGRATION_SYNC_START: 'integration.sync_start',
  INTEGRATION_SYNC_COMPLETE: 'integration.sync_complete',
  INTEGRATION_SYNC_ERROR: 'integration.sync_error',
  WEBHOOK_DELIVERED: 'webhook.delivered',
  WEBHOOK_FAILED: 'webhook.failed',

  // Knowledge Base Events
  KNOWLEDGE_ARTICLE_CREATED: 'knowledge.article_created',
  KNOWLEDGE_ARTICLE_UPDATED: 'knowledge.article_updated',
  KNOWLEDGE_ARTICLE_PUBLISHED: 'knowledge.article_published',
  KNOWLEDGE_ARTICLE_VIEWED: 'knowledge.article_viewed',
  KNOWLEDGE_FEEDBACK_RECEIVED: 'knowledge.feedback_received',
} as const

// Create default event bus instance
export const eventBus = new EventBus()

// Register default middlewares
eventBus.registerMiddleware(new ValidationMiddleware())
eventBus.registerMiddleware(new CorrelationMiddleware())
eventBus.registerMiddleware(new AuditMiddleware())

// Register default handlers
eventBus.registerHandler('ticket.*', new TicketEventHandler())
eventBus.registerHandler('*', new NotificationEventHandler())
eventBus.registerHandler('*', new AnalyticsEventHandler())

// Event Bus Configuration
export function configureEventBus(config: {
  eventStore?: EventStore
  middlewares?: EventMiddleware[]
  handlers?: { eventType: string; handler: EventHandler }[]
}): void {
  if (config.eventStore) {
    // Would need to recreate the event bus with new store
    // This is simplified for demonstration
  }

  if (config.middlewares) {
    config.middlewares.forEach(middleware => {
      eventBus.registerMiddleware(middleware)
    })
  }

  if (config.handlers) {
    config.handlers.forEach(({ eventType, handler }) => {
      eventBus.registerHandler(eventType, handler)
    })
  }
}

// Utility functions for creating events
export const createEvent = (
  streamId: string,
  eventType: string,
  data: any,
  metadata?: Record<string, any>
): DomainEvent => ({
  id: uuidv4(),
  streamId,
  eventType,
  eventVersion: 1,
  data,
  metadata,
  timestamp: new Date().toISOString(),
  version: 1,
})

export const publishEvent = async (
  streamId: string,
  eventType: string,
  data: any,
  metadata?: Record<string, any>
): Promise<void> => {
  const event = createEvent(streamId, eventType, data, metadata)
  await eventBus.publish(event)
}

export default {
  EventBus,
  AggregateRoot,
  eventBus,
  EventTypes,
  createEvent,
  publishEvent,
  configureEventBus,
}