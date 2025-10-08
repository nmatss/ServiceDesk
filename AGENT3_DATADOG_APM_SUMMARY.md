# AGENT 3 - Datadog APM Implementation Summary

**Date:** 2025-10-06
**Status:** ⚠️ PARTIALLY IMPLEMENTED - REQUIRES CORRECTIONS
**Working Directory:** `/home/nic20/ProjetosWeb/ServiceDesk`

---

## Executive Summary

The ServiceDesk application has an **existing Datadog APM implementation** that was previously set up, but there are **critical issues** that need to be addressed:

### ✅ What's Already Implemented

1. **Package Dependencies**: `dd-trace@5.69.0` is listed in package.json
2. **Environment Variables**: Comprehensive Datadog config in `.env.example`
3. **Monitoring Infrastructure**:
   - `/lib/monitoring/datadog-config.ts` - APM initialization
   - `/lib/monitoring/datadog-tracer.ts` - Custom tracer wrapper
   - `/lib/monitoring/datadog-middleware.ts` - Request tracing
   - `/lib/monitoring/datadog-database.ts` - SQLite query tracing
   - `/lib/monitoring/datadog-metrics.ts` - Custom business metrics
4. **Domain-Specific Tracers**:
   - Auth tracing (8 operations)
   - Ticket tracing (8 operations)
   - SLA tracing (9 operations)
   - Database tracing (11 operations)
5. **Documentation**: 4 comprehensive docs (~2,000+ lines)
6. **Auto-initialization**: Integration in `instrumentation.ts`

### ❌ Critical Issues Found

1. **Architecture Mismatch**: Code uses **OpenTelemetry API** but expects **dd-trace** native API
2. **Missing Browser RUM**: `@datadog/browser-rum` package is NOT installed
3. **Missing OpenTelemetry Dependencies**: Required OTel packages not installed
4. **Missing getTracer Export**: `datadog-config.ts` doesn't export `getTracer()` function
5. **Dependencies Not Installed**: `node_modules/` directory missing (npm install needed)

---

## Current Package Status

### Installed in package.json

```json
{
  "dependencies": {
    "dd-trace": "^5.69.0"
  }
}
```

### Missing Packages

**For Browser RUM:**
```bash
@datadog/browser-rum  # NOT INSTALLED
```

**For OpenTelemetry Approach (currently used in code):**
```bash
@opentelemetry/api
@opentelemetry/sdk-node
@opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-trace-otlp-http
@opentelemetry/resources
@opentelemetry/semantic-conventions
@opentelemetry/sdk-trace-node
@opentelemetry/core
```

---

## Implementation Approach Analysis

### Current Approach: OpenTelemetry + Datadog Exporter

The existing code in `lib/monitoring/datadog-config.ts` uses:
- OpenTelemetry SDK for instrumentation
- OTLP HTTP exporter to send traces to Datadog Agent
- This is a **valid approach** but requires additional dependencies

**Pros:**
- Vendor-neutral (can switch from Datadog)
- Standard OpenTelemetry semantics
- Flexible instrumentation

**Cons:**
- More dependencies
- Slightly higher overhead
- More complex configuration

### Alternative Approach: Native dd-trace

Using `dd-trace` directly:
- Native Datadog APM library
- Automatic instrumentation for Node.js
- Simpler setup
- Better integration with Datadog features

**Recommendation:** Switch to **native dd-trace** for simpler deployment and better Datadog integration.

---

## File Inventory

### Core Monitoring Files

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `lib/monitoring/datadog-config.ts` | 284 | ⚠️ | Missing `getTracer()`, uses OTel |
| `lib/monitoring/datadog-tracer.ts` | 255 | ⚠️ | Uses OTel API, not dd-trace |
| `lib/monitoring/datadog-middleware.ts` | 144 | ⚠️ | Expects `getTracer()` export |
| `lib/monitoring/datadog-database.ts` | 173 | ⚠️ | Expects `getTracer()` export |
| `lib/monitoring/datadog-metrics.ts` | 291 | ⚠️ | Expects `getTracer()` export |
| `lib/monitoring/datadog-usage-examples.ts` | 390 | ✅ | Example code (works conceptually) |

### Domain Tracers

| File | Operations | Status |
|------|-----------|--------|
| `lib/monitoring/traces/auth-tracer.ts` | 8 | ⚠️ |
| `lib/monitoring/traces/ticket-tracer.ts` | 8 | ⚠️ |
| `lib/monitoring/traces/sla-tracer.ts` | 9 | ⚠️ |
| `lib/monitoring/traces/database-tracer.ts` | 11 | ⚠️ |
| `lib/monitoring/traces/index.ts` | 4 helpers | ⚠️ |

