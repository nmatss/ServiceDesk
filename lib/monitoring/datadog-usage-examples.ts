/**
 * Datadog APM Usage Examples
 * Demonstrates how to use Datadog APM throughout the application
 */

import { traceOperation, traceApiRoute, addSpanTags } from './datadog-middleware'
import {
  ticketMetrics,
  authMetrics,
  databaseMetrics,
  apiMetrics,
  knowledgeBaseMetrics,
  systemMetrics,
} from './datadog-metrics'
import { traceQuery, createTracedDatabase } from './datadog-database'
import db from '../db/connection'
import type Database from 'better-sqlite3'

// ============================================================================
// Type Definitions
// ============================================================================

interface TicketData {
  priority: string
  category: string
  organizationId: number
  userId: number
  title?: string
  description?: string
  agentId?: number
  status?: string
}

interface Ticket extends TicketData {
  id: number
  createdAt: Date
  slaId?: number
}

interface SLAPolicy {
  id: number
  name: string
  responseTimeHours: number
  resolutionTimeHours: number
}

interface User {
  id: number
  email: string
  organizationId: number
  twoFactorEnabled: boolean
}

interface KnowledgeArticle {
  id: number
  title: string
  content: string
}

interface DatabaseRow {
  [key: string]: unknown
}

// ============================================================================
// EXAMPLE 1: Tracing API Routes
// ============================================================================

/**
 * Example: Trace a ticket creation API route
 */
export async function exampleCreateTicketAPI(request: Request): Promise<Response> {
  return traceApiRoute(
    'tickets.create',
    async () => {
      const body = await request.json() as TicketData

      // Add custom tags to the current span
      addSpanTags({
        'ticket.priority': body.priority,
        'ticket.category': body.category,
        'user.id': body.userId,
      })

      // Create ticket
      const ticket = await createTicket(body)

      // Record custom metrics
      ticketMetrics.created(body.priority, body.category, body.organizationId)

      return Response.json({ success: true, ticket })
    },
    {
      'api.endpoint': '/api/tickets/create',
      'api.version': 'v1',
    }
  )
}

// ============================================================================
// EXAMPLE 2: Tracing Database Operations
// ============================================================================

/**
 * Example: Trace individual database queries
 */
export async function exampleDatabaseQuery(): Promise<DatabaseRow[]> {
  // Method 1: Manual tracing
  const users = await traceQuery<DatabaseRow[]>(
    'SELECT * FROM users WHERE role = ?',
    () => {
      const result = db.prepare('SELECT * FROM users WHERE role = ?').all('admin')
      return result as DatabaseRow[]
    },
    'SELECT'
  )

  return users
}

/**
 * Example: Use TracedDatabase wrapper (recommended)
 */
export function exampleTracedDatabase(): { user: DatabaseRow | undefined; tickets: DatabaseRow[]; result: Database.RunResult } {
  // Create a traced database instance
  const tracedDb = createTracedDatabase(db)

  // All queries are now automatically traced
  const user = tracedDb.prepare('SELECT * FROM users WHERE id = ?').get(1) as DatabaseRow | undefined

  const tickets = tracedDb.prepare('SELECT * FROM tickets WHERE status = ?').all('open') as DatabaseRow[]

  const result = tracedDb.prepare('INSERT INTO tickets (title, description) VALUES (?, ?)').run('Example', 'Description') as Database.RunResult

  return { user, tickets, result }
}

/**
 * Example: Trace transactions
 */
export function exampleDatabaseTransaction(): { ticketId: number | bigint; commentId: number | bigint } {
  const tracedDb = createTracedDatabase(db)

  interface TicketTransactionData {
    title: string
    description: string
  }

  interface CommentTransactionData {
    content: string
  }

  const insertTicketWithComment = tracedDb.transaction((ticketData: TicketTransactionData, commentData: CommentTransactionData) => {
    const ticketResult = tracedDb
      .prepare('INSERT INTO tickets (title, description) VALUES (?, ?)')
      .run(ticketData.title, ticketData.description) as Database.RunResult

    const commentResult = tracedDb
      .prepare('INSERT INTO comments (content, ticket_id) VALUES (?, ?)')
      .run(commentData.content, ticketResult.lastInsertRowid) as Database.RunResult

    return { ticketId: ticketResult.lastInsertRowid, commentId: commentResult.lastInsertRowid }
  })

  // Execute the transaction (automatically traced)
  const result = insertTicketWithComment(
    { title: 'Test', description: 'Test' },
    { content: 'First comment' }
  )

  return result
}

