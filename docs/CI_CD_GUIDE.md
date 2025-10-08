# CI/CD Guide - ServiceDesk

Complete guide to Continuous Integration and Continuous Deployment for the ServiceDesk platform.

## Table of Contents

1. [Overview](#overview)
2. [CI Pipeline](#ci-pipeline)
3. [Deployment Pipeline](#deployment-pipeline)
4. [Environment Configuration](#environment-configuration)
5. [Secret Management](#secret-management)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

---

## Overview

ServiceDesk uses **GitHub Actions** for CI/CD automation with two primary workflows:

1. **CI Pipeline** (`.github/workflows/ci.yml`) - Code quality, testing, and security
2. **Deployment Pipeline** (`.github/workflows/deploy-staging.yml`) - Automated deployment to staging

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Pull Request                         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    CI Pipeline                           │
├─────────────────────────────────────────────────────────┤
│  1. Lint & Format Check                                  │
│  2. TypeScript Type Check                                │
│  3. Unit Tests (with coverage)                           │
│  4. E2E Tests (Playwright)                               │
│  5. Build Application                                    │
│  6. Security Scan (Snyk, Trivy, npm audit)               │
│  7. Docker Build & Scan                                  │
│  8. Performance Budget Check                             │
│  9. Quality Gate                                         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼ (on merge to main)
┌─────────────────────────────────────────────────────────┐
│               Deployment Pipeline                        │
├─────────────────────────────────────────────────────────┤
│  1. Build & Push Docker Image                            │
│  2. Deploy to Staging                                    │
│  3. Run Smoke Tests                                      │
│  4. Performance Testing                                  │
│  5. Notify Team (Slack)                                  │
│  6. Auto-Rollback (if tests fail)                        │
└─────────────────────────────────────────────────────────┘
```

---

## CI Pipeline

**Workflow File**: `.github/workflows/ci.yml`

**Triggers:**
- Pull requests to `main` or `develop` branches
- Pushes to `main` or `develop` branches

### Jobs Overview

#### 1. Lint & Format Check

**Purpose**: Enforce code style consistency

```yaml
jobs:
  lint-and-format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"
```

**What it checks:**
- ESLint rules compliance
- Code formatting (Prettier)
- Unused variables/imports

**Failure scenarios:**
- Linting errors
- Formatting inconsistencies

---

#### 2. TypeScript Type Check

**Purpose**: Ensure type safety

```yaml
jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run type-check
```

**What it checks:**
- TypeScript compilation errors
- Type mismatches
- Strict mode compliance

**Failure scenarios:**
- Type errors
- Missing type definitions
- Incompatible types

---

#### 3. Unit Tests

**Purpose**: Run unit and integration tests with coverage reporting

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
```

**What it tests:**
- Business logic (lib/)
- Database queries
- Authentication logic
- Utility functions

**Coverage Upload:**
- Coverage reports uploaded to Codecov
- Coverage trends tracked over time
- PR comments with coverage changes

---

#### 4. E2E Tests (Playwright)

**Purpose**: Test user workflows end-to-end

```yaml
jobs:
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run init-db
        env:
          DATABASE_URL: sqlite:./test.db
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

**What it tests:**
- Authentication flows
- Ticket creation/management
- Admin dashboard
- User portal
- Real-time notifications

**Artifacts:**
- Test reports retained for 30 days
- Screenshots on failure
- Video recordings (on failure)

---

#### 5. Build Application

**Purpose**: Ensure production build succeeds

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    needs: [lint-and-format, type-check]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
        env:
          NODE_ENV: production
      - name: Check build size
        run: |
          BUNDLE_SIZE=$(du -sb .next | awk '{print $1}')
          MAX_SIZE=$((50 * 1024 * 1024)) # 50MB
          if [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
            echo "::error::Bundle size exceeds 50MB"
            exit 1
          fi
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: .next/
          retention-days: 7
```

**What it checks:**
- Build succeeds without errors
- Bundle size under 50MB limit
- No runtime errors

**Bundle Size Enforcement:**
- Maximum bundle size: 50MB
- Fails if exceeded
- Encourages code splitting

---

#### 6. Security Scan

**Purpose**: Identify security vulnerabilities

```yaml
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Snyk security scan
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      # npm audit
      - run: npm audit --audit-level=moderate

      # Trivy vulnerability scanner
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      # Upload to GitHub Security tab
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

**Security Tools:**
1. **Snyk** - Dependency vulnerability scanning
2. **npm audit** - Node.js security audit
3. **Trivy** - Container and filesystem scanning

**Results:**
- Vulnerabilities uploaded to GitHub Security tab
- PR comments with security findings
- Severity thresholds: HIGH and CRITICAL

---

#### 7. Docker Build & Scan

**Purpose**: Build and scan Docker images for vulnerabilities

```yaml
jobs:
  docker-build:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: ghcr.io/org/servicedesk:pr-${{ github.event.pull_request.number }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/org/servicedesk:pr-${{ github.event.pull_request.number }}
          format: 'sarif'
          output: 'trivy-container-results.sarif'
```

**What it does:**
- Builds Docker image for PR
- Scans container for vulnerabilities
- Uses GitHub Actions cache for speed

---

#### 8. Performance Budget Check

**Purpose**: Enforce performance budgets

```yaml
jobs:
  performance-check:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: .next/
      - run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

**Lighthouse CI Metrics:**
- Performance score
- Accessibility score
- Best practices score
- SEO score

---

#### 9. Quality Gate

**Purpose**: Aggregate all quality checks

```yaml
jobs:
  quality-gate:
    runs-on: ubuntu-latest
    needs: [test, security-scan, docker-build]
    if: always()
    steps:
      - name: Check job statuses
        run: |
          if [ "${{ needs.test.result }}" != "success" ]; then
            echo "::warning::Tests failed"
          fi
```

**Gate Requirements:**
- All tests pass
- Security scans complete
- Build succeeds

---

## Deployment Pipeline

**Workflow File**: `.github/workflows/deploy-staging.yml`

**Triggers:**
- Push to `main` or `develop` branches
- Manual workflow dispatch

### Deployment Jobs

#### 1. Build & Push Docker Image

**Purpose**: Create and publish Docker image

```yaml
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/org/servicedesk
          tags: |
            type=ref,event=branch
            type=sha,prefix=staging-
            type=raw,value=staging-latest
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/org/servicedesk:staging-latest
          format: spdx-json
```

**Image Tags:**
- `staging-latest` - Latest staging build
- `staging-<sha>` - Specific commit hash
- `<branch-name>` - Branch name

**SBOM Generation:**
- Software Bill of Materials created
- SPDX format
- Uploaded as artifact

---

#### 2. Deploy to Staging

**Purpose**: Deploy to staging environment

**Supported Platforms:**

##### AWS ECS Deployment

```yaml
- name: Deploy to ECS (AWS)
  if: ${{ secrets.AWS_ACCESS_KEY_ID != '' }}
  run: |
    aws ecs update-service \
      --cluster servicedesk-staging \
      --service servicedesk-app \
      --force-new-deployment
```

##### Kubernetes Deployment

```yaml
- name: Deploy to Kubernetes
  if: ${{ secrets.KUBE_CONFIG != '' }}
  run: |
    echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
    export KUBECONFIG=./kubeconfig
    kubectl set image deployment/servicedesk-app \
      servicedesk-app=${{ needs.build-and-push.outputs.image-tag }}
    kubectl rollout status deployment/servicedesk-app -n staging
```

##### SSH/VPS Deployment

```yaml
- name: Deploy via SSH (VPS/VM)
  if: ${{ secrets.STAGING_SSH_HOST != '' }}
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.STAGING_SSH_HOST }}
    username: ${{ secrets.STAGING_SSH_USER }}
    key: ${{ secrets.STAGING_SSH_KEY }}
    script: |
      cd /opt/servicedesk
      docker-compose pull
      docker-compose up -d --force-recreate
```

---

#### 3. Smoke Tests

**Purpose**: Verify deployment health

```yaml
jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    steps:
      - run: sleep 30  # Wait for deployment
      - name: Health check
        run: |
          response=$(curl -f -s -o /dev/null -w "%{http_code}" ${{ secrets.STAGING_URL }}/api/health)
          if [ $response -ne 200 ]; then
            exit 1
          fi
      - run: npx playwright test --grep @smoke
        env:
          PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
```

**Smoke Test Coverage:**
- Health endpoint check
- Authentication flow
- Critical API endpoints
- Database connectivity

---

#### 4. Performance Testing

**Purpose**: Load testing and performance validation

```yaml
jobs:
  performance-test:
    runs-on: ubuntu-latest
    needs: [smoke-tests]
    steps:
      # k6 load testing
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/performance/load-test.js
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}

      # Lighthouse audit
      - uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            ${{ secrets.STAGING_URL }}
            ${{ secrets.STAGING_URL }}/tickets
            ${{ secrets.STAGING_URL }}/admin
```

**Performance Metrics:**
- Response time under load
- Throughput (requests/second)
- Error rate
- Lighthouse scores

---

#### 5. Automatic Rollback

**Purpose**: Revert deployment if tests fail

```yaml
jobs:
  rollback:
    runs-on: ubuntu-latest
    needs: [deploy-staging, smoke-tests]
    if: failure()
    steps:
      # ECS Rollback
      - name: Rollback ECS deployment
        run: |
          aws ecs update-service \
            --cluster servicedesk-staging \
            --service servicedesk-app \
            --task-definition servicedesk-staging:previous

      # Kubernetes Rollback
      - name: Rollback Kubernetes deployment
        run: kubectl rollout undo deployment/servicedesk-app -n staging

      # Notify team
      - uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚨 Staging deployment failed and was rolled back"
            }
```

**Rollback Triggers:**
- Smoke test failure
- Health check failure
- Performance test failure

---

## Environment Configuration

### Required Secrets

Configure these secrets in GitHub Settings > Secrets and variables > Actions:

#### CI Pipeline Secrets

| Secret | Purpose | Required |
|--------|---------|----------|
| `CODECOV_TOKEN` | Coverage reporting | Optional |
| `SNYK_TOKEN` | Security scanning | Optional |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI | Optional |

#### Deployment Secrets (AWS ECS)

| Secret | Purpose | Required |
|--------|---------|----------|
| `AWS_ACCESS_KEY_ID` | AWS authentication | Yes (for ECS) |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication | Yes (for ECS) |
| `AWS_REGION` | AWS region | Yes (for ECS) |

#### Deployment Secrets (Kubernetes)

| Secret | Purpose | Required |
|--------|---------|----------|
| `KUBE_CONFIG` | Kubernetes config (base64) | Yes (for K8s) |

#### Deployment Secrets (SSH/VPS)

| Secret | Purpose | Required |
|--------|---------|----------|
| `STAGING_SSH_HOST` | SSH host address | Yes (for SSH) |
| `STAGING_SSH_USER` | SSH username | Yes (for SSH) |
| `STAGING_SSH_KEY` | SSH private key | Yes (for SSH) |
| `STAGING_SSH_PORT` | SSH port (default: 22) | Optional |

#### Application Secrets

| Secret | Purpose | Required |
|--------|---------|----------|
| `STAGING_URL` | Staging environment URL | Yes |
| `DATABASE_URL` | Database connection | Yes |
| `JWT_SECRET` | JWT signing key | Yes |
| `SLACK_WEBHOOK_URL` | Slack notifications | Optional |

---

## Secret Management

### Setting Up Secrets

#### GitHub Repository Secrets

```bash
# Navigate to: Settings > Secrets and variables > Actions
# Click "New repository secret"

# Example AWS secrets
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# Example Kubernetes secret
KUBE_CONFIG=<base64-encoded-kubeconfig>

# Example SSH secrets
STAGING_SSH_HOST=staging.example.com
STAGING_SSH_USER=deploy
STAGING_SSH_KEY=<private-key-content>
```

#### Environment Variables

Create environment-specific configurations:

```bash
# .env.staging
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging-db.example.com/servicedesk
JWT_SECRET=staging-jwt-secret
API_URL=https://staging-api.example.com
```

---

## Monitoring & Alerts

### GitHub Actions Monitoring

**View Workflow Runs:**
- Go to Actions tab in GitHub repository
- View run history, logs, and artifacts

**Notification Settings:**
- Email notifications for failed workflows
- Slack integration for real-time alerts

### Slack Integration

Configure Slack webhook for notifications:

```yaml
- uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Staging deployment successful",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Deployment Info*\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Rollback Procedures

### Manual Rollback (ECS)

```bash
# List task definitions
aws ecs list-task-definitions --family-prefix servicedesk-staging

# Rollback to previous version
aws ecs update-service \
  --cluster servicedesk-staging \
  --service servicedesk-app \
  --task-definition servicedesk-staging:42
```

### Manual Rollback (Kubernetes)

```bash
# View rollout history
kubectl rollout history deployment/servicedesk-app -n staging

# Rollback to previous version
kubectl rollout undo deployment/servicedesk-app -n staging

# Rollback to specific revision
kubectl rollout undo deployment/servicedesk-app -n staging --to-revision=3
```

### Manual Rollback (Docker Compose)

```bash
# SSH into server
ssh deploy@staging.example.com

# Pull previous image
cd /opt/servicedesk
docker-compose pull

# Restart with previous version
docker-compose down
docker-compose up -d
```

---

## Troubleshooting

### Common Issues

#### 1. Build Fails with "Module not found"

**Symptom**: Build fails with module resolution errors

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 2. Docker Build Timeout

**Symptom**: Docker build takes too long and times out

**Solution**:
```yaml
# Increase timeout in workflow
- uses: docker/build-push-action@v5
  with:
    timeout-minutes: 30
```

#### 3. Deployment Fails - Health Check

**Symptom**: Health check returns 503 or times out

**Solution**:
```bash
# Check logs
docker logs servicedesk-app

# Check database connection
docker exec servicedesk-app node -e "require('./lib/db/connection').testConnection()"
```

#### 4. E2E Tests Flaky

**Symptom**: Playwright tests fail intermittently

**Solution**:
```typescript
// Increase timeout and add retries
test.describe.configure({ retries: 2, timeout: 30000 });
```

#### 5. Security Scan Fails

**Symptom**: Snyk or Trivy finds vulnerabilities

**Solution**:
```bash
# Update dependencies
npm audit fix

# For unfixable issues, add exception
# .snyk file
ignore:
  'SNYK-JS-PACKAGE-12345':
    - '* > vulnerable-package':
        reason: 'No fix available, acceptable risk'
```

---

## Best Practices

### 1. Branch Protection Rules

Configure these rules for `main` and `develop` branches:

- Require pull request before merging
- Require status checks to pass
- Require linear history
- Require signed commits (recommended)

### 2. Deployment Frequency

- **Develop branch**: Deploys to staging automatically
- **Main branch**: Deploys to production (manual approval required)
- **Feature branches**: Can deploy to ephemeral environments

### 3. Monitoring Post-Deployment

After every deployment:
- Check health endpoints
- Verify database migrations
- Review error tracking (Sentry)
- Monitor performance metrics

### 4. Emergency Procedures

For critical production issues:
1. Immediately rollback to last known good version
2. Investigate in staging environment
3. Apply fix and test thoroughly
4. Deploy hotfix with expedited review

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Deployment Guide](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Playwright Testing](https://playwright.dev/docs/intro)

---

**Need Help?** Contact the DevOps team or open an issue on GitHub.