**Total:** 40 traced operations

### Documentation

| File | Lines | Content |
|------|-------|---------|
| `DATADOG_IMPLEMENTATION_SUMMARY.txt` | 343 | Implementation overview |
| `DATADOG_INTEGRATION.md` | 630 | Complete integration guide |
| `DATADOG_QUICK_START.md` | 93 | 5-minute setup guide |
| `DATADOG_SETUP_SUMMARY.md` | 400+ | Detailed setup |
| `DATADOG_TRACING_GUIDE.md` | 600+ | Comprehensive usage |

---

## Environment Variables Configuration

### Already in .env.example

```bash
# ============================================
# DATADOG APM & MONITORING
# ============================================

# Datadog Agent Configuration
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_DOGSTATSD_PORT=8125

# Service Configuration
DD_SERVICE=servicedesk
DD_ENV=development
DD_VERSION=1.0.0

# Datadog API Configuration
DD_API_KEY=                              # ⚠️ PLACEHOLDER - DO NOT COMMIT REAL KEY
DD_SITE=datadoghq.com

# APM / Distributed Tracing
DD_TRACE_ENABLED=false                   # Set to 'true' to enable
DD_TRACE_DEBUG=false
DD_TRACE_SAMPLE_RATE=1.0
DD_TRACE_ANALYTICS_ENABLED=true

# Logs Integration
DD_LOGS_ENABLED=false
DD_LOGS_INJECTION=true

# Profiling (CPU & Memory)
DD_PROFILING_ENABLED=false

# Real User Monitoring (RUM)
NEXT_PUBLIC_DD_RUM_ENABLED=false         # ⚠️ Browser RUM not installed
NEXT_PUBLIC_DD_RUM_APPLICATION_ID=       # ⚠️ PLACEHOLDER
NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN=         # ⚠️ PLACEHOLDER
NEXT_PUBLIC_DD_RUM_SAMPLE_RATE=100

# Custom Metrics
DD_CUSTOM_METRICS_ENABLED=false
```

---

## Corrected Implementation Plan

### Option 1: Fix OpenTelemetry Approach (Current Code)

**Step 1: Install Dependencies**
```bash
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

**Step 2: Fix datadog-config.ts**

Add missing export:
```typescript
// At the end of datadog-config.ts
export function getTracer() {
  // Return dd-trace compatible object
  // This is a compatibility shim
  return {
    startSpan: () => { /* implementation */ },
    scope: () => { /* implementation */ }
  }
}
```

**Step 3: Install Browser RUM**
```bash
npm install --save @datadog/browser-rum
```

**Step 4: Create RUM Initialization**

Create `lib/monitoring/datadog-rum.ts`:
```typescript
import { datadogRum } from '@datadog/browser-rum'

export function initializeDatadogRUM() {
  if (typeof window === 'undefined') return

  const rumEnabled = process.env.NEXT_PUBLIC_DD_RUM_ENABLED === 'true'
  if (!rumEnabled) return

  datadogRum.init({
    applicationId: process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID!,
    clientToken: process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN!,
    site: process.env.DD_SITE || 'datadoghq.com',
    service: process.env.DD_SERVICE || 'servicedesk',
    env: process.env.DD_ENV || 'development',
    version: process.env.DD_VERSION || '1.0.0',
    sessionSampleRate: parseInt(process.env.NEXT_PUBLIC_DD_RUM_SAMPLE_RATE || '100'),
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input'
  })

  datadogRum.startSessionReplayRecording()
}
```

### Option 2: Switch to Native dd-trace (RECOMMENDED)

**Step 1: Create New dd-trace Configuration**

Create `lib/monitoring/dd-trace-init.ts`:
```typescript
import tracer from 'dd-trace'

export function initializeDatadog() {
  if (process.env.DD_TRACE_ENABLED !== 'true') {
    console.log('📊 Datadog APM disabled')
    return null
  }

  tracer.init({
    service: process.env.DD_SERVICE || 'servicedesk',
    env: process.env.DD_ENV || 'development',
    version: process.env.DD_VERSION || '1.0.0',
    hostname: process.env.DD_AGENT_HOST || 'localhost',
    port: parseInt(process.env.DD_TRACE_AGENT_PORT || '8126'),
    sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
    logInjection: process.env.DD_LOGS_INJECTION === 'true',
    profiling: process.env.DD_PROFILING_ENABLED === 'true',
    runtimeMetrics: true,
    plugins: true
  })

  console.log('📊 Datadog APM initialized', {
    service: process.env.DD_SERVICE,
    env: process.env.DD_ENV,
    version: process.env.DD_VERSION
  })

  return tracer
}

