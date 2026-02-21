# ✅ SECURITY IMPLEMENTATION CHECKLIST

Guia passo-a-passo para aplicar TODAS as correções de segurança implementadas pelos Agents 7-20.

---

## 📋 FASE 1: INICIALIZAÇÃO (5 minutos)

### 1.1 Inicializar Tabelas de Segurança

```bash
# Execute este script para criar todas as tabelas necessárias
npx tsx -e "
import { initializePasswordHistoryTable } from './lib/security/password-policy';
import { initializeStorageQuotaTables } from './lib/security/storage-quota';
import { initializeSessionTables } from './lib/security/session-manager';
import { initializeAuditLogTable } from './lib/security/audit-logger';

console.log('Inicializando tabelas de segurança...');
initializePasswordHistoryTable();
initializeStorageQuotaTables();
initializeSessionTables();
initializeAuditLogTable();
console.log('✅ Tabelas criadas com sucesso!');
"
```

**Resultado Esperado**:
```
✅ Password history table initialized successfully
✅ Storage quota tables initialized successfully
✅ Session management tables initialized successfully
✅ Audit logs table initialized successfully
```

### 1.2 Verificar Variáveis de Ambiente

Adicione ao `.env`:

```bash
# Security
CSRF_SECRET=<generate-with-openssl-rand-hex-32>
WEBHOOK_SECRET=<generate-with-openssl-rand-hex-32>
EMAIL_WEBHOOK_SECRET=<generate-with-openssl-rand-hex-32>
WHATSAPP_WEBHOOK_SECRET=<generate-with-openssl-rand-hex-32>

# Password Policy
PASSWORD_MIN_LENGTH=12
PASSWORD_HISTORY_COUNT=5
PASSWORD_MAX_AGE_DAYS=90

# Session Management
SESSION_TIMEOUT_MINUTES=120
LOCKOUT_THRESHOLD=5
LOCKOUT_DURATION_MINUTES=30

# Storage Quotas
USER_STORAGE_QUOTA_GB=1
TENANT_STORAGE_QUOTA_GB=50
```

**Gerar secrets**:
```bash
openssl rand -hex 32
```

---

## 📋 FASE 2: VALIDAÇÃO ZOD (30-60 minutos)

### 2.1 Pattern de Aplicação

**Para CADA arquivo de API route** (189 no total), aplique este pattern:

```typescript
// EXEMPLO: /app/api/tickets/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ticketSchemas } from '@/lib/validation/schemas'; // ← ADICIONAR

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ========== ADICIONAR VALIDAÇÃO ========== //
    const result = ticketSchemas.create.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, { status: 400 });
    }

    const validatedData = result.data;
    // ========================================= //

    // Usar validatedData ao invés de body
    const ticket = createTicket(validatedData);

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    // ...
  }
}
```

### 2.2 Schemas Disponíveis

| Endpoint Pattern | Schema a Usar |
|------------------|---------------|
| `/api/tickets/*` | `ticketSchemas.create`, `.update`, `.query` |
| `/api/users/*` | `userSchemas.create`, `.update`, `.query` |
| `/api/comments/*` | `commentSchemas.create`, `.update` |
| `/api/tickets/[id]/attachments` | `attachmentSchemas.create` |
| `/api/categories/*` | `categorySchemas.create`, `.update` |
| `/api/priorities/*` | `prioritySchemas.create`, `.update` |
| `/api/statuses/*` | `statusSchemas.create`, `.update` |
| `/api/knowledge/*` | `kbArticleSchemas.create`, `.update` |
| `/api/problems/*` | `problemSchemas.create`, `.update`, `.query` |
| `/api/cmdb/*` | `cmdbSchemas.create`, `.update`, `.query` |
| `/api/teams/*` | `teamSchemas.create`, `.update` |
| `/api/workflows/*` | `workflowSchemas.createDefinition`, `.execute` |
| `/api/notifications/*` | `notificationSchemas.create`, `.query` |
| `/api/analytics/*` | `analyticsSchemas.query`, `.webVitals` |
| `/api/automations/*` | `automationSchemas.create`, `.update` |
| `/api/files/upload` | `fileUploadSchemas.upload` |
| `/api/integrations/email` | `integrationSchemas.email` |
| `/api/integrations/whatsapp` | `integrationSchemas.whatsapp` |
| `/api/search/*` | `searchSchemas.query`, `.semantic`, `.suggest` |
| `/api/ai/*` | `aiSchemas.classifyTicket`, `.generateResponse`, etc. |
| `/api/catalog/*` | `catalogSchemas.createRequest` |
| `/api/macros/*` | `macroSchemas.create`, `.apply` |
| `/api/templates/*` | `templateSchemas.create`, `.apply` |
| `/api/pwa/*` | `pwaSchemas.subscribe`, `.send` |

