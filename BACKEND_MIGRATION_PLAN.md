# 🏗️ Plano Completo de Migração de Backend - ServiceDesk Pro
## SQLite → Supabase PostgreSQL + Vercel Deployment

**Data de Criação:** 24/12/2025
**Status:** 📋 **PLANEJAMENTO - NÃO EXECUTAR AINDA**
**Ambiente de Destino:** Vercel (Edge) + Supabase (PostgreSQL)

---

## 📊 Análise da Arquitetura Atual

### 1. Banco de Dados Atual (SQLite)

**Arquivo Principal:** `lib/db/schema.sql` (2,328 linhas)

#### Tabelas Principais (30 tabelas identificadas):

**Autenticação e Usuários (14 tabelas):**
1. `users` - Usuários do sistema
2. `refresh_tokens` - Tokens de atualização JWT
3. `permissions` - Permissões granulares
4. `roles` - Papéis do sistema
5. `role_permissions` - Relacionamento roles↔permissions
6. `user_roles` - Relacionamento users↔roles
7. `password_policies` - Políticas de senha
8. `password_history` - Histórico de senhas
9. `rate_limits` - Controle de rate limiting
10. `sso_providers` - Provedores SSO
11. `login_attempts` - Tentativas de login
12. `webauthn_credentials` - Credenciais WebAuthn
13. `verification_codes` - Códigos de verificação
14. `auth_audit_logs` - Logs de auditoria de auth

**Tickets e Atendimento (10 tabelas):**
15. `categories` - Categorias de tickets
16. `priorities` - Prioridades
17. `statuses` - Status de tickets
18. `tickets` - Tickets principais
19. `comments` - Comentários
20. `attachments` - Anexos
21. `sla_policies` - Políticas de SLA
22. `sla_tracking` - Rastreamento de SLA
23. `escalations` - Escalações
24. `satisfaction_surveys` - Pesquisas de satisfação

**Sistema e Configuração (6 tabelas):**
25. `notifications` - Notificações
26. `ticket_templates` - Templates de tickets
27. `audit_logs` - Logs de auditoria
28. `system_settings` - Configurações do sistema
29. `automations` - Automações
30. `knowledge_articles` - Base de conhecimento

#### Índices e Performance:
- **50+ índices** otimizados para consultas
- **Índices compostos** em foreign keys
- **Índices de timestamp** para ordenação

#### Triggers e Regras:
- **Triggers automáticos** para SLA tracking
- **Cascading deletes** configurados
- **Timestamps automáticos** (created_at, updated_at)

### 2. Camada de Conexão Atual

**Arquivos de Conexão:**
- `lib/db/connection.ts` - Conexão legada direta (better-sqlite3)
- `lib/db/connection-pool.ts` - Pool de conexões
- `lib/db/connection.postgres.ts` - Preparado para PostgreSQL (não usado)

**Características:**
- ✅ **Connection pooling** implementado
- ✅ **WAL mode** habilitado
- ✅ **Foreign keys** habilitados
- ✅ **Cache configurado** (1000 páginas)
- ❌ **Não compatível com Vercel Edge**
- ❌ **Não escalável horizontalmente**

### 3. Camada de Queries (ORM Customizado)

**Arquivo Principal:** `lib/db/queries.ts` (70,603 bytes)

**Funções Implementadas:**
- CRUD completo para todas as entidades
- Queries otimizadas com JOINs
- Cache layer integrado
- Analytics e KPIs em tempo real
- Suporte a multi-tenancy (organization_id)

**Problema:** Usa sintaxe SQLite específica que precisa ser adaptada para PostgreSQL

### 4. API Routes (179 rotas identificadas)

**Categorias de APIs:**
- `/api/auth/*` - 15 rotas de autenticação
- `/api/ai/*` - 8 rotas de IA
- `/api/admin/*` - 50+ rotas administrativas
- `/api/tickets/*` - 20+ rotas de tickets
- `/api/knowledge/*` - 10+ rotas de base de conhecimento
- `/api/workflows/*` - 10+ rotas de workflows
- `/api/notifications/*` - 5 rotas
- Outras: catalog, cmdb, problems, changes, etc.

**Problema:** Todas usam `db` diretamente de `connection.ts` (SQLite)

### 5. Dependências Críticas

**Banco de Dados:**
```json
"better-sqlite3": "^9.6.0",  // ❌ Remover
"@neondatabase/serverless": "^1.0.1",  // ❌ Trocar por Supabase
"sqlite": "^5.1.1",  // ❌ Remover
"sqlite3": "^5.1.7"  // ❌ Remover
```

**Necessárias para Supabase:**
```json
"@supabase/supabase-js": "^2.x.x",  // ✅ Adicionar
"pg": "^8.x.x"  // ✅ Adicionar (PostgreSQL client)
```

### 6. Configurações de Deploy

**Atual (next.config.js):**
- `output: 'standalone'` - ✅ Compatível com Vercel
- `serverExternalPackages` - ❌ Precisa atualizar
- Source maps configurados para Sentry

