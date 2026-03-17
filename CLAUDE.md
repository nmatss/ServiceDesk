# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Database Management
```bash
npm run init-db      # Initialize SQLite database with schema and seed data
npm run test-db      # Test database connection
npm run db:seed      # Add seed data only (requires initialized database)
npm run db:clear     # Clear all data from database
```

## Database Architecture

This project uses a **dual-database adapter pattern** supporting both SQLite (development) and PostgreSQL/Supabase (production) with **119 tables**.

### Key Database Files
- **SQLite Schema**: `lib/db/schema.sql` — 3,400+ lines, 119 tables
- **PostgreSQL Schema**: `lib/db/schema.postgres.sql` — 2,720+ lines, full parity
- **Adapter**: `lib/db/adapter.ts` — Unified interface for both databases
- **Connection**: `lib/db/connection.ts` (SQLite) / `lib/db/connection.postgres.ts` (PostgreSQL)
- **Main Queries**: `lib/db/queries.ts` — Type-safe query functions
- **ITIL Queries**: `lib/db/queries/` — problem, change, cmdb, catalog, cab query modules
- **Initialization**: `lib/db/init.ts` (SQLite) / `lib/db/seed.postgres.sql` (PostgreSQL)
- **Types**: `lib/types/database.ts` — TypeScript interfaces for all entities
- **Config**: `lib/db/config.ts` — Database type selector (DB_TYPE=sqlite|postgresql)

### Database Stats (PostgreSQL/Supabase)
| Metric | Count |
|---|---|
| Tables | 119 |
| Indexes | 365 |
| Triggers | 59 |
| Foreign Keys | 84 |
| CHECK Constraints | 28 |

### Table Modules
- **Core Tickets** (12): tickets, comments, attachments, categories, priorities, statuses, tags, ticket_tags, ticket_followers, ticket_relationships, ticket_activities, file_storage
- **Auth & Security** (15): users, refresh_tokens, permissions, roles, role_permissions, user_roles, password_policies, password_history, rate_limits, sso_providers, login_attempts, webauthn_credentials, verification_codes, auth_audit_logs, ticket_access_tokens
- **SLA & Escalation** (5): sla_policies, sla_tracking, escalations, escalation_rules, escalation_instances
- **Notifications** (5): notifications, notification_events, notification_batches, batch_configurations, filter_rules
- **Workflows** (10): automations, workflow_definitions, workflows, workflow_steps, workflow_executions, workflow_step_executions, workflow_approvals, approvals, approval_history, approval_tokens
- **Knowledge Base** (8): knowledge_articles, kb_categories, kb_articles, kb_tags, kb_article_tags, kb_article_feedback, kb_article_attachments, kb_article_suggestions
- **Analytics** (6): analytics_daily_metrics, analytics_agent_metrics, analytics_category_metrics, analytics_realtime_metrics, analytics_events, analytics_agent_performance
- **Multi-Tenancy** (6): organizations, tenants, tenant_configurations, teams, departments, user_departments
- **AI/ML** (4): ai_classifications, ai_suggestions, ai_training_data, vector_embeddings
- **Integrations** (10): integrations, integration_logs, webhooks, webhook_deliveries, communication_channels, communication_messages, whatsapp_contacts, whatsapp_sessions, whatsapp_messages, govbr_integrations
- **ITIL Problem** (6): root_cause_categories, problems, known_errors, problem_incident_links, problem_activities, problem_attachments
- **ITIL Change** (5): change_types, change_requests, change_request_approvals, change_tasks, change_calendar
- **ITIL CMDB** (7): ci_types, ci_statuses, ci_relationship_types, configuration_items, ci_relationships, ci_history, ci_ticket_links
- **ITIL Catalog** (5): service_categories, service_catalog_items, service_requests, service_request_approvals, service_request_tasks
- **ITIL CAB** (3): cab_configurations, cab_members, cab_meetings
- **Audit** (4): audit_logs, audit_advanced, api_usage_tracking, user_sessions
- **Compliance** (3): satisfaction_surveys, scheduled_reports, lgpd_consents
- **Config** (3): ticket_templates, system_settings, cache