### 2.3 Lista de Arquivos para Editar

```bash
# Gerar lista completa de API routes
find app/api -name "route.ts" -o -name "route.ts.bak" | grep -v ".bak" | sort

# Total esperado: 189 arquivos
```

**Checklist de Progresso** (marque com ✅ conforme aplicar):

- [ ] `/app/api/tickets/route.ts`
- [ ] `/app/api/tickets/create/route.ts`
- [ ] `/app/api/tickets/[id]/route.ts`
- [ ] `/app/api/tickets/[id]/comments/route.ts`
- [ ] `/app/api/tickets/[id]/attachments/route.ts`
- [ ] `/app/api/users/route.ts`
- [ ] `/app/api/auth/register/route.ts` (já feito ✅)
- [ ] `/app/api/auth/login/route.ts`
- [ ] ... (186+ arquivos restantes)

---

## 📋 FASE 3: AUDIT LOGGING (15-30 minutos)

### 3.1 Auth Endpoints

**Aplicar em**:

1. **Login Success** - `/app/api/auth/login/route.ts`

```typescript
import { logLoginSuccess, logLoginFailure } from '@/lib/security/audit-logger';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user = await authenticateUser(email, password);

  if (!user) {
    logLoginFailure(tenantId, email, 'Invalid credentials', request);
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }

  logLoginSuccess(tenantId, user.id, request);
  // ...
}
```

2. **Password Change** - `/app/api/auth/change-password/route.ts`

```typescript
import { logPasswordChange } from '@/lib/security/audit-logger';

export async function POST(request: NextRequest) {
  // Change password logic

  logPasswordChange(tenantId, userId, request);
  // ...
}
```

### 3.2 Admin Actions

**Aplicar em todos os endpoints admin** (23 arquivos):

```typescript
import { logRoleChange, logDataExport, extractRequestMetadata } from '@/lib/security/audit-logger';

// Role change
export async function PUT(request: NextRequest) {
  // Get user
  const oldRole = user.role;

  // Update role
  user.role = newRole;
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(newRole, userId);

  // LOG
  logRoleChange(tenantId, adminUserId, userId, oldRole, newRole, request);
}

// Data export
export async function GET(request: NextRequest) {
  const data = exportData();

  logDataExport(tenantId, userId, 'tickets', data.length, request);

  return NextResponse.json(data);
}
```

### 3.3 File Operations

**Aplicar em** `/app/api/tickets/[id]/attachments/route.ts`:

```typescript
import { logFileUpload } from '@/lib/security/audit-logger';

export async function POST(request: NextRequest) {
  // Upload file
  const { filename, fileSize } = uploadedFile;

  // LOG
  logFileUpload(
    tenantId,
    userId,
    filename,
    fileSize,
    'ticket',
    ticketId,
    request
  );
}
```

### 3.4 Security Events

**Aplicar em middleware** e **APIs críticas**:

```typescript
import { logCSRFViolation, logSuspiciousActivity } from '@/lib/security/audit-logger';

// CSRF failure
if (!csrfValid) {
  logCSRFViolation(tenantId, userId, request);
  return NextResponse.json({ error: 'CSRF failed' }, { status: 403 });
}

// Suspicious activity
if (detectSQLInjection(input)) {
  logSuspiciousActivity(
    tenantId,
    userId,
    'sql_injection_attempt',
    { input, path: request.nextUrl.pathname },
    request
  );
}
```

---

## 📋 FASE 4: STORAGE QUOTAS (15 minutos)

### 4.1 Upload Endpoint

**Editar** `/app/api/tickets/[id]/attachments/route.ts`:

```typescript
import { canUploadFile, recordFileUpload } from '@/lib/security/storage-quota';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const fileSize = file.size;

  // 1. CHECK QUOTA
  const quotaCheck = canUploadFile(userId, tenantId, fileSize);
  if (!quotaCheck.allowed) {
    return NextResponse.json({
      error: quotaCheck.reason
    }, { status: 413 }); // Payload Too Large
  }

  // 2. UPLOAD FILE
  const savedPath = await saveFile(file);

  // 3. SAVE TO DB
  db.prepare(`
    INSERT INTO attachments (ticket_id, filename, file_path, file_size, uploaded_by, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ticketId, file.name, savedPath, fileSize, userId, tenantId);

  // 4. RECORD USAGE
  recordFileUpload(userId, tenantId, fileSize);

  return NextResponse.json({ success: true });
}
```

### 4.2 Delete Endpoint

**Adicionar em DELETE handler**:

```typescript
import { recordFileDeletion } from '@/lib/security/storage-quota';

export async function DELETE(request: NextRequest, { params }) {
  const attachment = db.prepare(`
    SELECT * FROM attachments WHERE id = ?
  `).get(params.id);

  // Delete file
  await fs.unlink(attachment.file_path);

  // Delete from DB
  db.prepare(`DELETE FROM attachments WHERE id = ?`).run(params.id);

  // UPDATE QUOTA
  recordFileDeletion(attachment.uploaded_by, attachment.tenant_id, attachment.file_size);

  return NextResponse.json({ success: true });
}
```

### 4.3 Admin Dashboard

**Criar** `/app/admin/storage/page.tsx`:

```typescript
import { getTenantStorageStats, formatBytes } from '@/lib/security/storage-quota';