// ============================================================================
// EXAMPLE 3: Tracing Custom Operations
// ============================================================================

/**
 * Example: Trace a custom business operation
 */
export async function exampleCustomOperation(): Promise<{ checked: number; duration: number }> {
  return traceOperation(
    'ticket.sla.check',
    async () => {
      const startTime = Date.now()

      // Check SLA for all open tickets
      const openTickets = db.prepare('SELECT * FROM tickets WHERE status = ?').all('open') as Ticket[]

      for (const ticket of openTickets) {
        const slaPolicy = db.prepare('SELECT * FROM sla_policies WHERE id = ?').get(ticket.slaId) as SLAPolicy | undefined

        if (slaPolicy && isSLABreached(ticket, slaPolicy)) {
          // Record SLA breach metric
          ticketMetrics.slaBreached(ticket.priority, ticket.organizationId)
        }
      }

      const duration = Date.now() - startTime

      // Add span tags
      addSpanTags({
        'tickets.checked': openTickets.length,
        'duration.ms': duration,
      })

      return { checked: openTickets.length, duration }
    },
    {
      'operation.type': 'background_job',
      'job.name': 'sla_monitor',
    }
  )
}

// ============================================================================
// EXAMPLE 4: Custom Metrics
// ============================================================================

/**
 * Example: Track authentication events
 */
export async function exampleAuthMetrics(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await authenticateUser(email, password)

    if (user) {
      // Record successful login
      authMetrics.loginSuccess(user.id, user.organizationId, 'password')

      if (user.twoFactorEnabled) {
        authMetrics.twoFactorUsed(user.id, 'totp')
      }

      return { success: true, user }
    } else {
      // Record failed login
      authMetrics.loginFailed(email, 'invalid_credentials')
      return { success: false, error: 'Invalid credentials' }
    }
  } catch (error) {
    authMetrics.loginFailed(email, 'system_error')
    throw error
  }
}

/**
 * Example: Track ticket lifecycle metrics
 */
export async function exampleTicketMetrics(ticketData: TicketData): Promise<void> {
  const createdAt = new Date()

  // Create ticket
  const ticket = await createTicket(ticketData)
  ticketMetrics.created(ticket.priority, ticket.category, ticket.organizationId)

  // Assign ticket
  if (ticketData.agentId) {
    await assignTicket(ticket.id, ticketData.agentId)
    ticketMetrics.assigned(ticket.priority, ticketData.agentId)
  }

  // Update ticket
  await updateTicket(ticket.id, { status: 'in_progress' })
  ticketMetrics.updated(ticket.id, 'status_change')

  // Resolve ticket
  await resolveTicket(ticket.id)
  const resolutionTime = Date.now() - createdAt.getTime()
  ticketMetrics.resolved(ticket.priority, ticket.category, ticket.organizationId, resolutionTime)
}

/**
 * Example: Track knowledge base usage
 */
export async function exampleKnowledgeBaseMetrics(query: string, userId?: number): Promise<KnowledgeArticle[]> {
  const results = await searchKnowledgeBase(query)

  // Record search
  knowledgeBaseMetrics.search(query, results.length)

  if (results.length > 0 && userId !== undefined) {
    const firstArticle = results[0]
    if (firstArticle) {
      // Record article view
      knowledgeBaseMetrics.articleViewed(firstArticle.id, userId)

      // Record helpful vote
      knowledgeBaseMetrics.articleHelpful(firstArticle.id, true)
    }
  }

  return results
}

/**
 * Example: Track system health metrics
 */
