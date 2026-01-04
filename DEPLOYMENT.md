# Production Deployment Checklist

## Overview

This document provides a comprehensive checklist for deploying the ServiceDesk application to production. Follow these steps sequentially to ensure a smooth, secure, and performant deployment.

**Last Updated**: December 25, 2025
**Target Environment**: Production
**Deployment Strategy**: Blue-Green with health checks

---

## Pre-Deployment Checklist

### 1. Code Quality & Testing

#### Build Validation
- [ ] `npm run build` completes successfully
  ```bash
  npm run build
  # Expected: ✓ Compiled successfully
  ```

- [ ] No TypeScript errors
  ```bash
  npm run type-check
  # Expected: No errors reported
  ```

- [ ] ESLint passes (or warnings only)
  ```bash
  npm run lint
  # Expected: ✓ No ESLint errors
  ```

- [ ] Bundle size within acceptable limits
  ```bash
  ANALYZE=true npm run build
  # Expected: Client bundle < 300KB gzipped
  ```

#### Testing
- [ ] Unit tests pass (if implemented)
  ```bash
  npm run test
  # Expected: All tests passing
  ```

- [ ] Integration tests pass
  ```bash
  npm run test:integration
  # Expected: All integration tests passing
  ```

- [ ] End-to-end tests pass
  ```bash
  npm run test:e2e
  # Expected: All critical user flows working
  ```

#### Performance Validation
- [ ] Lighthouse score ≥ 90 (desktop)
  ```bash
  npm run lighthouse:ci
  # Expected: Performance ≥ 90/100
  ```

- [ ] Lighthouse score ≥ 85 (mobile)
  ```bash
  npm run lighthouse:ci -- --preset=mobile
  # Expected: Performance ≥ 85/100
  ```

- [ ] Core Web Vitals in "Good" range
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1

---

### 2. Environment Configuration

#### Required Environment Variables

**Authentication & Security**
- [ ] `JWT_SECRET` - Strong random secret (min 32 chars)
  ```bash
  # Generate with:
  openssl rand -base64 32
  ```

- [ ] `SESSION_SECRET` - Strong random secret (min 32 chars)
  ```bash
  # Generate with:
  openssl rand -base64 32
  ```

- [ ] `NEXTAUTH_URL` - Production app URL
  ```env
  NEXTAUTH_URL=https://app.servicedesk.com
  ```

- [ ] `NEXTAUTH_SECRET` - Production secret
  ```bash
  # Generate with:
  openssl rand -base64 32
  ```

**Database**
- [ ] `DATABASE_URL` - Production database connection string
  ```env
  # PostgreSQL (recommended for production)
  DATABASE_URL=postgresql://user:pass@host:5432/servicedesk?ssl=true

  # Or SQLite (development/small deployments)
  DATABASE_URL=file:./servicedesk.db
  ```

**Application**
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_APP_URL` - Public app URL
  ```env
  NEXT_PUBLIC_APP_URL=https://app.servicedesk.com
  ```

**Email (if enabled)**
- [ ] `SMTP_HOST` - Email server host
- [ ] `SMTP_PORT` - Email server port (587/465)
- [ ] `SMTP_USER` - SMTP username
- [ ] `SMTP_PASSWORD` - SMTP password
- [ ] `SMTP_FROM` - From email address

**Monitoring & Error Tracking**
- [ ] `SENTRY_DSN` - Sentry error tracking URL
- [ ] `SENTRY_ORG` - Sentry organization slug
- [ ] `SENTRY_PROJECT` - Sentry project slug
- [ ] `SENTRY_AUTH_TOKEN` - Sentry authentication token
- [ ] `SENTRY_UPLOAD_SOURCEMAPS=true` - Enable source map upload

**AI Features (optional)**
- [ ] `OPENAI_API_KEY` - OpenAI API key (if using AI features)

**Verify All Variables**
```bash
npm run env:validate
# Expected: ✅ Environment validation passed!
```

---

### 3. Database Setup

#### Migration Strategy

**If using PostgreSQL (recommended):**
- [ ] Database created and accessible
- [ ] Run schema migrations
  ```bash
  npm run db:migrate:prod
  ```

- [ ] Verify database connectivity
  ```bash
  npm run test-db
  # Expected: ✓ Database connection successful
  ```

- [ ] Seed initial data (admin user, statuses, priorities, etc.)
  ```bash
  npm run db:seed:prod
  ```

**If using SQLite:**
- [ ] Initialize database with schema
  ```bash
  npm run init-db
  ```

- [ ] Backup mechanism configured
  ```bash
  # Set up daily backups
  crontab -e
  # 0 2 * * * cp /path/to/servicedesk.db /path/to/backups/servicedesk-$(date +\%Y\%m\%d).db
  ```

#### Database Performance
- [ ] All 10 critical indexes created (auto-created by schema)
- [ ] WAL mode enabled (SQLite)
- [ ] Connection pooling configured (PostgreSQL)

---

### 4. Security Hardening

#### Secrets Management
- [ ] All secrets stored securely (not in code)
- [ ] Environment variables loaded from secure vault
- [ ] No hardcoded credentials in codebase
- [ ] `.env` files excluded from git (in `.gitignore`)

#### HTTP Security Headers
All configured in `next.config.js` - verify:
- [ ] `Strict-Transport-Security` (HSTS)
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Security-Policy` (CSP)

