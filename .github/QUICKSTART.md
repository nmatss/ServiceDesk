# CI/CD Quick Start Guide

Este guia fornece instruções passo a passo para ativar e configurar o pipeline CI/CD do ServiceDesk.

## 📋 Pré-requisitos

- ✅ Repositório no GitHub
- ✅ Acesso de Admin ao repositório
- ✅ Conta no Codecov (para coverage reports)

## 🚀 Setup em 5 Minutos

### Passo 1: Configure Secrets Obrigatórios

Vá em **Settings → Secrets and Variables → Actions → New repository secret**

#### Mínimo Necessário

```bash
CODECOV_TOKEN
```

**Como obter:**
1. Vá em https://codecov.io
2. Login com GitHub
3. Adicione seu repositório
4. Copie o token
5. Adicione como secret no GitHub

### Passo 2: Ative Branch Protection

Vá em **Settings → Branches → Add rule**

**Branch name pattern:** `main`

**Configurações mínimas:**
- ☑️ Require a pull request before merging
- ☑️ Require status checks to pass before merging
  - Selecione: `ci-success`
- ☑️ Require branches to be up to date before merging

Clique em **Create** ou **Save changes**

### Passo 3: Configure Environments

Vá em **Settings → Environments**

#### Environment: `staging`
1. Clique em **New environment**
2. Nome: `staging`
3. **Não adicione** protection rules (auto-deploy)
4. Clique em **Configure environment**

#### Environment: `production`
1. Clique em **New environment**
2. Nome: `production`
3. ☑️ **Required reviewers** - Adicione seu usuário
4. ☑️ **Wait timer** - 5 minutos (opcional)
5. Clique em **Save protection rules**

### Passo 4: Teste o Pipeline

```bash
# 1. Criar branch de teste
git checkout -b test/ci-pipeline

# 2. Fazer pequena mudança
echo "# CI/CD Test" >> test.md
git add test.md
git commit -m "test: validate CI pipeline"

# 3. Push e criar PR
git push origin test/ci-pipeline
```

Vá no GitHub e crie um Pull Request. O CI deve iniciar automaticamente!

### Passo 5: Verificar Status

1. Vá na aba **Actions** do repositório
2. Você deve ver o workflow **CI Pipeline** rodando
3. Aguarde ~8-10 minutos para completar
4. ✅ Todos os checks devem passar

**Se tudo passou:** 🎉 Pipeline configurado com sucesso!

---

## 🔧 Configuração Avançada (Opcional)

### Secrets Opcionais para Features Adicionais

#### Security Scanning

```bash
# Snyk (vulnerability scanning)
SNYK_TOKEN=<seu-token>

# FOSSA (license compliance)
FOSSA_API_KEY=<sua-api-key>

# Gitleaks (secret scanning)
GITLEAKS_LICENSE=<sua-licenca>
```

**Como obter:**
- Snyk: https://snyk.io → Account Settings → API Token
- FOSSA: https://fossa.com → Settings → API Tokens
- Gitleaks: https://gitleaks.io (optional, tem versão free)

#### Monitoring & Error Tracking

```bash
# Sentry
SENTRY_AUTH_TOKEN=<seu-token>
SENTRY_ORG=<sua-org>
SENTRY_PROJECT=servicedesk
```

**Como obter:**
1. Crie conta em https://sentry.io
2. Create new project (Next.js)
3. Settings → Developer Settings → Auth Tokens
4. Create token com scopes: `project:write`, `org:read`

#### Notifications

```bash
# Slack
SLACK_WEBHOOK_URL=<webhook-url>
SECURITY_SLACK_WEBHOOK=<webhook-url>
```

**Como obter:**
1. Vá em https://api.slack.com/apps
2. Create New App → From scratch
3. Incoming Webhooks → Activate
4. Add New Webhook to Workspace
5. Copie o Webhook URL

---

## 🌍 Deployment Setup

### Opção 1: AWS ECS

```bash
# Secrets necessários
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=us-east-1

# Staging
STAGING_URL=https://staging.example.com

# Production
PROD_URL=https://example.com
```

### Opção 2: Kubernetes

