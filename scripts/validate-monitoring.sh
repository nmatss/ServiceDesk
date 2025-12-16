#!/bin/bash

# Monitoring Setup Validation Script
# This script validates that all monitoring components are properly configured

set -e

echo "🔍 Validating ServiceDesk Monitoring Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo "Error: Must run from project root directory"
    exit 1
fi

echo "📦 Checking Dependencies..."
echo "----------------------------"

# Check npm packages
if npm list prom-client >/dev/null 2>&1; then
    pass "prom-client installed"
else
    fail "prom-client not installed"
fi

if npm list winston >/dev/null 2>&1; then
    pass "winston installed"
else
    fail "winston not installed"
fi

if npm list @sentry/nextjs >/dev/null 2>&1; then
    pass "@sentry/nextjs installed"
else
    fail "@sentry/nextjs not installed"
fi

if npm list dd-trace >/dev/null 2>&1; then
    pass "dd-trace installed"
else
    fail "dd-trace not installed"
fi

echo ""
echo "📁 Checking Files..."
echo "----------------------------"

# Check monitoring files
files=(
    "lib/monitoring/metrics.ts"
    "lib/monitoring/structured-logger.ts"
    "lib/monitoring/index.ts"
    "lib/monitoring/sentry-helpers.ts"
    "lib/monitoring/datadog-config.ts"
    "lib/monitoring/datadog-tracer.ts"
    "lib/monitoring/datadog-metrics.ts"
    "lib/monitoring/observability.ts"
    "app/api/metrics/route.ts"
    "app/api/health/live/route.ts"
    "app/api/health/ready/route.ts"
    "app/api/health/startup/route.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        pass "$file exists"
    else
        fail "$file missing"
    fi
done

echo ""
echo "📊 Checking Configuration Files..."
echo "----------------------------"

# Check config files
if [ -f "monitoring/grafana/dashboards/application-overview.json" ]; then
    pass "Grafana application dashboard exists"
else
    fail "Grafana application dashboard missing"
fi

if [ -f "monitoring/grafana/dashboards/sla-metrics.json" ]; then
    pass "Grafana SLA dashboard exists"
else
    fail "Grafana SLA dashboard missing"
fi

if [ -f "monitoring/alerts/prometheus-rules.yaml" ]; then
    pass "Prometheus alert rules exist"
else
    fail "Prometheus alert rules missing"
fi

if [ -f "monitoring/alerts/pagerduty-integration.yaml" ]; then
    pass "PagerDuty integration config exists"
else
    fail "PagerDuty integration config missing"
fi

if [ -f "monitoring/alerts/slack-notifications.yaml" ]; then
    pass "Slack notification config exists"
else
    fail "Slack notification config missing"
fi

echo ""
echo "📚 Checking Documentation..."
echo "----------------------------"

if [ -f "MONITORING.md" ]; then
    pass "MONITORING.md exists"
else
    fail "MONITORING.md missing"
fi

if [ -f "MONITORING_SETUP.md" ]; then
    pass "MONITORING_SETUP.md exists"
else
    fail "MONITORING_SETUP.md missing"
fi

if [ -f "MONITORING_CHECKLIST.md" ]; then
    pass "MONITORING_CHECKLIST.md exists"
else
    fail "MONITORING_CHECKLIST.md missing"
fi

if [ -f ".env.monitoring.example" ]; then
    pass ".env.monitoring.example exists"
else
    fail ".env.monitoring.example missing"
fi

echo ""
echo "🔧 Checking Environment Variables..."
echo "----------------------------"

if [ -f ".env.local" ]; then
    pass ".env.local exists"

    # Check for important variables (optional)
    if grep -q "SENTRY_DSN" .env.local 2>/dev/null; then
        pass "SENTRY_DSN configured"
    else
        warn "SENTRY_DSN not set (optional)"
    fi

    if grep -q "DD_TRACE_ENABLED" .env.local 2>/dev/null; then
        pass "DD_TRACE_ENABLED configured"
    else
        warn "DD_TRACE_ENABLED not set (optional)"
    fi

    if grep -q "LOG_LEVEL" .env.local 2>/dev/null; then
        pass "LOG_LEVEL configured"
    else
        warn "LOG_LEVEL not set (will use default)"
    fi
else
    warn ".env.local not found (create from .env.monitoring.example)"
fi

echo ""
echo "🧪 Testing Endpoints (if server is running)..."
echo "----------------------------"

# Try to test endpoints (optional, don't fail if server isn't running)
if curl -s http://localhost:3000/api/health/live >/dev/null 2>&1; then
    pass "Server is running - /api/health/live responding"

    # Test other endpoints
    if curl -s http://localhost:3000/api/metrics >/dev/null 2>&1; then
        pass "/api/metrics endpoint responding"
    else
        fail "/api/metrics endpoint not responding"
    fi

    if curl -s http://localhost:3000/api/health/ready >/dev/null 2>&1; then
        pass "/api/health/ready endpoint responding"
    else
        fail "/api/health/ready endpoint not responding"
    fi

    if curl -s http://localhost:3000/api/health/startup >/dev/null 2>&1; then
        pass "/api/health/startup endpoint responding"
    else
        fail "/api/health/startup endpoint not responding"
    fi
else
    warn "Server not running - skipping endpoint tests (run 'npm run dev' to test)"
fi

echo ""
echo "============================="
echo "📊 Validation Summary"
echo "============================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Monitoring setup is complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy .env.monitoring.example to .env.local and configure"
    echo "2. Start the server: npm run dev"
    echo "3. Test endpoints: curl http://localhost:3000/api/metrics"
    echo "4. Set up Prometheus and Grafana (see MONITORING_SETUP.md)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Monitoring setup is incomplete${NC}"
    echo ""
    echo "Please fix the failed checks above."
    echo "See MONITORING_SETUP.md for detailed instructions."
    echo ""
    exit 1
fi
