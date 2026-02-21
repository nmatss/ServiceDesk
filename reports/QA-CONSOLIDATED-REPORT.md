# ServiceDesk - Relatório Consolidado de QA
## Revisão Completa do Sistema

**Data:** 2026-02-21
**Equipe:** 5 agentes especializados (Arquitetura, Banco de Dados, Backend, Frontend/UX/UI, Segurança/DevOps)
**Escopo:** Revisão completa end-to-end do sistema ServiceDesk

---

## Resumo Executivo

O ServiceDesk é uma aplicação Next.js 15 multi-tenant, ITIL-compliant, com suporte dual-database (SQLite/PostgreSQL). A revisão identificou **271 problemas** distribuídos em 5 áreas:

| Área | CRITICAL | HIGH | MEDIUM | LOW | Total |
|------|----------|------|--------|-----|-------|
| Arquitetura | 4 | 8 | 9 | 6 | **27** |
| Banco de Dados | 18 | 24 | 19 | 12 | **73** |
| Backend/API | 8 | 14 | 12 | 9 | **43** |
| Frontend/UX/UI | 18 | 27 | 31 | 19 | **95** |
| Segurança/DevOps | 4 | 8 | 12 | 9 | **33** |
| **TOTAL** | **52** | **81** | **83** | **55** | **271** |

### Score por Área

| Área | Score | Status |
|------|-------|--------|
| Arquitetura | 6/10 | Precisa melhorias |
| Banco de Dados | 5/10 | Precisa melhorias significativas |
| Backend/API | 6/10 | Precisa melhorias |
| Frontend/UX/UI | 6.5/10 | Precisa melhorias |
| Segurança | 68/100 | Precisa melhorias |
| **Média Geral** | **~6/10** | **Não pronto para produção** |

### Pontos Fortes do Sistema
1. JWT com tokens curtos (15min) + validação de issuer/audience
2. CSRF protection com HMAC-SHA256
3. Rate limiting em todas as rotas sensíveis
4. Multi-tenant isolation via JWT (não via headers)
5. Docker security (non-root, read-only fs, capabilities dropped)
6. Audit logging abrangente
7. Design system com glass-panel, tokens de cor, dark mode base
8. Code splitting e lazy loading implementados

### Top 10 Problemas Mais Críticos (cross-area)

| # | Problema | Área | Impacto |
|---|---------|------|---------|
| 1 | **Code Injection via `new Function()` e `eval()`** em 3 arquivos | Segurança | RCE - Execução remota de código |
| 2 | **PostgreSQL schema ~40% incompleto** vs SQLite (triggers, tabelas) | DB | Sistema quebra no PostgreSQL |
| 3 | **Transaction isolation quebrada** em cmdb/catalog/rbac queries | DB | Corrupção de dados no PostgreSQL |
| 4 | **SQL SQLite-específico** em todos os 5 query modules | DB | Queries falham no PostgreSQL |
| 5 | **Fail-open no RBAC** - permissão concedida quando JSON parse falha | Backend | Escalação de privilégios |
| 6 | **Fallback `organization_id \|\| 1`** em rotas admin | Backend | Cross-tenant data leakage |
| 7 | **65 vulnerabilidades npm** (3 critical, 54 high) | Segurança | CVEs exploráveis |
| 8 | **Dashboard admin com dados hardcoded** (tickets, métricas, alertas) | Frontend | Informações falsas ao admin |
| 9 | **N+1 queries** em todas as funções de listagem ITIL | DB | Performance degrada linearmente |
| 10 | **5 padrões diferentes de autenticação** entre rotas | Backend | Superfície de ataque ampliada |

---

## Plano de Ação Estruturado

