# GitHub Actions Workflows Documentation

Esta documentação descreve todos os workflows CI/CD implementados no ServiceDesk.

## Visão Geral

O ServiceDesk possui 6 workflows principais:

1. **CI Pipeline** - Integração contínua
2. **Security Scanning** - Scanning de segurança
3. **Dependency Management** - Gerenciamento de dependências
4. **Deploy Staging** - Deploy automático para staging
5. **Deploy Production** - Deploy manual para produção
6. **Dependabot** - Atualizações automáticas de dependências

## 1. CI Pipeline

**Arquivo:** `.github/workflows/ci.yml`

### Triggers
- Push em `main` ou `develop`
- Pull requests para `main` ou `develop`
- Schedule diário (2 AM UTC)
- Manual dispatch

### Jobs

#### lint
- **Descrição:** Executa ESLint
- **Timeout:** 5 minutos
- **Ações:**
  - Checkout código
  - Setup Node.js 20
  - Install dependencies
  - Run ESLint
  - Anotar erros encontrados

#### format-check
- **Descrição:** Verifica formatação com Prettier
- **Timeout:** 5 minutos
- **Ações:**
  - Checkout código
  - Setup Node.js 20
  - Install dependencies
  - Check formatting

#### type-check
- **Descrição:** Validação de tipos TypeScript
- **Timeout:** 5 minutos
- **Ações:**
  - Checkout código
  - Setup Node.js 20
  - Install dependencies
  - Run type check

#### unit-tests
- **Descrição:** Testes unitários com Vitest
- **Timeout:** 10 minutos
- **Matrix:** Node 18 & 20
- **Ações:**
  - Checkout código
  - Setup Node.js
  - Install dependencies
  - Initialize test database
  - Run tests with coverage
  - Upload coverage to Codecov
  - Comment coverage on PR

#### e2e-tests
- **Descrição:** Testes E2E com Playwright
- **Timeout:** 20 minutos
- **Sharding:** 2 shards paralelos
- **Ações:**
  - Checkout código
  - Setup Node.js 20
  - Install dependencies
  - Install Playwright browsers
  - Initialize test database
  - Build application
  - Run E2E tests (sharded)
  - Upload Playwright report
  - Upload test results

#### security-audit
- **Descrição:** Auditoria de segurança npm
- **Timeout:** 5 minutos
- **Ações:**
  - Run npm audit
  - Check critical vulnerabilities
  - Run Snyk scan (opcional)

#### dependency-review
- **Descrição:** Review de dependências (PRs only)
- **Condição:** `github.event_name == 'pull_request'`
- **Ações:**
  - Dependency review action
  - Fail on moderate severity
  - Deny GPL/AGPL licenses

#### trivy-scan
- **Descrição:** Scan de vulnerabilidades Trivy
- **Timeout:** 10 minutos
- **Ações:**
  - Run Trivy filesystem scan
  - Upload SARIF to GitHub Security

#### build
- **Descrição:** Verificação de build
- **Timeout:** 10 minutos
- **Matrix:** Node 18 & 20
- **Needs:** lint, format-check, type-check
- **Ações:**
  - Validate environment
  - Build application
  - Check build output
  - Check bundle size (max 100MB)
  - Upload build artifacts

#### bundle-size
- **Descrição:** Análise de tamanho do bundle
- **Timeout:** 10 minutos
- **Condição:** PRs only
- **Needs:** build
- **Ações:**
  - Build with analyzer
  - Upload bundle analysis

#### migration-check
- **Descrição:** Verificação de migrations
- **Timeout:** 5 minutos
- **Ações:**
  - Check migration status
  - Test database initialization
  - Verify database connection

#### ci-success
- **Descrição:** Job final de verificação
- **Needs:** Todos os jobs anteriores
- **Ações:**
  - Check all job statuses
  - Post success comment on PR

### Artifacts Gerados
- `coverage-unit-tests` - Coverage reports (7 dias)
- `playwright-report-shard-*` - Playwright HTML reports (7 dias)
- `playwright-results-shard-*` - Test results (7 dias)
- `build-output` - Next.js build output (7 dias)
- `bundle-analysis` - Bundle analyzer reports (7 dias)

### Otimizações
- Concurrency control para cancelar runs duplicados
- Cache de `node_modules`
- Matrix builds paralelos
- Test sharding para performance
- Fail-fast desabilitado para ver todos os erros

---

## 2. Security Scanning

**Arquivo:** `.github/workflows/security.yml`

### Triggers
- Push em `main` ou `develop`
- Pull requests
- Schedule diário (3 AM UTC)
- Manual dispatch

### Jobs

#### codeql
- **Descrição:** CodeQL static analysis
- **Timeout:** 30 minutos
- **Matrix:** javascript, typescript
- **Ações:**
  - Initialize CodeQL
  - Autobuild
  - Perform analysis
  - Upload to Security tab

