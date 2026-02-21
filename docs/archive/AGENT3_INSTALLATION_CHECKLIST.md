# Agent 3 - Datadog APM Installation Checklist

**Project:** ServiceDesk
**Date:** 2025-10-06
**Status:** Ready for Implementation

---

## Pre-Flight Check

### Current Status

- ✅ Code framework implemented (11 files)
- ✅ Documentation complete (5 guides)
- ✅ Environment variables configured
- ✅ Logger implementation exists
- ❌ Dependencies not installed
- ❌ Browser RUM not added
- ❌ Datadog API keys not configured
- ❌ Agent not running

---

## Installation Steps

### Phase 1: Dependencies (15 minutes)

#### Step 1.1: Install Base Dependencies
```bash
cd /home/nic20/ProjetosWeb/ServiceDesk
npm install
```

**Expected Output:**
```
added 1234 packages in 2m
```

**Verify:**
```bash
npm list dd-trace
# Should show: dd-trace@5.69.0
```

#### Step 1.2: Install Browser RUM
```bash
npm install --save @datadog/browser-rum
```

**Verify:**
```bash
npm list @datadog/browser-rum
# Should show: @datadog/browser-rum@5.x.x
```

#### Step 1.3: (Optional) Install OpenTelemetry Packages

**Only if keeping current OpenTelemetry approach:**

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

**Note:** Not recommended. Consider refactoring to native dd-trace instead.

**Checklist:**
- [ ] Base dependencies installed (`npm install` complete)
- [ ] Browser RUM installed
- [ ] No installation errors
- [ ] package-lock.json updated

---

### Phase 2: Datadog Account Setup (10 minutes)

#### Step 2.1: Get API Key

1. Go to: https://app.datadoghq.com/organization-settings/api-keys
2. Click "New Key"
3. Name: "ServiceDesk Production"
4. Copy the key
5. **IMPORTANT:** Store securely (password manager, secrets vault)

**Checklist:**
- [ ] Logged into Datadog account
- [ ] API key created
- [ ] API key saved securely

#### Step 2.2: Create RUM Application

1. Go to: https://app.datadoghq.com/rum/application/create
2. Application type: "Browser"
3. Application name: "ServiceDesk"
4. Copy:
   - Application ID
   - Client Token
5. Save credentials

**Checklist:**
- [ ] RUM application created
- [ ] Application ID copied
- [ ] Client Token copied
- [ ] Credentials saved securely

---

### Phase 3: Local Agent Setup (5 minutes)

#### Step 3.1: Start Datadog Agent (Docker)

```bash
docker run -d \
  --name dd-agent \
  -e DD_API_KEY=your_api_key_here \
  -e DD_SITE="datadoghq.com" \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -e DD_LOGS_ENABLED=false \
  -p 8126:8126 \
  -p 8125:8125/udp \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  datadog/agent:latest
```

**Replace `your_api_key_here` with your actual API key!**

#### Step 3.2: Verify Agent

```bash
# Check container is running
docker ps | grep dd-agent

# Check agent status
docker exec dd-agent agent status

# Test APM endpoint
curl http://localhost:8126

# Test StatsD endpoint
echo "test.metric:1|c" | nc -u -w1 localhost 8125
```

**Expected:**
- Container status: "Up"
- Agent status: "Running"
- APM endpoint: Returns JSON response
- StatsD: No errors

**Checklist:**
- [ ] Docker container running
- [ ] Agent status healthy
- [ ] Port 8126 accessible (APM)
- [ ] Port 8125 accessible (StatsD)
- [ ] No error messages in logs

---

### Phase 4: Environment Configuration (5 minutes)

#### Step 4.1: Create .env File

```bash
cd /home/nic20/ProjetosWeb/ServiceDesk
cp .env.example .env
```

#### Step 4.2: Edit .env File

Open `.env` and update:

```bash
# ============================================
# DATADOG APM & MONITORING
# ============================================

# REQUIRED: Enable tracing
DD_TRACE_ENABLED=true

# REQUIRED: API Key from Step 2.1
DD_API_KEY=your_api_key_here

# Service Configuration
DD_SERVICE=servicedesk
DD_ENV=development
DD_VERSION=1.0.0

# Agent Connection (Docker container)
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_DOGSTATSD_PORT=8125

# Sampling (100% for development)
DD_TRACE_SAMPLE_RATE=1.0
DD_TRACE_ANALYTICS_ENABLED=true

# Debugging
DD_TRACE_DEBUG=false
DD_LOGS_INJECTION=true

# REQUIRED: Browser RUM (from Step 2.2)
NEXT_PUBLIC_DD_RUM_ENABLED=true
NEXT_PUBLIC_DD_RUM_APPLICATION_ID=your_app_id_here
NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN=your_client_token_here
NEXT_PUBLIC_DD_RUM_SAMPLE_RATE=100

# Custom Metrics
DD_CUSTOM_METRICS_ENABLED=true
```

**Checklist:**
- [ ] .env file created
- [ ] DD_TRACE_ENABLED=true
- [ ] DD_API_KEY set
- [ ] NEXT_PUBLIC_DD_RUM_ENABLED=true
- [ ] RUM Application ID set
- [ ] RUM Client Token set
- [ ] No placeholder values remain

---

### Phase 5: Code Implementation (30 minutes)

#### Step 5.1: Create Browser RUM Provider

**Create file:** `src/components/providers/DatadogRUMProvider.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { datadogRum } from '@datadog/browser-rum'

export function DatadogRUMProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const rumEnabled = process.env.NEXT_PUBLIC_DD_RUM_ENABLED === 'true'
    const appId = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID
    const clientToken = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN

    if (!rumEnabled || !appId || !clientToken) {
      console.log('⚠️ Datadog RUM disabled or not configured')
      return
    }

    try {
      datadogRum.init({
        applicationId: appId,
        clientToken: clientToken,
        site: 'datadoghq.com',
        service: 'servicedesk',
        env: process.env.NEXT_PUBLIC_DD_ENV || 'development',
        version: '1.0.0',
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
        allowedTracingUrls: [
          { match: 'http://localhost:3000', propagatorTypes: ['datadog'] },
          { match: /https:\/\/.*\.vercel\.app/, propagatorTypes: ['datadog'] }
        ]
      })

      datadogRum.startSessionReplayRecording()
      console.log('✅ Datadog RUM initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Datadog RUM:', error)
    }
  }, [])

  return <>{children}</>
}
```

**Checklist:**
- [ ] File created in correct location
- [ ] No TypeScript errors
- [ ] Imports correct

#### Step 5.2: Add RUM Provider to Layout

**Edit:** `app/layout.tsx`

Add import at top:
```typescript
import { DatadogRUMProvider } from '@/src/components/providers/DatadogRUMProvider'
```

Wrap children in the layout:
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DatadogRUMProvider>
          {/* Your existing providers */}
          {children}
        </DatadogRUMProvider>
      </body>
    </html>
  )
}
```

**Checklist:**
- [ ] Import added
- [ ] Provider wraps children
- [ ] No build errors

#### Step 5.3: (Optional) Add getTracer() Export

**Edit:** `lib/monitoring/datadog-config.ts`

Add at the end of file:

```typescript
/**
 * Get tracer instance (compatibility shim)
 * Note: Current implementation uses OpenTelemetry
 * For native dd-trace, this should be refactored
 */
