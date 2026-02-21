# QA Architecture Review - ServiceDesk Project

**Data**: 2026-02-21
**Revisor**: Architecture QA Agent
**Escopo**: Revisao completa de arquitetura, configuracao, estrutura e padroes

---

## 1. Resumo Executivo

O projeto ServiceDesk e uma aplicacao Next.js 15 com TypeScript, multi-tenant, ITIL-compliant, com suporte dual-database (SQLite/PostgreSQL). A arquitetura geral e solida e bem organizada, mas apresenta **problemas significativos** que precisam de atencao antes de ir para producao. Os principais riscos sao: fragmentacao de componentes em multiplos diretorios, acumulo massivo de documentacao nao-gerenciada no root (319 arquivos .md), schema PostgreSQL incompleto (1320 linhas a menos que SQLite), ESLint ignorado durante build, e um Dockerfile que copia artefatos SQLite em vez do custom server.

### Metricas de Saude

| Metrica | Valor | Status |
|---------|-------|--------|
| Arquivos .md no root | 319 (~5.9 MB) | CRITICAL |
| Linhas schema SQLite | 3,396 | OK |
| Linhas schema PostgreSQL | 2,076 | HIGH (38% menor) |
| API routes usando adapter | 121 | OK |
| API routes legado (connection.ts) | 1 | OK |
| Subdiretorios em lib/ | 49 | HIGH (muito granular) |
| Locais de componentes | 3 (components/, src/components/, app/) | HIGH |
| Dependencias production | ~80 | HIGH (muitas) |
| @types em dependencies (nao devDeps) | 10+ | MEDIUM |

---

## 2. Problemas Encontrados

### 2.1 CRITICAL

#### C1. `.env` commitado no repositorio (staged/tracked)

**Arquivo**: `.env` (12 KB)
**Evidencia**: `git status` mostra `.env` como Modified (M), e `ls -la` confirma `.env` de 12,097 bytes no root.

A `.gitignore` tem regras para `.env*` mas a lista indica `.env.example` como staged (`M .env.example`). Porem o `.env` de 12KB existe no disco e o `.gitignore` tem `.env*` na linha 111 precedido por `.env*.local` na linha 29. O arquivo `.env` ja pode ter sido adicionado ao historico do git ANTES da regra ser adicionada ao `.gitignore`.

**Risco**: Exposicao de segredos (JWT_SECRET, DATABASE_URL, passwords) no historico do git.
**Acao**: Verificar com `git log --all --full-history -- .env` se o arquivo ja foi commitado. Se sim, reescrever o historico com `git filter-branch` ou BFG Repo Cleaner e rotacionar TODOS os segredos.

---

#### C2. Dockerfile produção usa `server.js` mas o projeto usa `server.ts`

**Arquivo**: `Dockerfile:124`
```dockerfile
CMD ["node", "server.js"]
```

**Arquivo**: `server.ts` (TypeScript)

O Dockerfile copia a saida standalone do Next.js (`.next/standalone/`) que gera um `server.js` padrao do Next.js. Porem, o projeto usa um custom server (`server.ts`) que inclui Socket.io e compression middleware. A build standalone NAO inclui o custom server -- o `server.js` gerado e o servidor basico do Next.js.

**Impacto**: Em producao via Docker:
- Socket.io (real-time notifications) NAO funciona
- Compression middleware NAO funciona
- O `initializeRealtimeEngine` NAO e chamado

**Acao**: Compilar `server.ts` com `tsc` ou `esbuild` e copiar o resultado para o container, ou incluir o `tsx` runtime no container e executar `server.ts` diretamente.

---

#### C3. ESLint ignorado durante build

**Arquivo**: `next.config.js:20-21`
```javascript
eslint: {
    ignoreDuringBuilds: true,
},
```

Com ESLint ignorado, erros de lint nao bloqueiam o build. Isso permite que codigo com problemas potenciais (unused imports, react-hooks violations, etc.) chegue a producao sem deteccao.

**Impacto**: Regressoes de qualidade passam despercebidas. `react-hooks/rules-of-hooks` e um rule `error` na config, mas nunca sera executado durante build.
**Acao**: Mudar para `ignoreDuringBuilds: false` ou ao menos adicionar `npm run lint` ao CI pipeline antes do build.

---

#### C4. `dangerouslyAllowSVG: true` sem sanitizacao

**Arquivo**: `next.config.js:31`
```javascript
dangerouslyAllowSVG: true,
```

