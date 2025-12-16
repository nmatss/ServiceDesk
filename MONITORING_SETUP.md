# Monitoring Setup Guide

Quick start guide to get monitoring and observability up and running.

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies

All monitoring packages are already installed. Verify with:

```bash
npm list prom-client winston dd-trace @sentry/nextjs
```

### 2. Configure Environment Variables

Copy the monitoring environment template:

```bash
cp .env.monitoring.example .env.local
```

Edit `.env.local` and configure at minimum:

```bash
# Sentry (optional but recommended)
SENTRY_DSN=your-sentry-dsn-here

# Datadog (optional)
DD_TRACE_ENABLED=false  # Set to true if using Datadog

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
```

### 3. Start the Application

```bash
npm run dev
```

### 4. Verify Monitoring Endpoints

Check that all endpoints are working:

```bash
# Metrics (Prometheus)
curl http://localhost:3000/api/metrics

# Health checks
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
curl http://localhost:3000/api/health/startup
```

✅ If all endpoints return data, monitoring is working!

---

## 📊 Setting Up Prometheus (Local Development)

### 1. Install Prometheus

**macOS:**
```bash
brew install prometheus
```

**Linux:**
```bash
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvf prometheus-*.tar.gz
cd prometheus-*
```

### 2. Create Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'servicedesk'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

### 3. Start Prometheus

```bash
./prometheus --config.file=prometheus.yml
```

### 4. Access Prometheus UI

Open http://localhost:9090

Try queries like:
- `servicedesk_http_requests_total`
- `rate(servicedesk_http_requests_total[5m])`

---

## 📈 Setting Up Grafana

### 1. Install Grafana

**macOS:**
```bash
brew install grafana
brew services start grafana
```

**Linux:**
```bash
sudo apt-get install -y grafana
sudo systemctl start grafana-server
```

### 2. Access Grafana

Open http://localhost:3000 (default: admin/admin)

### 3. Add Prometheus Data Source

1. Go to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Set URL to `http://localhost:9090`
5. Click **Save & Test**

### 4. Import Dashboards

1. Go to **Dashboards** → **Import**
2. Upload files from `monitoring/grafana/dashboards/`:
   - `application-overview.json`
   - `sla-metrics.json`

---

## 🐛 Setting Up Sentry

### 1. Create Sentry Account

Go to https://sentry.io and create an account (free tier available)

### 2. Create Project

1. Click **Create Project**
2. Select **Next.js**
3. Name it "ServiceDesk"
4. Copy the DSN

### 3. Configure Environment

Add to `.env.local`:

```bash
SENTRY_DSN=your-dsn-here
SENTRY_ENVIRONMENT=development
```

### 4. Test Error Tracking

Create a test error:

```typescript
import { captureException } from '@/lib/monitoring/sentry-helpers';

try {
  throw new Error('Test error for Sentry');
} catch (error) {
  captureException(error);
}
```

Check https://sentry.io to see the error appear!

---

## 🐕 Setting Up Datadog (Optional)

### 1. Create Datadog Account

Go to https://www.datadoghq.com and sign up

### 2. Install Datadog Agent

**macOS:**
```bash
DD_API_KEY=your-api-key DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_mac_os.sh)"
```

**Linux:**
```bash
DD_API_KEY=your-api-key DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

### 3. Enable APM

Edit `/opt/datadog-agent/etc/datadog.yaml`:

```yaml
apm_config:
  enabled: true
```

Restart agent:
```bash
# macOS
launchctl stop com.datadoghq.agent
launchctl start com.datadoghq.agent

# Linux
sudo service datadog-agent restart
```

### 4. Configure Application

Add to `.env.local`:

```bash
DD_TRACE_ENABLED=true
DD_SERVICE=servicedesk
DD_ENV=development
DD_VERSION=1.0.0
```

### 5. Verify

Check https://app.datadoghq.com/apm/home

---

## 🔔 Setting Up Alerts

### 1. Install Alertmanager

```bash
wget https://github.com/prometheus/alertmanager/releases/download/v0.26.0/alertmanager-0.26.0.linux-amd64.tar.gz
tar xvf alertmanager-*.tar.gz
cd alertmanager-*
```

### 2. Configure Prometheus to Use Alert Rules

Add to `prometheus.yml`:

```yaml
rule_files:
  - 'monitoring/alerts/prometheus-rules.yaml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```