export default async function StoragePage() {
  const stats = getTenantStorageStats(tenantId);

  return (
    <div>
      <h1>Armazenamento</h1>
      <p>Total usado: {formatBytes(stats.total_used)} / {formatBytes(stats.total_quota)}</p>
      <p>Total de arquivos: {stats.total_files}</p>

      <h2>Usuários com Mais Armazenamento</h2>
      <ul>
        {stats.top_users.map(user => (
          <li key={user.user_id}>
            {user.name}: {formatBytes(user.used_bytes)} ({user.file_count} arquivos)
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 📋 FASE 5: WEBHOOK SECURITY (10 minutos)

### 5.1 Email Webhook

**Editar** `/app/api/integrations/email/webhook/route.ts`:

```typescript
import { verifyWebhookSignature } from '@/lib/security/webhook-security';

export async function POST(request: NextRequest) {
  // VERIFY SIGNATURE
  const verification = await verifyWebhookSignature(request, {
    secret: process.env.EMAIL_WEBHOOK_SECRET!,
    timestampToleranceSeconds: 300
  });

  if (!verification.valid) {
    return NextResponse.json({
      error: verification.error
    }, { status: 403 });
  }

  // PROCESS WEBHOOK
  const body = await request.json();
  // ... process email webhook ...

  return NextResponse.json({ success: true });
}
```

### 5.2 WhatsApp Webhook

**Editar** `/app/api/integrations/whatsapp/webhook/route.ts`:

```typescript
import { verifyWebhookSignature, logWebhookActivity } from '@/lib/security/webhook-security';

export async function POST(request: NextRequest) {
  // VERIFY SIGNATURE
  const verification = await verifyWebhookSignature(request, {
    secret: process.env.WHATSAPP_WEBHOOK_SECRET!
  });

  if (!verification.valid) {
    logWebhookActivity('whatsapp', false, { error: verification.error });
    return NextResponse.json({ error: verification.error }, { status: 403 });
  }

  // PROCESS WEBHOOK
  const body = await request.json();
  // ... process WhatsApp webhook ...

  logWebhookActivity('whatsapp', true, { messageId: body.id });

  return NextResponse.json({ success: true });
}
```

---

## 📋 FASE 6: PASSWORD POLICY (10 minutos)

### 6.1 Integrate em Register

**Já aplicado em** `/app/api/auth/register/route.ts` ✅

### 6.2 Create Change Password Endpoint

**Criar** `/app/api/auth/change-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, storePasswordHistory } from '@/lib/security/password-policy';
import { hashPassword } from '@/lib/auth/sqlite-auth';
import { logPasswordChange } from '@/lib/security/audit-logger';
import db from '@/lib/db/connection';

export async function POST(request: NextRequest) {
  const { userId, tenantId, oldPassword, newPassword } = await request.json();

  // 1. VERIFY OLD PASSWORD
  const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId);
  const isValid = await bcrypt.compare(oldPassword, user.password_hash);

  if (!isValid) {
    return NextResponse.json({
      error: 'Senha atual incorreta'
    }, { status: 401 });
  }

  // 2. VALIDATE NEW PASSWORD
  const validation = await validatePassword(newPassword, userId, tenantId);

  if (!validation.isValid) {
    return NextResponse.json({
      errors: validation.errors,
      warnings: validation.warnings
    }, { status: 400 });
  }

  // 3. HASH AND UPDATE
  const newHash = await hashPassword(newPassword);

  db.prepare(`
    UPDATE users
    SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newHash, userId);

  // 4. STORE IN HISTORY
  await storePasswordHistory(userId, tenantId, newHash);

  // 5. LOG
  logPasswordChange(tenantId, userId, request);

  return NextResponse.json({
    success: true,
    message: 'Senha alterada com sucesso'
  });
}
```

---

## 📋 FASE 7: SESSION MANAGEMENT (15 minutos)

### 7.1 Integrate Account Lockout em Login

**Editar** `/app/api/auth/login/route.ts`:

```typescript
import {
  isAccountLocked,
  recordFailedLogin,
  clearFailedLoginAttempts,
  createSession,
  regenerateSessionId
} from '@/lib/security/session-manager';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const metadata = extractRequestMetadata(request);

  // 1. CHECK IF ACCOUNT IS LOCKED
  const lockStatus = isAccountLocked(tenantId, email);
  if (lockStatus.locked) {
    return NextResponse.json({
      error: `Conta bloqueada. Tente novamente em ${lockStatus.minutesRemaining} minutos.`
    }, { status: 429 });
  }

  // 2. AUTHENTICATE
  const user = await authenticateUser(email, password);

  if (!user) {
    // RECORD FAILED ATTEMPT
    const lockResult = recordFailedLogin(
      tenantId,
      email,
      metadata.ip_address,
      metadata.user_agent
    );

    if (lockResult.locked) {
      return NextResponse.json({
        error: `Muitas tentativas falhadas. Conta bloqueada por ${lockResult.lockoutMinutes} minutos.`
      }, { status: 429 });
    }

    return NextResponse.json({
      error: 'Credenciais inválidas'
    }, { status: 401 });
  }

  // 3. CLEAR FAILED ATTEMPTS
  clearFailedLoginAttempts(tenantId, email);

  // 4. CREATE SESSION
  const sessionId = createSession(
    user.id,
    tenantId,
    generateDeviceFingerprint(request),
    metadata.ip_address,
    metadata.user_agent
  );

  // 5. GENERATE TOKENS
  // ... (código existente)

  return NextResponse.json({ success: true });
}
```

### 7.2 Session Regeneration

**Após autenticação bem-sucedida**:

```typescript
// Após login inicial com JWT temporário
const oldSessionId = request.cookies.get('session_id')?.value;

if (oldSessionId) {
  const newSessionId = regenerateSessionId(oldSessionId);

  response.cookies.set('session_id', newSessionId!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 2 // 2 hours
  });
}
```

---

## 📋 FASE 8: QUERY OPTIMIZATION (30-60 minutos)

### 8.1 Add LIMIT to All List Queries

**Pattern**:

```typescript
// ANTES
const tickets = db.prepare(`
  SELECT * FROM tickets
  WHERE tenant_id = ?
  ORDER BY created_at DESC
`).all(tenantId);

// DEPOIS
const page = parseInt(searchParams.get('page') || '1');
const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
const offset = (page - 1) * limit;

const tickets = db.prepare(`
  SELECT * FROM tickets
  WHERE tenant_id = ?
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`).all(tenantId, limit, offset);

const total = db.prepare(`
  SELECT COUNT(*) as count FROM tickets
  WHERE tenant_id = ?
`).get(tenantId).count;

return NextResponse.json({
  data: tickets,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  }
});
```

### 8.2 Arquivos para Editar

**List endpoints**:

- [ ] `/app/api/tickets/route.ts` GET
- [ ] `/app/api/users/route.ts` GET
- [ ] `/app/api/knowledge/route.ts` GET
- [ ] `/app/api/problems/route.ts` GET
- [ ] `/app/api/cmdb/route.ts` GET
- [ ] `/app/api/teams/route.ts` GET
- [ ] `/app/api/categories/route.ts` GET
- [ ] `/app/api/priorities/route.ts` GET
- [ ] `/app/api/statuses/route.ts` GET
- [ ] `/app/api/notifications/route.ts` GET

### 8.3 Query Timeout

**Criar helper** `/lib/db/query-timeout.ts`:

```typescript
export async function queryWithTimeout<T>(
  queryFn: () => T,
  timeoutMs: number = 5000
): Promise<T> {
  return Promise.race([
    Promise.resolve(queryFn()),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    )
  ]);
}

