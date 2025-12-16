# ServiceDesk Kubernetes Deployment Guide

Production-ready Kubernetes manifests for deploying ServiceDesk application with High Availability, auto-scaling, and enterprise security.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

## Prerequisites

### Required Tools

1. **kubectl** (v1.25+)
   ```bash
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   chmod +x kubectl
   sudo mv kubectl /usr/local/bin/
   ```

2. **kustomize** (v5.0+) - Optional, kubectl has built-in kustomize
   ```bash
   curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
   sudo mv kustomize /usr/local/bin/
   ```

3. **Kubernetes Cluster** (v1.25+)
   - Managed: GKE, EKS, AKS, DigitalOcean Kubernetes
   - Self-hosted: kubeadm, k3s, kind, minikube

### Optional Tools

- **helm** - For installing Nginx Ingress, cert-manager, Prometheus
- **Prometheus Operator** - For ServiceMonitor CRDs
- **cert-manager** - For automatic SSL certificates

## Quick Start

### 1. Build Docker Image

```bash
# Build image
docker build -t your-registry/servicedesk:v1.0.0 .

# Push to registry
docker push your-registry/servicedesk:v1.0.0
```

### 2. Update Image Reference

Edit `k8s/overlays/production/kustomization.yaml`:

```yaml
images:
  - name: servicedesk
    newName: your-registry/servicedesk
    newTag: v1.0.0
```

### 3. Create Secrets

```bash
# Generate secrets
kubectl create secret generic servicedesk-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -hex 32) \
  --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  --from-literal=DATABASE_URL='postgresql://user:password@servicedesk-postgres:5432/servicedesk' \
  --from-literal=REDIS_PASSWORD='your-redis-password' \
  --namespace=servicedesk
```

### 4. Deploy

```bash
# Using deployment script (recommended)
./scripts/k8s/deploy.sh production deploy

# Or manually with kubectl
kubectl create namespace servicedesk
kubectl apply -k k8s/overlays/production/ -n servicedesk
```

### 5. Verify Deployment

```bash
# Check deployment status
./scripts/k8s/deploy.sh production status

# Watch pods
kubectl get pods -n servicedesk -w

# Check logs
kubectl logs -f deployment/servicedesk-app -n servicedesk
```

## Architecture

### High Availability Features

- **Replicas**: 3-5 pods (production)
- **Anti-affinity**: Pods spread across nodes and zones
- **Pod Disruption Budget**: Minimum 2 pods available during updates
- **Rolling Updates**: Zero-downtime deployments
- **Health Checks**: Startup, liveness, and readiness probes

### Auto-Scaling

- **HPA**: Scales 3-10 pods based on CPU (70%) and Memory (80%)
- **VPA**: Optional vertical scaling for resource optimization
- **Metrics Server**: Required for HPA

### Security

- **Non-root User**: Runs as UID 1001
- **Read-only Root Filesystem**: Where possible
- **Security Context**: Drop all capabilities
- **Network Policies**: Restrict ingress/egress traffic
- **Secret Management**: Kubernetes secrets (consider Sealed Secrets)

## Directory Structure

```
k8s/
├── base/                       # Base manifests (environment-agnostic)
│   ├── deployment.yaml         # Application deployment
│   ├── service.yaml            # ClusterIP service
│   ├── service-loadbalancer.yaml  # LoadBalancer (optional)
│   ├── ingress.yaml            # Nginx Ingress
│   ├── configmap.yaml          # Non-sensitive config
│   ├── secrets.yaml            # Secrets template (DO NOT COMMIT)
│   ├── hpa.yaml                # HorizontalPodAutoscaler
│   ├── network-policy.yaml     # Network security policies
│   └── kustomization.yaml      # Base kustomization
│
├── overlays/                   # Environment-specific overrides
│   ├── dev/
│   │   └── kustomization.yaml  # Dev: 1 replica, reduced resources
│   ├── staging/
│   │   └── kustomization.yaml  # Staging: 3 replicas, moderate resources
│   └── production/
│       └── kustomization.yaml  # Production: 5 replicas, full resources
│
├── statefulsets/              # StatefulSets for databases
│   ├── postgres-statefulset.yaml  # PostgreSQL (self-hosted)
│   └── redis-statefulset.yaml     # Redis (caching)
│
├── monitoring/                # Monitoring & observability
│   ├── servicemonitor.yaml    # Prometheus metrics scraping
│   └── grafana-dashboard.yaml # Grafana dashboard
│
└── README.md                  # This file
```

