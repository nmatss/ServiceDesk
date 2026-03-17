# Documentacao da API — ServiceDesk

> Versao: 1.0 | Atualizado em: 2026-03-16

---

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Autenticacao](#2-autenticacao)
3. [Tickets](#3-tickets)
4. [ITIL — Problem Management](#4-itil--problem-management)
5. [ITIL — Change Management](#5-itil--change-management)
6. [ITIL — CMDB](#6-itil--cmdb)
7. [ITIL — Service Catalog](#7-itil--service-catalog)
8. [ITIL — CAB](#8-itil--cab)
9. [Knowledge Base](#9-knowledge-base)
10. [Workflows](#10-workflows)
11. [AI / Inteligencia Artificial](#11-ai--inteligencia-artificial)
12. [Analytics](#12-analytics)
13. [Notificacoes](#13-notificacoes)
14. [Admin](#14-admin)
15. [Super Admin](#15-super-admin)
16. [Billing (Faturamento)](#16-billing-faturamento)
17. [Health (Monitoramento)](#17-health-monitoramento)
18. [Cron (Interno)](#18-cron-interno)
19. [Outros Endpoints](#19-outros-endpoints)

---

## 1. Visao Geral

### Base URL

```
https://<seu-dominio>/api
```

Em desenvolvimento: `http://localhost:3000/api`

### Autenticacao

Todas as rotas protegidas exigem um **JWT Bearer token** enviado via:

- **Cookie httpOnly** `auth_token` (definido automaticamente no login), ou
- **Header** `Authorization: Bearer <access_token>`

O access token expira em **15 minutos**. Use o endpoint `/api/auth/refresh` para obter um novo par de tokens.

### Formato de Resposta Padrao

**Sucesso:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

**Erro:**
```json
{
  "success": false,
  "error": "Mensagem descritiva do erro"
}
```

### Rate Limiting

Todos os endpoints possuem rate limiting. Os headers de resposta incluem:

| Header | Descricao |
|--------|-----------|
| `X-RateLimit-Limit` | Numero maximo de requisicoes na janela |
| `X-RateLimit-Remaining` | Requisicoes restantes |
| `X-RateLimit-Reset` | Timestamp (epoch) de quando a janela reseta |
| `Retry-After` | Segundos ate poder tentar novamente (quando 429) |

**Tiers de Rate Limit:**

| Tier | Limite | Janela | Endpoints |
|------|--------|--------|-----------|
| `DEFAULT` | 120 req | 1 min | Maioria dos endpoints |
| `AUTH_LOGIN` | 5 req | 15 min | Login |
| `AUTH_REGISTER` | 3 req | 1 hora | Registro |
| `AUTH_FORGOT_PASSWORD` | 3 req | 1 hora | Recuperacao de senha |
| `TICKET_MUTATION` | 30 req | 1 min | Criacao/edicao de tickets |
| `AI_CLASSIFY` | 10 req | 1 min | Classificacao IA |
| `AI_SEMANTIC` | 10 req | 1 min | Busca semantica |
| `SEARCH` | 60 req | 1 min | Buscas gerais |
| `WORKFLOW_EXECUTE` | 20 req | 1 min | Execucao de workflows |
| `ANALYTICS` | 30 req | 1 min | Analytics |
| `ADMIN_MUTATION` | 20 req | 1 min | Operacoes administrativas |
| `BILLING` | 30 req | 15 min | Faturamento |
| `EMAIL_SEND` | 10 req | 1 min | Envio de e-mail |
| `WHATSAPP_SEND` | 10 req | 1 min | Envio WhatsApp |

### Paginacao

Endpoints de listagem aceitam os seguintes query params:

| Parametro | Tipo | Padrao | Descricao |
|-----------|------|--------|-----------|
| `page` | number | 1 | Numero da pagina |
| `limit` | number | 10-20 | Itens por pagina (max 100) |
| `offset` | number | 0 | Deslocamento (alternativo a page) |

Resposta de paginacao:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Multi-tenancy

Todas as queries sao isoladas por `organization_id` (tenant). O tenant e resolvido automaticamente a partir do JWT ou do header/cookie de contexto. Nunca e possivel acessar dados de outro tenant.

### Roles (Papeis)

```
super_admin > admin > tenant_admin > team_manager > agent > user
```

---

## 2. Autenticacao

### Endpoints Principais

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| POST | `/api/auth/login` | Login com email/senha | Nao | AUTH_LOGIN (5/15min) |
| POST | `/api/auth/register` | Registro de novo usuario | Nao | AUTH_REGISTER (3/hora) |
| GET | `/api/auth/verify` | Verificar validade do token | Sim | DEFAULT |
| POST | `/api/auth/refresh` | Renovar access token | Nao* | AUTH_LOGIN |
| POST | `/api/auth/logout` | Encerrar sessao | Sim | DEFAULT |
| GET | `/api/auth/profile` | Perfil do usuario autenticado | Sim | DEFAULT |
| POST | `/api/auth/change-password` | Alterar senha | Sim | DEFAULT |
| GET | `/api/auth/csrf-token` | Obter token CSRF | Nao | DEFAULT |

> *O refresh usa o cookie `refresh_token` (httpOnly).

### MFA (Autenticacao Multi-Fator)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/auth/mfa/setup` | Configurar MFA (gera QR code TOTP) | Sim |
| POST | `/api/auth/mfa/verify` | Verificar codigo MFA | Sim |
| GET | `/api/auth/mfa/status` | Status do MFA do usuario | Sim |
| POST | `/api/auth/mfa/disable` | Desabilitar MFA | Sim |
| POST | `/api/auth/mfa/backup-codes` | Gerar codigos de backup | Sim |

### SSO (Single Sign-On)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/auth/sso/providers` | Listar provedores SSO disponiveis | Nao |
| GET | `/api/auth/sso/[provider]` | Iniciar fluxo OAuth2 | Nao |
| GET | `/api/auth/sso/[provider]/callback` | Callback OAuth2 | Nao |
| POST | `/api/auth/sso/[provider]/logout` | Logout SSO | Sim |

### Gov.br

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/auth/govbr` | Status da integracao Gov.br | Nao |
| GET | `/api/auth/govbr/authorize` | Iniciar autenticacao Gov.br | Nao |
| GET | `/api/auth/govbr/callback` | Callback Gov.br | Nao |
| POST | `/api/auth/govbr/refresh` | Renovar token Gov.br | Sim |

### Exemplo: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@servicedesk.com",
    "password": "123456",
    "tenant_slug": "default"
  }'
```

**Resposta (200):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@servicedesk.com",
    "role": "admin",
    "organization_id": 1,
    "last_login_at": "2026-03-16T10:00:00.000Z"
  },
  "tenant": {
    "id": 1,
    "slug": "default",
    "name": "ServiceDesk"
  }
}
```

Os tokens sao definidos automaticamente nos cookies httpOnly: `auth_token`, `refresh_token`, `device_id`.

**Erro — conta bloqueada (423):**
```json
{
  "success": false,
  "error": "Conta temporariamente bloqueada. Tente novamente em 14 minutos.",
  "locked": true,
  "locked_until": "2026-03-16T10:15:00.000Z"
}
```

### Exemplo: Registro

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@empresa.com",
    "password": "Senh@Forte123!",
    "tenant_slug": "minha-empresa",
    "job_title": "Analista de TI",
    "department": "Tecnologia",
    "phone": "(11) 99999-0000"
  }'
```

**Requisitos de senha:** minimo 12 caracteres, 1 maiuscula, 1 minuscula, 1 numero, 1 caractere especial.

Se `tenant_slug` nao existir, uma nova organizacao e criada automaticamente no plano **starter** (self-service onboarding).

**Resposta (200):**
```json
{
  "success": true,
  "message": "Usuario criado com sucesso",
  "user": {
    "id": 5,
    "name": "Maria Silva",
    "email": "maria@empresa.com",
    "role": "user",
    "organization_id": 2,
    "job_title": "Analista de TI",
    "department": "Tecnologia",
    "phone": "(11) 99999-0000",
    "created_at": "2026-03-16T10:00:00.000Z"
  },
  "tenant": {
    "id": 2,
    "slug": "maria-1abc2def",
    "name": "Maria Silva's Organization"
  }
}
```

---

## 3. Tickets

### CRUD Principal

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/tickets` | Listar tickets (paginado) | Sim | DEFAULT |
| POST | `/api/tickets` | Criar novo ticket | Sim | DEFAULT |
| POST | `/api/tickets/create` | Criar ticket (rota alternativa) | Sim | DEFAULT |
| GET | `/api/tickets/[id]` | Detalhes de um ticket | Sim | TICKET_MUTATION |
| PATCH | `/api/tickets/[id]` | Atualizar ticket | Sim | TICKET_MUTATION |
| GET | `/api/tickets/stats` | Estatisticas de tickets | Sim | DEFAULT |
| GET | `/api/tickets/user/[userId]` | Tickets de um usuario | Sim | DEFAULT |
| PATCH | `/api/tickets/bulk-update` | Atualizacao em lote | Sim (agent+) | TICKET_MUTATION |

> Usuarios com role `user` veem apenas seus proprios tickets. Roles `agent`, `admin` e superiores veem todos os tickets do tenant.

### Sub-recursos do Ticket

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET/POST | `/api/tickets/[id]/comments` | Comentarios do ticket | Sim |
| GET/POST | `/api/tickets/[id]/attachments` | Anexos do ticket | Sim |
| GET/POST/DELETE | `/api/tickets/[id]/tags` | Tags do ticket | Sim |
| GET/POST/DELETE | `/api/tickets/[id]/followers` | Seguidores do ticket | Sim |
| GET/POST | `/api/tickets/[id]/relationships` | Relacionamentos entre tickets | Sim |
| GET | `/api/tickets/[id]/activities` | Historico de atividades | Sim |

### Exemplo: Listar Tickets

```bash
curl http://localhost:3000/api/tickets?page=1&limit=20&status=open \
  -H "Authorization: Bearer <token>"
```

**Query params disponiveis:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `page` | number | Pagina (default: 1) |
| `limit` | number | Itens por pagina (default: 10, max: 100) |
| `status` | string | Filtro por status: `open`, `in-progress`, `resolved`, `closed` ou ID |

**Resposta (200):**
```json
{
  "success": true,
  "tickets": [
    {
      "id": 1,
      "tenant_id": 1,
      "title": "Erro no sistema de email",
      "description": "Nao consigo enviar emails desde ontem...",
      "created_at": "2026-03-15T14:30:00.000Z",
      "updated_at": "2026-03-15T15:00:00.000Z",
      "status": "Novo",
      "status_id": 1,
      "status_color": "#3B82F6",
      "priority": "Alta",
      "priority_id": 3,
      "category": "Email",
      "category_id": 5,
      "user_name": "Maria Silva",
      "user_id": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "pages": 3
  }
}
```

### Exemplo: Criar Ticket

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Impressora nao funciona",
    "description": "A impressora do 3o andar nao liga desde ontem.",
    "category_id": 1,
    "priority_id": 2
  }'
```

**Body (obrigatorio):**

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `title` | string | Sim | Titulo do ticket |
| `description` | string | Sim | Descricao detalhada |
| `category_id` | number | Sim | ID da categoria |
| `priority_id` | number | Sim | ID da prioridade |

**Resposta (200):**
```json
{
  "success": true,
  "ticket": {
    "id": 48,
    "title": "Impressora nao funciona",
    "description": "A impressora do 3o andar nao liga desde ontem.",
    "created_at": "2026-03-16T10:05:00.000Z",
    "status": "Novo",
    "priority": "Media",
    "category": "Hardware",
    "user_name": "Maria Silva"
  }
}
```

> A criacao de tickets respeita o limite do plano de assinatura da organizacao.

### Exemplo: Atualizar Ticket

```bash
curl -X PATCH http://localhost:3000/api/tickets/48 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status_id": 2,
    "priority_id": 3
  }'
```

**Body (todos opcionais):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `title` | string | Novo titulo |
| `description` | string | Nova descricao |
| `status_id` | number | ID do novo status |
| `priority_id` | number | ID da nova prioridade |
| `category_id` | number | ID da nova categoria |

---

## 4. ITIL — Problem Management

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/problems` | Listar problemas (paginado, filtros) | Sim | DEFAULT |
| POST | `/api/problems` | Criar novo problema | Sim (agent+) | DEFAULT |
| GET | `/api/problems/[id]` | Detalhes do problema | Sim | DEFAULT |
| PUT | `/api/problems/[id]` | Atualizar problema | Sim (agent+) | DEFAULT |
| GET | `/api/problems/[id]/activities` | Atividades do problema | Sim | DEFAULT |
| POST | `/api/problems/[id]/activities` | Adicionar atividade | Sim (agent+) | DEFAULT |
| GET | `/api/problems/[id]/incidents` | Incidentes vinculados | Sim | DEFAULT |
| POST | `/api/problems/[id]/incidents` | Vincular incidente | Sim (agent+) | DEFAULT |
| GET | `/api/problems/statistics` | Estatisticas de problemas | Sim | DEFAULT |

**Query params para listagem:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `status` | string | `open`, `under_investigation`, `known_error`, `resolved`, `closed` (multiplos separados por virgula) |
| `impact` | string | `critical`, `high`, `medium`, `low` |
| `source_type` | string | `incident`, `proactive`, `event` |
| `assigned_to` | number | ID do responsavel |
| `search` | string | Busca no titulo/descricao |
| `page` | number | Pagina |
| `limit` | number | Itens por pagina |
| `sort_by` | string | Campo para ordenacao |
| `sort_order` | string | `asc` ou `desc` |

### Known Errors (Erros Conhecidos)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/known-errors` | Listar erros conhecidos | Sim |
| POST | `/api/known-errors` | Criar erro conhecido | Sim (agent+) |
| GET | `/api/known-errors/[id]` | Detalhes do erro conhecido | Sim |
| PUT | `/api/known-errors/[id]` | Atualizar erro conhecido | Sim (agent+) |
| GET | `/api/known-errors/search` | Buscar erros conhecidos | Sim |

---

## 5. ITIL — Change Management

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/changes` | Listar requisicoes de mudanca | Sim | DEFAULT |
| POST | `/api/changes` | Criar requisicao de mudanca | Sim (agent+) | DEFAULT |
| GET | `/api/changes/[id]` | Detalhes da mudanca | Sim | DEFAULT |
| PUT | `/api/changes/[id]` | Atualizar mudanca | Sim (agent+) | DEFAULT |
| POST | `/api/changes/[id]/approve` | Aprovar/rejeitar mudanca | Sim (admin+) | DEFAULT |

**Body para criacao (POST):**

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `title` | string | Sim | Titulo da mudanca |
| `description` | string | Sim | Descricao detalhada |
| `change_type_id` | number | Sim | ID do tipo de mudanca |
| `category` | string | Nao | `standard`, `normal`, `emergency` (default: `normal`) |
| `priority` | string | Nao | `critical`, `high`, `medium`, `low` (default: `medium`) |
| `risk_level` | string | Nao | `low`, `medium`, `high`, `critical` (default: `medium`) |
| `risk_assessment` | string | Nao | Avaliacao de risco |
| `impact_assessment` | string | Nao | Avaliacao de impacto |
| `implementation_plan` | string | Nao | Plano de implementacao |
| `backout_plan` | string | Nao | Plano de rollback |
| `test_plan` | string | Nao | Plano de testes |
| `requested_start_date` | string | Nao | Data de inicio desejada (ISO 8601) |
| `requested_end_date` | string | Nao | Data de fim desejada (ISO 8601) |

**Query params para listagem:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `status` | string | `draft`, `submitted`, `under_review`, `scheduled`, `in_progress`, `completed`, `failed`, `cancelled`, `rolled_back` |
| `category` | string | `standard`, `normal`, `emergency` |
| `priority` | string | `critical`, `high`, `medium`, `low` |
| `requester_id` | number | ID do solicitante |
| `owner_id` | number | ID do responsavel |
| `my_changes` | boolean | Apenas minhas mudancas |
| `page` | number | Pagina |
| `limit` | number | Itens por pagina (max: 100) |

---

## 6. ITIL — CMDB

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/cmdb` | Listar Configuration Items (CIs) | Sim | DEFAULT |
| POST | `/api/cmdb` | Criar novo CI | Sim (agent+) | DEFAULT |
| GET | `/api/cmdb/[id]` | Detalhes de um CI | Sim | DEFAULT |
| PUT | `/api/cmdb/[id]` | Atualizar CI | Sim (agent+) | DEFAULT |
| DELETE | `/api/cmdb/[id]` | Remover CI | Sim (admin+) | DEFAULT |
| GET | `/api/cmdb/[id]/relationships` | Relacionamentos do CI | Sim | DEFAULT |
| POST | `/api/cmdb/[id]/relationships` | Criar relacionamento | Sim (agent+) | DEFAULT |
| GET | `/api/cmdb/[id]/history` | Historico de alteracoes do CI | Sim | DEFAULT |
| GET | `/api/cmdb/[id]/impact-analysis` | Analise de impacto | Sim | DEFAULT |
| GET | `/api/cmdb/types` | Listar tipos de CI | Sim | DEFAULT |
| GET | `/api/cmdb/statuses` | Listar status de CI | Sim | DEFAULT |

**Body para criacao (POST):**

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `name` | string | Sim | Nome do CI |
| `description` | string | Nao | Descricao |
| `ci_type_id` | number | Sim | Tipo do CI |
| `status_id` | number | Nao | Status (default: 1) |
| `environment` | string | Nao | `production`, `staging`, `development`, `test`, `dr` |
| `criticality` | string | Nao | `critical`, `high`, `medium`, `low` (default: `medium`) |
| `serial_number` | string | Nao | Numero de serie |
| `asset_tag` | string | Nao | Tag do ativo |
| `ip_address` | string | Nao | Endereco IP |
| `hostname` | string | Nao | Hostname |
| `os_version` | string | Nao | Versao do SO |
| `vendor` | string | Nao | Fornecedor |
| `location` | string | Nao | Localizacao |
| `purchase_date` | string | Nao | Data de compra (ISO 8601) |
| `warranty_expiry` | string | Nao | Fim da garantia (ISO 8601) |
| `custom_attributes` | object | Nao | Atributos customizados (chave-valor) |

**Query params para listagem:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `search` | string | Busca no nome/hostname/IP/serial |
| `ci_type_id` | number | Filtro por tipo |
| `status_id` | number | Filtro por status |
| `environment` | string | Filtro por ambiente |
| `criticality` | string | Filtro por criticidade |
| `page` | number | Pagina |
| `limit` | number | Itens por pagina (max: 100) |

---

## 7. ITIL — Service Catalog

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/catalog` | Listar itens do catalogo de servicos | Sim | DEFAULT |
| POST | `/api/catalog` | Criar item no catalogo | Sim (admin+) | DEFAULT |
| GET | `/api/catalog/requests` | Listar requisicoes de servico | Sim | DEFAULT |
| POST | `/api/catalog/requests` | Abrir requisicao de servico | Sim | DEFAULT |
| GET | `/api/catalog/requests/[id]` | Detalhes da requisicao | Sim | DEFAULT |
| PUT | `/api/catalog/requests/[id]` | Atualizar requisicao | Sim (agent+) | DEFAULT |
| POST | `/api/catalog/requests/[id]/approve` | Aprovar/rejeitar requisicao | Sim (admin+) | DEFAULT |

---

## 8. ITIL — CAB (Change Advisory Board)

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/cab` | Listar reunioes CAB | Sim | DEFAULT |
| POST | `/api/cab` | Criar reuniao CAB | Sim (admin+) | DEFAULT |
| GET | `/api/cab/[id]` | Detalhes da reuniao | Sim | DEFAULT |
| PUT | `/api/cab/[id]` | Atualizar reuniao | Sim (admin+) | DEFAULT |
| POST | `/api/cab/[id]/vote` | Votar em mudanca na reuniao | Sim (agent+) | DEFAULT |
| POST | `/api/cab/[id]/schedule` | Agendar reuniao CAB | Sim (admin+) | DEFAULT |

---

## 9. Knowledge Base

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/knowledge` | Listar artigos | Sim | DEFAULT |
| POST | `/api/knowledge` | Criar artigo | Sim (agent+) | DEFAULT |
| GET | `/api/knowledge/[id]` | Detalhes do artigo | Sim | DEFAULT |
| PUT | `/api/knowledge/[id]` | Atualizar artigo | Sim (agent+) | DEFAULT |
| GET | `/api/knowledge/[id]/related` | Artigos relacionados | Sim | DEFAULT |
| POST | `/api/knowledge/[id]/feedback` | Enviar feedback (util/nao util) | Sim | DEFAULT |
| GET | `/api/knowledge/[id]/analyze` | Analise do artigo | Sim (agent+) | DEFAULT |
| POST | `/api/knowledge/[id]/review` | Revisar artigo | Sim (admin+) | DEFAULT |
| GET | `/api/knowledge/categories` | Listar categorias KB | Sim | DEFAULT |
| GET | `/api/knowledge/search` | Buscar artigos | Sim | KNOWLEDGE_SEARCH |
| GET | `/api/knowledge/search/autocomplete` | Autocomplete de busca | Sim | KNOWLEDGE_SEARCH |
| GET | `/api/knowledge/search/popular` | Buscas populares | Sim | DEFAULT |
| GET | `/api/knowledge/semantic-search` | Busca semantica (IA) | Sim | AI_SEMANTIC |
| GET | `/api/knowledge/gaps` | Lacunas na base de conhecimento | Sim (agent+) | DEFAULT |
| POST | `/api/knowledge/generate` | Gerar artigo com IA | Sim (agent+) | AI_CLASSIFY |

### Artigos Publicos (Portal)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/knowledge/articles` | Listar artigos publicados | Sim |
| GET | `/api/knowledge/articles/[slug]` | Artigo por slug | Sim |
| POST | `/api/knowledge/articles/[slug]/feedback` | Feedback no artigo | Sim |

**Query params para busca:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `search` | string | Termo de busca (titulo, conteudo, resumo) |
| `category` | string | Nome da categoria |
| `status` | string | `draft`, `published`, `archived` (admin ve todos) |
| `limit` | number | Itens por pagina (max: 100) |
| `offset` | number | Deslocamento |

---

## 10. Workflows

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/workflows/definitions` | Listar definicoes de workflow | Sim (admin+) | DEFAULT |
| POST | `/api/workflows/definitions` | Criar definicao de workflow | Sim (admin+) | WORKFLOW_MUTATION |
| GET | `/api/workflows/definitions/[id]` | Detalhes da definicao | Sim (admin+) | DEFAULT |
| PUT | `/api/workflows/definitions/[id]` | Atualizar definicao | Sim (admin+) | WORKFLOW_MUTATION |
| DELETE | `/api/workflows/definitions/[id]` | Excluir definicao | Sim (admin+) | WORKFLOW_MUTATION |
| POST | `/api/workflows/execute` | Executar workflow manualmente | Sim (admin+) | WORKFLOW_EXECUTE |
| GET | `/api/workflows/executions/[id]` | Status de execucao | Sim (admin+) | DEFAULT |

**Tipos de trigger para workflow:**

`ticket_created`, `ticket_updated`, `status_changed`, `sla_warning`, `time_based`, `manual`, `comment_added`, `assignment_changed`, `priority_changed`, `category_changed`, `webhook`, `api_call`, `user_action`

---

## 11. AI / Inteligencia Artificial

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| POST | `/api/ai/classify-ticket` | Classificar ticket automaticamente | Sim | AI_CLASSIFY (10/min) |
| POST | `/api/ai/analyze-sentiment` | Analise de sentimento | Sim | AI_CLASSIFY |
| POST | `/api/ai/detect-duplicates` | Detectar tickets duplicados | Sim | AI_CLASSIFY |
| POST | `/api/ai/generate-response` | Gerar resposta sugerida | Sim (agent+) | AI_SUGGEST |
| POST | `/api/ai/suggest-solutions` | Sugerir solucoes | Sim | AI_SUGGEST |
| POST | `/api/ai/train` | Treinar modelo com novos dados | Sim (admin+) | AI_CLASSIFY |
| POST | `/api/ai/feedback` | Feedback sobre sugestao da IA | Sim | DEFAULT |
| GET | `/api/ai/metrics` | Metricas de performance da IA | Sim (admin+) | ANALYTICS |
| GET | `/api/ai/models` | Listar modelos disponiveis | Sim (admin+) | DEFAULT |

### AI Copilot

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/ai/copilot` | Copilot — assistente do agente | Sim (agent+) |
| GET | `/api/ai/copilot/summary` | Resumo de ticket com IA | Sim (agent+) |

### AI Agent (Autonomo)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/ai/agent/resolve` | Tentar resolver ticket automaticamente | Sim |
| GET | `/api/ai/agent/stats` | Estatisticas do agente IA | Sim (admin+) |
| GET/PUT | `/api/ai/agent/config` | Configuracao do agente IA | Sim (admin+) |

### AI Conversation (Chat)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/ai/conversation` | Listar conversas | Sim |
| POST | `/api/ai/conversation` | Iniciar conversa | Sim |
| GET | `/api/ai/conversation/[id]` | Detalhes da conversa | Sim |
| GET | `/api/ai/conversation/stats` | Estatisticas de conversas | Sim (admin+) |

**Exemplo: Classificar ticket**

```bash
curl -X POST http://localhost:3000/api/ai/classify-ticket \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nao consigo acessar o VPN",
    "description": "Desde ontem meu VPN da erro de autenticacao ao conectar."
  }'
```

---

## 12. Analytics

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/analytics` | Dados gerais de analytics | Sim | ANALYTICS |
| GET | `/api/analytics/overview` | Visao geral do dashboard | Sim | ANALYTICS |
| GET | `/api/analytics/detailed` | Metricas detalhadas | Sim | ANALYTICS |
| GET | `/api/analytics/realtime` | Metricas em tempo real | Sim | ANALYTICS |
| GET | `/api/analytics/cobit` | Metricas COBIT | Sim (admin+) | ANALYTICS |
| GET | `/api/analytics/knowledge` | Analytics da base de conhecimento | Sim | ANALYTICS |
| POST | `/api/analytics/web-vitals` | Registrar Web Vitals | Sim | DEFAULT |

---

## 13. Notificacoes

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/notifications` | Listar notificacoes do usuario | Sim | DEFAULT |
| PUT | `/api/notifications` | Marcar notificacoes como lidas | Sim | DEFAULT |
| GET | `/api/notifications/unread` | Contagem de nao lidas | Sim | DEFAULT |
| GET | `/api/notifications/sse` | Server-Sent Events (tempo real) | Sim | DEFAULT |

**Query params:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `unread_only` | boolean | Filtrar apenas nao lidas |
| `limit` | number | Itens por pagina (default: 50, max: 100) |
| `offset` | number | Deslocamento |

### Push Notifications (PWA)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/push/subscribe` | Inscrever-se em push | Sim |
| POST | `/api/push/unsubscribe` | Cancelar inscricao | Sim |
| POST | `/api/push/send` | Enviar push notification | Sim (admin+) |
| GET | `/api/pwa/vapid-key` | Obter chave VAPID publica | Sim |
| POST | `/api/pwa/subscribe` | Inscrever-se (PWA) | Sim |
| GET | `/api/pwa/status` | Status do PWA | Sim |
| POST | `/api/pwa/sync` | Sincronizar dados offline | Sim |

---

## 14. Admin

### Gestao de Usuarios

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/admin/users` | Listar usuarios do tenant | Sim (admin+) | ADMIN_USER |
| POST | `/api/admin/users` | Criar usuario | Sim (admin+) | ADMIN_USER |
| GET | `/api/admin/users/[id]` | Detalhes do usuario | Sim (admin+) | ADMIN_USER |
| PUT | `/api/admin/users/[id]` | Atualizar usuario | Sim (admin+) | ADMIN_USER |
| DELETE | `/api/admin/users/[id]` | Desativar usuario | Sim (admin+) | ADMIN_USER |

### Gestao de Tickets (Admin)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/tickets` | Listar todos os tickets (admin) | Sim (admin+) |
| GET | `/api/admin/tickets/[id]` | Detalhes do ticket (admin) | Sim (admin+) |
| PUT | `/api/admin/tickets/[id]` | Atualizar ticket (admin) | Sim (admin+) |

### Configuracoes e Outros

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/stats` | Estatisticas do dashboard admin | Sim (admin+) |
| GET/PUT | `/api/admin/settings` | Configuracoes do tenant | Sim (admin+) |
| GET | `/api/admin/reports` | Relatorios | Sim (admin+) |
| GET | `/api/admin/audit` | Logs de auditoria | Sim (admin+) |
| GET | `/api/admin/cache` | Estatisticas de cache | Sim (admin+) |
| GET/POST | `/api/admin/automations` | Regras de automacao | Sim (admin+) |
| GET/POST | `/api/admin/templates` | Templates de ticket | Sim (admin+) |
| GET | `/api/admin/sla` | Listar politicas SLA | Sim (admin+) |
| POST | `/api/admin/sla` | Criar politica SLA | Sim (admin+) |
| GET/PUT/DELETE | `/api/admin/sla/[id]` | Gerenciar politica SLA | Sim (admin+) |

### Governanca

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/governance/access` | Controle de acesso | Sim (admin+) |
| GET | `/api/admin/governance/audit` | Logs de governanca | Sim (admin+) |
| GET | `/api/admin/governance/compliance` | Status de conformidade | Sim (admin+) |
| GET | `/api/admin/governance/data` | Governanca de dados | Sim (admin+) |

---

## 15. Super Admin

> Acesso restrito a usuarios da **organizacao 1** ou com role `super_admin`.

### Dashboard

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/super/dashboard` | Dashboard cross-tenant | Sim (super_admin) |
| GET | `/api/admin/super/stats` | Estatisticas globais | Sim (super_admin) |

### Organizacoes

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/super/organizations` | Listar organizacoes | Sim (super_admin) |
| POST | `/api/admin/super/organizations` | Criar organizacao | Sim (super_admin) |
| GET | `/api/admin/super/organizations/[id]` | Detalhes da organizacao | Sim (super_admin) |
| PUT | `/api/admin/super/organizations/[id]` | Atualizar organizacao | Sim (super_admin) |
| DELETE | `/api/admin/super/organizations/[id]` | Excluir organizacao (soft delete) | Sim (super_admin) |
| POST | `/api/admin/super/organizations/[id]/suspend` | Suspender/reativar organizacao | Sim (super_admin) |
| GET | `/api/admin/super/organizations/[id]/stats` | Metricas da organizacao | Sim (super_admin) |
| GET | `/api/admin/super/organizations/[id]/users` | Usuarios da organizacao | Sim (super_admin) |

### Usuarios (Cross-Tenant)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/super/users` | Listar usuarios de todos os tenants | Sim (super_admin) |
| GET | `/api/admin/super/users/[id]` | Detalhes do usuario | Sim (super_admin) |
| PUT | `/api/admin/super/users/[id]` | Acoes admin (resetar senha, mudar role, desativar) | Sim (super_admin) |

### Outros Super Admin

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/admin/super/audit` | Logs de auditoria cross-tenant | Sim (super_admin) |
| GET/PUT | `/api/admin/super/settings` | Configuracoes globais do sistema | Sim (super_admin) |
| GET | `/api/admin/super/tenants` | Listar tenants | Sim (super_admin) |

---

## 16. Billing (Faturamento)

Integracao com **Stripe** para gestao de assinaturas.

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| POST | `/api/billing/checkout` | Criar sessao de checkout Stripe | Sim (admin+) | BILLING |
| GET | `/api/billing/status` | Status da assinatura | Sim | BILLING |
| POST | `/api/billing/portal` | Criar sessao do portal Stripe | Sim (admin+) | BILLING |
| POST | `/api/billing/webhook` | Webhook do Stripe | Nao* | WEBHOOK |

> *O webhook do Stripe e autenticado via assinatura do evento Stripe, nao via JWT.

**Body para checkout (POST):**

```json
{
  "priceId": "price_1234567890"
}
```

**Planos disponiveis:**

| Plano | Preco | Usuarios | Tickets/mes |
|-------|-------|----------|-------------|
| Starter | Gratis | 3 | 100 |
| Professional | R$ 109/mes | 15 | 1.000 |
| Enterprise | R$ 179/mes | Ilimitado | Ilimitado |

---

## 17. Health (Monitoramento)

Endpoints sem autenticacao, usados por probes Kubernetes e monitoramento.

| Metodo | Endpoint | Descricao | HTTP 200 | HTTP 503 |
|--------|----------|-----------|----------|----------|
| GET | `/api/health` | Health check completo (DB, Redis, Observabilidade) | Saudavel | Falha |
| GET | `/api/health/live` | Liveness probe — processo esta vivo | Sempre | — |
| GET | `/api/health/ready` | Readiness probe — pronto para trafego | DB OK | DB falhou |
| GET | `/api/health/startup` | Startup probe — inicializacao completa | Pronto | Iniciando |

**Resposta de `/api/health` (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-16T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": { "status": "ok", "message": "Connected" },
    "redis": { "status": "ok", "message": "Connected" },
    "observability": { "status": "healthy" }
  }
}
```

---

## 18. Cron (Interno)

Endpoints executados por agendadores (Vercel Cron, Kubernetes CronJob). Autenticacao via header `Authorization: Bearer <CRON_SECRET>`.

| Metodo | Endpoint | Descricao | Frequencia Sugerida |
|--------|----------|-----------|---------------------|
| GET | `/api/cron/cleanup` | Limpar tokens expirados, sessoes, cache | Diario |
| GET | `/api/cron/lgpd-retention` | Aplicar politica de retencao LGPD | Diario |
| GET | `/api/cron/process-emails` | Processar fila de emails | A cada 5 min |

**Exemplo:**
```bash
curl http://localhost:3000/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 19. Outros Endpoints

### Recursos Auxiliares

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/categories` | Listar categorias | Sim |
| GET/PUT/DELETE | `/api/categories/[id]` | Gerenciar categoria | Sim (admin+) |
| GET | `/api/priorities` | Listar prioridades | Sim |
| GET | `/api/statuses` | Listar status | Sim |
| GET | `/api/tags` | Listar tags | Sim |
| POST | `/api/tags` | Criar tag | Sim |
| GET/PUT/DELETE | `/api/tags/[id]` | Gerenciar tag | Sim |
| GET | `/api/agents` | Listar agentes disponiveis | Sim |
| GET | `/api/agent/stats` | Estatisticas do agente | Sim |
| GET | `/api/ticket-types` | Listar tipos de ticket | Sim |
| GET/PUT/DELETE | `/api/ticket-types/[id]` | Gerenciar tipo de ticket | Sim (admin+) |

### Equipes

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/teams` | Listar equipes | Sim |
| POST | `/api/teams` | Criar equipe | Sim (admin+) |
| GET/PUT/DELETE | `/api/teams/[id]` | Gerenciar equipe | Sim (admin+) |
| GET/POST | `/api/teams/[id]/members` | Membros da equipe | Sim |
| DELETE | `/api/teams/[id]/members/[userId]` | Remover membro | Sim (admin+) |

### Comentarios e Anexos (Standalone)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/comments` | Criar comentario | Sim |
| GET/POST | `/api/attachments` | Listar/upload de anexos | Sim |
| GET/DELETE | `/api/attachments/[id]` | Gerenciar anexo | Sim |

### Arquivos

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/files/upload` | Upload de arquivo | Sim |
| GET | `/api/files/[...path]` | Servir arquivo | Sim |

### Templates e Macros

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/templates/apply` | Aplicar template a ticket | Sim |
| GET | `/api/macros` | Listar macros | Sim |
| POST | `/api/macros` | Criar macro | Sim (agent+) |
| GET/PUT/DELETE | `/api/macros/[id]` | Gerenciar macro | Sim |
| POST | `/api/macros/[id]/apply` | Aplicar macro ao ticket | Sim (agent+) |

### Busca Global

| Metodo | Endpoint | Descricao | Auth | Rate Limit |
|--------|----------|-----------|------|------------|
| GET | `/api/search` | Busca global (tickets, KB, CIs) | Sim | SEARCH |
| GET | `/api/search/semantic` | Busca semantica | Sim | AI_SEMANTIC |
| GET | `/api/search/suggest` | Sugestoes de busca | Sim | SEARCH |
| GET | `/api/search/suggestions` | Auto-completar busca | Sim | SEARCH |

### SLA

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/sla` | Listar politicas SLA | Sim |
| GET | `/api/sla/tickets` | Tickets com dados SLA | Sim |

### Privacidade (LGPD)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET/POST | `/api/privacy/consent` | Gerenciar consentimentos | Sim |
| GET/PUT | `/api/privacy/consent/[id]` | Consentimento especifico | Sim |
| POST | `/api/privacy/data-export` | Exportar dados pessoais | Sim |
| POST | `/api/privacy/data-erasure` | Solicitar exclusao de dados | Sim |

### Integracoes

#### Email

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/integrations/email/send` | Enviar email | Sim |
| GET/POST | `/api/integrations/email/templates` | Templates de email | Sim (admin+) |
| GET/PUT/DELETE | `/api/integrations/email/templates/[id]` | Gerenciar template | Sim (admin+) |
| POST | `/api/integrations/email/webhook` | Webhook de entrada de email | Nao* |
| POST | `/api/email/send` | Enviar email (rota simplificada) | Sim |
| GET | `/api/email/queue` | Fila de emails | Sim (admin+) |

#### WhatsApp

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/integrations/whatsapp/send` | Enviar mensagem | Sim |
| GET | `/api/integrations/whatsapp/messages` | Listar mensagens | Sim |
| GET | `/api/integrations/whatsapp/contacts` | Listar contatos | Sim |
| GET | `/api/integrations/whatsapp/stats` | Estatisticas | Sim |
| GET/POST | `/api/integrations/whatsapp/templates` | Templates | Sim (admin+) |
| POST | `/api/integrations/whatsapp/templates/register` | Registrar template | Sim (admin+) |
| POST | `/api/integrations/whatsapp/test` | Testar conexao | Sim (admin+) |
| POST | `/api/integrations/whatsapp/webhook` | Webhook de entrada | Nao* |

#### Outros

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/integrations/banking` | Integracao bancaria | Sim (admin+) |

### Self-Healing

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/self-healing/history` | Historico de auto-correcoes | Sim (admin+) |
| GET/POST | `/api/self-healing/runbooks` | Runbooks de auto-correcao | Sim (admin+) |
| GET/PUT/DELETE | `/api/self-healing/runbooks/[id]` | Gerenciar runbook | Sim (admin+) |
| POST | `/api/self-healing/webhooks` | Webhook de alerta | Nao* |

### ESM (Enterprise Service Management)

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/esm/submit` | Submeter requisicao ESM | Sim |
| GET/POST | `/api/esm/templates` | Templates ESM | Sim |
| GET/PUT/DELETE | `/api/esm/templates/[id]` | Gerenciar template ESM | Sim (admin+) |
| GET/POST | `/api/esm/workspaces` | Workspaces ESM | Sim |
| GET/PUT/DELETE | `/api/esm/workspaces/[id]` | Gerenciar workspace ESM | Sim (admin+) |

### Dashboard Customizado

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/dashboard` | Dashboard principal | Sim |
| GET | `/api/dashboard/list` | Listar dashboards customizados | Sim |
| POST | `/api/dashboard/create` | Criar dashboard customizado | Sim |
| GET/PUT/DELETE | `/api/dashboard/[id]` | Gerenciar dashboard | Sim |
| GET | `/api/dashboard/metrics/stream` | Stream de metricas (SSE) | Sim |

### Portal do Usuario

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/portal/tickets` | Tickets do usuario (visao portal) | Sim |
| POST | `/api/portal/tickets` | Criar ticket pelo portal | Sim |
| GET | `/api/portal/tickets/[id]` | Detalhes do ticket (portal) | Sim |

### Gamificacao

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/gamification` | Dados de gamificacao do usuario | Sim |

### Onboarding SaaS

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/saas/onboarding` | Criar organizacao via onboarding | Nao |

### Embeddings

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| POST | `/api/embeddings/generate` | Gerar embeddings vetoriais | Sim (admin+) |

### Monitoramento e Metricas

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/metrics` | Metricas Prometheus | Nao* |
| GET | `/api/performance/metrics` | Metricas de performance | Sim (admin+) |
| GET | `/api/monitoring/status` | Status de monitoramento | Sim (admin+) |
| GET | `/api/cache/stats` | Estatisticas de cache | Sim (admin+) |
| GET | `/api/db-stats` | Estatisticas do banco de dados | Sim (admin+) |
| GET | `/api/audit/logs` | Logs de auditoria | Sim (admin+) |

### Documentacao da API

| Metodo | Endpoint | Descricao | Auth |
|--------|----------|-----------|------|
| GET | `/api/docs` | Documentacao interativa (Swagger UI) | Nao |
| GET | `/api/docs/openapi.yaml` | Especificacao OpenAPI | Nao |

---

## Codigos de Status HTTP

| Codigo | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisicao invalida (dados faltando ou incorretos) |
| 401 | Nao autenticado (token ausente ou invalido) |
| 403 | Acesso negado (sem permissao ou limite de plano atingido) |
| 404 | Recurso nao encontrado |
| 409 | Conflito (ex: email ja em uso) |
| 423 | Conta bloqueada (muitas tentativas de login) |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |
| 503 | Servico indisponivel (health check falhou) |

---

## Seguranca

- **JWT HS256** com access token (15 min) + refresh token (7 dias)
- **Cookies httpOnly** com flag `Secure` em producao e `SameSite=Lax`
- **bcryptjs 12 rounds** para hashing de senhas
- **CSRF Double Submit Cookie** com HMAC-SHA256
- **MFA**: TOTP, SMS, Email, Backup codes
- **Rate limiting** por IP + usuario em todos os endpoints
- **Queries parametrizadas** contra SQL injection
- **Sanitizacao XSS** com isomorphic-dompurify
- **Isolamento de tenant** em todas as queries (organization_id)
- **Lockout** apos 5 tentativas de login falhadas (15 min)
- **Protecao contra timing attack** no login (bcrypt executado mesmo quando usuario nao existe)