### SPRINT 1: Segurança Crítica (1-2 dias)
> **Objetivo:** Eliminar vulnerabilidades exploráveis

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 1.1 | Remover `new Function()` de `dynamic-permissions.ts` - usar `expr-eval` | CRITICAL | 4h | `lib/auth/dynamic-permissions.ts:421` |
| 1.2 | Remover `eval()` de `batching.ts` - usar Map de funções predefinidas | CRITICAL | 2h | `lib/notifications/batching.ts:113` |
| 1.3 | Remover `eval()` de `ml-pipeline.ts` - usar `mathjs` | CRITICAL | 2h | `lib/analytics/ml-pipeline.ts:253` |
| 1.4 | Corrigir fail-open em `rbac-engine.ts` - retornar `false` no catch | CRITICAL | 5min | `lib/auth/rbac-engine.ts:231-233` |
| 1.5 | Remover fallback `\|\| 1` para organization_id - falhar com 401 | CRITICAL | 30min | `app/api/admin/tickets/route.ts:32`, `admin/users/[id]/route.ts` |
| 1.6 | Aumentar lockout de 1min para 15min | HIGH | 5min | `app/api/auth/login/route.ts:303` |
| 1.7 | Corrigir SQL injection em módulos LGPD - usar parameterized queries | HIGH | 1h | `lib/lgpd/data-portability.ts:299`, `consent-manager.ts:305` |
| 1.8 | Executar `npm audit fix` | HIGH | 1h | `package.json` |

**Resultado esperado:** 0 vulnerabilidades RCE, 0 fail-open, 0 SQL injection

---

### SPRINT 2: Estabilidade do Banco de Dados (3-5 dias)
> **Objetivo:** Corrigir problemas que causam corrupção de dados ou queries quebradas

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 2.1 | Corrigir transaction isolation em `cmdb-queries.ts` - usar `db.run()` | CRITICAL | 2h | `lib/db/queries/cmdb-queries.ts` (4 funções) |
| 2.2 | Corrigir transaction isolation em `catalog-queries.ts` | CRITICAL | 1h | `lib/db/queries/catalog-queries.ts` (2 funções) |
| 2.3 | Corrigir transaction isolation em `rbac.ts` | CRITICAL | 1h | `lib/auth/rbac.ts:240-251, 334-351` |
| 2.4 | Corrigir status keys em `getProblemStatistics()` | CRITICAL | 30min | `lib/db/queries/problem-queries.ts:~900` |
| 2.5 | Corrigir column names em `cab-queries.ts` (`actual_start` vs `actual_start_time`) | CRITICAL | 1h | `lib/db/queries/cab-queries.ts` |
| 2.6 | Corrigir `createCABMeeting()` - adicionar `title` e `scheduled_date` | CRITICAL | 30min | `lib/db/queries/cab-queries.ts` |
| 2.7 | Corrigir `getProblemIncidents()` - remover `ticket_number` | CRITICAL | 15min | `lib/db/queries/problem-queries.ts` |
| 2.8 | Substituir SQL SQLite-específico por SQL compatível em todos os query modules: | CRITICAL | 4h | Todos os 5 query modules |
| | - `julianday()` → `EXTRACT(EPOCH FROM ...)` / adapter-aware | | | |
| | - `date('now', ...)` → `CURRENT_DATE` / adapter-aware | | | |
| | - `DATETIME()` → `CURRENT_TIMESTAMP` / adapter-aware | | | |
| | - `strftime()` → funções PostgreSQL equivalentes | | | |
| 2.9 | Corrigir placeholder conversion no adapter (`?` dentro de strings) | CRITICAL | 2h | `lib/db/adapter.ts:~230` |
| 2.10 | Corrigir SSL `rejectUnauthorized: false` no PostgreSQL | CRITICAL | 30min | `lib/db/connection.postgres.ts:48-49` |
| 2.11 | Alinhar CHECK constraints entre SQLite e PostgreSQL | HIGH | 2h | `schema.sql`, `schema.postgres.sql` |
| 2.12 | Alinhar TypeScript types com schemas reais | HIGH | 4h | `lib/types/database.ts`, `lib/types/problem.ts` |
| 2.13 | Adicionar guards para empty arrays em IN clauses | HIGH | 2h | Todos os query modules |

