# Docker Deployment Guide

Complete guide for deploying ServiceDesk using Docker and Docker Compose.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [Multi-Container Setup](#multi-container-setup)
- [Networking](#networking)
- [Storage & Volumes](#storage--volumes)
- [Security Hardening](#security-hardening)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

ServiceDesk uses a multi-stage Docker build for optimized production deployments:

- **Stage 1: Dependencies** - Production node_modules only
- **Stage 2: Builder** - Build the Next.js application
- **Stage 3: Runner** - Minimal production image (~200MB)

### Architecture

```
┌─────────────────────────────────────────────┐
│           NGINX (Reverse Proxy)             │
│              Port 80/443                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│        ServiceDesk Application              │
│         (Next.js + Node.js)                 │
│              Port 3000                       │
└──────┬───────────────┬──────────────────────┘
       │               │
┌──────▼──────┐  ┌────▼──────────┐
│  PostgreSQL │  │     Redis     │
│  Port 5432  │  │   Port 6379   │
└─────────────┘  └───────────────┘
```

## Prerequisites

### Required
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum (4GB recommended)
- 10GB disk space

### Recommended
- Docker 24.0+
- 4GB RAM
- 20GB SSD storage

### Verify Installation

```bash
docker --version
# Docker version 24.0.0 or higher

docker-compose --version
# Docker Compose version 2.20.0 or higher
```

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/ServiceDesk.git
cd ServiceDesk
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.production.example .env

# Generate secrets
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 24)" >> .env
```

### 3. Build and Run

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 4. Access Application

- **Application**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

Default admin credentials (CHANGE IMMEDIATELY):
- Email: admin@example.com
- Password: Admin123!

## Configuration

### Environment Variables

Edit `.env` file with your configuration:

```bash
# ==============================================================================
# REQUIRED VARIABLES
# ==============================================================================

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Security (GENERATE THESE!)
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here

# Database
DATABASE_URL=postgresql://servicedesk:password@postgres:5432/servicedesk
POSTGRES_USER=servicedesk
POSTGRES_PASSWORD=your-postgres-password
POSTGRES_DB=servicedesk

# Redis
REDIS_URL=redis://:your-redis-password@redis:6379
REDIS_PASSWORD=your-redis-password

# ==============================================================================
# OPTIONAL VARIABLES
# ==============================================================================

# Email (choose one provider)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Or use SendGrid
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=your-sendgrid-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
DD_API_KEY=your-datadog-key

# Storage
STORAGE_PROVIDER=local
# Or use S3
# STORAGE_PROVIDER=s3
# AWS_S3_BUCKET=your-bucket
# AWS_S3_REGION=us-east-1
# AWS_S3_ACCESS_KEY=your-access-key
# AWS_S3_SECRET_KEY=your-secret-key
```

See [environment-variables.md](environment-variables.md) for complete reference.

### Docker Compose Configuration

The `docker-compose.yml` includes:

- **app**: ServiceDesk application
- **postgres**: PostgreSQL database
- **redis**: Redis cache
- **nginx**: Reverse proxy
- **prometheus**: Metrics (optional, profile: monitoring)
- **grafana**: Dashboards (optional, profile: monitoring)
- **datadog**: APM (optional, profile: monitoring)

## Production Deployment

### 1. Use Production Docker Compose

```bash
# Use production override
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2. Build Optimized Image

```bash
# Build with metadata
docker build \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
  --tag servicedesk:$(git describe --tags --always) \
  --tag servicedesk:latest \
  .
```

### 3. Security Hardening

```yaml
# docker-compose.prod.yml
services:
  app:
    # Run as non-root user
    user: "1001:1001"

    # Read-only root filesystem
    read_only: true

    # Security options
    security_opt:
      - no-new-privileges:true

    # Drop all capabilities
    cap_drop:
      - ALL

    # Add only necessary capabilities
    cap_add:
      - NET_BIND_SERVICE

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 4. HTTPS with SSL Certificates

#### Using Let's Encrypt

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Generate certificates
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certificates stored in:
# /etc/letsencrypt/live/yourdomain.com/
```

#### Configure NGINX

```nginx
# nginx/conf.d/servicedesk.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Multi-Container Setup

### Start Specific Services

```bash
# App + Database only
docker-compose up -d app postgres

# With monitoring stack
docker-compose --profile monitoring up -d

# With admin tools
docker-compose --profile tools up -d
```

### Scale Application

```bash
# Run 3 app instances (requires load balancer)
docker-compose up -d --scale app=3
```

### Service Dependencies

The docker-compose ensures proper startup order:

```yaml
app:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

## Networking

### Default Network

All services communicate via the `servicedesk-network` bridge network:

```yaml
networks:
  servicedesk-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Expose Ports

```yaml
ports:
  - "3000:3000"    # App (external:internal)
  - "5432:5432"    # PostgreSQL
  - "6379:6379"    # Redis
  - "80:80"        # NGINX HTTP
  - "443:443"      # NGINX HTTPS
```

### Custom Network

```bash
# Create custom network
docker network create --driver bridge --subnet 10.0.0.0/24 servicedesk-custom

# Use in compose
docker-compose --network servicedesk-custom up -d
```

## Storage & Volumes

### Named Volumes

Persistent data stored in Docker volumes:

```yaml
volumes:
  postgres_data:      # Database files
  redis_data:         # Redis persistence
  app_data:           # Application data
  app_uploads:        # User uploads
  nginx_logs:         # NGINX logs
  prometheus_data:    # Metrics data
  grafana_data:       # Grafana dashboards
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect servicedesk_postgres_data

# Backup volume
docker run --rm \
  -v servicedesk_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore volume
docker run --rm \
  -v servicedesk_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /

# Remove unused volumes
docker volume prune
```

### Bind Mounts

For development, use bind mounts:

```yaml
# docker-compose.dev.yml
services:
  app:
    volumes:
      - ./:/app
      - /app/node_modules
      - /app/.next
```

## Security Hardening

### 1. User Permissions

```dockerfile
# Run as non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

USER nextjs
```

### 2. Read-Only Filesystem

```yaml
app:
  read_only: true
  tmpfs:
    - /tmp
    - /app/.next/cache
```

### 3. Drop Capabilities

```yaml
app:
  cap_drop:
    - ALL
  cap_add:
    - NET_BIND_SERVICE
```

### 4. Secrets Management

```bash
# Use Docker secrets (Swarm mode)
echo "my-secret" | docker secret create jwt_secret -

# Reference in compose
services:
  app:
    secrets:
      - jwt_secret
      - session_secret

secrets:
  jwt_secret:
    external: true
  session_secret:
    external: true
```

### 5. Network Security

```yaml
# Isolate database
services:
  postgres:
    networks:
      - backend
    # Don't expose ports externally
    expose:
      - "5432"

networks:
  backend:
    driver: bridge
    internal: true
```

## Monitoring

### Health Checks

All services include health checks:

```yaml
app:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Check Health Status

```bash
# View health status
docker-compose ps

# Inspect health
docker inspect --format='{{.State.Health.Status}}' servicedesk-app

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' servicedesk-app
```

### Monitoring Stack

Start with monitoring profile:

```bash
docker-compose --profile monitoring up -d
```

Access:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Check last 100 lines
docker-compose logs --tail=100 app

# Follow logs
docker-compose logs -f app

# Check specific container
docker logs servicedesk-app
```

### Database Connection Issues

```bash
# Check PostgreSQL health
docker-compose exec postgres pg_isready -U servicedesk

# Connect to database
docker-compose exec postgres psql -U servicedesk -d servicedesk

# Check connections
docker-compose exec postgres psql -U servicedesk -d servicedesk -c "SELECT * FROM pg_stat_activity;"
```

### Redis Connection Issues

```bash
# Test Redis connection
docker-compose exec redis redis-cli -a your-password ping

# Check Redis info
docker-compose exec redis redis-cli -a your-password info

# Monitor Redis commands
docker-compose exec redis redis-cli -a your-password monitor
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check container resource limits
docker inspect servicedesk-app | grep -A 10 "Memory"

# Increase resources in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 4G
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
echo "APP_PORT=3001" >> .env
```

### Clean Start

```bash
# Stop and remove all containers
docker-compose down

# Remove volumes (WARNING: deletes data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Fresh start
docker-compose up -d --build --force-recreate
```

## Best Practices

### 1. Use Tagged Images

```yaml
# Bad
image: postgres:latest

# Good
image: postgres:16-alpine
```

### 2. Layer Caching

```dockerfile
# Copy package.json first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Then copy source code
COPY . .
```

### 3. Multi-Stage Builds

Always use multi-stage builds to minimize image size:

```dockerfile
FROM node:20-alpine AS deps
# Install dependencies

FROM node:20-alpine AS builder
# Build application

FROM node:20-alpine AS runner
# Run application (smallest image)
```

### 4. Health Checks

Always define health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 5. Resource Limits

Set resource limits to prevent resource exhaustion:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### 6. Logging

Configure logging to prevent disk fill:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    compress: "true"
```

### 7. Regular Updates

```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d --force-recreate

# Remove unused images
docker image prune -a
```

### 8. Backup Strategy

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U servicedesk servicedesk | gzip > backup_$DATE.sql.gz
```

### 9. Secrets Management

Never commit secrets to git:

```bash
# Use .env file (gitignored)
echo ".env" >> .gitignore

# Or use external secrets manager
# - AWS Secrets Manager
# - HashiCorp Vault
# - Docker Secrets
```

### 10. Monitoring

Enable monitoring in production:

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Configure alerting
# - Prometheus alerts
# - Grafana notifications
# - Datadog monitors
```

## Production Checklist

Before deploying to production:

- [ ] Generate secure secrets (JWT, session, database passwords)
- [ ] Configure HTTPS with valid SSL certificates
- [ ] Set up database backups (automated daily)
- [ ] Configure monitoring and alerting
- [ ] Set resource limits on all containers
- [ ] Enable health checks
- [ ] Configure log rotation
- [ ] Set up firewall rules
- [ ] Test disaster recovery procedure
- [ ] Document deployment process
- [ ] Configure auto-restart policies
- [ ] Set up CI/CD pipeline
- [ ] Review security configurations
- [ ] Test under load
- [ ] Configure email notifications
- [ ] Set up CDN for static assets

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
- [Redis Docker](https://hub.docker.com/_/redis)
- [NGINX Docker](https://hub.docker.com/_/nginx)

## Support

For deployment issues:

- Check [Troubleshooting Guide](../operations/troubleshooting.md)
- Review [Production Checklist](production.md)
- Open an issue on GitHub
- Contact: devops@servicedesk.com