export async function exampleSystemMetrics(): Promise<void> {
  // Track cache usage
  const cacheKey = 'user:123'
  const cached = await getFromCache(cacheKey)

  if (cached) {
    systemMetrics.cache('hit', 'redis')
  } else {
    systemMetrics.cache('miss', 'redis')
    // Fetch from database and cache
    const data = await fetchFromDatabase()
    await setCache(cacheKey, data)
  }

  // Track background job
  const jobStartTime = Date.now()
  try {
    await processBackgroundJob()
    const jobDuration = Date.now() - jobStartTime
    systemMetrics.backgroundJob('email_notification', jobDuration, 'success')
  } catch (error) {
    const jobDuration = Date.now() - jobStartTime
    systemMetrics.backgroundJob('email_notification', jobDuration, 'failed')
  }

  // Track WebSocket connections
  systemMetrics.websocketConnection('connected', 123)
}

// ============================================================================
// EXAMPLE 5: API Performance Tracking
// ============================================================================

/**
 * Example: Track API performance in middleware
 */
export async function exampleAPITracking(request: Request): Promise<Response> {
  const startTime = Date.now()
  const method = request.method
  const url = new URL(request.url)
  const path = url.pathname

  try {
    const response = await handleRequest(request)
    const duration = Date.now() - startTime

    // Record API metrics
    apiMetrics.request(method, path, response.status, duration)

    return response
  } catch (error) {
    const duration = Date.now() - startTime
    const errorType = error instanceof Error ? error.name : 'UnknownError'

    // Record error
    apiMetrics.error(method, path, errorType)
    apiMetrics.request(method, path, 500, duration)

    throw error
  }
}

/**
 * Example: Track rate limiting
 */
export async function exampleRateLimiting(request: Request, userId?: number): Promise<Response> {
  const url = new URL(request.url)
  const isRateLimited = await checkRateLimit(userId)

  if (isRateLimited) {
    apiMetrics.rateLimitHit(url.pathname, userId)
    return new Response('Too Many Requests', { status: 429 })
  }

  return handleRequest(request)
}

// ============================================================================
// EXAMPLE 6: Database Connection Pool Monitoring
// ============================================================================

/**
 * Example: Track database pool usage
 */
export function exampleDatabasePoolMonitoring(): void {
  // These would come from your actual connection pool
  const activeConnections = 5
  const idleConnections = 3
  const totalConnections = 8

  databaseMetrics.connectionPoolUsage(activeConnections, idleConnections, totalConnections)
}

// ============================================================================
// Helper Functions (Stubs for Examples)
// ============================================================================

async function createTicket(data: TicketData): Promise<Ticket> {
  return { id: 1, ...data, createdAt: new Date() }
}

async function assignTicket(_ticketId: number, _agentId: number): Promise<{ success: boolean }> {
  return { success: true }
}

async function updateTicket(_ticketId: number, _updates: Partial<TicketData>): Promise<{ success: boolean }> {
  return { success: true }
}

async function resolveTicket(_ticketId: number): Promise<{ success: boolean }> {
  return { success: true }
}

async function authenticateUser(email: string, _password: string): Promise<User | null> {
  return {
    id: 1,
    email,
    organizationId: 1,
    twoFactorEnabled: false,
  }
}

async function searchKnowledgeBase(_query: string): Promise<KnowledgeArticle[]> {
  return [{ id: 1, title: 'Sample Article', content: '...' }]
}

async function getFromCache(_key: string): Promise<{ data: string } | null> {
  return null
}

async function setCache(_key: string, _value: unknown): Promise<boolean> {
  return true
}

async function fetchFromDatabase(): Promise<{ data: string }> {
  return { data: 'sample' }
}

async function processBackgroundJob(): Promise<boolean> {
  return true
}

async function handleRequest(_request: Request): Promise<Response> {
  return new Response('OK', { status: 200 })
}

async function checkRateLimit(_userId?: number): Promise<boolean> {
  return false
}

function isSLABreached(_ticket: Ticket, _slaPolicy: SLAPolicy): boolean {
  return false
}
