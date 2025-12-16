# ServiceDesk Kubernetes - Quick Start Guide

## TL;DR - Deploy in 5 Minutes

```bash
# 1. Build & push image
docker build -t your-registry/servicedesk:v1.0.0 .
docker push your-registry/servicedesk:v1.0.0

# 2. Update image reference
cd k8s/overlays/production
sed -i 's/newName:.*/newName: your-registry\/servicedesk/' kustomization.yaml
sed -i 's/newTag:.*/newTag: v1.0.0/' kustomization.yaml

# 3. Deploy
cd ../../..
./scripts/k8s/deploy.sh production deploy

# 4. Done! Check status
kubectl get pods -n servicedesk
```

## Prerequisites Checklist

- [ ] Kubernetes cluster running (v1.25+)
- [ ] kubectl configured and connected
- [ ] Docker registry access
- [ ] Domain name (for Ingress)
- [ ] Ingress controller installed (Nginx recommended)
- [ ] cert-manager installed (optional, for SSL)

## Essential Commands

### Deploy

```bash
# Development
./scripts/k8s/deploy.sh dev deploy

# Staging
./scripts/k8s/deploy.sh staging deploy

# Production
./scripts/k8s/deploy.sh production deploy
```

### Status

```bash
# Check deployment status
./scripts/k8s/deploy.sh production status

# Or manually
kubectl get all -n servicedesk
```

### Logs

```bash
# Tail logs
./scripts/k8s/deploy.sh production logs

# Or manually
kubectl logs -f deployment/servicedesk-app -n servicedesk
```

### Update

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
```

### Rollback

```bash
# Rollback to previous version
./scripts/k8s/rollback.sh production

# Rollback to specific revision
./scripts/k8s/rollback.sh production 3
```

### Scale

```bash
# Scale manually
./scripts/k8s/deploy.sh production scale 10

# Or with kubectl
kubectl scale deployment/servicedesk-app -n servicedesk --replicas=10
```

### Delete

```bash
# Delete all resources
./scripts/k8s/deploy.sh production delete
```

## Configuration

### Update Environment Variables

Edit `k8s/base/configmap.yaml` for non-sensitive config:

```yaml
data:
  NODE_ENV: "production"
  NEXT_PUBLIC_APP_URL: "https://your-domain.com"
```

### Update Secrets

```bash
# Create/update secrets
kubectl create secret generic servicedesk-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=DATABASE_URL='postgresql://...' \
  --namespace=servicedesk \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Update Domain

Edit `k8s/base/ingress.yaml`:

```yaml
spec:
  rules:
    - host: your-domain.com  # Change this
```

## Troubleshooting

### Pods Not Starting

```bash
kubectl get pods -n servicedesk
kubectl describe pod <pod-name> -n servicedesk
kubectl logs <pod-name> -n servicedesk
```

### Connection Issues

```bash
# Test database
kubectl exec -it <pod-name> -n servicedesk -- nc -zv servicedesk-postgres 5432

# Test Redis
kubectl exec -it <pod-name> -n servicedesk -- nc -zv servicedesk-redis 6379
```

### Access Application

```bash
# Port forward
kubectl port-forward -n servicedesk svc/servicedesk-app 3000:80

# Open browser
open http://localhost:3000
```

## Production Checklist

Before going to production:

- [ ] Build and push Docker image with version tag (NOT latest)
- [ ] Create secrets with strong random values
- [ ] Update domain in Ingress
- [ ] Configure SSL certificate (cert-manager)
- [ ] Update image reference in kustomization.yaml
- [ ] Deploy to production namespace
- [ ] Verify all pods are running
- [ ] Test application via domain
- [ ] Setup monitoring (Prometheus/Grafana)
- [ ] Configure alerts
- [ ] Document rollback procedure

## Next Steps

1. **SSL Setup**: Install cert-manager for automatic SSL
2. **Monitoring**: Setup Prometheus and Grafana
3. **Backups**: Configure Velero for cluster backups
4. **CI/CD**: Integrate with GitHub Actions or GitLab CI
5. **Managed DB**: Migrate to AWS RDS or Google Cloud SQL

## Resources

- Full Documentation: `k8s/README.md`
- Deployment Guide: `docs/K8S-DEPLOYMENT-GUIDE.md`
- Manifests: `k8s/base/` and `k8s/overlays/`
- Scripts: `scripts/k8s/`

## Support

Questions? Check:
1. `k8s/README.md` - Full documentation
2. `kubectl get events -n servicedesk` - Recent events
3. `kubectl logs -f deployment/servicedesk-app -n servicedesk` - Application logs