---

## 🎯 Arquitetura de Destino (Vercel + Supabase)

### 1. Supabase PostgreSQL

**Recursos que vamos usar:**
- ✅ **PostgreSQL 15+** - Banco relacional completo
- ✅ **Row Level Security (RLS)** - Segurança em nível de linha
- ✅ **Realtime subscriptions** - Atualizações em tempo real
- ✅ **Storage** - Para anexos/arquivos
- ✅ **Edge Functions** - Para lógica de negócio
- ✅ **Auth** - Sistema de autenticação integrado (opcional)
- ✅ **Vector embeddings** - Para IA e busca semântica

**Supabase Client SDK:**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### 2. Vercel Deployment

**Características:**
- ✅ **Edge Runtime** - Para APIs ultra-rápidas
- ✅ **Serverless Functions** - Para lógica complexa
- ✅ **Automatic scaling** - Escalabilidade automática
- ✅ **Global CDN** - Distribuição global
- ✅ **Environment variables** - Gerenciamento de secrets
- ✅ **Preview deployments** - Deploy de preview automático

**Limitações Vercel que afetam:**
- ❌ Sem sistema de arquivos persistente
- ❌ Timeout de 10s (Hobby) / 60s (Pro) para funções
- ❌ Sem suporte a SQLite (somente em-memória)
- ✅ Suporte completo a PostgreSQL via Supabase

### 3. Migração de Arquivos

**Anexos de Tickets:**
- **Atual:** File system local (`/uploads`)
- **Destino:** Supabase Storage
- **Estratégia:** Upload direto para Supabase Storage via signed URLs

**Vantagens:**
- CDN global automático
- Redimensionamento de imagens on-the-fly
- Controle de acesso granular
- Backups automáticos

---

## 📋 Plano de Migração Detalhado

### FASE 1: Preparação e Análise (2-3 horas)

#### Agente 1: Análise de Schema
**Tarefa:** Converter schema SQLite → PostgreSQL
**Arquivos:**
- Analisar: `lib/db/schema.sql`
- Criar: `lib/db/schema.supabase.sql`

**Conversões necessárias:**
```sql
-- SQLite → PostgreSQL

-- 1. Auto Increment
INTEGER PRIMARY KEY AUTOINCREMENT  →  SERIAL PRIMARY KEY
BIGINT PRIMARY KEY AUTOINCREMENT   →  BIGSERIAL PRIMARY KEY

-- 2. Boolean
BOOLEAN (INTEGER 0/1)  →  BOOLEAN (TRUE/FALSE)

-- 3. DateTime
DATETIME DEFAULT CURRENT_TIMESTAMP  →  TIMESTAMP DEFAULT NOW()

-- 4. JSON
TEXT (with JSON comment)  →  JSONB

-- 5. Check Constraints
CHECK (role IN ('admin', 'agent'))  →  (manter igual)

-- 6. Triggers
CREATE TRIGGER update_timestamp  →  (revisar sintaxe PostgreSQL)
```

**Entregas:**
- ✅ Schema PostgreSQL completo
- ✅ Lista de triggers convertidos
- ✅ Lista de índices otimizados para PostgreSQL
- ✅ Migration inicial do Supabase

#### Agente 2: Análise de Queries
**Tarefa:** Identificar queries incompatíveis
**Arquivos:**
- Analisar: `lib/db/queries.ts`
- Documentar: `QUERY_COMPATIBILITY_REPORT.md`

**Incompatibilidades SQLite→PostgreSQL:**
```typescript
// 1. LIMIT/OFFSET syntax
db.prepare('SELECT * FROM users LIMIT ? OFFSET ?')
// ✅ Compatible - mesma sintaxe

// 2. Date functions
datetime('now')  →  NOW()
date('now')      →  CURRENT_DATE
strftime()       →  TO_CHAR()

// 3. JSON functions
json_extract()   →  jsonb_extract_path()
json_array()     →  jsonb_build_array()

// 4. String concatenation
||               →  || (mesma sintaxe, mas CONCAT() preferível)

// 5. AUTOINCREMENT
lastInsertRowid  →  RETURNING id

// 6. Boolean
WHERE active = 1  →  WHERE active = TRUE
```

**Entregas:**
- ✅ Lista completa de queries incompatíveis
- ✅ Sugestões de reescrita
- ✅ Queries críticas prioritizadas

#### Agente 3: Análise de APIs
**Tarefa:** Mapear todas as rotas API
**Arquivos:**
- Analisar: `app/api/**/*.ts` (179 arquivos)
- Documentar: `API_ROUTES_INVENTORY.md`

**Categorização:**
- 🟢 **Simples** - CRUD básico (pode usar Supabase client direto)
- 🟡 **Média** - Lógica de negócio moderada (precisa adapter layer)
- 🔴 **Complexa** - Transações, lógica complexa (precisa refatoração)

**Entregas:**
- ✅ Inventário completo de APIs
- ✅ Priorização por complexidade
- ✅ Mapa de dependências entre APIs

