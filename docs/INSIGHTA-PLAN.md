# INSIGHTA — Plano de Migração e Arquitetura

## 1. Visão Geral

**Insighta** é uma plataforma AI-First de Service Desk & ITSM multi-tenant SaaS.
Objetivo: reduzir 80% do trabalho manual de suporte via automação inteligente.

---

## 2. Análise do Código Existente (ServiceDesk → Insighta)

### 2.1 O que MANTER (reutilizável)

| Área | Arquivos | Justificativa |
|------|----------|---------------|
| **Schema PostgreSQL** | `lib/db/schema.postgres.sql` (2720 linhas, 111+ tabelas) | Schema maduro com ITIL completo, multi-tenant, RBAC, triggers |
| **DB Adapter** | `lib/db/adapter.ts` | Padrão unified query já pronto para PostgreSQL |
| **Types** | `lib/types/database.ts`, `lib/types/*.ts` | ~40 interfaces TypeScript completas |
| **ITIL Modules** | `lib/db/queries/problem-queries.ts`, `change-queries.ts`, `cmdb-queries.ts`, `catalog-queries.ts`, `cab-queries.ts` | Queries adapter-based, prontas para PG |
| **Auth Guard** | `lib/tenant/request-guard.ts` | Unified `requireTenantUserContext()` |
| **API Helpers** | `lib/api/api-helpers.ts` | `apiSuccess()`, `apiError()`, `apiHandler()`, rate limiting |
| **Roles** | `lib/auth/roles.ts` | RBAC centralizado, 6 roles, helpers |
| **Validation** | `lib/validation/` | Zod schemas reutilizáveis |
| **Security** | `lib/security/`, `lib/rate-limit/` | Hardened (8 sprints de segurança) |
| **AI Module** | `lib/ai/` (24 arquivos) | Classifier, sentiment, embeddings, solution engine, duplicate detector |
| **Knowledge Base** | `lib/knowledge/` (12 arquivos) | Semantic search, vector search, FAQ generator, content analyzer |
| **Design System** | `lib/design-system/tokens.ts` | Brand palette, color tokens |
| **Docker Compose** | `docker-compose.yml` | PostgreSQL, Redis, Nginx, Prometheus, Grafana |
| **Vercel Config** | `vercel.json` | Region GRU1, functions config |

### 2.2 O que ADAPTAR (precisa refatoração)

| Área | Razão da Adaptação |
|------|-------------------|
| **`lib/db/queries.ts`** (2883 linhas) | Maior blocker — 122 `db.prepare()` diretos, precisa migrar para adapter |
| **Auth System** (`lib/auth/`) | Migrar de JWT custom para Clerk/Better Auth |
| **Middleware** (`middleware.ts`) | Adaptar para novo auth provider |
| **Frontend Pages** (`app/`) | Rebrand visual, remover "ServiceDesk" refs |
| **Super Admin** (`app/admin/super/`) | Manter lógica, adaptar para billing/plans |
| **Notifications** | Migrar de SQLite direto para adapter async |
| **Workflow Engine** (`lib/workflow/`) | Precisa editor visual (hoje é code-only) |
| **Integrations** (`lib/integrations/`) | 12K+ linhas, algumas usam SQLite direto |

### 2.3 O que REMOVER

| Área | Razão |
|------|-------|
| **SQLite Schema** (`lib/db/schema.sql`) | Usando PostgreSQL em produção |
| **SQLite Connection** (`lib/db/connection.ts`) | Substituído por Supabase client |
| **`better-sqlite3`** | Dependência desnecessária |
| **Gov.br Auth** | Feature BR-specific, não é core |
| **LGPD Module** (`lib/lgpd/`) | Compliance secundário |
| **Gamification** (`lib/gamification/`) | Não está no PRD |
| **SEO Module** (`lib/seo/`) | Não é prioridade para SaaS B2B |
| **PWA** (`lib/pwa/`) | Pode ser adicionado depois |
| **Sentry Edge configs** | Substituir por setup limpo |
| **Duplicate deps** | bcrypt/bcryptjs, redis/ioredis — padronizar |

### 2.4 O que CRIAR DO ZERO