```bash
# Staging
KUBE_CONFIG=<base64-encoded-kubeconfig>
STAGING_URL=https://staging.example.com

# Production
KUBE_CONFIG_PROD=<base64-encoded-kubeconfig>
PROD_URL=https://example.com
```

**Encode kubeconfig:**
```bash
cat ~/.kube/config | base64 -w 0
```

### Opção 3: SSH (VPS/VM)

```bash
# Staging
STAGING_SSH_HOST=staging.example.com
STAGING_SSH_USER=deploy
STAGING_SSH_KEY=<private-key>
STAGING_SSH_PORT=22
STAGING_URL=https://staging.example.com

# Production
PROD_SSH_HOST=example.com
PROD_SSH_USER=deploy
PROD_SSH_KEY=<private-key>
PROD_SSH_PORT=22
PROD_URL=https://example.com
```

---

## ✅ Checklist de Validação

### Básico (Mínimo)
- [ ] CODECOV_TOKEN configurado
- [ ] Branch protection em `main`
- [ ] Environment `staging` criado
- [ ] Environment `production` criado (com approvals)
- [ ] CI pipeline passou em PR de teste

### Recomendado
- [ ] SNYK_TOKEN configurado
- [ ] SENTRY_AUTH_TOKEN configurado
- [ ] SLACK_WEBHOOK_URL configurado
- [ ] Security scanning rodando
- [ ] Coverage report aparecendo em PRs

### Avançado (Production-Ready)
- [ ] Deploy credentials configurados
- [ ] Smoke tests passando em staging
- [ ] Production deploy testado com tag
- [ ] Rollback testado
- [ ] Alertas funcionando (Slack/PagerDuty)

---

## 🎯 Workflows por Use Case

### Desenvolvedor Individual

**Mínimo:**
```bash
CODECOV_TOKEN  # Coverage reports
```

**Workflows ativos:**
- ✅ CI Pipeline
- ✅ Security Scanning (básico)
- ⚠️ Deploy (skip, sem credentials)

### Equipe Pequena (< 5 devs)

**Recomendado:**
```bash
CODECOV_TOKEN
SNYK_TOKEN
SLACK_WEBHOOK_URL
```

**Workflows ativos:**
- ✅ CI Pipeline
- ✅ Security Scanning
- ✅ Dependency Management
- ⚠️ Deploy (opcional)

### Empresa/Produção

**Completo:**
```bash
# CI/CD
CODECOV_TOKEN

# Security
SNYK_TOKEN
FOSSA_API_KEY

# Monitoring
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT

# Deployment
AWS_* ou KUBE_* ou SSH_*
STAGING_URL
PROD_URL

# Notifications
SLACK_WEBHOOK_URL
SECURITY_SLACK_WEBHOOK
PAGERDUTY_TOKEN
```

**Workflows ativos:**
- ✅ CI Pipeline
- ✅ Security Scanning
- ✅ Dependency Management
- ✅ Deploy Staging (auto)
- ✅ Deploy Production (manual)

---

## 🐛 Troubleshooting Comum

### CI Pipeline não está rodando

**Problema:** Push no PR mas nenhum workflow inicia

**Solução:**
1. Verifique se os arquivos estão em `.github/workflows/`
2. Vá em Settings → Actions → General
3. Verifique se Actions estão habilitadas
4. Workflow permissions: "Read and write permissions"

### Coverage report não aparece no PR

**Problema:** Testes passam mas sem coverage report

**Solução:**
1. Verifique se CODECOV_TOKEN está configurado
2. Vá em https://codecov.io e verifique o repositório
3. Check workflow logs do job `unit-tests`
4. Pode levar 1-2 minutos para aparecer

### Security scan failing com erro de token

**Problema:** Snyk ou FOSSA falhando com authentication error

**Solução:**
1. Verifique se os tokens estão corretos
2. Tokens têm permissões necessárias?
3. **Opcional:** Remova o step se não usar o serviço:
   ```yaml
   # Comentar ou remover este step se não usar Snyk
   - name: Run Snyk security scan
     uses: snyk/actions/node@master
     continue-on-error: true  # Já está tolerante a falhas
   ```

### Deploy failing - no credentials

**Problema:** Deploy workflows falhando por falta de credentials

**Solução:**

**Opção 1:** Configure as credentials (veja Deployment Setup acima)

