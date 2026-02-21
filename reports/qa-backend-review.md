# QA Backend Review - ServiceDesk

**Data:** 2026-02-21
**Revisor:** Claude Opus 4.6 (Agent Backend QA)
**Escopo:** Todas as API routes, autenticacao, autorizacao, logica de negocio

---

## 1. Resumo Executivo

Foram revisados ~30 arquivos de API routes, 7 arquivos do sistema de autenticacao/RBAC, 3 arquivos de helpers/guards, e o middleware principal. O projeto apresenta uma base solida com boas praticas em varios pontos (rate limiting universal, tenant isolation via JWT, CSRF protection), mas possui problemas significativos em seguranca, consistencia e manutencao.

### Contagem de Problemas

| Severidade | Quantidade |
|------------|------------|
| CRITICAL   | 8          |
| HIGH       | 14         |
| MEDIUM     | 12         |
| LOW        | 9          |
| **TOTAL**  | **43**     |

---

## 2. Problemas Encontrados

### 2.1 CRITICAL (Quebram funcionalidade ou vulnerabilidades de seguranca)

---

#### C-01: `new Function()` em dynamic-permissions.ts permite Code Injection

**Arquivo:** `lib/auth/dynamic-permissions.ts:421-428`
**Descricao:** O metodo `safeEvaluate()` usa `new Function()` para avaliar condicoes de permissao dinamica. Embora tente restringir globals, `new Function()` e essencialmente `eval()` e permite execucao arbitraria de codigo JavaScript.

```typescript
const func = new Function(
  ...contextKeys,
  ...Object.keys(allowedGlobals),
  `"use strict"; return (${condition});`
);
```

Um administrador que crie uma regra com `condition = "process.mainModule.require('child_process').execSync('rm -rf /')"` pode executar comandos no servidor. O `"use strict"` nao impede acesso ao escopo global.

**Impacto:** Remote Code Execution (RCE) se um admin malicioso ou comprometido criar uma regra dinamica.
**Recomendacao:** Usar uma DSL restrita ou uma biblioteca de avaliacao segura de expressoes (como `expr-eval` ou `mathjs`). Nunca usar `new Function()` / `eval()` com dados armazenados no banco.

---

#### C-02: `evaluateConditions()` em rbac-engine.ts falha em caso de parse error e PERMITE acesso

**Arquivo:** `lib/auth/rbac-engine.ts:231-233`
**Descricao:** O catch block retorna `true` (permissao concedida) quando o parse de conditions falha:

```typescript
} catch {
  return true; // Se nao conseguir avaliar, permite
}
```

**Impacto:** Se `conditions` contem JSON invalido ou malformado, a permissao e concedida por padrao (fail-open). Isso viola o principio de "deny by default" declarado na documentacao do modulo.
**Recomendacao:** Retornar `false` no catch block para fail-closed.

---

#### C-03: `admin/tickets/route.ts` usa fallback `organization_id || 1` para tenant

**Arquivo:** `app/api/admin/tickets/route.ts:32`
**Descricao:** O fallback `decoded.organization_id || 1` significa que se `organization_id` for `null`, `undefined`, ou `0`, o tenant ID default sera `1`. Isso pode expor dados do tenant 1 para usuarios sem tenant definido.

```typescript
const tenantId = decoded.organization_id || 1
```

**Impacto:** Cross-tenant data leakage. Usuarios sem `organization_id` no token verao dados do tenant 1.
**Recomendacao:** Falhar com 400/401 se `organization_id` nao estiver presente. O mesmo padrao `|| 1` aparece em `app/api/admin/users/[id]/route.ts` (linhas 87, 131, 154, 165, 168, 230, 242, 247).

---

#### C-04: `admin/tickets/route.ts` usa `tenant_id` em vez de `organization_id` na query

**Arquivo:** `app/api/admin/tickets/route.ts:59`
**Descricao:** A query filtra por `t.tenant_id = ?`, mas muitas tabelas no schema SQLite usam `organization_id`. Se o schema atual usa `organization_id`, esta rota retornara 0 resultados ou falhara silenciosamente. Nao ha fallback try/catch como em outras rotas.

```sql
WHERE t.tenant_id = ?
```

**Impacto:** Tickets podem nao ser listados para admin. Inconsistencia com o resto do sistema que tenta ambas as colunas.
**Recomendacao:** Adicionar fallback para `organization_id` ou padronizar o nome da coluna.

---

#### C-05: `admin/users/route.ts` usa `getTenantContextFromRequest` sem `await`