## Deployment

### Development Environment

```bash
# Deploy to dev
./scripts/k8s/deploy.sh dev deploy

# Features:
# - 1 replica
# - NodePort service
# - No SSL
# - Debug mode enabled
# - Mock data enabled
```

### Staging Environment

```bash
# Deploy to staging
./scripts/k8s/deploy.sh staging deploy

# Features:
# - 3 replicas
# - SSL enabled
# - Production-like configuration
# - Testing environment
```

### Production Environment

```bash
# Deploy to production
./scripts/k8s/deploy.sh production deploy

# Features:
# - 5 replicas (auto-scales to 20)
# - Full HA configuration
# - SSL with cert-manager
# - Network policies
# - Monitoring enabled
```

### Manual Deployment

```bash
# Create namespace
kubectl create namespace servicedesk

# Label namespace
kubectl label namespace servicedesk environment=production

# Apply manifests
kubectl apply -k k8s/overlays/production/ -n servicedesk

# Wait for rollout
kubectl rollout status deployment/servicedesk-app -n servicedesk
```

## Configuration

### ConfigMap (Non-Sensitive)

Edit `k8s/base/configmap.yaml`:

```yaml
data:
  NODE_ENV: "production"
  NEXT_PUBLIC_APP_URL: "https://servicedesk.example.com"
  ENABLE_REDIS_CACHE: "true"
  # ... other config
```

### Secrets (Sensitive)

**IMPORTANT**: Never commit secrets to version control!

```bash
# Create from literals
kubectl create secret generic servicedesk-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=DATABASE_URL='postgresql://...' \
  --namespace=servicedesk

# Or from file
kubectl create secret generic servicedesk-secrets \
  --from-env-file=.env.production \
  --namespace=servicedesk

# Or using Sealed Secrets (recommended)
kubeseal --format=yaml < k8s/base/secrets.yaml > k8s/base/sealed-secrets.yaml
kubectl apply -f k8s/base/sealed-secrets.yaml
```

### External Secrets Operator (Recommended)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: servicedesk-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager  # or gcp, azure, vault
    kind: SecretStore
  target:
    name: servicedesk-secrets
  data:
    - secretKey: JWT_SECRET
      remoteRef:
        key: servicedesk/jwt-secret
```

## Monitoring

### Install Prometheus Operator

```bash
# Add helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

### Apply ServiceMonitor

```bash
kubectl apply -f k8s/monitoring/servicemonitor.yaml
```

### Metrics Endpoints

- **Application**: `http://servicedesk-app:3000/api/metrics`
- **Redis**: `http://servicedesk-redis:9121/metrics`

### Grafana Dashboard

```bash
# Import dashboard
kubectl apply -f k8s/monitoring/grafana-dashboard.yaml

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Default credentials: admin / prom-operator
```

### Alerts

PrometheusRule includes alerts for:
- High CPU/Memory usage
- Pod not ready
- High error rate
- High response time
- Database down
- HPA at max replicas

## Security

### SSL/TLS Certificates

#### Using cert-manager (Automated)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

Ingress will automatically request and renew certificates.

#### Manual Certificate

```bash
# Create TLS secret
kubectl create secret tls servicedesk-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  --namespace=servicedesk
```

### Network Policies

Network policies are applied by default:

- **App**: Only accepts traffic from Ingress, connects to Postgres/Redis
- **Postgres**: Only accepts traffic from App
- **Redis**: Only accepts traffic from App

To disable (not recommended):

```bash
kubectl delete networkpolicy -n servicedesk --all
```

### RBAC

Create service account with minimal permissions:

```bash
kubectl create serviceaccount servicedesk -n servicedesk
```

### Pod Security

- **securityContext**: Non-root user (1001)
- **readOnlyRootFilesystem**: Where possible
- **capabilities**: All dropped
- **seccompProfile**: RuntimeDefault

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n servicedesk

# Describe pod
kubectl describe pod <pod-name> -n servicedesk

