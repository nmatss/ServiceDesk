# Monitoring Implementation Checklist

Use this checklist to verify your monitoring setup is complete.

## ✅ Installation

- [x] Install `prom-client` package
- [x] Install `winston` package  
- [x] Install `pino` and `pino-pretty` packages
- [x] Verify `@sentry/nextjs` is installed
- [x] Verify `dd-trace` is installed

## ✅ Configuration Files

- [x] Created `lib/monitoring/metrics.ts` - Prometheus metrics
- [x] Created `lib/monitoring/structured-logger.ts` - Winston logger
- [x] Created `lib/monitoring/index.ts` - Main export
- [x] Created `app/api/metrics/route.ts` - Metrics endpoint
- [x] Created `app/api/health/live/route.ts` - Liveness probe
- [x] Created `app/api/health/ready/route.ts` - Readiness probe
- [x] Created `app/api/health/startup/route.ts` - Startup probe
- [x] Created `instrumentation.ts` - Application instrumentation
- [x] Sentry configuration exists in `sentry.*.config.ts`
- [x] Datadog configuration exists in `lib/monitoring/datadog-*.ts`

## ✅ Dashboards

- [x] Created `monitoring/grafana/dashboards/application-overview.json`
- [x] Created `monitoring/grafana/dashboards/sla-metrics.json`

## ✅ Alerts

- [x] Created `monitoring/alerts/prometheus-rules.yaml`
- [x] Created `monitoring/alerts/pagerduty-integration.yaml`
- [x] Created `monitoring/alerts/slack-notifications.yaml`

## ✅ Documentation

- [x] Created `MONITORING.md` - Full documentation
- [x] Created `MONITORING_SETUP.md` - Setup guide
- [x] Created `.env.monitoring.example` - Environment template
- [x] Created `monitoring/README.md` - Directory documentation

## 🔧 Setup Tasks

### Environment Variables

- [ ] Copy `.env.monitoring.example` to `.env.local`
- [ ] Configure Sentry DSN
- [ ] Configure Datadog settings (if using)
- [ ] Set log levels
- [ ] Configure PagerDuty keys (if using)
- [ ] Configure Slack webhooks (if using)

### Prometheus

- [ ] Install Prometheus
- [ ] Create `prometheus.yml` config
- [ ] Start Prometheus server
- [ ] Verify scraping at http://localhost:9090/targets
- [ ] Test queries in Prometheus UI

### Grafana

- [ ] Install Grafana
- [ ] Start Grafana server
- [ ] Add Prometheus data source
- [ ] Import `application-overview.json` dashboard
- [ ] Import `sla-metrics.json` dashboard
- [ ] Verify dashboards show data

### Sentry

- [ ] Create Sentry account
- [ ] Create project for ServiceDesk
- [ ] Copy DSN to environment variables
- [ ] Test error tracking
- [ ] Verify errors appear in Sentry UI

### Datadog (Optional)

- [ ] Create Datadog account
- [ ] Install Datadog agent
- [ ] Configure APM in agent
- [ ] Enable DD_TRACE_ENABLED in environment
- [ ] Verify traces in Datadog UI

### Alerting

- [ ] Install Alertmanager
- [ ] Configure alert routing
- [ ] Set up PagerDuty integration (if using)
- [ ] Set up Slack integration (if using)
- [ ] Test alert firing

## 🧪 Testing

### Endpoints

- [ ] Test `/api/metrics` returns Prometheus metrics
- [ ] Test `/api/health/live` returns 200 OK
- [ ] Test `/api/health/ready` returns health status
- [ ] Test `/api/health/startup` returns startup status

### Metrics

- [ ] Generate traffic to application
- [ ] Verify metrics appear in Prometheus
- [ ] Verify metrics increment correctly
- [ ] Check metric labels are correct

### Logging

- [ ] Check logs appear in console (development)
- [ ] Check logs written to files (production)
- [ ] Verify JSON format in production
- [ ] Verify sensitive data is redacted
- [ ] Test correlation IDs appear

### Error Tracking

- [ ] Trigger test error
- [ ] Verify error appears in Sentry
- [ ] Check error context is correct
- [ ] Verify source maps work (production)
- [ ] Test breadcrumbs capture

### Tracing

- [ ] Enable Datadog tracing
- [ ] Generate API requests
- [ ] Verify traces appear in Datadog
- [ ] Check spans are created correctly
- [ ] Verify tags are set

### Alerts

- [ ] Trigger test alert
- [ ] Verify alert fires in Prometheus
- [ ] Check Alertmanager routes correctly
- [ ] Test PagerDuty notification (if configured)
- [ ] Test Slack notification (if configured)

## 📊 Production Deployment

### Pre-deployment

- [ ] Review all thresholds and adjust for production
- [ ] Set sample rates appropriately (10% recommended)
- [ ] Configure log retention policies
- [ ] Set up log rotation
- [ ] Document runbooks for common alerts
- [ ] Train team on monitoring tools

### Deployment

- [ ] Deploy with health checks configured
- [ ] Verify Kubernetes probes work
- [ ] Monitor deployment for issues
- [ ] Check all metrics are being collected
- [ ] Verify alerts are firing correctly

### Post-deployment

- [ ] Monitor for 24 hours
- [ ] Adjust alert thresholds if needed
- [ ] Review dashboard accuracy
- [ ] Check for missing metrics
- [ ] Gather team feedback

## 📚 Training

- [ ] Document common monitoring tasks
- [ ] Create runbooks for alerts
- [ ] Train team on Grafana dashboards
- [ ] Train team on Sentry error investigation
- [ ] Train team on alert response procedures
- [ ] Schedule regular monitoring reviews

## 🔄 Ongoing Maintenance

- [ ] Weekly: Review alert noise, adjust thresholds
- [ ] Monthly: Review dashboard relevance
- [ ] Quarterly: Review and update runbooks
- [ ] Quarterly: Audit metric usage and costs
- [ ] Annually: Review entire observability stack

## ✅ Sign-off

- [ ] Development team approves setup
- [ ] Operations team approves setup
- [ ] Security team reviews sensitive data handling
- [ ] Documentation is complete and accessible
- [ ] Team is trained and ready

---

**Checklist completed**: _______________ (Date)  
**Reviewed by**: _______________ (Name)  
**Production ready**: ☐ Yes ☐ No