export function getTracer() {
  return tracer
}
```

**Step 2: Update instrumentation.ts**
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Datadog FIRST (before other imports)
    if (process.env.DD_TRACE_ENABLED === 'true') {
      const { initializeDatadog } = await import('./lib/monitoring/dd-trace-init')
      initializeDatadog()
    }

    // Then initialize Sentry and other services
    // ...
  }
}
```

**Step 3: Refactor Existing Code**

Update all files to use native dd-trace API instead of OpenTelemetry.

---

## Browser RUM Implementation

### 1. Create RUM Provider Component

`src/components/providers/DatadogRUMProvider.tsx`:
```typescript
'use client'

import { useEffect } from 'react'
import { datadogRum } from '@datadog/browser-rum'

export function DatadogRUMProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DD_RUM_ENABLED === 'true') {
      datadogRum.init({
        applicationId: process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID!,
        clientToken: process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN!,
        site: 'datadoghq.com',
        service: 'servicedesk',
        env: process.env.NEXT_PUBLIC_DD_ENV || 'development',
        version: '1.0.0',
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input'
      })

      datadogRum.startSessionReplayRecording()
    }
  }, [])

  return <>{children}</>
}
```

### 2. Add to Root Layout

`app/layout.tsx`:
```typescript
import { DatadogRUMProvider } from '@/src/components/providers/DatadogRUMProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <DatadogRUMProvider>
          {children}
        </DatadogRUMProvider>
      </body>
    </html>
  )
}
```

### 3. Track Custom User Actions

```typescript
import { datadogRum } from '@datadog/browser-rum'

// Track custom action
datadogRum.addAction('ticket_created', {
  ticketId: ticket.id,
  priority: ticket.priority
})

// Track user info
datadogRum.setUser({
  id: user.id,
  name: user.name,
  email: user.email  // Will be masked per privacy settings
})

// Add custom context
datadogRum.addRumGlobalContext('organization_id', orgId)
```

---

## Installation & Setup Instructions

### Quick Start (5 Minutes)

**1. Install Dependencies**
```bash
# Navigate to project directory
cd /home/nic20/ProjetosWeb/ServiceDesk

# Install all dependencies (including dd-trace)
npm install

# Install browser RUM
npm install --save @datadog/browser-rum
```

**2. Set Up Datadog Agent**
```bash
# Using Docker
docker run -d \
  --name dd-agent \
  -e DD_API_KEY=YOUR_API_KEY_HERE \
  -e DD_SITE="datadoghq.com" \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 \
  -p 8125:8125/udp \
  datadog/agent:latest

# Verify agent is running
curl http://localhost:8126
```

**3. Configure Environment**
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and set:
DD_TRACE_ENABLED=true
DD_API_KEY=your_actual_api_key_here
DD_SERVICE=servicedesk
DD_ENV=development
```

**4. Get RUM Credentials**

1. Go to https://app.datadoghq.com/rum/application/create
2. Create a new RUM application
3. Copy Application ID and Client Token
4. Add to `.env`:
```bash
NEXT_PUBLIC_DD_RUM_ENABLED=true
NEXT_PUBLIC_DD_RUM_APPLICATION_ID=your_app_id
NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN=your_client_token
```

**5. Start Application**
```bash
npm run dev
```

**6. Verify Setup**

- Check console for: `📊 Datadog APM initialized`
- Visit http://localhost:3000
- Generate some traffic (login, create ticket, etc.)
- Check Datadog dashboard: https://app.datadoghq.com/apm/traces
- Filter by `service:servicedesk`

---

## Integration Points

### 1. API Routes (Server-Side)

**Example: Ticket Creation API**

Location: `app/api/tickets/route.ts`

```typescript
import { getTracer } from '@/lib/monitoring/dd-trace-init'
import { ticketMetrics } from '@/lib/monitoring/datadog-metrics'