# Check logs
kubectl logs <pod-name> -n servicedesk

# Check events
kubectl get events -n servicedesk --sort-by='.lastTimestamp'
```

#### Database Connection Errors

```bash
# Check PostgreSQL pod
kubectl get pods -n servicedesk -l component=postgres

# Test connection
kubectl exec -it <app-pod> -n servicedesk -- nc -zv servicedesk-postgres 5432

# Check database logs
kubectl logs <postgres-pod> -n servicedesk
```

#### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n servicedesk
kubectl describe ingress servicedesk-ingress -n servicedesk

# Check Nginx Ingress Controller
kubectl get pods -n ingress-nginx

# Test from inside cluster
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://servicedesk-app
```

#### HPA Not Scaling

```bash
# Check HPA status
kubectl get hpa -n servicedesk
kubectl describe hpa servicedesk-app-hpa -n servicedesk

# Check metrics server
kubectl top pods -n servicedesk
kubectl top nodes

# If metrics not available, install metrics-server:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Debug Commands

```bash
# Shell into pod
kubectl exec -it <pod-name> -n servicedesk -- /bin/sh

# Port forward to local
kubectl port-forward -n servicedesk svc/servicedesk-app 3000:80

# Tail logs
kubectl logs -f deployment/servicedesk-app -n servicedesk

# Watch pods
kubectl get pods -n servicedesk -w

# Check resource usage
kubectl top pods -n servicedesk
kubectl top nodes
```

## Advanced Topics

### Database Migration

For production, use managed databases instead of StatefulSets:

- **AWS RDS** for PostgreSQL
- **Google Cloud SQL**
- **Azure Database for PostgreSQL**
- **Neon** (serverless PostgreSQL)

Update `DATABASE_URL` secret to point to managed database.

### Blue-Green Deployment

```bash
# Deploy new version with different label
kubectl apply -k k8s/overlays/production-v2/

# Test new version
kubectl port-forward -n servicedesk svc/servicedesk-app-v2 3000:80

# Switch traffic (update Ingress or Service selector)
kubectl patch service servicedesk-app -n servicedesk -p '{"spec":{"selector":{"version":"v2"}}}'

# Rollback if needed
kubectl patch service servicedesk-app -n servicedesk -p '{"spec":{"selector":{"version":"v1"}}}'
```

### Canary Deployment

Use Istio, Linkerd, or Nginx Ingress canary annotations:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
```

### Multi-Region Deployment

1. Deploy to multiple clusters
2. Use global load balancer (AWS Global Accelerator, GCP Load Balancer)
3. Configure DNS for geo-routing

### Disaster Recovery

```bash
# Backup PVCs
velero backup create servicedesk-backup --include-namespaces servicedesk

# Restore
velero restore create --from-backup servicedesk-backup
```

### Scaling

```bash
# Manual scaling
./scripts/k8s/deploy.sh production scale 10

# Or with kubectl
kubectl scale deployment/servicedesk-app -n servicedesk --replicas=10

# HPA will override manual scaling based on metrics
```

### Rollback

```bash
# Show rollout history
kubectl rollout history deployment/servicedesk-app -n servicedesk

# Rollback to previous version
./scripts/k8s/rollback.sh production

# Rollback to specific revision
./scripts/k8s/rollback.sh production 3
```

### Cost Optimization

1. **Use HPA**: Scale down during low traffic
2. **Node Auto-scaling**: Cluster autoscaler
3. **Spot/Preemptible Instances**: For non-production
4. **Resource Requests**: Right-size requests/limits
5. **PVC**: Use appropriate storage classes

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and push image
        run: |
          docker build -t ${{ secrets.REGISTRY }}/servicedesk:${{ github.sha }} .
          docker push ${{ secrets.REGISTRY }}/servicedesk:${{ github.sha }}

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/servicedesk-app \
            app=${{ secrets.REGISTRY }}/servicedesk:${{ github.sha }} \
            -n servicedesk
```

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting)
2. Review Kubernetes events: `kubectl get events -n servicedesk`
3. Check application logs: `kubectl logs -f deployment/servicedesk-app -n servicedesk`
4. Open GitHub issue with logs and manifest details

## License

ServiceDesk - Internal Use
