# Production Deployment Checklist

Complete checklist for deploying ServiceDesk to production.

## Pre-Deployment

### Infrastructure

- [ ] Kubernetes cluster provisioned (1.24+) or Docker Swarm setup
- [ ] PostgreSQL database (16+) configured with replication
- [ ] Redis cluster (7+) for caching and sessions
- [ ] Load balancer configured (ALB, NLB, or NGINX)
- [ ] CDN configured for static assets (Cloudflare, CloudFront)
- [ ] Domain name configured with DNS
- [ ] SSL/TLS certificates obtained (Let's Encrypt or commercial)
- [ ] Firewall rules configured
- [ ] Backup storage configured (S3, GCS, Azure Blob)

### Security

- [ ] All secrets generated securely (`openssl rand -hex 32`)
- [ ] JWT_SECRET set (min 32 characters)
- [ ] SESSION_SECRET set (min 32 characters)
- [ ] Database passwords rotated
- [ ] Redis password set
- [ ] 2FA enforced for admin users
- [ ] Rate limiting configured
- [ ] CORS origins properly configured
- [ ] CSP headers configured
- [ ] Security headers enabled (Helmet.js)
- [ ] Secrets encrypted at rest
- [ ] SSL/TLS certificates valid
- [ ] Vulnerability scanning completed

### Monitoring

- [ ] Sentry configured for error tracking
- [ ] Datadog APM configured (or equivalent)
- [ ] Prometheus metrics endpoint exposed
- [ ] Grafana dashboards imported
- [ ] Health check endpoint functional
- [ ] Logging configured (CloudWatch, Stackdriver)
- [ ] Alerting rules configured
- [ ] On-call rotation defined

### Database

- [ ] PostgreSQL connection tested
- [ ] Database migrations run successfully
- [ ] Database backups configured (automated daily)
- [ ] Point-in-time recovery enabled
- [ ] Connection pooling configured
- [ ] Query performance tested
- [ ] Indexes created for common queries
- [ ] Backup restoration tested

### Application

- [ ] Environment variables validated
- [ ] Email provider configured (SendGrid, SES, SMTP)
- [ ] File storage configured (S3, GCS, Azure)
- [ ] Redis connection tested
- [ ] Build completed without errors
- [ ] Type checking passed
- [ ] Linting passed
- [ ] All tests passing (unit, e2e, security)
- [ ] Performance testing completed
- [ ] Load testing completed
- [ ] Security audit completed

### Compliance

- [ ] LGPD/GDPR compliance verified
- [ ] Data retention policies configured
- [ ] Audit logging enabled
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Cookie consent implemented
- [ ] Data processing agreement signed

## Deployment

### Pre-Deployment

- [ ] Changelog updated
- [ ] Documentation updated
- [ ] Release notes prepared
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled
- [ ] Rollback plan documented
- [ ] Team briefed on deployment

### Deployment Steps

1. **Database Migration**
   ```bash
   npm run migrate:status
   npm run migrate:run
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Deploy to Staging**
   ```bash
   kubectl apply -k k8s/overlays/staging
   ```

4. **Smoke Tests on Staging**
   - [ ] Application loads
   - [ ] Login works
   - [ ] Create ticket works
   - [ ] Database connection works
   - [ ] Redis connection works
   - [ ] Email sending works
   - [ ] File uploads work

5. **Deploy to Production**
   ```bash
   kubectl apply -k k8s/overlays/production
   ```

6. **Monitor Deployment**
   ```bash
   kubectl rollout status deployment/servicedesk-app -n servicedesk
   ```

### Post-Deployment

- [ ] Application accessible
- [ ] Health checks passing
- [ ] Metrics being collected
- [ ] No error spikes in Sentry
- [ ] Database connections stable
- [ ] Response times acceptable (<100ms p95)
- [ ] No memory leaks observed
- [ ] Logs showing normal activity
- [ ] All critical paths tested
- [ ] Stakeholders notified of completion

## Performance Benchmarks

### Target Metrics

- **Availability**: 99.9% uptime
- **Response Time**: <100ms (p95)
- **Throughput**: 1000 req/s
- **Database Query Time**: <50ms (p95)
- **Error Rate**: <0.1%
- **Lighthouse Score**: >95

### Load Testing

```bash
# Run load tests
k6 run tests/load/api-load-test.js

# Monitor during load test
kubectl top pods -n servicedesk
```

## Security Hardening

### Application Security

- [ ] HTTPS enforced
- [ ] HSTS headers enabled
- [ ] Security headers configured
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified
- [ ] XSS protection enabled
- [ ] CSRF protection enabled
- [ ] Rate limiting active
- [ ] Session management secure
- [ ] Password policies enforced

### Infrastructure Security

- [ ] Network policies configured
- [ ] Pod security policies enabled
- [ ] RBAC configured
- [ ] Secrets encrypted at rest
- [ ] Audit logging enabled
- [ ] Container images scanned
- [ ] Vulnerability scanning automated
- [ ] Penetration testing completed

## Monitoring Setup

### Dashboards

- [ ] Application metrics dashboard
- [ ] Database performance dashboard
- [ ] Infrastructure dashboard
- [ ] Business metrics dashboard
- [ ] Security dashboard

### Alerts

- [ ] High error rate alert
- [ ] High response time alert
- [ ] Database connection alert
- [ ] Redis connection alert
- [ ] Disk space alert
- [ ] Memory usage alert
- [ ] CPU usage alert
- [ ] SSL certificate expiry alert

## Backup & Recovery

- [ ] Database backups automated (daily)
- [ ] Backup retention policy configured (30 days)
- [ ] Backup restoration tested
- [ ] Disaster recovery plan documented
- [ ] RTO/RPO defined (Recovery Time/Point Objectives)
- [ ] Backup monitoring configured

## Documentation

- [ ] API documentation updated
- [ ] Deployment guide updated
- [ ] Runbook created
- [ ] Troubleshooting guide updated
- [ ] Architecture diagram updated
- [ ] Onboarding docs updated

## Rollback Plan

### Rollback Procedure

1. **Identify Issue**
   - Check Sentry for errors
   - Check metrics dashboards
   - Review recent changes

2. **Execute Rollback**
   ```bash
   kubectl rollout undo deployment/servicedesk-app -n servicedesk
   ```

3. **Verify Rollback**
   - [ ] Application stable
   - [ ] Error rate decreased
   - [ ] Metrics normal

4. **Post-Mortem**
   - [ ] Document what went wrong
   - [ ] Identify root cause
   - [ ] Create action items
   - [ ] Update deployment process

## Support Plan

- [ ] On-call schedule defined
- [ ] Escalation process documented
- [ ] Support email monitored
- [ ] Status page configured
- [ ] Incident response plan ready

## Go-Live

- [ ] All checklist items completed
- [ ] Final approval from stakeholders
- [ ] Support team ready
- [ ] Monitoring dashboards open
- [ ] Communication channels active

### Go-Live Communication

**Email Template:**
```
Subject: ServiceDesk Production Deployment - [DATE]

Hi Team,

ServiceDesk is now live in production!

Access: https://servicedesk.yourdomain.com
Status Page: https://status.yourdomain.com

Please report any issues to: support@yourdomain.com

Monitoring: [Grafana Dashboard Link]
Incidents: [PagerDuty/On-Call Link]

Thank you,
DevOps Team
```

## Post-Launch

### Week 1

- [ ] Monitor error rates daily
- [ ] Review performance metrics
- [ ] Collect user feedback
- [ ] Address critical bugs
- [ ] Update documentation based on issues

### Week 2-4

- [ ] Performance optimization
- [ ] Address user feedback
- [ ] Refine alerting rules
- [ ] Update runbooks
- [ ] Plan next iteration

## Success Criteria

- [ ] Uptime >99.9%
- [ ] Response time <100ms (p95)
- [ ] Zero critical security issues
- [ ] User satisfaction >4.5/5
- [ ] All features working as expected

## References

- [Docker Deployment](docker.md)
- [Kubernetes Deployment](kubernetes.md)
- [Environment Variables](environment-variables.md)
- [Monitoring Guide](../operations/monitoring.md)
- [Security Best Practices](../operations/security.md)
- [Troubleshooting](../operations/troubleshooting.md)
