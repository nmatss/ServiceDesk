# Documentacao do Banco de Dados - ServiceDesk

## Indice

1. [Arquitetura](#1-arquitetura)
2. [Esquema - 119 Tabelas](#2-esquema---119-tabelas)
3. [Adapter Pattern](#3-adapter-pattern)
4. [Dialect Helpers](#4-dialect-helpers)
5. [Migrations](#5-migrations)
6. [Indexes](#6-indexes)
7. [Multi-Tenancy](#7-multi-tenancy)
8. [Estatisticas](#8-estatisticas)
9. [Backup e Restore](#9-backup-e-restore)

---

## 1. Arquitetura

O ServiceDesk utiliza um **padrao dual-database** que suporta dois bancos de dados por meio de uma camada de abstracao (adapter):

| Ambiente | Banco | Biblioteca | Arquivo de Conexao |
|---|---|---|---|
| Desenvolvimento | SQLite | `better-sqlite3` | `lib/db/connection.ts` |
| Producao | PostgreSQL (Supabase) | `pg` (Pool) | `lib/db/connection.postgres.ts` |

### Como o banco e selecionado

A funcao `getDatabaseType()` em `lib/db/config.ts` determina qual banco usar, seguindo esta prioridade:

1. **`DB_TYPE`** definido explicitamente como `postgresql` ou `sqlite`
2. **`DATABASE_URL`** — se comeca com `postgres://` ou `postgresql://`, usa PostgreSQL
3. **Padrao** — SQLite (desenvolvimento local)

```
DB_TYPE=postgresql  +  DATABASE_URL=postgres://...  →  PostgreSQL
DB_TYPE=sqlite                                       →  SQLite
(nenhum definido)                                    →  SQLite
```

### Arquivos principais

| Arquivo | Descricao |
|---|---|
| `lib/db/config.ts` | Selecao do tipo de banco (`getDatabaseType()`) e configuracoes de pool/pragmas |
| `lib/db/adapter.ts` | Interface unificada — adapters SQLite e PostgreSQL, helpers de dialeto SQL |
| `lib/db/schema.sql` | Schema SQLite (~3.400 linhas, 119 tabelas) |
| `lib/db/schema.postgres.sql` | Schema PostgreSQL (~2.720 linhas, paridade completa) |
| `lib/db/queries.ts` | Funcoes de query tipadas para operacoes comuns |
| `lib/db/queries/` | Modulos de query ITIL (problem, change, cmdb, catalog, cab) |
| `lib/db/init.ts` | Inicializacao e seed SQLite |
| `lib/db/seed.postgres.sql` | Seed data para PostgreSQL |
| `lib/types/database.ts` | Interfaces TypeScript para todas as entidades |
| `lib/db/migrations/` | Arquivos de migracao incremental |

### Configuracoes do PostgreSQL (Producao)

```typescript
{
  pool: { max: 20, min: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 },
  statement_timeout: 30000,     // 30s
  lock_timeout: 10000,          // 10s
  idle_in_transaction_session_timeout: 60000  // 60s
}
```

### Configuracoes do SQLite (Desenvolvimento)

```typescript
{
  path: './data/servicedesk.db',
  pragmas: {
    foreign_keys: 'ON',
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    cache_size: 1000,
    temp_store: 'MEMORY'
  }
}
```

---

## 2. Esquema - 119 Tabelas

### Core Tickets (12 tabelas)

| Tabela | Descricao |
|---|---|
| `tickets` | Chamados (entidade principal do sistema) |
| `comments` | Comentarios em chamados (publicos e internos) |
| `attachments` | Anexos vinculados a chamados |
| `categories` | Categorias para classificacao de chamados |
| `priorities` | Niveis de prioridade (baixa, media, alta, critica) |
| `statuses` | Status do ciclo de vida do chamado |
| `tags` | Tags para rotulagem flexivel |
| `ticket_tags` | Relacao N:N entre chamados e tags |
| `ticket_followers` | Usuarios que acompanham um chamado |
| `ticket_relationships` | Vinculos entre chamados (duplicado, relacionado, bloqueado) |
| `ticket_activities` | Historico de atividades/alteracoes em chamados |
| `file_storage` | Armazenamento de arquivos com metadados |

### Auth e Security (15 tabelas)

| Tabela | Descricao |
|---|---|
| `users` | Usuarios do sistema (agentes, admins, clientes) |
| `refresh_tokens` | Tokens de refresh para renovacao JWT |
| `permissions` | Permissoes granulares do sistema (29 permissoes) |
| `roles` | Papeis de acesso (6 niveis: super_admin ate user) |
| `role_permissions` | Relacao N:N entre papeis e permissoes |
| `user_roles` | Atribuicao de papeis a usuarios |
| `password_policies` | Regras de politica de senha por organizacao |
| `password_history` | Historico de senhas para impedir reutilizacao |
| `rate_limits` | Controle de limites de requisicao por endpoint |
| `sso_providers` | Provedores SSO configurados (OAuth2, SAML) |
| `login_attempts` | Registro de tentativas de login (auditoria) |
| `webauthn_credentials` | Credenciais biometricas WebAuthn/FIDO2 |
| `verification_codes` | Codigos de verificacao (email, SMS, MFA) |
| `auth_audit_logs` | Logs de auditoria de autenticacao |
| `ticket_access_tokens` | Tokens de acesso temporario a chamados |

### SLA e Escalation (5 tabelas)

| Tabela | Descricao |
|---|---|
| `sla_policies` | Politicas de SLA com tempos de resposta e resolucao |
| `sla_tracking` | Rastreamento em tempo real do cumprimento de SLA |
| `escalations` | Definicoes de regras de escalonamento |
| `escalation_rules` | Criterios e condicoes para escalonamento automatico |
| `escalation_instances` | Instancias de escalonamento ativas/concluidas |

### Notifications (5 tabelas)

| Tabela | Descricao |
|---|---|
| `notifications` | Notificacoes enviadas aos usuarios |
| `notification_events` | Eventos que disparam notificacoes |
| `notification_batches` | Agrupamento de notificacoes para envio em lote |
| `batch_configurations` | Configuracoes de envio em lote por canal |
| `filter_rules` | Regras de filtragem para notificacoes |

### Workflows (10 tabelas)

| Tabela | Descricao |
|---|---|
| `automations` | Regras de automacao (gatilhos e acoes) |
| `workflow_definitions` | Definicoes de fluxo de trabalho (template) |
| `workflows` | Instancias de workflow em execucao |
| `workflow_steps` | Passos individuais de um workflow |
| `workflow_executions` | Historico de execucoes de workflow |
| `workflow_step_executions` | Historico de execucao de cada passo |
| `workflow_approvals` | Aprovacoes pendentes dentro de workflows |
| `approvals` | Solicitacoes de aprovacao genericas |
| `approval_history` | Historico de decisoes de aprovacao |
| `approval_tokens` | Tokens para aprovacao via link (armazenados no banco) |

### Knowledge Base (8 tabelas)

| Tabela | Descricao |
|---|---|
| `knowledge_articles` | Artigos da base de conhecimento (legado) |
| `kb_categories` | Categorias hierarquicas de artigos |
| `kb_articles` | Artigos da base de conhecimento (versao atual) |
| `kb_tags` | Tags especificas para artigos KB |
| `kb_article_tags` | Relacao N:N entre artigos e tags |
| `kb_article_feedback` | Avaliacoes e feedback dos usuarios |
| `kb_article_attachments` | Anexos vinculados a artigos |
| `kb_article_suggestions` | Sugestoes de artigos geradas por IA |

### Analytics (6 tabelas)

| Tabela | Descricao |
|---|---|
| `analytics_daily_metrics` | Metricas agregadas diarias (chamados, SLA, tempo) |
| `analytics_agent_metrics` | Metricas de desempenho por agente |
| `analytics_category_metrics` | Metricas agregadas por categoria |
| `analytics_realtime_metrics` | Metricas em tempo real (dashboard) |
| `analytics_events` | Eventos de analytics para rastreamento |
| `analytics_agent_performance` | Desempenho historico de agentes |

### Multi-Tenancy (6 tabelas)

| Tabela | Descricao |
|---|---|
| `organizations` | Organizacoes/tenants do sistema |
| `tenants` | Configuracao de tenant (dominio, plano) |
| `tenant_configurations` | Configuracoes especificas por tenant |
| `teams` | Equipes dentro de uma organizacao |
| `departments` | Departamentos dentro de uma organizacao |
| `user_departments` | Relacao N:N entre usuarios e departamentos |

### AI/ML (4 tabelas)

| Tabela | Descricao |
|---|---|
| `ai_classifications` | Classificacoes automaticas de chamados por IA |
| `ai_suggestions` | Sugestoes de resposta geradas por IA |
| `ai_training_data` | Dados de treinamento para modelos de ML |
| `vector_embeddings` | Embeddings vetoriais para busca semantica |

### Integrations (10 tabelas)

| Tabela | Descricao |
|---|---|
| `integrations` | Integracoes configuradas (email, WhatsApp, ERP) |
| `integration_logs` | Logs de execucao de integracoes |
| `webhooks` | Webhooks configurados para eventos |
| `webhook_deliveries` | Historico de entregas de webhook |
| `communication_channels` | Canais de comunicacao ativos |
| `communication_messages` | Mensagens trocadas por canais |
| `whatsapp_contacts` | Contatos do WhatsApp |
| `whatsapp_sessions` | Sessoes ativas de conversa WhatsApp |
| `whatsapp_messages` | Mensagens do WhatsApp |
| `govbr_integrations` | Integracoes com servicos Gov.br |

### ITIL Problem (6 tabelas)

| Tabela | Descricao |
|---|---|
| `root_cause_categories` | Categorias de causa raiz |
| `problems` | Registros de problemas ITIL |
| `known_errors` | Erros conhecidos com workarounds |
| `problem_incident_links` | Vinculos entre problemas e incidentes |
| `problem_activities` | Historico de atividades em problemas |
| `problem_attachments` | Anexos vinculados a problemas |

### ITIL Change (5 tabelas)

| Tabela | Descricao |
|---|---|
| `change_types` | Tipos de mudanca (normal, emergencial, padrao) |
| `change_requests` | Requisicoes de mudanca (RFC) |
| `change_request_approvals` | Aprovacoes de mudancas |
| `change_tasks` | Tarefas de implementacao de mudancas |
| `change_calendar` | Calendario de mudancas planejadas |

### ITIL CMDB (7 tabelas)

| Tabela | Descricao |
|---|---|
| `ci_types` | Tipos de itens de configuracao (servidor, software, rede) |
| `ci_statuses` | Status possiveis de CIs |
| `ci_relationship_types` | Tipos de relacionamento entre CIs |
| `configuration_items` | Itens de configuracao (CI) do CMDB |
| `ci_relationships` | Relacionamentos entre CIs |
| `ci_history` | Historico de alteracoes em CIs |
| `ci_ticket_links` | Vinculos entre CIs e chamados |

### ITIL Catalog (5 tabelas)

| Tabela | Descricao |
|---|---|
| `service_categories` | Categorias do catalogo de servicos |
| `service_catalog_items` | Itens disponiveis no catalogo |
| `service_requests` | Solicitacoes de servico feitas por usuarios |
| `service_request_approvals` | Aprovacoes de solicitacoes de servico |
| `service_request_tasks` | Tarefas para atendimento de solicitacoes |

### ITIL CAB (3 tabelas)

| Tabela | Descricao |
|---|---|
| `cab_configurations` | Configuracoes do Change Advisory Board |
| `cab_members` | Membros do CAB |
| `cab_meetings` | Reunioes agendadas do CAB |

### Audit (4 tabelas)

| Tabela | Descricao |
|---|---|
| `audit_logs` | Logs de auditoria geral do sistema |
| `audit_advanced` | Auditoria avancada com diff de alteracoes |
| `api_usage_tracking` | Rastreamento de uso de API por endpoint |
| `user_sessions` | Sessoes de usuario ativas |

### Compliance (3 tabelas)

| Tabela | Descricao |
|---|---|
| `satisfaction_surveys` | Pesquisas de satisfacao (CSAT/NPS) |
| `scheduled_reports` | Relatorios agendados |
| `lgpd_consents` | Registros de consentimento LGPD |

### Config (3 tabelas)

| Tabela | Descricao |
|---|---|
| `ticket_templates` | Templates pre-definidos de chamados |
| `system_settings` | Configuracoes globais do sistema |
| `cache` | Cache de dados em banco (fallback quando Redis indisponivel) |

---

## 3. Adapter Pattern

Todo acesso ao banco de dados e feito por meio do adapter unificado em `lib/db/adapter.ts`. Isso garante que o mesmo codigo funcione tanto com SQLite quanto com PostgreSQL.

### Imports

```typescript
import { executeQuery, executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter';
import type { SqlParam } from '@/lib/db/adapter';
```

### Tipos

```typescript
// Parametro de query — aceito por todas as funcoes
type SqlParam = string | number | boolean | null;

// Resultado de INSERT/UPDATE/DELETE
interface RunResult {
  changes: number;            // Linhas afetadas
  lastInsertRowid?: number;   // ID gerado (INSERT)
}
```

### SELECT — Multiplas linhas

```typescript
interface Ticket { id: number; title: string; status: string; }

const tickets = await executeQuery<Ticket>(
  'SELECT id, title, status FROM tickets WHERE organization_id = ? AND status = ?',
  [orgId, 'open']
);
// tickets: Ticket[]
```

### SELECT — Linha unica

```typescript
const ticket = await executeQueryOne<Ticket>(
  'SELECT id, title, status FROM tickets WHERE id = ? AND organization_id = ?',
  [ticketId, orgId]
);
// ticket: Ticket | undefined
```

### INSERT

```typescript
const result = await executeRun(
  `INSERT INTO tickets (title, description, organization_id, created_by, created_at)
   VALUES (?, ?, ?, ?, ${sqlNow()})`,
  [title, description, orgId, userId]
);
// result.lastInsertRowid → ID do novo registro
// result.changes → 1
```

### UPDATE

```typescript
const result = await executeRun(
  `UPDATE tickets SET status = ?, updated_at = ${sqlNow()} WHERE id = ? AND organization_id = ?`,
  ['resolved', ticketId, orgId]
);
// result.changes → numero de linhas atualizadas
```

### DELETE

```typescript
const result = await executeRun(
  'DELETE FROM ticket_tags WHERE ticket_id = ? AND organization_id = ?',
  [ticketId, orgId]
);
// result.changes → numero de linhas removidas
```

### Transacoes

Transacoes garantem atomicidade — todas as operacoes completam ou nenhuma e aplicada.

```typescript
const newTicket = await executeTransaction(async (db) => {
  // 1. Criar chamado
  const ticketResult = await db.run(
    `INSERT INTO tickets (title, organization_id, created_at) VALUES (?, ?, ${sqlNow()})`,
    [title, orgId]
  );
  // ticketResult pode ser Promise (PostgreSQL) ou valor direto (SQLite)
  const resolved = ticketResult instanceof Promise ? await ticketResult : ticketResult;
  const ticketId = resolved.lastInsertRowid;

  // 2. Adicionar comentario inicial
  const commentResult = db.run(
    `INSERT INTO comments (ticket_id, user_id, content, created_at) VALUES (?, ?, ?, ${sqlNow()})`,
    [ticketId, userId, 'Chamado criado']
  );
  if (commentResult instanceof Promise) await commentResult;

  // 3. Registrar atividade
  const activityResult = db.run(
    `INSERT INTO ticket_activities (ticket_id, action, created_at) VALUES (?, ?, ${sqlNow()})`,
    [ticketId, 'created']
  );
  if (activityResult instanceof Promise) await activityResult;

  return { id: ticketId };
});
```

> **Nota:** Dentro de transacoes, use `db.run()` e `db.query()` diretamente (metodos da interface `DatabaseAdapter`). O resultado pode ser sincrono (SQLite) ou assincrono (PostgreSQL), entao verifique com `instanceof Promise` quando necessario.

### Conversao automatica de placeholders

O adapter PostgreSQL converte automaticamente placeholders `?` para `$1, $2, $3...`. Escreva todas as queries usando `?` — a conversao e transparente.

```typescript
// Voce escreve:
'SELECT * FROM tickets WHERE id = ? AND org_id = ?'

// SQLite executa como esta.
// PostgreSQL recebe:
'SELECT * FROM tickets WHERE id = $1 AND org_id = $2'
```

---

## 4. Dialect Helpers

Os helpers de dialeto geram fragmentos SQL compativeis com ambos os bancos. Todos estao em `lib/db/adapter.ts`.

### Tabela de Referencia

| Helper | Descricao | SQLite | PostgreSQL |
|---|---|---|---|
| `sqlNow()` | Timestamp atual | `datetime('now')` | `NOW()` |
| `sqlCurrentDate()` | Data atual (sem hora) | `date('now')` | `CURRENT_DATE` |
| `sqlDateSub(days)` | Data atual menos N dias | `date('now', '-N days')` | `CURRENT_DATE - INTERVAL 'N days'` |
| `sqlDateAdd(days)` | Data atual mais N dias | `date('now', '+N days')` | `CURRENT_DATE + INTERVAL 'N days'` |
| `sqlDateDiff(col1, col2)` | Diferenca em dias entre datas | `julianday(col1) - julianday(col2)` | `EXTRACT(EPOCH FROM ...) / 86400.0` |
| `sqlDatetimeSub(days)` | Timestamp atual menos N dias | `datetime('now', '-N days')` | `NOW() - INTERVAL 'N days'` |
| `sqlDatetimeSubHours(hours)` | Timestamp atual menos N horas | `datetime('now', '-N hours')` | `NOW() - INTERVAL 'N hours'` |
| `sqlDatetimeSubMinutes(min)` | Timestamp atual menos N minutos | `datetime('now', '-N minutes')` | `NOW() - INTERVAL 'N minutes'` |
| `sqlDatetimeAddMinutes(min)` | Timestamp atual mais N minutos | `datetime('now', '+N minutes')` | `NOW() + INTERVAL 'N minutes'` |
| `sqlDatetimeSubYears(years)` | Timestamp atual menos N anos | `datetime('now', '-N years')` | `NOW() - INTERVAL 'N years'` |
| `sqlColSubMinutes(col, min)` | Coluna menos N minutos | `datetime(col, '-N minutes')` | `col - INTERVAL 'N minutes'` |
| `sqlColAddMinutes(col, min)` | Coluna mais N minutos | `datetime(col, '+N minutes')` | `col + INTERVAL 'N minutes'` |
| `sqlStartOfMonth()` | Primeiro dia do mes atual | `date('now', 'start of month')` | `date_trunc('month', CURRENT_DATE)` |
| `sqlCastDate(expr)` | Converter expressao para date | `DATE(expr)` | `(expr)::date` |
| `sqlGroupConcat(col, sep)` | Concatenar valores agrupados | `GROUP_CONCAT(col, sep)` | `STRING_AGG(col::text, sep)` |
| `sqlExtractHour(col)` | Extrair hora de timestamp | `strftime('%H', col)` | `EXTRACT(HOUR FROM col)` |
| `sqlExtractDayOfWeek(col)` | Extrair dia da semana (0=dom) | `strftime('%w', col)` | `EXTRACT(DOW FROM col)` |
| `sqlTrue()` | Literal booleano verdadeiro | `1` | `TRUE` |
| `sqlFalse()` | Literal booleano falso | `0` | `FALSE` |

### Exemplos de uso

**Buscar chamados criados nos ultimos 7 dias:**

```typescript
import { executeQuery, sqlDatetimeSub } from '@/lib/db/adapter';

const recentTickets = await executeQuery(
  `SELECT * FROM tickets
   WHERE organization_id = ? AND created_at >= ${sqlDatetimeSub(7)}
   ORDER BY created_at DESC`,
  [orgId]
);
```

**Calcular tempo medio de resolucao:**

```typescript
import { executeQueryOne, sqlDateDiff } from '@/lib/db/adapter';

const avg = await executeQueryOne<{ avg_days: number }>(
  `SELECT AVG(${sqlDateDiff('resolved_at', 'created_at')}) as avg_days
   FROM tickets
   WHERE organization_id = ? AND resolved_at IS NOT NULL`,
  [orgId]
);
```

**Metricas por hora do dia:**

```typescript
import { executeQuery, sqlExtractHour } from '@/lib/db/adapter';

const byHour = await executeQuery(
  `SELECT ${sqlExtractHour('created_at')} as hour, COUNT(*) as total
   FROM tickets WHERE organization_id = ?
   GROUP BY ${sqlExtractHour('created_at')}
   ORDER BY hour`,
  [orgId]
);
```

**Retencao LGPD — dados com mais de 3 anos:**

```typescript
import { executeRun, sqlDatetimeSubYears } from '@/lib/db/adapter';

await executeRun(
  `DELETE FROM audit_logs
   WHERE organization_id = ? AND created_at < ${sqlDatetimeSubYears(3)}`,
  [orgId]
);
```

---

## 5. Migrations

### Localizacao

Todos os arquivos de migracao ficam em `lib/db/migrations/`.

### Ordem de execucao

| # | Arquivo | Descricao |
|---|---|---|
| 000 | `000_create_base_tables.sql` | Tabelas base iniciais |
| 001 | `001_initial_schema.sql` | Schema completo inicial |
| 001 | `001_postgresql_schema.sql` | Schema PostgreSQL inicial |
| 001 | `001_add_enterprise_features.sql` | Funcionalidades enterprise |
| 001 | `001-add-multi-tenant.sql` | Suporte multi-tenant |
| 001 | `001-refresh-tokens.sql` | Tabela de refresh tokens |
| 002 | `002-add-missing-tables.sql` | Tabelas faltantes |
| 002 | `002_add_indexes_and_constraints.sql` | Indexes e constraints |
| 002 | `002_add_organization_id_core.sql` | Coluna organization_id nas tabelas core |
| 003 | `003_add_organization_id_sla.sql` | organization_id nas tabelas SLA |
| 004 | `004_add_organization_id_kb.sql` | organization_id na Knowledge Base |
| 005 | `005_add_organization_id_auth.sql` | organization_id nas tabelas de auth |
| 006 | `006_add_performance_indexes.sql` | Indexes de performance |
| 007 | `007_critical_performance_indexes.sql` | Indexes criticos adicionais |
| 008 | `008_add_holidays_table.sql` | Tabela de feriados |
| 009 | `009_add_push_subscriptions.sql` | Push notifications |
| 010 | `010_email_integration.sql` | Integracao com email |
| 011 | `011_kb_collaboration.sql` | Colaboracao na Knowledge Base |
| 012 | `012_add_organization_id.sql` | organization_id em tabelas restantes |
| 013 | `013_tags_macros_relationships.sql` | Tags, macros e relacionamentos |
| 014 | `014_system_settings_integrations.sql` | Configuracoes do sistema e integracoes |
| 015 | `015_sla_columns.sql` | Colunas adicionais de SLA |
| 016 | `016_workflow_persistence_columns.sql` | Persistencia de workflow |
| 017 | `017_workflow_approvals_extended.sql` | Aprovacoes estendidas de workflow |
| 018 | `018_lgpd_data_deletion.sql` | Suporte a exclusao de dados LGPD |
| 019 | `019_problem_management.sql` | Gerenciamento de problemas ITIL |
| 020 | `020_cmdb_service_catalog.sql` | CMDB e catalogo de servicos |
| 021 | `021_fix_missing_columns.sql` | Correcao de colunas ausentes |
| 022 | `022_billing_stripe_columns.sql` | Colunas de billing Stripe |

### Como criar uma nova migracao

1. Crie o arquivo com o proximo numero sequencial:
   ```
   lib/db/migrations/023_descricao_da_mudanca.sql
   ```

2. Escreva o SQL com `IF NOT EXISTS` para idempotencia:
   ```sql
   -- 023: Descricao breve da mudanca
   -- Data: 2026-03-16

   CREATE TABLE IF NOT EXISTS nova_tabela (
     id SERIAL PRIMARY KEY,
     organization_id INTEGER NOT NULL REFERENCES organizations(id),
     name TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_nova_tabela_org
     ON nova_tabela(organization_id);
   ```

3. Atualize ambos os schemas:
   - `lib/db/schema.sql` (SQLite)
   - `lib/db/schema.postgres.sql` (PostgreSQL)

4. Adicione os tipos TypeScript em `lib/types/database.ts`

### Diretrizes de seguranca

- **SEMPRE** use `IF NOT EXISTS` em `CREATE TABLE` e `CREATE INDEX`
- **NUNCA** use `DROP TABLE` em producao — use `ALTER TABLE` para modificacoes
- **NUNCA** remova colunas diretamente — marque como deprecated, remova depois
- Adicione colunas com `DEFAULT` para evitar quebrar dados existentes
- Teste migracoes no SQLite local antes de executar no Supabase
- Faca backup antes de executar migracoes em producao

---

## 6. Indexes

O banco de dados possui **365 indexes** que suportam os padroes de consulta mais comuns.

### Padroes de indexacao

| Padrao | Tipo de Index | Exemplo |
|---|---|---|
| Isolamento de tenant | Composto com `organization_id` | `idx_tickets_org` ON tickets(organization_id) |
| Busca por status | Composto org + status | `idx_tickets_org_status` ON tickets(organization_id, status) |
| Ordenacao temporal | Composto org + created_at | `idx_tickets_org_created` ON tickets(organization_id, created_at) |
| Foreign keys | Simples na FK | `idx_comments_ticket_id` ON comments(ticket_id) |
| Busca textual | Sobre colunas de texto | `idx_tickets_title` ON tickets(title) |
| Unicidade | UNIQUE | `idx_users_email_org` ON users(email, organization_id) |

### Queries comuns e indexes que as suportam

**Listar chamados por organizacao e status:**
```sql
SELECT * FROM tickets WHERE organization_id = ? AND status = ?
-- Suportado por: idx_tickets_org_status
```

**Buscar usuario por email dentro da organizacao:**
```sql
SELECT * FROM users WHERE email = ? AND organization_id = ?
-- Suportado por: idx_users_email_org (UNIQUE)
```

**Chamados recentes de uma organizacao:**
```sql
SELECT * FROM tickets WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20
-- Suportado por: idx_tickets_org_created
```

**Comentarios de um chamado:**
```sql
SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC
-- Suportado por: idx_comments_ticket_id
```

### Consideracoes de performance

- Todas as tabelas com `organization_id` possuem index composto incluindo essa coluna
- Queries N+1 foram eliminadas com JOINs
- O dashboard usa `Promise.all` para executar queries em paralelo
- Tempo medio de query: **45ms**
- Paginacao limitada a **100 itens** (`Math.min(limit, 100)`)
- `NULLIF(divisor, 0)` usado para evitar divisao por zero

---

## 7. Multi-Tenancy

O ServiceDesk e um sistema multi-tenant onde cada organizacao tem seus dados completamente isolados.

### Como funciona

1. Toda tabela que armazena dados de tenant possui a coluna `organization_id`
2. O middleware (`middleware.ts`) resolve o tenant a partir do JWT/dominio
3. O guard `requireTenantUserContext(request)` extrai e valida o contexto
4. **Toda query DEVE incluir** `organization_id` na clausula WHERE

### Padrao obrigatorio

```typescript
// CORRETO — sempre filtrar por organization_id
const tickets = await executeQuery(
  'SELECT * FROM tickets WHERE organization_id = ? AND status = ?',
  [context.organizationId, 'open']
);

// ERRADO — vazamento de dados entre tenants!
const tickets = await executeQuery(
  'SELECT * FROM tickets WHERE status = ?',
  ['open']
);
```

### Exemplo completo de endpoint

```typescript
import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

export async function GET(request: NextRequest) {
  // 1. Rate limit
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Autenticacao + contexto do tenant
  const { context, response } = requireTenantUserContext(request);
  if (response) return response;

  // 3. Query SEMPRE com organization_id
  const data = await executeQuery(
    'SELECT * FROM tickets WHERE organization_id = ? ORDER BY created_at DESC',
    [context.organizationId]
  );

  return apiSuccess(data);
}
```

### Excecoes

Apenas o **Super Admin** (organizacao 1 ou role `super_admin`) pode executar queries cross-tenant, usando o guard `requireSuperAdmin(request)` em `lib/auth/super-admin-guard.ts`.

---

## 8. Estatisticas

| Metrica | Quantidade |
|---|---|
| Tabelas | 119 |
| Indexes | 365 |
| Triggers | 59 |
| Foreign Keys | 84 |
| CHECK Constraints | 28 |
| Schema SQLite | ~3.400 linhas |
| Schema PostgreSQL | ~2.720 linhas |
| Migracoes | 22+ arquivos |
| Modulos de tabela | 18 grupos |
| Dialect Helpers | 19 funcoes |
| Tempo medio de query | 45ms |

---

## 9. Backup e Restore

### Supabase (Producao)

O Supabase gerencia backups automaticamente:

- **Backups automaticos diarios** com retencao de acordo com o plano
- **Point-in-Time Recovery (PITR)** disponivel em planos Pro e superiores
- Backups sao armazenados em regiao separada para redundancia

### Backup manual via pg_dump

```bash
# Exportar schema + dados
pg_dump "postgresql://user:pass@host:5432/database" \
  --format=custom \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump

# Restaurar
pg_restore --dbname="postgresql://user:pass@host:5432/database" \
  --clean --if-exists \
  backup_20260316_120000.dump
```

### SQLite (Desenvolvimento)

```bash
# Backup simples (copiar arquivo)
cp data/servicedesk.db data/servicedesk_backup_$(date +%Y%m%d).db

# Reinicializar banco de desenvolvimento
npm run db:clear && npm run init-db
```

### Antes de migracoes em producao

1. Faca backup completo via pg_dump ou painel do Supabase
2. Teste a migracao localmente no SQLite
3. Execute em ambiente de staging se disponivel
4. Aplique em producao com monitoramento ativo
5. Valide os dados apos a migracao