### Adapter Pattern
All database access uses the adapter from `lib/db/adapter.ts`:
```typescript
import { executeQuery, executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter'
import type { SqlParam } from '@/lib/db/adapter'
```

**Query execution helpers:**
- `executeQuery<T>(sql, params)` — SELECT returning T[]
- `executeQueryOne<T>(sql, params)` — SELECT returning T | undefined
- `executeRun(sql, params)` — INSERT/UPDATE/DELETE returning {changes, lastInsertRowid?}
- `executeTransaction<T>(callback)` — Transaction with isolation
- `SqlParam` type — Type-safe query parameter (`string | number | boolean | null`)

**16 Dialect helpers** for cross-database SQL:
- `sqlNow()`, `sqlDateSub()`, `sqlDateDiff()`, `sqlGroupConcat()`, `sqlCastDate()`
- `sqlStartOfMonth()`, `sqlDateAdd()`, `sqlDatetimeSub()`, `sqlDatetimeSubHours()`
- `sqlDatetimeSubMinutes()`, `sqlExtractHour()`, `sqlExtractDayOfWeek()`
- `sqlDatetimeSubYears()`, `sqlColSubMinutes()`, `sqlColAddMinutes()`, `sqlDatetimeAddMinutes()`
- `getDatabaseType()` — Returns 'sqlite' | 'postgresql'

## Authentication System

### Implementation
- **JWT tokens**: Access (15min) + Refresh (7d) via `lib/auth/token-manager.ts`
- **Password hashing**: bcryptjs 12 rounds via `lib/auth/password-policies.ts`
- **MFA**: TOTP, SMS, Email, Backup codes via `lib/auth/mfa-manager.ts`
- **SSO**: OAuth2, SAML via `lib/auth/sso-manager.ts`
- **Biometric**: WebAuthn via `lib/auth/biometric-auth.ts`
- **CSRF**: Double Submit Cookie + HMAC-SHA256 via `lib/security/csrf.ts`
- **Middleware**: `middleware.ts` — route protection, tenant resolution, auth verification
- **Unified guard**: `lib/tenant/request-guard.ts` — `requireTenantUserContext(request)`

### RBAC (6 roles, 29 permissions)
```
super_admin → admin → tenant_admin → team_manager → agent → user
```
- Roles defined in `lib/auth/roles.ts` — ALL checks use `ROLES.*` constants and helpers (`isAdmin()`, `isAgent()`, `isPrivileged()`, `canManageTickets()`)
- Permission engine in `lib/auth/rbac.ts`
- Conditional permissions: owner_only, department_only, business_hours
- No hardcoded role strings anywhere in the codebase

### Protected Routes
- Admin routes: `/admin/*` — requires admin/tenant_admin
- Super Admin routes: `/admin/super/*` and `/api/admin/super/*` — requires org 1 or super_admin role
- Auth routes: `/api/auth/*` — login, register, verify, profile, SSO, GovBR
- All API routes: Protected via `requireTenantUserContext()` with tenant isolation

## Application Architecture

### Framework & Stack
- **Next.js 15** with App Router
- **TypeScript** strict mode, 0 errors, path mapping (`@/*`)
- **Tailwind CSS** with custom design system (brand-*, neutral-* classes)
- **SQLite** for development / **PostgreSQL (Supabase)** for production
- **Socket.io** for real-time notifications
- **ioredis** for caching (optional, graceful fallback)

