# Monitoring & Observability Guide

Complete guide to monitoring ServiceDesk in production.

## Monitoring Stack

- **APM**: Datadog
- **Errors**: Sentry
- **Metrics**: Prometheus
- **Dashboards**: Grafana
- **Logs**: Structured logging (Pino)

## Key Metrics

### Application Metrics

- **Request Rate**: req/s
- **Response Time**: p50, p95, p99
- **Error Rate**: errors/min
- **Uptime**: % availability

### Infrastructure Metrics

- **CPU Usage**: %
- **Memory Usage**: MB
- **Disk Usage**: GB
- **Network I/O**: Mbps

### Business Metrics

- **Tickets Created**: per hour/day
- **Resolution Time**: average
- **SLA Compliance**: %
- **User Satisfaction**: rating

## Dashboards

### Application Dashboard

- Request rate and latency
- Error rate trends
- API endpoint performance
- Database query performance

### Infrastructure Dashboard

- Server resource usage
- Container metrics
- Database performance
- Cache hit rate

### Business Dashboard

- Ticket volume trends
- Agent performance
- SLA compliance
- Customer satisfaction

## Alerts

### Critical Alerts

- **High Error Rate**: > 1% errors
- **Slow Response Time**: p95 > 500ms
- **Database Down**: connection failures
- **Disk Space Low**: < 10% free

### Warning Alerts

- **Elevated Response Time**: p95 > 200ms
- **Memory Usage High**: > 80%
- **Cache Miss Rate High**: > 30%

## Setup

### Sentry

```bash
# Install
npm install @sentry/nextjs

# Configure
SENTRY_DSN=your-dsn
```

### Datadog

```bash
# Install agent
DD_API_KEY=your-key DD_SITE=datadoghq.com bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

### Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'servicedesk'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

## Logging

### Log Levels

- **error**: Critical issues
- **warn**: Warning conditions
- **info**: Informational messages
- **debug**: Debug information

### Structured Logging

```typescript
import { logger } from '@/lib/monitoring/logger';

logger.info('Ticket created', {
  ticketId: ticket.id,
  userId: user.id
});
```

## Health Checks

Endpoint: `GET /api/health`

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "uptime": 3600
}
```

## Best Practices

1. Monitor key business metrics
2. Set up alerting for critical issues
3. Review dashboards daily
4. Investigate alerts promptly
5. Keep logs structured and searchable