Permite carregar SVGs via `next/image` o que pode expor a XSS se SVGs de usuario forem servidos. A CSP para images (`contentSecurityPolicy`) esta configurada mas so se aplica ao contexto do `<img>`, nao protege contra SVG inline injection.

**Impacto**: Se usuarios puderem fazer upload de SVGs que sao servidos via `next/image`, e possivel injetar JavaScript malicioso.
**Acao**: Remover `dangerouslyAllowSVG: true` ou garantir que SVGs de upload sao sanitizados (DOMPurify ja esta nas dependencias).

---

### 2.2 HIGH

#### H1. Schema PostgreSQL incompleto vs SQLite

**Arquivos**: `lib/db/schema.sql` (3,396 linhas) vs `lib/db/schema.postgres.sql` (2,076 linhas)

O schema PostgreSQL tem 1,320 linhas a MENOS que o SQLite. Isso indica que tabelas, indexes, triggers ou constraints estao faltando no PostgreSQL. Quando a migracao para PostgreSQL acontecer, havera tabelas/funcionalidades ausentes.

**Impacto**: Migracao para PostgreSQL quebrara funcionalidades que dependem de tabelas/indexes nao criados.
**Acao**: Fazer diff sistematico entre os dois schemas, identificar todas as tabelas/indexes/triggers faltantes e adicionar ao `schema.postgres.sql`.

---

#### H2. Fragmentacao de componentes em 3 locais

O projeto tem componentes espalhados em 3 diretorios distintos:

| Diretorio | Conteudo |
|-----------|----------|
| `components/` | ContactCard, LazyComponents, OptimizedImage, SafeHTML, WebVitalsReporter, ui/ |
| `src/components/` | Layout (AppLayout, Header, Sidebar), admin/, auth/, charts/, dashboard/, knowledge/, mobile/, notifications/, etc. (~24 subdirs) |
| `app/` (colocated) | Componentes inline nos pages |

**Adicionalmente**, `src/` contem tambem:
- `src/hooks/` (6 hooks)
- `src/lib/` (audit.ts, csrf.ts, rate-limit.ts, security.ts)
- `src/app/onboarding/`

O `app/layout.tsx` importa de AMBOS:
```typescript
import AppLayout from '@/src/components/layout/AppLayout'  // src/
import WebVitalsReporter from '@/components/WebVitalsReporter'  // components/
```

**Impacto**: Confusao sobre onde colocar novos componentes, imports inconsistentes, dificuldade de manutencao.
**Acao**: Consolidar tudo em um unico diretorio (`components/` ou `src/components/`), nunca ambos.

---

#### H3. 319 arquivos markdown no root (5.9 MB)

O root do projeto contem 319 arquivos `.md` totalizando ~5.9 MB. Incluem relatorios de agentes (AGENT_1 a AGENT_41), guias de implementacao, relatorios de sprint, auditorias de seguranca, etc.

**Exemplos redundantes**:
- 7 arquivos ACCESSIBILITY_*.md
- 6 arquivos SECURITY_*.md
- 5 arquivos PERFORMANCE_*.md
- 4 arquivos AGENT_3_*.md
- Multiplos SPRINT*_SUMMARY.md

**Impacto**: Poluicao visual, `ls` do root e ilegivel, aumenta tamanho do repo desnecessariamente, confunde novos desenvolvedores.
**Acao**: Mover todos para `docs/` organizado por categoria (ex: `docs/reports/`, `docs/guides/`, `docs/architecture/`). Manter apenas README.md, CLAUDE.md, e CONTRIBUTING.md no root.

---

#### H4. Dependencias excessivas e @types em production

**Arquivo**: `package.json:108-193` (dependencies)

**Problemas**:
1. **@types pacotes em dependencies em vez de devDependencies**: `@types/bcryptjs`, `@types/better-sqlite3`, `@types/bull`, `@types/d3`, `@types/html2canvas`, `@types/jsonwebtoken`, `@types/qrcode`, `@types/react-grid-layout`, `@types/redis`, `@types/speakeasy`, `@types/uuid`
2. **Pacotes duplicados de mesma funcionalidade**:
   - `bcrypt` E `bcryptjs` (escolher um)
   - `sqlite` E `sqlite3` E `better-sqlite3` (3 drivers SQLite!)
   - `redis` E `ioredis` (2 drivers Redis)
   - `jsonwebtoken` E `jose` (2 libs JWT)
   - `dompurify` E `isomorphic-dompurify`
   - `winston` E `pino` + `pino-pretty` (2 loggers)