| Feature | Prioridade | Descrição |
|---------|-----------|-----------|
| **Visual Workflow Builder** | P0 (V1) | Editor drag-and-drop tipo n8n |
| **AI Copilot Chat** | P0 (V1) | Interface conversacional para agentes |
| **Auto Resolution Engine** | P1 (V2) | Pipeline: classificar → buscar solução → executar |
| **Chatbot Portal** | P1 (V2) | Widget conversacional para end users |
| **Multi-channel Intake** | P1 (V2) | Slack, Teams, WhatsApp bots |
| **Observability Webhooks** | P2 (V3) | Receber alerts de Prometheus/Datadog/Grafana |
| **Self-Healing Engine** | P2 (V3) | Execução automática de remediação |
| **Incident Prediction** | P2 (V3) | ML para prever incidentes |
| **Ticket Clustering** | P2 (V3) | Agrupamento automático de tickets similares |
| **Process Mining** | P2 (V3) | Análise de fluxos de suporte |
| **Billing/Subscription** | P0 (V1) | Stripe + Asaas integration |
| **Onboarding Flow** | P0 (V1) | Wizard de setup para novos tenants |
| **Landing Page** | P0 (V1) | Marketing site com pricing |

---

## 3. Stack Recomendada

### 3.1 Database — **Supabase** (PostgreSQL)

**Por quê Supabase e não Neon:**
- Supabase = PostgreSQL + Auth + Storage + Realtime + Edge Functions (tudo-em-um)
- **RLS (Row-Level Security)** nativo — perfeito para multi-tenant
- **pgvector** embutido — necessário para AI/embeddings (75% mais barato que Pinecone)
- **Realtime** subscriptions — substitui Socket.io para DB changes
- Free tier: 500MB DB, 1GB storage, 50K MAU auth, 2 projetos
- Pro: $25/mês (8GB DB, 100GB storage, sem pause)
- **Supabase CLI** para migrations, branching, local dev
- **Neon** para dev/staging (scale-to-zero, DB branching para CI/CD)

**Decisão de Multi-Tenant:** Shared DB + RLS (Row-Level Security)
```sql
-- Todas as tabelas com organization_id (já temos isso!)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tickets
  USING (organization_id = current_setting('app.current_tenant')::int);
```

### 3.2 Authentication — **Supabase Auth** (incluso) + RBAC custom

**Por quê Supabase Auth:**
- **Já incluso** no Supabase — zero custo adicional, zero vendor extra
- **50K MAU free** (1000 tenants × ~10 users = 10K users, dentro do free)
- JWT integra direto com RLS para isolamento de tenant
- 20+ social providers, MFA, magic links
- O RBAC custom existente (`lib/auth/rbac.ts`) se mantém
- **Alternativa**: Better Auth (OSS, $0) ou Clerk ($0.02/MAU após 10K)

**Migração:** O auth JWT existente pode ser substituído gradualmente.
Quando precisar SSO/SAML enterprise: avaliar Clerk ou WorkOS.

### 3.3 Frontend — **Vercel** (Next.js 15)

- Free tier: 100GB bandwidth, serverless functions
- **ISR/SSR** para páginas dinâmicas
- **Edge Functions** para middleware (auth, tenant routing)
- **Subdomain routing**: `{tenant}.insighta.com.br`
- Limitação: sem WebSocket persistente → delegar para VPS

### 3.4 Backend / Background Jobs — **VPS** (Docker)

O VPS existente será usado para:
- **WebSocket server** (Socket.io para real-time)
- **BullMQ + Redis** para job queue (AI tasks, emails, SLA checks)
- **AI processing** (classificação, embeddings, auto-resolution)
- **Cron jobs** (analytics, SLA monitoring, cleanup)
- **Meilisearch** (full-text search engine)

```
┌─────────────────────────────────────────────┐
│                   VERCEL                     │
│  Next.js 15 (Frontend + API Routes leves)   │
│  - SSR/ISR pages                            │
│  - CRUD API routes                          │
│  - Middleware (auth, tenant routing)         │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────┴──────────────────────────┐
│                    VPS                       │
│  Docker Compose:                            │
│  ├── api-worker (Node.js + BullMQ)          │
│  ├── websocket-server (Socket.io)           │
│  ├── redis (queue + cache + sessions)       │
│  ├── meilisearch (full-text search)         │
│  └── nginx (reverse proxy + SSL)            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│               SUPABASE                       │
│  ├── PostgreSQL + pgvector                  │
│  ├── Row-Level Security (multi-tenant)      │
│  ├── Realtime subscriptions                 │
│  ├── Storage (attachments)                  │
│  └── Edge Functions (webhooks)              │
└─────────────────────────────────────────────┘
```