**Arquivo:** `app/api/admin/users/route.ts:22-23`
**Descricao:** `getUserContextFromRequest(request)` e uma funcao sincrona neste modulo, mas depende de JWT verificado de forma sincrona com `jsonwebtoken`. Entretanto, o guard `requireTenantUserContext` em `request-guard.ts` usa o mesmo padrao correto. O problema real e que `getTenantContextFromRequest` pode retornar tenant baseado em headers X-Tenant-* que sao definidos pelo middleware, mas que podem ser spoofados se o request bypassa o middleware (ex: chamada direta via curl sem cookie).

**Impacto:** Potencial tenant spoofing se headers X-Tenant-* forem manipulados. A funcao `getTenantContextFromRequest` tenta primeiro o token JWT (seguro) e so usa headers como fallback.
**Recomendacao:** Em producao, `getTenantContextFromRequest` ja prioriza o JWT. Mas a rota `admin/users/route.ts` deveria usar `requireTenantUserContext()` que valida tenant-user match, como fazem as rotas de tickets.

---

#### C-06: `admin/users/[id]/route.ts` usa Bearer token em vez de httpOnly cookie

**Arquivo:** `app/api/admin/users/[id]/route.ts:64-70`
**Descricao:** Esta rota exige o token via `Authorization: Bearer` header em vez de extrair de httpOnly cookies. Isso e inconsistente com o padrao do sistema e pode incentivar o frontend a armazenar o token em localStorage (vulneravel a XSS).

```typescript
const authHeader = request.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Token de acesso requerido' }, { status: 401 });
}
```

**Impacto:** Se o frontend armazena o token em localStorage para enviar via Bearer header, um ataque XSS pode roubar o token. As rotas de login, verify, profile, etc., usam httpOnly cookies corretamente.
**Recomendacao:** Usar o padrao de extracoes de token de cookies, como em `extractAuthToken()` ou `requireTenantUserContext()`.

---

#### C-07: `rbac.ts` transaction isolation - usa `executeRun` global em callbacks de `executeTransaction`

**Arquivo:** `lib/auth/rbac.ts:240-251, 334-351`
**Descricao:** As funcoes `setRolePermissions()` e `setUserRoles()` usam `executeTransaction()` mas dentro do callback usam `executeRun()` global em vez do parametro `db` fornecido pelo callback da transacao.

```typescript
await executeTransaction(async () => {
  await executeRun('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
  for (const permissionId of permissionIds) {
    await executeRun(`INSERT INTO role_permissions ...`, [...]);
  }
});
```

**Impacto:** Funciona em SQLite (single connection), mas **quebrara** em PostgreSQL com connection pooling, pois as operacoes podem ir para conexoes diferentes e nao participar da mesma transacao.
**Recomendacao:** Alterar para usar o parametro `db` do callback: `await executeTransaction(async (db) => { await db.run(...) })`.

---

#### C-08: `problems/route.ts` usa `payload.userId ?? 0` como fallback para ID do criador

**Arquivo:** `app/api/problems/route.ts:242`
**Descricao:** Ao criar um problema, se `payload.userId` for undefined, o ID do criador sera `0`, que e um ID invalido.

```typescript
const problem = await problemQueries.createProblem(
  tenant.organizationId,
  payload.userId ?? 0, // <<< 0 e invalido
  input
);
```

O mesmo padrao aparece em `known-errors/route.ts:196`.

**Impacto:** Cria registros com `created_by = 0` que nao referenciam nenhum usuario real. Pode violar FK constraints em PostgreSQL.
**Recomendacao:** Rejeitar com 401 se `payload.userId` for null/undefined.

---

### 2.2 HIGH (Problemas significativos de qualidade/manutencao)

---

#### H-01: Inconsistencia na autenticacao entre rotas

**Descricao:** Existem pelo menos 5 padroes diferentes de autenticacao usados nas rotas:

1. `requireTenantUserContext(request)` - request-guard.ts (usado em tickets, knowledge, comments)
2. `verifyAuth(request)` - auth-service.ts (usado em changes, cmdb, cab)
3. `verifyTokenFromCookies(request)` - sqlite-auth.ts (usado em admin/tickets)
4. `verifyToken(token)` com `cookies()` - (usado em problems, known-errors)
5. `getUserContextFromRequest(request)` + `getTenantContextFromRequest(request)` - tenant/context.ts (usado em admin/users)
6. Bearer token manual via `request.headers.get('authorization')` (usado em admin/users/[id], admin/stats)

