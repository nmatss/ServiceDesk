# Datadog APM Integration Guide

Complete guide for Datadog Application Performance Monitoring (APM) integration with the ServiceDesk Next.js application.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage Examples](#usage-examples)
5. [Dashboards](#recommended-dashboards)
6. [Alerts](#recommended-alerts)
7. [Best Practices](#best-practices)

---

## Overview

This integration provides:

- **Distributed Tracing**: End-to-end request tracking across services
- **Database Query Tracing**: Automatic SQLite query instrumentation
- **Custom Metrics**: Business-specific performance metrics
- **Real User Monitoring (RUM)**: Frontend performance tracking
- **Profiling**: CPU and memory profiling

### Components

- `lib/monitoring/datadog-config.ts` - Core APM initialization
- `lib/monitoring/datadog-middleware.ts` - Request tracing and spans
- `lib/monitoring/datadog-database.ts` - SQLite query tracing
- `lib/monitoring/datadog-metrics.ts` - Custom business metrics
- `lib/monitoring/datadog-usage-examples.ts` - Implementation examples

---

## Installation

### 1. Package Installation

The `dd-trace` package is already included in `package.json`:

```json
{
  "dependencies": {
    "dd-trace": "^5.69.0"
  }
}
```

### 2. Datadog Agent Setup

**Option A: Docker (Recommended for Development)**

```bash
docker run -d \
  --name dd-agent \
  -e DD_API_KEY=<YOUR_API_KEY> \
  -e DD_SITE="datadoghq.com" \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 \
  -p 8125:8125/udp \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  datadog/agent:latest
```

**Option B: Serverless (AWS Lambda, Vercel, etc.)**

Use the Datadog Serverless integration - no agent required. Set environment variables directly.

**Option C: Kubernetes**

Deploy using the Datadog Operator or DaemonSet.

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# ============================================
# DATADOG APM & MONITORING
# ============================================

# Datadog Agent Configuration
DD_AGENT_HOST=localhost              # Agent hostname (use 'dd-agent' for Docker)
DD_TRACE_AGENT_PORT=8126            # APM port
DD_DOGSTATSD_PORT=8125              # StatsD port

# Service Configuration
DD_SERVICE=servicedesk              # Service name in Datadog
DD_ENV=development                  # Environment (development, staging, production)
DD_VERSION=1.0.0                    # Application version

# Datadog API Configuration
DD_API_KEY=your_api_key_here        # Get from https://app.datadoghq.com/organization-settings/api-keys
DD_SITE=datadoghq.com               # Datadog site (datadoghq.com, datadoghq.eu, etc.)

# APM / Distributed Tracing
DD_TRACE_ENABLED=true               # Enable APM tracing
DD_TRACE_DEBUG=false                # Enable debug logging
DD_TRACE_SAMPLE_RATE=1.0            # Sample rate (1.0 = 100%, 0.1 = 10%)
DD_TRACE_ANALYTICS_ENABLED=true     # Enable trace analytics

# Logs Integration
DD_LOGS_ENABLED=false               # Enable log collection
DD_LOGS_INJECTION=true              # Inject trace IDs into logs

# Profiling (CPU & Memory)
DD_PROFILING_ENABLED=false          # Enable continuous profiler

# Real User Monitoring (RUM)
NEXT_PUBLIC_DD_RUM_ENABLED=false    # Enable frontend RUM
NEXT_PUBLIC_DD_RUM_APPLICATION_ID=  # RUM application ID
NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN=    # RUM client token
NEXT_PUBLIC_DD_RUM_SAMPLE_RATE=100  # RUM sample rate (0-100)

# Custom Metrics
DD_CUSTOM_METRICS_ENABLED=true      # Enable custom business metrics
```

### Initialization

The Datadog tracer is automatically initialized in `instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Datadog APM
    const { initializeDatadogAPM } = await import('@/lib/monitoring/datadog-config')
    initializeDatadogAPM()

    // ... other initialization
  }
}
```

---

## Usage Examples

### 1. Tracing API Routes

```typescript
import { traceApiRoute, addSpanTags } from '@/lib/monitoring/datadog-middleware'
import { ticketMetrics } from '@/lib/monitoring/datadog-metrics'

export async function POST(request: Request) {
  return traceApiRoute(
    'tickets.create', // Operation name
    async () => {
      const body = await request.json()

      // Add custom tags
      addSpanTags({
        'ticket.priority': body.priority,
        'ticket.category': body.category,
      })

      // Business logic
      const ticket = await createTicket(body)

      // Record custom metric
      ticketMetrics.created(body.priority, body.category, body.organizationId)

      return Response.json({ success: true, ticket })
    },
    {
      // Additional tags
      'api.version': 'v1',
      'api.endpoint': '/api/tickets',
    }
  )
}
```

### 2. Tracing Database Queries

**Method A: Automatic Tracing with TracedDatabase**

```typescript
import { createTracedDatabase } from '@/lib/monitoring/datadog-database'
import db from '@/lib/db/connection'

// Create traced database instance
const tracedDb = createTracedDatabase(db)

// All queries are automatically traced
const user = tracedDb.prepare('SELECT * FROM users WHERE id = ?').get(userId)

const tickets = tracedDb.prepare('SELECT * FROM tickets WHERE status = ?').all('open')
```

**Method B: Manual Query Tracing**

```typescript
import { traceQuery } from '@/lib/monitoring/datadog-database'
import db from '@/lib/db/connection'

const users = await traceQuery(
  'SELECT * FROM users WHERE role = ?',
  () => {
    return db.prepare('SELECT * FROM users WHERE role = ?').all('admin')
  },
  'SELECT' // Query type
)
```

**Method C: Transaction Tracing**

```typescript
import { createTracedDatabase } from '@/lib/monitoring/datadog-database'

const tracedDb = createTracedDatabase(db)

const insertTicketWithComment = tracedDb.transaction((ticketData, commentData) => {
  const ticket = tracedDb
    .prepare('INSERT INTO tickets (...) VALUES (...)')
    .run(ticketData)

  const comment = tracedDb
    .prepare('INSERT INTO comments (...) VALUES (...)')
    .run(commentData)

  return { ticketId: ticket.lastInsertRowid, commentId: comment.lastInsertRowid }
})

// Execute transaction (automatically traced)
const result = insertTicketWithComment(ticketData, commentData)
```

### 3. Custom Business Metrics

```typescript
import {
  ticketMetrics,
  authMetrics,
  apiMetrics,
  knowledgeBaseMetrics,
} from '@/lib/monitoring/datadog-metrics'

// Track ticket events
ticketMetrics.created('high', 'technical', 1)
ticketMetrics.assigned('high', 42)
ticketMetrics.resolved('high', 'technical', 1, 3600000)
ticketMetrics.slaBreached('critical', 1)

// Track authentication
authMetrics.loginSuccess(userId, organizationId, 'password')
authMetrics.loginFailed(email, 'invalid_credentials')
authMetrics.twoFactorUsed(userId, 'totp')

// Track API performance
apiMetrics.request('POST', '/api/tickets', 201, 150)
apiMetrics.error('POST', '/api/tickets', 'ValidationError')
apiMetrics.rateLimitHit('/api/search', userId)

// Track knowledge base
knowledgeBaseMetrics.search('how to reset password', 5)
knowledgeBaseMetrics.articleViewed(123, userId)
knowledgeBaseMetrics.articleHelpful(123, true)
```

### 4. Custom Operations

```typescript
import { traceOperation, addSpanTags } from '@/lib/monitoring/datadog-middleware'

export async function checkSLACompliance() {
  return traceOperation(
    'sla.compliance_check',
    async () => {
      const openTickets = await getOpenTickets()

      for (const ticket of openTickets) {
        const slaStatus = await checkTicketSLA(ticket)
        if (slaStatus.breached) {
          await sendSLAAlert(ticket)
        }
      }

      // Add metadata
      addSpanTags({
        'tickets.checked': openTickets.length,
        'tickets.breached': breachedCount,
      })

      return { checked: openTickets.length, breached: breachedCount }
    },
    {
      'operation.type': 'background_job',
      'job.schedule': 'every_5_minutes',
    }
  )
}
```

### 5. Middleware Integration

Update `middleware.ts` to include Datadog tracing:

```typescript
import { withDatadogTrace } from '@/lib/monitoring/datadog-middleware'
import { NextRequest, NextResponse } from 'next/server'

async function middlewareHandler(request: NextRequest) {
  // Your existing middleware logic
  return NextResponse.next()
}

// Wrap middleware with Datadog tracing
export const middleware = withDatadogTrace(middlewareHandler)
```

---

## Recommended Dashboards

### 1. Application Overview Dashboard

**Widgets:**
- Request Rate (requests/sec)
- Error Rate (%)
- P50, P95, P99 Latency
- Top Endpoints by Request Count
- Top Endpoints by Latency
- Error Count by Endpoint

**Query Examples:**
```
avg:trace.http.request.duration{service:servicedesk,env:production} by {resource_name}
sum:trace.http.request.hits{service:servicedesk,env:production} by {resource_name}
sum:trace.http.request.errors{service:servicedesk,env:production} by {resource_name}
```

### 2. Database Performance Dashboard

**Widgets:**
- Query Rate (queries/sec)
- Query Duration (P50, P95, P99)
- Slow Queries (>100ms)
- Query Types Distribution (SELECT, INSERT, UPDATE, DELETE)
- Connection Pool Usage

**Query Examples:**
```
avg:trace.sqlite.query.duration{service:servicedesk} by {db.type}
sum:trace.sqlite.query.hits{service:servicedesk} by {db.type}
p95:trace.sqlite.query.duration{service:servicedesk}
```

### 3. Business Metrics Dashboard

**Widgets:**
- Tickets Created (per hour/day)
- Tickets Resolved (per hour/day)
- Average Resolution Time
- SLA Breach Rate
- Login Success/Failure Rate
- Knowledge Base Search Count

**Query Examples:**
```
sum:custom.metric.ticket.created{service:servicedesk} by {priority}
sum:custom.metric.ticket.resolved{service:servicedesk} by {priority}
avg:custom.metric.ticket.resolution_time_ms{service:servicedesk}
sum:custom.metric.ticket.sla_breached{service:servicedesk}
sum:custom.metric.auth.login.success{service:servicedesk}
sum:custom.metric.auth.login.failed{service:servicedesk} by {reason}
```

### 4. User Experience Dashboard

**Widgets:**
- Page Load Time (RUM)
- First Contentful Paint (FCP)
- Time to Interactive (TTI)
- Core Web Vitals (LCP, FID, CLS)
- Error Count by Page
- User Sessions

**Query Examples (RUM):**
```
avg:rum.loading_time{service:servicedesk} by {view.name}
avg:rum.first_contentful_paint{service:servicedesk}
avg:rum.time_to_interactive{service:servicedesk}
sum:rum.error.count{service:servicedesk} by {view.name}
```

### 5. Infrastructure Dashboard

**Widgets:**
- CPU Usage
- Memory Usage
- Heap Size
- Event Loop Lag
- GC Pause Time
- Process Uptime

**Query Examples:**
```
avg:runtime.node.cpu.user{service:servicedesk}
avg:runtime.node.mem.heap_used{service:servicedesk}
avg:runtime.node.heap.size{service:servicedesk}
avg:runtime.node.event_loop.lag.max{service:servicedesk}
```

---

## Recommended Alerts

### 1. High Error Rate

**Condition:**
```
avg(last_5m):sum:trace.http.request.errors{service:servicedesk,env:production} / sum:trace.http.request.hits{service:servicedesk,env:production} > 0.05
```

**Alert:**
- Warning: > 3%
- Critical: > 5%

**Message:**
"High error rate detected: {{value}}% of requests are failing."

### 2. Slow API Endpoints

**Condition:**
```
avg(last_10m):p95:trace.http.request.duration{service:servicedesk,env:production} by {resource_name} > 1000
```

**Alert:**
- Warning: P95 > 500ms
- Critical: P95 > 1000ms

**Message:**
"Slow endpoint detected: {{resource_name.name}} P95 latency is {{value}}ms"

### 3. Database Connection Pool Exhaustion

**Condition:**
```
avg(last_5m):custom.metric.db.pool.active{service:servicedesk} / custom.metric.db.pool.total{service:servicedesk} > 0.9
```

**Alert:**
- Warning: > 80%
- Critical: > 90%

**Message:**
"Database connection pool nearing exhaustion: {{value}}% utilization"

### 4. SLA Breach Rate

**Condition:**
```
sum(last_1h):custom.metric.ticket.sla_breached{service:servicedesk,priority:critical} > 5
```

**Alert:**
- Warning: > 3 breaches/hour
- Critical: > 5 breaches/hour

**Message:**
"High SLA breach rate for {{priority}} tickets: {{value}} breaches in the last hour"

### 5. Authentication Failures

**Condition:**
```
sum(last_15m):custom.metric.auth.login.failed{service:servicedesk} > 50
```

**Alert:**
- Warning: > 30 failures/15min
- Critical: > 50 failures/15min

**Message:**
"Unusual authentication failure rate: {{value}} failed logins in 15 minutes. Possible brute force attack."

---

## Best Practices

### 1. Sampling Strategy

**Development:**
```bash
DD_TRACE_SAMPLE_RATE=1.0  # Trace everything
```

**Production:**
```bash
DD_TRACE_SAMPLE_RATE=0.1  # Sample 10% of requests
```

**High-Value Endpoints:**
```typescript
// Force 100% sampling for critical endpoints
tracer.startSpan('critical.endpoint', {
  tags: {
    'sampling.priority': 1  // 1 = keep, -1 = drop
  }
})
```

### 2. Tag Naming Conventions

Use consistent tag naming:
- `service:servicedesk` - Service name
- `env:production` - Environment
- `version:1.0.0` - Version
- `user.id:123` - User-related tags
- `ticket.priority:high` - Resource attributes
- `operation.type:background_job` - Operation types

### 3. Span Resource Names

Keep resource names concise but descriptive:

✅ Good:
- `GET /api/tickets/{id}`
- `POST /api/tickets/create`
- `sqlite.query.SELECT.users`

❌ Bad:
- `GET /api/tickets/12345` (includes ID)
- `SELECT * FROM users WHERE email = 'user@example.com'` (includes PII)

### 4. Custom Metrics

Keep metric names consistent:
- Use dot notation: `custom.metric.ticket.created`
- Include units where applicable: `custom.metric.ticket.resolution_time_ms`
- Use tags for dimensions: `{priority:high,category:technical}`

### 5. Error Tracking

Always include error context:

```typescript
span.setTag('error', true)
span.setTag('error.type', error.name)
span.setTag('error.message', error.message)
span.setTag('error.stack', error.stack)
```

### 6. Performance Considerations

- Enable profiling only when needed (overhead: ~1-3%)
- Use appropriate sample rates in production
- Avoid tracing very frequent operations (>1000 req/sec) at 100%
- Use async spans for I/O operations

### 7. Security

**Never trace:**
- Passwords or authentication tokens
- Credit card numbers
- Personally Identifiable Information (PII)
- API keys or secrets

**Sanitize sensitive data:**
```typescript
span.setTag('user.email', sanitizeEmail(email))  // use****@example.com
span.setTag('request.headers', sanitizeHeaders(headers))
```

---

## Troubleshooting

### Agent Not Connected

**Symptoms:**
- No traces appearing in Datadog
- Console error: "Datadog Tracer - Agent not reachable"

**Solutions:**
1. Verify agent is running: `docker ps | grep dd-agent`
2. Check agent connectivity: `curl http://localhost:8126`
3. Verify `DD_AGENT_HOST` environment variable
4. Check firewall rules for port 8126

### High Memory Usage

**Symptoms:**
- Node.js process memory increasing over time
- Out of memory errors

**Solutions:**
1. Reduce sample rate: `DD_TRACE_SAMPLE_RATE=0.1`
2. Disable profiling: `DD_PROFILING_ENABLED=false`
3. Limit runtime metrics frequency
4. Check for span leaks (unclosed spans)

### Missing Custom Metrics

**Symptoms:**
- Custom metrics not appearing in Datadog

**Solutions:**
1. Verify `DD_CUSTOM_METRICS_ENABLED=true`
2. Ensure metrics are called within an active span
3. Check metric naming conventions
4. Verify agent StatsD port (8125)

---

## Additional Resources

- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [dd-trace-js GitHub](https://github.com/DataDog/dd-trace-js)
- [Datadog Next.js Integration](https://docs.datadoghq.com/tracing/setup_overview/setup/nodejs/)
- [Datadog RUM Documentation](https://docs.datadoghq.com/real_user_monitoring/)

---

## Support

For issues or questions:
1. Check [dd-trace GitHub Issues](https://github.com/DataDog/dd-trace-js/issues)
2. Contact Datadog Support
3. Review application logs for tracer errors
