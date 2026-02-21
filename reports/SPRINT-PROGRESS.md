# ServiceDesk QA - Progresso dos Sprints

**Última atualização:** 2026-02-21
**Status geral:** Sprint 1-8 TODOS concluídos

---

## Sprints Concluídos

### Sprint 1: Segurança Crítica (CONCLUÍDO)
> 8/8 correções aplicadas

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 1.1 | Removido `new Function()` - substituído por avaliador seguro de expressões (whitelist de operadores, resolução de paths, suporte a &&/\|\|) | `lib/auth/dynamic-permissions.ts:401-490` |
| 1.2 | Removido `eval()` de batching - substituído por Map de groupers predefinidos (`by_user`, `by_type`, `by_ticket`, `by_priority`, `by_category`, `by_channel`) | `lib/notifications/batching.ts:93-113` |
| 1.3 | Removido `eval()` de ML pipeline - substituído por parser aritmético recursivo (`safeCalculate()`) | `lib/analytics/ml-pipeline.ts:253-320` |
| 1.4 | Corrigido fail-open no RBAC - `return true` → `return false` no catch (deny by default) | `lib/auth/rbac-engine.ts:232` |
| 1.5 | Removidos TODOS os fallbacks `organization_id \|\| 1` - agora retorna 401 se ausente | `app/api/admin/tickets/route.ts`, `app/api/admin/users/[id]/route.ts` (10 ocorrências), `app/api/sla/route.ts` (2 ocorrências), `app/api/sla/tickets/route.ts`, `app/api/admin/sla/route.ts` |
| 1.6 | Lockout aumentado de 1min → 15min | `app/api/auth/login/route.ts:303` |
| 1.7 | SQL injection LGPD corrigido - string interpolation → parameterized queries | `lib/lgpd/data-portability.ts:298-313`, `lib/lgpd/consent-manager.ts:304-333` |
| 1.8 | `npm audit fix` executado - vulnerabilidades reduzidas de 65 → 39 (restantes requerem breaking changes) | `package-lock.json` |

---

### Sprint 2: Estabilidade do Banco de Dados (CONCLUÍDO)
> 12/13 correções aplicadas (1 deferida para Sprint 5)

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 2.1 | Transaction isolation cmdb-queries - 4 funções: `createConfigurationItem()`, `updateConfigurationItem()`, `addCIRelationship()`, `removeCIRelationship()` agora usam `db.run()`/`db.get()` dentro do callback | `lib/db/queries/cmdb-queries.ts` |
| 2.2 | Transaction isolation catalog-queries - 2 funções: `approveServiceRequest()`, `rejectServiceRequest()` corrigidas + adicionado parâmetro `db` ao callback | `lib/db/queries/catalog-queries.ts` |
| 2.3 | Transaction isolation rbac.ts - 3 funções: `setRolePermissions()`, `setUserRoles()`, `initializeDefaultRolesAndPermissions()` + 2 helpers refatorados (`setupDefaultRolePermissions`, `assignPermissionsToRoleWithDb`) | `lib/auth/rbac.ts` |
| 2.4 | Status keys `getProblemStatistics()` - Corrigido statusMap: `new`→`open`, `investigation`→`identified`, `root_cause_identified`→`root_cause_analysis` | `lib/db/queries/problem-queries.ts:~1093` |
| 2.5 | Column names cab-queries - Verificado consistente (`actual_start`/`actual_end`). Schema parity com PG será Sprint 5 | `lib/db/queries/cab-queries.ts` (sem alteração) |
| 2.6 | `createCABMeeting()` - Adicionados `title` e `scheduled_date` ao INSERT + tipo `CABMeeting` atualizado | `lib/db/queries/cab-queries.ts:~287`, `lib/types/database.ts:~1903` |
| 2.7 | `getProblemIncidents()` - Substituído `t.ticket_number` por `('TKT-' \|\| CAST(t.id AS TEXT)) as ticket_number` | `lib/db/queries/problem-queries.ts:~594` |
| 2.8 | SQL SQLite-específico - 7 helper functions criadas no adapter (`sqlNow`, `sqlCurrentDate`, `sqlDateDiff`, `sqlDateSub`, `sqlStartOfMonth`, `sqlDateAdd`, `sqlCastDate`). 10 substituições em 4 query modules. Zero funções SQLite-específicas remanescentes | `lib/db/adapter.ts` (helpers), `problem-queries.ts`, `change-queries.ts`, `cmdb-queries.ts`, `catalog-queries.ts` |
| 2.9 | Placeholder conversion `?` → `$N` - Parser character-by-character que respeita strings entre aspas simples | `lib/db/adapter.ts:195-228` |
| 2.10 | SSL PostgreSQL - `rejectUnauthorized` agora configurável via env `DATABASE_SSL_REJECT_UNAUTHORIZED`, suporte a `DATABASE_CA_CERT` | `lib/db/connection.postgres.ts:47-53` |
| 2.11 | ~~CHECK constraints alignment~~ - **DEFERIDO para Sprint 5** (schema parity) | - |
| 2.12 | TypeScript type `CABMeeting` - Adicionados campos `title: string` e `scheduled_date: string` | `lib/types/database.ts:~1903` |
| 2.13 | Empty array IN clauses - 6 guards adicionados (3 em problem-queries, 3 em change-queries). cab/catalog/cmdb já estavam seguros | `lib/db/queries/problem-queries.ts`, `lib/db/queries/change-queries.ts` |

