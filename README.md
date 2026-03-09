# ServiceDesk - Enterprise ITSM & Help Desk Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-0%20errors-blue.svg)](https://www.typescriptlang.org/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791.svg)](https://supabase.com/)

> Plataforma enterprise de ITSM e help desk construida com Next.js 15, TypeScript, PostgreSQL (Supabase) e recursos de nivel corporativo: multi-tenancy, ITIL completo, IA/ML, seguranca avancada, notificacoes em tempo real e monitoramento abrangente.

---

## Visao Geral

| Metrica | Valor |
|---|---|
| **Tabelas no Banco** | 117 |
| **Rotas de API** | 197 arquivos / 358 handlers |
| **Paginas Frontend** | 76 |
| **Componentes** | 174 (125 feature + 49 UI) |
| **Modulos em lib/** | 49 diretorios / 398 arquivos |
| **Custom Hooks** | 19 |
| **Dependencias** | 73 prod + 40 dev |
| **TypeScript Errors** | 0 |
| **Lighthouse Score** | 92-95/100 |

---

## Stack Tecnologico

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript 5 (strict mode)
- **Estilizacao**: Tailwind CSS 3 com design system customizado
- **UI**: Headless UI, Heroicons, Lucide React
- **Graficos**: Recharts, D3
- **Animacoes**: Framer Motion
- **Workflow Builder**: ReactFlow
- **Real-time**: Socket.io Client
- **PWA**: Service Worker, Push Notifications, Offline Support

### Backend
- **Runtime**: Node.js 20
- **API**: Next.js 15 API Routes (197 arquivos)
- **Banco Producao**: PostgreSQL 16 (Supabase) — 117 tabelas, 362 indices, 59 triggers
- **Banco Dev**: SQLite (better-sqlite3)
- **Adapter**: Dual-database com 16 dialect helpers
- **Cache**: Redis 7 + LRU in-memory
- **Auth**: JWT (jose) + bcrypt + MFA + SSO + WebAuthn
- **Real-time**: Socket.io
- **Email**: Nodemailer + IMAP
- **AI**: OpenAI API
- **Filas**: Bull (Redis-based)
- **Busca**: Fuse.js + Elasticsearch (opcional)

### DevOps
- **Container**: Docker multi-stage (<200MB)
- **Orquestracao**: Kubernetes-ready (health probes)
- **Monitoramento**: Sentry + Datadog + Prometheus
- **CI/CD**: GitHub Actions
- **Deploy**: Vercel / Docker / Kubernetes

---

## Features

### Gerenciamento de Tickets
- CRUD completo com ciclo de vida
- Categorias, prioridades e status configuraveis
- SLA com tracking automatico e breach detection
- Editor rich text para descricoes e comentarios
- Anexos com armazenamento multi-cloud
- Kanban board, timeline, relacionamentos entre tickets
- Templates de tickets para problemas comuns
- Operacoes em massa (bulk operations)
- Tags e busca avancada

### ITIL Completo

| Modulo | Tabelas | Funcionalidades |
|---|---|---|
| **Problem Management** | 6 | RCA, known errors, incident links, activities |
| **Change Management** | 5 | Requests, approvals, tasks, calendario |
| **CMDB** | 7 | CIs, relationships, historico, ticket links |
| **Service Catalog** | 5 | Items, requests, approvals, tasks |
| **CAB** | 3 | Meetings, members, votacao |

### Inteligencia Artificial
- Classificacao automatica de tickets (NLP)
- Deteccao de duplicatas (vector similarity)
- Analise de sentimento em tempo real
- Sugestao de solucoes baseada em knowledge base
- Sistema de treinamento com feedback loop
- Geracao automatica de artigos para KB

### Analytics & Predicao
- Dashboards em tempo real (12 widgets)
- Metricas de performance de agentes
- Analise de tendencias com ML
- Previsao de demanda (demand forecasting)
- Deteccao de anomalias
- Scoring de risco
- Relatorios COBIT e executivos
- Export PDF/Excel

### Knowledge Base
- Busca semantica com vector embeddings
- Geracao automatica de artigos e FAQs
- Controle de versao e workflow de aprovacao
- Rating e feedback de artigos
- Colaboracao multi-autor

### Seguranca Enterprise

| Camada | Implementacao |
|---|---|
| **Autenticacao** | JWT (15min access + 7d refresh), httpOnly cookies, device fingerprint |
| **Senha** | bcrypt 12 rounds, entropy check, dicionario, historico (5), expiracao 90d |
| **MFA** | TOTP + SMS + Email + Backup codes (10) |
| **Biometria** | WebAuthn/FIDO2 (fingerprint, face) |
| **SSO** | OAuth2, SAML, LDAP, Gov.br |
| **RBAC** | 6 roles, 29 permissoes, condicoes dinamicas |
| **CSRF** | Double Submit Cookie + HMAC-SHA256, session-bound |
| **Criptografia** | AES-256-GCM com key rotation |
| **Headers** | CSP strict, HSTS, X-Frame-Options DENY, Permissions-Policy |
| **Rate Limiting** | Per-endpoint (login 5/15min, register 3/hr, default 60/min) |
| **SQL Injection** | Queries parametrizadas + LIKE escaping |
| **XSS** | isomorphic-dompurify |
| **LGPD/GDPR** | Consentimento, portabilidade, erasure, retencao 3 anos |

### Multi-Tenancy
- Isolamento completo por organization_id
- Resolucao de tenant por subdomain/header/path
- Configuracoes por tenant
- Super Admin para gestao cross-tenant (org 1)
- Quotas de recursos por tenant

### Super Admin
- Dashboard com estatisticas cross-tenant
- CRUD de organizacoes (criar, suspender, reativar)
- Gestao de usuarios cross-tenant
- Logs de auditoria com filtros avancados
- Configuracoes globais do sistema (manutencao, limites, SMTP, seguranca)

### Real-time
- Notificacoes via WebSocket (Socket.io)
- Atualizacoes de tickets em tempo real
- Alertas de SLA
- Push notifications (Web Push API)
- Sistema de presenca de usuarios
- Escalation automatico

### Workflow Engine
- Builder visual com 15 tipos de no
- 3 tipos de edge (conditional, error, default)
- Automacoes com condicoes
- Aprovacoes multi-nivel
- Scheduler para triggers agendados

### Integracoes
- **WhatsApp**: Business API, templates, contatos
- **Email**: SMTP, IMAP, templates Handlebars
- **Gov.br**: Autenticacao CPF/CNPJ
- **Banking**: Integracoes bancarias
- **ERP**: SAP/Oracle connectors
- **Webhooks**: Envio e recebimento com HMAC

### PWA & Mobile
- Offline mode com queue de operacoes
- Push notifications
- Biometric auth no mobile
- Gestos (swipe, pinch, long-press)
- Install prompt
- Background sync

### Acessibilidade
- WCAG 2.1 Level AA
- Touch targets 44px
- ARIA labels e roles
- Navegacao por teclado
- Focus management
- Dark mode completo

---

## Quick Start

### Pre-requisitos
- Node.js 18+ (recomendado: 20 LTS)
- npm
- Git

### Instalacao

```bash
# Clone o repositorio
git clone https://github.com/nmatss/ServiceDesk.git
cd ServiceDesk

# Instale as dependencias
npm install

# Copie as variaveis de ambiente
cp .env.local.example .env.local

# Inicialize o banco de dados (SQLite para dev)
npm run init-db

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Credenciais de Desenvolvimento

| Role | Email | Senha |
|---|---|---|
| Admin | admin@servicedesk.com | 123456 |

> **Aviso**: Altere as credenciais imediatamente em producao!

### Producao (Supabase PostgreSQL)

```bash
# Configure as variaveis de ambiente
DB_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)

# Execute o schema e seed no Supabase
# lib/db/schema.postgres.sql + lib/db/seed.postgres.sql

# Build e start
npm run build
npm run start
```

---

## Estrutura do Projeto

```
ServiceDesk/
├── app/                          # Next.js App Router (76 paginas)
│   ├── api/                      # 197 arquivos de rota API
│   │   ├── auth/                 # Auth (login, register, SSO, GovBR, MFA)
│   │   ├── admin/super/          # Super Admin (10 rotas)
│   │   ├── tickets/              # Tickets CRUD + subrecursos
│   │   ├── problems/             # ITIL Problem Management
│   │   ├── changes/              # ITIL Change Management
│   │   ├── cmdb/                 # ITIL CMDB
│   │   ├── catalog/              # ITIL Service Catalog
│   │   ├── cab/                  # Change Advisory Board
│   │   ├── knowledge/            # Knowledge Base (20 rotas)
│   │   ├── ai/                   # AI/ML (9 rotas)
│   │   ├── analytics/            # Analytics & reporting
│   │   ├── workflows/            # Workflow engine
│   │   ├── integrations/         # Email, WhatsApp
│   │   ├── notifications/        # Notificacoes
│   │   └── health/               # Health probes
│   ├── auth/                     # Paginas de autenticacao
│   ├── tickets/                  # Gestao de tickets
│   ├── problems/                 # Problem management
│   ├── knowledge/                # Knowledge base
│   ├── portal/                   # Portal do usuario final
│   ├── admin/                    # Area administrativa
│   │   └── super/                # Super Admin (6 paginas)
│   ├── workflows/                # Workflow builder
│   └── layout.tsx                # Root layout
│
├── lib/                          # 49 modulos, 398 arquivos
│   ├── db/                       # Banco de dados (adapter, queries, schemas)
│   │   ├── adapter.ts            # Adapter dual-database
│   │   ├── schema.sql            # Schema SQLite (117 tabelas)
│   │   ├── schema.postgres.sql   # Schema PostgreSQL (117 tabelas)
│   │   ├── queries.ts            # Query functions principais
│   │   └── queries/              # ITIL query modules (5 arquivos)
│   ├── auth/                     # Autenticacao (25 arquivos)
│   ├── security/                 # Seguranca (25 arquivos)
│   ├── ai/                       # IA/ML (24 arquivos)
│   ├── notifications/            # Notificacoes (11 arquivos)
│   ├── cache/                    # Cache Redis/LRU (18 arquivos)
│   ├── monitoring/               # Monitoramento (21 arquivos)
│   ├── performance/              # Otimizacao (20 arquivos)
│   ├── knowledge/                # Knowledge base (12 arquivos)
│   ├── workflow/                 # Workflows (11 arquivos)
│   ├── analytics/                # Analytics (11 arquivos)
│   ├── integrations/             # Integracoes (21 arquivos)
│   ├── tenant/                   # Multi-tenancy (9 arquivos)
│   ├── pwa/                      # PWA (12 arquivos)
│   ├── api/                      # API utilities (21 arquivos)
│   ├── validation/               # Validacao Zod (50+ schemas)
│   ├── hooks/                    # Custom hooks (13 arquivos)
│   ├── types/                    # TypeScript types (4 arquivos)
│   └── design-system/            # Design system (5 arquivos)
│
├── src/components/               # 125 componentes
│   ├── workflow/                 # 27 (builder, 15 node types, edges)
│   ├── dashboard/                # 24 (12 widgets, builder, COBIT)
│   ├── mobile/                   # 13 (gestos, biometria, voz)
│   ├── tickets/                  # 12 (kanban, timeline, editor)
│   ├── charts/                   # 7 (heatmaps, sankey, radar)
│   └── ...                       # + pwa, admin, notifications, knowledge
│
├── components/ui/                # 49 componentes base
├── server.ts                     # Custom server (Socket.io + compression)
├── middleware.ts                  # Auth, tenant, rate limiting, headers
├── Dockerfile                    # Multi-stage build (<200MB)
└── docker-compose.yml            # Docker Compose config
```

---

## Banco de Dados

### 117 Tabelas organizadas em 18 modulos

| Modulo | Tabelas | Descricao |
|---|---|---|
| Core Tickets | 12 | tickets, comments, attachments, categories, priorities, statuses, tags |
| Auth & Security | 15 | users, roles, permissions, refresh_tokens, password_policies, SSO, MFA |
| SLA & Escalation | 5 | sla_policies, sla_tracking, escalations |
| Notifications | 5 | notifications, batches, filters |
| Workflows | 10 | definitions, executions, approvals |
| Knowledge Base | 8 | articles, categories, tags, feedback |
| Analytics | 6 | daily, agent, category, realtime metrics |
| Multi-Tenancy | 6 | organizations, tenants, teams, departments |
| AI/ML | 4 | classifications, suggestions, training, embeddings |
| Integrations | 10 | webhooks, WhatsApp, GovBR |
| ITIL Problem | 6 | problems, known_errors, incidents, activities |
| ITIL Change | 5 | change_requests, approvals, tasks, calendar |
| ITIL CMDB | 7 | CIs, relationships, history |
| ITIL Catalog | 5 | catalog_items, service_requests, tasks |
| ITIL CAB | 3 | meetings, members, configurations |
| Audit | 4 | audit_logs, api_usage, sessions |
| Compliance | 3 | surveys, reports, LGPD consents |
| Config | 3 | templates, settings, cache |

### PostgreSQL (Supabase)
- **362 indices** otimizados
- **59 triggers** (updated_at + SLA tracking)
- **84 foreign keys**
- **28 CHECK constraints**
- Seed data completo (16 entidades)

---

## API Reference

### 358 Handlers HTTP em 197 Rotas

| Categoria | Rotas | Handlers |
|---|---|---|
| Authentication | 17 | 38 |
| Admin | 16 | 36 |
| Super Admin | 10 | 17 |
| Tickets | 14 | 31 |
| ITIL (Problem, Change, CMDB, CAB, Catalog) | 17 | 40 |
| Knowledge Base | 20 | 32 |
| AI/ML | 9 | 17 |
| Analytics | 7 | 10 |
| Workflows | 4 | 7 |
| Integrations | 13 | 22 |
| Notifications & Push | 10 | 19 |
| Search | 4 | 8 |
| Dashboard | 5 | 8 |
| Health & Monitoring | 7 | 9 |
| Others (files, SLA, teams, portal, etc.) | 44+ | 64+ |

Documentacao OpenAPI disponivel em `/api/docs`.

---

## Performance

| Metrica | Valor |
|---|---|
| Lighthouse Performance | 92-95/100 |
| Mobile Score | 90-95/100 |
| TTFB | 300-450ms |
| Bundle Size | 245KB gzipped |
| DB Query Avg | 45ms |
| LCP | 2.1s (Good) |
| FID | 85ms (Good) |
| CLS | 0.05 (Good) |

### Otimizacoes
- SSR/ISR com 18 estrategias de cache
- Code splitting e lazy loading
- gzip/brotli compression (~70% reducao)
- 362 indices no banco
- Auth cache in-memory (30s)
- Tree-shaking otimizado

---

## Scripts

```bash
# Desenvolvimento
npm run dev              # Servidor de desenvolvimento
npm run build            # Build para producao
npm run start            # Servidor de producao
npm run lint             # ESLint
npm run type-check       # TypeScript check

# Banco de dados
npm run init-db          # Inicializar SQLite
npm run test-db          # Testar conexao
npm run db:seed          # Seed data
npm run db:clear         # Limpar dados
```

---

## Deploy

### Docker

```bash
docker-compose up -d
# App: http://localhost:3000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Supabase (Producao)

1. Crie um projeto no Supabase
2. Execute `lib/db/schema.postgres.sql` no SQL Editor
3. Execute `lib/db/seed.postgres.sql` para dados iniciais
4. Configure `DATABASE_URL` no `.env.production`
5. `npm run build && npm run start`

### Kubernetes

Health probes disponiveis:
- Liveness: `/api/health/live`
- Readiness: `/api/health/ready`
- Startup: `/api/health/startup`

---

## Licenca

Este projeto esta licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**Construido com Next.js 15, TypeScript, PostgreSQL (Supabase) e Socket.io**