export function getTracer() {
  // This is a temporary shim for files expecting dd-trace API
  // TODO: Refactor to use native dd-trace or full OTel
  console.warn('getTracer() called - using compatibility shim')

  return {
    startSpan: (name: string, options?: any) => {
      const span = trace.getSpan(context.active())
      return span || {
        setTag: () => {},
        finish: () => {},
        setTag: () => {}
      }
    },
    scope: () => ({
      active: () => trace.getSpan(context.active())
    })
  }
}
```

**Note:** This is a temporary fix. Consider full refactor to native dd-trace.

**Checklist:**
- [ ] Function added (if needed)
- [ ] No compilation errors

---

### Phase 6: Testing (20 minutes)

#### Step 6.1: Build Application

```bash
npm run build
```

**Expected:**
- No build errors
- No TypeScript errors
- Build completes successfully

**Checklist:**
- [ ] Build successful
- [ ] No errors in output
- [ ] .next directory created

#### Step 6.2: Start Development Server

```bash
npm run dev
```

**Check console output for:**
```
📊 Initializing ServiceDesk instrumentation...
✓ Sentry error tracking initialized (or disabled)
✓ Datadog APM initialized
✓ Cache layer initialized
✓ Performance monitoring initialized
🎯 ServiceDesk instrumentation complete
```

**Checklist:**
- [ ] Server starts without errors
- [ ] Datadog initialization message appears
- [ ] No error stack traces

#### Step 6.3: Test Browser RUM

1. Open browser to http://localhost:3000
2. Open browser console (F12)
3. Look for: `✅ Datadog RUM initialized`
4. Navigate to different pages
5. Perform actions (login, create ticket, etc.)

**Checklist:**
- [ ] RUM initialization message in console
- [ ] No JavaScript errors
- [ ] Page loads normally
- [ ] Actions work as expected

#### Step 6.4: Generate Test Traffic

```bash
# Create a ticket
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test ticket"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'

# Health check
curl http://localhost:3000/api/health
```

**Checklist:**
- [ ] API requests succeed
- [ ] No server errors
- [ ] Responses are JSON

#### Step 6.5: Verify in Datadog Dashboard

1. Go to: https://app.datadoghq.com/apm/traces
2. Filter by `service:servicedesk`
3. Should see traces appearing (may take 1-2 minutes)

**Look for:**
- API requests traced
- Database queries traced
- Custom metrics recorded
- No errors in traces

**Checklist:**
- [ ] Traces appearing in Datadog
- [ ] Service name correct (servicedesk)
- [ ] Operations visible
- [ ] Timing data present

#### Step 6.6: Verify RUM Data

1. Go to: https://app.datadoghq.com/rum/sessions
2. Filter by application: "ServiceDesk"
3. Should see session data

**Look for:**
- User sessions
- Page views
- Performance metrics (LCP, FID, CLS)
- User actions

**Checklist:**
- [ ] Sessions appearing
- [ ] Page views recorded
- [ ] Performance data visible
- [ ] User actions tracked

---

### Phase 7: Performance Validation (10 minutes)

#### Step 7.1: Check Application Performance

**Before Datadog:**
- Measure baseline performance

**After Datadog:**
- Measure with APM enabled

**Test:**
```bash
# Install autocannon for load testing
npm install -g autocannon

# Run load test
autocannon -c 10 -d 30 http://localhost:3000
```

**Expected Overhead:**
- Latency increase: <10%
- Memory increase: <50MB
- CPU increase: <5%

**Checklist:**
- [ ] Load test completed
- [ ] Performance acceptable
- [ ] No memory leaks
- [ ] CPU usage normal

#### Step 7.2: Check Agent Performance

```bash
docker stats dd-agent
```

**Expected:**
- CPU: <5%
- Memory: <200MB

**Checklist:**
- [ ] Agent CPU usage acceptable
- [ ] Agent memory usage normal
- [ ] No container restarts

---

## Troubleshooting

### Issue: Agent Not Reachable

**Symptoms:**
- Error: "Datadog Agent not reachable"
- No traces appearing

**Solutions:**
1. Check agent is running: `docker ps | grep dd-agent`
2. Check port mapping: `docker port dd-agent`
3. Test connectivity: `curl http://localhost:8126`
4. Check logs: `docker logs dd-agent`
5. Verify `DD_AGENT_HOST=localhost` in .env

### Issue: RUM Not Initializing

**Symptoms:**
- No console message "Datadog RUM initialized"
- No RUM data in dashboard

**Solutions:**
1. Check environment variables in browser console:
   ```javascript
   console.log(process.env.NEXT_PUBLIC_DD_RUM_ENABLED)
   console.log(process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID)
   ```
2. Verify variables start with `NEXT_PUBLIC_`
3. Restart dev server after .env changes
4. Check browser console for errors
5. Verify RUM provider in layout