#### secret-scan
- **Descrição:** Scanning de secrets
- **Ações:**
  - TruffleHog scan
  - Gitleaks scan

#### sast
- **Descrição:** Static Application Security Testing
- **Ações:**
  - ESLint security plugin
  - Semgrep SAST (OWASP Top 10)
  - Upload SARIF results

#### dependency-scan
- **Descrição:** Scan de vulnerabilidades em deps
- **Ações:**
  - npm audit
  - Snyk scan (opcional)
  - Trivy filesystem scan
  - Upload SARIF results

#### container-scan
- **Descrição:** Security scan de container
- **Condição:** Não em PRs
- **Ações:**
  - Build Docker image
  - Trivy container scan
  - Docker Bench Security

#### iac-scan
- **Descrição:** Infrastructure as Code scan
- **Ações:**
  - Checkov IaC scan
  - Upload SARIF results

#### api-security
- **Descrição:** API security testing
- **Condição:** Não em schedules
- **Ações:**
  - Build and start app
  - OWASP ZAP API scan
  - Upload ZAP results

#### license-compliance
- **Descrição:** Verificação de licenças
- **Ações:**
  - FOSSA license scan
  - license-checker validation

#### security-headers
- **Descrição:** Verificação de security headers
- **Condição:** Não em schedules
- **Ações:**
  - Start application
  - Check security headers

#### security-report
- **Descrição:** Relatório consolidado
- **Needs:** Todos os scans
- **Ações:**
  - Generate summary
  - Create issue se houver falhas

#### notify
- **Descrição:** Notificações
- **Needs:** security-report
- **Ações:**
  - Send Slack notification

### Artifacts Gerados
- `eslint-security-results` - ESLint results (30 dias)
- `snyk-results` - Snyk scan results (30 dias)
- `zap-results` - OWASP ZAP results (30 dias)

### SARIF Reports
Todos os scans geram SARIF reports automaticamente enviados para GitHub Security tab:
- CodeQL
- Semgrep
- Trivy (filesystem + container)
- Checkov

---

## 3. Dependency Management

**Arquivo:** `.github/workflows/dependencies.yml`

### Triggers
- Schedule semanal (Segundas 9 AM UTC)
- Manual dispatch
- Pull requests que modificam `package.json` ou `package-lock.json`

### Jobs

#### dependency-analysis
- **Descrição:** Análise de dependências
- **Ações:**
  - Check outdated dependencies
  - Upload outdated report
  - Check dependency count

#### security-audit
- **Descrição:** Auditoria de segurança
- **Ações:**
  - npm audit
  - Parse audit results
  - Create issue se houver vulnerabilidades

#### license-check
- **Descrição:** Verificação de licenças
- **Ações:**
  - Install license-checker
  - Check licenses
  - Verify compliant licenses
  - Upload license report

#### auto-update
- **Descrição:** Atualizações automáticas
- **Condição:** Apenas em schedules
- **Ações:**
  - Update dependencies
  - Run tests
  - Create Pull Request

#### bundle-impact
- **Descrição:** Impacto no bundle size
- **Condição:** Apenas em PRs
- **Ações:**
  - Build base branch
  - Build PR branch
  - Calculate difference
  - Comment on PR

#### dependency-graph
- **Descrição:** Grafo de dependências
- **Condição:** Apenas em schedules
- **Ações:**
  - Generate dependency graph
  - Upload graph

#### summary
- **Descrição:** Resumo consolidado
- **Needs:** Todos os jobs
- **Ações:**
  - Create summary report

### Artifacts Gerados
- `outdated-dependencies` - Outdated deps report (30 dias)
- `npm-audit-report` - Audit report (30 dias)
- `license-report` - License report (90 dias)
- `dependency-graph` - Dependency graph SVG (30 dias)

---

## 4. Deploy Staging

**Arquivo:** `.github/workflows/deploy-staging.yml`

### Triggers
- Push em `main` ou `develop`
- Manual dispatch

### Jobs

#### build-and-push
- **Descrição:** Build e push de Docker image
- **Permissions:** contents:read, packages:write
- **Outputs:** image-tag, image-digest
- **Ações:**
  - Build Docker image
  - Push to GitHub Container Registry
  - Generate SBOM
  - Upload SBOM artifact

#### deploy-staging
- **Descrição:** Deploy para staging
- **Needs:** build-and-push
- **Environment:** staging
- **Ações:**
  - Deploy to ECS (AWS) OU
  - Deploy to Kubernetes OU
  - Deploy via SSH

#### smoke-tests
- **Descrição:** Smoke tests
- **Needs:** deploy-staging
- **Ações:**
  - Health check
  - Run smoke tests
  - API endpoint tests
  - Database connectivity test

