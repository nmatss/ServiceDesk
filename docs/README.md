# Insighta Documentation

**Insighta** is a multi-tenant ITSM SaaS platform built with Next.js 15, TypeScript, and Supabase PostgreSQL.

- **Domain**: [insighta.com.br](https://insighta.com.br)
- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase PostgreSQL
- **Database**: 126 tables, 365 indexes, 59 triggers
- **API**: 232 route files, 405 HTTP handlers

---

## Quick Links

| Document | Description |
|----------|-------------|
| [ONBOARDING.md](./ONBOARDING.md) | 5-day onboarding plan for new developers |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Architecture, patterns, and development workflow |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines and PR process |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture deep dive |
| [DATABASE.md](./DATABASE.md) | Database schema and adapter pattern |
| [api/README.md](./api/README.md) | API reference and examples |
| [CI_CD_GUIDE.md](./CI_CD_GUIDE.md) | Deployment pipelines and Vercel config |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment guide |
| [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) | Infrastructure and monitoring |
| [CODE_QUALITY_REPORT.md](./CODE_QUALITY_REPORT.md) | Code quality audit and standards |

---

## Architecture Overview

```
app/                    Next.js App Router (85 pages, 232 API routes)
lib/                    50 modules, 376 files
  db/                   Database layer (adapter, queries, schemas)
  auth/                 Authentication (JWT, RBAC, MFA, SSO, biometric)
  billing/              Plan definitions, feature gates, Stripe integration
  security/             Encryption, CSRF, CSP, audit, PII
  ai/                   Classifier, NLP, sentiment, training
  tenant/               Multi-tenancy (context, resolver, guard)
  integrations/         Email, WhatsApp, banking, ERP, GovBR
src/components/         134 React components
components/ui/          49 base UI components
```

Key patterns:
- **Adapter pattern** for dual DB support (SQLite dev / PostgreSQL prod)
- **Tenant isolation** via `organization_id` scoping on all queries
- **Unified auth guard**: `requireTenantUserContext(request)` on all protected routes
- **Rate limiting** on all API endpoints (Redis-backed or in-memory fallback)

---

## Billing System

Insighta uses a 4-tier billing model with Stripe integration and backend feature gating.

| Tier | Price (monthly) | Agents | Tickets/mo | Key Features |
|------|-----------------|--------|------------|--------------|
| **Starter** | Free | 3 | 100 | Email integration, basic analytics |
| **Essencial** | R$89 | 10 | Unlimited | AI basic, ITIL incident, WhatsApp, RBAC |
| **Profissional** | R$149 | 50 | Unlimited | AI copilot, ITIL standard, workflows, API integrations |
| **Enterprise** | Sob consulta | Unlimited | Unlimited | Full AI, full ITIL, predictive analytics, enterprise security |

### Key Files

| File | Purpose |
|------|---------|
| `lib/billing/plans.ts` | Single source of truth for plan tiers, limits, and feature levels |
| `lib/billing/feature-gate.ts` | Backend middleware gating 68 API routes by plan tier |
| `lib/billing/stripe-client.ts` | Stripe SDK wrapper |
| `lib/billing/subscription-manager.ts` | Subscription lifecycle management |
| `lib/hooks/usePlan.ts` | React hook for plan-aware UI rendering |

---

## Feature Gating

The feature gate system enforces plan limits at two layers:

1. **Backend** (`lib/billing/feature-gate.ts`): Checks the organization's plan tier before allowing access to gated API routes. 68 routes are gated across modules (AI, ITIL, workflows, integrations, analytics, security).

2. **Frontend** (`lib/hooks/usePlan.ts`): React hook that exposes the current plan and feature levels, enabling conditional rendering of upgrade prompts and feature locks.

Feature levels are hierarchical per module (e.g., AI: none < basic < copilot < full). The `meetsFeatureLevel()` function in `lib/billing/plans.ts` handles comparisons.

---

## Key Directories

```
docs/
  api/                  API reference
  admin/                Admin guides
  architecture/         Architecture documents
  deployment/           Deployment guides
  developer/            Developer resources
  guides/               How-to guides
  operations/           Operational runbooks
  sprints/              Sprint planning docs
  user/                 End-user documentation
  user-guide/           User guide
```

---

## Development Quick Start

```bash
npm install            # Install dependencies
npm run init-db        # Initialize SQLite database
npm run dev            # Start dev server (localhost:3000)
npm run build          # Production build
npm run lint           # ESLint
npm run type-check     # TypeScript checking
```

Admin login (dev): `admin@servicedesk.com` / `123456`

---

## External Resources

- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://docs.stripe.com/)

---

Last updated: March 23, 2026
