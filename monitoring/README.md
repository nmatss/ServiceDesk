# Monitoring Configuration Files

This directory contains all monitoring and observability configuration files for ServiceDesk.

## Directory Structure

```
monitoring/
├── README.md                           # This file
├── grafana/                            # Grafana dashboards
│   └── dashboards/
│       ├── application-overview.json   # Main application metrics
│       └── sla-metrics.json           # SLA and ticket metrics
└── alerts/                            # Alert configurations
    ├── prometheus-rules.yaml          # Prometheus alert rules
    ├── pagerduty-integration.yaml     # PagerDuty integration
    └── slack-notifications.yaml       # Slack notifications
```

## Grafana Dashboards

### Application Overview
**File**: `grafana/dashboards/application-overview.json`

Monitors:
- HTTP request rate and latency
- Error rates (4xx, 5xx)
- Database performance
- Memory and CPU usage
- Active users and tickets

**Import**:
1. Open Grafana UI
2. Go to Dashboards → Import
3. Upload `application-overview.json`

### SLA Metrics
**File**: `grafana/dashboards/sla-metrics.json`

Monitors:
- SLA compliance rates
- SLA breaches
- Response times by priority
- Ticket resolution times
- Ticket backlog trends

**Import**: Same process as above

## Alert Rules

### Prometheus Rules
**File**: `alerts/prometheus-rules.yaml`

Contains alert definitions for:
- Application health (error rates, response times)
- Database health (slow queries, connection issues)
- SLA monitoring (compliance, breaches)
- Infrastructure (CPU, memory)
- Authentication (failed attempts, brute force)
- Business metrics (ticket backlog)

**Load in Prometheus**:
```yaml
# prometheus.yml
rule_files:
  - "monitoring/alerts/prometheus-rules.yaml"
```

### PagerDuty Integration
**File**: `alerts/pagerduty-integration.yaml`

Alertmanager configuration for PagerDuty:
- Critical alerts → immediate page
- Warning alerts → notification
- Security alerts → dedicated service

**Setup**:
1. Create PagerDuty services
2. Get integration keys
3. Update service keys in YAML
4. Configure Alertmanager to use this file

### Slack Notifications
**File**: `alerts/slack-notifications.yaml`

Alertmanager configuration for Slack:
- Alert notifications to #servicedesk-alerts
- Business metrics to #servicedesk-metrics
- Security alerts to #servicedesk-security

**Setup**:
1. Create Slack incoming webhooks
2. Update webhook URLs in YAML
3. Configure channels

## Usage

### Testing Alert Rules

Validate Prometheus rules:
```bash
promtool check rules monitoring/alerts/prometheus-rules.yaml
```

### Testing Alertmanager Config

Validate Alertmanager config:
```bash
amtool check-config monitoring/alerts/pagerduty-integration.yaml
```

### Exporting Dashboards

To export a dashboard from Grafana:
1. Open dashboard in Grafana UI
2. Click Share icon
3. Select "Export"
4. Save JSON to `grafana/dashboards/`

### Importing Dashboards

Via UI:
1. Dashboards → Import
2. Upload JSON file or paste JSON

Via API:
```bash
curl -X POST \
  http://localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d @monitoring/grafana/dashboards/application-overview.json
```

## Customization

### Adding New Metrics

1. Define metric in `lib/monitoring/metrics.ts`
2. Add to dashboard JSON
3. Create alert rule if needed
4. Update documentation

### Modifying Alert Thresholds

Edit `alerts/prometheus-rules.yaml`:
```yaml
- alert: HighErrorRate
  expr: rate(errors[5m]) > 0.05  # Change threshold here
  for: 5m                        # Change duration here
```

### Adding New Dashboards

1. Create in Grafana UI
2. Export JSON
3. Save to `grafana/dashboards/`
4. Document in this README

## Documentation

- **Full Guide**: See [MONITORING.md](../MONITORING.md)
- **Setup Guide**: See [MONITORING_SETUP.md](../MONITORING_SETUP.md)
- **Environment Config**: See [.env.monitoring.example](../.env.monitoring.example)

## Support

For questions or issues:
- Check documentation in `MONITORING.md`
- Review runbooks (when created)
- Ask in #engineering Slack channel