**Impacto:** Dificuldade de manutencao. Cada padrao tem nuances diferentes de validacao. Alteracoes em um nao se refletem nos outros. Risco de introduzir bugs de seguranca ao modificar um padrao sem atualizar os demais.
**Recomendacao:** Padronizar em `requireTenantUserContext()` ou criar um unico guard wrapper que todas as rotas usem.

---

#### H-02: Inconsistencia no nome da coluna tenant (`organization_id` vs `tenant_id`)

**Descricao:** O codebase inteiro sofre com a dualidade `organization_id` / `tenant_id`. Praticamente toda rota tem blocos try/catch para tentar uma coluna e, em caso de erro, tentar a outra:

```typescript
try {
  // Try organization_id
} catch {
  // Fallback to tenant_id
}
```

Exemplos: `login/route.ts`, `register/route.ts`, `verify/route.ts`, `admin/users/[id]/route.ts`, `tickets/[id]/comments/route.ts`.

**Impacto:** Cada try/catch duplica codigo e esconde erros reais (o catch ignora qualquer erro, nao apenas "column not found"). Performance afetada por queries que falham antes de tentar a alternativa.
**Recomendacao:** Padronizar em `organization_id` (que e o padrao do schema SQLite principal) e criar alias `tenant_id` via VIEW ou adapter.

---

#### H-03: Falta de validacao de entrada em rotas de tickets

**Arquivo:** `app/api/tickets/route.ts:174, app/api/tickets/[id]/route.ts:132`
**Descricao:** O POST de tickets e o PATCH nao validam comprimento ou conteudo de `title` e `description`. Um atacante pode enviar strings de megabytes.

```typescript
const { title, description, category_id, priority_id } = await request.json()
// Nenhuma validacao de tamanho
```

**Impacto:** DoS via payload grande, armazenamento de dados maliciosos.
**Recomendacao:** Adicionar validacao Zod com limites de tamanho (ex: title max 500 chars, description max 10000 chars). As rotas ITIL (changes, cmdb) usam Zod corretamente.

---

#### H-04: `admin/stats/route.ts` nao aceita cookie httpOnly

**Arquivo:** `app/api/admin/stats/route.ts:24-28`
**Descricao:** A rota exige explicitamente `Authorization: Bearer` header, ignorando o token httpOnly cookie que e o padrao do sistema.

```typescript
const authHeader = request.headers.get('authorization')
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Token de autenticacao necessario' }, { status: 401 })
}
```

**Impacto:** O frontend que usa cookies httpOnly nao consegue autenticar nesta rota. Quebra funcionalidade.
**Recomendacao:** Usar extrator de token unificado que aceita tanto cookie quanto Bearer header.

---

#### H-05: Lockout duration de apenas 1 minuto apos 5 tentativas

**Arquivo:** `app/api/auth/login/route.ts:303`

```typescript
const LOCKOUT_DURATION_MINUTES = 1;
```

**Impacto:** Lockout de 1 minuto apos 5 tentativas e insuficiente. Um atacante pode fazer brute force de 5 senhas por minuto = 7200 por dia. Deveria ser progressivo ou pelo menos 15-30 minutos.
**Recomendacao:** Implementar lockout progressivo (1min, 5min, 15min, 30min) ou usar exponential backoff.

---

#### H-06: `login/route.ts` nao gera refresh token

**Arquivo:** `app/api/auth/login/route.ts:398-404`
**Descricao:** A rota de login gera apenas access token (15min) e nao gera refresh token. A rota de registro (`register/route.ts`) gera ambos corretamente. Isso significa que apos login, o usuario sera deslogado em 15 minutos sem possibilidade de refresh automatico.

```typescript
const token = await new jose.SignJWT(tokenPayload)
  .setExpirationTime('15m')
  .sign(JWT_SECRET);
// Nenhum refresh token gerado
```

**Impacto:** Experiencia de usuario ruim - sessao expira a cada 15 minutos. Inconsistencia com registro que gera refresh token.
**Recomendacao:** Gerar refresh token no login, como e feito no registro.

---

#### H-07: `changes/route.ts` `generateChangeNumber()` usa `SUBSTR()` que e SQLite-specific

**Arquivo:** `app/api/changes/route.ts:54`
**Descricao:** A funcao usa `SUBSTR(change_number, 4)` para extrair o numero sequencial. Embora funcione em PostgreSQL tambem (`SUBSTR` e suportado), o `CAST(SUBSTR(...) AS INTEGER)` pode falhar em PostgreSQL se houver valores nao numericos.