**Resultado esperado:** 0 transaction isolation bugs, SQL compatível com ambos DBs, types alinhados

---

### SPRINT 3: Consistência do Backend (3-5 dias)
> **Objetivo:** Padronizar autenticação, tenant isolation, e formato de API

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 3.1 | Padronizar autenticação - criar guard unificado baseado em `requireTenantUserContext()` | HIGH | 8h | Todas as ~100 rotas API |
| 3.2 | Padronizar coluna tenant (`organization_id` everywhere) - eliminar try/catch dualismo | HIGH | 4h | ~30 rotas com try/catch |
| 3.3 | Padronizar formato de resposta API → `{ success, data, meta: { page, limit, total, totalPages } }` | HIGH | 4h | Todas as rotas de listagem |
| 3.4 | Padronizar admin roles → constante centralizada exportada de `lib/auth/roles.ts` | HIGH | 2h | ~15 rotas admin |
| 3.5 | Adicionar validação Zod nas rotas de tickets (title max 500, description max 10000) | HIGH | 2h | `app/api/tickets/route.ts`, `tickets/[id]/route.ts` |
| 3.6 | Gerar refresh token no login (paridade com registro) | HIGH | 2h | `app/api/auth/login/route.ts:397-404` |
| 3.7 | Migrar `admin/users/[id]` de queries síncronos para adapter | HIGH | 2h | `app/api/admin/users/[id]/route.ts` |
| 3.8 | Granularizar `/api/auth` em PUBLIC_ROUTES do middleware | MEDIUM | 1h | `middleware.ts:139` |
| 3.9 | Remover rate limiting duplo (escolher redis-limiter OU in-memory) | MEDIUM | 2h | ~10 rotas |
| 3.10 | Adicionar sanitização de input XSS em tickets (title, description) | HIGH | 1h | `app/api/tickets/route.ts` |

**Resultado esperado:** 1 padrão de auth, 1 formato de resposta, tenant isolation consistente

---

### SPRINT 4: Frontend Critical Fixes (3-5 dias)
> **Objetivo:** Remover dados falsos, padronizar layouts, corrigir funcionalidades quebradas

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 4.1 | Substituir dados hardcoded do dashboard admin por chamadas API reais | CRITICAL | 4h | `app/admin/page.tsx:187-273` |
| 4.2 | Padronizar layout de Changes e CMDB para usar container do AppLayout | CRITICAL | 2h | `app/admin/changes/page.tsx:149`, `cmdb/new/page.tsx:225` |
| 4.3 | Remover dados hardcoded nas tabs de Incidents e Changes no detalhe do problema | CRITICAL | 2h | `app/admin/problems/[id]/page.tsx:428,460` |
| 4.4 | Substituir `alert()` por toast no form de novo problema | CRITICAL | 15min | `app/admin/problems/new/page.tsx:86` |
| 4.5 | Implementar onClick handlers nos botões vazios (Editar, KEDB, RFC, Vincular) | HIGH | 4h | `app/admin/problems/[id]/page.tsx:534-563` |
| 4.6 | Corrigir filtros de status no Problems page (`new` → `open`) | HIGH | 30min | `app/admin/problems/page.tsx:264-271` |
| 4.7 | Corrigir `aria-hidden` da sidebar em desktop colapsado | CRITICAL | 30min | `src/components/layout/Sidebar.tsx:529` |
| 4.8 | Adicionar dark mode support na página de Changes | HIGH | 2h | `app/admin/changes/page.tsx` |
| 4.9 | Unificar sistema de toast (escolher react-hot-toast OU customToast) | HIGH | 2h | Múltiplos arquivos |
| 4.10 | Corrigir links quebrados na sidebar | HIGH | 1h | `src/components/layout/Sidebar.tsx` |

**Resultado esperado:** Dashboard com dados reais, layouts consistentes, funcionalidades implementadas