#### performance-test
- **Descrição:** Performance testing
- **Needs:** smoke-tests
- **Ações:**
  - k6 load test
  - Lighthouse audit

#### rollback
- **Descrição:** Rollback automático
- **Needs:** deploy-staging, smoke-tests
- **Condição:** Se deploy ou smoke tests falharem
- **Ações:**
  - Rollback deployment
  - Notify team

#### notify-success
- **Descrição:** Notificação de sucesso
- **Needs:** Todos os jobs
- **Condição:** Sucesso
- **Ações:**
  - Send Slack notification

### Artifacts Gerados
- `sbom` - Software Bill of Materials

---

## 5. Deploy Production

**Arquivo:** `.github/workflows/deploy-production.yml`

### Triggers
- Tags `v*`
- Manual dispatch (com input de versão)

### Jobs

#### ci-checks
- **Descrição:** Executa CI pipeline completo
- **Ações:**
  - Reusa workflow `.github/workflows/ci.yml`

#### build-and-push
- **Descrição:** Build production image
- **Needs:** ci-checks
- **Permissions:** contents:read, packages:write
- **Outputs:** image-tag, image-digest, version
- **Ações:**
  - Extract version
  - Build Docker image
  - Push to registry
  - Generate SBOM
  - Sign container (Cosign)

#### sentry-release
- **Descrição:** Criar release no Sentry
- **Needs:** build-and-push
- **Ações:**
  - Build application
  - Create Sentry release
  - Upload sourcemaps
  - Finalize release

#### deploy-production
- **Descrição:** Deploy para produção
- **Needs:** build-and-push, sentry-release
- **Environment:** production (manual approval)
- **Ações:**
  - Create deployment backup
  - Deploy to ECS/Kubernetes/SSH
  - Run database migrations
  - Notify Sentry of deployment

#### smoke-tests
- **Descrição:** Production smoke tests
- **Needs:** deploy-production
- **Ações:**
  - Health check com retry
  - Critical path tests
  - Verify API endpoints
  - Check error rates

#### synthetic-tests
- **Descrição:** Synthetic monitoring
- **Needs:** smoke-tests
- **Ações:**
  - Datadog Synthetics
  - Lighthouse production audit

#### rollback
- **Descrição:** Rollback em caso de falha
- **Needs:** deploy-production, smoke-tests
- **Condição:** Se houver falha
- **Environment:** production
- **Ações:**
  - Notify team (Slack)
  - Create PagerDuty incident
  - Auto rollback (se habilitado)

#### notify-success
- **Descrição:** Notificação de sucesso
- **Needs:** Todos os jobs
- **Condição:** Sucesso
- **Ações:**
  - Send Slack notification
  - Create GitHub Release
  - Update status page

### Artifacts Gerados
- `sbom-production` - Production SBOM (90 dias)

### Manual Approval
O job `deploy-production` requer aprovação manual através de GitHub Environments.

---

## 6. Dependabot

**Arquivo:** `.github/dependabot.yml`

### Configuração

#### npm
- **Schedule:** Semanal (Segundas 9 AM BRT)
- **Open PRs limit:** 10
- **Groups:**
  - `production-dependencies` - Deps de produção (minor/patch)
  - `development-dependencies` - Deps de dev (minor/patch)
  - `security-updates` - Updates de segurança
- **Ignores:**
  - `next` - Major updates
  - `react` - Major updates
  - `react-dom` - Major updates

#### github-actions
- **Schedule:** Semanal (Segundas 9 AM BRT)
- **Open PRs limit:** 5

#### docker
- **Schedule:** Semanal (Segundas 9 AM BRT)
- **Open PRs limit:** 3

### Labels Automáticos
- `dependencies`
- `automated`
- Específicos: `github-actions`, `docker`

---

## Secrets Necessários

### Obrigatórios
```bash
CODECOV_TOKEN              # Coverage upload
```

### Opcionais

#### Security
```bash
SNYK_TOKEN                 # Snyk scanning
FOSSA_API_KEY              # License compliance
GITLEAKS_LICENSE           # Gitleaks scanning
```

#### Monitoring
```bash
SENTRY_AUTH_TOKEN          # Sentry integration
SENTRY_ORG                 # Sentry organization
SENTRY_PROJECT             # Sentry project
```

#### Deployment
```bash
AWS_ACCESS_KEY_ID          # AWS ECS deployment
AWS_SECRET_ACCESS_KEY      # AWS credentials
AWS_REGION                 # AWS region
KUBE_CONFIG                # Kubernetes staging
KUBE_CONFIG_PROD           # Kubernetes production
STAGING_SSH_HOST           # SSH staging
STAGING_SSH_USER           # SSH user
STAGING_SSH_KEY            # SSH private key
PROD_SSH_HOST              # SSH production
PROD_SSH_USER              # SSH user
PROD_SSH_KEY               # SSH private key
STAGING_URL                # Staging URL
PROD_URL                   # Production URL
```