O mesmo padrao existe em `cmdb/route.ts:64` para `generateCINumber()`.

**Impacto:** Potencial erro ao migrar para PostgreSQL se houver dados inconsistentes.
**Recomendacao:** Usar `ORDER BY id DESC LIMIT 1` e parser no lado da aplicacao, conforme nota no MEMORY.md.

---

#### H-08: `profile/route.ts` PUT nao verifica tenant isolation na checagem de email duplicado

**Arquivo:** `app/api/auth/profile/route.ts:186-189`
**Descricao:** A verificacao de email duplicado na atualizacao de perfil busca em todos os tenants:

```sql
SELECT id FROM users WHERE email = ? AND id != ?
```

**Impacto:** Um usuario pode ser bloqueado de usar um email que existe em outro tenant, ou pior, a checagem pode nao impedir que dois usuarios no mesmo tenant tenham o mesmo email.
**Recomendacao:** Adicionar `AND organization_id = ?` ao filtro.

---

#### H-09: `cab/route.ts` cab_members query nao filtra por organization_id

**Arquivo:** `app/api/cab/route.ts:60-62`
**Descricao:** A verificacao de membro do CAB nao inclui `organization_id`:

```sql
SELECT 1 as result FROM cab_members WHERE user_id = ? AND is_active = 1
```

**Impacto:** Um usuario de outro tenant que seja membro do CAB em sua organizacao pode ver reunioes de outro tenant.
**Recomendacao:** Adicionar `AND organization_id = ?` com `auth.user.organization_id`.

---

#### H-10: Response format inconsistente entre rotas

**Descricao:** As rotas retornam dados em formatos diferentes:

- Tickets: `{ success: true, tickets: [...] }`
- Problems: `{ success: true, data: { data: [...], total: N } }`
- Changes: `{ success: true, change_requests: [...], statistics: {...}, pagination: {...} }`
- CMDB: `{ success: true, configuration_items: [...], pagination: {...} }`
- Knowledge: `{ success: true, articles: [...], pagination: {...} }`
- Admin users: `{ success: true, users: [...] }`
- `api-helpers.ts` define `PaginatedResponse` com `{ success: true, data: [...], meta: { page, limit, total, totalPages } }`

**Impacto:** Frontend precisa de adaptadores diferentes para cada endpoint. Inconsistencia dificulta manutencao.
**Recomendacao:** Padronizar em `{ success: true, data: [...], meta: { page, limit, total, totalPages } }` conforme definido em `api-helpers.ts`.

---

#### H-11: `admin/users/[id]/route.ts` usa `userQueries.getById()` sincrono legado

**Arquivo:** `app/api/admin/users/[id]/route.ts:87, 131, 154`
**Descricao:** Esta rota usa `userQueries.getById()` e `userQueries.getByEmail()` do `lib/db/queries.ts` antigo (sincrono, direto SQLite) em vez do adapter pattern. Estas funcoes nao sao async e acessam o database diretamente.

**Impacto:** Quebrara com PostgreSQL. Inconsistente com o resto do codebase que usa o adapter.
**Recomendacao:** Migrar para o adapter pattern com `executeQueryOne`.

---

#### H-12: `knowledge/route.ts` GET query coloca `tenantContext.id` fora de ordem nos params

**Arquivo:** `app/api/knowledge/route.ts:65-69`
**Descricao:** O `tenantContext.id` para o JOIN com `users` e passado como primeiro parametro, mas o `whereClause` ja tem seus proprios parametros:

```typescript
const articles = await executeQuery(`
  ...
  LEFT JOIN users u ON k.author_id = u.id AND u.tenant_id = ?
  ${whereClause}
  ...
`, [tenantContext.id, ...params, limit, offset])
```

O placeholder `?` do JOIN com users e satisfeito pelo primeiro `tenantContext.id`. Os placeholders do `whereClause` sao satisfeitos por `...params` (que ja inclui `tenantContext.id` como primeiro item). Isso **funciona corretamente** porque params[0] = tenantContext.id para a clausula WHERE. Porem, a duplicacao e confusa.

**Impacto:** Baixo (funciona), mas confuso para manutencao.

---

#### H-13: Falta de sanitizacao de input em `title` e `description` de tickets

**Arquivo:** `app/api/tickets/route.ts:174`
**Descricao:** Campos `title` e `description` nao sao sanitizados contra XSS antes de armazenar. Embora os comentarios usem `sanitizeRequestBody`, os tickets nao.