// Uso:
const result = await queryWithTimeout(
  () => db.prepare(complexSQL).all(...params),
  5000
);
```

---

## 📋 FASE 9: TENANT ISOLATION (30 minutos)

### 9.1 Audit Admin Endpoints

**Pattern**:

```typescript
// ANTES (vulnerável)
const user = db.prepare(`
  SELECT * FROM users WHERE id = ?
`).get(userId);

// DEPOIS (seguro)
const user = db.prepare(`
  SELECT * FROM users
  WHERE id = ? AND tenant_id = ?
`).get(userId, adminTenantId);

// Para super admins (opcional)
import { validateTenantAccess } from '@/lib/security/tenant-isolation';

if (!validateTenantAccess(resourceTenantId, userTenantId, userRole)) {
  return NextResponse.json({
    error: 'Access denied: cross-tenant access not allowed'
  }, { status: 403 });
}
```

### 9.2 Criar Helper

**Criar** `/lib/security/tenant-isolation.ts`:

```typescript
export function validateTenantAccess(
  resourceTenantId: number,
  userTenantId: number,
  userRole: string
): boolean {
  // Super admins can access any tenant
  if (userRole === 'super_admin') {
    return true;
  }

  // Regular users can only access their own tenant
  return resourceTenantId === userTenantId;
}

