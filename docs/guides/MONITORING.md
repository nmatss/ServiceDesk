# ServiceDesk Monitoring & Observability Guide

Complete guide for monitoring, logging, and observability infrastructure in the ServiceDesk application.

## Table of Contents

- [Overview](#overview)
- [Health Check Endpoints](#health-check-endpoints)
- [Metrics Collection](#metrics-collection)
- [Error Tracking](#error-tracking)
- [Performance Monitoring](#performance-monitoring)
- [Logging Infrastructure](#logging-infrastructure)
- [Alerting](#alerting)
- [Dashboard Access](#dashboard-access)
- [Troubleshooting](#troubleshooting)

---

## Overview

ServiceDesk implements comprehensive monitoring across multiple layers:

- **Health Checks**: Real-time system health status
- **Metrics**: Prometheus-compatible metrics for infrastructure and business KPIs
- **Error Tracking**: Sentry integration for error reporting and debugging
- **Performance Monitoring**: Web Vitals, API response times, and database query performance
- **Logging**: Structured logging with redaction for sensitive data
- **Distributed Tracing**: Datadog APM integration (optional)

---

## Health Check Endpoints

### Main Health Check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-25T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "ok",
      "message": "Database connection successful"
    },
    "observability": {
      "status": "healthy"
    }
  }
}
```

**Status Codes:**
- `200`: Healthy
- `503`: Unhealthy

### Automated Health Checks

Run the automated health check script:

```bash
# Check local development
npm run check:health

# Check production environment
npm run check:health:prod
```

---

## Metrics Collection

### Prometheus Metrics

**Endpoint:** `GET /api/metrics`

**Authentication:** Optional API key via `X-API-Key` header

**Available Metrics:**
- HTTP metrics (requests, duration, errors)
- Database metrics (queries, connections, slow queries)
- Authentication metrics (attempts, sessions, 2FA)
- Ticket metrics (created, resolved, SLA)
- Cache metrics (hits, misses, size)
- Business metrics (users, satisfaction)

---

## Error Tracking

ServiceDesk uses Sentry for comprehensive error tracking.

**Configuration Files:**
- Client: `sentry.client.config.ts`
- Server: `sentry.server.config.ts`
- Edge: `sentry.edge.config.ts`

---

## Performance Monitoring

### Web Vitals Tracking
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

### Lighthouse CI
```bash
npm run lighthouse:autorun
```

---

## Best Practices

1. Always use structured logging
2. Set appropriate metric labels
3. Handle errors gracefully
4. Monitor critical user journeys
5. Set up alerts for business metrics

---

**Last Updated:** 2025-12-25
**Version:** 1.0.0