### Directory Structure
```
app/                          # Next.js App Router (85 pages)
├── api/                      # 232 API route files, 405 HTTP handlers
│   ├── auth/                 # Authentication (login, register, SSO, GovBR)
│   │   └── mfa/              # MFA management (setup, verify, disable, status, backup-codes)
│   ├── admin/super/          # Super Admin (dashboard, orgs, users, audit, settings)
│   ├── tickets/              # Ticket CRUD + comments, attachments, tags
│   │   └── bulk-update/      # Bulk ticket operations
│   ├── problems/             # ITIL Problem Management
│   ├── changes/              # ITIL Change Management
│   ├── cmdb/                 # ITIL Configuration Management
│   ├── catalog/              # ITIL Service Catalog
│   ├── cab/                  # Change Advisory Board
│   ├── cron/                 # Background jobs (process-emails, lgpd-retention, cleanup)
│   ├── knowledge/            # Knowledge Base (20 routes)
│   ├── ai/                   # AI features (9 routes)
│   ├── analytics/            # Analytics & reporting
│   ├── workflows/            # Workflow engine
│   ├── integrations/         # Email, WhatsApp
│   ├── notifications/        # Notification management
│   └── health/               # Health probes (live, ready, startup)
├── auth/                     # Auth pages (login, register, forgot-password, govbr)
├── tickets/                  # Ticket pages
├── problems/                 # Problem management pages
├── knowledge/                # Knowledge base pages
├── portal/                   # End-user portal
├── admin/                    # Admin interface
│   └── super/                # Super Admin pages
├── workflows/                # Workflow builder
└── layout.tsx                # Root layout with AppLayout

lib/                          # 50 modules, 376 files
├── db/                       # Database layer (adapter, queries, schemas, migrations)
├── auth/                     # Authentication (25 files: JWT, RBAC, MFA, SSO, biometric)
├── security/                 # Security (25 files: encryption, CSRF, CSP, audit, PII)
├── ai/                       # AI/ML (24 files: classifier, NLP, sentiment, training)
├── notifications/            # Notifications (11 files: multi-channel, escalation, digest)
├── integrations/             # Integrations (21 files: email, WhatsApp, banking, ERP, GovBR)
├── monitoring/               # Monitoring (21 files: logger, Datadog, Sentry, metrics)
├── cache/                    # Caching (18 files: Redis, LRU, browser, warming)
├── performance/              # Performance (20 files: query optimizer, CDN, compression)
├── knowledge/                # Knowledge (12 files: auto-generator, semantic search, vector)
├── workflow/                 # Workflows (11 files: engine, automation, approval)
├── analytics/                # Analytics (11 files: predictive, anomaly, demand forecasting)
├── pwa/                      # PWA (12 files: offline, push, sync, biometric)
├── api/                      # API utilities (21 files: helpers, validation, versioning)
├── tenant/                   # Multi-tenancy (9 files: context, resolver, guard)
├── validation/               # Validation (4 files: 50+ Zod schemas)
├── hooks/                    # Custom hooks (13 files: auth cache, debounce, gestures)
├── types/                    # Types (4 files: database, problem, workflow, super-admin)
├── design-system/            # Design system (5 files: tokens, themes, personas)
└── ...                       # + email, reports, sla, search, compliance, lgpd, gamification

src/components/               # 134 components
├── workflow/                 # 27 components (15 node types, 3 edge types, builder)
├── dashboard/                # 24 components (12 widgets, builder, COBIT)
├── mobile/                   # 13 components (gestures, biometria, voice)
├── tickets/                  # 12 components (kanban, timeline, collaborative editor)
├── charts/                   # 7 components (heatmaps, sankey, radar)
├── pwa/                      # 6 components (install, offline, sync)
├── admin/                    # 5 components (super admin dashboard)
├── notifications/            # 4 components
├── knowledge/                # 4 components
├── gamification/             # 3 components (badges, leaderboard, recognition)
└── layout/                   # 3 components (AppLayout, Header, Sidebar)

components/ui/                # 49 base UI components
```

### Key Patterns
- **Adapter Pattern**: All DB access via `lib/db/adapter.ts` (zero direct SQLite in production)
- **Unified Auth Guard**: `requireTenantUserContext(request)` from `lib/tenant/request-guard.ts`
- **Super Admin Guard**: `requireSuperAdmin(request)` from `lib/auth/super-admin-guard.ts`
- **API Responses**: `apiSuccess(data, meta?)` and `apiError(message, status)` from `lib/api/api-helpers.ts`
- **Tenant Isolation**: All queries scope by `organization_id`
- **Rate Limiting**: `applyRateLimit(request, RATE_LIMITS.*)` on all endpoints
- **Dialect-aware SQL**: Use `getDatabaseType()` + helpers for cross-DB compatibility
- **Type Safety**: Comprehensive TypeScript interfaces for all database entities; `SqlParam` type for query params
- **Integration Pattern**: `BaseConnector` class from `lib/integrations/base-connector.ts` for all integrations
- **SLA Service**: `lib/sla/sla-service.ts` — application-layer SLA tracking (replaces DB triggers)