### Issue: No Traces Appearing

**Symptoms:**
- Dashboard shows no data
- Agent running but no traces

**Solutions:**
1. Verify `DD_TRACE_ENABLED=true` in .env
2. Check console for initialization message
3. Wait 1-2 minutes for data to appear
4. Generate test traffic
5. Check sample rate (should be 1.0 for testing)
6. Verify API key is correct

### Issue: Build Errors

**Symptoms:**
- TypeScript errors
- Module not found errors

**Solutions:**
1. Run `npm install` again
2. Delete `node_modules` and `.next`, reinstall
3. Check package.json for missing dependencies
4. Verify import paths are correct
5. Check for typos in file names

---

## Success Criteria

### Server-Side APM ✅

- [ ] Dependencies installed without errors
- [ ] Datadog agent running in Docker
- [ ] Application starts successfully
- [ ] Initialization message in console
- [ ] Traces appearing in Datadog APM dashboard
- [ ] Custom metrics recorded
- [ ] Database queries traced
- [ ] No performance degradation (< 10% overhead)

### Browser RUM ✅

- [ ] @datadog/browser-rum installed
- [ ] RUM provider component created
- [ ] Provider added to layout
- [ ] RUM initializes in browser
- [ ] Sessions appearing in Datadog RUM dashboard
- [ ] Page views tracked
- [ ] User actions recorded
- [ ] Performance metrics collected

### Integration ✅

- [ ] Frontend and backend traces correlated
- [ ] User identification working
- [ ] Errors tracked end-to-end
- [ ] Logs include trace IDs (if logs enabled)
- [ ] Custom context propagated

---

## Post-Installation

### Create Dashboards

1. Go to: https://app.datadoghq.com/dashboard/lists
2. Create dashboard: "ServiceDesk - Overview"
3. Add widgets:
   - Request rate
   - Error rate
   - P50/P95/P99 latency
   - Top endpoints
   - Database queries

### Set Up Alerts

1. Go to: https://app.datadoghq.com/monitors/create
2. Create monitors for:
   - High error rate (>5%)
   - Slow endpoints (P95 >1s)
   - SLA breaches
   - Authentication failures

### Document Baseline

Create `PERFORMANCE_BASELINE.md`:
- Average response times
- Error rates
- Database query times
- Page load times
- Core Web Vitals

---

## Completion Checklist

### Phase 1: Dependencies
- [ ] npm install complete
- [ ] Browser RUM installed
- [ ] No installation errors

### Phase 2: Datadog Account
- [ ] API key obtained
- [ ] RUM application created
- [ ] Credentials saved

### Phase 3: Agent Setup
- [ ] Docker agent running
- [ ] Ports accessible
- [ ] Agent status healthy

### Phase 4: Configuration
- [ ] .env file created
- [ ] All variables set
- [ ] No placeholders remain

### Phase 5: Code Implementation
- [ ] RUM provider created
- [ ] Provider added to layout
- [ ] No build errors

### Phase 6: Testing
- [ ] Build successful
- [ ] Server starts
- [ ] RUM initializes
- [ ] Traces appearing
- [ ] RUM data visible

### Phase 7: Validation
- [ ] Performance acceptable
- [ ] No errors
- [ ] Dashboards show data

---

## Estimated Time

| Phase | Time | Cumulative |
|-------|------|------------|
| 1. Dependencies | 15 min | 15 min |
| 2. Account Setup | 10 min | 25 min |
| 3. Agent Setup | 5 min | 30 min |
| 4. Configuration | 5 min | 35 min |
| 5. Code Implementation | 30 min | 65 min |
| 6. Testing | 20 min | 85 min |
| 7. Validation | 10 min | 95 min |
| **Total** | **~1.5 hours** | |

---

## Next Steps After Installation

1. Monitor for 24 hours
2. Adjust sample rates if needed
3. Create production dashboards
4. Set up critical alerts
5. Train team on Datadog usage
6. Document performance baselines
7. Plan production rollout

---

**Prepared by:** Agent 3 - Datadog APM Implementation
**Date:** 2025-10-06
**Status:** Ready for Implementation