export async function POST(request: Request) {
  const tracer = getTracer()
  const span = tracer.startSpan('api.tickets.create')

  try {
    const body = await request.json()

    // Add tags
    span.setTag('ticket.priority', body.priority)
    span.setTag('ticket.category', body.category)

    const ticket = await createTicket(body)

    // Record metric
    ticketMetrics.created(body.priority, body.category, body.organizationId)

    span.setTag('http.status_code', 201)
    return Response.json({ success: true, ticket }, { status: 201 })

  } catch (error) {
    span.setTag('error', true)
    span.setTag('error.message', error.message)
    throw error
  } finally {
    span.finish()
  }
}
```

### 2. Database Queries (SQLite)

**Example: User Lookup**

```typescript
import { createTracedDatabase } from '@/lib/monitoring/datadog-database'
import db from '@/lib/db/connection'

const tracedDb = createTracedDatabase(db)

// Automatically traced
const user = tracedDb.prepare('SELECT * FROM users WHERE id = ?').get(userId)
```

### 3. Frontend (Browser RUM)

**Example: Track Custom Actions**

```typescript
'use client'

import { datadogRum } from '@datadog/browser-rum'

export function CreateTicketButton() {
  const handleClick = async () => {
    // Track user action
    datadogRum.addAction('button_click', {
      button_name: 'create_ticket',
      page: 'tickets'
    })

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(ticketData)
      })

      datadogRum.addAction('ticket_created', {
        success: true
      })
    } catch (error) {
      datadogRum.addError(error)
    }
  }

  return <button onClick={handleClick}>Create Ticket</button>
}
```

---

## Performance Baseline Metrics

### Current Application Metrics (Estimated)

**Note:** Actual metrics require running application with Datadog enabled.

| Metric | Estimated Value | Measurement |
|--------|----------------|-------------|
| API Response Time | 50-200ms | P50-P95 |
| Database Query Time | 5-50ms | P50-P95 |
| Page Load Time | 1-3s | First Contentful Paint |
| Time to Interactive | 2-4s | TTI |
| Bundle Size | ~500KB | Gzipped |

**To Establish Baseline:**
1. Enable Datadog APM
2. Run application for 1 hour
3. Generate representative traffic
4. Export metrics from Datadog dashboard
5. Document in `PERFORMANCE_BASELINE.md`

---

## Dashboards & Alerts

### Recommended Dashboards

1. **Application Overview**
   - Request rate, error rate, latency
   - Top endpoints by traffic
   - Error distribution

2. **Database Performance**
   - Query rate and duration
   - Slow queries (>100ms)
   - Connection pool usage

3. **Business Metrics**
   - Tickets created/resolved
   - SLA compliance rate
   - Login success/failure

4. **User Experience (RUM)**
   - Page load times
   - Core Web Vitals
   - User sessions
   - JavaScript errors

### Critical Alerts

1. **High Error Rate**: >5% of requests failing
2. **Slow Endpoints**: P95 >1s
3. **SLA Breaches**: >5 per hour
4. **Auth Failures**: >50 per 15 minutes
5. **Database Slow Queries**: >100 per minute

---

## Issues & Blockers

### Critical Issues

1. **❌ Dependencies Not Installed**
   - Resolution: Run `npm install`
   - Impact: Application won't build

2. **❌ Browser RUM Package Missing**
   - Resolution: `npm install @datadog/browser-rum`
   - Impact: No frontend monitoring

3. **❌ Architecture Inconsistency**
   - Resolution: Choose OTel OR native dd-trace
   - Impact: Code won't execute properly

### Configuration Blockers

4. **⚠️ Missing API Keys**
   - Resolution: Obtain from Datadog dashboard
   - Impact: Can't send data to Datadog

5. **⚠️ Agent Not Running**
   - Resolution: Start Datadog agent via Docker
   - Impact: Traces not collected

### Code Issues

6. **⚠️ Missing getTracer() Export**
   - Resolution: Add to datadog-config.ts
   - Impact: Import errors in dependent files

---

## Testing Checklist

### Server-Side APM

- [ ] Install dependencies (`npm install`)
- [ ] Start Datadog agent (Docker)
- [ ] Configure environment variables
- [ ] Enable tracing (`DD_TRACE_ENABLED=true`)
- [ ] Start application
- [ ] Verify tracer initialization in console
- [ ] Make API requests
- [ ] Check traces in Datadog dashboard
- [ ] Verify custom metrics appear
- [ ] Test database query tracing

### Browser RUM

- [ ] Install `@datadog/browser-rum`
- [ ] Create RUM application in Datadog
- [ ] Configure RUM environment variables
- [ ] Add DatadogRUMProvider to layout
- [ ] Enable RUM (`NEXT_PUBLIC_DD_RUM_ENABLED=true`)
- [ ] Load application in browser
- [ ] Verify RUM initialization in browser console
- [ ] Navigate between pages
- [ ] Trigger custom actions
- [ ] Check RUM data in Datadog dashboard

### Integration

- [ ] Verify trace correlation (frontend → backend)
- [ ] Test error tracking (frontend + backend)
- [ ] Verify user identification
- [ ] Test custom metrics recording
- [ ] Verify log injection (trace IDs in logs)

---

## Next Steps

### Immediate Actions (This Week)

1. **Run `npm install`** to install dependencies
2. **Install Browser RUM**: `npm install @datadog/browser-rum`
3. **Choose architecture approach** (native dd-trace recommended)
4. **Fix code inconsistencies** based on chosen approach
5. **Obtain Datadog API keys** from team admin
6. **Start Datadog agent** locally

### Short-term (Next Sprint)

1. Create RUM provider component
2. Add RUM to root layout
3. Test end-to-end tracing
4. Create baseline dashboards
5. Set up critical alerts
6. Document actual performance metrics

### Long-term (Next Quarter)

1. Enable profiling in production
2. Set up log correlation
3. Implement synthetic monitoring
4. Create team runbooks
5. Optimize sampling rates
6. Train team on Datadog usage

---

## Resources

### Documentation Created

- ✅ `DATADOG_IMPLEMENTATION_SUMMARY.txt` - Overview
- ✅ `DATADOG_INTEGRATION.md` - Complete guide (630 lines)
- ✅ `DATADOG_QUICK_START.md` - 5-minute setup
- ✅ `DATADOG_SETUP_SUMMARY.md` - Detailed setup
- ✅ `DATADOG_TRACING_GUIDE.md` - Usage guide
- ✅ `AGENT3_DATADOG_APM_SUMMARY.md` - This document

### Code Files

**Core Infrastructure (6 files):**
- `lib/monitoring/datadog-config.ts`
- `lib/monitoring/datadog-tracer.ts`
- `lib/monitoring/datadog-middleware.ts`
- `lib/monitoring/datadog-database.ts`
- `lib/monitoring/datadog-metrics.ts`
- `lib/monitoring/datadog-usage-examples.ts`

**Domain Tracers (5 files):**
- `lib/monitoring/traces/auth-tracer.ts`
- `lib/monitoring/traces/ticket-tracer.ts`
- `lib/monitoring/traces/sla-tracer.ts`
- `lib/monitoring/traces/database-tracer.ts`
- `lib/monitoring/traces/index.ts`

**Total:** 11 implementation files, 6 documentation files

### External Links

- [Datadog APM Docs](https://docs.datadoghq.com/tracing/)
- [dd-trace-js GitHub](https://github.com/DataDog/dd-trace-js)
- [Browser RUM Docs](https://docs.datadoghq.com/real_user_monitoring/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Implementation Files** | 11 | ⚠️ Needs fixes |
| **Documentation Files** | 6 | ✅ Complete |
| **Total Lines of Code** | ~3,500 | ⚠️ Architecture issues |
| **Traced Operations** | 40 | ✅ Comprehensive |
| **Custom Metrics** | 30+ | ✅ Well-defined |
| **Environment Variables** | 20 | ✅ Documented |
| **Dependencies Needed** | 2-9 | ❌ Not installed |

---

## Conclusion

The ServiceDesk application has a **comprehensive Datadog APM framework** already implemented with:

✅ **Strengths:**
- Extensive documentation (2,000+ lines)
- 40 domain-specific trace operations
- Custom business metrics
- Auto-initialization via instrumentation.ts
- Comprehensive environment configuration

❌ **Critical Gaps:**
- Dependencies not installed
- Browser RUM missing
- Architecture mismatch (OTel vs dd-trace)
- Missing function exports

**Recommendation:**
1. Run `npm install` immediately
2. Install `@datadog/browser-rum`
3. Switch to native dd-trace approach (simpler, more reliable)
4. Fix code inconsistencies
5. Test thoroughly before production deployment

**Estimated Effort to Complete:**
- Fix dependencies: 30 minutes
- Refactor to dd-trace: 2-4 hours
- Add Browser RUM: 1-2 hours
- Testing & validation: 2-3 hours
- **Total: 1 day of focused work**

---

**Prepared by:** Agent 3 - Datadog APM Implementation
**Date:** 2025-10-06
**Status:** Review Complete - Action Required