---

## Verificação Final (após Sprint 1 + 2)

- **TypeScript (`tsc --noEmit`)**: 0 erros
- **Build (`npm run build`)**: Sucesso completo
- **SQLite-specific SQL nos query modules**: 0 ocorrências (grep confirma)
- **`eval()`/`new Function()` no codebase ativo**: 0 (removidos 3)
- **`organization_id || 1` fallbacks**: 0 (removidos ~15)
- **Transaction isolation bugs**: 0 (corrigidas 9 funções em 3 arquivos)

---

## Sprints Concluídos (continuação)

### Sprint 3: Consistência do Backend (CONCLUÍDO)
> 10/10 correções aplicadas

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 3.1 | Guard unificado `requireTenantUserContext()` — retorna `{ auth, context, response }`, extrai JWT de cookies/header, valida tenant | `lib/tenant/request-guard.ts` |
| 3.2 | Padronização tenant `organization_id` — 14+ arquivos migrados para guard unificado (CMDB, CAB, Catalog, Admin governance). 24 rotas não-críticas pendentes | Múltiplos em `app/api/` |
| 3.3 | Formato de resposta API padronizado — criados helpers `apiSuccess()`/`apiError()`, 43 respostas de erro corrigidas em 9 arquivos | `lib/api/api-helpers.ts`, 9 route files |
| 3.4 | Roles centralizados — `ROLES`, `ADMIN_ROLES`, `TICKET_MANAGEMENT_ROLES` + helpers `isAdmin()`, `isAgent()`, etc. 8 arquivos críticos atualizados | `lib/auth/roles.ts`, `middleware.ts`, 7 routes |
| 3.5 | Validação Zod em tickets — adicionada ao PATCH handler de `tickets/[id]` (create/create-v2 já tinham) | `app/api/tickets/[id]/route.ts` |
| 3.6 | Refresh token no login — ambos login e login-v2 agora geram refresh token via `token-manager.ts`, paridade com registro | `app/api/auth/login/route.ts`, `login-v2/route.ts` |
| 3.7 | Migração admin/users/[id] para adapter — removido `userQueries` síncrono, criados helpers async com `executeQueryOne`/`executeRun` | `app/api/admin/users/[id]/route.ts` |
| 3.8 | PUBLIC_ROUTES granularizados — substituído `/api/auth` amplo por rotas específicas (login, register, verify, refresh, login-v2, csrf-token, sso, govbr) | `middleware.ts` |
| 3.9 | Rate limiting duplo — verificado: nenhuma rota aplica rate limiting em middleware E handler simultaneamente. Sem alteração necessária | N/A |
| 3.10 | Sanitização XSS — criado `sanitizeHtml()`/`sanitizeText()` via isomorphic-dompurify, aplicado em PATCH tickets e POST comments | `lib/validation/sanitize.ts`, 2 route files |

---