---

### SPRINT 5: PostgreSQL Parity (1-2 semanas)
> **Objetivo:** Trazer schema PostgreSQL a paridade com SQLite

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 5.1 | Adicionar tabelas faltantes ao PostgreSQL (gamification, email, custom fields, macros, push, approvals) | CRITICAL | 8h | `lib/db/schema.postgres.sql` |
| 5.2 | Criar função `update_updated_at()` + triggers para todas as tabelas | HIGH | 4h | `lib/db/schema.postgres.sql` |
| 5.3 | Criar trigger de SLA tracking para PostgreSQL (equivalente ao SQLite) | HIGH | 4h | `lib/db/schema.postgres.sql` |
| 5.4 | Adicionar `organization_id` em tabelas PostgreSQL que faltam (sla_policies, ticket_templates, satisfaction_surveys) | HIGH | 2h | `lib/db/schema.postgres.sql` |
| 5.5 | Alinhar colunas divergentes entre schemas (~20 tabelas) | HIGH | 8h | Ambos schemas |
| 5.6 | Adicionar CHECK constraints faltantes no PostgreSQL | HIGH | 2h | `lib/db/schema.postgres.sql` |
| 5.7 | Adicionar indexes compostos para queries ITIL frequentes | MEDIUM | 2h | `lib/db/schema.postgres.sql` |
| 5.8 | Corrigir N+1 queries com JOINs nas funções de listagem | CRITICAL | 8h | Todos os 5 query modules |
| 5.9 | Adicionar demo users ao seed PostgreSQL | LOW | 1h | `lib/db/seed.postgres.sql` |
| 5.10 | Criar script de comparação automática SQLite vs PostgreSQL | MEDIUM | 4h | `scripts/` |

**Resultado esperado:** PostgreSQL com paridade total, sem N+1, indexes otimizados

---

### SPRINT 6: Qualidade do Código e Organização (1-2 semanas)
> **Objetivo:** Limpar tech debt, consolidar estrutura

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 6.1 | Consolidar componentes em um único diretório (eliminar src/components vs components) | HIGH | 4h | `components/`, `src/components/` |
| 6.2 | Corrigir Dockerfile para usar custom server (Socket.io) | CRITICAL | 2h | `Dockerfile` |
| 6.3 | Habilitar ESLint durante build (`ignoreDuringBuilds: false`) | CRITICAL | 2h | `next.config.js:20-21` |
| 6.4 | Resolver tsconfig excludes (remover `src/**`, corrigir erros TypeScript) | HIGH | 8h | `tsconfig.json:58-89`, arquivos excluídos |
| 6.5 | Limpar dependências duplicadas (bcrypt/bcryptjs, redis/ioredis, etc.) | HIGH | 2h | `package.json` |
| 6.6 | Mover 319 .md do root para `docs/` organizado | HIGH | 1h | Root directory |
| 6.7 | Mover `@types/*` para devDependencies | MEDIUM | 15min | `package.json` |
| 6.8 | Corrigir `outputFileTracingRoot` hardcoded | HIGH | 5min | `next.config.js:7` |
| 6.9 | Corrigir `"start": "node server.ts"` → `"tsx server.ts"` | MEDIUM | 5min | `package.json:9` |
| 6.10 | Remover código morto (ETag no middleware, viewport.ts duplicado) | LOW | 30min | `middleware.ts`, `app/viewport.ts` |

**Resultado esperado:** Codebase organizado, build funcional, 0 excludes no tsconfig

---

