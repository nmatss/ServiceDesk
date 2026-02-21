# Monitoring Quick Reference Card

Quick reference for common monitoring tasks. Keep this handy!

---

## 🔗 Endpoints

```bash
# Prometheus metrics
http://localhost:3000/api/metrics

# Health checks
http://localhost:3000/api/health/live      # Liveness
http://localhost:3000/api/health/ready     # Readiness
http://localhost:3000/api/health/startup   # Startup
```

---

## 📊 Common Queries

### Prometheus Queries

```promql
# Request rate (requests/second)
rate(servicedesk_http_requests_total[5m])

# Error rate (%)
rate(servicedesk_http_requests_total{status_code=~"5.."}[5m])
  / rate(servicedesk_http_requests_total[5m]) * 100

# P95 response time
histogram_quantile(0.95, rate(servicedesk_http_request_duration_seconds_bucket[5m]))

# Active tickets
sum(servicedesk_tickets_active)

# SLA compliance rate
servicedesk_sla_compliance_rate

# Database slow queries
rate(servicedesk_db_slow_queries_total[5m])
```

---

## 💻 Code Examples

### Record Metrics

```typescript
import {
  recordHttpRequest,
  recordTicketCreated,
  recordSLABreach
} from '@/lib/monitoring/metrics';

// HTTP request
recordHttpRequest('GET', '/api/tickets', 200, 0.123);

// Ticket created
recordTicketCreated('high', 'bug', organizationId);

// SLA breach
recordSLABreach('critical', organizationId);
```

### Logging

```typescript
import { structuredLogger } from '@/lib/monitoring/structured-logger';

// Info log
structuredLogger.info('User logged in', { userId: 123 });

// Error log
structuredLogger.error('Database query failed', {
  error: error.message,
  query: 'SELECT ...'
});

// HTTP log
import { logHttpRequest } from '@/lib/monitoring/structured-logger';
logHttpRequest('GET', '/api/tickets', 200, 145);
```

### Error Tracking

```typescript
import { captureException } from '@/lib/monitoring/sentry-helpers';

try {
  await operation();
} catch (error) {
  captureException(error, {
    tags: { component: 'tickets' },
    extra: { ticketId: 123 }
  });
}
```

### API Route Observability

```typescript
import { withObservability } from '@/lib/monitoring/observability';

export const GET = withObservability(
  async (request) => {
    // Your code
    return NextResponse.json({ data });
  },
  { routeName: 'tickets.list', trackPerformance: true }
);
```

---

## 🔧 Environment Variables

```bash
# Minimal
LOG_LEVEL=info
LOG_CONSOLE=true

# Sentry (optional)
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_TRACES_SAMPLE_RATE=0.1

# Datadog (optional)
DD_TRACE_ENABLED=true
DD_SERVICE=servicedesk
DD_ENV=production
DD_TRACE_SAMPLE_RATE=0.1

# Metrics
METRICS_API_KEY=your-secure-key
```

---

## 🐛 Troubleshooting

### Metrics not showing

```bash
# 1. Check endpoint
curl http://localhost:3000/api/metrics

# 2. Verify Prometheus scraping
# Open http://localhost:9090/targets

# 3. Check logs
tail -f logs/combined.log | grep metric
```

### Sentry not working

```bash
# 1. Verify DSN
echo $SENTRY_DSN

# 2. Test error
curl http://localhost:3000/api/test-error

# 3. Enable debug
SENTRY_DEBUG=true npm run dev
```

### Logs not appearing

```bash
# 1. Check log level
echo $LOG_LEVEL

# 2. Check console output
LOG_CONSOLE=true npm run dev

# 3. Check log files
ls -lh logs/
tail -f logs/combined.log
```

### High memory usage

```bash
# 1. Check health endpoint
curl http://localhost:3000/api/health/ready | jq '.checks.memory'

# 2. Disable file logging temporarily
LOG_FILE=false npm run dev

# 3. Check Node.js heap
node --inspect app.js
```

---

## 🎯 Common Tasks

### Start monitoring locally

```bash
# 1. Configure environment
cp .env.monitoring.example .env.local
# Edit .env.local

# 2. Start app
npm run dev

# 3. Verify
curl http://localhost:3000/api/metrics
```

### Import Grafana dashboards

```bash
# 1. Open Grafana (http://localhost:3000)
# 2. Go to Dashboards → Import
# 3. Upload file from monitoring/grafana/dashboards/
```

### Test alerts

```bash
# Generate traffic to trigger HighErrorRate alert
for i in {1..100}; do
  curl http://localhost:3000/api/nonexistent
done

# Check Prometheus alerts
# Open http://localhost:9090/alerts
```

### Validate setup

```bash
bash scripts/validate-monitoring.sh
```

---

## 📈 Key Metrics to Watch

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | >5% | Investigate immediately |
| P95 response time | >500ms | Optimize slow endpoints |
| SLA compliance | <95% | Review SLA policies |
| Memory usage | >80% | Check for memory leaks |
| DB slow queries | >10/sec | Optimize queries |
| Auth failures | >20% | Check security |

---

## 🚨 Alert Severity

| Severity | Response | Examples |
|----------|----------|----------|
| Critical | Page on-call | App down, high error rate |
| Warning | Slack notification | Slow response, high memory |
| Info | Log only | Ticket backlog growing |

---

## 📚 Documentation Links

| Document | Purpose |
|----------|---------|
| [MONITORING.md](./MONITORING.md) | Complete guide |
| [MONITORING_SETUP.md](./MONITORING_SETUP.md) | Setup instructions |
| [MONITORING_CHECKLIST.md](./MONITORING_CHECKLIST.md) | Implementation checklist |
| [.env.monitoring.example](./.env.monitoring.example) | Config template |

---

## 🔗 External Tools

| Tool | URL | Purpose |
|------|-----|---------|
| Prometheus | http://localhost:9090 | Metrics & alerts |
| Grafana | http://localhost:3000 | Dashboards |
| Sentry | https://sentry.io | Error tracking |
| Datadog | https://app.datadoghq.com | APM & tracing |

---

## 💡 Pro Tips

1. **Sample in production**: Set `SENTRY_TRACES_SAMPLE_RATE=0.1` (10%)
2. **Use correlation IDs**: Always include in logs for tracing
3. **Monitor dashboards**: Check daily for anomalies
4. **Review alerts weekly**: Adjust thresholds to reduce noise
5. **Document incidents**: Create runbooks for common issues

---

## 📞 Getting Help

1. Check this quick reference
2. Read full docs in `MONITORING.md`
3. Ask in #engineering Slack
4. Create GitHub issue

---

**Last Updated**: October 18, 2025
**Version**: 1.0.0

Print this and keep it near your desk! 🖨️
