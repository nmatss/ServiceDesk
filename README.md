# 🎫 ServiceDesk

**Plataforma enterprise de ITSM (IT Service Management) multi-tenant, compativel com ITIL v4, construida para o mercado brasileiro.**

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Build](https://img.shields.io/badge/Build-passing-brightgreen)
![TS Errors](https://img.shields.io/badge/TS_Errors-0-brightgreen)
![Tables](https://img.shields.io/badge/Tabelas-119-blue)

---

## Sobre o Projeto

ServiceDesk e uma plataforma completa de gestao de servicos de TI, projetada para empresas brasileiras que precisam de uma solucao ITSM robusta, segura e em conformidade com a LGPD.

A aplicacao oferece gestao de tickets, processos ITIL completos (Problem, Change, CMDB, Service Catalog, CAB), base de conhecimento com busca semantica, inteligencia artificial para classificacao automatica e um motor de workflows visual -- tudo em uma unica plataforma multi-tenant com isolamento total de dados.

### Diferenciais

| | Diferencial | Descricao |
|---|---|---|
| 📋 | **ITIL Completo** | Problem, Change, CMDB, Service Catalog e CAB integrados nativamente |
| 🏢 | **Multi-Tenancy** | Isolamento total por organizacao com planos, billing Stripe e Super Admin cross-tenant |
| 🤖 | **IA Integrada** | Classificacao automatica, NLP, analise de sentimento, copilot e sugestoes inteligentes |
| 🔒 | **Conformidade LGPD** | Consentimento, portabilidade de dados, direito ao esquecimento, retencao de 3 anos |
| 📱 | **PWA Offline** | Funciona em dispositivos moveis com push notifications, biometria e sincronizacao em background |
| ⚡ | **119 Tabelas** | Modelo de dados robusto com 365 indices, 59 triggers e 84 foreign keys |

### Numeros do Projeto

| Metrica | Valor |
|---|---|
| Paginas | 304 rotas |
| API Handlers | 405 handlers em 237 arquivos |
| Componentes React | 134 feature + 53 UI base |
| Modulos em `lib/` | 50 diretorios, 376 arquivos |
| Tabelas no Banco | 119 |
| Testes Automatizados | 99 (unit, integration, e2e, security) |

---

## Screenshots

> Capturas de tela em breve. O projeto inclui: dashboard com widgets configuraveis, kanban de tickets, workflow builder visual, portal do usuario final e painel Super Admin.

---

## Funcionalidades

<details>
<summary><strong>📋 Gestao de Tickets</strong></summary>

- CRUD completo com ciclo de vida, SLA tracking e breach detection
- Prioridades, categorias, tags e templates
- Visualizacao Kanban e timeline
- Atribuicao e escalonamento automatico
- Comentarios, anexos e followers
- Relacionamento entre tickets (pai/filho, duplicata, bloqueio)
- Operacoes em massa (bulk update)
- Edicao colaborativa em tempo real via Socket.io

</details>

<details>
<summary><strong>🔧 ITIL Completo</strong></summary>

| Modulo | Tabelas | Funcionalidades |
|---|---|---|
| **Problem Management** | 6 | Analise de causa raiz, erros conhecidos, vinculos com incidentes, atividades e anexos |
| **Change Management** | 5 | Requisicoes de mudanca, aprovacoes multi-nivel, tarefas e calendario |
| **CMDB** | 7 | Itens de configuracao, relacionamentos, historico completo e analise de impacto |
| **Service Catalog** | 5 | Catalogo de servicos com categorias, requisicoes, aprovacoes e tarefas |
| **CAB** | 3 | Change Advisory Board com configuracao, membros e reunioes |

</details>

<details>
<summary><strong>📚 Base de Conhecimento</strong></summary>

- Artigos com categorias, tags e versionamento
- Busca semantica com vector embeddings
- Auto-geracao de artigos a partir de tickets resolvidos
- Sistema de feedback e sugestoes dos usuarios
- Anexos e aprovacoes de conteudo

</details>

<details>
<summary><strong>🤖 IA & Machine Learning</strong></summary>

- Classificacao automatica de tickets via NLP
- Deteccao de duplicatas por similaridade vetorial
- Analise de sentimento em tempo real
- Copilot para agentes com sugestoes inteligentes
- Auto-geracao de artigos de conhecimento
- Sistema de treinamento com feedback loop customizavel

</details>

<details>
<summary><strong>⚙️ Workflow Engine</strong></summary>

- Builder visual com ReactFlow (15 tipos de nos, 3 tipos de arestas)
- Automacoes baseadas em regras e condicoes
- Aprovacoes multi-nivel com tokens seguros armazenados no banco
- Execucao e monitoramento de steps com logging
- Protecao SSRF com whitelist de IPs para webhooks
- Isolamento por tenant com mascaramento de segredos

</details>

<details>
<summary><strong>🏢 Multi-Tenancy & Billing</strong></summary>

- Isolamento total de dados por `organization_id` em todas as queries
- 3 planos com limites enforced:
  - **Starter** (gratis): 3 usuarios, 100 tickets
  - **Professional** (R$109/mes): 15 usuarios, 1.000 tickets
  - **Enterprise** (R$179/mes): ilimitado
- Integracao Stripe completa (checkout, portal do cliente, webhooks)
- Self-service: criacao automatica de organizacao no registro
- Super Admin cross-tenant com dashboard, gestao de orgs e audit logs

</details>

<details>
<summary><strong>🔒 Seguranca</strong></summary>

| Camada | Implementacao |
|---|---|
| Autenticacao | JWT com access (15min) + refresh (7d) tokens, httpOnly cookies, device fingerprinting |
| Senha | bcryptjs 12 rounds, entropy check, dicionario, historico (5), expiracao 90 dias |
| MFA | TOTP + SMS + Email + Backup codes (10), armazenamento HMAC-SHA256 |
| Biometria | WebAuthn / FIDO2 |
| SSO | OAuth2, SAML, Gov.br |
| RBAC | 6 papeis, 29 permissoes, condicoes dinamicas (owner_only, department_only, business_hours) |
| CSRF | Double Submit Cookie + HMAC-SHA256, session-bound, expiracao 1h |
| Criptografia | AES-256-GCM com rotacao de chaves para campos sensiveis |
| Rate Limiting | Per-endpoint (login 5/15min, registro 3/h, default 60/min) |
| CSP | Modo estrito em producao, Permissions-Policy, HSTS, X-Frame-Options DENY |
| XSS | Sanitizacao com isomorphic-dompurify |
| SQL Injection | Queries parametrizadas + escape de wildcards LIKE |
| LGPD | Consentimento, portabilidade, erasure, retencao 3 anos |

**Hierarquia RBAC:**
```
super_admin > admin > tenant_admin > team_manager > agent > user
```

</details>

<details>
<summary><strong>📊 Analytics & Dashboards</strong></summary>

- Metricas em tempo real via Socket.io
- Analytics preditivo e deteccao de anomalias
- Previsao de demanda (demand forecasting)
- Dashboard COBIT com 12 widgets configuraveis (drag-and-drop)
- Graficos: heatmaps, sankey, radar (Recharts + D3)
- Metricas por agente, categoria e periodo
- Relatorios agendados em PDF e Excel

</details>

<details>
<summary><strong>🔗 Integracoes</strong></summary>

- **Email** -- SMTP + IMAP via Nodemailer, Resend com templates Handlebars
- **WhatsApp** -- Business API com contatos, sessoes e mensagens
- **Gov.br** -- Autenticacao federal via CPF/CNPJ
- **ERP** -- Conectores TOTVS e SAP
- **Banking** -- PIX e Boleto
- **Webhooks** -- Envio e recebimento bidirecional com HMAC
- Padrao `BaseConnector` extensivel para novas integracoes

</details>

<details>
<summary><strong>📱 PWA & Mobile</strong></summary>

- Progressive Web App instalavel com suporte offline
- Fila de operacoes com background sync
- Push notifications via Web Push (VAPID)
- Autenticacao biometrica
- Comandos de voz
- Gestos touch otimizados (swipe, pinch, long-press)

</details>

<details>
<summary><strong>🏆 Gamificacao</strong></summary>

- Badges e conquistas para agentes
- Leaderboard com ranking
- Reconhecimento entre pares

</details>

---

## Tech Stack

| Camada | Tecnologias |
|---|---|
| **Framework** | Next.js 15 (App Router), React 18, TypeScript 5 |
| **Estilo** | Tailwind CSS 3, Headless UI, Framer Motion |
| **Banco de Dados** | SQLite (dev), PostgreSQL / Supabase (prod) |
| **Real-time** | Socket.io 4 |
| **Cache** | ioredis (Redis), LRU Cache (in-memory) |
| **Autenticacao** | jose, bcryptjs, otplib, speakeasy, WebAuthn |
| **IA** | OpenAI API, Fuse.js (busca fuzzy), vector embeddings |
| **Pagamentos** | Stripe (checkout, portal, webhooks) |
| **Email** | Nodemailer, Resend, Handlebars (templates) |
| **Filas** | Bull (Redis-backed) |
| **Visualizacao** | Recharts, D3.js, ReactFlow |
| **PDF / Excel** | jsPDF, ExcelJS |
| **Monitoramento** | Sentry (server/client/edge), Prometheus (prom-client), Winston |
| **Testes** | Vitest, Playwright, Testing Library, axe-core |
| **Validacao** | Zod (50+ schemas) |
| **Infra** | Docker (multi-stage, < 200MB), Kubernetes (health probes) |
| **Seguranca** | Helmet, isomorphic-dompurify, compression |

---

## Metricas de Performance

| Metrica | Valor | Classificacao |
|---|---|---|
| Lighthouse Performance | 92-95 / 100 | Excelente |
| Lighthouse Mobile | 90-95 / 100 | Excelente |
| TTFB | 300-450ms | Bom |
| LCP (Largest Contentful Paint) | 2.1s | Bom |
| FID (First Input Delay) | 85ms | Bom |
| CLS (Cumulative Layout Shift) | 0.05 | Bom |
| Bundle Size (gzip) | 245KB | Otimizado |
| Query Media (DB) | 45ms | Rapido |

**Otimizacoes aplicadas:** SSR/ISR em paginas criticas, code splitting com lazy loading, compressao gzip/brotli (~70% de reducao), auth cache de 30s (elimina chamadas redundantes a `/api/auth/verify`), paralelizacao de queries no dashboard com `Promise.all`, tree-shaking para heroicons/headlessui/lucide/recharts/framer-motion/date-fns.

---

## Pre-requisitos

- **Node.js** >= 18 (recomendado: 20 LTS)
- **npm** >= 9
- **SQLite** (desenvolvimento local -- instalado automaticamente via `better-sqlite3`)
- **PostgreSQL** 14+ (producao, recomendado via Supabase)
- **Redis** (opcional -- fallback gracioso para cache in-memory)

---

## Instalacao

```bash
# 1. Clone o repositorio
git clone https://github.com/nmatss/ServiceDesk.git
cd ServiceDesk

# 2. Instale as dependencias
npm install

# 3. Configure as variaveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com suas configuracoes (veja a secao Variaveis de Ambiente)

# 4. Inicialize o banco de dados (SQLite para desenvolvimento)
npm run init-db

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Usando PostgreSQL (local via Docker)

```bash
# Suba o container PostgreSQL
npm run db:postgres:up

# Inicialize o banco com schema e seed
npm run init-db:postgres

# Rode o dev apontando para PostgreSQL
DB_TYPE=postgresql npm run dev
```

### Usando PostgreSQL (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com/)
2. Execute `lib/db/schema.postgres.sql` no SQL Editor
3. Execute `lib/db/seed.postgres.sql` para dados iniciais
4. Configure `DATABASE_URL` e `DB_TYPE=postgresql` no `.env.local`

---

## Scripts Disponiveis

### Desenvolvimento

| Script | Descricao |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run dev:custom` | Servidor customizado com Socket.io (hot reload) |
| `npm run build` | Build de producao |
| `npm run start` | Servidor de producao (Socket.io + compression) |
| `npm run lint` | Executar ESLint |
| `npm run lint:fix` | Corrigir problemas do ESLint automaticamente |
| `npm run format` | Formatar codigo com Prettier |
| `npm run format:check` | Verificar formatacao |
| `npm run type-check` | Verificacao de tipos TypeScript |
| `npm run validate` | type-check + lint + format:check |

### Banco de Dados

| Script | Descricao |
|---|---|
| `npm run init-db` | Inicializar SQLite com schema e seed data |
| `npm run init-db:postgres` | Inicializar PostgreSQL local |
| `npm run test-db` | Testar conexao com o banco |
| `npm run db:seed` | Inserir dados de seed (requer banco inicializado) |
| `npm run db:seed-dashboard` | Inserir dados de demonstracao para dashboards |
| `npm run db:clear` | Limpar todos os dados |
| `npm run db:postgres:up` | Subir container PostgreSQL via Docker Compose |
| `npm run db:postgres:down` | Parar container PostgreSQL |
| `npm run migrate` | Executar migracoes pendentes |
| `npm run migrate:status` | Ver status das migracoes |
| `npm run migrate:rollback` | Reverter ultima migracao |

### Testes

| Script | Descricao |
|---|---|
| `npm run test` | Todos os testes (unit + e2e) |
| `npm run test:unit` | Testes unitarios (Vitest) |
| `npm run test:unit:watch` | Testes unitarios em modo watch |
| `npm run test:unit:coverage` | Cobertura de testes unitarios |
| `npm run test:e2e` | Testes end-to-end (Playwright) |
| `npm run test:e2e:headed` | E2E com navegador visivel |
| `npm run test:e2e:debug` | E2E em modo debug |
| `npm run test:a11y` | Testes de acessibilidade (axe-core) |
| `npm run test:security` | Testes de seguranca + scan |
| `npm run test:security:owasp` | Testes baseados em OWASP |
| `npm run load:test` | Teste de carga (k6) |

### Performance e Monitoramento

| Script | Descricao |
|---|---|
| `npm run lighthouse` | Gerar relatorio Lighthouse |
| `npm run build:analyze` | Analisar bundle size |
| `npm run db:benchmark` | Benchmark de performance do banco |
| `npm run db:analyze` | Analisar queries lentas |
| `npm run check:health` | Verificar saude da aplicacao |
| `npm run validate-env` | Validar variaveis de ambiente |

---

## Estrutura do Projeto

```
ServiceDesk/
├── app/                          # Next.js App Router (304 rotas)
│   ├── api/                      # 197 arquivos de rotas, 358 handlers HTTP
│   │   ├── auth/                 # Autenticacao (login, registro, SSO, MFA, Gov.br)
│   │   ├── admin/super/          # Super Admin cross-tenant
│   │   ├── tickets/              # CRUD de tickets + bulk-update
│   │   ├── problems/             # ITIL Problem Management
│   │   ├── changes/              # ITIL Change Management
│   │   ├── cmdb/                 # ITIL CMDB
│   │   ├── catalog/              # ITIL Service Catalog
│   │   ├── cab/                  # Change Advisory Board
│   │   ├── knowledge/            # Base de Conhecimento (20 rotas)
│   │   ├── ai/                   # Funcionalidades de IA (9 rotas)
│   │   ├── analytics/            # Analytics e relatorios
│   │   ├── workflows/            # Motor de workflows
│   │   ├── integrations/         # Email, WhatsApp
│   │   ├── notifications/        # Gestao de notificacoes
│   │   └── health/               # Health probes (live, ready, startup)
│   ├── auth/                     # Paginas de autenticacao
│   ├── tickets/                  # Paginas de tickets
│   ├── problems/                 # Paginas de problemas
│   ├── knowledge/                # Paginas da base de conhecimento
│   ├── portal/                   # Portal do usuario final
│   ├── admin/                    # Interface administrativa
│   │   └── super/                # Super Admin (6 paginas)
│   └── workflows/                # Workflow builder
│
├── lib/                          # 49 modulos, 398 arquivos
│   ├── db/                       # Camada de banco (adapter, queries, schemas, migracoes)
│   ├── auth/                     # Autenticacao (25 arquivos: JWT, RBAC, MFA, SSO, biometria)
│   ├── security/                 # Seguranca (25 arquivos: criptografia, CSRF, CSP, PII)
│   ├── ai/                       # IA/ML (24 arquivos: classificador, NLP, sentimento)
│   ├── notifications/            # Notificacoes (11 arquivos: multi-canal, escalacao, digest)
│   ├── integrations/             # Integracoes (21 arquivos: email, WhatsApp, ERP, Gov.br)
│   ├── monitoring/               # Monitoramento (21 arquivos: logger, Sentry, metricas)
│   ├── cache/                    # Cache (18 arquivos: Redis, LRU, browser, warming)
│   ├── performance/              # Performance (20 arquivos: query optimizer, CDN, compressao)
│   ├── knowledge/                # Knowledge (12 arquivos: auto-gerador, busca semantica)
│   ├── workflow/                 # Workflows (11 arquivos: engine, automacao, aprovacao)
│   ├── analytics/                # Analytics (11 arquivos: preditivo, anomalia, demanda)
│   ├── pwa/                      # PWA (12 arquivos: offline, push, sync, biometria)
│   ├── tenant/                   # Multi-tenancy (9 arquivos: contexto, resolver, guard)
│   ├── billing/                  # Billing (Stripe, gestao de planos)
│   ├── validation/               # Validacao (4 arquivos: 50+ schemas Zod)
│   ├── hooks/                    # Custom hooks (13 arquivos: auth cache, debounce, gestos)
│   ├── types/                    # TypeScript types (database, problem, workflow, super-admin)
│   ├── sla/                      # SLA tracking (application-layer)
│   ├── api/                      # Utilidades de API (helpers, validacao, versionamento)
│   └── design-system/            # Design system (tokens, temas, personas)
│
├── src/components/               # 125 componentes feature
│   ├── workflow/                 # 27 componentes (15 tipos de no, builder visual)
│   ├── dashboard/                # 24 componentes (12 widgets, builder, COBIT)
│   ├── mobile/                   # 13 componentes (gestos, biometria, voz)
│   ├── tickets/                  # 12 componentes (kanban, timeline, editor colaborativo)
│   ├── charts/                   # 7 componentes (heatmaps, sankey, radar)
│   ├── pwa/                      # 6 componentes (install, offline, sync)
│   ├── admin/                    # 5 componentes (super admin dashboard)
│   ├── notifications/            # 4 componentes
│   ├── knowledge/                # 4 componentes
│   └── gamification/             # 3 componentes (badges, leaderboard, reconhecimento)
│
├── components/ui/                # 49 componentes UI base
├── tests/                        # Testes (unit, e2e, a11y, security, load)
├── scripts/                      # Scripts utilitarios
├── server.ts                     # Custom server (Socket.io + compression + graceful shutdown)
├── middleware.ts                  # Auth, tenant resolution, rate limiting, headers
├── Dockerfile                    # Multi-stage build (< 200MB)
└── docker-compose.yml            # Docker Compose para desenvolvimento
```

---

## Variaveis de Ambiente

### Obrigatorias

| Variavel | Descricao |
|---|---|
| `DB_TYPE` | Tipo do banco: `sqlite` ou `postgresql` |
| `JWT_SECRET` | Chave secreta para tokens JWT (min. 32 caracteres) |
| `JWT_REFRESH_SECRET` | Chave secreta para refresh tokens |
| `ENCRYPTION_KEY` | Chave para criptografia AES-256-GCM (32 bytes hex) |
| `CSRF_SECRET` | Chave para tokens CSRF |
| `NEXT_PUBLIC_APP_URL` | URL publica da aplicacao (ex: `https://desk.empresa.com`) |

### Producao

| Variavel | Descricao |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL / Supabase |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anonima do Supabase |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Segredo do webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave publica do Stripe |
| `RESEND_API_KEY` | Chave da API Resend para envio de emails |

### Opcionais

| Variavel | Descricao |
|---|---|
| `REDIS_URL` | URL do Redis (fallback automatico para LRU in-memory) |
| `OPENAI_API_KEY` | Chave da API OpenAI para funcionalidades de IA |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Configuracao SMTP alternativa |
| `SENTRY_DSN` | DSN do Sentry para monitoramento de erros |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Organizacao e projeto no Sentry |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Chaves VAPID para push notifications |

> **Importante:** Nunca commite arquivos `.env` no repositorio. Use `.env.local` para desenvolvimento local.

---

## Database

O projeto utiliza um **padrao de adapter dual** que suporta SQLite (desenvolvimento) e PostgreSQL/Supabase (producao) com **119 tabelas**.

```
DB_TYPE=sqlite      -->  SQLite local (arquivo, zero configuracao)
DB_TYPE=postgresql  -->  PostgreSQL / Supabase (producao)
```

### Arquitetura

- **Adapter**: `lib/db/adapter.ts` -- interface unificada (`executeQuery`, `executeQueryOne`, `executeRun`, `executeTransaction`)
- **Schema SQLite**: `lib/db/schema.sql` (3.400+ linhas)
- **Schema PostgreSQL**: `lib/db/schema.postgres.sql` (2.720+ linhas, paridade total)
- **16 Dialect Helpers**: `sqlNow()`, `sqlDateSub()`, `sqlDateDiff()`, `sqlGroupConcat()`, etc. -- garantem SQL compativel cross-database
- **Tipo seguro**: `SqlParam` type para parametros de query (`string | number | boolean | null`)

### Estatisticas (PostgreSQL)

| Metrica | Quantidade |
|---|---|
| Tabelas | 119 |
| Indices | 365 |
| Triggers | 59 |
| Foreign Keys | 84 |
| CHECK Constraints | 28 |

<details>
<summary><strong>Modulos de Tabelas (119 tabelas em 18 modulos)</strong></summary>

| Modulo | Tabelas | Exemplos |
|---|---|---|
| Core Tickets | 12 | tickets, comments, attachments, categories, priorities, statuses, tags |
| Auth & Security | 15 | users, roles, permissions, refresh_tokens, MFA, SSO, WebAuthn |
| SLA & Escalation | 5 | sla_policies, sla_tracking, escalations |
| Notifications | 5 | notifications, notification_events, batches, filters |
| Workflows | 10 | workflow_definitions, executions, approvals |
| Knowledge Base | 8 | kb_articles, kb_categories, kb_tags, feedback |
| Analytics | 6 | daily_metrics, agent_metrics, realtime_metrics |
| Multi-Tenancy | 6 | organizations, tenants, teams, departments |
| AI/ML | 4 | ai_classifications, ai_suggestions, vector_embeddings |
| Integrations | 10 | webhooks, whatsapp_sessions, govbr_integrations |
| ITIL Problem | 6 | problems, known_errors, problem_incident_links |
| ITIL Change | 5 | change_requests, change_request_approvals, change_tasks |
| ITIL CMDB | 7 | configuration_items, ci_relationships, ci_history |
| ITIL Catalog | 5 | service_catalog_items, service_requests |
| ITIL CAB | 3 | cab_configurations, cab_members, cab_meetings |
| Audit | 4 | audit_logs, api_usage_tracking, user_sessions |
| Compliance | 3 | satisfaction_surveys, scheduled_reports, lgpd_consents |
| Config | 3 | ticket_templates, system_settings, cache |

</details>

---

## Deploy

Consulte [`DEPLOYMENT.md`](./DEPLOYMENT.md) para instrucoes detalhadas, incluindo:

- **Docker**: Multi-stage build (< 200MB), non-root user, tini init
- **Kubernetes**: Health probes em `/api/health/live`, `/api/health/ready`, `/api/health/startup`
- **Supabase**: Configuracao do banco PostgreSQL com 119 tabelas
- **Vercel**: Variaveis de ambiente e custom domain
- **Sentry**: Monitoramento de erros com source maps

---

## API

Consulte [`docs/API.md`](./docs/API.md) para a documentacao completa da API.

A aplicacao expoe **358 handlers HTTP** em **197 arquivos de rotas**, organizados em:

| Area | Rotas | Descricao |
|---|---|---|
| `/api/auth/*` | Login, registro, MFA, SSO, Gov.br | Autenticacao |
| `/api/tickets/*` | CRUD, comentarios, anexos, tags, bulk | Gestao de tickets |
| `/api/problems/*` | CRUD, atividades, vinculos | Problem Management |
| `/api/changes/*` | Requisicoes, aprovacoes, tarefas | Change Management |
| `/api/cmdb/*` | CIs, relacionamentos, historico, impacto | CMDB |
| `/api/catalog/*` | Catalogo, requisicoes, aprovacoes | Service Catalog |
| `/api/cab/*` | Reunioes, membros, agendamento | CAB |
| `/api/knowledge/*` | Artigos, busca, feedback (20 rotas) | Knowledge Base |
| `/api/ai/*` | Classificacao, sugestoes, sentimento (9 rotas) | IA/ML |
| `/api/analytics/*` | Metricas, relatorios, preditivo | Analytics |
| `/api/workflows/*` | Definicoes, execucoes, aprovacoes | Workflows |
| `/api/admin/super/*` | Dashboard, orgs, users, audit, settings | Super Admin |
| `/api/health/*` | live, ready, startup | Health Probes |

Todas as rotas utilizam `requireTenantUserContext()` para autenticacao e isolamento de tenant.

---

## Seguranca

Consulte [`SECURITY.md`](./SECURITY.md) para a politica de seguranca e divulgacao de vulnerabilidades.

Principais protecoes implementadas:

- JWT com access + refresh tokens e httpOnly cookies
- MFA multi-canal (TOTP, SMS, Email, backup codes)
- RBAC com 6 papeis hierarquicos e 29 permissoes
- Criptografia AES-256-GCM com rotacao de chaves
- CSRF com Double Submit Cookie + HMAC-SHA256
- CSP estrito, HSTS, Permissions-Policy
- Rate limiting per-endpoint
- Sanitizacao XSS e queries parametrizadas
- Conformidade LGPD (consentimento, portabilidade, erasure)

---

## Contribuindo

Consulte [`CONTRIBUTING.md`](./CONTRIBUTING.md) para diretrizes de contribuicao, incluindo:

- Padrao de codigo e formatacao
- Processo de pull request
- Convencoes de commit
- Padroes arquiteturais a seguir

---

## Changelog

Consulte [`CHANGELOG.md`](./CHANGELOG.md) para o historico completo de alteracoes.

---

## Licenca

Este projeto esta licenciado sob a [Licenca MIT](./LICENSE).

---

## Equipe

> Secao em construcao. Adicione os membros da equipe aqui.

---

<p align="center">
  <strong>ServiceDesk</strong> -- Plataforma ITSM enterprise construida com Next.js 15, TypeScript e PostgreSQL para o mercado brasileiro.
</p>