### 3.5 AI/LLM — **Estratégia Multi-Model** (custo otimizado)

| Task | Modelo | Custo/1M tokens |
|------|--------|----------------|
| Classificação tickets (alto volume) | **Gemini 2.0 Flash-Lite** | $0.075 in / $0.30 out |
| Extração, sumarização (simples) | **GPT-5 nano** ou **Groq Llama** | $0.05 in / $0.08 out |
| KB Q&A, copilot (moderado) | **Claude Haiku 4.5** | $1.00 in / $5.00 out |
| Root cause analysis (complexo) | **Claude Sonnet 4.6** | $3.00 in / $15.00 out |

- **pgvector (Supabase)** para vector storage — sem serviço extra (75% mais barato que Pinecone)
- Prompt caching: 50-90% desconto em tokens cached
- Custo estimado: ~$50-150/mês para 1000 tenants

### 3.6 Email — **Resend**

- Free: 3.000 emails/mês
- DX moderna (React Email templates)
- Webhook para inbound email (criar tickets via email)
- Pro: $20/mês para 50K emails

### 3.7 Payments — **Stripe** (internacional) + **Asaas** (Brasil)

**Estratégia dual:**

| | Stripe | Asaas |
|---|---|---|
| **Mercado** | Internacional | Brasil |
| **Métodos** | Cartão, Apple/Google Pay | PIX, Boleto, Cartão |
| **Taxa** | 2.9% + $0.30 | 2.99% cartão, R$1.99 PIX |
| **Subscriptions** | ✅ Billing Portal | ✅ Assinatura recorrente |
| **Free tier** | Sem mensalidade, só taxa | Sem mensalidade, só taxa |
| **Checkout** | Stripe Checkout | Checkout Asaas |

**Implementação:**
- Criar abstração `BillingProvider` que suporta ambos
- Tenant escolhe método de pagamento no onboarding
- Webhook unificado para provisioning de planos

### 3.8 Search — **Meilisearch** (self-hosted no VPS)

- **Open-source**, sem custo de hosting
- Sub-10ms search results
- Typo tolerance, faceted search, filters
- Multi-tenant via tenant-prefixed indexes
- Alternativa: Typesense (similar, também open-source)

### 3.9 Monitoring — **Sentry** (errors) + **Grafana Cloud** (metrics)

- Sentry: Free 5K events/mês → $26/mês para 50K
- Grafana Cloud: Free 10K métricas, 50GB logs → perfeito para início
- Prometheus no VPS para métricas de infra

### 3.10 Real-time — **Supabase Realtime** + **Socket.io** (VPS)

- Supabase Realtime para: DB changes, presence, ticket updates
- Socket.io (VPS) para: chat, copilot streaming, notifications push

### 3.11 Queue — **BullMQ + Redis** (VPS)

- Open-source, sem custo
- Dashboard UI (Bull Board)
- Queues: `ai-processing`, `email-sending`, `sla-check`, `analytics`, `webhooks`
- Retry, backoff, rate limiting built-in

### 3.12 File Storage — **Cloudflare R2** (attachments) + **Supabase Storage** (avatars)

- R2: **10GB free, $0 egress SEMPRE** (killer feature vs S3)
- R2: $0.015/GB/mês storage (vs S3 $0.023 + egress fees)
- S3-compatible API — fácil migração
- Supabase Storage para avatars/assets pequenos (auth integrado)
- 1000 tenants × 100GB attachments = ~$1.50/mês no R2

---

## 4. Arquitetura Multi-Tenant

### 4.1 Estratégia: Shared DB + Row-Level Security

```
MVP (0-100 tenants):     Shared DB + RLS
Growth (100-1000):       Shared DB + RLS + Connection Pooling (Supavisor)
Enterprise (1000+):      Schema-per-tenant para clientes enterprise
```

### 4.2 Tenant Routing

```
app.insighta.com.br          → Landing/Marketing
{slug}.insighta.com.br       → Tenant App
api.insighta.com.br          → API Gateway
ws.insighta.com.br           → WebSocket (VPS)
```

Vercel suporta wildcard subdomains no Pro plan ($20/mês).

### 4.3 Planos e Feature Flags