#### SSL/TLS
- [ ] HTTPS enabled (required for production)
- [ ] SSL certificate valid and not expiring soon
- [ ] Redirect HTTP → HTTPS configured
- [ ] HSTS header enabled (configured in next.config.js)

#### Authentication
- [ ] Strong JWT secret configured
- [ ] Password hashing (bcrypt) enabled
- [ ] Session expiration configured
- [ ] CSRF protection enabled

---

### 5. Performance Optimization

#### Caching
- [ ] API route caching headers configured
  ```bash
  # Verify in next.config.js:
  # - Static lookups: 30 min cache
  # - Knowledge Base: 10 min cache
  # - Analytics: 5 min cache
  ```

- [ ] Static asset caching (1 year)
- [ ] CDN configured (optional but recommended)

#### Compression
- [ ] HTTP compression enabled in `server.ts`
  ```bash
  # Verify compression middleware:
  curl -I https://your-app.com | grep -i content-encoding
  # Expected: content-encoding: gzip
  ```

#### Database
- [ ] All indexes created and verified
- [ ] Query performance tested
- [ ] Connection pooling configured

---

### 6. Monitoring & Logging

#### Error Tracking
- [ ] Sentry configured and tested
  ```bash
  # Test Sentry integration:
  curl -X POST https://your-app.com/api/test-sentry
  # Check Sentry dashboard for error
  ```

#### Performance Monitoring
- [ ] Real User Monitoring (RUM) enabled
- [ ] Server performance monitoring
- [ ] Database query monitoring

#### Logging
- [ ] Application logs configured
- [ ] Log rotation enabled
- [ ] Log aggregation setup (optional)

#### Health Checks
- [ ] Health check endpoint functional
  ```bash
  curl https://your-app.com/api/health
  # Expected: {"status":"healthy","timestamp":"..."}
  ```

---

## Deployment Steps

### Step 1: Pre-Deploy Verification

```bash
# 1. Pull latest code
git checkout main
git pull origin main

# 2. Install dependencies
npm ci --legacy-peer-deps

# 3. Validate environment
npm run env:validate

# 4. Build application
npm run build

# 5. Run tests
npm run test
npm run lighthouse:ci
```

**Expected**: All checks pass ✅

---

### Step 2: Database Migration (if applicable)

```bash
# Backup current database
npm run db:backup

# Run migrations
npm run db:migrate:prod

# Verify migrations
npm run test-db
```

**Expected**: Database ready ✅

---

### Step 3: Deploy Application

#### Option A: Docker Deployment

```bash
# 1. Build Docker image
docker build -t servicedesk:latest .

# 2. Tag for registry
docker tag servicedesk:latest registry.example.com/servicedesk:latest

# 3. Push to registry
docker push registry.example.com/servicedesk:latest

# 4. Deploy to production
kubectl apply -f k8s/production.yaml

# 5. Verify deployment
kubectl get pods -n production
kubectl logs -f deployment/servicedesk -n production
```

#### Option B: Node.js Server Deployment

```bash
# 1. Build production bundle
npm run build

# 2. Copy files to production server
rsync -avz --exclude node_modules ./ user@server:/var/www/servicedesk/

# 3. SSH to server
ssh user@server

# 4. Install dependencies
cd /var/www/servicedesk
npm ci --production --legacy-peer-deps

# 5. Start with PM2
pm2 start server.ts --name servicedesk --instances max

# 6. Save PM2 configuration
pm2 save
pm2 startup
```

#### Option C: Vercel/Netlify Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy to production
vercel --prod

# 3. Verify deployment
vercel ls
```

---

### Step 4: Post-Deploy Verification

#### Smoke Tests

```bash
# 1. Health check
curl https://your-app.com/api/health
# Expected: {"status":"healthy"}

# 2. Authentication works
curl -X POST https://your-app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"***"}'
# Expected: JWT token returned

# 3. Database connectivity
curl https://your-app.com/api/statuses
# Expected: List of statuses

# 4. Real-time (WebSocket)
# Open browser console:
# new WebSocket('wss://your-app.com/socket.io')
# Expected: Connection established
```

#### User Flow Tests

- [ ] User can log in
- [ ] User can create a ticket
- [ ] User can view ticket details
- [ ] User can search knowledge base
- [ ] Admin can access dashboard
- [ ] Mobile site loads correctly

#### Performance Tests

```bash
# Run Lighthouse on production
npm run lighthouse:ci -- --url=https://your-app.com