## Super Admin Area

### Access Control
- **Guard**: `lib/auth/super-admin-guard.ts` — `requireSuperAdmin(request)` verifies `organizationId === 1` OR `role === 'super_admin'`
- **Sidebar**: Super Admin menu section (amber-themed) appears only for org 1 users
- **Types**: `lib/types/super-admin.ts` — all interfaces for the module

### API Routes (`/api/admin/super/`)
| Route | Methods | Description |
|---|---|---|
| `dashboard` | GET | Aggregated cross-tenant stats, alerts, recent orgs |
| `organizations` | GET, POST | Paginated org list with filters + create new org |
| `organizations/[id]` | GET, PUT, DELETE | Org detail, update, soft-delete |
| `organizations/[id]/suspend` | POST | Toggle suspend/reactivate |
| `organizations/[id]/stats` | GET | Org metrics (tickets by status, users by role) |
| `organizations/[id]/users` | GET | Users of specific org |
| `users` | GET | Cross-tenant user list with filters |
| `users/[id]` | GET, PUT | User detail + admin actions (reset pw, change role, deactivate) |
| `audit` | GET | Cross-tenant audit logs with date/org/action filters |
| `settings` | GET, PUT | System-wide settings (maintenance, limits, SMTP, security) |

### Pages (`/admin/super/`)
| Page | Description |
|---|---|
| `/admin/super` | Dashboard — StatsCards, alerts, recent orgs |
| `/admin/super/organizations` | Org list — table/cards, filters, create modal |
| `/admin/super/organizations/[id]` | Org detail — 4 tabs: Info, Usuarios, Config, Metricas |
| `/admin/super/users` | Cross-tenant users — table with role/status badges, actions |
| `/admin/super/audit` | Audit logs — expandable rows, date range filters |
| `/admin/super/settings` | System settings — 4 sections: Geral, Limites, SMTP, Seguranca |

## Frontend Components