### Sprint 4: Frontend Critical Fixes (CONCLUÍDO)
> 4/4 correções aplicadas

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 4.1 | Dashboard admin com dados reais — removido dados hardcoded, conectado a APIs `/api/admin/stats`, `/api/tickets/stats` | `app/admin/page.tsx` |
| 4.2 | Layout padronizado Changes/CMDB — consistência com padrão de Problems (tabelas, filtros, paginação, breadcrumbs) | `app/admin/changes/`, `app/admin/cmdb/` |
| 4.3 | onClick handlers implementados — botões vazios agora têm funcionalidade ou toast "Feature not yet implemented" | Múltiplos em `app/admin/`, `app/portal/` |
| 4.4 | Filtros/dark mode/toast — filtros de status corrigidos, dark mode consistente, react-hot-toast unificado | Múltiplos em `app/admin/` |

---

### Limpeza adicional (CONCLUÍDO)
- Removidos 4 arquivos .bak/.backup
- 9 arquivos com `getDatabase` — todos usam ativamente, sem imports não-usados

---

## Verificação Final (após Sprint 1-4)

- **TypeScript (`tsc --noEmit`)**: 0 erros
- **Build (`npm run build`)**: Sucesso completo
- **Rotas críticas migradas para guard unificado**: tickets, problems, changes, cmdb, cab, catalog, admin
- **API responses padronizadas**: `{ success: true/false, data/error }`
- **Roles centralizados**: `lib/auth/roles.ts` usado em middleware e rotas críticas
- **XSS sanitização**: tickets e comments protegidos via DOMPurify
- **Refresh tokens**: login e register com paridade completa

---

## Sprints Concluídos (continuação)

### Sprint 5: PostgreSQL Parity (CONCLUÍDO)
> 3/3 correções aplicadas

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 5.1 | Adicionadas 6 tabelas faltantes ao PostgreSQL — `ticket_access_tokens`, `workflows`, `workflow_steps`, `approvals`, `approval_history`, `approval_tokens` com indexes, FKs e CHECK constraints | `lib/db/schema.postgres.sql` |
| 5.2 | Adicionada função trigger `update_updated_at_column()` + 58 triggers `BEFORE UPDATE` para todas tabelas com `updated_at` | `lib/db/schema.postgres.sql` |
| 5.3 | Adicionados CHECK constraints e indexes faltantes — alinhamento entre schemas SQLite e PostgreSQL | `lib/db/schema.postgres.sql` |

---

### Sprint 6: Qualidade do Código e Organização (CONCLUÍDO)
> 3/3 correções aplicadas

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 6.1 | Config fixes — `start` script corrigido para `tsx server.ts`, path hardcoded removido (usa `path.join(__dirname)`), `src/**` removido do tsconfig exclude | `package.json`, `next.config.js`, `tsconfig.json` |
| 6.2 | Dependências duplicadas auditadas — `@types/redis` removido (redis@5 inclui tipos próprios). bcrypt/bcryptjs, redis/ioredis, better-sqlite3/sqlite3 mantidos pois ambos são usados ativamente | `package.json` |
| 6.3 | 315 arquivos .md organizados — movidos de raiz para `docs/archive/` (91), `docs/sprints/` (10), `docs/guides/` (168), `docs/api/` (19), `docs/` (51). Mantidos na raiz: README, CLAUDE, CONTRIBUTING, SECURITY | Múltiplos |

---

### Sprint 7: UX/UI Polish (CONCLUÍDO)
> 1/1 correção aplicada

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 7.1 | Componente `FormField` criado (input/textarea/select com dark mode, acessibilidade, erros) + hook `useDebounce` criado + debounce aplicado a buscas em list pages | `components/ui/FormField.tsx`, `lib/hooks/useDebounce.ts`, `app/admin/problems/page.tsx`, `app/admin/changes/page.tsx` |

---

### Sprint 8: DevOps e Hardening (CONCLUÍDO)
> 1/1 correção aplicada (7 sub-itens)

| # | Correção | Arquivo(s) |
|---|---------|------------|
| 8.1 | CSP: `unsafe-eval` removido de produção (mantido apenas em dev) | `lib/security/helmet.ts` |
| 8.2 | Nginx: `client_max_body_size 10M` + bloco TLS comentado para provisionamento futuro | `nginx/conf.d/default.conf` |
| 8.3 | Rate limit: guard `BYPASS_RATE_LIMIT` bloqueado em produção | `lib/rate-limit/redis-limiter.ts` |
| 8.4 | Redis dev: `--requirepass devpassword` adicionado ao docker-compose.dev | `docker-compose.dev.yml` |
| 8.5 | CSP consolidado: headers.ts delega para helmet.ts, sem conflito | `lib/security/headers.ts` |

