/**
 * Datadog Custom Metrics
 * Provides functions to send custom business metrics to Datadog
 */

import { getTracer } from './datadog-config'

/**
 * Record a custom metric
 */
export function recordCustomMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
) {
  if (process.env.DD_CUSTOM_METRICS_ENABLED !== 'true') {
    return
  }

  const tracer = getTracer()
  const span = tracer.scope().active()

  if (span) {
    span.setTag(`custom.metric.${name}`, value)

    if (tags) {
      Object.entries(tags).forEach(([key, val]) => {
        span.setTag(`custom.metric.${name}.tag.${key}`, val)
      })
    }
  }
}

/**
 * Track ticket metrics
 */
export const ticketMetrics = {
  /**
   * Record ticket creation
   */
  created: (priority: string, category: string, organizationId: number) => {
    recordCustomMetric('ticket.created', 1, {
      priority,
      category,
      organization_id: organizationId.toString(),
    })
  },

  /**
   * Record ticket resolution
   */
  resolved: (
    priority: string,
    category: string,
    organizationId: number,
    resolutionTimeMs: number
  ) => {
    recordCustomMetric('ticket.resolved', 1, {
      priority,
      category,
      organization_id: organizationId.toString(),
    })
    recordCustomMetric('ticket.resolution_time_ms', resolutionTimeMs, {
      priority,
      category,
      organization_id: organizationId.toString(),
    })
  },

  /**
   * Record ticket update
   */
  updated: (ticketId: number, updateType: string) => {
    recordCustomMetric('ticket.updated', 1, {
      ticket_id: ticketId.toString(),
      update_type: updateType,
    })
  },

  /**
   * Record SLA breach
   */
  slaBreached: (priority: string, organizationId: number) => {
    recordCustomMetric('ticket.sla_breached', 1, {
      priority,
      organization_id: organizationId.toString(),
    })
  },

  /**
   * Record ticket assignment
   */
  assigned: (priority: string, agentId: number) => {
    recordCustomMetric('ticket.assigned', 1, {
      priority,
      agent_id: agentId.toString(),
    })
  },
}

/**
 * Track user authentication metrics
 */
export const authMetrics = {
  /**
   * Record successful login
   */
  loginSuccess: (userId: number, organizationId: number, method: string) => {
    recordCustomMetric('auth.login.success', 1, {
      user_id: userId.toString(),
      organization_id: organizationId.toString(),
      method,
    })
  },

  /**
   * Record failed login
   */
  loginFailed: (email: string, reason: string) => {
    recordCustomMetric('auth.login.failed', 1, {
      reason,
    })
  },

  /**
   * Record user registration
   */
  registered: (userId: number, organizationId: number, role: string) => {
    recordCustomMetric('auth.user.registered', 1, {
      user_id: userId.toString(),
      organization_id: organizationId.toString(),
      role,
    })
  },

  /**
   * Record 2FA usage
   */
  twoFactorUsed: (userId: number, method: string) => {
    recordCustomMetric('auth.2fa.used', 1, {
      user_id: userId.toString(),
      method,
    })
  },
}

/**
 * Track database performance metrics
 */
export const databaseMetrics = {
  /**
   * Record query execution time
   */
  queryExecutionTime: (queryType: string, durationMs: number) => {
    recordCustomMetric('db.query.duration_ms', durationMs, {
      query_type: queryType,
    })
  },

  /**
   * Record connection pool usage
   */
  connectionPoolUsage: (active: number, idle: number, total: number) => {
    recordCustomMetric('db.pool.active', active)
    recordCustomMetric('db.pool.idle', idle)
    recordCustomMetric('db.pool.total', total)
  },

  /**
   * Record transaction count
   */
  transaction: (status: 'committed' | 'rolled_back') => {
    recordCustomMetric('db.transaction', 1, { status })
  },
}

/**
 * Track API performance metrics
 */
export const apiMetrics = {
  /**
   * Record API request
   */
  request: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ) => {
    recordCustomMetric('api.request', 1, {
      method,
      path,
      status_code: statusCode.toString(),
    })
    recordCustomMetric('api.request.duration_ms', durationMs, {
      method,
      path,
    })
  },

  /**
   * Record API error
   */
  error: (method: string, path: string, errorType: string) => {
    recordCustomMetric('api.error', 1, {
      method,
      path,
      error_type: errorType,
    })
  },

  /**
   * Record rate limit hit
   */
  rateLimitHit: (endpoint: string, userId?: number) => {
    recordCustomMetric('api.rate_limit.hit', 1, {
      endpoint,
      user_id: userId?.toString() || 'anonymous',
    })
  },
}

/**
 * Track knowledge base metrics
 */
export const knowledgeBaseMetrics = {
  /**
   * Record article search
   */
  search: (query: string, resultsCount: number) => {
    recordCustomMetric('kb.search', 1, {
      results_count: resultsCount.toString(),
    })
  },

  /**
   * Record article view
   */
  articleViewed: (articleId: number, userId?: number) => {
    recordCustomMetric('kb.article.viewed', 1, {
      article_id: articleId.toString(),
      user_id: userId?.toString() || 'anonymous',
    })
  },

  /**
   * Record article helpful vote
   */
  articleHelpful: (articleId: number, helpful: boolean) => {
    recordCustomMetric('kb.article.helpful', helpful ? 1 : 0, {
      article_id: articleId.toString(),
    })
  },
}

/**
 * Track system health metrics
 */
export const systemMetrics = {
  /**
   * Record cache hit/miss
   */
  cache: (operation: 'hit' | 'miss', cacheType: string) => {
    recordCustomMetric(`cache.${operation}`, 1, {
      cache_type: cacheType,
    })
  },

  /**
   * Record background job execution
   */
  backgroundJob: (jobType: string, durationMs: number, status: 'success' | 'failed') => {
    recordCustomMetric('job.execution', 1, {
      job_type: jobType,
      status,
    })
    recordCustomMetric('job.duration_ms', durationMs, {
      job_type: jobType,
    })
  },

  /**
   * Record WebSocket connections
   */
  websocketConnection: (action: 'connected' | 'disconnected', userId: number) => {
    recordCustomMetric('websocket.connection', action === 'connected' ? 1 : -1, {
      user_id: userId.toString(),
    })
  },
}