### Styling System
- **Design System**: `lib/design-system/tokens.ts` — colors, spacing, typography
- **Brand colors**: Use `brand-*` classes (sky-blue #0ea5e9) for CTAs, links, accents
- **Neutrals**: Use `neutral-*` classes (NEVER `gray-*`) for backgrounds, borders, text
- **Priority colors**: low (green), medium (yellow), high (orange), critical (red)
- **Status colors**: open (blue), in-progress (yellow), resolved (green), closed (neutral)
- **Dark mode**: Always pair light classes with `dark:` variants
- **Custom animations**: fade-in, slide-up, pulse-soft

### UI Components
- **Headless UI** for accessible components (Dialog, Menu, etc.)
- **Heroicons + Lucide React** for iconography
- **Framer Motion** for animations
- **React Hot Toast** for notifications
- **Recharts + D3** for analytics visualization
- **ReactFlow** for workflow builder

## Security

### Implemented Protections
- **JWT**: HS256, access (15min) + refresh (7d), httpOnly cookies, device fingerprinting
- **Password**: bcryptjs 12 rounds, entropy check, dictionary, history (5), 90-day expiration
- **MFA**: TOTP + SMS + Email + Backup codes (10), HMAC-SHA256 hashed storage
- **CSRF**: Double Submit Cookie + HMAC-SHA256, session-bound, 1-hour expiry
- **Encryption**: AES-256-GCM with key rotation for sensitive fields
- **CSP**: Strict mode in production, Permissions-Policy, HSTS, X-Frame-Options DENY
- **Rate Limiting**: Per-endpoint limits (login 5/15min, register 3/hr, default 60/min); Redis-backed when `REDIS_URL` is set, in-memory fallback
- **SQL Injection**: Parameterized queries + LIKE wildcard escaping
- **XSS**: isomorphic-dompurify sanitization
- **Tenant Isolation**: organization_id scoping + JWT validation in middleware
- **SSRF Protection**: Workflow webhook executor uses IP whitelist
- **Workflow Security**: Tenant isolation (org_id enforced), secrets masking in variable logging
- **Approval Tokens**: Stored in database (not in-memory)
- **LGPD/GDPR**: Consent tracking, data portability, erasure, 3-year retention

### Security Patterns to Follow
```typescript
// LIKE escaping
const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
conditions.push("(name LIKE ? ESCAPE '\\')");

// Pagination cap
const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);

// Division by zero
`NULLIF(divisor, 0)`

// Date validation
const date = new Date(input); if (isNaN(date.getTime())) return apiError('Invalid date', 400);

// Array input limit
const ids = requestIds.slice(0, 50);
```

## Performance

### Metrics
| Metric | Value |
|---|---|
| Lighthouse Performance | 92-95/100 |
| Mobile Score | 90-95/100 |
| TTFB | 300-450ms |
| Bundle Size | 245KB gzipped |
| DB Query Avg | 45ms |
| LCP | 2.1s (Good) |
| FID | 85ms (Good) |
| CLS | 0.05 (Good) |

### Optimizations
- **SSR/ISR**: 10+ critical pages, 18 API endpoints with cache strategies
- **Code Splitting**: Lazy loading for admin, charts, editors, PDF/Excel
- **Compression**: gzip/brotli in server.ts (~70% reduction)
- **Auth Cache**: 30s in-memory cache eliminates redundant /api/auth/verify calls (cache-first rendering, no loading spinner on navigation)
- **Dashboard Parallelization**: Dashboard queries use `Promise.all` for concurrent execution
- **DB Indexes**: 365 indexes, N+1 queries eliminated with JOINs
- **Tree-shaking**: optimizePackageImports for heroicons, headlessui, lucide-react, recharts, framer-motion, date-fns

## Cron Jobs (Vercel)

| Route | Schedule | Description |
|-------|----------|-------------|
| `/api/cron/process-emails` | `*/5 * * * *` | Process email queue (max 50/cycle) |
| `/api/cron/lgpd-retention` | `0 3 * * *` | LGPD data retention, consent expiry, anonymization |
| `/api/cron/cleanup` | `0 4 * * *` | Clean expired tokens, sessions, cache, old audit logs |

All cron routes require `CRON_SECRET` env var for authentication.

## Common Development Tasks

### Adding New Features
1. Update database schema in both `schema.sql` and `schema.postgres.sql`
2. Add TypeScript types in `lib/types/database.ts`
3. Create query functions using adapter (`executeQuery`, `executeRun`)
4. Use dialect helpers (`sqlNow()`, etc.) for cross-DB SQL
5. Implement API routes with `requireTenantUserContext()` guard
6. Add rate limiting with `applyRateLimit(request, RATE_LIMITS.*)`
7. Return responses with `apiSuccess()` / `apiError()`
8. Build frontend components with dark mode (`dark:` variants) and Portuguese i18n

### Adding New API Routes
```typescript
import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  const data = await executeQuery('SELECT * FROM table WHERE organization_id = ?', [context.organizationId]);
  return apiSuccess(data);
}
```

## Build & Deploy

### Build Status
- **TypeScript**: 0 errors
- **Next.js Build**: SUCCESS (304 routes, 85 pages)
- **SQLite→PG Migration**: 100% complete
- **ESLint `any` warnings**: ~1,141 (reduced from ~1,900; suppressed via `ignoreDuringBuilds`)
- **Color compliance**: 0 `blue-*`, 0 `gray-*`, 0 hardcoded role strings
- **Cron Jobs**: 3 scheduled tasks

### Infrastructure
- **Docker**: Multi-stage build (<200MB), non-root user, tini init
- **Kubernetes**: Health probes at /api/health/live, /ready, /startup
- **Supabase**: PostgreSQL with 119 tables, 365 indexes, 59 triggers
- **Monitoring**: Sentry (server/client/edge) + Prometheus metrics
- **Custom Server**: server.ts with Socket.io + compression + graceful shutdown
- **Environment**: `CRON_SECRET` for cron auth, `REDIS_URL` for Redis-backed rate limiting (optional)