```typescript
interface Plan {
  name: 'free' | 'starter' | 'professional' | 'enterprise';
  maxUsers: number;
  maxTicketsPerMonth: number;
  features: {
    aiCopilot: boolean;
    autoResolution: boolean;
    customWorkflows: boolean;
    slaManagement: boolean;
    cmdb: boolean;
    changeManagement: boolean;
    apiAccess: boolean;
    sso: boolean;
    customDomain: boolean;
    whitelabel: boolean;
  };
  aiCreditsPerMonth: number;
  storageGB: number;
  price: {
    monthly: number;
    yearly: number; // desconto
  };
}
```

| Feature | Free | Starter ($49) | Pro ($149) | Enterprise ($499+) |
|---------|------|---------------|------------|---------------------|
| Users | 3 | 10 | 50 | Ilimitado |
| Tickets/mês | 100 | 500 | 5000 | Ilimitado |
| AI Copilot | ❌ | ✅ | ✅ | ✅ |
| Auto Resolution | ❌ | ❌ | ✅ | ✅ |
| Workflows | Básico | 5 | Ilimitado | Ilimitado |
| SLA | ❌ | ✅ | ✅ | ✅ |
| CMDB | ❌ | ❌ | ✅ | ✅ |
| SSO/SAML | ❌ | ❌ | ❌ | ✅ |
| API | ❌ | ✅ | ✅ | ✅ |
| Custom Domain | ❌ | ❌ | ✅ | ✅ |
| Suporte | Community | Email | Prioritário | Dedicado |

### 4.4 Metering de Uso

```typescript
// Middleware de metering para AI requests
async function meterAIUsage(tenantId: number, feature: string) {
  const usage = await getMonthlyUsage(tenantId, feature);
  const plan = await getTenantPlan(tenantId);

  if (usage >= plan.aiCreditsPerMonth) {
    throw new QuotaExceededError('AI credits exhausted for this billing period');
  }

  await incrementUsage(tenantId, feature);
}
```

---

## 5. Estrutura do Monorepo

```
insighta/
├── apps/
│   ├── web/                    # Next.js 15 (Vercel)
│   │   ├── app/
│   │   │   ├── (marketing)/    # Landing, pricing, docs
│   │   │   ├── (auth)/         # Login, register, forgot-password
│   │   │   ├── (dashboard)/    # App principal (tenant-scoped)
│   │   │   │   ├── tickets/
│   │   │   │   ├── knowledge/
│   │   │   │   ├── catalog/
│   │   │   │   ├── workflows/
│   │   │   │   ├── cmdb/
│   │   │   │   ├── analytics/
│   │   │   │   ├── settings/
│   │   │   │   └── admin/
│   │   │   └── api/            # API Routes (CRUD leve)
│   │   └── components/
│   │       ├── ui/             # Design system
│   │       ├── tickets/
│   │       ├── copilot/        # AI Copilot widget
│   │       ├── workflows/      # Visual workflow builder
│   │       └── dashboard/
│   │
│   └── worker/                 # Node.js Worker (VPS)
│       ├── queues/             # BullMQ job processors
│       │   ├── ai-processor.ts
│       │   ├── email-sender.ts
│       │   ├── sla-checker.ts
│       │   ├── webhook-dispatcher.ts
│       │   └── analytics-aggregator.ts
│       ├── websocket/          # Socket.io server
│       └── cron/               # Scheduled jobs
│
├── packages/
│   ├── db/                     # Supabase client, migrations, RLS
│   │   ├── migrations/         # SQL migrations
│   │   ├── seed/               # Seed data
│   │   └── client.ts           # Supabase typed client
│   ├── ai/                     # AI services (reuse existing lib/ai)
│   ├── auth/                   # Better Auth config
│   ├── shared/                 # Types, utils, validation
│   │   ├── types/
│   │   ├── validation/
│   │   └── constants/
│   └── email/                  # Resend templates
│
├── docker/
│   ├── docker-compose.yml      # VPS services
│   ├── Dockerfile.worker
│   └── nginx.conf
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
│
├── turbo.json                  # Turborepo config
├── package.json
└── .env.example
```

**Tooling:**
- **Turborepo** para monorepo management
- **pnpm** para package manager (mais rápido que npm)
- **Biome** para lint + format (substitui ESLint + Prettier, 100x mais rápido)

---

## 6. Roadmap de Implementação

### V1 — MVP (8-12 semanas)

**Objetivo:** Plataforma funcional para early adopters