3. **Pacotes pesados potencialmente nao usados em runtime**: `d3`, `reactflow`, `dd-trace` (Datadog), `bull` (job queue sem Redis obrigatorio)

**Impacto**: Bundle size inflado, tempo de install mais lento, riscos de seguranca com dependencias duplicadas, confusao sobre qual lib usar.
**Acao**:
- Mover todos os `@types/*` para `devDependencies`
- Escolher entre `bcrypt` vs `bcryptjs`, `ioredis` vs `redis`, `jose` vs `jsonwebtoken`, `pino` vs `winston`
- Remover `sqlite` e `sqlite3` (projeto usa `better-sqlite3`)
- Avaliar necessidade de `d3`, `dd-trace`, `bull`

---

#### H5. tsconfig.json exclui multiplos arquivos/dirs de forma excessiva

**Arquivo**: `tsconfig.json:58-89` (exclude)

```json
"exclude": [
    "node_modules", ".next", "dist", "build",
    "tests", "examples", "scripts",
    "src/**",           // <-- DANGER
    "**/__tests__/**",
    "sentry.client.config.ts",
    "sentry.server.config.ts",
    "sentry.edge.config.ts",
    "lib/monitoring/traces/**",
    "lib/monitoring/datadog-usage-examples.ts",
    "lib/ai/database-integration.ts",
    "lib/config/secrets.ts",
    "lib/dashboard/template-engine.ts",
    "lib/charts/**",
    "lib/integrations/email-automation.ts",
    "lib/knowledge/elasticsearch-integration.ts",
    "lib/knowledge/auto-generator.ts",
    "lib/knowledge/semantic-search.ts",
    "lib/notifications/channels.ts",
    "lib/performance/code-splitting.tsx",
    "lib/knowledge",        // <-- exclui pasta inteira
    "lib/notifications/channels.ts"  // <-- duplicado
]
```

**Problemas especificos**:
1. `"src/**"` -- exclui TODO o diretorio `src/`, mas o projeto TEM componentes criticos em `src/components/layout/AppLayout.tsx` que sao importados em `app/layout.tsx`. O TypeScript NAO verifica esses arquivos, bugs nesses componentes nao serao detectados por `tsc --noEmit`.
2. `"lib/knowledge"` -- exclui a pasta inteira de knowledge, mas ha API routes em `app/api/knowledge/` que importam dessas libs.
3. `"lib/notifications/channels.ts"` aparece duplicado.
4. Varios arquivos de lib sao excluidos individualmente, sugerindo que eles tem erros de tipo que nunca foram resolvidos.

**Impacto**: Type-checking incompleto. Erros em `src/`, `lib/knowledge/`, e outros arquivos excluidos nao sao detectados.
**Acao**: Corrigir os erros de TypeScript nesses arquivos em vez de exclui-los. Remover `"src/**"` do exclude.

---

#### H6. `outputFileTracingRoot` hardcoded com caminho local

**Arquivo**: `next.config.js:7`
```javascript
outputFileTracingRoot: "/home/nic20/ProjetosWeb/ServiceDesk",
```

Este caminho esta hardcoded para o ambiente de desenvolvimento do usuario `nic20`. Em CI/CD ou no computador de outro desenvolvedor, esse caminho nao existira.

**Impacto**: Builds em ambientes diferentes podem ter problemas de trace de arquivos.
**Acao**: Substituir por `path.resolve(__dirname)` ou `process.cwd()`, ou remover se nao necessario.

---

#### H7. Redundancia Docker app + Nginx health check

**Arquivos**: `docker-compose.yml:133`, `nginx/conf.d/default.conf:19-25`

O container `app` faz health check via:
```yaml
test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
```

Mas o Nginx tambem faz:
```yaml
test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
```

Nginx proxy /health para /api/health/live (note: endpoint diferente `/api/health` vs `/api/health/live`). Se `/api/health` e `/api/health/live` retornam coisas diferentes, pode haver inconsistencia nos health checks.

**Acao**: Padronizar o endpoint de health check. Usar `/api/health/live` para liveness e `/api/health/ready` para readiness.

---

#### H8. lib/ com 49 subdiretorios -- granularidade excessiva

O diretorio `lib/` tem 49 subdiretorios. Muitos tem apenas 1-2 arquivos:

```
lib/a11y/         lib/audit/        lib/backup/       lib/charts/
lib/compliance/   lib/design-system/ lib/di/           lib/errors/
lib/gamification/ lib/interfaces/   lib/lgpd/         lib/pwa/
lib/reports/      lib/search/       lib/seo/          lib/sla/
lib/templates/    lib/ui/           lib/utils/
```