**Impacto:** Stored XSS se o frontend renderizar estes campos sem escapar.
**Recomendacao:** Usar `stripHTML()` ou similar para title, e sanitizacao HTML segura para description.

---

#### H-14: `changes/route.ts` POST `affected_cis` campo e string no schema mas tratado como JSON array

**Arquivo:** `app/api/changes/route.ts:257-275`
**Descricao:** `affected_cis` e definido como `z.string().optional()` no schema Zod, mas na logica de negocio e tratado como JSON array:

```typescript
const ciIds: number[] = JSON.parse(data.affected_cis)
```

**Impacto:** Se `affected_cis` for uma string valida que nao e JSON, o parse falha silenciosamente (catch ignora). Se for JSON valido mas nao um array de numeros, `ciIds` pode conter dados inesperados.
**Recomendacao:** Validar como `z.array(z.number()).optional()` ou `z.string().refine(isValidJSON).optional()`.

---

### 2.3 MEDIUM (Melhorias importantes mas nao urgentes)

---

#### M-01: Rate limiting duplo em varias rotas

**Descricao:** Muitas rotas aplicam rate limiting duas vezes - uma via `applyRateLimit(request, RATE_LIMITS.X)` (redis-limiter) e outra via `createRateLimitMiddleware('api')` (in-memory limiter):

```typescript
const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
if (rateLimitResponse) return rateLimitResponse;
const rateLimitResult = await adminRateLimit(request, '/api/admin/users');
if (rateLimitResult instanceof Response) return rateLimitResult;
```

Exemplos: `admin/users/route.ts`, `auth/verify/route.ts`, `auth/refresh/route.ts`.

**Impacto:** Overhead de performance desnecessario. Configuracoes podem conflitar.
**Recomendacao:** Escolher um mecanismo de rate limiting e remover o outro.

---

#### M-02: `getUserRoles()` em `rbac.ts` usa `datetime('now')` que e SQLite-specific

**Arquivo:** `lib/auth/rbac.ts:306`

```sql
AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
```

**Impacto:** Quebrara em PostgreSQL. Deveria usar `CURRENT_TIMESTAMP` ou parametrizar.
**Recomendacao:** Substituir por `CURRENT_TIMESTAMP` que funciona em ambos.

---

#### M-03: `middleware.ts` nao protege todas as rotas API

**Arquivo:** `middleware.ts:136-176`
**Descricao:** As listas `PUBLIC_ROUTES`, `TENANT_PUBLIC_ROUTES`, e `PROTECTED_ROUTES` sao mantidas manualmente e podem nao cobrir todas as rotas. Rotas como `/api/catalog`, `/api/search`, `/api/sla`, `/api/analytics` nao estao explicitamente listadas.

Alem disso, o `requiresAuth()` retorna `false` para rotas API nao listadas em `TENANT_PUBLIC_ROUTES`, significando que rotas como `/api/search` podem estar desprotegidas.

**Impacto:** Rotas podem ser acessadas sem autenticacao.
**Recomendacao:** Inverter a logica: todas as rotas API requerem auth por padrao, exceto as explicitamente listadas como publicas.

---

#### M-04: `cab/route.ts` queries de subselect sao N+1

**Arquivo:** `app/api/cab/route.ts:108-111`

```sql
(SELECT COUNT(*) FROM change_requests WHERE cab_meeting_id = m.id) as change_count,
(SELECT COUNT(*) FROM cab_members cm WHERE cm.organization_id = m.organization_id AND cm.is_active = 1) as member_count
```

**Impacto:** `member_count` e o mesmo para todas as reunioes (conta todos os membros ativos da org), portanto e calculado N vezes desnecessariamente.
**Recomendacao:** Mover `member_count` para uma query separada executada uma vez.

---

#### M-05: `profile/route.ts` usa rate limit de LOGIN para profile

**Arquivo:** `app/api/auth/profile/route.ts:113, 149`

```typescript
const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
```

**Impacto:** Limites de rate do login (provavelmente mais restritivos) sao aplicados ao perfil, potencialmente bloqueando atualizacoes legitimas de perfil.
**Recomendacao:** Usar `RATE_LIMITS.DEFAULT` ou criar um rate limit especifico para perfil.

---

#### M-06: `admin/users/[id]/route.ts` role check inconsistente

**Arquivo:** `app/api/admin/users/[id]/route.ts:76`
**Descricao:** A rota so aceita `role === 'admin'`, mas outras rotas admin aceitam `['super_admin', 'tenant_admin', 'admin', 'team_manager']`. Isso significa que `super_admin` e `tenant_admin` nao podem gerenciar usuarios individuais por esta rota.