---

### FASE 2: Infraestrutura Supabase (3-4 horas)

#### Agente 4: Setup Supabase Project
**Tarefa:** Configurar projeto Supabase
**Ações:**
1. Criar projeto no Supabase Dashboard
2. Executar migration inicial (schema.supabase.sql)
3. Configurar RLS policies básicas
4. Configurar Storage buckets
5. Criar indexes otimizados

**RLS Policies Essenciais:**
```sql
-- Users: Usuários só veem seus próprios dados
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Tickets: Baseado em organization_id
CREATE POLICY "Users can view org tickets"
ON tickets FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Admin: Acesso total
CREATE POLICY "Admins can do everything"
ON tickets FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

**Storage Buckets:**
```typescript
// Bucket para anexos de tickets
{
  name: 'ticket-attachments',
  public: false,
  fileSizeLimit: 10485760, // 10MB
  allowedMimeTypes: ['image/*', 'application/pdf', 'text/*']
}

// Bucket para avatars
{
  name: 'avatars',
  public: true,
  fileSizeLimit: 2097152, // 2MB
  allowedMimeTypes: ['image/*']
}
```

**Entregas:**
- ✅ Projeto Supabase configurado
- ✅ Schema migrado e validado
- ✅ RLS policies aplicadas
- ✅ Storage buckets criados
- ✅ Credenciais documentadas

#### Agente 5: Configurar Environment Variables
**Tarefa:** Atualizar variáveis de ambiente
**Arquivos:**
- Atualizar: `.env.example`
- Criar: `.env.production.supabase`

**Variáveis Necessárias:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SUPABASE_JWT_SECRET=[jwt-secret]

# Database Direct Connection (para migrations)
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Storage
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://[project-id].supabase.co/storage/v1

# Vercel Configuration
VERCEL=1
VERCEL_ENV=production
NEXT_PUBLIC_VERCEL_URL=[deployment-url]

# Manter as existentes
JWT_SECRET=[seu-jwt-secret]
NEXT_PUBLIC_APP_URL=[sua-url]
```

**Entregas:**
- ✅ Arquivo .env.example atualizado
- ✅ Documentação de todas as variáveis
- ✅ Checklist de configuração no Vercel

---

### FASE 3: Camada de Abstração (6-8 horas)

#### Agente 6: Criar Supabase Adapter
**Tarefa:** Criar camada de abstração para Supabase
**Arquivos a criar:**
- `lib/db/supabase-client.ts` - Cliente Supabase configurado
- `lib/db/supabase-adapter.ts` - Adapter pattern para queries
- `lib/db/database.ts` - Interface unificada

**Arquitetura:**
```typescript
// lib/db/supabase-client.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from './types/supabase'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
)

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

```typescript
// lib/db/supabase-adapter.ts
export class SupabaseAdapter {
  // Query builders que abstraem diferenças SQLite vs PostgreSQL

  async findOne<T>(
    table: string,
    conditions: Record<string, any>
  ): Promise<T | null> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .match(conditions)
      .single()

    if (error) throw new DatabaseError(error)
    return data as T
  }

  async findMany<T>(
    table: string,
    options: QueryOptions
  ): Promise<T[]> {
    let query = supabase.from(table).select('*')

    if (options.where) query = query.match(options.where)
    if (options.orderBy) query = query.order(options.orderBy.column, {
      ascending: options.orderBy.direction === 'asc'
    })
    if (options.limit) query = query.limit(options.limit)
    if (options.offset) query = query.range(options.offset, options.offset + options.limit - 1)

    const { data, error } = await query
    if (error) throw new DatabaseError(error)
    return data as T[]
  }

  async create<T>(
    table: string,
    data: Partial<T>
  ): Promise<T> {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    if (error) throw new DatabaseError(error)
    return result as T
  }

  async update<T>(
    table: string,
    id: number,
    data: Partial<T>
  ): Promise<T> {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new DatabaseError(error)
    return result as T
  }

  async delete(table: string, id: number): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (error) throw new DatabaseError(error)
  }

  // Transações usando Supabase RPC
  async transaction<T>(
    callback: (tx: SupabaseAdapter) => Promise<T>
  ): Promise<T> {
    // Implementar usando Supabase RPC functions ou
    // PostgreSQL stored procedures
    return callback(this)
  }
}

