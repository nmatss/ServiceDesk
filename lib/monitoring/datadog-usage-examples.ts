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
import { traceQuery, TracedDatabase, createTracedDatabase } from './datadog-database'
import db from '@/lib/db/connection'

// ============================================================================
// EXAMPLE 1: Tracing API Routes
// ============================================================================

/**
 * Example: Trace a ticket creation API route
 */
export async function exampleCreateTicketAPI(request: Request) {
  return traceApiRoute(
    'tickets.create',
    async () => {
      const body = await request.json()

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
export async function exampleDatabaseQuery() {
  // Method 1: Manual tracing
  const users = await traceQuery(
    'SELECT * FROM users WHERE role = ?',
    () => {
      return db.prepare('SELECT * FROM users WHERE role = ?').all('admin')
    },
    'SELECT'
  )

  return users
}

/**
 * Example: Use TracedDatabase wrapper (recommended)
 */
export function exampleTracedDatabase() {
  // Create a traced database instance
  const tracedDb = createTracedDatabase(db)

  // All queries are now automatically traced
  const user = tracedDb.prepare('SELECT * FROM users WHERE id = ?').get(1)

  const tickets = tracedDb.prepare('SELECT * FROM tickets WHERE status = ?').all('open')

  const result = tracedDb.prepare('INSERT INTO tickets (...) VALUES (...)').run(/* params */)

  return { user, tickets, result }
}

/**
 * Example: Trace transactions
 */
export function exampleDatabaseTransaction() {
  const tracedDb = createTracedDatabase(db)

  const insertTicketWithComment = tracedDb.transaction((ticketData, commentData) => {
    const ticketResult = tracedDb
      .prepare('INSERT INTO tickets (...) VALUES (...)')
      .run(/* ticket params */)

    const commentResult = tracedDb
      .prepare('INSERT INTO comments (...) VALUES (...)')
      .run(/* comment params */)

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
export async function exampleCustomOperation() {
  return traceOperation(
    'ticket.sla.check',
    async () => {
      const startTime = Date.now()

      // Check SLA for all open tickets
      const openTickets = db.prepare('SELECT * FROM tickets WHERE status = ?').all('open')

      for (const ticket of openTickets) {
        const slaPolicy = db.prepare('SELECT * FROM sla_policies WHERE id = ?').get(ticket.slaId)

        if (isSLABreached(ticket, slaPolicy)) {
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
export async function exampleAuthMetrics(email: string, password: string) {
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
export async function exampleTicketMetrics(ticketData: any) {
  const createdAt = new Date()

  // Create ticket
  const ticket = await createTicket(ticketData)
  ticketMetrics.created(ticket.priority, ticket.category, ticket.organizationId)

  // Assign ticket
  await assignTicket(ticket.id, ticketData.agentId)
  ticketMetrics.assigned(ticket.priority, ticketData.agentId)

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
export async function exampleKnowledgeBaseMetrics(query: string, userId?: number) {
  const results = await searchKnowledgeBase(query)

  // Record search
  knowledgeBaseMetrics.search(query, results.length)

  if (results.length > 0 && userId) {
    // Record article view
    knowledgeBaseMetrics.articleViewed(results[0].id, userId)

    // Record helpful vote
    knowledgeBaseMetrics.articleHelpful(results[0].id, true)
  }

  return results
}

/**
 * Example: Track system health metrics
 */
export async function exampleSystemMetrics() {
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
export async function exampleAPITracking(request: Request) {
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
export async function exampleRateLimiting(request: Request, userId?: number) {
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
export function exampleDatabasePoolMonitoring() {
  // These would come from your actual connection pool
  const activeConnections = 5
  const idleConnections = 3
  const totalConnections = 8

  databaseMetrics.connectionPoolUsage(activeConnections, idleConnections, totalConnections)
}

// ============================================================================
// Helper Functions (Stubs for Examples)
// ============================================================================

async function createTicket(data: any) {
  return { id: 1, ...data, createdAt: new Date() }
}

async function assignTicket(ticketId: number, agentId: number) {
  return { success: true }
}

async function updateTicket(ticketId: number, updates: any) {
  return { success: true }
}

async function resolveTicket(ticketId: number) {
  return { success: true }
}

async function authenticateUser(email: string, password: string) {
  return {
    id: 1,
    email,
    organizationId: 1,
    twoFactorEnabled: false,
  }
}

async function searchKnowledgeBase(query: string) {
  return [{ id: 1, title: 'Sample Article', content: '...' }]
}

async function getFromCache(key: string) {
  return null
}

async function setCache(key: string, value: any) {
  return true
}

async function fetchFromDatabase() {
  return { data: 'sample' }
}

async function processBackgroundJob() {
  return true
}

async function handleRequest(request: Request) {
  return new Response('OK', { status: 200 })
}

async function checkRateLimit(userId?: number) {
  return false
}

function isSLABreached(ticket: any, slaPolicy: any) {
  return false
}