- [ ] Setup monorepo (Turborepo + pnpm)
- [ ] Supabase project + schema migration
- [ ] Better Auth (login, register, organizations)
- [ ] Tenant routing (subdomains)
- [ ] Dashboard base
- [ ] Ticket system (criar, listar, detalhar, comentar)
- [ ] Knowledge Base (CRUD + search)
- [ ] Categorias, prioridades, status
- [ ] SLA básico
- [ ] Notifications (Supabase Realtime)
- [ ] Self-Service Portal
- [ ] Billing (Stripe + Asaas)
- [ ] Landing page + pricing
- [ ] Onboarding wizard

### V2 — AI-Powered (6-8 semanas pós-V1)

- [ ] AI Copilot (chat interface para agentes)
- [ ] Classificação automática de tickets
- [ ] Sugestão de soluções
- [ ] Knowledge Base inteligente (busca semântica)
- [ ] Auto-geração de artigos
- [ ] Workflow Builder visual (drag-and-drop)
- [ ] Service Catalog com automação
- [ ] Multi-channel (email inbound, Slack bot)
- [ ] Analytics avançado (MTTR, FCR, SLA compliance)
- [ ] CMDB básico

### V3 — Enterprise (8-12 semanas pós-V2)

- [ ] Auto Resolution Engine
- [ ] Problem Management completo
- [ ] Change Management + CAB
- [ ] Observability webhooks (Prometheus, Datadog)
- [ ] Self-Healing infrastructure
- [ ] Incident prediction (ML)
- [ ] Ticket clustering
- [ ] Process mining
- [ ] SSO/SAML enterprise
- [ ] Custom domains
- [ ] WhatsApp/Teams bots
- [ ] API pública documentada
- [ ] White-label

---

## 7. Custos Estimados

### Início (free tiers — $0-5/mês!)

| Serviço | Custo/mês |
|---------|-----------|
| Supabase (DB+Auth+Realtime+Storage) | $0 (free tier) |
| Vercel | $0 (hobby) |
| VPS (já possui) | $0 |
| Resend | $0 (3K emails) |
| Cloudflare R2 | $0 (10GB) |
| Sentry + Grafana Cloud | $0 |
| Meilisearch + BullMQ (VPS) | $0 |
| AI (Gemini Flash-Lite) | ~$5 |
| **Total** | **~$0-5/mês** |

### MVP com clientes (0-100 tenants)

| Serviço | Custo/mês |
|---------|-----------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| VPS (4GB RAM) | $20-40 |
| Resend | $20 (50K emails) |
| AI multi-model | ~$50-150 |
| Sentry + Grafana | $0 |
| R2 + Meilisearch | ~$2 |
| **Total** | **~$137-257/mês** |

### Growth (100-1000 tenants)

| Serviço | Custo/mês |
|---------|-----------|
| Supabase Pro + usage | $150-400 |
| Vercel Pro | $60-100 |
| VPS (8-16GB) | $50-120 |
| Resend | $80 |
| AI multi-model | ~$150 |
| Sentry Team + Grafana | $50-75 |
| R2 | ~$2 |
| **Total** | **~$540-930/mês** |

**Break-even:** ~7 clientes Starter ($49) + ~2 Pro ($149) = $641/mês.

---

## 8. Decisões Técnicas Resumo

| Decisão | Escolha | Alternativa | Custo início |
|---------|---------|-------------|-------------|
| Database | **Supabase** (PG + RLS + Realtime + pgvector) | Neon (dev/staging) | $0 → $25 |
| Auth | **Supabase Auth** (50K MAU free) | Better Auth, Clerk | $0 |
| Frontend | **Next.js 15 on Vercel** | — | $0 → $20 |
| Backend | **VPS Docker** (já possui) | Railway, Fly.io | $0 |
| AI classify | **Gemini Flash-Lite** ($0.075/M tok) | Groq Llama | ~$1 |
| AI copilot | **Claude Haiku/Sonnet** | GPT-4o | ~$5-50 |
| Vector DB | **pgvector** (Supabase, incluso) | Pinecone ($0 → $70) | $0 |
| Search | **Meilisearch** (VPS, OSS) | Typesense | $0 |
| Email | **Resend** (3K free) | Postmark | $0 |
| Queue | **BullMQ + Redis** (VPS) | Inngest, Trigger.dev | $0 |
| Payments BR | **Asaas** (PIX, boleto) | — | $0 (só taxa) |
| Payments INT | **Stripe** | Paddle | $0 (só taxa) |
| Monitoring | **Sentry + Grafana Cloud** | Datadog | $0 |
| Storage | **Cloudflare R2** ($0 egress) | Supabase Storage | $0 |
| Monorepo | **Turborepo + pnpm** | Nx | $0 |
| Lint | **Biome** (100x faster) | ESLint | $0 |
| API Style | **tRPC** (internal) + REST (public) | GraphQL | $0 |