export const db = new SupabaseAdapter()
```

**Entregas:**
- ✅ Cliente Supabase configurado
- ✅ Adapter com métodos CRUD
- ✅ Suporte a transações
- ✅ Error handling robusto
- ✅ TypeScript types gerados

#### Agente 7: Migrar Auth System
**Tarefa:** Migrar autenticação para Supabase Auth
**Arquivos:**
- Refatorar: `lib/auth/sqlite-auth.ts` → `lib/auth/supabase-auth.ts`
- Atualizar: Todas as rotas em `app/api/auth/*`

**Opções de Estratégia:**

**Opção A: Usar Supabase Auth (Recomendado)**
```typescript
// lib/auth/supabase-auth.ts
import { supabase } from '@/lib/db/supabase-client'

export async function signUp(email: string, password: string, metadata: any) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata // name, role, etc.
    }
  })

  if (error) throw new AuthError(error.message)
  return data.user
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw new AuthError(error.message)
  return data.session
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw new AuthError(error.message)
  return user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new AuthError(error.message)
}
```

**Opção B: JWT Customizado + Supabase DB**
- Manter JWT customizado
- Usar Supabase apenas para persistência
- Mais controle sobre lógica de auth

**Decisão Recomendada:** Opção A (Supabase Auth)
- ✅ OAuth providers integrados
- ✅ MFA built-in
- ✅ Email verification automática
- ✅ Session management robusto
- ✅ RLS integration nativa

**Entregas:**
- ✅ Sistema de auth migrado
- ✅ Todas as rotas /api/auth/* atualizadas
- ✅ Middleware atualizado
- ✅ Session management implementado

#### Agente 8: Migrar Queries CRUD
**Tarefa:** Refatorar lib/db/queries.ts
**Arquivos:**
- Refatorar: `lib/db/queries.ts` (70KB)
- Criar: `lib/db/queries/users.ts`
- Criar: `lib/db/queries/tickets.ts`
- Criar: `lib/db/queries/comments.ts`
- Etc. (dividir por entidade)

**Padrão de Migração:**
```typescript
// ANTES (SQLite)
export function getUserById(id: number): User | null {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User
  return user || null
}

// DEPOIS (Supabase)
export async function getUserById(id: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new DatabaseError(error.message)
  }

  return data
}
```

**Queries com JOIN:**
```typescript
// ANTES (SQLite com JOINs complexos)
export function getTicketWithDetails(id: number) {
  return db.prepare(`
    SELECT
      t.*,
      u.name as user_name,
      c.name as category_name,
      p.name as priority_name,
      s.name as status_name
    FROM tickets t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN priorities p ON t.priority_id = p.id
    LEFT JOIN statuses s ON t.status_id = s.id
    WHERE t.id = ?
  `).get(id)
}

// DEPOIS (Supabase com select join)
export async function getTicketWithDetails(id: number) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      user:users!user_id(name, email),
      category:categories!category_id(name, color),
      priority:priorities!priority_id(name, level),
      status:statuses!status_id(name, is_final)
    `)
    .eq('id', id)
    .single()

  if (error) throw new DatabaseError(error.message)
  return data
}
```

**Entregas:**
- ✅ Todas as queries CRUD migradas
- ✅ Queries organizadas por entidade
- ✅ Tests unitários para queries críticas
- ✅ Performance benchmarks

---

### FASE 4: Migração de API Routes (10-12 horas)

#### Agente 9-14: Migrar APIs por Categoria (6 agentes paralelos)

**Divisão de Trabalho:**

**Agente 9: APIs de Autenticação**
- `app/api/auth/*` (15 rotas)
- Prioridade: 🔴 CRÍTICA
- Complexidade: Alta

**Agente 10: APIs de Tickets**
- `app/api/tickets/*` (20 rotas)
- `app/api/comments/*`
- `app/api/attachments/*`
- Prioridade: 🔴 CRÍTICA
- Complexidade: Média-Alta

**Agente 11: APIs Administrativas**
- `app/api/admin/*` (50+ rotas)
- Prioridade: 🟡 ALTA
- Complexidade: Média

**Agente 12: APIs de IA**
- `app/api/ai/*` (8 rotas)
- Prioridade: 🟢 MÉDIA
- Complexidade: Baixa-Média

**Agente 13: APIs de Conhecimento e Workflows**
- `app/api/knowledge/*`
- `app/api/workflows/*`
- Prioridade: 🟢 MÉDIA
- Complexidade: Média

**Agente 14: APIs Diversas**
- `app/api/catalog/*`
- `app/api/notifications/*`
- `app/api/cmdb/*`
- Prioridade: 🟢 BAIXA
- Complexidade: Baixa

**Padrão de Migração de Rota:**
```typescript
// ANTES (app/api/tickets/route.ts)
import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTickets } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const tickets = getTickets()
    return NextResponse.json({ success: true, tickets })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    )
  }
}

// DEPOIS (app/api/tickets/route.ts)
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db/supabase-client'
import { getTickets } from '@/lib/db/queries/tickets'

export async function GET(request: NextRequest) {
  try {
    // Autenticação via Supabase Auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar token JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Buscar tickets usando query migrada
    const tickets = await getTickets({
      userId: user.id,
      organizationId: user.user_metadata.organization_id
    })

    return NextResponse.json({ success: true, tickets })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    )
  }
}
```

**Entregas (cada agente):**
- ✅ Todas as rotas migradas e testadas
- ✅ Error handling padronizado
- ✅ Autenticação integrada
- ✅ Logs implementados

---

### FASE 5: Migração de Storage e Arquivos (3-4 horas)

#### Agente 15: Migrar Sistema de Anexos
**Tarefa:** Migrar anexos para Supabase Storage
**Arquivos:**
- Criar: `lib/storage/supabase-storage.ts`
- Atualizar: `app/api/tickets/[id]/attachments/route.ts`

**Upload de Arquivos:**
```typescript
// lib/storage/supabase-storage.ts
import { supabase } from '@/lib/db/supabase-client'

export async function uploadAttachment(
  ticketId: number,
  file: File,
  userId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${ticketId}/${userId}-${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('ticket-attachments')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw new StorageError(error.message)

  // Obter URL pública (signed)
  const { data: urlData } = supabase.storage
    .from('ticket-attachments')
    .createSignedUrl(fileName, 3600) // 1 hour

  return urlData.signedUrl
}

export async function deleteAttachment(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('ticket-attachments')
    .remove([filePath])

  if (error) throw new StorageError(error.message)
}

export async function getAttachmentUrl(filePath: string): Promise<string> {
  const { data, error } = supabase.storage
    .from('ticket-attachments')
    .createSignedUrl(filePath, 3600)

  if (error) throw new StorageError(error.message)
  return data.signedUrl
}
```

**Política de Storage RLS:**
```sql
-- Apenas usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

-- Usuários podem ver anexos de tickets da sua organização
CREATE POLICY "Users can view org attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND
  EXISTS (
    SELECT 1 FROM tickets t
    INNER JOIN attachments a ON t.id = a.ticket_id
    WHERE a.file_path = name
      AND t.organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
  )
);
```

**Entregas:**
- ✅ Upload de anexos funcionando
- ✅ Download com signed URLs
- ✅ RLS policies configuradas
- ✅ Migration de anexos existentes (se necessário)

---

### FASE 6: Realtime e Features Avançadas (4-5 horas)

#### Agente 16: Implementar Supabase Realtime
**Tarefa:** Substituir Socket.io por Supabase Realtime
**Arquivos:**
- Criar: `lib/realtime/supabase-realtime.ts`
- Atualizar: `components/ui/NotificationCenter.tsx`

**Realtime Subscriptions:**
```typescript
// lib/realtime/supabase-realtime.ts
import { supabase } from '@/lib/db/supabase-client'
import { RealtimeChannel } from '@supabase/supabase-js'

export function subscribeToTicketUpdates(
  ticketId: number,
  callback: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`ticket:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${ticketId}`
      },
      callback
    )
    .subscribe()

  return channel
}

export function subscribeToNewComments(
  ticketId: number,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`comments:ticket:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `ticket_id=eq.${ticketId}`
      },
      callback
    )
    .subscribe()
}

export function subscribeToNotifications(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      callback
    )
    .subscribe()
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel)
}
```

**Client-Side Usage:**
```typescript
// components/tickets/TicketDetail.tsx
'use client'
import { useEffect, useState } from 'react'
import { subscribeToTicketUpdates } from '@/lib/realtime/supabase-realtime'

export function TicketDetail({ ticketId }: { ticketId: number }) {
  const [ticket, setTicket] = useState(null)

  useEffect(() => {
    const channel = subscribeToTicketUpdates(ticketId, (payload) => {
      console.log('Ticket updated:', payload)
      setTicket(payload.new)
    })

    return () => {
      channel.unsubscribe()
    }
  }, [ticketId])

  return <div>...</div>
}
```

**Entregas:**
- ✅ Socket.io removido
- ✅ Supabase Realtime implementado
- ✅ Notificações em tempo real
- ✅ Atualizações de tickets em tempo real

#### Agente 17: Implementar Busca com Vector Embeddings
**Tarefa:** Implementar busca semântica com pgvector
**Arquivos:**
- Criar: `lib/ai/vector-search.ts`
- Atualizar: `app/api/knowledge/semantic-search/route.ts`

**Setup pgvector no Supabase:**
```sql
-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar coluna de embedding aos artigos
ALTER TABLE knowledge_articles
ADD COLUMN embedding vector(1536); -- OpenAI embeddings têm 1536 dimensões

-- Criar índice HNSW para busca rápida
CREATE INDEX ON knowledge_articles
USING hnsw (embedding vector_cosine_ops);

-- Função de busca semântica
CREATE OR REPLACE FUNCTION search_articles(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  FROM knowledge_articles
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**TypeScript Implementation:**
```typescript
// lib/ai/vector-search.ts
import { OpenAI } from 'openai'
import { supabase } from '@/lib/db/supabase-client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  })

  return response.data[0].embedding
}

export async function searchArticles(
  query: string,
  threshold: number = 0.7,
  limit: number = 10
) {
  // Gerar embedding da query
  const embedding = await generateEmbedding(query)

  // Buscar artigos similares
  const { data, error } = await supabase.rpc('search_articles', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit
  })

  if (error) throw new Error(error.message)
  return data
}

// Função para indexar novo artigo
export async function indexArticle(articleId: number, content: string) {
  const embedding = await generateEmbedding(content)

  await supabase
    .from('knowledge_articles')
    .update({ embedding })
    .eq('id', articleId)
}
```

**Entregas:**
- ✅ pgvector configurado
- ✅ Busca semântica funcionando
- ✅ Indexação automática de artigos
- ✅ API de busca otimizada

---

### FASE 7: Migração de Dados e Testing (6-8 horas)

#### Agente 18: Data Migration Script
**Tarefa:** Criar script de migração de dados SQLite → PostgreSQL
**Arquivos:**
- Criar: `scripts/migrate-data-to-supabase.ts`

**Script de Migração:**
```typescript
// scripts/migrate-data-to-supabase.ts
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '@/lib/auth/supabase-auth'

const sqliteDb = new Database('servicedesk.db')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateData() {
  console.log('🚀 Starting data migration...')

  // 1. Migrar usuários
  console.log('📤 Migrating users...')
  const users = sqliteDb.prepare('SELECT * FROM users').all()

  for (const user of users) {
    // Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: Math.random().toString(36), // Senha temporária
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: user.role,
        organization_id: user.organization_id
      }
    })

    if (authError) {
      console.error(`❌ Error creating user ${user.email}:`, authError)
      continue
    }

    // Inserir dados adicionais na tabela users
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      })

    if (dbError) {
      console.error(`❌ Error inserting user data:`, dbError)
    } else {
      console.log(`✅ Migrated user: ${user.email}`)
    }
  }

  // 2. Migrar categorias, prioridades, status
  console.log('📤 Migrating categories, priorities, statuses...')
  await migrateLookupTable('categories')
  await migrateLookupTable('priorities')
  await migrateLookupTable('statuses')

  // 3. Migrar tickets
  console.log('📤 Migrating tickets...')
  const tickets = sqliteDb.prepare('SELECT * FROM tickets').all()
  const { error: ticketsError } = await supabase
    .from('tickets')
    .insert(tickets)

  if (ticketsError) {
    console.error('❌ Error migrating tickets:', ticketsError)
  } else {
    console.log(`✅ Migrated ${tickets.length} tickets`)
  }

  // 4. Migrar comentários
  console.log('📤 Migrating comments...')
  await migrateTable('comments')

  // 5. Migrar anexos (metadados, arquivos serão migrados separadamente)
  console.log('📤 Migrating attachment metadata...')
  await migrateTable('attachments')

  // 6. Migrar SLA policies e tracking
  console.log('📤 Migrating SLA data...')
  await migrateTable('sla_policies')
  await migrateTable('sla_tracking')

  // 7. Migrar base de conhecimento
  console.log('📤 Migrating knowledge base...')
  await migrateTable('knowledge_articles')

  // 8. Migrar notificações
  console.log('📤 Migrating notifications...')
  await migrateTable('notifications')

  // 9. Migrar automations e workflows
  console.log('📤 Migrating automations...')
  await migrateTable('automations')

  console.log('🎉 Data migration completed!')
}

async function migrateLookupTable(tableName: string) {
  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all()
  const { error } = await supabase.from(tableName).insert(rows)

  if (error) {
    console.error(`❌ Error migrating ${tableName}:`, error)
  } else {
    console.log(`✅ Migrated ${rows.length} ${tableName}`)
  }
}

async function migrateTable(tableName: string) {
  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all()

  // Migrar em lotes de 1000
  const batchSize = 1000
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(tableName).insert(batch)

    if (error) {
      console.error(`❌ Error migrating ${tableName} batch ${i / batchSize + 1}:`, error)
    } else {
      console.log(`✅ Migrated ${batch.length} ${tableName} (batch ${i / batchSize + 1})`)
    }
  }
}

// Executar migração
migrateData().catch(console.error)
```

**Migração de Arquivos:**
```typescript
// scripts/migrate-files-to-supabase.ts
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateFiles() {
  console.log('📁 Starting file migration...')

  const uploadsDir = path.join(process.cwd(), 'uploads')

  // Listar todos os arquivos
  const files = fs.readdirSync(uploadsDir, { recursive: true })

  for (const file of files) {
    const filePath = path.join(uploadsDir, file)

    if (fs.statSync(filePath).isFile()) {
      const fileBuffer = fs.readFileSync(filePath)
      const fileName = file.toString()

      // Upload para Supabase Storage
      const { error } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, fileBuffer, {
          contentType: getContentType(fileName),
          upsert: false
        })

      if (error) {
        console.error(`❌ Error uploading ${fileName}:`, error)
      } else {
        console.log(`✅ Uploaded ${fileName}`)
      }
    }
  }

  console.log('🎉 File migration completed!')
}

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

migrateFiles().catch(console.error)
```

**Entregas:**
- ✅ Script de migração de dados completo
- ✅ Script de migração de arquivos
- ✅ Validação de integridade de dados
- ✅ Rollback plan documentado

#### Agente 19: Testing e Validação
**Tarefa:** Criar suite de testes para validar migração
**Arquivos:**
- Criar: `tests/migration/data-integrity.test.ts`
- Criar: `tests/migration/api-compatibility.test.ts`

**Testes de Integridade:**
```typescript
// tests/migration/data-integrity.test.ts
import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/db/supabase-client'
import Database from 'better-sqlite3'

const sqliteDb = new Database('servicedesk.db')

describe('Data Integrity Tests', () => {
  it('should have same number of users', async () => {
    const sqliteCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get()
    const { count: supabaseCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    expect(supabaseCount).toBe(sqliteCount.count)
  })

  it('should have same number of tickets', async () => {
    const sqliteCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM tickets').get()
    const { count: supabaseCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })

    expect(supabaseCount).toBe(sqliteCount.count)
  })

  it('should preserve ticket relationships', async () => {
    const sqliteTicket = sqliteDb.prepare(`
      SELECT t.*, u.email as user_email
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      LIMIT 1
    `).get()

    const { data: supabaseTicket } = await supabase
      .from('tickets')
      .select('*, user:users!user_id(email)')
      .eq('id', sqliteTicket.id)
      .single()

    expect(supabaseTicket.user.email).toBe(sqliteTicket.user_email)
  })
})
```

**Testes de API:**
```typescript
// tests/migration/api-compatibility.test.ts
import { describe, it, expect } from 'vitest'
import { GET as getTickets } from '@/app/api/tickets/route'

describe('API Compatibility Tests', () => {
  it('GET /api/tickets should return tickets', async () => {
    const request = new Request('http://localhost:3000/api/tickets')
    const response = await getTickets(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.tickets)).toBe(true)
  })

  it('POST /api/tickets should create ticket', async () => {
    // Test implementation
  })

  // Adicionar testes para todas as rotas críticas
})
```

**Entregas:**
- ✅ Suite de testes de integridade
- ✅ Testes de API compatibility
- ✅ Testes de performance
- ✅ Relatório de validação

---

### FASE 8: Deploy e Otimização (4-5 horas)

#### Agente 20: Configurar Vercel
**Tarefa:** Configurar projeto no Vercel
**Ações:**
1. Criar projeto no Vercel Dashboard
2. Conectar repositório GitHub
3. Configurar environment variables
4. Configurar build settings
5. Deploy de preview

**Vercel Configuration:**
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["gru1"], // São Paulo
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key",
    "JWT_SECRET": "@jwt-secret",
    "OPENAI_API_KEY": "@openai-api-key"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

**Package.json Adjustments:**
```json
{
  "scripts": {
    "build": "next build",
    "postinstall": "npx prisma generate || true"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

**Entregas:**
- ✅ Projeto Vercel configurado
- ✅ Environment variables configuradas
- ✅ Build bem-sucedido
- ✅ Preview deployment funcionando

#### Agente 21: Otimização e Monitoring
**Tarefa:** Configurar monitoring e otimizações
**Arquivos:**
- Criar: `lib/monitoring/vercel-analytics.ts`
- Atualizar: `app/layout.tsx` (adicionar analytics)

**Vercel Analytics:**
```typescript
// lib/monitoring/vercel-analytics.ts
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export function VercelMonitoring() {
  if (process.env.NODE_ENV !== 'production') return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
```

**Supabase Monitoring:**
```typescript
// lib/monitoring/supabase-metrics.ts
import { supabase } from '@/lib/db/supabase-client'

export async function logDatabaseMetrics() {
  const { data, error } = await supabase.rpc('get_database_stats')

  if (error) {
    console.error('Failed to get DB stats:', error)
    return
  }

  // Enviar para serviço de monitoring (Sentry, Datadog, etc.)
  console.log('Database metrics:', data)
}

// Chamar periodicamente (Edge Function ou Vercel Cron)
```

**Edge Config (para feature flags):**
```typescript
// lib/config/edge-config.ts
import { get } from '@vercel/edge-config'

export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    return await get(key) ?? false
  } catch {
    return false
  }
}

// Usage
const isNewFeatureEnabled = await getFeatureFlag('new-ai-features')
```

**Entregas:**
- ✅ Analytics configurado
- ✅ Monitoring implementado
- ✅ Edge Config para feature flags
- ✅ Error tracking (Sentry) integrado

---

### FASE 9: Rollout e Documentação (2-3 horas)

#### Agente 22: Documentação Final
**Tarefa:** Criar documentação completa de deploy
**Arquivos:**
- Criar: `DEPLOYMENT_GUIDE.md`
- Criar: `SUPABASE_SETUP.md`
- Criar: `API_MIGRATION_CHANGELOG.md`
- Atualizar: `README.md`

**Documentação Essencial:**
1. **Setup Guide** - Como configurar do zero
2. **Migration Checklist** - Checklist de migração
3. **Rollback Plan** - Como fazer rollback se necessário
4. **Troubleshooting** - Problemas comuns e soluções
5. **Performance Tuning** - Otimizações recomendadas

**Entregas:**
- ✅ Documentação completa
- ✅ Guias de troubleshooting
- ✅ Changelog de migração
- ✅ README atualizado

---

## 📊 Estimativa de Tempo Total

| Fase | Agentes | Horas Estimadas |
|------|---------|----------------|
| 1. Preparação e Análise | 3 | 2-3h |
| 2. Infraestrutura Supabase | 2 | 3-4h |
| 3. Camada de Abstração | 3 | 6-8h |
| 4. Migração de API Routes | 6 | 10-12h |
| 5. Storage e Arquivos | 1 | 3-4h |
| 6. Features Avançadas | 2 | 4-5h |
| 7. Data Migration e Testing | 2 | 6-8h |
| 8. Deploy e Otimização | 2 | 4-5h |
| 9. Documentação Final | 1 | 2-3h |
| **TOTAL** | **22 agentes** | **40-52h** |

**Com 22 agentes trabalhando em paralelo (onde possível):**
- Tempo real estimado: **12-16 horas** (considerando dependências)

---

## 🎯 Ordem de Execução Recomendada

### Sprint 1: Fundação (Agentes 1-5)
**Dependências:** Nenhuma
**Duração:** 5-7h
- Análise de schema, queries e APIs
- Setup Supabase
- Configuração de environment variables

### Sprint 2: Abstração (Agentes 6-8)
**Dependências:** Sprint 1 completo
**Duração:** 6-8h
- Supabase adapter
- Auth migration
- Queries CRUD

### Sprint 3: APIs (Agentes 9-14)
**Dependências:** Sprint 2 completo
**Duração:** 10-12h (paralelo)
- 6 agentes em paralelo migrando APIs

### Sprint 4: Storage e Realtime (Agentes 15-17)
**Dependências:** Sprint 2 completo
**Duração:** 4-5h (paralelo)
- Storage migration
- Realtime implementation
- Vector search

### Sprint 5: Data e Testing (Agentes 18-19)
**Dependências:** Sprint 3 completo
**Duração:** 6-8h
- Data migration
- Testing e validação

### Sprint 6: Deploy (Agentes 20-22)
**Dependências:** Sprint 5 completo
**Duração:** 6-8h
- Vercel setup
- Monitoring
- Documentação

---

## ⚠️ Riscos e Mitigações

### Risco 1: Perda de Dados na Migração
**Mitigação:**
- Backup completo do SQLite antes de iniciar
- Migração em ambiente de staging primeiro
- Validação de integridade em cada etapa
- Rollback plan documentado

### Risco 2: Downtime Durante Deploy
**Mitigação:**
- Blue-green deployment
- Manter SQLite funcionando durante transição
- Deploy incremental por feature
- Monitoramento em tempo real

### Risco 3: Performance Degradation
**Mitigação:**
- Benchmark antes e depois
- Otimizar queries PostgreSQL
- Configurar índices adequados
- Cache layer (Redis) se necessário

### Risco 4: Custos Inesperados (Supabase/Vercel)
**Mitigação:**
- Calcular custos estimados beforehand
- Configurar alertas de billing
- Otimizar queries para reduzir reads
- Usar caching agressivo

### Risco 5: Incompatibilidade de Features
**Mitigação:**
- Testes extensivos de todas as features
- Feature flags para rollout gradual
- Monitoramento de erros em produção
- Feedback loop com usuários

---

## 📈 Métricas de Sucesso

### Performance
- ✅ Latência de API < 200ms (p95)
- ✅ Tempo de carregamento de página < 2s
- ✅ Database query time < 50ms (p95)

### Confiabilidade
- ✅ Uptime > 99.9%
- ✅ Error rate < 0.1%
- ✅ Zero data loss

### Escalabilidade
- ✅ Suporte a 10,000+ tickets
- ✅ 1,000+ usuários concurrent
- ✅ Crescimento horizontal sem refactoring

### Custos
- ✅ Custo mensal previsível
- ✅ Otimização de reads/writes
- ✅ Uso eficiente de storage

---

## 🔄 Rollback Plan

### Se algo der errado:

**Opção 1: Rollback Completo**
1. Revert para versão anterior no Vercel
2. Restaurar SQLite backup
3. Redirecionar DNS se necessário

**Opção 2: Rollback Parcial**
1. Desabilitar features problemáticas via feature flags
2. Manter resto do sistema funcionando
3. Fix forward em hotfix

**Opção 3: Hybrid Mode**
1. Manter SQLite e Supabase em paralelo
2. Router layer decide qual usar por feature
3. Migração gradual por módulo

---

## 📝 Próximos Passos

**Este é um PLANO - NÃO executar ainda!**

**Para executar:**
1. Revisar e aprovar este plano
2. Criar projeto no Supabase
3. Configurar environment variables
4. Executar Sprints na ordem recomendada
5. Usar múltiplos agentes em paralelo quando possível

**Aguardando aprovação para iniciar a execução! 🚀**

---

**Status:** 📋 **PLANEJAMENTO COMPLETO**
**Próxima Ação:** Aguardando comando para executar Sprint 1