```typescript
if (user.role !== 'admin') {
  return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
}
```

**Impacto:** Funcionalidade reduzida para super_admin e tenant_admin.
**Recomendacao:** Usar o mesmo array de admin roles que as outras rotas.

---

#### M-07: `login/route.ts` tenant-context cookie nao e httpOnly

**Arquivo:** `app/api/auth/login/route.ts:432-446`

```typescript
response.cookies.set('tenant-context', JSON.stringify({...}), {
  httpOnly: false,
  ...
});
```

**Impacto:** O cookie `tenant-context` pode ser lido e modificado via JavaScript do lado do cliente. Embora contenha apenas informacoes de exibicao (id, slug, name), um script malicioso pode ler dados do tenant.
**Recomendacao:** Se o frontend nao precisa ler este cookie via JS, tornar httpOnly.

---

#### M-08: Nenhuma rota implementa pagination maxima para `offset`

**Descricao:** Embora `limit` seja capped (ex: `MAX_LIMIT = 100`), o `offset` pode ser arbitrariamente grande:

```typescript
const offset = (page - 1) * limit  // Se page = 1000000, offset = 100000000
```

**Impacto:** Queries com offset muito grande podem ser lentas no banco.
**Recomendacao:** Adicionar limite maximo de paginas ou usar cursor-based pagination.

---

#### M-09: `changes/route.ts` status `pending_cab` nao esta no enum de querySchema

**Arquivo:** `app/api/changes/route.ts:41, 197`
**Descricao:** O status `pending_cab` e usado no POST (`status = 'pending_cab'`), mas nao esta listado no `querySchema.status` enum usado no GET.

**Impacto:** Nao e possivel filtrar por `pending_cab` via query parameter.
**Recomendacao:** Adicionar `pending_cab` ao enum.

---

#### M-10: `rbac-engine.ts` `applyRowLevelSecurity` concatena SQL diretamente

**Arquivo:** `lib/auth/rbac-engine.ts:517-527`
**Descricao:** O metodo recebe uma `condition` (string SQL) do banco e concatena na query. Se a condition armazenada contiver SQL injection, sera executada.

```typescript
const policyConditions = policies.map(p => `(${p.condition})`).join(' OR ');
return `${baseQuery} AND (${policyConditions})`;
```

**Impacto:** Se um admin comprometido inserir uma condition maliciosa na tabela `row_level_policies`, pode causar SQL injection.
**Recomendacao:** Validar conditions com uma whitelist de padroes SQL seguros ao salvar na tabela.

---

#### M-11: `admin/users/[id]/route.ts` role validation aceita apenas 3 roles

**Arquivo:** `app/api/admin/users/[id]/route.ts:148`

```typescript
if (role && !['admin', 'agent', 'user'].includes(role)) {
  return NextResponse.json({ error: 'Role invalida' }, { status: 400 });
}
```

**Impacto:** Nao permite atribuir roles como `super_admin`, `tenant_admin`, `team_manager`, `manager`, `read_only`, `api_client` que existem no sistema RBAC.
**Recomendacao:** Usar a lista completa de roles validos definida no sistema.

---

#### M-12: `tickets/route.ts` GET usa `tenant_id` em todas as JOINs

**Arquivo:** `app/api/tickets/route.ts:69-73`
**Descricao:** Os JOINs filtram `AND s.tenant_id = ?`, `AND p.tenant_id = ?`, etc. Se o schema usa `organization_id` em vez de `tenant_id`, estas joins falharam silenciosamente (LEFT JOIN retorna NULL).

**Impacto:** Status, priority, category, e user_name podem ser NULL mesmo quando existem no banco.
**Recomendacao:** Verificar qual coluna o schema realmente usa e aplicar consistentemente.

---

### 2.4 LOW (Nice-to-have, melhorias cosmeticas)

---

#### L-01: `console.error` usado em vez de `logger.error` em algumas rotas

**Arquivos:** `problems/route.ts:159`, `known-errors/route.ts:103,213`, `changes/route.ts:60` (indiretamente via `SUBSTR`)
**Impacto:** Logs nao estruturados, dificeis de monitorar.

---

#### L-02: Ausencia de logging de acessos bem-sucedidos em rotas admin

**Descricao:** Rotas admin como `admin/users/route.ts`, `admin/tickets/route.ts` nao logam quem acessou os dados.
**Recomendacao:** Adicionar audit logging para acesso a dados sensiveis.

---

#### L-03: `auth/verify/route.ts` tem GET e POST com logica quase identica