export function addTenantFilter(
  sql: string,
  userTenantId: number,
  userRole: string
): { sql: string; params: unknown[] } {
  if (userRole === 'super_admin') {
    return { sql, params: [] };
  }

  return {
    sql: sql + ' AND tenant_id = ?',
    params: [userTenantId]
  };
}
```

### 9.3 Admin Endpoints para Auditar

**23 arquivos** em `/app/api/admin/`:

- [ ] `/app/api/admin/users/route.ts`
- [ ] `/app/api/admin/users/[id]/route.ts`
- [ ] `/app/api/admin/tickets/route.ts`
- [ ] `/app/api/admin/tickets/[id]/route.ts`
- [ ] `/app/api/admin/categories/route.ts`
- [ ] `/app/api/admin/categories/[id]/route.ts`
- [ ] ... (17+ restantes)

---

## 📋 FASE 10: TESTES (30 minutos)

### 10.1 Run Security Test Suite

```bash
# Create test file
cat > tests/security/complete-security-suite.test.ts << 'EOF'
# (Copiar conteúdo do relatório - seção Agent 19)
EOF

# Run tests
npm run test:security:unit
```

### 10.2 Manual Testing Checklist

**Validação Zod**:
- [ ] POST /api/tickets sem title → 400 error
- [ ] POST /api/users com email inválido → 400 error
- [ ] POST /api/tickets com description > 10000 chars → 400 error

**Password Policy**:
- [ ] Registrar com senha "password" → 400 error
- [ ] Registrar com senha "StrongP@ss123" → 200 success
- [ ] Trocar senha para uma já usada → 400 error

**Account Lockout**:
- [ ] 5 logins falhados → 429 error "Conta bloqueada"
- [ ] Aguardar 30 min → Login permitido

**Storage Quotas**:
- [ ] Upload de arquivo 500MB → 200 success
- [ ] Upload de arquivo 2GB → 413 error
- [ ] Verificar dashboard de storage

**Webhook Security**:
- [ ] POST webhook sem signature → 403 error
- [ ] POST webhook com signature inválida → 403 error
- [ ] POST webhook válido → 200 success

**Audit Logging**:
- [ ] Login → Criar registro em audit_logs
- [ ] Trocar senha → Criar registro
- [ ] Fazer upload → Criar registro
- [ ] Query audit logs via API

---

## 📋 FASE 11: DEPLOY (15 minutos)

### 11.1 Pre-Deploy Checklist

```bash
# 1. Run all tests
npm test

# 2. Type check
npm run type-check

# 3. Lint
npm run lint

# 4. Build
npm run build

# 5. Check env vars
npm run env:validate
```

### 11.2 Production Environment

**Ensure .env has**:

```bash
NODE_ENV=production

# Security (MUST be strong random values)
CSRF_SECRET=<64-char-hex>
JWT_SECRET=<64-char-hex>
WEBHOOK_SECRET=<64-char-hex>

# Database (production)
DATABASE_URL=<postgresql-connection-string>

# Sentry (production)
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ORG=<your-org>
SENTRY_PROJECT=<your-project>
```

### 11.3 Database Migration

```bash
# Run migrations in production
npm run migrate:run

# Initialize security tables
npx tsx scripts/init-security-tables.ts
```

### 11.4 Monitoring Setup

**Create** `scripts/monitor-security.ts`:

```typescript
import { getSessionStats } from '@/lib/security/session-manager';
import { getAuditLogStats } from '@/lib/security/audit-logger';

const tenantId = 1;
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

const sessionStats = getSessionStats(tenantId);
const auditStats = getAuditLogStats(
  tenantId,
  startDate.toISOString(),
  new Date().toISOString()
);

console.log('Security Monitoring Report');
console.log('=========================');
console.log('Active sessions:', sessionStats.active_sessions);
console.log('Failed logins (24h):', sessionStats.failed_attempts_24h);
console.log('Locked accounts:', sessionStats.locked_accounts);
console.log('Audit events (7d):', auditStats.total_events);
console.log('Critical events:', auditStats.by_severity.critical || 0);
```

---

## 📋 FASE 12: DOCUMENTAÇÃO (15 minutos)

### 12.1 Update API Documentation

**Adicionar a** `docs/api/security.md`:

```markdown
# Security API Documentation

## Authentication

All API requests require authentication via JWT token in httpOnly cookie.

### Rate Limits

