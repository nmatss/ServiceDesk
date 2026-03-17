# Guia de Deploy - ServiceDesk

Guia completo para deploy em producao do ServiceDesk, cobrindo Vercel, Docker e Kubernetes.

---

## Sumario

1. [Pre-requisitos](#1-pre-requisitos)
2. [Configuracao do Banco de Dados (Supabase)](#2-configuracao-do-banco-de-dados-supabase)
3. [Variaveis de Ambiente](#3-variaveis-de-ambiente)
4. [Deploy na Vercel](#4-deploy-na-vercel)
5. [Deploy com Docker](#5-deploy-com-docker)
6. [Deploy Kubernetes](#6-deploy-kubernetes)
7. [Servicos Externos](#7-servicos-externos)
8. [Checklist Pre-Deploy](#8-checklist-pre-deploy)
9. [Monitoramento Pos-Deploy](#9-monitoramento-pos-deploy)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Pre-requisitos

### Software

| Requisito | Versao Minima | Uso |
|---|---|---|
| Node.js | 18+ (recomendado 20 LTS) | Runtime da aplicacao |
| npm | 9+ | Gerenciador de pacotes |
| Git | 2.30+ | Controle de versao |
| Docker (opcional) | 24+ | Deploy containerizado |
| Docker Compose (opcional) | 2.20+ | Orquestracao local |

### Contas e Servicos

| Servico | Obrigatorio | Finalidade |
|---|---|---|
| **Supabase** | Sim | Banco de dados PostgreSQL em producao |
| **Vercel** ou Docker host | Sim | Hospedagem da aplicacao |
| **Sentry** | Recomendado | Monitoramento de erros |
| **Stripe** | Se usar billing | Pagamentos e assinaturas |
| **Resend** ou SMTP | Recomendado | Envio de e-mails transacionais |
| **Redis/Upstash** | Recomendado | Cache e rate limiting |
| **Datadog** | Opcional | APM e metricas avancadas |

### Geracao de Secrets

Antes de iniciar, gere todos os secrets necessarios. Execute os comandos abaixo e guarde os valores em local seguro:

```bash
# Gerar todos os secrets de uma vez
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "SESSION_SECRET=$(openssl rand -hex 64)"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "CSRF_SECRET=$(openssl rand -hex 32)"
echo "MFA_SECRET=$(openssl rand -hex 32)"
echo "SSO_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
echo "REDIS_PASSWORD=$(openssl rand -hex 32)"
```

> **IMPORTANTE**: Cada secret DEVE ser unico. Nunca reutilize o mesmo valor para secrets diferentes. Nunca commite secrets reais no controle de versao.

---

## 2. Configuracao do Banco de Dados (Supabase)

### 2.1 Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em **New Project**
3. Escolha a organizacao e defina:
   - **Nome**: `servicedesk` (ou outro de sua preferencia)
   - **Senha do banco**: Use a senha gerada em `POSTGRES_PASSWORD`
   - **Regiao**: `South America (Sao Paulo)` para menor latencia no Brasil, ou `US East` conforme necessidade
4. Aguarde a criacao do projeto (1-2 minutos)

### 2.2 Obter Credenciais de Conexao

No dashboard do Supabase, acesse **Settings > Database** e anote:

| Campo | Onde encontrar | Exemplo |
|---|---|---|
| Host (Pooler) | Connection string > Connection pooling | `aws-0-sa-east-1.pooler.supabase.com` |
| Porta Session | Connection pooling | `5432` |
| Porta Transaction | Connection pooling | `6543` |
| Database | Padrao | `postgres` |
| User | Connection pooling | `postgres.SEU_PROJECT_REF` |
| Password | Senha definida na criacao | (sua senha) |

Monte a `DATABASE_URL`:

```
# Session mode (porta 5432) — recomendado para a aplicacao
postgresql://postgres.SEU_PROJECT_REF:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# Transaction mode (porta 6543) — para conexoes efemeras (serverless)
postgresql://postgres.SEU_PROJECT_REF:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

> **Nota sobre Pooler**: Use **Session mode (5432)** para deploy com Docker/VPS (conexoes persistentes). Use **Transaction mode (6543)** para deploy na Vercel (funcoes serverless com conexoes curtas).

### 2.3 Executar o Schema Principal

O schema PostgreSQL completo (119 tabelas, 365 indices, 59 triggers) esta em `lib/db/schema.postgres.sql`.

**Opcao A — Via SQL Editor do Supabase:**

1. No dashboard, va em **SQL Editor**
2. Clique em **New query**
3. Copie e cole o conteudo de `lib/db/schema.postgres.sql`
4. Clique em **Run**

**Opcao B — Via linha de comando:**

```bash
# Instalar psql se necessario
# Ubuntu/Debian: sudo apt install postgresql-client
# macOS: brew install libpq

# Executar o schema
psql "postgresql://postgres.SEU_PROJECT_REF:SUA_SENHA@HOST:5432/postgres" \
  -f lib/db/schema.postgres.sql
```

### 2.4 Executar Migrations na Ordem

Apos o schema principal, execute as migrations incrementais na ordem correta. O schema principal (`schema.postgres.sql`) ja inclui a maioria das tabelas, mas as migrations adicionam colunas, indices e ajustes posteriores.

Execute na ordem numerica:

| # | Arquivo | Descricao |
|---|---|---|
| 000 | `000_create_base_tables.sql` | Tabelas base iniciais |
| 001 | `001_initial_schema.sql` | Schema inicial completo |
| 001 | `001_add_enterprise_features.sql` | Features enterprise (AI, workflows) |
| 001 | `001_postgresql_schema.sql` | Ajustes especificos PostgreSQL |
| 002 | `002_add_organization_id_core.sql` | Multi-tenancy: tabelas core |
| 002 | `002_add_indexes_and_constraints.sql` | Indices e constraints adicionais |
| 003 | `003_add_organization_id_sla.sql` | Multi-tenancy: tabelas SLA |
| 004 | `004_add_organization_id_kb.sql` | Multi-tenancy: knowledge base |
| 005 | `005_add_organization_id_auth.sql` | Multi-tenancy: tabelas auth |
| 006 | `006_add_performance_indexes.sql` | Indices de performance |
| 007 | `007_critical_performance_indexes.sql` | Indices criticos adicionais |
| 008 | `008_add_holidays_table.sql` | Tabela de feriados (SLA) |
| 009 | `009_add_push_subscriptions.sql` | Push notifications (PWA) |
| 010 | `010_email_integration.sql` | Integracao de e-mail |
| 011 | `011_kb_collaboration.sql` | Colaboracao na knowledge base |
| 012 | `012_add_organization_id.sql` | Organization ID em tabelas restantes |
| 013 | `013_tags_macros_relationships.sql` | Tags, macros e relacionamentos |
| 014 | `014_system_settings_integrations.sql` | Configuracoes e integracoes |
| 015 | `015_sla_columns.sql` | Colunas SLA adicionais |
| 016 | `016_workflow_persistence_columns.sql` | Persistencia de workflows |
| 017 | `017_workflow_approvals_extended.sql` | Aprovacoes de workflow estendidas |
| 018 | `018_lgpd_data_deletion.sql` | LGPD: exclusao de dados |
| 019 | `019_problem_management.sql` | ITIL Problem Management |
| 020 | `020_cmdb_service_catalog.sql` | ITIL CMDB e Service Catalog |
| 021 | `021_fix_missing_columns.sql` | Correcao de colunas faltantes |
| 022 | `022_billing_stripe_columns.sql` | Colunas Stripe billing |

```bash
# Executar todas as migrations em ordem
for file in $(ls lib/db/migrations/*.sql | sort); do
  echo "Executando: $file"
  psql "$DATABASE_URL" -f "$file" 2>&1 || echo "AVISO: $file pode ter conflitos (ja aplicada)"
done
```

> **Nota**: Algumas migrations podem falhar se o schema principal ja incluir as tabelas/colunas. Isso e esperado — as mensagens de erro "already exists" podem ser ignoradas.

### 2.5 Executar Seed Data

O seed inclui dados iniciais como roles, permissoes, categorias, prioridades e o usuario admin padrao.

```bash
psql "$DATABASE_URL" -f lib/db/seed.postgres.sql
```

**Usuario admin padrao criado pelo seed:**
- Email: `admin@servicedesk.com`
- Senha: `123456`

> **IMPORTANTE**: Troque a senha do admin imediatamente apos o primeiro login em producao.

### 2.6 Configurar Connection Pooling

No Supabase, o pooler ja vem configurado. Verifique:

1. **Settings > Database > Connection pooling**: Deve estar habilitado
2. **Pool Mode**:
   - `Session` (porta 5432): Mantém a conexao durante toda a sessao. Ideal para servidores tradicionais.
   - `Transaction` (porta 6543): Libera a conexao apos cada transacao. Ideal para serverless (Vercel).
3. **Pool Size**: O padrao (15) e suficiente para a maioria dos casos. Aumente se necessario.

---

## 3. Variaveis de Ambiente

### Tabela Completa de Variaveis

Todas as variaveis estao documentadas em `.env.example` (desenvolvimento) e `.env.production.example` (producao).

#### Core

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `NODE_ENV` | Sim | `development` | Ambiente: `development`, `staging`, `production` |
| `PORT` | Nao | `3000` | Porta do servidor |
| `DB_TYPE` | Sim | `postgresql` | Tipo de banco: `sqlite` ou `postgresql` |
| `DATABASE_URL` | Sim | — | URL de conexao PostgreSQL |
| `NEXT_PUBLIC_APP_URL` | Sim | `http://localhost:3000` | URL publica da aplicacao |
| `NEXT_PUBLIC_API_URL` | Nao | `{APP_URL}/api` | URL da API |
| `APP_VERSION` | Nao | `1.0.0` | Versao da aplicacao |

#### Seguranca (OBRIGATORIAS)

| Variavel | Como gerar | Tam. minimo | Descricao |
|---|---|---|---|
| `JWT_SECRET` | `openssl rand -hex 64` | 64 chars | Assinatura de tokens JWT |
| `SESSION_SECRET` | `openssl rand -hex 64` | 64 chars | Encriptacao de sessoes |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | 32 chars | NextAuth.js JWT encryption |
| `CSRF_SECRET` | `openssl rand -hex 32` | 32 chars | Protecao CSRF (fallback: JWT_SECRET) |
| `CRON_SECRET` | `openssl rand -hex 32` | 32 chars | Autenticacao dos cron jobs |

#### Autenticacao

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `JWT_EXPIRES_IN` | Nao | `28800` | Expiracao do JWT em segundos (8h) |
| `REFRESH_TOKEN_DURATION` | Nao | `7` | Duracao do refresh token em dias |
| `MFA_SECRET` | Se MFA ativo | — | Secret para TOTP/backup codes |
| `SSO_ENCRYPTION_KEY` | Se SSO ativo | — | Encriptacao de configs SSO |
| `ENFORCE_2FA_FOR_ADMIN` | Nao | `false` | Exigir 2FA para admins |
| `MIN_PASSWORD_LENGTH` | Nao | `8` (dev) / `12` (prod) | Tamanho minimo de senha |
| `MAX_LOGIN_ATTEMPTS` | Nao | `5` (dev) / `3` (prod) | Tentativas antes de lockout |
| `LOCKOUT_DURATION` | Nao | `30` (dev) / `60` (prod) | Duracao do lockout em minutos |
| `SESSION_DURATION` | Nao | `28800` | Duracao da sessao em segundos |

#### E-mail

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `EMAIL_PROVIDER` | Nao | `smtp` | Provider: `smtp`, `sendgrid`, `mailgun`, `ses` |
| `RESEND_API_KEY` | Se usar Resend | — | API key do Resend |
| `SMTP_HOST` | Se usar SMTP | — | Servidor SMTP |
| `SMTP_PORT` | Se usar SMTP | `587` | Porta SMTP |
| `SMTP_SECURE` | Nao | `false` | Usar TLS |
| `SMTP_USER` | Se usar SMTP | — | Usuario SMTP |
| `SMTP_PASSWORD` | Se usar SMTP | — | Senha SMTP |
| `SENDGRID_API_KEY` | Se usar SendGrid | — | API key do SendGrid |
| `EMAIL_FROM_NAME` | Nao | `ServiceDesk` | Nome do remetente |
| `EMAIL_FROM_ADDRESS` | Nao | `noreply@servicedesk.com` | E-mail do remetente |
| `SKIP_EMAIL_VERIFICATION` | Nao | `false` | Pular verificacao de e-mail |

#### Billing (Stripe)

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Se usar billing | — | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Se usar billing | — | Secret do webhook Stripe |
| `STRIPE_PRICE_PROFESSIONAL` | Se usar billing | — | Price ID do plano Professional |
| `STRIPE_PRICE_ENTERPRISE` | Se usar billing | — | Price ID do plano Enterprise |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Se usar billing | — | Chave publica do Stripe |

#### Monitoramento

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `SENTRY_DSN` | Recomendado | — | DSN do Sentry (server-side) |
| `NEXT_PUBLIC_SENTRY_DSN` | Recomendado | — | DSN do Sentry (client-side) |
| `SENTRY_AUTH_TOKEN` | Para source maps | — | Token para upload de source maps |
| `SENTRY_ORG` | Para source maps | — | Slug da organizacao no Sentry |
| `SENTRY_PROJECT` | Para source maps | — | Slug do projeto no Sentry |
| `SENTRY_ENVIRONMENT` | Nao | `production` | Ambiente no Sentry |
| `SENTRY_UPLOAD_SOURCEMAPS` | Nao | `false` | Habilitar upload de source maps |
| `SENTRY_TRACES_SAMPLE_RATE` | Nao | `0.1` | Taxa de amostragem de traces |
| `DD_API_KEY` | Se usar Datadog | — | API key do Datadog |
| `DD_SITE` | Se usar Datadog | `datadoghq.com` | Site do Datadog |
| `DD_SERVICE` | Nao | `servicedesk` | Nome do servico no Datadog |
| `DD_ENV` | Nao | `production` | Ambiente no Datadog |
| `DD_TRACE_ENABLED` | Nao | `false` | Habilitar tracing |
| `DD_PROFILING_ENABLED` | Nao | `false` | Habilitar profiling |
| `NEXT_PUBLIC_DD_RUM_APPLICATION_ID` | Se usar RUM | — | Application ID do RUM |
| `NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN` | Se usar RUM | — | Client token do RUM |
| `LOG_LEVEL` | Nao | `info` (dev) / `warn` (prod) | Nivel de log |

#### Cache (Redis)

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `REDIS_URL` | Recomendado | — | URL completa do Redis |
| `REDIS_HOST` | Alternativa | `localhost` | Host do Redis |
| `REDIS_PORT` | Alternativa | `6379` | Porta do Redis |
| `REDIS_PASSWORD` | Producao | — | Senha do Redis |
| `REDIS_DB` | Nao | `0` | Database index |
| `REDIS_CLUSTER` | Nao | `false` | Modo cluster |
| `ENABLE_REDIS_CACHE` | Nao | `false` | Habilitar cache Redis |
| `CACHE_TTL` | Nao | `3600` | TTL padrao em segundos |
| `CACHE_TTL_SHORT` | Nao | `300` | TTL curto (5min) |
| `CACHE_TTL_MEDIUM` | Nao | `1800` | TTL medio (30min) |
| `CACHE_TTL_LONG` | Nao | `7200` | TTL longo (2h) |
| `CACHE_TTL_STATIC` | Nao | `86400` | TTL estatico (24h) |

#### AI

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `OPENAI_API_KEY` | Se usar AI | — | API key da OpenAI |
| `OPENAI_MODEL` | Nao | `gpt-4o-mini` | Modelo a usar |
| `AI_TEMPERATURE` | Nao | `0.7` (dev) / `0.5` (prod) | Temperatura do modelo |
| `ENABLE_AI_CLASSIFICATION` | Nao | `false` | Classificacao automatica |
| `ENABLE_AI_SENTIMENT_ANALYSIS` | Nao | `false` | Analise de sentimento |
| `ENABLE_AI_DUPLICATE_DETECTION` | Nao | `false` | Deteccao de duplicatas |
| `ENABLE_AI_AUTO_RESPONSE` | Nao | `false` | Resposta automatica |

#### Aplicacao (NEXT_PUBLIC_*)

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Sim | `http://localhost:3000` | URL publica da aplicacao |
| `NEXT_PUBLIC_APP_NAME` | Nao | `ServiceDesk` | Nome exibido na UI |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Se usar push | — | Chave VAPID publica (PWA) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Nao | — | E-mail de contato publico |
| `NEXT_PUBLIC_CONTACT_PHONE` | Nao | — | Telefone de contato |

#### SSO e Integracoes

| Variavel | Obrigatoria | Padrao | Descricao |
|---|---|---|---|
| `ENABLE_SSO` | Nao | `false` | Habilitar SSO |
| `GOOGLE_CLIENT_ID` | Se usar Google SSO | — | Client ID do Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Se usar Google SSO | — | Client Secret do Google |
| `MICROSOFT_CLIENT_ID` | Se usar Azure AD | — | Client ID do Azure AD |
| `MICROSOFT_CLIENT_SECRET` | Se usar Azure AD | — | Client Secret do Azure AD |
| `AZURE_AD_TENANT_ID` | Se usar Azure AD | — | Tenant ID do Azure AD |
| `GOVBR_CLIENT_ID` | Se usar Gov.br | — | Client ID do Gov.br |
| `GOVBR_CLIENT_SECRET` | Se usar Gov.br | — | Client Secret do Gov.br |
| `GOVBR_ENVIRONMENT` | Se usar Gov.br | `staging` | `staging` ou `production` |

#### Feature Flags

| Variavel | Padrao | Descricao |
|---|---|---|
| `ENABLE_MULTI_TENANCY` | `true` | Multi-tenancy |
| `SINGLE_TENANT_MODE` | `false` | Modo single-tenant |
| `ENABLE_KNOWLEDGE_BASE` | `true` | Knowledge base |
| `ENABLE_ANALYTICS` | `true` | Dashboard de analytics |
| `ENABLE_WORKFLOWS` | `true` | Motor de workflows |
| `ENABLE_GAMIFICATION` | `false` | Gamificacao |
| `ENABLE_PWA` | `true` | Progressive Web App |
| `ENABLE_REALTIME_NOTIFICATIONS` | `true` | Notificacoes em tempo real |
| `ENABLE_AI_FEATURES` | `false` | Features de AI |
| `ENABLE_DATA_RETENTION` | `true` | Politicas de retencao LGPD |
| `ENABLE_AUDIT_LOGS` | `true` | Logs de auditoria |

#### Compliance e LGPD

| Variavel | Padrao | Descricao |
|---|---|---|
| `DATA_RETENTION_DAYS` | `365` | Retencao de dados (dias) |
| `AUDIT_LOG_RETENTION_DAYS` | `730` | Retencao de logs de auditoria |
| `ENABLE_CONSENT_MANAGEMENT` | `true` | Gestao de consentimento |

#### WebAuthn

| Variavel | Padrao | Descricao |
|---|---|---|
| `WEBAUTHN_RP_ID` | `localhost` | Relying Party ID (seu dominio) |

#### Proxy e CORS

| Variavel | Padrao | Descricao |
|---|---|---|
| `TRUST_PROXY` | `false` | Confiar em X-Forwarded-For |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens permitidas (separadas por virgula) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Origens permitidas para API |
| `FRONTEND_URL` | `http://localhost:3000` | URL do frontend (Socket.io, webhooks) |

---

## 4. Deploy na Vercel

### 4.1 Preparacao

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login na Vercel
vercel login
```

### 4.2 Deploy via CLI

```bash
# Na raiz do projeto
vercel

# Responda as perguntas:
# - Set up and deploy? Yes
# - Scope: selecione sua conta/team
# - Link to existing project? No (primeira vez)
# - Project name: servicedesk
# - Directory: ./
# - Override settings? No (vercel.json ja configura tudo)
```

### 4.3 Configurar Variaveis de Ambiente

**Via dashboard (recomendado):**

1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecione o projeto **servicedesk**
3. Va em **Settings > Environment Variables**
4. Adicione cada variavel, selecionando o ambiente (`Production`, `Preview`, `Development`)

**Via CLI:**

```bash
# Adicionar variaveis uma a uma
vercel env add JWT_SECRET production
vercel env add SESSION_SECRET production
vercel env add DATABASE_URL production
# ... repita para todas as variaveis obrigatorias

# Ou importe de um arquivo (sem commitar!)
# Crie um arquivo temporario com as variaveis e importe manualmente
```

> **IMPORTANTE para Vercel**: Use a `DATABASE_URL` com **Transaction mode (porta 6543)** do Supabase, pois funcoes serverless da Vercel abrem/fecham conexoes rapidamente.

### 4.4 Configurar Dominio Personalizado

1. No dashboard do projeto, va em **Settings > Domains**
2. Adicione seu dominio (ex: `servicedesk.suaempresa.com.br`)
3. Configure o DNS conforme instrucoes da Vercel:
   - **CNAME**: `cname.vercel-dns.com` (para subdominio)
   - **A Record**: IP fornecido pela Vercel (para dominio raiz)
4. O SSL e provisionado automaticamente pela Vercel

Apos configurar o dominio, atualize as variaveis:

```
NEXT_PUBLIC_APP_URL=https://servicedesk.suaempresa.com.br
NEXTAUTH_URL=https://servicedesk.suaempresa.com.br
CORS_ORIGINS=https://servicedesk.suaempresa.com.br
WEBAUTHN_RP_ID=servicedesk.suaempresa.com.br
```

### 4.5 Cron Jobs

O arquivo `vercel.json` configura 3 cron jobs automaticamente:

| Endpoint | Schedule | Descricao |
|---|---|---|
| `/api/cron/process-emails` | `*/5 * * * *` (a cada 5 min) | Processa a fila de e-mails pendentes (ate 50 por execucao) |
| `/api/cron/lgpd-retention` | `0 3 * * *` (3h da manha) | Retencao LGPD: remove dados expirados, anonimiza registros, processa solicitacoes pendentes |
| `/api/cron/cleanup` | `0 4 * * *` (4h da manha) | Limpeza geral: tokens expirados, codigos de verificacao, sessoes antigas, cache stale |

Todos os endpoints de cron exigem autenticacao via header `Authorization: Bearer {CRON_SECRET}`. A Vercel envia esse header automaticamente quando `CRON_SECRET` esta configurado como variavel de ambiente.

> **Nota**: Cron jobs na Vercel estao disponiveis a partir do plano **Pro**. No plano Hobby, configure um servico externo (ex: cron-job.org, EasyCron) para chamar esses endpoints com o header de autenticacao.

### 4.6 Configuracao de Regiao

O `vercel.json` configura duas regioes:

```json
"regions": ["gru1", "iad1"]
```

- **gru1** (Sao Paulo): Regiao primaria, menor latencia para usuarios no Brasil
- **iad1** (Washington D.C.): Regiao de backup/fallback

As funcoes serverless estao configuradas com:
- **Duracao maxima**: 30 segundos
- **Memoria**: 1024 MB

### 4.7 Deploy de Producao

```bash
# Deploy para producao
vercel --prod

# Ou configure deploy automatico via GitHub:
# 1. Conecte o repositorio no dashboard da Vercel
# 2. Push para 'main' faz deploy automatico para producao
# 3. Push para outras branches cria preview deploys
```

---

## 5. Deploy com Docker

### 5.1 Build da Imagem

```bash
# Build padrao
docker build -t servicedesk .

# Build com metadados
docker build \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  --build-arg GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
  -t servicedesk:$(git rev-parse --short HEAD) \
  -t servicedesk:latest \
  .
```

A imagem usa **multi-stage build** com 3 estagios:

| Estagio | Base | Funcao |
|---|---|---|
| `deps` | `node:20-alpine` | Instala apenas dependencias de producao |
| `builder` | `node:20-alpine` | Compila a aplicacao (inclui devDependencies) |
| `runner` | `node:20-alpine` | Imagem final minima (<200MB) |

Caracteristicas da imagem final:
- Usuario nao-root (`nextjs:1001`)
- `tini` como PID 1 (tratamento adequado de sinais)
- Health check integrado via `curl`
- Somente arquivos necessarios para runtime

### 5.2 Docker Compose

O `docker-compose.yml` orquestra todos os servicos necessarios:

#### Servicos Principais

| Servico | Imagem | Porta | Descricao |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 (interna) | Banco de dados PostgreSQL |
| `redis` | `redis:7-alpine` | 6379 (interna) | Cache e rate limiting |
| `app` | Build local | 3000 (interna) | Aplicacao ServiceDesk |
| `nginx` | `nginx:alpine` | 80 (exposta) | Reverse proxy |

#### Servicos de Monitoramento (profile: `monitoring`)

| Servico | Imagem | Porta | Descricao |
|---|---|---|---|
| `prometheus` | `prom/prometheus` | 9090 | Coleta de metricas |
| `grafana` | `grafana/grafana` | 3001 | Dashboards e visualizacao |
| `datadog` | `gcr.io/datadoghq/agent` | 8126/8125 | APM e tracing |

#### Servicos de Ferramentas (profile: `tools`)

| Servico | Imagem | Porta | Descricao |
|---|---|---|---|
| `pgadmin` | `dpage/pgadmin4` | 5050 | Administracao do banco |

#### Iniciar os servicos

```bash
# Criar arquivo .env com as variaveis obrigatorias
cp .env.production.example .env
# Editar .env com seus valores reais

# Iniciar servicos principais
docker compose up -d

# Iniciar com monitoramento
docker compose --profile monitoring up -d

# Iniciar com ferramentas de desenvolvimento
docker compose --profile tools up -d

# Iniciar tudo
docker compose --profile monitoring --profile tools up -d

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f app
```

### 5.3 Volumes

| Volume | Servico | Caminho no Container | Descricao |
|---|---|---|---|
| `postgres_data` | postgres | `/var/lib/postgresql/data` | Dados persistentes do PostgreSQL |
| `redis_data` | redis | `/data` | Dados persistentes do Redis (AOF) |
| `app_data` | app | `/app/data` | Dados da aplicacao |
| `app_uploads` | app | `/app/data/uploads` | Uploads de arquivos |
| `nginx_logs` | nginx | `/var/log/nginx` | Logs do NGINX |
| `prometheus_data` | prometheus | `/prometheus` | Metricas (retencao de 30 dias) |
| `grafana_data` | grafana | `/var/lib/grafana` | Dashboards e configuracoes |

A aplicacao tambem usa volumes `tmpfs` (em memoria) para:
- `/tmp` (100MB): Arquivos temporarios
- `/app/.next/cache` (500MB): Cache do Next.js

### 5.4 Rede

Todos os servicos compartilham a rede `servicedesk-network` (bridge, subnet `172.20.0.0/16`). Somente o NGINX expoe a porta 80 externamente. Os demais servicos se comunicam internamente.

### 5.5 Seguranca do Container

O container da aplicacao possui hardening:

- **read_only**: Filesystem somente leitura (exceto volumes montados)
- **no-new-privileges**: Impede escalacao de privilegios
- **cap_drop: ALL**: Remove todas as capabilities do kernel
- **cap_add: NET_BIND_SERVICE**: Adiciona apenas o necessario para bind de portas
- **user: 1001:1001**: Executa como usuario nao-root

### 5.6 Limites de Recursos

O container `app` tem limites definidos:

| Recurso | Limite | Reserva |
|---|---|---|
| CPU | 2 cores | 1 core |
| Memoria | 2 GB | 1 GB |

### 5.7 NGINX Reverse Proxy

O NGINX e configurado pelos arquivos em `nginx/`:

- `nginx/nginx.conf`: Configuracao global (workers, gzip, logs)
- `nginx/conf.d/default.conf`: Virtual host com proxy reverso

Funcionalidades configuradas:
- **Proxy reverso** para a aplicacao na porta 3000
- **WebSocket** suporte para Socket.io (`/socket.io/`)
- **Health check** em `/health` (proxy para `/api/health/live`)
- **Gzip** compressao para text/css, json, javascript
- **Headers de seguranca**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Upload limit**: 10MB (`client_max_body_size`)
- **Keepalive**: 32 conexoes mantidas com o upstream

Para habilitar **HTTPS**, descomente as linhas de SSL em `nginx/conf.d/default.conf` e monte os certificados:

```yaml
# No docker-compose.yml, adicione ao servico nginx:
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./nginx/conf.d:/etc/nginx/conf.d:ro
  - /etc/letsencrypt/live/seu-dominio:/etc/nginx/ssl:ro
```

---

## 6. Deploy Kubernetes

### 6.1 Health Probes

A aplicacao expoe 3 endpoints de saude compativeis com Kubernetes:

| Endpoint | Tipo | Descricao |
|---|---|---|
| `/api/health/live` | Liveness Probe | Verifica se a aplicacao esta viva. Retorna 200 se o processo esta rodando. |
| `/api/health/ready` | Readiness Probe | Verifica se a aplicacao esta pronta para receber trafego (banco conectado, cache ok). |
| `/api/health/startup` | Startup Probe | Verifica se a inicializacao foi concluida. Evita restarts prematuros. |

### 6.2 Exemplo de Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: servicedesk
  labels:
    app: servicedesk
spec:
  replicas: 2
  selector:
    matchLabels:
      app: servicedesk
  template:
    metadata:
      labels:
        app: servicedesk
    spec:
      containers:
        - name: servicedesk
          image: servicedesk:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: servicedesk-secrets
            - configMapRef:
                name: servicedesk-config
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          startupProbe:
            httpGet:
              path: /api/health/startup
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          volumeMounts:
            - name: uploads
              mountPath: /app/data/uploads
            - name: tmp
              mountPath: /tmp
            - name: next-cache
              mountPath: /app/.next/cache
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: servicedesk-uploads
        - name: tmp
          emptyDir:
            medium: Memory
            sizeLimit: 100Mi
        - name: next-cache
          emptyDir:
            medium: Memory
            sizeLimit: 500Mi
```

### 6.3 Service e Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: servicedesk
spec:
  selector:
    app: servicedesk
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: servicedesk
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
spec:
  tls:
    - hosts:
        - servicedesk.suaempresa.com.br
      secretName: servicedesk-tls
  rules:
    - host: servicedesk.suaempresa.com.br
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: servicedesk
                port:
                  number: 80
```

### 6.4 HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: servicedesk
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: servicedesk
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 6.5 Recomendacoes de Recursos

| Cenario | Replicas | CPU (request/limit) | Memoria (request/limit) |
|---|---|---|---|
| Pequeno (<50 usuarios) | 2 | 250m / 1000m | 256Mi / 1Gi |
| Medio (50-500 usuarios) | 3 | 500m / 2000m | 512Mi / 2Gi |
| Grande (500+ usuarios) | 5+ | 1000m / 4000m | 1Gi / 4Gi |

---

## 7. Servicos Externos

### 7.1 Sentry (Monitoramento de Erros)

**Configurar:**

1. Acesse [sentry.io](https://sentry.io) e crie uma conta
2. Crie um novo projeto: **Platform = Next.js**
3. Copie o **DSN** (formato: `https://HASH@oXXXXXX.ingest.sentry.io/XXXXXXX`)
4. Configure as variaveis:

```env
SENTRY_DSN=https://HASH@oXXXXXX.ingest.sentry.io/XXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://HASH@oXXXXXX.ingest.sentry.io/XXXXXXX
SENTRY_ENVIRONMENT=production
```

**Source Maps (recomendado):**

1. Em **Settings > Account > Auth Tokens**, crie um token com escopos: `project:read`, `project:releases`, `org:read`
2. Anote o slug da organizacao e do projeto (na URL do dashboard)
3. Configure:

```env
SENTRY_AUTH_TOKEN=sntrys_SEU_TOKEN
SENTRY_ORG=seu-org-slug
SENTRY_PROJECT=servicedesk
SENTRY_UPLOAD_SOURCEMAPS=true
```

**Taxas de amostragem recomendadas para producao:**

```env
SENTRY_ERROR_SAMPLE_RATE=1.0          # Capturar 100% dos erros
SENTRY_TRACES_SAMPLE_RATE=0.1         # 10% dos traces (server)
NEXT_PUBLIC_SENTRY_ERROR_SAMPLE_RATE=1.0
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05  # 5% dos traces (client)
```

### 7.2 Stripe (Pagamentos)

**Configurar:**

1. Acesse [dashboard.stripe.com](https://dashboard.stripe.com)
2. Crie uma conta e ative o **Test mode** primeiro

**Criar Produtos e Precos:**

1. Va em **Products > Add product**
2. Crie os 3 planos:

| Plano | Preco | Usuarios | Tickets |
|---|---|---|---|
| Starter | Gratis | 3 | 100/mes |
| Professional | R$ 109/mes | 15 | 1.000/mes |
| Enterprise | R$ 179/mes | Ilimitado | Ilimitado |

3. Copie os **Price IDs** (formato: `price_XXXXXXXXXXXXX`) dos planos Professional e Enterprise

**Configurar Webhook:**

1. Va em **Developers > Webhooks > Add endpoint**
2. URL: `https://seu-dominio.com/api/billing/webhook`
3. Selecione os eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copie o **Signing secret** (formato: `whsec_XXXXXXXXXXXXX`)

```env
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXX       # ou sk_test_... para testes
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX
STRIPE_PRICE_PROFESSIONAL=price_XXXXXXXXXXXXX
STRIPE_PRICE_ENTERPRISE=price_XXXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXX
```

> **Dica**: Teste tudo com chaves `sk_test_` / `pk_test_` antes de usar chaves live.

### 7.3 Resend (E-mail)

**Configurar:**

1. Acesse [resend.com](https://resend.com) e crie uma conta
2. Va em **API Keys > Create API Key**
3. Copie a chave (formato: `re_XXXXXXXXXXXXX`)

```env
RESEND_API_KEY=re_XXXXXXXXXXXXX
```

**Verificar Dominio (obrigatorio para producao):**

1. Va em **Domains > Add Domain**
2. Adicione seu dominio (ex: `servicedesk.suaempresa.com.br`)
3. Configure os registros DNS conforme instrucoes:

| Tipo | Nome | Valor | Finalidade |
|---|---|---|---|
| TXT | `_dmarc.seudominio.com` | `v=DMARC1; p=...` | DMARC |
| TXT | `seudominio.com` | `v=spf1 include:...` | SPF |
| CNAME | `resend._domainkey.seudominio.com` | Fornecido pelo Resend | DKIM |

4. Aguarde a propagacao DNS (pode levar ate 48h)
5. Verifique no dashboard do Resend

### 7.4 Redis / Upstash

**Opcao A — Upstash (serverless, recomendado para Vercel):**

1. Acesse [upstash.com](https://upstash.com) e crie uma conta
2. Crie um database Redis, regiao: `sa-east-1` (Sao Paulo)
3. Copie a URL e senha

```env
REDIS_URL=rediss://default:SENHA@sa-east-1-XXXX.upstash.io:6379
REDIS_PASSWORD=SENHA
ENABLE_REDIS_CACHE=true
```

**Opcao B — Redis autogerenciado (Docker):**

O `docker-compose.yml` ja inclui um servico Redis. Basta definir `REDIS_PASSWORD` no `.env`.

---

## 8. Checklist Pre-Deploy

Execute o script de validacao antes de cada deploy:

```bash
bash scripts/pre-deploy.sh
```

O script verifica automaticamente:
1. TypeScript sem erros de tipo
2. Variaveis de ambiente validadas
3. Build de producao bem-sucedido

### Checklist Manual

#### Secrets e Seguranca
- [ ] `JWT_SECRET` gerado (64+ chars, unico)
- [ ] `SESSION_SECRET` gerado (64+ chars, diferente do JWT_SECRET)
- [ ] `CSRF_SECRET` gerado (32+ chars)
- [ ] `CRON_SECRET` gerado (32+ chars)
- [ ] `MFA_SECRET` gerado (se MFA ativo)
- [ ] `SSO_ENCRYPTION_KEY` gerado (se SSO ativo)
- [ ] Nenhum secret padrao/placeholder em producao
- [ ] Senha do admin padrao alterada

#### Banco de Dados
- [ ] Projeto Supabase criado
- [ ] Schema PostgreSQL executado (`schema.postgres.sql`)
- [ ] Migrations executadas na ordem (000 a 022)
- [ ] Seed data executado (`seed.postgres.sql`)
- [ ] `DATABASE_URL` configurada com pooler correto
- [ ] Connection pooling habilitado
- [ ] Backup automatico do Supabase ativo

#### Servicos Externos
- [ ] Sentry: projeto criado, DSN configurado
- [ ] Stripe: produtos/precos criados, webhook configurado (se usar billing)
- [ ] Resend/SMTP: API key configurada, dominio verificado (se usar e-mail)
- [ ] Redis: instancia criada, conexao testada

#### Aplicacao
- [ ] `NODE_ENV=production`
- [ ] `DB_TYPE=postgresql`
- [ ] `NEXT_PUBLIC_APP_URL` com dominio correto (HTTPS)
- [ ] `CORS_ORIGINS` com dominio correto
- [ ] `WEBAUTHN_RP_ID` com dominio correto
- [ ] Feature flags revisadas
- [ ] Rate limiting habilitado (`ENABLE_RATE_LIMITING=true`)

#### Build e Validacao
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] `bash scripts/pre-deploy.sh` passou
- [ ] Health check respondendo (`/api/health/live`)

#### DNS e Dominio
- [ ] Dominio configurado na Vercel/servidor
- [ ] SSL/TLS ativo (HTTPS)
- [ ] Registros DNS propagados (SPF, DKIM, DMARC para e-mail)

---

## 9. Monitoramento Pos-Deploy

### 9.1 Health Checks

Apos o deploy, verifique todos os endpoints de saude:

```bash
# Liveness — a aplicacao esta rodando?
curl -s https://seu-dominio.com/api/health/live | jq .

# Readiness — esta pronta para receber trafego?
curl -s https://seu-dominio.com/api/health/ready | jq .

# Startup — a inicializacao foi concluida?
curl -s https://seu-dominio.com/api/health/startup | jq .
```

Respostas esperadas: HTTP 200 com corpo JSON indicando status.

### 9.2 Monitoramento de Erros (Sentry)

Apos configurar o Sentry:

1. Acesse o dashboard do Sentry e verifique se o projeto esta recebendo eventos
2. Configure **alertas** para erros criticos:
   - Alerta por e-mail para novos erros
   - Alerta para spike de erros (>10 erros/minuto)
   - Alerta para erros em endpoints criticos (`/api/auth/*`, `/api/tickets/*`)
3. Revise os **traces de performance** para identificar endpoints lentos

### 9.3 Metricas de Performance

Metricas-alvo em producao:

| Metrica | Alvo | Critico |
|---|---|---|
| TTFB | < 450ms | > 1000ms |
| LCP | < 2.5s | > 4.0s |
| FID | < 100ms | > 300ms |
| CLS | < 0.1 | > 0.25 |
| Tempo medio de query | < 50ms | > 200ms |
| Taxa de erro | < 0.1% | > 1% |
| Uptime | > 99.9% | < 99% |

### 9.4 Logs

**Vercel:**
- Logs em tempo real no dashboard: **Project > Deployments > Functions**
- Integre com Datadog ou LogDNA para retencao longa

**Docker:**
```bash
# Logs da aplicacao
docker compose logs -f app

# Logs do NGINX
docker compose logs -f nginx

# Logs do banco
docker compose logs -f postgres
```

Os containers estao configurados com log rotation: maximo 10MB por arquivo, 3 arquivos, com compressao.

### 9.5 Monitoramento com Grafana/Prometheus (Docker)

Se ativou o profile `monitoring`:

1. Acesse Grafana em `http://seu-ip:3001`
2. Login com as credenciais definidas em `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`
3. O datasource Prometheus ja esta configurado automaticamente
4. Importe os dashboards pre-configurados em `monitoring/grafana-dashboard.json`

### 9.6 Cron Jobs

Verifique se os cron jobs estao executando corretamente:

```bash
# Testar manualmente (substitua CRON_SECRET pelo valor real)
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  https://seu-dominio.com/api/cron/process-emails

curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  https://seu-dominio.com/api/cron/cleanup
```

Na Vercel, verifique a execucao em **Project > Crons** no dashboard.

---

## 10. Troubleshooting

### Erro: "FATAL: password authentication failed"

**Causa**: Credenciais do banco incorretas.

**Solucao**:
1. Verifique se a `DATABASE_URL` esta correta
2. Confirme o usuario no formato `postgres.SEU_PROJECT_REF` (Supabase)
3. Verifique se a senha nao contem caracteres especiais nao-escapados na URL
4. Teste a conexao: `psql "$DATABASE_URL" -c "SELECT 1"`

### Erro: "connect ETIMEDOUT" ao conectar no banco

**Causa**: IP nao permitido ou porta errada.

**Solucao**:
1. Confirme que esta usando o host do **pooler** (nao o host direto)
2. Use porta `5432` (session) ou `6543` (transaction)
3. Na Vercel, verifique se o IP da funcao nao esta bloqueado
4. No Supabase, verifique **Settings > Database > Network restrictions**

### Erro: "Module not found" no build

**Causa**: Dependencia faltante ou path alias incorreto.

**Solucao**:
1. Execute `npm ci --legacy-peer-deps` (conforme `vercel.json`)
2. Verifique se `tsconfig.json` tem o path alias `@/*` configurado
3. Limpe o cache: `rm -rf .next node_modules && npm ci`

### Erro: "JWT_SECRET is required" ou "Application will FAIL to start"

**Causa**: Variaveis de seguranca nao configuradas.

**Solucao**:
1. Gere todos os secrets conforme secao 1 (Pre-requisitos)
2. Verifique se as variaveis estao no ambiente correto (Production na Vercel)
3. Execute `bash scripts/pre-deploy.sh` para validar

### Erro: "Too Many Connections" no banco

**Causa**: Pool de conexoes excedido.

**Solucao**:
1. Na Vercel: Use Transaction mode (porta 6543) em vez de Session mode
2. Ajuste `DB_POOL_MAX` (padrao: 10 dev, 20 prod)
3. No Supabase: Aumente o pool size em **Settings > Database > Connection pooling**

### Erro: Container reiniciando continuamente (Docker)

**Causa**: Health check falhando ou crash na inicializacao.

**Solucao**:
```bash
# Ver logs do container
docker compose logs app

# Verificar health check
docker inspect servicedesk-app | jq '.[0].State.Health'

# Verificar se as dependencias (postgres, redis) estao healthy
docker compose ps
```

### Cron jobs nao executam (Vercel)

**Causa**: Plano Hobby nao suporta crons, ou `CRON_SECRET` nao configurado.

**Solucao**:
1. Confirme que esta no plano **Pro** da Vercel
2. Verifique se `CRON_SECRET` esta como variavel de ambiente na Vercel
3. Teste manualmente com `curl -H "Authorization: Bearer $CRON_SECRET" URL`
4. Alternativa: use um servico externo como cron-job.org

### Pagina retorna 404 apos deploy

**Causa**: Build incompleto ou rota nao gerada.

**Solucao**:
1. Verifique o log de build na Vercel por erros
2. Confirme que `output: 'standalone'` esta no `next.config.js`
3. Force um novo build: `vercel --prod --force`

### E-mails nao sao enviados

**Causa**: Provider de e-mail nao configurado ou dominio nao verificado.

**Solucao**:
1. Verifique se `RESEND_API_KEY` ou `SMTP_*` estao configurados
2. No Resend: confirme que o dominio esta verificado (SPF, DKIM)
3. Verifique os logs por erros de envio
4. Teste o cron de e-mails: `curl -H "Authorization: Bearer $CRON_SECRET" URL/api/cron/process-emails`

### Performance degradada

**Causa**: Falta de cache, muitas queries, ou recursos insuficientes.

**Solucao**:
1. Habilite Redis: `ENABLE_REDIS_CACHE=true`
2. Verifique metricas no Sentry/Datadog
3. Docker: aumente limites de CPU/memoria no `docker-compose.yml`
4. Verifique se os 365 indices do banco estao criados (migrations executadas)
5. Na Vercel: considere aumentar o plano para mais funcoes concorrentes

### Erro CORS em requisicoes do frontend

**Causa**: `CORS_ORIGINS` nao inclui o dominio correto.

**Solucao**:
1. Atualize `CORS_ORIGINS` com o dominio completo (incluindo `https://`)
2. Atualize `ALLOWED_ORIGINS` e `FRONTEND_URL` tambem
3. Redeploy apos alterar variaveis de ambiente

---

## Apendice: Arquivos de Referencia

| Arquivo | Descricao |
|---|---|
| `vercel.json` | Configuracao da Vercel (regioes, crons, headers, funcoes) |
| `Dockerfile` | Build multi-stage para producao |
| `docker-compose.yml` | Orquestracao de todos os servicos |
| `nginx/nginx.conf` | Configuracao global do NGINX |
| `nginx/conf.d/default.conf` | Virtual host com proxy reverso |
| `.env.example` | Template de variaveis (desenvolvimento) |
| `.env.production.example` | Template de variaveis (producao) |
| `scripts/pre-deploy.sh` | Script de validacao pre-deploy |
| `lib/db/schema.postgres.sql` | Schema completo PostgreSQL (119 tabelas) |
| `lib/db/seed.postgres.sql` | Dados iniciais (roles, permissoes, admin) |
| `lib/db/migrations/*.sql` | 22+ migrations incrementais |
