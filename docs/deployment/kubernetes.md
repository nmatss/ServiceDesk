# Kubernetes Deployment Guide

Complete guide for deploying ServiceDesk on Kubernetes clusters.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Scaling](#scaling)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

ServiceDesk includes production-ready Kubernetes manifests using Kustomize for environment-specific overlays.

### Features

- **High Availability**: Multi-replica deployments with pod anti-affinity
- **Auto-Scaling**: HPA based on CPU/memory metrics
- **Zero-Downtime Deployments**: Rolling updates with health checks
- **Persistent Storage**: StatefulSets for databases
- **Monitoring**: Prometheus ServiceMonitor integration
- **Security**: Network policies, RBAC, secrets encryption

## Prerequisites

### Required
- Kubernetes 1.24+
- kubectl configured
- 8GB RAM cluster minimum
- Storage class with dynamic provisioning
- Load balancer (cloud provider or MetalLB)

### Recommended
- Kubernetes 1.28+
- Cert-manager for TLS
- Prometheus Operator
- Ingress controller (NGINX, Traefik)
- External secrets operator

### Verify Cluster

```bash
# Check kubectl connection
kubectl cluster-info

# Check nodes
kubectl get nodes

# Check storage classes
kubectl get storageclass
```

## Quick Start

### 1. Create Namespace

```bash
kubectl create namespace servicedesk
```

### 2. Create Secrets

```bash
# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24)

# Create Kubernetes secret
kubectl create secret generic servicedesk-secrets \
  --namespace=servicedesk \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=session-secret=$SESSION_SECRET \
  --from-literal=database-password=$DB_PASSWORD \
  --from-literal=redis-password=$(openssl rand -base64 24)
```

### 3. Deploy Application

```bash
# Deploy to production
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl get pods -n servicedesk

# Watch rollout
kubectl rollout status deployment/servicedesk-app -n servicedesk
```

### 4. Access Application

```bash
# Get LoadBalancer IP
kubectl get svc servicedesk-app -n servicedesk

# Port forward for testing
kubectl port-forward svc/servicedesk-app 3000:3000 -n servicedesk
```

Visit: http://localhost:3000

## Architecture

```
┌─────────────────────────────────────────────┐
│            Ingress Controller                │
│         (NGINX / Traefik / ALB)             │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│        ServiceDesk Service (ClusterIP)       │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│      ServiceDesk Deployment (3 replicas)    │
│         HPA: 2-10 replicas                   │
└──┬──────────────┬──────────────┬─────────────┘
   │              │              │
┌──▼──────┐  ┌───▼──────┐  ┌───▼──────┐
│ Pod 1   │  │  Pod 2   │  │  Pod 3   │
└─────────┘  └──────────┘  └──────────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
       ┌─────────────▼──────────────┐
       │   PostgreSQL StatefulSet   │
       │      (Persistent Volume)    │
       └────────────────────────────┘
```

### Components

1. **Ingress**: Routes external traffic to services
2. **Service**: Load balances traffic across pods
3. **Deployment**: Manages application pods
4. **StatefulSet**: Manages stateful services (PostgreSQL, Redis)
5. **HPA**: Auto-scales based on metrics
6. **ConfigMap**: Application configuration
7. **Secret**: Sensitive data (passwords, keys)
8. **PVC**: Persistent storage for databases

## Configuration

### Directory Structure

```
k8s/
├── base/                    # Base manifests
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── hpa.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── development/         # Dev environment
│   ├── staging/             # Staging environment
│   └── production/          # Production environment
├── statefulsets/            # StatefulSets (DB, Redis)
├── cronjobs/                # Scheduled jobs
└── monitoring/              # Monitoring resources
```

### Kustomize Overlays

#### Base

```yaml
# k8s/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - deployment.yaml
  - service.yaml
  - ingress.yaml
  - configmap.yaml
  - hpa.yaml

commonLabels:
  app: servicedesk
  team: platform
```

#### Production Overlay

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

namespace: servicedesk

replicas:
  - name: servicedesk-app
    count: 3

images:
  - name: servicedesk
    newTag: v1.0.0

patchesStrategicMerge:
  - production-resources.yaml
  - production-hpa.yaml
```

### ConfigMap

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: servicedesk-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  ENABLE_REDIS_CACHE: "true"
  DATABASE_POOL_MIN: "2"
  DATABASE_POOL_MAX: "10"
```

### Secrets

```bash
# Create from literal values
kubectl create secret generic servicedesk-secrets \
  --namespace=servicedesk \
  --from-literal=jwt-secret=$(openssl rand -hex 32) \
  --from-literal=session-secret=$(openssl rand -hex 32)

# Or from file
kubectl create secret generic servicedesk-secrets \
  --namespace=servicedesk \
  --from-env-file=.env.production
```

## Deployment

### Application Deployment

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: servicedesk-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: servicedesk
  template:
    metadata:
      labels:
        app: servicedesk
    spec:
      containers:
      - name: app
        image: servicedesk:latest
        ports:
        - containerPort: 3000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: servicedesk-secrets
              key: jwt-secret
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 40
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 20
          periodSeconds: 10
```

### PostgreSQL StatefulSet

```yaml
# k8s/statefulsets/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: servicedesk-secrets
              key: database-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
```

### Service

```yaml
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: servicedesk-app
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: servicedesk
```

### Ingress

```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: servicedesk
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - servicedesk.yourdomain.com
    secretName: servicedesk-tls
  rules:
  - host: servicedesk.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: servicedesk-app
            port:
              number: 3000
```

## Scaling

### Horizontal Pod Autoscaler

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: servicedesk-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: servicedesk-app
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

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment servicedesk-app --replicas=5 -n servicedesk

# Check replicas
kubectl get deployment servicedesk-app -n servicedesk
```

### Vertical Pod Autoscaler (Optional)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: servicedesk-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: servicedesk-app
  updatePolicy:
    updateMode: "Auto"
```

## Monitoring

### ServiceMonitor (Prometheus Operator)

```yaml
# k8s/monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: servicedesk
spec:
  selector:
    matchLabels:
      app: servicedesk
  endpoints:
  - port: metrics
    path: /api/metrics
    interval: 30s
```

### PodMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: servicedesk-pods
spec:
  selector:
    matchLabels:
      app: servicedesk
  podMetricsEndpoints:
  - port: metrics
    path: /metrics
```

### Grafana Dashboard

```bash
# Import dashboard
kubectl apply -f k8s/monitoring/grafana-dashboard.yaml
```

## Security

### Network Policies

```yaml
# k8s/base/networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: servicedesk-netpol
spec:
  podSelector:
    matchLabels:
      app: servicedesk
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
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
```

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: servicedesk
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### RBAC

```yaml
# k8s/base/rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: servicedesk-role
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: servicedesk-rolebinding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: servicedesk-role
subjects:
- kind: ServiceAccount
  name: servicedesk-sa
```

## Troubleshooting

### Check Pod Status

```bash
# List pods
kubectl get pods -n servicedesk

# Describe pod
kubectl describe pod <pod-name> -n servicedesk

# View logs
kubectl logs <pod-name> -n servicedesk

# Follow logs
kubectl logs -f <pod-name> -n servicedesk

# Previous container logs (if crashed)
kubectl logs <pod-name> -n servicedesk --previous
```

### Common Issues

#### Pods Not Starting

```bash
# Check events
kubectl get events -n servicedesk --sort-by='.lastTimestamp'

# Check resource quotas
kubectl describe resourcequota -n servicedesk

# Check pod security
kubectl get pod <pod-name> -n servicedesk -o yaml | grep -A 10 securityContext
```

#### Database Connection Issues

```bash
# Test database connection
kubectl exec -it <app-pod> -n servicedesk -- sh
nc -zv postgres 5432

# Check database pod
kubectl logs <postgres-pod> -n servicedesk
```

#### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n servicedesk
kubectl describe ingress servicedesk -n servicedesk

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

## Deployment Commands Reference

```bash
# Deploy
kubectl apply -k k8s/overlays/production

# Update deployment
kubectl set image deployment/servicedesk-app app=servicedesk:v1.1.0 -n servicedesk

# Rollback deployment
kubectl rollout undo deployment/servicedesk-app -n servicedesk

# Check rollout status
kubectl rollout status deployment/servicedesk-app -n servicedesk

# Restart deployment
kubectl rollout restart deployment/servicedesk-app -n servicedesk

# Delete deployment
kubectl delete -k k8s/overlays/production
```

## Best Practices

1. **Use Kustomize** for environment-specific configurations
2. **Set resource limits** on all containers
3. **Configure health checks** (liveness and readiness)
4. **Use secrets** for sensitive data
5. **Enable autoscaling** with HPA
6. **Implement network policies** for security
7. **Use rolling updates** for zero-downtime deployments
8. **Monitor** with Prometheus and Grafana
9. **Backup** persistent volumes regularly
10. **Test** in staging before production

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Reference](https://kustomize.io/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager](https://cert-manager.io/)
- [Complete K8s Guide](../K8S-DEPLOYMENT-GUIDE.md)