Alem disso, ha duplicacao de responsabilidades com `src/lib/` (que contem `audit.ts`, `csrf.ts`, `rate-limit.ts`, `security.ts`).

**Impacto**: Dificuldade de navegacao, imports longos, carga cognitiva alta para novos desenvolvedores.
**Acao**: Consolidar modulos pequenos em agrupamentos maiores (ex: `lib/shared/`, `lib/infrastructure/`). Eliminar `src/lib/` ou mover conteudo para `lib/`.

---

### 2.3 MEDIUM

#### M1. `server.ts` usa `req.url!` com non-null assertion

**Arquivo**: `server.ts:49`
```typescript
const parsedUrl = parse(req.url!, true)
```

Se `req.url` for `undefined` (improvavel mas possivel com requests malformadas), isso causara crash.
**Acao**: Adicionar fallback: `parse(req.url || '/', true)`.

---

#### M2. Socket.io CORS hardcoded

**Arquivo**: `server.ts:62`
```typescript
origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
```

Usa uma unica origin. Em ambientes com multiplos dominios ou subdomains (multi-tenant), isso bloqueara websocket connections de outros tenants.
**Acao**: Aceitar array de origins ou usar callback function para validar origins dinamicamente baseado nos tenants registrados.

---

#### M3. Middleware ETag para static assets e redundante

**Arquivo**: `middleware.ts:388-407`

O middleware gera ETags para rotas `/_next/static/` usando um hash do pathname. Porem:
1. O matcher do middleware ja exclui `_next/static` e `_next/image` (`/((?!_next/static|_next/image|favicon.ico).*)`), entao esse codigo NUNCA sera executado.
2. Next.js ja gerencia ETags para static assets automaticamente.

**Impacto**: Codigo morto no middleware.
**Acao**: Remover o bloco de ETag do middleware.

---

#### M4. `connection.ts` cria SQLite database mesmo quando usando PostgreSQL

**Arquivo**: `lib/db/connection.ts:6-14`

```typescript
const dbPath = path.join(process.cwd(), 'data', 'servicedesk.db');
import { mkdirSync } from 'fs';
try {
  mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (error) {}

const legacyDb = new Database(dbPath, { ... });
```

Este codigo roda no import-time (side effect). O `adapter.ts` importa `connection.ts` em todas as situacoes:
```typescript
import legacyDb from './connection'; // SQLite connection
```

Mesmo quando `DB_TYPE=postgresql`, o `better-sqlite3` Database e instanciado, o diretorio `data/` e criado, e o arquivo `.db` e aberto/criado. Isso e um efeito colateral desnecessario.

**Impacto**: Em producao com PostgreSQL, um arquivo SQLite vazio e criado. O `better-sqlite3` native module precisa estar instalado mesmo que nao seja usado.
**Acao**: Usar lazy initialization -- importar `connection.ts` condicionalmente apenas quando `getDatabaseType() === 'sqlite'`.

---

#### M5. CSP header incompleta

**Arquivo**: `next.config.js:50-51`
```javascript
value: "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://r2cdn.perplexity.ai data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
```

A CSP so define `font-src` e `style-src`. Faltam diretivas essenciais:
- `default-src` -- fallback para todas as diretivas nao especificadas
- `script-src` -- sem essa diretiva, qualquer script externo pode ser carregado
- `img-src` -- sem restricao de imagens
- `connect-src` -- sem restricao de XHR/fetch/WebSocket
- `frame-ancestors` -- embora X-Frame-Options esteja definido, CSP frame-ancestors e mais robusto

**Impacto**: A CSP e efetivamente inutil sem `default-src` ou `script-src`.
**Acao**: Definir uma CSP completa com pelo menos `default-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'self'`.

---

#### M6. Docker dev compose sem seed data

**Arquivo**: `docker-compose.dev.yml:19`
```yaml
- ./lib/db/schema.postgres.sql:/docker-entrypoint-initdb.d/001_schema.sql:ro
```

O dev compose so monta o schema, sem seed data. O production compose monta ambos:
```yaml
- ./lib/db/schema.postgres.sql:/docker-entrypoint-initdb.d/001_schema.sql:ro
- ./lib/db/seed.postgres.sql:/docker-entrypoint-initdb.d/002_seed.sql:ro
```

