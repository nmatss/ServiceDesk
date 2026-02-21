# Agent 3 - Datadog APM Quick Reference

**Date:** 2025-10-06
**Project:** ServiceDesk
**Working Directory:** `/home/nic20/ProjetosWeb/ServiceDesk`

---

## Installation Status

### ✅ Already in package.json
```json
{
  "dependencies": {
    "dd-trace": "^5.69.0"
  }
}
```

### ❌ Missing Packages (Need to Install)
```bash
# Browser RUM - REQUIRED for frontend monitoring
npm install --save @datadog/browser-rum

# Optional: OpenTelemetry packages (if keeping current architecture)
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/core
```

---

## Package Versions

| Package | Version | Status | Purpose |
|---------|---------|--------|---------|
| dd-trace | ^5.69.0 | ✅ In package.json | Server-side APM |
| @datadog/browser-rum | N/A | ❌ Not installed | Browser RUM |
| OpenTelemetry packages | N/A | ❌ Not installed | Alternative approach |

---

## Configuration Files

### 1. Environment Variables (.env.example)

**Location:** `/home/nic20/ProjetosWeb/ServiceDesk/.env.example`

**Status:** ✅ Already configured (lines 215-254)

**Key Variables:**
```bash
# Enable/Disable
DD_TRACE_ENABLED=false              # Set to 'true' to enable

# Agent Connection
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_DOGSTATSD_PORT=8125

# Service Info
DD_SERVICE=servicedesk
DD_ENV=development
DD_VERSION=1.0.0

# API Key (REQUIRED)
DD_API_KEY=                         # PLACEHOLDER - Add your key

# Sampling
DD_TRACE_SAMPLE_RATE=1.0            # 1.0 = 100%, 0.1 = 10%

# Browser RUM
NEXT_PUBLIC_DD_RUM_ENABLED=false
NEXT_PUBLIC_DD_RUM_APPLICATION_ID=  # PLACEHOLDER
NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN=    # PLACEHOLDER
```

### 2. Core Implementation Files

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `lib/monitoring/datadog-config.ts` | 284 | ⚠️ | APM initialization (uses OTel) |
| `lib/monitoring/datadog-tracer.ts` | 255 | ⚠️ | Custom tracer wrapper |
| `lib/monitoring/datadog-middleware.ts` | 144 | ⚠️ | Request tracing |
| `lib/monitoring/datadog-database.ts` | 173 | ⚠️ | Database query tracing |
| `lib/monitoring/datadog-metrics.ts` | 291 | ✅ | Custom metrics |
| `instrumentation.ts` | 79 | ✅ | Auto-initialization |

### 3. Domain Tracers

| File | Operations | Purpose |
|------|-----------|---------|
| `lib/monitoring/traces/auth-tracer.ts` | 8 | Login, register, JWT ops |
| `lib/monitoring/traces/ticket-tracer.ts` | 8 | Ticket CRUD operations |
| `lib/monitoring/traces/sla-tracer.ts` | 9 | SLA tracking & compliance |
| `lib/monitoring/traces/database-tracer.ts` | 11 | DB operations |
| `lib/monitoring/traces/index.ts` | Central | Export hub + helpers |

---

## Integration Points

### Server-Side (Backend)

**Automatic Initialization:**
- Location: `instrumentation.ts`
- Triggers: On app startup (dev & production)
- Condition: `DD_TRACE_ENABLED=true`

**Database Tracing:**
```typescript
import { createTracedDatabase } from '@/lib/monitoring/datadog-database'
import db from '@/lib/db/connection'

const tracedDb = createTracedDatabase(db)
const user = tracedDb.prepare('SELECT * FROM users WHERE id = ?').get(1)
```

**API Route Tracing:**
```typescript
import { traceApiRoute } from '@/lib/monitoring/datadog-middleware'

export async function POST(request: Request) {
  return traceApiRoute('tickets.create', async () => {
    // Your logic here
    return Response.json({ success: true })
  })
}
```

### Frontend (Browser RUM)

**Status:** ❌ NOT IMPLEMENTED

**Required:**
1. Install `@datadog/browser-rum`
2. Create RUM provider component
3. Add to root layout
4. Configure environment variables

---

## Usage Examples

### 1. Trace Authentication

```typescript
import { traceLogin } from '@/lib/monitoring/traces'

const user = await traceLogin(email, async () => {
  return await authenticateUser({ email, password })
})
```

### 2. Trace Ticket Creation

```typescript
import { traceCreateTicket } from '@/lib/monitoring/traces'

const ticket = await traceCreateTicket(userId, orgId, data, async () => {
  return await ticketQueries.create(data, orgId)
})
```