---

## Migração SQLite → Adapter (CONCLUÍDO)
> 5/5 ondas aplicadas — 52 arquivos migrados

| Wave | Escopo | Arquivos |
|------|--------|----------|
| Wave 1 | 8 API routes migradas de getDatabase()/queries.ts para adapter | `audit/logs`, `db-stats`, `admin/settings`, `admin/tickets/[id]`, `analytics`, `portal/tickets/[id]`, `workflows/execute`, `tickets/create` |
| Wave 2 | Core auth + repositories — sqlite-auth.ts totalmente async (9 funções), ticket-repository, user-repository | `lib/auth/sqlite-auth.ts`, `lib/repositories/*.ts`, `lib/auth/sso-manager.ts` |
| Wave 3 | 20 módulos de integração (email/4, whatsapp/5, erp/2, banking/2, govbr/4, webhook, email-automation) | `lib/integrations/**/*.ts` |
| Wave 4 | 12 módulos biblioteca (security/4, analytics/2, workflow/1, tenant/resolver, dashboard, cache) | `lib/security/*.ts`, `lib/analytics/*.ts`, `lib/workflow/*.ts`, etc. |
| Wave 5 | Fixes críticos: portal tenant isolation, N+1 queries em 4 módulos ITIL, 56 console.log→logger | Múltiplos |

### Estatísticas de migração (antes → depois)
- Imports `@/lib/db/connection`: **20 → 2** (connection.ts itself + sitemap)
- Imports `@/lib/auth/sqlite-auth`: **6 → 1** (test utils apenas)
- Chamadas `getDatabase()`: **13 → 6** (adapter.ts itself + AI + workflows + email sender)

---

## Verificação Final (após Sprint 1-8 + Migração)

- **TypeScript (`tsc --noEmit`)**: 0 erros
- **Build (`npm run build`)**: Sucesso completo (warnings ESLint apenas)
- **PostgreSQL schema**: 117 tabelas, 58 triggers, 361 indexes, 67 CHECK constraints
- **Segurança**: CSP sem unsafe-eval, rate limit protegido, Redis com senha, portal com tenant isolation
- **Migração**: 52 arquivos migrados de SQLite direto para adapter pattern
- **N+1 queries**: Eliminados em 4 módulos ITIL (problems, changes, cmdb, cab)
- **Logging**: 56 console.log/error/warn → logger em app/api/
- **TODOS os 8 Sprints + Migração CONCLUÍDOS**

---

## Trabalho Remanescente (não-bloqueante)

- **Gamification**: Tabelas e queries não implementadas (API retorna mock com `_mock: true`)
- **Dependências duplicadas**: bcrypt/bcryptjs, redis/ioredis, better-sqlite3/sqlite3 — ambas ativamente usadas
- **ESLint strict mode**: `ignoreDuringBuilds: true` — 599 warnings impedem ativação
- **99 TODOs de business logic**: ticket-service.ts (51), user-service.ts (12), workflow (6), compliance (7), security (11), misc (12)
- **Monolithic queries.ts**: Ainda existe com 60+ exports — 5 API routes ainda importam

---

## Referências

- **Relatório consolidado**: `reports/QA-CONSOLIDATED-REPORT.md` (plano completo com 271 issues)
- **Relatório arquitetura**: `reports/qa-architecture-review.md`
- **Relatório banco de dados**: `reports/qa-database-review.md`
- **Relatório backend**: `reports/qa-backend-review.md`
- **Relatório frontend**: `reports/qa-frontend-review.md`
- **Relatório segurança**: `reports/qa-security-review.md`
- **Roadmap VPS**: `docs/VPS_POSTGRES_ROBUST_ROADMAP.md`

---

*Sprints 1-8 + Migração concluídos. Próximo passo: VPS deployment com PostgreSQL (ver `docs/VPS_POSTGRES_ROBUST_ROADMAP.md`)*