- Login: 5 attempts per 30 minutes per IP
- API requests: 100 per minute per user
- File uploads: 10 per hour per user

### Headers Required

- `x-csrf-token`: CSRF token (for POST/PUT/DELETE requests)
- `Authorization`: Bearer token (if not using cookies)

## Error Codes

- 400: Validation failed
- 401: Unauthorized (invalid credentials)
- 403: Forbidden (CSRF failure, access denied)
- 413: Payload too large (storage quota exceeded)
- 429: Too many requests (rate limit or account locked)

## Security Events

All security events are logged in `audit_logs` table:
- Login success/failure
- Password changes
- Role changes
- File uploads/deletes
- Suspicious activity
```

### 12.2 Update Team Documentation

**Criar** `docs/security/TEAM_GUIDE.md`:

```markdown
# Security Implementation Guide for Developers

## 1. Always Validate Input

Use Zod schemas from `/lib/validation/schemas.ts`:

\`\`\`typescript
import { ticketSchemas } from '@/lib/validation/schemas';

const result = ticketSchemas.create.safeParse(body);
if (!result.success) {
  return NextResponse.json({ errors: result.error.errors }, { status: 400 });
}
\`\`\`

## 2. Always Add Audit Logging

For critical operations:

\`\`\`typescript
import { logLoginSuccess, logDataExport } from '@/lib/security/audit-logger';

logLoginSuccess(tenantId, userId, request);
\`\`\`

## 3. Always Check Tenant Isolation

\`\`\`typescript
const resource = db.prepare(\`
  SELECT * FROM resources WHERE id = ? AND tenant_id = ?
\`).get(id, userTenantId);
\`\`\`

## 4. Always Use Pagination

\`\`\`typescript
const limit = Math.min(parseInt(query.limit || '25'), 100);
const offset = (page - 1) * limit;

const results = db.prepare(\`
  SELECT * FROM table LIMIT ? OFFSET ?
\`).all(limit, offset);
\`\`\`
```

---

## ✅ VALIDAÇÃO FINAL

### Checklist de Conclusão

**Segurança**:
- [ ] ✅ Todas as 189 APIs têm validação Zod
- [ ] ✅ Audit logging em endpoints críticos
- [ ] ✅ Storage quotas em upload endpoints
- [ ] ✅ Webhook security em integrations
- [ ] ✅ Password policy integrado
- [ ] ✅ Account lockout funcionando
- [ ] ✅ Tenant isolation em admin APIs
- [ ] ✅ Query pagination em list endpoints

**Testes**:
- [ ] ✅ Suite de testes passa
- [ ] ✅ npm audit = 0 vulnerabilities
- [ ] ✅ Type check sem erros
- [ ] ✅ Build bem-sucedido

**Documentação**:
- [ ] ✅ API docs atualizados
- [ ] ✅ Team guide criado
- [ ] ✅ .env.example atualizado

**Deploy**:
- [ ] ✅ Migrations executados
- [ ] ✅ Security tables criadas
- [ ] ✅ Environment variables configuradas
- [ ] ✅ Monitoring configurado

---

## 🎉 CONCLUSÃO

Após completar TODAS as fases deste checklist, seu sistema terá:

✅ **100% das APIs validadas**
✅ **Audit logging completo**
✅ **Password policy enterprise-grade**
✅ **Account lockout protection**
✅ **Storage quotas funcionais**
✅ **Webhook security com HMAC**
✅ **Session management robusto**
✅ **Query optimization com pagination**
✅ **Tenant isolation completo**

**Tempo Estimado Total**: 4-6 horas

**Próximos Passos**:
1. Monitorar logs de segurança
2. Revisar audit logs semanalmente
3. Atualizar dependências mensalmente
4. Treinar equipe nos novos padrões

---

**Documento Gerado**: 2025-12-26
**Versão**: 1.0.0
**Baseado em**: AGENTS_7-20_SECURITY_IMPLEMENTATION_REPORT.md
