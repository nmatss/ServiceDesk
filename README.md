# ServiceDesk

**Plataforma Enterprise ITSM — Gestao de Atendimento, Tickets e Equipes**

[![TypeScript](https://img.shields.io/badge/TypeScript-0%20errors-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Visao Geral

ServiceDesk e uma plataforma completa de ITSM (IT Service Management) compativel com ITIL v4, projetada para organizacoes que precisam de gestao profissional de atendimento, incidentes e servicos de TI.

**Diferenciais:**
- **Multi-tenant** — Isolamento completo entre organizacoes com Super Admin cross-tenant
- **ITIL Completo** — Problem, Change, CMDB, Service Catalog e CAB integrados
- **IA/ML** — Classificacao automatica, sugestoes, analise de sentimento e busca semantica
- **Tempo Real** — Notificacoes via WebSocket, presenca de usuarios e atualizacoes ao vivo
- **PWA** — Funciona offline, push notifications, instalavel e biometria mobile
- **Seguranca Enterprise** — JWT, MFA, WebAuthn, RBAC com 6 roles, criptografia AES-256-GCM, LGPD

| Metrica | Valor |
|---|---|
| Build | SUCCESS, 0 erros TypeScript |
| Paginas | 199 |
| Rotas de API | 197 arquivos, 352+ handlers HTTP |
| Componentes React | 217 (170 feature + 47 UI base) |
| Tabelas no Banco | 119 |
| Indices | 365 |
| Modulos em lib/ | 46 diretorios, 398 arquivos |

---

## Features

### Core
- Tickets com ciclo de vida completo, SLA tracking e breach detection
- Dashboard com 12 widgets configuraveis e relatorios COBIT
- Analytics preditivo, deteccao de anomalias e demand forecasting
- Kanban board, timeline, templates, operacoes em massa e busca avancada
- Knowledge Base com busca semantica, versionamento e aprovacoes

### ITIL

| Modulo | Tabelas | Funcionalidades |
|---|---|---|
| Problem Management | 6 | RCA, known errors, incident links, activities |
| Change Management | 5 | Requests, approvals, tasks, calendario |
| CMDB | 7 | CIs, relationships, historico, ticket links |
| Service Catalog | 5 | Items, requests, approvals, tasks |
| CAB | 3 | Meetings, members, votacao |

### IA/ML
- Classificacao automatica de tickets (NLP)
- Deteccao de duplicatas (vector similarity)
- Analise de sentimento em tempo real
- Sugestao de solucoes e geracao automatica de artigos
- Sistema de treinamento com feedback loop

### Seguranca

| Camada | Implementacao |
|---|---|
| Autenticacao | JWT (15min access + 7d refresh), httpOnly cookies |
| Senha | bcrypt 12 rounds, entropy check, historico, expiracao |
| MFA | TOTP + SMS + Email + Backup codes |
| Biometria | WebAuthn/FIDO2 |
| SSO | OAuth2, SAML, Gov.br |
| RBAC | 6 roles, 29 permissoes, condicoes dinamicas |
| CSRF | Double Submit Cookie + HMAC-SHA256 |
| Criptografia | AES-256-GCM com key rotation |
| Rate Limiting | Per-endpoint (login 5/15min, default 60/min) |
| LGPD/GDPR | Consentimento, portabilidade, erasure |

### Real-time e Workflows
- Notificacoes via Socket.io, push notifications e alertas de SLA
- Presenca de usuarios e atualizacoes de tickets ao vivo
- Workflow builder visual com 15 tipos de no e 3 tipos de edge
- Automacoes com condicoes e aprovacoes multi-nivel

### Integracoes
- **Email** — SMTP + IMAP com templates Handlebars
- **WhatsApp** — Business API, templates, sessoes e contatos
- **ERP** — Conectores TOTVS e SAP
- **Banking** — PIX e Boleto
- **Gov.br** — Autenticacao CPF/CNPJ
- **Webhooks** — Envio e recebimento com HMAC

### PWA e Mobile
- Modo offline com fila de operacoes e background sync
- Push notifications e install prompt
- Biometria mobile e gestos (swipe, pinch, long-press)

---

## Stack Tecnologico

| Camada | Tecnologias |
|---|---|
| **Frontend** | Next.js 15, React 18, TypeScript 5, Tailwind CSS 3, Recharts, D3, ReactFlow, Framer Motion |
| **Backend** | Next.js API Routes, Socket.io, Bull (filas), Node.js 20 |
| **Banco de Dados** | PostgreSQL 16 (Supabase) em producao, SQLite (dev), adapter dual-database |
| **Cache** | Redis 7 + LRU in-memory (30s auth cache) |
| **Autenticacao** | JWT + Refresh Tokens, MFA (TOTP/SMS/Email), SSO (OAuth2/SAML), WebAuthn, Gov.br |
| **IA** | OpenAI API, Fuse.js, vector embeddings |
| **Monitoramento** | Sentry (server/client/edge), Datadog APM, Prometheus, Winston |
| **Deploy** | Docker multi-stage (<200MB), Kubernetes-ready, Vercel |

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

---

## Variaveis de Ambiente

| Variavel | Descricao | Obrigatoria |
|---|---|---|
| `DB_TYPE` | `sqlite` ou `postgresql` | Sim |
| `DATABASE_URL` | URL de conexao PostgreSQL | Producao |
| `JWT_SECRET` | Chave secreta para tokens JWT | Sim |
| `CSRF_SECRET` | Chave secreta para tokens CSRF | Sim |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Configuracao de email | Opcional |
| `REDIS_URL` | URL de conexao Redis | Opcional |
| `SENTRY_DSN` | DSN do Sentry para monitoramento | Opcional |
| `OPENAI_API_KEY` | Chave da API OpenAI para IA | Opcional |

---

## Estrutura do Projeto

```
ServiceDesk/
├── app/                          # Next.js App Router (199 paginas)
│   ├── api/                      # 197 arquivos de rota API
│   │   ├── auth/                 # Auth (login, register, SSO, GovBR, MFA)
│   │   ├── admin/super/          # Super Admin (10 rotas)
│   │   ├── tickets/              # Tickets CRUD + subrecursos
│   │   ├── problems/             # ITIL Problem Management
│   │   ├── changes/              # ITIL Change Management
│   │   ├── cmdb/                 # ITIL CMDB
│   │   ├── catalog/              # ITIL Service Catalog
│   │   ├── cab/                  # Change Advisory Board
│   │   ├── knowledge/            # Knowledge Base
│   │   ├── ai/                   # AI/ML
│   │   ├── analytics/            # Analytics & reporting
│   │   ├── workflows/            # Workflow engine
│   │   ├── notifications/        # Notificacoes
│   │   └── health/               # Health probes
│   ├── auth/                     # Paginas de autenticacao
│   ├── tickets/                  # Gestao de tickets
│   ├── admin/super/              # Super Admin (6 paginas)
│   └── portal/                   # Portal do usuario final
│
├── lib/                          # 46 modulos, 398 arquivos
│   ├── db/                       # Banco de dados (adapter, queries, schemas)
│   ├── auth/                     # Autenticacao (25 arquivos)
│   ├── security/                 # Seguranca (25 arquivos)
│   ├── ai/                       # IA/ML (24 arquivos)
│   ├── integrations/             # Integracoes (21 arquivos)
│   ├── monitoring/               # Monitoramento (21 arquivos)
│   ├── cache/                    # Cache Redis/LRU (18 arquivos)
│   ├── tenant/                   # Multi-tenancy (9 arquivos)
│   └── ...                       # + notifications, workflow, analytics, pwa, hooks, types
│
├── src/components/               # 170 componentes feature
├── components/ui/                # 47 componentes UI base
├── server.ts                     # Custom server (Socket.io + compression)
├── middleware.ts                  # Auth, tenant, rate limiting, headers
├── Dockerfile                    # Multi-stage build (<200MB)
└── docker-compose.yml            # Docker Compose config
```

---

## Scripts

```bash
# Desenvolvimento
npm run dev              # Servidor de desenvolvimento (localhost:3000)
npm run build            # Build para producao
npm run start            # Servidor de producao
npm run lint             # ESLint
npm run type-check       # TypeScript check

# Banco de dados
npm run init-db          # Inicializar SQLite com schema e seed
npm run test-db          # Testar conexao
npm run db:seed          # Seed data
npm run db:clear         # Limpar dados
```

---

## Banco de Dados

### 119 tabelas organizadas em 18 modulos

| Modulo | Tabelas | Descricao |
|---|---|---|
| Core Tickets | 12 | tickets, comments, attachments, categories, priorities, statuses, tags |
| Auth & Security | 15 | users, roles, permissions, refresh_tokens, MFA, SSO, WebAuthn |
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

**PostgreSQL (Supabase):** 365 indices, 59 triggers, 84 foreign keys, 28 CHECK constraints

**Adapter Pattern:** Suporte dual SQLite/PostgreSQL com 16 dialect helpers para SQL cross-database.

---

## Deploy

### Docker

```bash
docker build -t servicedesk .
docker-compose up -d
```

### Supabase (Producao)

1. Crie um projeto no [Supabase](https://supabase.com/)
2. Execute `lib/db/schema.postgres.sql` no SQL Editor
3. Execute `lib/db/seed.postgres.sql` para dados iniciais
4. Configure `DATABASE_URL` e `DB_TYPE=postgresql`
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
