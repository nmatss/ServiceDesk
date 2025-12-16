# ServiceDesk Monitoring & Observability Guide

Complete guide to monitoring, observability, and incident management for ServiceDesk.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Monitoring Stack](#monitoring-stack)
- [Metrics](#metrics)
- [Logging](#logging)
- [Distributed Tracing](#distributed-tracing)
- [Alerting](#alerting)
- [Dashboards](#dashboards)
- [Health Checks](#health-checks)
- [Integration Guide](#integration-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

ServiceDesk uses a comprehensive observability stack:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Sentry** - Error tracking and performance monitoring
- **Datadog APM** - Distributed tracing and application performance
- **Winston** - Structured logging
- **PagerDuty** - Incident management and alerting
- **Slack** - Team notifications

## Architecture

```
┌─────────────┐
│ Application │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       v                 v
┌──────────────┐  ┌─────────────┐
│  Prometheus  │  │   Sentry    │
│   Metrics    │  │    Error    │
│  /metrics    │  │   Tracking  │
└──────┬───────┘  └─────────────┘
       │
       v
┌──────────────┐
│   Grafana    │
│  Dashboards  │
└──────┬───────┘
       │
       v
┌──────────────┐
│ Alertmanager │
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       v             v             v
┌──────────┐  ┌──────────┐  ┌──────────┐
│PagerDuty │  │  Slack   │  │  Email   │
└──────────┘  └──────────┘  └──────────┘
```

---

## Quick Start

### 1. Environment Variables

Create `.env.local` with monitoring configuration:

```bash
# Prometheus
METRICS_API_KEY=your-secure-api-key

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=$(git rev-parse HEAD)
SENTRY_ERROR_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1

# Datadog
DD_TRACE_ENABLED=true
DD_SERVICE=servicedesk
DD_ENV=production
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_TRACE_SAMPLE_RATE=0.1
DD_TRACE_DEBUG=false
DD_PROFILING_ENABLED=true
DD_TRACE_ANALYTICS_ENABLED=true
DD_CUSTOM_METRICS_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=true
LOG_DIR=./logs
```

### 2. Start the Application

```bash
npm run dev
```

### 3. Verify Metrics Endpoint

```bash
curl http://localhost:3000/api/metrics
```

### 4. Check Health Endpoints

```bash
# Liveness probe
curl http://localhost:3000/api/health/live

# Readiness probe
curl http://localhost:3000/api/health/ready

# Startup probe
curl http://localhost:3000/api/health/startup
```

---

## Monitoring Stack

### Prometheus Setup

1. **Install Prometheus**:
   ```bash
   # macOS
   brew install prometheus

   # Linux
   wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
   tar xvf prometheus-*.tar.gz
   cd prometheus-*
   ```

2. **Configure Prometheus** (`prometheus.yml`):
   ```yaml
   global:
     scrape_interval: 15s
     evaluation_interval: 15s

   scrape_configs:
     - job_name: 'servicedesk'
       static_configs:
         - targets: ['localhost:3000']
       metrics_path: '/api/metrics'
       scheme: http
       basic_auth:
         username: 'metrics'
         password: 'your-secure-api-key'

   rule_files:
     - 'monitoring/alerts/prometheus-rules.yaml'

   alerting:
     alertmanagers:
       - static_configs:
           - targets: ['localhost:9093']
   ```

3. **Start Prometheus**:
   ```bash
   ./prometheus --config.file=prometheus.yml
   ```

4. **Access UI**: http://localhost:9090

### Grafana Setup

1. **Install Grafana**:
   ```bash
   # macOS
   brew install grafana

   # Linux
   sudo apt-get install -y grafana
   ```

2. **Start Grafana**:
   ```bash
   # macOS
   brew services start grafana

   # Linux
   sudo systemctl start grafana-server
   ```

3. **Access UI**: http://localhost:3000 (default: admin/admin)

4. **Add Prometheus Data Source**:
   - Go to Configuration > Data Sources
   - Add Prometheus
   - URL: `http://localhost:9090`

5. **Import Dashboards**:
   - Go to Dashboards > Import
   - Upload JSON files from `monitoring/grafana/dashboards/`

### Sentry Setup

1. **Create Sentry Project**: https://sentry.io

2. **Get DSN**: Project Settings > Client Keys (DSN)

3. **Configure Environment Variables**:
   ```bash
   SENTRY_DSN=your-dsn-here
   SENTRY_ORG=your-org
   SENTRY_PROJECT=servicedesk
   ```

4. **Upload Source Maps** (production):
   ```bash
   npm run sentry:sourcemaps
   ```

5. **Create Release**:
   ```bash
   npm run sentry:release
   ```

### Datadog Setup

1. **Install Datadog Agent**:
   ```bash
   DD_API_KEY=your-api-key DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
   ```

2. **Configure APM**:
   Edit `/etc/datadog-agent/datadog.yaml`:
   ```yaml
   apm_config:
     enabled: true
     env: production
   ```

3. **Restart Agent**:
   ```bash
   sudo service datadog-agent restart
   ```

4. **Verify**: https://app.datadoghq.com/apm/home

---

## Metrics

### Available Metrics

#### HTTP Metrics
- `servicedesk_http_requests_total` - Total HTTP requests
- `servicedesk_http_request_duration_seconds` - Request duration
- `servicedesk_http_active_requests` - Active requests
- `servicedesk_http_request_size_bytes` - Request size
- `servicedesk_http_response_size_bytes` - Response size

#### Database Metrics
- `servicedesk_db_queries_total` - Total database queries
- `servicedesk_db_query_duration_seconds` - Query duration
- `servicedesk_db_slow_queries_total` - Slow queries (>100ms)
- `servicedesk_db_active_connections` - Active connections

#### Ticket Metrics
- `servicedesk_tickets_created_total` - Tickets created
- `servicedesk_tickets_resolved_total` - Tickets resolved
- `servicedesk_ticket_resolution_time_seconds` - Resolution time
- `servicedesk_tickets_active` - Active tickets

#### SLA Metrics
- `servicedesk_sla_breaches_total` - SLA breaches
- `servicedesk_sla_compliance_rate` - Compliance rate (0-1)
- `servicedesk_sla_response_time_seconds` - Response time

#### Authentication Metrics
- `servicedesk_auth_attempts_total` - Auth attempts
- `servicedesk_auth_active_sessions` - Active sessions

#### Error Metrics
- `servicedesk_errors_total` - Application errors
- `servicedesk_api_errors_total` - API errors
- `servicedesk_db_errors_total` - Database errors

### Using Metrics in Code

```typescript
import {
  recordHttpRequest,
  recordDbQuery,
  recordTicketCreated
} from '@/lib/monitoring/metrics';

// Record HTTP request
recordHttpRequest('GET', '/api/tickets', 200, 0.123);

// Record database query
recordDbQuery('SELECT', 'tickets', 0.045, true);

// Record ticket creation
recordTicketCreated('high', 'bug', 123);
```

---

## Logging

### Structured Logging

All logs are structured JSON for easy parsing and aggregation:

```typescript
import { structuredLogger } from '@/lib/monitoring/structured-logger';

// Basic logging
structuredLogger.info('User logged in', {
  userId: 123,
  ipAddress: '1.2.3.4'
});

// Error logging with stack trace
structuredLogger.error('Database query failed', {
  error: error.message,
  query: 'SELECT * FROM users',
  duration: 1234
});

// HTTP request logging
import { logHttpRequest } from '@/lib/monitoring/structured-logger';
logHttpRequest('GET', '/api/tickets', 200, 145);
```

### Log Levels

- `error` - Errors and exceptions
- `warn` - Warnings and degraded states
- `info` - Informational messages
- `http` - HTTP requests/responses
- `debug` - Debug information

### Log Formats

**Development** (human-readable):
```
[12:34:56.789] info: User logged in [abc123-def456]
  userId: 123
  ipAddress: "1.2.3.4"
```

**Production** (JSON):
```json
{
  "timestamp": "2025-10-18T12:34:56.789Z",
  "level": "info",
  "message": "User logged in",
  "service": "servicedesk",
  "environment": "production",
  "version": "1.0.0",
  "correlationId": "abc123-def456",
  "userId": 123,
  "ipAddress": "1.2.3.4"
}
```

### Sensitive Data Redaction

Sensitive fields are automatically redacted:
- Passwords
- Tokens
- API keys
- Credit cards
- SSN

---

## Distributed Tracing

### Datadog APM

Traces are automatically created for:
- HTTP requests
- Database queries
- External API calls
- Background jobs

### Manual Tracing

```typescript
import { ddTracer } from '@/lib/monitoring/datadog-tracer';

// Trace an async operation
await ddTracer.trace('processTicket', async (span) => {
  span.setAttribute('ticketId', ticketId);
  span.setAttribute('priority', 'high');

  // Your code here
  const result = await processTicket(ticketId);

  return result;
});

// Add tags to current span
ddTracer.setTags({ userId: 123, operation: 'update' });

// Record error
try {
  await riskyOperation();
} catch (error) {
  ddTracer.recordError(error);
  throw error;
}
```

---

## Alerting

### Alert Severity Levels

- **Critical** - Immediate action required, pages on-call
- **Warning** - Needs attention, notification sent
- **Info** - Informational, logged only

### Alert Rules

See `monitoring/alerts/prometheus-rules.yaml` for all rules:

**High Error Rate**:
- Threshold: >5% error rate
- Duration: 5 minutes
- Action: Page on-call

**Slow Response Time**:
- Threshold: p95 >500ms
- Duration: 10 minutes
- Action: Slack notification

**SLA Breach**:
- Threshold: Compliance <95%
- Duration: 15 minutes
- Action: Page on-call

**High Memory Usage**:
- Threshold: >80%
- Duration: 10 minutes
- Action: Slack notification

### PagerDuty Integration

Configure in `monitoring/alerts/pagerduty-integration.yaml`:

1. Create PagerDuty service
2. Get integration key
3. Update `service_key` in config
4. Configure Alertmanager

### Slack Integration

Configure in `monitoring/alerts/slack-notifications.yaml`:

1. Create Slack app
2. Add incoming webhook
3. Update `api_url` in config
4. Configure channels

---

## Dashboards

### Application Overview
**File**: `monitoring/grafana/dashboards/application-overview.json`

Panels:
- HTTP request rate
- Error rate
- Response time (p95, p99)
- Active users
- Database performance
- Memory/CPU usage

### SLA Metrics
**File**: `monitoring/grafana/dashboards/sla-metrics.json`

Panels:
- SLA compliance rate
- SLA breaches (24h)
- Response time by priority
- Resolution time
- Tickets created vs resolved
- Active tickets by priority

---

## Health Checks

### Kubernetes Probes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: servicedesk
          # Liveness probe - restart if fails
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          # Readiness probe - remove from load balancer if fails
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

          # Startup probe - wait for application to start
          startupProbe:
            httpGet:
              path: /api/health/startup
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 30
```

### Endpoint Responses

**Liveness** (`/api/health/live`):
```json
{
  "status": "ok",
  "timestamp": "2025-10-18T12:34:56.789Z",
  "uptime": 3600.123,
  "environment": "production"
}
```

**Readiness** (`/api/health/ready`):
```json
{
  "status": "ready",
  "ready": true,
  "timestamp": "2025-10-18T12:34:56.789Z",
  "checks": {
    "database": { "status": "ok" },
    "filesystem": { "status": "ok" },
    "memory": {
      "status": "ok",
      "heapUsed": 128,
      "heapTotal": 256,
      "percentage": 50
    }
  },
  "checkDuration": 23,
  "environment": "production",
  "version": "1.0.0"
}
```

---

## Integration Guide

### Adding Custom Metrics

1. **Define metric** in `lib/monitoring/metrics.ts`:
   ```typescript
   export const myCustomMetric = new Counter({
     name: 'servicedesk_my_custom_metric_total',
     help: 'Description of my metric',
     labelNames: ['label1', 'label2'],
   });
   ```

2. **Use metric** in your code:
   ```typescript
   import { myCustomMetric } from '@/lib/monitoring/metrics';

   myCustomMetric.inc({ label1: 'value1', label2: 'value2' });
   ```

### Adding Custom Alerts

1. **Add rule** to `monitoring/alerts/prometheus-rules.yaml`:
   ```yaml
   - alert: MyCustomAlert
     expr: my_custom_metric > 100
     for: 5m
     labels:
       severity: warning
     annotations:
       summary: "My custom alert fired"
       description: "Metric value is {{ $value }}"
   ```

2. **Test alert**:
   ```bash
   promtool check rules monitoring/alerts/prometheus-rules.yaml
   ```

### Adding Custom Dashboard

1. **Create dashboard** in Grafana UI
2. **Export JSON**: Share > Export > Save to file
3. **Save to** `monitoring/grafana/dashboards/my-dashboard.json`
4. **Import**: Dashboards > Import > Upload JSON

---

## Troubleshooting

### Metrics Not Appearing

1. **Check metrics endpoint**:
   ```bash
   curl http://localhost:3000/api/metrics
   ```

2. **Verify Prometheus scraping**:
   - Go to http://localhost:9090/targets
   - Check ServiceDesk target status

3. **Check logs**:
   ```bash
   tail -f logs/combined.log | grep metric
   ```

### Sentry Errors Not Appearing

1. **Verify DSN**:
   ```bash
   echo $SENTRY_DSN
   ```

2. **Check environment**:
   - Sentry is disabled in development by default
   - Set `SENTRY_ENVIRONMENT=development` to enable

3. **Test error**:
   ```typescript
   import { captureException } from '@/lib/monitoring/sentry-helpers';
   captureException(new Error('Test error'));
   ```

### Datadog Traces Missing

1. **Verify agent running**:
   ```bash
   sudo service datadog-agent status
   ```

2. **Check configuration**:
   ```bash
   echo $DD_TRACE_ENABLED
   echo $DD_AGENT_HOST
   ```

3. **Enable debug mode**:
   ```bash
   DD_TRACE_DEBUG=true npm run dev
   ```

### High Memory Usage

1. **Check current usage**:
   ```bash
   curl http://localhost:3000/api/health/ready | jq '.checks.memory'
   ```

2. **Analyze heap dump**:
   ```bash
   node --inspect app.js
   ```

3. **Review logs**:
   ```bash
   tail -f logs/combined.log | grep memory
   ```

### Alert Not Firing

1. **Test alert expression**:
   - Go to Prometheus UI
   - Run alert query manually
   - Check if it returns results

2. **Verify Alertmanager**:
   ```bash
   curl http://localhost:9093/api/v2/alerts
   ```

3. **Check alert rules**:
   ```bash
   promtool check rules monitoring/alerts/prometheus-rules.yaml
   ```

---

## Best Practices

### Logging
✅ Use structured logging (JSON)
✅ Include correlation IDs
✅ Redact sensitive data
❌ Never log passwords or tokens
❌ Don't log PII without consent

### Metrics
✅ Use labels wisely (low cardinality)
✅ Record both counters and histograms
✅ Sample high-volume traces (10%)
❌ Don't create unlimited label values
❌ Don't use high-cardinality labels (user IDs)

### Alerting
✅ Make alerts actionable
✅ Include runbook links
✅ Set appropriate thresholds
❌ Don't alert on everything
❌ Don't create noise

### Dashboards
✅ Focus on key metrics
✅ Use consistent time ranges
✅ Add descriptions to panels
❌ Don't overcomplicate
❌ Don't show too much data

---

## Support

- **Documentation**: https://docs.servicedesk.com
- **Runbooks**: https://docs.servicedesk.com/runbooks
- **Slack**: #servicedesk-engineering
- **PagerDuty**: https://yourcompany.pagerduty.com

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