### SPRINT 7: UX/UI Polish (1-2 semanas)
> **Objetivo:** Melhorar experiência do usuário, acessibilidade, consistência visual

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 7.1 | Criar componente `FormField` padronizado (label + input + error) e usar em todas as páginas | HIGH | 4h | `components/ui/`, páginas de form |
| 7.2 | Extrair `formatDate`, `statusConfig`, `resolveRequestContext` para utilitários compartilhados | HIGH | 2h | `lib/utils/` |
| 7.3 | Implementar WAI-ARIA tabs pattern (role=tablist/tab/tabpanel) | MEDIUM | 2h | `problems/[id]/page.tsx:258-275` |
| 7.4 | Tornar cards clicáveis acessíveis (`<button>` ou `<a>` em vez de `<div onClick>`) | MEDIUM | 2h | Múltiplas páginas |
| 7.5 | Adicionar `aria-describedby` para mensagens de erro em formulários | HIGH | 2h | Páginas de form |
| 7.6 | Adicionar debounce nos campos de busca | MEDIUM | 1h | Páginas com search |
| 7.7 | Padronizar `glass-panel` com variantes (`glass-panel-sm`, `glass-panel-md`, `glass-panel-lg`) | MEDIUM | 1h | `globals.css` |
| 7.8 | Implementar ErrorBoundary wrapping nas páginas críticas | MEDIUM | 2h | Páginas admin |
| 7.9 | Criar context de auth compartilhado para evitar re-fetches | MEDIUM | 4h | `src/components/layout/` |
| 7.10 | Corrigir copyright para 2026 | LOW | 5min | `AppLayout.tsx:178` |

**Resultado esperado:** UX consistente, acessibilidade melhorada, componentes reutilizáveis

---

### SPRINT 8: DevOps e Hardening (1 semana)
> **Objetivo:** Preparar para produção

| # | Tarefa | Severidade | Esforço | Arquivos |
|---|--------|-----------|---------|----------|
| 8.1 | Completar CSP headers (adicionar default-src, script-src, connect-src) | MEDIUM | 4h | `next.config.js`, `lib/security/helmet.ts` |
| 8.2 | Remover `unsafe-eval`/`unsafe-inline` do CSP em produção | HIGH | 4h | `lib/security/helmet.ts:43-48` |
| 8.3 | Configurar Nginx com TLS/SSL | HIGH | 4h | `nginx/conf.d/default.conf` |
| 8.4 | Adicionar `client_max_body_size` e rate limiting ao Nginx | MEDIUM | 1h | `nginx/conf.d/default.conf` |
| 8.5 | Corrigir validação de upload de arquivo (magic bytes, não apenas MIME) | MEDIUM | 4h | `lib/utils/file-upload.ts` |
| 8.6 | Resolver conflito de CSP duplicado (headers.ts vs helmet.ts) | MEDIUM | 1h | `lib/security/headers.ts`, `helmet.ts` |
| 8.7 | Lazy init SQLite (não criar .db quando DB_TYPE=postgresql) | MEDIUM | 2h | `lib/db/connection.ts`, `adapter.ts` |
| 8.8 | Adicionar seed data ao docker-compose.dev.yml | MEDIUM | 5min | `docker-compose.dev.yml:19` |
| 8.9 | Remover `dangerouslyAllowSVG: true` ou implementar sanitização | CRITICAL | 30min | `next.config.js:31` |
| 8.10 | Auditar .env no git history e rotacionar segredos se necessário | CRITICAL | 2h | Git history |

**Resultado esperado:** Pronto para deploy em produção com segurança adequada

---

## Quick Wins (< 15 minutos cada)

Estas correções podem ser aplicadas imediatamente:

| # | Ação | Impacto | Tempo |
|---|------|---------|-------|
| 1 | Alterar `LOCKOUT_DURATION_MINUTES = 1` → `15` | Segurança | 1 min |
| 2 | Alterar `return true` → `return false` no catch de `rbac-engine.ts:231` | Segurança | 1 min |
| 3 | Remover `dangerouslyAllowSVG: true` | Segurança | 1 min |
| 4 | Mover `@types/*` para devDependencies | Build | 5 min |
| 5 | Corrigir `outputFileTracingRoot` hardcoded | Portabilidade | 2 min |
| 6 | Corrigir `"start": "node server.ts"` → `"tsx server.ts"` | Funcionalidade | 1 min |
| 7 | Adicionar `client_max_body_size 10M` ao Nginx | Segurança | 1 min |
| 8 | Adicionar seed ao docker-compose.dev.yml | DX | 2 min |
| 9 | Substituir `alert()` por `toast.error()` em `problems/new/page.tsx` | UX | 2 min |
| 10 | Corrigir copyright para 2026 | Visual | 1 min |