### 3. Track Custom Metrics

```typescript
import { ticketMetrics } from '@/lib/monitoring/datadog-metrics'

ticketMetrics.created('high', 'technical', organizationId)
ticketMetrics.resolved('high', 'technical', organizationId, 3600000)
ticketMetrics.slaBreached('critical', organizationId)
```

### 4. Database Transactions

```typescript
import { createTracedDatabase } from '@/lib/monitoring/datadog-database'

const tracedDb = createTracedDatabase(db)

const createTicket = tracedDb.transaction((data) => {
  const ticket = tracedDb.prepare('INSERT INTO tickets ...').run(data)
  const comment = tracedDb.prepare('INSERT INTO comments ...').run(commentData)
  return { ticketId: ticket.lastInsertRowid }
})
```

---

## Setup Steps

### Quick Start (Development)

```bash
# 1. Install dependencies
cd /home/nic20/ProjetosWeb/ServiceDesk
npm install

# 2. Install Browser RUM
npm install --save @datadog/browser-rum

# 3. Start Datadog Agent
docker run -d \
  --name dd-agent \
  -e DD_API_KEY=YOUR_KEY_HERE \
  -e DD_SITE="datadoghq.com" \
  -e DD_APM_ENABLED=true \
  -p 8126:8126 \
  -p 8125:8125/udp \
  datadog/agent:latest

# 4. Configure .env
cp .env.example .env
# Edit .env and set DD_TRACE_ENABLED=true

# 5. Start application
npm run dev

# 6. Verify
# Check console for: 📊 Datadog APM initialized
# Visit: https://app.datadoghq.com/apm/traces
```

### Production Setup

```bash
# 1. Set environment variables
export DD_TRACE_ENABLED=true
export DD_API_KEY=your_production_key
export DD_ENV=production
export DD_TRACE_SAMPLE_RATE=0.1  # Sample 10%

# 2. Configure agent (Kubernetes/Docker)
# Use Datadog Operator or DaemonSet

# 3. Build and deploy
npm run build
npm run start
```

---

## Current Issues

### Critical (Blocking)

1. **❌ Dependencies Not Installed**
   - Impact: Application won't build
   - Fix: Run `npm install`

2. **❌ Browser RUM Not Installed**
   - Impact: No frontend monitoring
   - Fix: `npm install @datadog/browser-rum`

3. **❌ Architecture Mismatch**
   - Issue: Code uses OpenTelemetry API but expects dd-trace
   - Impact: Some features won't work properly
   - Fix: Choose one approach and refactor

### Configuration

4. **⚠️ Missing API Keys**
   - Impact: Can't send data to Datadog
   - Fix: Get keys from Datadog dashboard

5. **⚠️ Agent Not Running**
   - Impact: Traces not collected
   - Fix: Start agent via Docker

### Code

6. **⚠️ Missing getTracer() Export**
   - Files expecting it: middleware, database, metrics
   - Impact: Import errors
   - Fix: Add export to datadog-config.ts

---

## Performance Impact

### Server-Side APM

| Component | Overhead | Notes |
|-----------|----------|-------|
| Tracing | 1-3% | With sample rate 1.0 |
| Custom Metrics | <1% | Minimal |
| Profiling | 1-3% | When enabled |
| **Total** | **2-6%** | Acceptable for most apps |

**Recommendations:**
- Development: 100% sampling
- Production: 10-30% sampling
- High-traffic: 5-10% sampling

### Browser RUM

| Component | Impact | Size |
|-----------|--------|------|
| RUM SDK | ~30KB | Gzipped |
| Performance | <5ms | Initialization |
| Network | Minimal | Batched requests |

---

## Traced Operations

### Authentication (8)
- `auth.login`
- `auth.register`
- `auth.verify_token`
- `auth.hash_password`
- `auth.verify_password`
- `auth.generate_token`
- `auth.sso`
- `auth.mfa_verification`

### Tickets (8)
- `ticket.create`
- `ticket.update`
- `ticket.get`
- `ticket.list`
- `ticket.assign`
- `ticket.resolve`
- `ticket.comment.add`
- `ticket.user_tickets`

### SLA (9)
- `sla.create_tracking`
- `sla.check_compliance`
- `sla.update_response`
- `sla.update_resolution`
- `sla.get_breaches`
- `sla.get_upcoming_breaches`
- `sla.calculate_metrics`
- `sla.escalation`
- `sla.trend_analysis`

### Database (11)
- `database.query`
- `database.transaction`
- `database.insert`
- `database.update`
- `database.delete`
- `database.select`
- `database.connect`
- `database.migration`
- `database.index`
- `database.vacuum`
- `database.backup`