**Opção 2:** Desabilite temporariamente os workflows de deploy:
1. Vá nos arquivos `.github/workflows/deploy-*.yml`
2. Adicione no topo:
   ```yaml
   on:
     workflow_dispatch:  # Apenas manual
   ```

**Opção 3:** Use conditional steps:
```yaml
- name: Deploy
  if: ${{ secrets.AWS_ACCESS_KEY_ID != '' }}
  # ... deploy steps
```

### Branch protection bloqueando merge

**Problema:** Não consigo fazer merge mesmo com aprovação

**Solução:**
1. Verifique se TODOS os required checks passaram
2. Branch está atualizada com `main`?
3. Tem a aprovação necessária?
4. Temporariamente: Settings → Branches → Edit rule → Desmarque algumas proteções

---

## 📊 Monitoramento

### Status dos Workflows

**GitHub Actions:**
- URL: `https://github.com/YOUR_USERNAME/ServiceDesk/actions`
- Veja todos os workflow runs
- Download de artifacts
- Logs detalhados

**Codecov:**
- URL: `https://codecov.io/gh/YOUR_USERNAME/ServiceDesk`
- Coverage trends
- File-by-file coverage
- PR comparisons

**GitHub Security:**
- URL: `https://github.com/YOUR_USERNAME/ServiceDesk/security`
- Dependabot alerts
- Code scanning (CodeQL, Semgrep, Trivy)
- Secret scanning

### Badges no README

Já adicionados! Atualize `YOUR_USERNAME`:

```markdown
[![CI Pipeline](https://github.com/YOUR_USERNAME/ServiceDesk/actions/workflows/ci.yml/badge.svg)](...)
```

---

## 🔄 Workflow de Desenvolvimento

### 1. Feature Development

```bash
git checkout -b feature/nova-funcionalidade
# ... fazer mudanças ...
git commit -m "feat: adicionar nova funcionalidade"
git push origin feature/nova-funcionalidade
```

**CI roda automaticamente:**
- Lint, type-check, tests
- Security scan
- Build verification

### 2. Code Review

1. Criar PR no GitHub
2. CI status checks aparecem
3. Reviewers verificam
4. Coverage report automático

### 3. Merge

1. Aprovação + CI green
2. Merge PR
3. **Deploy automático para staging**

### 4. Release

```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

**Deploy production:**
1. CI completo roda
2. Build de produção
3. **Aprovação manual requerida**
4. Deploy para produção
5. Smoke tests
6. GitHub Release criado

---

## 💡 Dicas

### Para Aprovadores

Ao aprovar deploy de produção:
1. Revise as mudanças no diff
2. Verifique se CI passou 100%
3. Check se staging está estável
4. Clique em "Review deployments" no workflow
5. Selecione `production` e "Approve and deploy"

### Para Troubleshooting

**Sempre:**
1. Check os workflow logs primeiro
2. Reproduza localmente: `npm run validate && npm test`
3. Veja a documentação: `.github/WORKFLOWS.md`

**Se tudo mais falhar:**
1. Re-run workflow no GitHub
2. Check se dependencies estão atualizados: `npm ci`
3. Limpar cache: `rm -rf node_modules .next && npm ci`

### Para Otimização

**Cache hit rates:**
- Verifique logs de setup-node
- ~90% hit rate é bom

**Build times:**
- CI completo: 8-10 min é normal
- Se > 15 min: investigar

**Coverage:**
- Target: 80%+
- < 70%: Adicionar testes

---

## 📚 Documentação Completa

- **Guia de Contribuição:** `CONTRIBUTING.md`
- **Documentação Técnica:** `.github/WORKFLOWS.md`
- **Resumo Executivo:** `.github/CI-CD-SUMMARY.md`
- **Arquitetura:** `CLAUDE.md`

---

## 🆘 Suporte

**Issues comuns:** Veja seção Troubleshooting acima

**Documentação técnica:** `.github/WORKFLOWS.md`

**Criar issue:** https://github.com/YOUR_USERNAME/ServiceDesk/issues

---

**Última atualização:** 2025-10-18

**Status:** ✅ Pronto para uso

**Tempo estimado de setup:** 5-15 minutos (dependendo do nível de configuração)