# Expected:
# - Performance ≥ 90/100
# - Accessibility ≥ 90/100
# - Best Practices ≥ 90/100
```

#### Monitoring Verification

- [ ] Errors appear in Sentry
- [ ] Performance metrics in monitoring dashboard
- [ ] Logs are being collected

---

### Step 5: Rollback Plan

If issues are detected:

```bash
# Option 1: Revert deployment (Docker/K8s)
kubectl rollout undo deployment/servicedesk -n production

# Option 2: Restore previous version (PM2)
pm2 delete servicedesk
git checkout <previous-commit>
npm ci --production --legacy-peer-deps
npm run build
pm2 start server.ts --name servicedesk --instances max

# Option 3: Database rollback
npm run db:rollback
```

---

## Production Operations

### Daily Monitoring

**Metrics to Watch:**
- Response time (p50, p95, p99)
- Error rate
- Database performance
- Memory/CPU usage
- Active users

**Alerts to Configure:**
- Error rate > 1%
- Response time p95 > 500ms
- Database queries > 200ms
- Memory usage > 80%
- Disk usage > 85%

### Weekly Maintenance

- [ ] Review error logs in Sentry
- [ ] Check database growth
- [ ] Verify backup completion
- [ ] Review performance metrics
- [ ] Update dependencies (security patches)

### Monthly Tasks

- [ ] Full security audit
- [ ] Performance testing
- [ ] Database optimization
- [ ] Review and archive old logs
- [ ] Update SSL certificates (if expiring)

---

## Scaling Considerations

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Current recommendation: 2 vCPU, 4 GB RAM (baseline)
- Monitor: Scale up when CPU > 70% consistently

### Horizontal Scaling
- Deploy multiple instances behind load balancer
- Enable session sticky sessions (or use Redis)
- Database connection pooling

### Database Scaling
- Move from SQLite to PostgreSQL (if not already)
- Enable read replicas for heavy read workloads
- Consider database sharding for very large datasets

---

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm ci --legacy-peer-deps
npm run build
```

#### Database Connection Issues
```bash
# Test connectivity
npm run test-db

# Check environment variables
npm run env:validate
```

#### Performance Degradation
```bash
# Check server resources
pm2 monit

# Review slow queries
npm run db:analyze

# Clear caches
curl -X POST https://your-app.com/api/admin/cache/clear
```

#### Memory Leaks
```bash
# Restart application
pm2 restart servicedesk

# Enable memory monitoring
pm2 install pm2-logrotate
```

---

## Security Incident Response

### If Breach Suspected:

1. **Isolate**: Take affected systems offline
2. **Investigate**: Review logs and access patterns
3. **Contain**: Revoke compromised credentials
4. **Eradicate**: Patch vulnerabilities
5. **Recover**: Restore from clean backups
6. **Report**: Document and report to stakeholders

### Security Contacts:
- Security Team: security@example.com
- On-Call: +1-555-SECURITY

---

## Documentation & Support

### Internal Documentation
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Database Schema](./lib/db/schema.sql)
- [Performance Metrics](./PERFORMANCE.md)

### External Resources
- Next.js Docs: https://nextjs.org/docs
- TypeScript Docs: https://www.typescriptlang.org/docs
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices

### Support Channels
- Internal Slack: #servicedesk-support
- Email: support@example.com
- On-Call: Configured in PagerDuty

---

## Appendix

### A. Environment Variable Template

```env
# ======================
# PRODUCTION ENVIRONMENT
# ======================

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.servicedesk.com
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/servicedesk?ssl=true

# Authentication
JWT_SECRET=<STRONG_RANDOM_SECRET_32_CHARS>
SESSION_SECRET=<STRONG_RANDOM_SECRET_32_CHARS>
NEXTAUTH_URL=https://app.servicedesk.com
NEXTAUTH_SECRET=<STRONG_RANDOM_SECRET>

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@servicedesk.com
SMTP_PASSWORD=<EMAIL_PASSWORD>
SMTP_FROM=ServiceDesk <noreply@servicedesk.com>

# Monitoring
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=servicedesk
SENTRY_AUTH_TOKEN=<SENTRY_TOKEN>
SENTRY_UPLOAD_SOURCEMAPS=true

# AI (Optional)
OPENAI_API_KEY=<OPENAI_KEY>
```

### B. Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
  })
}
```

### C. PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'servicedesk',
    script: './server.ts',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
  }]
}
```

---

**Document Version**: 2.0
**Last Review**: December 25, 2025
**Next Review**: January 25, 2026
**Maintained by**: DevOps Team