**Total: 40 operations**

---

## Custom Metrics Available

### Ticket Metrics
```typescript
ticketMetrics.created(priority, category, orgId)
ticketMetrics.resolved(priority, category, orgId, resolutionTime)
ticketMetrics.updated(ticketId, updateType)
ticketMetrics.slaBreached(priority, orgId)
ticketMetrics.assigned(priority, agentId)
```

### Auth Metrics
```typescript
authMetrics.loginSuccess(userId, orgId, method)
authMetrics.loginFailed(email, reason)
authMetrics.registered(userId, orgId, role)
authMetrics.twoFactorUsed(userId, method)
```

### API Metrics
```typescript
apiMetrics.request(method, path, statusCode, duration)
apiMetrics.error(method, path, errorType)
apiMetrics.rateLimitHit(endpoint, userId)
```

### Knowledge Base Metrics
```typescript
knowledgeBaseMetrics.search(query, resultsCount)
knowledgeBaseMetrics.articleViewed(articleId, userId)
knowledgeBaseMetrics.articleHelpful(articleId, helpful)
```

### System Metrics
```typescript
systemMetrics.cache('hit' | 'miss', cacheType)
systemMetrics.backgroundJob(jobType, duration, status)
systemMetrics.websocketConnection('connected' | 'disconnected', userId)
```

---

## Documentation

### Created Files (6)

1. **DATADOG_IMPLEMENTATION_SUMMARY.txt** (343 lines)
   - Implementation overview
   - Statistics and metrics

2. **DATADOG_INTEGRATION.md** (630 lines)
   - Complete integration guide
   - Dashboards and alerts

3. **DATADOG_QUICK_START.md** (93 lines)
   - 5-minute setup guide
   - Basic usage examples

4. **DATADOG_SETUP_SUMMARY.md** (400+ lines)
   - Detailed setup instructions
   - Configuration reference

5. **DATADOG_TRACING_GUIDE.md** (600+ lines)
   - Comprehensive usage guide
   - Best practices

6. **AGENT3_DATADOG_APM_SUMMARY.md** (NEW)
   - Complete status report
   - Issues and next steps

### Example Code

**Location:** `lib/monitoring/datadog-usage-examples.ts`
- 390 lines of practical examples
- Covers all major use cases

---

## Next Steps

### Immediate (Today)

1. ✅ Review current implementation
2. ✅ Create summary documentation
3. ⏳ Run `npm install`
4. ⏳ Install Browser RUM package
5. ⏳ Fix architecture issues

### Short-term (This Week)

1. ⏳ Start Datadog agent locally
2. ⏳ Get API keys from Datadog
3. ⏳ Configure .env properly
4. ⏳ Test server-side tracing
5. ⏳ Implement Browser RUM

### Long-term (Next Sprint)

1. ⏳ Create production dashboards
2. ⏳ Set up critical alerts
3. ⏳ Optimize sampling rates
4. ⏳ Enable profiling
5. ⏳ Train team on usage

---

## Resources

### Datadog Links

- Dashboard: https://app.datadoghq.com
- APM Traces: https://app.datadoghq.com/apm/traces
- Create RUM App: https://app.datadoghq.com/rum/application/create
- API Keys: https://app.datadoghq.com/organization-settings/api-keys

### Documentation

- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Browser RUM](https://docs.datadoghq.com/real_user_monitoring/)
- [dd-trace-js](https://github.com/DataDog/dd-trace-js)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)

### Internal Docs

- Setup Guide: `DATADOG_SETUP_SUMMARY.md`
- Integration: `DATADOG_INTEGRATION.md`
- Usage Guide: `DATADOG_TRACING_GUIDE.md`
- Quick Start: `DATADOG_QUICK_START.md`

---

## Support

**For Issues:**
1. Check implementation docs
2. Review Datadog documentation
3. Check GitHub issues: https://github.com/DataDog/dd-trace-js/issues
4. Contact Datadog support

**Internal Team:**
- Implementation: See `AGENT3_DATADOG_APM_SUMMARY.md`
- Questions: Review existing documentation first

---

## Summary

**Status:** ⚠️ Partially Implemented - Requires Action

**What Works:**
- Comprehensive code framework (40 traced operations)
- Excellent documentation (2,000+ lines)
- Environment configuration ready
- Auto-initialization setup

**What's Needed:**
- Install dependencies (`npm install`)
- Install Browser RUM package
- Fix architecture inconsistencies
- Obtain Datadog API keys
- Start Datadog agent

**Estimated Time to Complete:** 1 day of focused work

---

**Last Updated:** 2025-10-06
**Prepared By:** Agent 3 - Datadog APM Implementation