#### Notifications
```bash
SLACK_WEBHOOK_URL          # Slack notifications
SECURITY_SLACK_WEBHOOK     # Security team notifications
PAGERDUTY_TOKEN            # PagerDuty incidents
PAGERDUTY_SERVICE_ID       # PagerDuty service
STATUSPAGE_API_KEY         # Status page updates
```

#### Container Security
```bash
COSIGN_PRIVATE_KEY         # Container signing
COSIGN_PASSWORD            # Cosign password
```

#### Performance
```bash
K6_CLOUD_TOKEN             # k6 cloud
LHCI_GITHUB_APP_TOKEN      # Lighthouse CI
DATADOG_API_KEY            # Datadog (se usado)
```

---

## Branch Protection

Configure em GitHub Settings → Branches → Branch protection rules:

### Branch: `main`

**Required status checks:**
- lint
- format-check
- type-check
- unit-tests (Node 18 & 20)
- e2e-tests (Shard 1 & 2)
- security-audit
- trivy-scan
- build (Node 18 & 20)
- migration-check

**Other rules:**
- Require pull request reviews (1 approval)
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators
- Restrict who can push to matching branches (admins only)

---

## Environments

Configure em GitHub Settings → Environments:

### staging
- **Protection rules:** None (auto-deploy)
- **Secrets:**
  - `STAGING_URL`
  - `STAGING_SSH_HOST`
  - `STAGING_SSH_USER`
  - `STAGING_SSH_KEY`

### production
- **Protection rules:**
  - Required reviewers (1-2 pessoas)
  - Wait timer: 5 minutes
- **Secrets:**
  - `PROD_URL`
  - `PROD_SSH_HOST`
  - `PROD_SSH_USER`
  - `PROD_SSH_KEY`
  - `AUTO_ROLLBACK` (true/false)

---

## CodeQL Configuration

**Arquivo:** `.github/codeql/codeql-config.yml`

### Queries
- security-extended
- security-and-quality

### Paths Ignored
- node_modules
- .next
- dist, build, coverage
- Test files (**/*.test.ts, **/*.spec.ts)
- tests/, playwright-report/

### Paths Included
- app
- lib
- components
- middleware.ts

### Disabled Queries
- js/unused-local-variable
- js/useless-assignment-to-local

---

## Performance Metrics

### Tempos Médios (Estimados)

| Workflow | Tempo |
|----------|-------|
| CI Pipeline (completo) | 8-10 min |
| Security Scanning | 15-20 min |
| Dependencies | 5-7 min |
| Deploy Staging | 5-7 min |
| Deploy Production | 10-15 min |

### Otimizações Implementadas

- ✅ Cache de node_modules
- ✅ Matrix builds paralelos
- ✅ Test sharding (Playwright)
- ✅ Docker layer caching
- ✅ Concurrency control
- ✅ Fail-fast strategy (quando apropriado)
- ✅ Artifacts compactados
- ✅ Timeouts agressivos

---

## Troubleshooting

### CI Pipeline Failing

**Lint errors:**
```bash
npm run lint:fix
```

**Type errors:**
```bash
npm run type-check
# Fix manualmente
```

**Tests failing:**
```bash
npm run test:unit:watch
npm run test:e2e -- --ui
```

**Build failing:**
```bash
rm -rf node_modules .next
npm ci
npm run build
```

### Security Scan Failing

**Critical vulnerabilities:**
```bash
npm audit fix
# Ou fix manualmente
```

**Secret detected:**
- Rotate secret imediatamente
- Remove do histórico do git
- Update em todos os ambientes

### Deploy Failing

**Smoke tests failing:**
- Check application logs
- Verify database connection
- Check environment variables

**Rollback não funciona:**
- Manual rollback via cloud console
- Check rollback script logs

---

## Manutenção

### Atualizar Workflows

1. Editar arquivo `.github/workflows/*.yml`
2. Testar localmente com [act](https://github.com/nektos/act)
3. Commit e push
4. Verificar execução no Actions tab

### Adicionar Novo Job

1. Adicionar job no workflow apropriado
2. Configurar dependencies (`needs:`)
3. Atualizar branch protection se necessário
4. Documentar neste arquivo

### Atualizar Actions

Dependabot atualiza automaticamente as actions semanalmente.

Para atualizar manualmente:
```bash
# Ver actions usadas
grep 'uses:' .github/workflows/*.yml

# Atualizar versão
# Ex: actions/checkout@v3 → actions/checkout@v4
```

---

## Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [SARIF Format](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)

---

**Última atualização:** 2025-10-18