---

## 9. O que NÃO Fazer (Anti-patterns)

1. **NÃO começar com microservices** — monorepo com 2 apps (web + worker) é suficiente
2. **NÃO usar GraphQL** no MVP — tRPC para internal, REST para API pública
3. **NÃO implementar self-healing no V1** — é V3
4. **NÃO criar custom auth** — usar Better Auth ou Clerk
5. **NÃO usar ElasticSearch** — Meilisearch é 10x mais simples para o caso de uso
6. **NÃO deploy em K8s** — Docker Compose no VPS é suficiente até 1000 tenants
7. **NÃO duplicar deps** — padronizar em bcryptjs, ioredis, pnpm

---

## 10. Gap Analysis Resumo (PRD vs Existente)

### EXISTS (pode reutilizar) — 40%
- Ticket CRUD, categories, priorities, statuses
- SLA management + tracking
- Knowledge Base (artigos, categorias)
- ITIL modules (Problem, Change, CMDB, Catalog, CAB)
- AI classification, sentiment, suggestions, embeddings
- Semantic/vector search
- Multi-tenant (organization_id scoping)
- RBAC, audit logs
- Email integration (sender, parser, templates)
- Notifications system
- Analytics (daily metrics, agent metrics)
- PostgreSQL schema completo (111+ tabelas)

### PARTIAL (precisa refatoração) — 25%
- Auth system (JWT custom → Better Auth)
- Workflow engine (code-based → visual builder)
- Self-service portal (existe mas sem chatbot)
- Service catalog (CRUD mas sem automação)
- Knowledge Base (sem geração automática)
- Real-time (Socket.io → Supabase Realtime)
- Super Admin (existe, adaptar para billing)

### MISSING (criar do zero) — 35%
- AI Copilot conversacional
- Auto Resolution Engine
- Visual Workflow Builder (drag-and-drop)
- Chatbot portal
- Multi-channel intake (Slack, Teams, WhatsApp bots)
- Observability webhooks
- Self-Healing
- Incident prediction
- Ticket clustering
- Process mining
- Billing/Subscription management
- Onboarding wizard
- Landing page/marketing
- API pública documentada
- Conversational Service Desk

---

## 11. Primeiros Passos (Semana 1-2)

1. **Criar repositório `insighta`** com Turborepo + pnpm
2. **Setup Supabase** — criar projeto, migrar schema PostgreSQL
3. **Setup Better Auth** — configure organizations plugin
4. **Setup Vercel** — deploy Next.js base com wildcard subdomain
5. **Setup VPS** — Docker Compose (Redis, Meilisearch, worker)
6. **Copiar e adaptar** de ServiceDesk:
   - `lib/types/` → `packages/shared/types/`
   - `lib/ai/` → `packages/ai/`
   - `lib/validation/` → `packages/shared/validation/`
   - `lib/db/schema.postgres.sql` → `supabase/migrations/`
7. **Implementar tenant routing** no middleware
8. **Implementar dashboard base** com ticket list

---

---

## 11. Arquitetura de AI (Pipeline por Ticket)

```
Ticket Criado (Vercel API)
    │
    ▼
BullMQ Queue: ai:classify (Redis)
    │
    ▼
AI Worker (VPS) ──────────────────────┐
    │                                  │
    ├── Classificação (categoria)      │
    ├── Priorização automática         │
    ├── Análise de sentimento          │
    ├── Detecção de duplicatas         │
    │   (vector similarity pgvector)   │
    │                                  │
    ▼                                  ▼
Atualiza ticket no DB          Socket.io → Agente
(auto-assign se confiança      (notifica sugestão AI)
 > threshold)
```

### AI Copilot Flow (< 5s latency target)
```
Agente digita resposta → Frontend envia contexto →
  → /api/ai/copilot (Vercel) → BullMQ ai:copilot →
  → Worker: RAG (KB + histórico ticket) →
  → Resposta via WebSocket → Agente vê sugestão
```

