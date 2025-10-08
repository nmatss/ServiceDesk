# Agent 1 - Monitoring & Observability Quick Reference

**Quick Start Guide for Developers**

---

## 🚀 Quick Setup (5 Minutes)

### 1. Install Dependencies
```bash
# Verify packages are installed
npm list @sentry/nextjs dd-trace

# If missing, install them
npm install --save @sentry/nextjs dd-trace
```

### 2. Configure Environment Variables
```bash
# Copy example file
cp .env.example .env

# Add these required variables:
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
DD_TRACE_ENABLED=true
DD_API_KEY=your_datadog_api_key
```

### 3. Start Datadog Agent (Optional for local development)
```bash
docker run -d --name dd-agent \
  -e DD_API_KEY=your_key \
  -e DD_APM_ENABLED=true \
  -p 8126:8126 \
  datadog/agent:latest
```

### 4. Test
```bash
npm run dev

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/test-error?type=simple
```

---

## 📊 Monitoring Endpoints

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `/api/health` | System health check | GET |
| `/api/monitoring/status` | Detailed monitoring status | GET |
| `/api/test-error?type=X` | Test error capture | GET |
| `/api/analytics/web-vitals` | Web Vitals collection | POST |

---

## 🛠️ Common Usage Patterns

### Wrap API Routes with Observability
```typescript
import { withObservability } from '@/lib/monitoring/observability'

export const POST = withObservability(
  async (request: NextRequest) => {
    // Your code here
    return NextResponse.json({ success: true })
  },
  {
    routeName: 'tickets.create',
    trackPerformance: true,
    logAudit: true,
  }
)
```

### Capture Errors in Sentry
```typescript
import { captureException } from '@/lib/monitoring/sentry-helpers'

try {
  // Risky operation
} catch (error) {
  captureException(error, {
    tags: { module: 'tickets' },
    extra: { ticketId },
    level: 'error'
  })
}
```

### Track Database Queries
```typescript
import { trackDatabaseQuery } from '@/lib/monitoring/observability'

const users = await trackDatabaseQuery(
  'SELECT * FROM users WHERE id = ?',
  () => db.prepare('SELECT * FROM users WHERE id = ?').get(userId),
  { queryType: 'select', operation: 'users.findById', table: 'users' }
)
```

### Record Custom Metrics
```typescript
import { ticketMetrics } from '@/lib/monitoring/datadog-metrics'

// Track ticket creation
ticketMetrics.created('high', 'technical', organizationId)

// Track resolution
ticketMetrics.resolved('high', 'technical', organizationId, resolutionTimeMs)

// Track SLA breach
ticketMetrics.slaBreached('critical', organizationId)
```

---

## 🔍 Debugging & Testing

### Test Sentry Integration
```bash
# Trigger different error types
curl http://localhost:3000/api/test-error?type=simple
curl http://localhost:3000/api/test-error?type=async
curl http://localhost:3000/api/test-error?type=database
curl http://localhost:3000/api/test-error?type=auth

# Check Sentry dashboard
# https://sentry.io → Issues → Filter by tag: test_endpoint=true
```

### Test Datadog APM
```bash
# Make any API request
curl http://localhost:3000/api/health

# Check Datadog dashboard
# https://app.datadoghq.com → APM → Traces
```

### Check Monitoring Status
```bash
# Get full monitoring status
curl http://localhost:3000/api/monitoring/status | jq

# Check specific sections
curl http://localhost:3000/api/monitoring/status | jq '.monitoring'
curl http://localhost:3000/api/monitoring/status | jq '.performance'
```

---

## ⚙️ Environment Variables Cheat Sheet

### Sentry (Required)
```bash
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Datadog (Optional but Recommended)
```bash
DD_TRACE_ENABLED=true
DD_SERVICE=servicedesk
DD_ENV=development
DD_API_KEY=your_api_key
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
```

### For Source Maps (Production)
```bash
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=servicedesk
SENTRY_UPLOAD_SOURCEMAPS=true
```

---

## 🎯 Key Files

### Configuration
- `/sentry.client.config.ts` - Client-side error tracking
- `/sentry.server.config.ts` - Server-side error tracking
- `/sentry.edge.config.ts` - Edge runtime error tracking
- `/instrumentation.ts` - Initialization

### Monitoring Libraries
- `/lib/monitoring/observability.ts` - Main wrapper
- `/lib/monitoring/sentry-helpers.ts` - Sentry utilities
- `/lib/monitoring/datadog-config.ts` - Datadog APM
- `/lib/monitoring/datadog-metrics.ts` - Custom metrics
- `/lib/performance/monitoring.ts` - Performance tracking

### Endpoints
- `/app/api/health/route.ts` - Health check
- `/app/api/monitoring/status/route.ts` - Status
- `/app/api/test-error/route.ts` - Error testing
- `/app/api/analytics/web-vitals/route.ts` - Performance data

---

## 🚨 Troubleshooting

### Sentry Not Working
```bash
# Check configuration
echo $SENTRY_DSN

# Enable debug mode
# Add to sentry.server.config.ts:
debug: true

# Test error endpoint
curl http://localhost:3000/api/test-error?type=simple
```

### Datadog Not Tracing
```bash
# Check agent is running
docker ps | grep dd-agent

# Test connectivity
curl http://localhost:8126

# Enable debug logging
DD_TRACE_DEBUG=true npm run dev
```

### Performance Monitoring
```bash
# Check stats
curl http://localhost:3000/api/monitoring/status | jq '.performance'

# Review logs
npm run dev | grep "Performance"
```

---

## 📚 Documentation

- **Full Report:** `AGENT1_MONITORING_IMPLEMENTATION_REPORT.md`
- **Sentry Setup:** `SENTRY_SETUP_README.md`
- **Datadog Guide:** `DATADOG_INTEGRATION.md`
- **Environment:** `.env.example`

---

## ✅ Verification Checklist

Before deploying to production:

- [ ] Sentry DSN configured
- [ ] Source maps upload working
- [ ] Datadog agent deployed
- [ ] Environment variables set
- [ ] Health check passing
- [ ] Test errors captured in Sentry
- [ ] Traces appearing in Datadog
- [ ] Performance budgets configured
- [ ] Alerts set up
- [ ] Documentation reviewed

---

**Last Updated:** 2025-10-07
**Agent:** Agent 1 - Monitoring & Observability