---

## Matriz de Prioridade vs Esforço

```
                    IMPACTO ALTO                IMPACTO BAIXO
                ┌───────────────────────┬───────────────────────┐
   ESFORÇO      │  SPRINT 1: Segurança  │  Quick Wins           │
   BAIXO        │  Sprint 2.4-2.7       │  Sprint 6.7-6.10      │
   (< 1 dia)   │  Sprint 4.4, 4.6      │  Sprint 7.10          │
                ├───────────────────────┼───────────────────────┤
   ESFORÇO      │  SPRINT 2: DB Fixes   │  Sprint 7: UX Polish  │
   MÉDIO        │  SPRINT 3: Backend    │  Sprint 6.6           │
   (1-5 dias)   │  SPRINT 4: Frontend   │                       │
                ├───────────────────────┼───────────────────────┤
   ESFORÇO      │  SPRINT 5: PG Parity  │  Sprint 7.9           │
   ALTO         │  Sprint 6.4           │  Sprint 8.1-8.2       │
   (> 5 dias)   │  Sprint 8.3           │                       │
                └───────────────────────┴───────────────────────┘
```

---

## Dependências entre Sprints

```
Sprint 1 (Segurança) ─────────────────────────────────┐
    │                                                  │
    ▼                                                  ▼
Sprint 2 (DB) ──────► Sprint 5 (PG Parity)    Sprint 8 (DevOps)
    │                       │
    ▼                       │
Sprint 3 (Backend) ─────────┤
    │                       │
    ▼                       ▼
Sprint 4 (Frontend) ──► Sprint 7 (UX Polish)
    │
    ▼
Sprint 6 (Organização)
```

- **Sprint 1** é pré-requisito de tudo (segurança crítica)
- **Sprint 2** deve vir antes de Sprint 3 e 5 (DB precisa estar correto para backend/PG)
- **Sprint 3** deve vir antes de Sprint 4 (formato de API afeta frontend)
- **Sprint 5** pode rodar em paralelo com Sprints 4, 6, 7
- **Sprint 6** é independente (organização)
- **Sprint 8** pode rodar em paralelo com Sprints 5, 6, 7

---

## Estimativa Total

| Sprint | Duração Estimada | Complexidade |
|--------|-----------------|--------------|
| Sprint 1: Segurança Crítica | 1-2 dias | Média |
| Sprint 2: Estabilidade DB | 3-5 dias | Alta |
| Sprint 3: Consistência Backend | 3-5 dias | Alta |
| Sprint 4: Frontend Critical | 3-5 dias | Média |
| Sprint 5: PostgreSQL Parity | 1-2 semanas | Alta |
| Sprint 6: Organização | 1-2 semanas | Média |
| Sprint 7: UX/UI Polish | 1-2 semanas | Média |
| Sprint 8: DevOps/Hardening | 1 semana | Média |
| **Total** | **~6-8 semanas** | |

---

## Relatórios Detalhados

Os relatórios completos de cada área estão disponíveis em:

1. **Arquitetura:** `reports/qa-architecture-review.md` (27 issues)
2. **Banco de Dados:** `reports/qa-database-review.md` (73 issues)
3. **Backend/API:** `reports/qa-backend-review.md` (43 issues)
4. **Frontend/UX/UI:** `reports/qa-frontend-review.md` (95 issues)
5. **Segurança/DevOps:** `reports/qa-security-review.md` (33 issues)

---

*Relatório consolidado gerado em 2026-02-21 por equipe de 5 agentes QA especializados*