### Isolamento AI por Tenant
- Embeddings tagados com `organization_id`
- Vector search sempre filtra por org
- Metering de uso AI por tenant vs plano
- Fine-tuning custom = feature Enterprise

---

## 12. Segurança Multi-Tenant (5 Camadas)

```
Camada 1: Edge Middleware     → JWT válido, org_id match
Camada 2: Request Guard       → requireTenantUserContext()
Camada 3: Query Scoping       → WHERE organization_id = ?
Camada 4: PostgreSQL RLS      → Políticas de banco (safety net)
Camada 5: Audit Logging       → Toda mutação logada
```

### Novas Tabelas Necessárias

```sql
-- API Keys por tenant
CREATE TABLE api_keys (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,  -- "isk_live_abc"
    scopes JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 60,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SSO config por tenant
CREATE TABLE tenant_sso_configs (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT UNIQUE NOT NULL REFERENCES organizations(id),
    provider VARCHAR(50) NOT NULL,  -- 'saml', 'oidc', 'azure_ad'
    client_id VARCHAR(255),
    client_secret_encrypted TEXT,
    enforce_sso BOOLEAN DEFAULT FALSE,
    auto_provision BOOLEAN DEFAULT TRUE,
    default_role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage metering
CREATE TABLE tenant_usage (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value BIGINT NOT NULL DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    UNIQUE(organization_id, metric_name, period_start)
);
```

---

## 13. Escalabilidade por Fase

| Escala | Bottleneck | Mitigação |
|--------|-----------|-----------|
| 50 tenants | Pool de conexões DB | PgBouncer, read replicas |
| 100 tenants | Worker AI não acompanha | Horizontal scaling workers |
| 200 tenants | Socket.io memória | Shard com Redis adapter |
| 500 tenants | Tenant resolution latency | Edge KV cache |
| 1000+ tenants | PostgreSQL write limits | Write sharding / DB dedicado enterprise |

---

## 14. Dados dos Agentes de Pesquisa

### Codebase Audit (364K linhas analisadas)
- **Taxa de reuso estimada: 72%** (40% direto + 32% adaptação)
- 117 tabelas DB, 197 rotas API, 50+ componentes UI
- ITIL modules (Problem/Change/CMDB/Catalog/CAB): 95% reutilizáveis
- AI module (24 arquivos): 70% reutilizável
- Security/Auth: 90-95% reutilizável
- Notification system: 85% reutilizável

### Gap Analysis (PRD vs Existente)
- **Features implementadas: 65%** (cobertura funcional)
- **Posicionamento AI-First: 35%** (gap principal)
- **Production readiness: 60%**
- **Extensibilidade: 80%**

### Módulos AI Existentes Reutilizáveis
| Arquivo | Linhas | Função | Reuso |
|---------|--------|--------|-------|
| `lib/ai/vector-database.ts` | 23.3KB | Vector storage + similarity | 100% |
| `lib/ai/duplicate-detector.ts` | 19.7KB | Deduplicação ML | 100% |
| `lib/ai/solution-suggester.ts` | 19KB | Sugestão LLM | 90% |
| `lib/ai/training-system.ts` | 15.8KB | Feedback loop ML | 95% |
| `lib/ai/solution-engine.ts` | 14.5KB | Busca + resolução | 90% |
| `lib/ai/ticket-classifier.ts` | 13.1KB | Multi-label classify | 85% |
| `lib/ai/embedding-utils.ts` | 12.4KB | Vector embeddings | 100% |
| `lib/ai/openai-client.ts` | 7.4KB | API client | ADAPT (add Claude) |

### Pricing Pesquisado (Web Search 2026)
| Ferramenta | Free Tier | Pro |
|-----------|-----------|-----|
| Supabase | 500MB DB, 1GB storage | $25/mês (8GB) |
| Neon | 0.5GB, scale-to-zero | ~$52/mês |
| Clerk | 10K MAU free | $0.02/MAU |
| Better Auth | Unlimited (OSS) | $0 |
| Resend | 3K emails/mês | $20/mês |
| Stripe | Sem mensalidade | 2.9% + $0.30 |
| Asaas | Sem mensalidade | 2.99% cartão, R$1.99 PIX |

---

*Documento gerado em 2026-03-08. Baseado na análise de 4 agentes paralelos (Codebase Audit, Stack Research, Architecture Planning, Gap Analysis) sobre o codebase ServiceDesk (364K linhas TS, 117 tabelas, 197 rotas API).*
