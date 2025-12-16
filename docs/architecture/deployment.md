# Deployment Architecture

## Overview

ServiceDesk supports multiple deployment strategies optimized for different environments and requirements.

## Deployment Options

1. **Docker Compose** - Development and small deployments
2. **Kubernetes** - Production-grade orchestration
3. **Cloud Platforms** - AWS ECS, Google Cloud Run, Azure Container Apps
4. **Serverless** - Vercel, AWS Lambda (limited features)

## Docker Deployment

### docker-compose.yml Stack

**Services**:
- PostgreSQL 16 (database)
- Redis 7 (caching)
- ServiceDesk App (Next.js)
- NGINX (reverse proxy)
- Prometheus (metrics)
- Grafana (dashboards)
- Datadog Agent (APM)
- pgAdmin (database management)

**Resource Allocation**:
```yaml
app:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

**Security Features**:
- Non-root user (UID 1001)
- Read-only root filesystem
- No new privileges
- Dropped all capabilities except NET_BIND_SERVICE
- Temporary filesystems for writable dirs

**Quick Start**:
```bash
# Production deployment
docker-compose up -d

# With monitoring stack
docker-compose --profile monitoring up -d

# With all tools
docker-compose --profile monitoring --profile tools up -d
```

## Kubernetes Deployment

### Architecture

**Components**:
- Deployment (3 replicas, rolling updates)
- Service (LoadBalancer)
- HorizontalPodAutoscaler (2-10 pods)
- PodDisruptionBudget (minAvailable: 2)
- ConfigMap (configuration)
- Secrets (sensitive data)
- PersistentVolumeClaim (file uploads)

### High Availability

**Pod Distribution**:
```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          topologyKey: kubernetes.io/hostname  # Different nodes
      - weight: 50
        podAffinityTerm:
          topologyKey: topology.kubernetes.io/zone  # Different AZs
```

**Health Checks**:
- Startup Probe: Initial readiness (30 attempts)
- Liveness Probe: Application health
- Readiness Probe: Traffic routing

**Resource Requirements**:
```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1000m"
    memory: "1Gi"
```

### Auto-Scaling

**HPA Configuration**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Deployment Strategy**:
```bash
# Apply configuration
kubectl apply -k k8s/overlays/production

# Check rollout status
kubectl rollout status deployment/servicedesk-app

# Scale manually
kubectl scale deployment/servicedesk-app --replicas=5

# View pods
kubectl get pods -l app=servicedesk
```

## Infrastructure as Code (Terraform)

### Supported Providers

1. **AWS**
   - EKS cluster
   - RDS PostgreSQL
   - ElastiCache Redis
   - S3 for file storage
   - CloudFront CDN
   - Route53 DNS

2. **Google Cloud**
   - GKE cluster
   - Cloud SQL PostgreSQL
   - Memorystore Redis
   - Cloud Storage
   - Cloud CDN
   - Cloud DNS

3. **Azure**
   - AKS cluster
   - Azure Database for PostgreSQL
   - Azure Cache for Redis
   - Blob Storage
   - Azure CDN
   - Azure DNS

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm run test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker image
        run: docker build -t servicedesk:${{ github.sha }} .
      - name: Push to registry
        run: docker push servicedesk:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/servicedesk-app \
            app=servicedesk:${{ github.sha }}
          kubectl rollout status deployment/servicedesk-app
```

## Monitoring & Observability

### Prometheus Metrics

**Exposed Metrics**:
- HTTP request duration
- Request count by status code
- Active connections
- Database query duration
- Cache hit/miss rates
- Custom business metrics

**Endpoint**: `/api/metrics`

### Grafana Dashboards

**Pre-configured Dashboards**:
1. Application Overview
2. SLA Metrics
3. Database Performance
4. Cache Performance
5. API Performance

### Datadog Integration

**APM Tracing**:
- Automatic instrumentation with dd-trace
- Distributed tracing across services
- Database query tracing
- External API call tracing

**Log Collection**:
- Structured JSON logging
- Log aggregation from all pods
- Error tracking and alerting

## Database Management

### PostgreSQL Configuration

**Production Settings**:
```sql
max_connections = 100
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

**Backup Strategy**:
- Daily full backups (pg_dump)
- Continuous WAL archiving
- Point-in-time recovery enabled
- 30-day retention policy
- Automated backup testing

**Replication**:
- Primary-replica setup
- Read replicas for analytics
- Automatic failover

### Redis Configuration

**Production Settings**:
```conf
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

## Security Hardening

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: servicedesk-network-policy
spec:
  podSelector:
    matchLabels:
      app: servicedesk
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: nginx-ingress
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
```

### TLS/SSL

**Certificate Management**:
- cert-manager for automatic certificate provisioning
- Let's Encrypt integration
- Automatic renewal
- TLS 1.3 only
- Strong cipher suites

**NGINX TLS Configuration**:
```nginx
ssl_protocols TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
```

## Performance Optimization

### CDN Configuration

**Static Assets**:
- CloudFront/Cloud CDN for global distribution
- Long cache TTL (1 year)
- Compression enabled (Brotli, gzip)
- HTTP/2 push for critical resources

**Cache Headers**:
```nginx
location /_next/static/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location /static/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

### Connection Pooling

**Database**:
- Connection pool size: 10-50 per instance
- Connection timeout: 5 seconds
- Idle timeout: 10 minutes
- Max lifetime: 30 minutes

**Redis**:
- Connection pool size: 20 per instance
- Retry strategy: exponential backoff
- Max retries: 3

## Disaster Recovery

### Backup & Restore

**Database Backups**:
```bash
# Full backup
pg_dump -Fc servicedesk > backup_$(date +%Y%m%d).dump

# Restore
pg_restore -d servicedesk backup_20250118.dump
```

**File Storage Backups**:
- S3 versioning enabled
- Cross-region replication
- 30-day retention

### Recovery Time Objective (RTO)

- **Database**: < 1 hour
- **Application**: < 15 minutes
- **Files**: < 30 minutes

### Recovery Point Objective (RPO)

- **Database**: < 5 minutes (WAL archiving)
- **Files**: < 1 hour (hourly S3 sync)

## Cost Optimization

### Resource Rightsizing

**Production**:
- 3-5 app pods (auto-scaled)
- RDS db.t3.large
- ElastiCache cache.t3.medium
- S3 standard storage

**Staging**:
- 1-2 app pods
- RDS db.t3.small
- ElastiCache cache.t3.micro

**Development**:
- Local docker-compose
- SQLite database
- In-memory cache

### Reserved Instances

- 1-year reserved instances for baseline capacity
- Spot instances for burst capacity
- Savings plans for compute

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
