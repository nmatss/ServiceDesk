# Kubernetes Deployment Guide - ServiceDesk

## Executive Summary

Production-ready Kubernetes infrastructure with **High Availability**, **Auto-scaling**, and **Enterprise Security**.

### Features

- ✅ **High Availability**: 3+ replicas with anti-affinity
- ✅ **Auto-scaling**: HPA (3-10 pods) based on CPU/Memory
- ✅ **Zero Downtime**: Rolling updates with PodDisruptionBudget
- ✅ **Health Checks**: Startup, liveness, readiness probes
- ✅ **Security**: Non-root, network policies, secret management
- ✅ **Monitoring**: Prometheus, Grafana, alerts
- ✅ **Multi-environment**: Dev, Staging, Production overlays

## Quick Start (5 Minutes)

```bash
# 1. Build and push image
docker build -t your-registry/servicedesk:v1.0.0 .
docker push your-registry/servicedesk:v1.0.0

# 2. Update image in kustomization
sed -i 's|newName:.*|newName: your-registry/servicedesk|' k8s/overlays/production/kustomization.yaml
sed -i 's|newTag:.*|newTag: v1.0.0|' k8s/overlays/production/kustomization.yaml

# 3. Deploy
./scripts/k8s/deploy.sh production deploy

# 4. Verify
kubectl get pods -n servicedesk -w
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  Ingress (Nginx) │
              │  + SSL/TLS       │
              └─────────┬────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   Service (LB)   │
              └─────────┬────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐     ┌────────┐     ┌────────┐
   │ Pod 1  │     │ Pod 2  │     │ Pod 3  │
   │  App   │     │  App   │     │  App   │
   └───┬────┘     └───┬────┘     └───┬────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
           ▼                     ▼
    ┌──────────┐          ┌──────────┐
    │PostgreSQL│          │  Redis   │
    │StatefulSet│         │StatefulSet│
    └──────────┘          └──────────┘
```

## Infrastructure Components

### 1. Application Deployment

**File**: `k8s/base/deployment.yaml`

- **Replicas**: 3 (HA)
- **Strategy**: RollingUpdate (maxSurge: 1, maxUnavailable: 0)
- **Resources**: 500m CPU, 512Mi memory (requests = limits)
- **Health Checks**: Startup, liveness, readiness
- **Security**: Non-root (UID 1001), capabilities dropped
- **Anti-affinity**: Spread across nodes and zones

### 2. Service & Ingress

**Files**:
- `k8s/base/service.yaml` - ClusterIP service
- `k8s/base/service-loadbalancer.yaml` - LoadBalancer (optional)
- `k8s/base/ingress.yaml` - Nginx Ingress with SSL

**Features**:
- Session affinity (sticky sessions)
- SSL/TLS with cert-manager
- Rate limiting (100 RPS)
- Security headers
- Gzip compression

### 3. Auto-scaling

**File**: `k8s/base/hpa.yaml`

- **Min Replicas**: 3
- **Max Replicas**: 10
- **CPU Target**: 70%
- **Memory Target**: 80%
- **Scale Down**: Stabilization 5 minutes
- **Scale Up**: Stabilization 1 minute

### 4. Database (PostgreSQL)

**File**: `k8s/statefulsets/postgres-statefulset.yaml`

- **StatefulSet**: 1 replica (for HA, use managed DB)
- **Storage**: 50Gi PVC
- **Config**: Optimized for production
- **Backup**: Not included (use managed DB or Velero)

**Production Recommendation**: Use managed database:
- AWS RDS for PostgreSQL
- Google Cloud SQL
- Azure Database for PostgreSQL
- Neon (serverless)

### 5. Cache (Redis)

**File**: `k8s/statefulsets/redis-statefulset.yaml`

- **StatefulSet**: 1 replica
- **Storage**: 10Gi PVC
- **Config**: AOF + RDB persistence
- **Monitoring**: Redis Exporter for Prometheus

### 6. Network Policies

**File**: `k8s/base/network-policy.yaml`

**App Ingress**:
- Allow from Ingress Controller
- Allow from other ServiceDesk pods
- Allow from Prometheus (monitoring)

**App Egress**:
- Allow to DNS (kube-dns)
- Allow to PostgreSQL (5432)
- Allow to Redis (6379)
- Allow to HTTPS (443) for external APIs

**Postgres/Redis**: Only allow from App pods

### 7. Monitoring

**Files**:
- `k8s/monitoring/servicemonitor.yaml` - Prometheus metrics
- `k8s/monitoring/grafana-dashboard.yaml` - Dashboard

**Metrics**:
- HTTP requests rate
- Response time (P95, P99)
- Error rate
- CPU/Memory usage
- Database connections
- Redis cache hits

**Alerts**:
- High CPU/Memory
- Pod not ready
- High error rate
- Database down
- HPA at max replicas

## Deployment Environments

### Development

**Command**: `./scripts/k8s/deploy.sh dev deploy`

**Configuration**:
- 1 replica
- Reduced resources (100m CPU, 256Mi memory)
- NodePort service
- No SSL
- Debug mode enabled
- Mock data enabled