**Impacto**: Desenvolvedores usando Docker Compose em dev terao um banco vazio sem dados de teste.
**Acao**: Adicionar o seed ao dev compose tambem.

---

#### M7. PostgreSQL SSL com `rejectUnauthorized: false`

**Arquivo**: `lib/db/connection.postgres.ts:48-49`
```typescript
ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
```

`rejectUnauthorized: false` desabilita verificacao de certificado SSL, tornando a conexao vulneravel a MITM attacks.
**Acao**: Em producao, usar `{ rejectUnauthorized: true }` com CA certificate configurado, ou pelo menos tornar configuravel via env var.

---

#### M8. Nginx sem rate limiting nem SSL

**Arquivo**: `nginx/conf.d/default.conf`

O Nginx esta configurado para servir em porta 80 (HTTP apenas), sem:
- SSL/TLS termination
- Rate limiting
- Request body size limits
- Timeouts consistentes (so `proxy_read_timeout 300s` na location `/`)

**Acao**: Adicionar configuracao SSL, `limit_req_zone` para rate limiting, e `client_max_body_size`.

---

#### M9. `getDatabase()` no adapter retorna diferentes instancias para `getDatabase()` (adapter) vs `getDatabase()` (connection.ts)

**Arquivos**: `lib/db/adapter.ts:234` e `lib/db/connection.ts:78`

Ambos exportam uma funcao chamada `getDatabase()`:
- `adapter.ts` retorna `DatabaseAdapter`
- `connection.ts` retorna `Database.Database` (raw better-sqlite3)

**Impacto**: Imports errados podem resultar em usar o driver SQLite direto em vez do adapter, quebrando a compatibilidade PostgreSQL.
**Acao**: Renomear `getDatabase()` em `connection.ts` para `getLegacySQLiteDatabase()` ou remover completamente.

---

### 2.4 LOW

#### L1. `eslint-config-next` version mismatch

**Arquivo**: `package.json:217`
```json
"eslint-config-next": "14.0.4",  // Next.js 14
```

O projeto usa Next.js 15 (`"next": "^15.5.4"`) mas o eslint-config-next e da versao 14.
**Acao**: Atualizar para `"eslint-config-next": "^15.0.0"`.

---

#### L2. `connection-pool.ts` referenciado mas nao revisado

**Arquivo**: `lib/db/connection.ts:3`
```typescript
import pool from './connection-pool';
```

O arquivo `connection-pool.ts` e importado mas nao foi possivel confirmar se e usado ativamente ou se esta desatualizado.
**Acao**: Verificar se `connection-pool.ts` e necessario ou se pode ser removido.

---

#### L3. Scripts de migracao e fix misturados no diretorio scripts/

O diretorio `scripts/` contem 60+ arquivos incluindo:
- Scripts de fix one-shot ja aplicados (`fix-api-typescript.js`, `fix-broken-map-calls.js`, `fix-remaining-ts-errors.js`, etc.)
- Scripts em multiplas linguagens (`.ts`, `.js`, `.sh`, `.py`)
- Scripts de benchmark, lighthouse, security, seed misturados

**Acao**: Organizar em subdiretorios (`scripts/migration/`, `scripts/benchmarks/`, `scripts/one-off/`) e remover scripts de fix que ja foram aplicados.

---

#### L4. `.performance-checklist.md` no root

Um arquivo oculto de checklist de performance nao deveria estar no root.
**Acao**: Mover para `docs/`.

---

#### L5. `app/viewport.ts` separado do layout

**Arquivo**: `app/viewport.ts`

O viewport export e separado do `layout.tsx`, mas `layout.tsx` ja exporta `viewport` diretamente (linhas 30-39). O arquivo `viewport.ts` pode estar desatualizado/duplicado.
**Acao**: Verificar se `app/viewport.ts` e importado por algum lugar. Se nao, remover.

---

#### L6. `package.json` start command usa `node server.ts`

**Arquivo**: `package.json:9`
```json
"start": "node server.ts",
```

`node` nao executa `.ts` diretamente (a menos que com `--experimental-strip-types` no Node 22+). O dev script usa `tsx watch server.ts` corretamente, mas o `start` pode falhar dependendo da versao do Node.
**Acao**: Mudar para `tsx server.ts` ou compilar o server antes e usar `node server.js`.

---

## 3. Recomendacoes de Melhoria

### 3.1 Arquitetura

1. **Eliminar duplicacao src/ vs root**: Mover todo conteudo de `src/components/`, `src/hooks/`, `src/lib/` para os diretorios correspondentes em `components/`, `lib/hooks/`, `lib/`. Ou alternativamente, mover TUDO para `src/` e ajustar imports.