**Descricao:** O POST aceita token no body, o GET aceita via header/cookie. A logica e duplicada com ~90% de overlap.
**Recomendacao:** Extrair logica comum para funcao helper.

---

#### L-04: `token-manager.ts` `generateRefreshToken` tem try/catch nested para fallback de schema

**Arquivo:** `lib/auth/token-manager.ts:200-235`
**Descricao:** O INSERT do refresh token tenta dois schemas diferentes (com `device_info`/`is_active` e com `device_fingerprint`/`tenant_id`).
**Recomendacao:** Padronizar o schema de `refresh_tokens`.

---

#### L-05: Tipagem `any` excessiva

**Descricao:** Uso de `Record<string, unknown>` e `any` como tipo de retorno de queries em varias rotas (cab, cmdb, changes, admin/users).
**Recomendacao:** Criar interfaces tipadas para cada entidade.

---

#### L-06: `cmdb/route.ts` search query com 5 LIKEs pode ser lenta

**Arquivo:** `app/api/cmdb/route.ts:97-99`
```sql
AND (ci.name LIKE ? OR ci.ci_number LIKE ? OR ci.description LIKE ? OR ci.hostname LIKE ? OR ci.ip_address LIKE ?)
```
**Recomendacao:** Considerar FTS (Full-Text Search) ou indice de busca.

---

#### L-07: `register/route.ts` retorna token de acesso tambem no body JSON

**Arquivo:** `app/api/auth/register/route.ts:384`
```typescript
token: accessToken,
```
**Impacto:** O token ja esta no httpOnly cookie. Retornar no body facilita leak em logs.
**Recomendacao:** Remover o token do body da resposta.

---

#### L-08: `middleware.ts` PUBLIC_ROUTES inclui `/api/auth` inteiro

**Arquivo:** `middleware.ts:139`
**Descricao:** `/api/auth` esta em `PUBLIC_ROUTES`, o que significa que rotas como `/api/auth/profile`, `/api/auth/change-password` nao passam pelo middleware de autenticacao. Embora essas rotas facam sua propria autenticacao, perdem CSRF protection e outros checks do middleware.
**Recomendacao:** Ser mais granular: `/api/auth/login`, `/api/auth/register`, `/api/auth/verify`.

---

#### L-09: `rbac.ts` `updateRole` aceita keys arbitrarios via `Object.entries(updates)`

**Arquivo:** `lib/auth/rbac.ts:155-158`
**Descricao:** O loop itera sobre todas as chaves do objeto `updates` e as coloca diretamente na query SQL como nomes de coluna:
```typescript
fields.push(`${key} = ?`);
```
Embora o TypeScript restrinja a `Partial<Omit<Role, 'id' | 'created_at'>>`, em runtime qualquer chave pode ser passada.
**Impacto:** Potencial SQL injection via nome de coluna se nao sanitizado.
**Recomendacao:** Usar whitelist explicita de colunas permitidas.

---

## 3. Analise de Seguranca

### 3.1 Pontos Fortes

1. **JWT com verificacao rigorosa**: O middleware verifica issuer, audience, algoritmo, e tipo do token (access vs refresh).
2. **Tenant isolation via JWT**: O `organization_id` vem do JWT, nao de headers manipulaveis pelo cliente. O middleware verifica se o tenant do JWT corresponde ao tenant da URL.
3. **CSRF protection**: O middleware aplica validacao de CSRF token para todas as requisicoes state-changing (POST, PUT, PATCH, DELETE).
4. **Rate limiting universal**: Todas as rotas revisadas tem rate limiting aplicado.
5. **Account lockout**: Login implementa lockout apos tentativas falhadas.
6. **Refresh token rotation**: O endpoint de refresh revoga o token antigo ao emitir um novo.
7. **Device fingerprinting**: Tokens sao vinculados ao dispositivo via fingerprint.
8. **Soft delete**: Usuarios sao desativados, nao deletados, preservando audit trail.
9. **Input sanitization**: Registro usa `stripHTML()` e email normalization.
10. **Security headers**: Middleware aplica CSP, HSTS, X-Frame-Options via helmet.

### 3.2 Pontos Fracos

1. **Code injection via `new Function()`** (C-01) - Vulnerabilidade critica.
2. **Fail-open em RBAC conditions** (C-02) - Viola deny-by-default.
3. **Tenant ID fallback `|| 1`** (C-03) - Cross-tenant data leak.
4. **Inconsistencia na autenticacao** (H-01) - Superficie de ataque ampliada.
5. **RLS conditions como SQL literal** (M-10) - SQL injection potencial.
6. **`/api/auth` inteiro como PUBLIC** (L-08) - Profile/change-password sem CSRF middleware.
7. **Bearer token em localStorage** (C-06) - XSS pode roubar token.