### Staging

**Command**: `./scripts/k8s/deploy.sh staging deploy`

**Configuration**:
- 3 replicas
- Moderate resources (250m CPU, 512Mi memory)
- SSL enabled
- Production-like configuration
- Testing environment

### Production

**Command**: `./scripts/k8s/deploy.sh production deploy`

**Configuration**:
- 5 replicas (auto-scales to 20)
- Full resources (500m CPU, 512Mi memory)
- SSL with cert-manager
- Network policies enabled
- Monitoring enabled
- WAF protection (ModSecurity)

## Deployment Steps

### Prerequisites

1. **Kubernetes Cluster** (v1.25+)
   ```bash
   kubectl version --client
   kubectl cluster-info
   ```

2. **Docker Registry Access**
   ```bash
   docker login your-registry
   ```

3. **kubectl + kustomize**
   ```bash
   kubectl version
   kubectl kustomize --help
   ```

### Step 1: Build Container Image

```bash
# Build image
docker build -t your-registry/servicedesk:v1.0.0 .

# Test locally
docker run -p 3000:3000 your-registry/servicedesk:v1.0.0

# Push to registry
docker push your-registry/servicedesk:v1.0.0
```

### Step 2: Configure Manifests

#### Update Image Reference

Edit `k8s/overlays/production/kustomization.yaml`:

```yaml
images:
  - name: servicedesk
    newName: your-registry/servicedesk
    newTag: v1.0.0  # Use specific version, NOT latest
```

#### Update Domain

Edit `k8s/base/ingress.yaml`:

```yaml
spec:
  tls:
    - hosts:
        - servicedesk.yourdomain.com
      secretName: servicedesk-tls
  rules:
    - host: servicedesk.yourdomain.com
```

### Step 3: Create Secrets

```bash
# Generate secure secrets
export JWT_SECRET=$(openssl rand -hex 32)
export SESSION_SECRET=$(openssl rand -hex 32)
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -hex 32)
export DB_PASSWORD=$(openssl rand -hex 32)

# Create Kubernetes secret
kubectl create secret generic servicedesk-secrets \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD}" \
  --from-literal=DATABASE_URL="postgresql://servicedesk:${DB_PASSWORD}@servicedesk-postgres:5432/servicedesk" \
  --namespace=servicedesk \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret created
kubectl get secret servicedesk-secrets -n servicedesk
```

**IMPORTANT**: Store secrets in secure location (1Password, AWS Secrets Manager, etc.)

### Step 4: Deploy Application

```bash
# Using deployment script (recommended)
./scripts/k8s/deploy.sh production deploy

# Or manually
kubectl create namespace servicedesk
kubectl apply -k k8s/overlays/production/ -n servicedesk
```

### Step 5: Verify Deployment

```bash
# Check deployment status
kubectl rollout status deployment/servicedesk-app -n servicedesk

# Get pods
kubectl get pods -n servicedesk

# Check services
kubectl get svc -n servicedesk

# Check ingress
kubectl get ingress -n servicedesk

# View logs
kubectl logs -f deployment/servicedesk-app -n servicedesk
```

### Step 6: Configure DNS

Point your domain to the LoadBalancer or Ingress IP:

```bash
# Get external IP
kubectl get ingress -n servicedesk

# Create DNS A record
# servicedesk.yourdomain.com -> <EXTERNAL-IP>
```

### Step 7: Test Application

```bash
# Port forward (testing)
kubectl port-forward -n servicedesk svc/servicedesk-app 3000:80

# Open browser
open http://localhost:3000

# Or test via domain
curl -I https://servicedesk.yourdomain.com
```

## Post-Deployment

### SSL Certificate Setup (cert-manager)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# Certificate will be auto-generated by Ingress annotation
# Check certificate status
kubectl get certificate -n servicedesk
kubectl describe certificate servicedesk-tls -n servicedesk
```

### Monitoring Setup

```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

# Apply ServiceMonitor
kubectl apply -f k8s/monitoring/servicemonitor.yaml

# Apply Grafana Dashboard
kubectl apply -f k8s/monitoring/grafana-dashboard.yaml

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Username: admin, Password: prom-operator
```

### Database Migration

```bash
# Run migrations (one-time)
kubectl exec -it deployment/servicedesk-app -n servicedesk -- npm run migrate

# Or create a Job for migrations
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: servicedesk-migrate
  namespace: servicedesk
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: your-registry/servicedesk:v1.0.0
          command: ["npm", "run", "migrate"]
          envFrom:
            - configMapRef:
                name: servicedesk-config
            - secretRef:
                name: servicedesk-secrets
      restartPolicy: Never
EOF
```

## Operations

### Scaling

```bash
# Manual scale
kubectl scale deployment/servicedesk-app -n servicedesk --replicas=10

# HPA will auto-scale based on metrics
kubectl get hpa -n servicedesk
```

### Updates (Zero Downtime)

```bash
# Build new image
docker build -t your-registry/servicedesk:v1.1.0 .
docker push your-registry/servicedesk:v1.1.0