2. **Consolidar lib/**: Agrupar os 49 subdiretorios em categorias maiores:
   - `lib/core/` (db, auth, config, types)
   - `lib/features/` (tickets, knowledge, notifications, analytics)
   - `lib/infrastructure/` (cache, email, monitoring, security)
   - `lib/integrations/` (whatsapp, sentry, datadog)

3. **Schema sync tool**: Criar um script que compara automaticamente schema.sql vs schema.postgres.sql e reporta diferencas.

### 3.2 Build & CI

4. **Corrigir Dockerfile**: O container de producao DEVE usar o custom server com Socket.io.

5. **Habilitar ESLint no build**: Remover `ignoreDuringBuilds: true`.

6. **Remover excludes excessivos do tsconfig**: Corrigir os erros de TypeScript nos arquivos excluidos.

### 3.3 Seguranca

7. **Verificar .env no git history**: Auditar e rotacionar segredos se necessario.

8. **Completar CSP**: Adicionar diretivas `default-src`, `script-src`, `connect-src`.

9. **SSL no PostgreSQL**: Usar `rejectUnauthorized: true` em producao.

10. **Remover `dangerouslyAllowSVG`** ou implementar sanitizacao.

### 3.4 Documentacao

11. **Limpar root**: Mover 319 .md para `docs/` organizado.

12. **Documentar padrao de imports**: Estabelecer regra clara sobre usar `@/lib/db/adapter` vs `@/lib/db/connection`.

---

## 4. Quick Wins (implementacao em < 1 hora cada)

| # | Acao | Impacto | Esforco |
|---|------|---------|---------|
| 1 | Mover @types/* para devDependencies | Reduce bundle | 5 min |
| 2 | Remover `dangerouslyAllowSVG: true` | Security fix | 1 min |
| 3 | Fix `outputFileTracingRoot` hardcoded | Portabilidade | 2 min |
| 4 | Remover codigo morto de ETag no middleware | Limpeza | 5 min |
| 5 | Adicionar seed ao docker-compose.dev.yml | Dev experience | 2 min |
| 6 | Atualizar eslint-config-next para v15 | Compatibilidade | 2 min |
| 7 | Remover `lib/notifications/channels.ts` duplicado do tsconfig exclude | Limpeza | 1 min |
| 8 | Verificar se `app/viewport.ts` e duplicado | Limpeza | 5 min |
| 9 | Fix `"start": "node server.ts"` -> `"tsx server.ts"` | Funcionalidade | 1 min |
| 10 | Remover `sqlite` e `sqlite3` do package.json (ja usa `better-sqlite3`) | Deps cleanup | 5 min |

---

## 5. Resumo por Severidade

| Severidade | Quantidade | Exemplos |
|-----------|------------|----------|
| CRITICAL | 4 | .env no git, Dockerfile errado, ESLint ignorado, SVG XSS |
| HIGH | 8 | Schema PostgreSQL incompleto, fragmentacao componentes, 319 .md no root, deps duplicadas, tsconfig excludes, path hardcoded, health check inconsistente, lib/ granular |
| MEDIUM | 9 | req.url!, CORS hardcoded, ETag morto, SQLite side-effect, CSP incompleta, dev sem seed, SSL inseguro, Nginx basico, getDatabase() ambiguo |
| LOW | 6 | eslint-config version, connection-pool review, scripts desorganizados, viewport duplicado, start command |

**Total: 27 problemas identificados**

---

## 6. Prioridade de Resolucao

### Fase 1 - Seguranca Imediata (1-2 dias)
1. C1: Auditar .env no git history
2. C4: Remover dangerouslyAllowSVG ou sanitizar
3. M5: Completar CSP headers
4. M7: Fix PostgreSQL SSL

### Fase 2 - Build & Deploy (2-3 dias)
5. C2: Fix Dockerfile para usar custom server
6. C3: Habilitar ESLint no build
7. H6: Fix outputFileTracingRoot
8. L6: Fix start command

### Fase 3 - Qualidade de Codigo (1 semana)
9. H2: Consolidar componentes
10. H4: Limpar dependencias
11. H5: Resolver tsconfig excludes
12. H1: Sincronizar schema PostgreSQL
13. M4: Lazy init SQLite connection

### Fase 4 - Organizacao (1 semana)
14. H3: Mover .md para docs/
15. H8: Reorganizar lib/
16. L3: Organizar scripts/