### 3. Start Alertmanager

```bash
./alertmanager --config.file=monitoring/alerts/pagerduty-integration.yaml
```

### 4. Configure PagerDuty (Optional)

1. Create account at https://www.pagerduty.com
2. Create service
3. Get integration key
4. Update `monitoring/alerts/pagerduty-integration.yaml`

### 5. Configure Slack (Recommended)

1. Create Slack app: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Create webhook URL
4. Update `monitoring/alerts/slack-notifications.yaml`

---

## 🧪 Testing Your Setup

### Test Metrics

```bash
# Generate some traffic
for i in {1..100}; do
  curl http://localhost:3000/api/health/live
done

# Check metrics
curl http://localhost:3000/api/metrics | grep servicedesk_http_requests_total
```

### Test Logging

Check logs directory:

```bash
tail -f logs/combined.log
tail -f logs/error.log
```

### Test Error Tracking

Trigger a test error and check Sentry:

```bash
curl http://localhost:3000/api/test-error
```

### Test Alerts

Trigger an alert by generating errors:

```bash
# Generate errors to trigger HighErrorRate alert
for i in {1..100}; do
  curl http://localhost:3000/api/nonexistent
done
```

Check Prometheus UI → Alerts

---

## 🎯 Production Deployment

### Kubernetes

Deploy with health checks:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: servicedesk
spec:
  template:
    spec:
      containers:
        - name: servicedesk
          image: servicedesk:latest
          ports:
            - containerPort: 3000

          # Liveness probe
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10

          # Readiness probe
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5

          # Startup probe
          startupProbe:
            httpGet:
              path: /api/health/startup
              port: 3000
            periodSeconds: 10
            failureThreshold: 30

          env:
            - name: SENTRY_DSN
              valueFrom:
                secretKeyRef:
                  name: servicedesk-secrets
                  key: sentry-dsn
            - name: DD_TRACE_ENABLED
              value: "true"
            - name: LOG_LEVEL
              value: "info"
```

### Docker

Add to `Dockerfile`:

```dockerfile
# Install monitoring dependencies
RUN npm ci --production

# Expose metrics port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD curl -f http://localhost:3000/api/health/live || exit 1
```

### Environment Variables

Production `.env.production`:

```bash
# Monitoring
SENTRY_DSN=your-production-dsn
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

DD_TRACE_ENABLED=true
DD_ENV=production
DD_TRACE_SAMPLE_RATE=0.1

LOG_LEVEL=info
LOG_CONSOLE=false
LOG_FILE=true
```

---

## 📚 Next Steps

1. **Read Full Documentation**: See [MONITORING.md](./MONITORING.md)
2. **Customize Dashboards**: Modify Grafana dashboards for your needs
3. **Configure Alerts**: Adjust alert thresholds in `monitoring/alerts/`
4. **Set Up Runbooks**: Create incident response guides
5. **Train Team**: Ensure everyone knows how to use monitoring tools

---

## ❓ Troubleshooting

### Metrics Not Showing

```bash
# Check endpoint
curl http://localhost:3000/api/metrics

# Check Prometheus targets
open http://localhost:9090/targets
```

### Sentry Not Working

```bash
# Verify DSN
echo $SENTRY_DSN

# Enable debug mode
SENTRY_DEBUG=true npm run dev
```

### Datadog Not Tracing

```bash
# Check agent status
sudo service datadog-agent status

# Enable debug
DD_TRACE_DEBUG=true npm run dev
```

### High Memory Usage

```bash
# Check health
curl http://localhost:3000/api/health/ready | jq '.checks.memory'

# Reduce log retention
LOG_FILE=false npm run dev
```

---

## 🆘 Support

- **Documentation**: See [MONITORING.md](./MONITORING.md)
- **Issues**: Create GitHub issue
- **Questions**: Ask in #engineering Slack channel

---

**Happy Monitoring! 📊🔍🐛**