---

## 4. Analise de Consistencia

### 4.1 Padroes de Tenant Isolation

| Rota | Metodo Tenant | organization_id/tenant_id | Fallback |
|------|--------------|--------------------------|----------|
| tickets/route.ts | requireTenantUserContext | tenant_id | N/A |
| tickets/[id]/route.ts | requireTenantUserContext | tenant_id | N/A |
| problems/route.ts | resolveTenantFromRequest | organization_id | N/A |
| changes/route.ts | verifyAuth | organization_id | N/A |
| cmdb/route.ts | verifyAuth | organization_id | N/A |
| cab/route.ts | verifyAuth | organization_id | N/A |
| admin/tickets/route.ts | verifyTokenFromCookies | tenant_id | `\|\| 1` |
| admin/users/route.ts | getUserContextFromRequest | COALESCE | N/A |
| admin/users/[id]/route.ts | verifyToken (Bearer) | organization_id | `\|\| 1` |
| admin/stats/route.ts | verifyToken (Bearer) | tenant_id + organization_id | N/A |
| knowledge/route.ts | requireTenantUserContext | tenant_id | N/A |
| known-errors/route.ts | resolveTenantFromRequest | organization_id | N/A |

### 4.2 Padroes de Auth Check

| Rota | Admin Roles Aceitos |
|------|---------------------|
| admin/users/route.ts | super_admin, tenant_admin, admin |
| admin/users/[id]/route.ts | admin (apenas) |
| admin/tickets/route.ts | admin, super_admin, tenant_admin, team_manager |
| admin/stats/route.ts | admin, tenant_admin |
| cab/route.ts POST | admin, manager |
| cmdb/route.ts POST | admin, agent, manager |
| knowledge/route.ts POST | super_admin, tenant_admin, team_manager |
| problems/route.ts POST | NOT user (tudo menos user) |

**Nota:** Nao ha consistencia nos admin roles. Cada rota define sua propria lista.

---

## 5. Recomendacoes de Melhoria

### 5.1 Prioridade Imediata (Seguranca)

1. **Remover `new Function()` de dynamic-permissions.ts** - Substituir por evaluador de expressoes seguro.
2. **Corrigir fail-open em `evaluateConditions()`** - Retornar `false` no catch.
3. **Remover fallback `|| 1` para tenant ID** - Falhar com erro se ausente.
4. **Gerar refresh token no login** - Paridade com registro.
5. **Corrigir transaction isolation em `rbac.ts`** - Usar parametro `db` do callback.

### 5.2 Prioridade Alta (Consistencia)

1. **Padronizar autenticacao** - Um unico guard pattern para todas as rotas.
2. **Padronizar nome da coluna tenant** - `organization_id` em todo o codebase.
3. **Padronizar formato de resposta API** - Conforme `PaginatedResponse` em api-helpers.ts.
4. **Padronizar lista de admin roles** - Constante exportada de um lugar centralizado.
5. **Adicionar validacao Zod em rotas de tickets** - Alinhamento com ITIL routes.

### 5.3 Prioridade Media (Qualidade)

1. **Remover rate limiting duplo** - Escolher redis-limiter ou in-memory.
2. **Migrar `admin/users/[id]` para adapter pattern** - Remover uso de queries sincrono.
3. **Adicionar sanitizacao de input em tickets** - Prevenir stored XSS.
4. **Corrigir middleware PUBLIC_ROUTES** - Granularizar `/api/auth`.
5. **Adicionar audit logging em acessos admin** - Conformidade com requisitos ITIL.

---

## 6. Conclusao

O backend do ServiceDesk tem uma fundacao de seguranca solida, com JWT, CSRF, rate limiting, e tenant isolation implementados. Os problemas criticos estao concentrados em:

1. **Code injection via `new Function()`** em regras dinamicas de permissao
2. **Fail-open em avaliacao de conditions RBAC**
3. **Fallback de tenant ID `|| 1`** que pode causar data leak
4. **Inconsistencia de padroes** que aumenta superficies de ataque

A recomendacao principal e **padronizar** a camada de autenticacao e autorizacao em um unico guard pattern, eliminar o dualismo `organization_id`/`tenant_id`, e corrigir as 3 vulnerabilidades criticas de seguranca listadas acima.
