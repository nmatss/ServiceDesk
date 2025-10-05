/**
 * Webhook System Foundation
 * Enterprise-grade webhook delivery system with retry logic and security
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { WebhookEvent, WebhookEndpoint, WebhookDelivery } from './types'
import { v4 as uuidv4 } from 'uuid'

// Webhook Configuration
interface WebhookConfig {
  maxRetries: number
  retryDelays: number[] // Exponential backoff delays in milliseconds
  timeout: number
  maxBodySize: number
  secretHeader: string
  timestampHeader: string
  signatureHeader: string
  timestampTolerance: number // seconds
}

// Webhook Store Interface
interface WebhookStore {
  // Endpoints
  getEndpoint(id: string): Promise<WebhookEndpoint | null>
  getActiveEndpoints(event?: string): Promise<WebhookEndpoint[]>
  createEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt'>): Promise<WebhookEndpoint>
  updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | null>
  deleteEndpoint(id: string): Promise<boolean>

  // Events
  createEvent(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<WebhookEvent>
  getEvent(id: string): Promise<WebhookEvent | null>

  // Deliveries
  createDelivery(delivery: Omit<WebhookDelivery, 'id' | 'createdAt'>): Promise<WebhookDelivery>
  updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | null>
  getDelivery(id: string): Promise<WebhookDelivery | null>
  getFailedDeliveries(): Promise<WebhookDelivery[]>
  getDeliveriesForEndpoint(endpointId: string, limit?: number): Promise<WebhookDelivery[]>
}

// In-Memory Webhook Store (for development)
class MemoryWebhookStore implements WebhookStore {
  private endpoints = new Map<string, WebhookEndpoint>()
  private events = new Map<string, WebhookEvent>()
  private deliveries = new Map<string, WebhookDelivery>()

  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.get(id) || null
  }

  async getActiveEndpoints(event?: string): Promise<WebhookEndpoint[]> {
    const endpoints = Array.from(this.endpoints.values()).filter(ep => ep.active)

    if (event) {
      return endpoints.filter(ep => ep.events.includes(event))
    }

    return endpoints
  }

  async createEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt'>): Promise<WebhookEndpoint> {
    const id = uuidv4()
    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      id,
      createdAt: new Date().toISOString(),
    }
    this.endpoints.set(id, newEndpoint)
    return newEndpoint
  }

  async updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | null> {
    const endpoint = this.endpoints.get(id)
    if (!endpoint) return null

    const updated = { ...endpoint, ...updates }
    this.endpoints.set(id, updated)
    return updated
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    return this.endpoints.delete(id)
  }

  async createEvent(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<WebhookEvent> {
    const id = uuidv4()
    const newEvent: WebhookEvent = {
      ...event,
      id,
      timestamp: new Date().toISOString(),
    }
    this.events.set(id, newEvent)
    return newEvent
  }

  async getEvent(id: string): Promise<WebhookEvent | null> {
    return this.events.get(id) || null
  }

  async createDelivery(delivery: Omit<WebhookDelivery, 'id' | 'createdAt'>): Promise<WebhookDelivery> {
    const id = uuidv4()
    const newDelivery: WebhookDelivery = {
      ...delivery,
      id,
      createdAt: new Date().toISOString(),
    }
    this.deliveries.set(id, newDelivery)
    return newDelivery
  }

  async updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | null> {
    const delivery = this.deliveries.get(id)
    if (!delivery) return null

    const updated = { ...delivery, ...updates }
    this.deliveries.set(id, updated)
    return updated
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(id) || null
  }

  async getFailedDeliveries(): Promise<WebhookDelivery[]> {
    return Array.from(this.deliveries.values()).filter(d => d.status === 'failed')
  }

  async getDeliveriesForEndpoint(endpointId: string, limit = 100): Promise<WebhookDelivery[]> {
    return Array.from(this.deliveries.values())
      .filter(d => d.endpointId === endpointId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }
}

// Webhook Manager
export class WebhookManager {
  private store: WebhookStore
  private config: WebhookConfig
  private deliveryQueue: WebhookDelivery[] = []
  private processing = false

  constructor(store?: WebhookStore, config?: Partial<WebhookConfig>) {
    this.store = store || new MemoryWebhookStore()
    this.config = {
      maxRetries: 3,
      retryDelays: [1000, 5000, 15000], // 1s, 5s, 15s
      timeout: 30000, // 30 seconds
      maxBodySize: 10 * 1024 * 1024, // 10MB
      secretHeader: 'X-Webhook-Secret',
      timestampHeader: 'X-Webhook-Timestamp',
      signatureHeader: 'X-Webhook-Signature',
      timestampTolerance: 300, // 5 minutes
      ...config,
    }

    // Start processing queue
    this.startQueueProcessor()
  }

  // Create webhook endpoint
  async createEndpoint(data: {
    url: string
    events: string[]
    secret?: string
    headers?: Record<string, string>
    active?: boolean
  }): Promise<WebhookEndpoint> {
    const secret = data.secret || this.generateSecret()

    return this.store.createEndpoint({
      url: data.url,
      events: data.events,
      secret,
      active: data.active !== false,
      lastDelivery: undefined,
    })
  }

  // Update webhook endpoint
  async updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | null> {
    return this.store.updateEndpoint(id, updates)
  }

  // Delete webhook endpoint
  async deleteEndpoint(id: string): Promise<boolean> {
    return this.store.deleteEndpoint(id)
  }

  // Get webhook endpoint
  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    return this.store.getEndpoint(id)
  }

  // List webhook endpoints
  async listEndpoints(event?: string): Promise<WebhookEndpoint[]> {
    return this.store.getActiveEndpoints(event)
  }

  // Emit webhook event
  async emit(type: string, data: any, source = 'system'): Promise<WebhookEvent> {
    const event = await this.store.createEvent({
      type,
      data,
      source,
      version: '1.0',
    })

    // Schedule deliveries for all matching endpoints
    await this.scheduleDeliveries(event)

    return event
  }

  // Schedule deliveries for an event
  private async scheduleDeliveries(event: WebhookEvent): Promise<void> {
    const endpoints = await this.store.getActiveEndpoints(event.type)

    for (const endpoint of endpoints) {
      const delivery = await this.store.createDelivery({
        endpointId: endpoint.id,
        eventId: event.id,
        status: 'pending',
        attempts: 0,
      })

      this.deliveryQueue.push(delivery)
    }
  }

  // Start queue processor
  private startQueueProcessor(): void {
    if (this.processing) return

    this.processing = true
    this.processQueue()
  }

  // Process delivery queue
  private async processQueue(): Promise<void> {
    while (this.processing) {
      if (this.deliveryQueue.length === 0) {
        await this.sleep(1000) // Wait 1 second before checking again
        continue
      }

      const delivery = this.deliveryQueue.shift()
      if (!delivery) continue

      try {
        await this.processDelivery(delivery)
      } catch (error) {
        console.error('Error processing webhook delivery:', error)
      }
    }
  }

  // Process individual delivery
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const endpoint = await this.store.getEndpoint(delivery.endpointId)
    const event = await this.store.getEvent(delivery.eventId)

    if (!endpoint || !event) {
      await this.store.updateDelivery(delivery.id, {
        status: 'failed',
        response: {
          status: 404,
          body: 'Endpoint or event not found',
          headers: {},
        },
      })
      return
    }

    try {
      const response = await this.deliverWebhook(endpoint, event)

      if (response.ok) {
        await this.store.updateDelivery(delivery.id, {
          status: 'success',
          attempts: delivery.attempts + 1,
          deliveredAt: new Date().toISOString(),
          response: {
            status: response.status,
            body: await response.text(),
            headers: Object.fromEntries(response.headers.entries()),
          },
        })

        // Update endpoint last delivery time
        await this.store.updateEndpoint(endpoint.id, {
          lastDelivery: new Date().toISOString(),
        })
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      const attempts = delivery.attempts + 1
      const shouldRetry = attempts < this.config.maxRetries

      if (shouldRetry) {
        // Schedule retry with exponential backoff
        const delay = this.config.retryDelays[attempts - 1] || this.config.retryDelays[this.config.retryDelays.length - 1]

        setTimeout(() => {
          this.deliveryQueue.push({
            ...delivery,
            attempts,
            status: 'retry',
          })
        }, delay)

        await this.store.updateDelivery(delivery.id, {
          status: 'retry',
          attempts,
          response: {
            status: 0,
            body: error instanceof Error ? error.message : 'Unknown error',
            headers: {},
          },
        })
      } else {
        await this.store.updateDelivery(delivery.id, {
          status: 'failed',
          attempts,
          response: {
            status: 0,
            body: error instanceof Error ? error.message : 'Unknown error',
            headers: {},
          },
        })
      }
    }
  }

  // Deliver webhook to endpoint
  private async deliverWebhook(endpoint: WebhookEndpoint, event: WebhookEvent): Promise<Response> {
    const payload = JSON.stringify({
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
      version: event.version,
      source: event.source,
    })

    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = this.generateSignature(payload, endpoint.secret, timestamp)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ServiceDesk-Webhooks/1.0',
      [this.config.secretHeader]: endpoint.secret,
      [this.config.timestampHeader]: timestamp,
      [this.config.signatureHeader]: signature,
    }

    // Add custom headers if any
    if (endpoint.id) {
      const customEndpoint = await this.store.getEndpoint(endpoint.id)
      // In a real implementation, custom headers would be stored in the endpoint
    }

    return fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(this.config.timeout),
    })
  }

  // Generate webhook signature
  private generateSignature(payload: string, secret: string, timestamp: string): string {
    const message = `${timestamp}.${payload}`
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex')
    return `sha256=${signature}`
  }

  // Verify webhook signature
  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp?: string
  ): boolean {
    try {
      // Verify timestamp if provided
      if (timestamp) {
        const now = Math.floor(Date.now() / 1000)
        const requestTime = parseInt(timestamp, 10)

        if (Math.abs(now - requestTime) > this.config.timestampTolerance) {
          return false
        }
      }

      // Generate expected signature
      const message = timestamp ? `${timestamp}.${payload}` : payload
      const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex')
      const expected = `sha256=${expectedSignature}`

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    } catch (error) {
      console.error('Webhook signature verification error:', error)
      return false
    }
  }

  // Generate webhook secret
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  // Retry failed deliveries
  async retryFailedDeliveries(): Promise<void> {
    const failedDeliveries = await this.store.getFailedDeliveries()

    for (const delivery of failedDeliveries) {
      // Reset delivery for retry
      await this.store.updateDelivery(delivery.id, {
        status: 'pending',
        attempts: 0,
      })

      this.deliveryQueue.push({
        ...delivery,
        status: 'pending',
        attempts: 0,
      })
    }
  }

  // Get delivery history for endpoint
  async getDeliveryHistory(endpointId: string, limit = 100): Promise<WebhookDelivery[]> {
    return this.store.getDeliveriesForEndpoint(endpointId, limit)
  }

  // Test webhook endpoint
  async testEndpoint(endpointId: string): Promise<WebhookDelivery> {
    const endpoint = await this.store.getEndpoint(endpointId)
    if (!endpoint) {
      throw new Error('Endpoint not found')
    }

    const testEvent = await this.store.createEvent({
      type: 'webhook.test',
      data: {
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
      },
      source: 'webhook_test',
      version: '1.0',
    })

    const delivery = await this.store.createDelivery({
      endpointId: endpoint.id,
      eventId: testEvent.id,
      status: 'pending',
      attempts: 0,
    })

    // Process immediately
    await this.processDelivery(delivery)

    return await this.store.getDelivery(delivery.id) || delivery
  }

  // Stop queue processor
  stop(): void {
    this.processing = false
  }

  // Utility function for sleep
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Webhook middleware for incoming webhooks
export function createWebhookMiddleware(secret: string, tolerance = 300) {
  return async function (req: NextRequest): Promise<{ valid: boolean; payload?: any; error?: string }> {
    try {
      const signature = req.headers.get('X-Webhook-Signature') || req.headers.get('X-Hub-Signature-256')
      const timestamp = req.headers.get('X-Webhook-Timestamp')

      if (!signature) {
        return { valid: false, error: 'Missing signature header' }
      }

      const payload = await req.text()

      // Verify timestamp if provided
      if (timestamp) {
        const now = Math.floor(Date.now() / 1000)
        const requestTime = parseInt(timestamp, 10)

        if (Math.abs(now - requestTime) > tolerance) {
          return { valid: false, error: 'Request timestamp too old' }
        }
      }

      // Verify signature
      const manager = new WebhookManager()
      const isValid = manager.verifySignature(payload, signature, secret, timestamp)

      if (!isValid) {
        return { valid: false, error: 'Invalid signature' }
      }

      return {
        valid: true,
        payload: JSON.parse(payload),
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// Webhook event types
export const WebhookEventTypes = {
  // Ticket events
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_CLOSED: 'ticket.closed',
  TICKET_REOPENED: 'ticket.reopened',

  // Comment events
  COMMENT_CREATED: 'comment.created',
  COMMENT_UPDATED: 'comment.updated',
  COMMENT_DELETED: 'comment.deleted',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  // SLA events
  SLA_WARNING: 'sla.warning',
  SLA_BREACH: 'sla.breach',

  // System events
  SYSTEM_MAINTENANCE: 'system.maintenance',
  SYSTEM_ERROR: 'system.error',

  // Custom events
  CUSTOM: 'custom',
} as const

export type WebhookEventType = typeof WebhookEventTypes[keyof typeof WebhookEventTypes]

// Default webhook manager instance
export const webhookManager = new WebhookManager()

export default {
  WebhookManager,
  webhookManager,
  createWebhookMiddleware,
  WebhookEventTypes,
}