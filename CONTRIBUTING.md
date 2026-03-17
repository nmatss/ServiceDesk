# Guia de Contribuicao

Obrigado pelo interesse em contribuir com o ServiceDesk! Este documento descreve as diretrizes e padroes para contribuicoes ao projeto.

## Indice

1. [Como Contribuir](#como-contribuir)
2. [Configuracao do Ambiente de Desenvolvimento](#configuracao-do-ambiente-de-desenvolvimento)
3. [Padroes de Codigo](#padroes-de-codigo)
4. [Convencoes de Commit](#convencoes-de-commit)
5. [Padroes de API Route](#padroes-de-api-route)
6. [Padroes de Seguranca](#padroes-de-seguranca)
7. [Testes](#testes)
8. [Checklist de Code Review](#checklist-de-code-review)

---

## Como Contribuir

### Fluxo de Trabalho

1. **Fork** o repositorio no GitHub
2. **Clone** seu fork localmente:
   ```bash
   git clone https://github.com/SEU_USUARIO/ServiceDesk.git
   cd ServiceDesk
   ```
3. **Crie uma branch** a partir de `main`:
   ```bash
   git checkout -b feat/minha-feature
   ```
   Prefixos aceitos: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`
4. **Implemente** suas mudancas seguindo os padroes descritos abaixo
5. **Valide** localmente:
   ```bash
   npm run build && npm run lint && npm run type-check
   ```
6. **Commit** seguindo as convencoes de commit
7. **Push** para seu fork:
   ```bash
   git push origin feat/minha-feature
   ```
8. **Abra um Pull Request** contra `main` com descricao clara do que foi feito e por que

### Regras para Pull Requests

- Cada PR deve focar em uma unica feature ou correcao
- O build deve passar sem erros (`npm run build`)
- TypeScript deve compilar com 0 erros (`npm run type-check`)
- Inclua uma descricao clara explicando o que, por que e como
- Se alterar estrutura de dados, atualize **ambos** os schemas (SQLite e PostgreSQL)

---

## Configuracao do Ambiente de Desenvolvimento

### Pre-requisitos

- Node.js 18+ (LTS recomendado)
- npm 9+
- Git

### Instalacao

```bash
# Instale as dependencias
npm install

# Inicialize o banco de dados SQLite (desenvolvimento)
npm run init-db

# Inicie o servidor de desenvolvimento
npm run dev
```

O servidor estara disponivel em `http://localhost:3000`.

### Comandos Essenciais

| Comando | Descricao |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (localhost:3000) |
| `npm run build` | Build de producao |
| `npm run lint` | Verificacao ESLint |
| `npm run type-check` | Verificacao de tipos TypeScript |
| `npm run init-db` | Inicializar banco SQLite com schema e seed |
| `npm run test-db` | Testar conexao com banco |
| `npm run db:seed` | Popular banco com dados de exemplo |
| `npm run db:clear` | Limpar todos os dados do banco |

### Variaveis de Ambiente

Copie `.env.example` para `.env.local` e configure as variaveis necessarias. As principais sao:

- `JWT_SECRET` — Segredo para tokens JWT (minimo 32 caracteres)
- `DB_TYPE` — `sqlite` (desenvolvimento) ou `postgresql` (producao)
- `DATABASE_URL` — URL de conexao para PostgreSQL
- `NODE_ENV` — `development` ou `production`

---

## Padroes de Codigo

### TypeScript

- **Modo strict** habilitado — 0 erros permitidos
- Use **path mapping** `@/*` para imports (ex: `@/lib/db/adapter`)
- Defina tipos explicitos para parametros de funcao e retornos de API
- Use `SqlParam` para parametros de query: `string | number | boolean | null`
- Evite `any` — use tipos especificos ou `unknown` com type guards

```typescript
// Correto
import { executeQuery } from '@/lib/db/adapter';
import type { SqlParam } from '@/lib/db/adapter';
import type { Ticket } from '@/lib/types/database';

// Incorreto
import { executeQuery } from '../../../lib/db/adapter';
```

### Adapter Pattern (Banco de Dados)

Todo acesso ao banco **deve** usar o adapter unificado. Nunca importe SQLite ou PostgreSQL diretamente:

```typescript
import { executeQuery, executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter'
import type { SqlParam } from '@/lib/db/adapter'
```

Funcoes disponiveis:
- `executeQuery<T>(sql, params)` — SELECT retornando `T[]`
- `executeQueryOne<T>(sql, params)` — SELECT retornando `T | undefined`
- `executeRun(sql, params)` — INSERT/UPDATE/DELETE retornando `{changes, lastInsertRowid?}`
- `executeTransaction<T>(callback)` — Transacao com isolamento

### Helpers de Dialeto SQL

Para compatibilidade entre SQLite e PostgreSQL, use **sempre** os helpers:

```typescript
import { sqlNow, sqlDateSub, sqlGroupConcat, getDatabaseType } from '@/lib/db/adapter'
```

Disponiveis: `sqlNow()`, `sqlDateSub()`, `sqlDateDiff()`, `sqlGroupConcat()`, `sqlCastDate()`, `sqlStartOfMonth()`, `sqlDateAdd()`, `sqlDatetimeSub()`, `sqlDatetimeSubHours()`, `sqlDatetimeSubMinutes()`, `sqlExtractHour()`, `sqlExtractDayOfWeek()`, `sqlDatetimeSubYears()`, `sqlColSubMinutes()`, `sqlColAddMinutes()`, `sqlDatetimeAddMinutes()`.

### Estilizacao (Tailwind CSS)

- Use classes `brand-*` (sky-blue) para CTAs, links e destaques
- Use classes `neutral-*` para backgrounds, bordas e texto — **nunca** `gray-*` ou `blue-*`
- **Sempre** inclua variantes `dark:` para dark mode
- Cores de prioridade: low (green), medium (yellow), high (orange), critical (red)
- Cores de status: open (blue), in-progress (yellow), resolved (green), closed (neutral)

### Autenticacao e Autorizacao

- Use **sempre** constantes de `lib/auth/roles.ts` (`ROLES.*`) — nunca strings hardcoded de roles
- Use helpers como `isAdmin()`, `isAgent()`, `isPrivileged()`, `canManageTickets()`
- Verificacao de permissoes via `lib/auth/rbac.ts`

---

## Convencoes de Commit

Seguimos o padrao [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>: <descricao curta em ingles>
```

### Tipos

| Tipo | Uso |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correcao de bug |
| `chore` | Tarefas de manutencao (deps, config, build) |
| `docs` | Documentacao |
| `test` | Adicao ou correcao de testes |
| `refactor` | Refatoracao sem mudanca funcional |
| `perf` | Melhoria de performance |
| `style` | Formatacao, espacamento (sem mudanca logica) |

### Exemplos

```
feat: Add bulk update endpoint for tickets
fix: Resolve SLA calculation for business hours
chore: Update dependencies to latest versions
docs: Add API documentation for CMDB module
test: Add integration tests for change approval flow
refactor: Extract ticket validation to shared module
```

### Regras

- Use **ingles** nas mensagens de commit
- Primeira letra minuscula na descricao
- Sem ponto final na descricao
- Limite de 72 caracteres na primeira linha
- Use o corpo do commit para detalhes adicionais quando necessario

---

## Padroes de API Route

Toda rota de API deve seguir este template padrao:

```typescript
import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery } from '@/lib/db/adapter';
import type { SqlParam } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

export async function GET(request: NextRequest) {
  // 1. Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Autenticacao e contexto do tenant
  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  // 3. Logica de negocio com isolamento por organizacao
  const data = await executeQuery(
    'SELECT * FROM tabela WHERE organization_id = ?',
    [context.organizationId]
  );

  // 4. Resposta padronizada
  return apiSuccess(data);
}
```

### Checklist obrigatorio para novas rotas

- [ ] Rate limiting aplicado com `applyRateLimit(request, RATE_LIMITS.*)`
- [ ] Autenticacao com `requireTenantUserContext(request)`
- [ ] Todas as queries filtradas por `organization_id`
- [ ] Respostas via `apiSuccess()` / `apiError()`
- [ ] Validacao de entrada (Zod quando aplicavel)
- [ ] Tratamento de erros com try/catch
- [ ] Para Super Admin: usar `requireSuperAdmin(request)` de `lib/auth/super-admin-guard.ts`
- [ ] Limites de paginacao e arrays aplicados

---

## Padroes de Seguranca

Toda contribuicao deve respeitar rigorosamente estes padroes de seguranca.

### Queries Parametrizadas

**Nunca** concatene valores diretamente em SQL. Use sempre placeholders `?`:

```typescript
// CORRETO
await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);

// ERRADO — vulneravel a SQL injection
await executeQuery(`SELECT * FROM users WHERE id = ${userId}`);
```

### Escape de LIKE

Sempre escape wildcards em buscas LIKE:

```typescript
const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
conditions.push("(name LIKE ? ESCAPE '\\')");
params.push(`%${escaped}%`);
```

### Limite de Paginacao

Sempre aplique um cap no parametro `limit` (maximo 100):

```typescript
const limit = Math.min(
  parseInt(searchParams.get('limit') || '20', 10) || 20,
  100
);
```

### Limite de Arrays

Limite o tamanho de arrays recebidos do cliente:

```typescript
const ids = requestIds.slice(0, 50);
```

### Divisao por Zero

Use `NULLIF` para prevenir divisao por zero em SQL:

```sql
SELECT total / NULLIF(divisor, 0) FROM tabela
```

### Validacao de Datas

Sempre valide datas recebidas do cliente:

```typescript
const date = new Date(input);
if (isNaN(date.getTime())) {
  return apiError('Data invalida', 400);
}
```

### Isolamento de Tenant

**Toda** query deve incluir `WHERE organization_id = ?` com o ID do contexto autenticado. Nunca confie em IDs fornecidos pelo cliente para determinar o tenant.

### Secrets e Credenciais

- Nunca commite arquivos `.env`, credenciais ou chaves de API
- Use variaveis de ambiente para toda configuracao sensivel
- Em logs, nunca exponha tokens, senhas ou dados pessoais

---

## Testes

### Estrutura dos Testes

O projeto possui 79 testes automatizados organizados em:

- **Smoke tests** — Verificam que paginas e endpoints carregam sem erros
- **Tenant isolation tests** — Garantem isolamento entre organizacoes
- **API priority tests** — Validam endpoints criticos e fluxos de autenticacao

### Executando Testes

```bash
npm test
```

### Escrevendo Novos Testes

- Teste o caminho feliz (happy path) e os principais casos de erro
- Para rotas de API, valide: autenticacao, autorizacao, validacao de entrada, isolamento de tenant
- Use dados de teste isolados — nunca dependa de estado compartilhado entre testes
- Limpe dados criados durante a execucao do teste

### O que testar em uma nova feature

1. A rota retorna 401 sem autenticacao
2. A rota retorna 403 sem permissao adequada
3. Os dados sao filtrados por `organization_id` (isolamento)
4. Entradas invalidas retornam 400 com mensagem descritiva
5. O caminho feliz retorna os dados corretos com status 200

---

## Checklist de Code Review

Antes de aprovar um PR, verifique todos os itens aplicaveis:

### Seguranca
- [ ] Queries parametrizadas (sem concatenacao SQL)
- [ ] Isolamento de tenant (`organization_id` em todas as queries)
- [ ] Rate limiting aplicado em todos os endpoints
- [ ] Autenticacao verificada (`requireTenantUserContext`)
- [ ] Escape de LIKE em buscas textuais
- [ ] Cap de paginacao (max 100)
- [ ] Sem secrets, credenciais ou tokens no codigo
- [ ] Validacao de entrada adequada

### Qualidade de Codigo
- [ ] TypeScript compila sem erros (`npm run type-check`)
- [ ] Sem uso de `any` desnecessario
- [ ] Helpers de dialeto SQL utilizados (sem SQL especifico de um banco)
- [ ] Tipos definidos em `lib/types/` para entidades novas
- [ ] Tratamento de erros com try/catch e respostas `apiError`
- [ ] Sem roles hardcoded (usa `ROLES.*` de `lib/auth/roles.ts`)

### Banco de Dados
- [ ] Schema atualizado em **ambos** `schema.sql` e `schema.postgres.sql`
- [ ] Tipos TypeScript adicionados em `lib/types/database.ts`
- [ ] Indices criados para colunas usadas em WHERE/JOIN
- [ ] Foreign keys definidas quando aplicavel
- [ ] Uso do adapter (`executeQuery`, `executeRun`) — nunca acesso direto

### Frontend
- [ ] Dark mode com variantes `dark:` em todos os componentes
- [ ] Classes `brand-*` e `neutral-*` (sem `blue-*` ou `gray-*`)
- [ ] Responsividade (mobile-first)
- [ ] Acessibilidade (labels, ARIA, contraste adequado)

### Documentacao
- [ ] CLAUDE.md atualizado se a arquitetura foi alterada
- [ ] Comentarios em logica complexa
- [ ] CHANGELOG.md atualizado para features e correcoes significativas

---

## Duvidas?

1. Consulte o `CLAUDE.md` para detalhes de arquitetura
2. Verifique issues existentes no repositorio
3. Abra uma issue para discutir mudancas significativas antes de implementar

Obrigado por contribuir com o ServiceDesk!