# Update deployment
kubectl set image deployment/servicedesk-app \
  app=your-registry/servicedesk:v1.1.0 \
  -n servicedesk

# Watch rollout
kubectl rollout status deployment/servicedesk-app -n servicedesk

# If issues, rollback
kubectl rollout undo deployment/servicedesk-app -n servicedesk
```

### Rollback

```bash
# Using script
./scripts/k8s/rollback.sh production

# Or manually
kubectl rollout undo deployment/servicedesk-app -n servicedesk

# Rollback to specific revision
kubectl rollout history deployment/servicedesk-app -n servicedesk
kubectl rollout undo deployment/servicedesk-app -n servicedesk --to-revision=3
```

### Logs

```bash
# Tail logs
kubectl logs -f deployment/servicedesk-app -n servicedesk

# Logs from specific pod
kubectl logs <pod-name> -n servicedesk

# Logs from all pods
kubectl logs -l app=servicedesk -n servicedesk --tail=100

# Previous container logs (if pod crashed)
kubectl logs <pod-name> -n servicedesk --previous
```

### Debugging

```bash
# Shell into pod
kubectl exec -it <pod-name> -n servicedesk -- /bin/sh

# Describe pod
kubectl describe pod <pod-name> -n servicedesk

# Get events
kubectl get events -n servicedesk --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n servicedesk
kubectl top nodes
```

## Security Best Practices

### 1. Secret Management

**DO**:
- Use Sealed Secrets or External Secrets Operator
- Store secrets in AWS Secrets Manager / GCP Secret Manager
- Rotate secrets regularly
- Use RBAC to restrict secret access

**DON'T**:
- Commit secrets to Git
- Use base64 encoding as encryption
- Share secrets via Slack/email

### 2. Network Security

- Enable Network Policies (default)
- Use Ingress with WAF (ModSecurity)
- Restrict egress to required services only
- Use service mesh (Istio/Linkerd) for mTLS

### 3. Container Security

- Run as non-root user (UID 1001)
- Drop all capabilities
- Read-only root filesystem where possible
- Scan images for vulnerabilities (Trivy, Clair)
- Use distroless or minimal base images

### 4. RBAC

```bash
# Create limited service account
kubectl create serviceaccount servicedesk -n servicedesk

# Create Role (minimal permissions)
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: servicedesk-role
  namespace: servicedesk
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list"]
EOF

# Bind Role to ServiceAccount
kubectl create rolebinding servicedesk-binding \
  --role=servicedesk-role \
  --serviceaccount=servicedesk:servicedesk \
  -n servicedesk
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n servicedesk

# Describe pod (shows events)
kubectl describe pod <pod-name> -n servicedesk

# Common issues:
# - ImagePullBackOff: Wrong image name/tag or no registry access
# - CrashLoopBackOff: Application error (check logs)
# - Pending: Resource constraints (check node capacity)
```

### Database Connection Errors

```bash
# Test PostgreSQL connectivity
kubectl exec -it <app-pod> -n servicedesk -- nc -zv servicedesk-postgres 5432

# Check PostgreSQL logs
kubectl logs <postgres-pod> -n servicedesk

# Verify secret
kubectl get secret servicedesk-secrets -n servicedesk -o yaml
```

### Ingress Not Working

```bash
# Check Ingress Controller
kubectl get pods -n ingress-nginx

# Check Ingress resource
kubectl get ingress -n servicedesk
kubectl describe ingress servicedesk-ingress -n servicedesk

# Test from inside cluster
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://servicedesk-app
```

### HPA Not Scaling

```bash
# Check HPA status
kubectl get hpa -n servicedesk
kubectl describe hpa servicedesk-app-hpa -n servicedesk

# Install metrics-server if missing
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify metrics
kubectl top pods -n servicedesk
```

## Cost Optimization

1. **Right-size Resources**: Use VPA to optimize requests/limits
2. **Auto-scaling**: HPA scales down during low traffic
3. **Spot Instances**: Use for non-production workloads
4. **Storage**: Use appropriate storage classes (SSD vs HDD)
5. **Monitoring**: Track resource usage and waste

## Maintenance

### Backup

```bash
# Backup with Velero
velero backup create servicedesk-$(date +%Y%m%d) \
  --include-namespaces servicedesk

# Restore
velero restore create --from-backup servicedesk-20241018
```

### Updates

- **Kubernetes Cluster**: Update during maintenance window
- **Application**: Rolling updates (zero downtime)
- **Database**: Use managed database with automatic backups

## Production Checklist

- [ ] Docker image pushed to registry
- [ ] Secrets created (JWT_SECRET, DATABASE_URL, etc.)
- [ ] Domain DNS configured
- [ ] SSL certificate configured (cert-manager)
- [ ] Monitoring setup (Prometheus, Grafana)
- [ ] Alerts configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Runbook documented
- [ ] On-call rotation established

## Support

For issues:
1. Check logs: `kubectl logs -f deployment/servicedesk-app -n servicedesk`
2. Check events: `kubectl get events -n servicedesk`
3. Review troubleshooting section
4. Contact DevOps team

---

**ServiceDesk K8s Deployment v1.0.0**
