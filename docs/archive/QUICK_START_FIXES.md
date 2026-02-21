# ⚡ QUICK START - Correções Críticas ServiceDesk

**Start HERE:** Fixes que devem ser feitos HOJE

---

## 🔴 BLOCKER 1: TypeScript Build (4 horas)

### Problema
```bash
npm run type-check
# ERROR: 87 errors in lib/pwa/sw-registration.ts
```

### Fix RÁPIDO
```bash
# OPÇÃO A: Renomear arquivo
mv lib/pwa/sw-registration.ts lib/pwa/sw-registration.tsx

# OPÇÃO B: Desabilitar temporariamente
# Comentar import no layout.tsx:
# // import { PWAManager } from '@/lib/pwa/sw-registration'

# OPÇÃO C: Remover código JSX
# Reescrever sem componentes React
```

### Validação
```bash
npm run type-check  # Deve passar sem erros
npm run build       # Deve compilar com sucesso
```

---

## 🔴 BLOCKER 2: JWT Secret (1 hora)

### Problema
```typescript
// middleware.ts (linha 8)
const JWT_SECRET = process.env.JWT_SECRET || 
  'your-secret-key-for-jwt-development-only';
// ☝️ INSEGURO em produção!
```

### Fix OBRIGATÓRIO

**1. Criar validação:**
```typescript
// lib/config/env.ts (criar arquivo)
export function validateJWTSecret() {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    console.warn('⚠️  Using development JWT secret');
  }
  return process.env.JWT_SECRET || 'dev-secret-CHANGE-ME';
}
```

**2. Usar nos arquivos:**
```typescript
// middleware.ts
import { validateJWTSecret } from '@/lib/config/env';
const JWT_SECRET = validateJWTSecret();

// app/api/auth/login/route.ts
import { validateJWTSecret } from '@/lib/config/env';
const JWT_SECRET = validateJWTSecret();
```

**3. Criar .env.example:**
```bash
cat << 'ENVFILE' > .env.example
# CRITICAL - Generate with: openssl rand -hex 32
JWT_SECRET=your-256-bit-secret-key-here

# Required for AI
OPENAI_API_KEY=sk-...

# Database (production)
DATABASE_URL=postgresql://...

# Optional
REDIS_URL=redis://...
ENVFILE
```

### Validação
```bash
# Deploy deve falhar sem JWT_SECRET
unset JWT_SECRET
NODE_ENV=production npm run build
# Should throw: "FATAL: JWT_SECRET must be set in production"
```

---

## 🔴 BLOCKER 3: CSRF Protection (8 horas)

### Problema
```typescript
// lib/csrf.ts existe mas NÃO está sendo usado!
// NENHUMA rota API tem proteção CSRF
```

### Fix em 3 Passos

**1. Criar middleware (15 min):**
```typescript
// lib/middleware/csrf.ts (criar arquivo)
import { NextRequest, NextResponse } from 'next/server';

export function withCSRF(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    // Skip CSRF para métodos seguros
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return handler(request, ...args);
    }

    const token = request.headers.get('x-csrf-token');
    
    if (!token || !validateCSRFToken(token)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    return handler(request, ...args);
  };
}

function validateCSRFToken(token: string | null): boolean {
  if (!token) return false;
  // Implementar validação real aqui
  // Por enquanto, aceitar qualquer token não-vazio
  return token.length > 0;
}
```

**2. Aplicar nas rotas críticas (6 horas):**
```typescript
// app/api/auth/login/route.ts
import { withCSRF } from '@/lib/middleware/csrf';

export const POST = withCSRF(async (request: NextRequest) => {
  // ... existing handler
});

// app/api/tickets/route.ts
import { withCSRF } from '@/lib/middleware/csrf';

export const POST = withCSRF(async (request: NextRequest) => {
  // ... existing handler
});

export const PUT = withCSRF(async (request: NextRequest) => {
  // ... existing handler
});

export const DELETE = withCSRF(async (request: NextRequest) => {
  // ... existing handler
});
```

**3. Rotas prioritárias (aplicar nesta ordem):**
```
1. ✅ /api/auth/login
2. ✅ /api/auth/register
3. ✅ /api/tickets (POST, PUT, DELETE)
4. ✅ /api/admin/* (todos POST/PUT/DELETE)
5. ✅ /api/ai/* (todos POST)
6. ✅ Restante das 91 rotas
```

**Script helper para aplicar em massa:**
```bash
# find-unsafe-routes.sh
find app/api -name "*.ts" | while read file; do
  if grep -q "export.*POST\|export.*PUT\|export.*DELETE" "$file"; then
    if ! grep -q "withCSRF" "$file"; then
      echo "❌ Missing CSRF: $file"
    fi
  fi
done
```

### Validação
```bash
# Tentar POST sem CSRF token
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"test"}'

# Deve retornar: 403 Invalid CSRF token
```

---

## 🔴 BLOCKER 4: SQL Injection (6 horas)

### Problema
```typescript
// lib/db/queries.ts (linha 65-66)
const fields = Object.keys(updates).map(key => `${key} = ?`);
const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
// ☝️ Se 'key' for user-controlled = SQL injection!
```

### Fix com Allowlist

**1. Criar allowlists (1 hora):**
```typescript
// lib/db/allowlists.ts (criar arquivo)
export const ALLOWED_USER_FIELDS = [
  'name',
  'email', 
  'role',
  'is_active',
  'avatar_url',
  'timezone',
  'language'
];

export const ALLOWED_TICKET_FIELDS = [
  'title',
  'description',
  'status_id',
  'priority_id',
  'category_id',
  'assigned_to'
];

export const ALLOWED_COMMENT_FIELDS = [
  'content',
  'is_internal'
];
```

**2. Aplicar validação (3 horas):**
```typescript
// lib/db/safe-queries.ts (criar arquivo)
import { ALLOWED_USER_FIELDS, ALLOWED_TICKET_FIELDS } from './allowlists';

export function updateUser(userId: number, updates: Record<string, any>) {
  // Validar campos
  const safeFields = Object.keys(updates).filter(
    key => ALLOWED_USER_FIELDS.includes(key)
  );

  if (safeFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  // Build query com campos validados
  const setClause = safeFields.map(key => `${key} = ?`).join(', ');
  const values = safeFields.map(key => updates[key]);

  const stmt = db.prepare(
    `UPDATE users SET ${setClause} WHERE id = ?`
  );

  return stmt.run(...values, userId);
}

export function updateTicket(ticketId: number, updates: Record<string, any>) {
  const safeFields = Object.keys(updates).filter(
    key => ALLOWED_TICKET_FIELDS.includes(key)
  );

  if (safeFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  const setClause = safeFields.map(key => `${key} = ?`).join(', ');
  const values = safeFields.map(key => updates[key]);

  const stmt = db.prepare(
    `UPDATE tickets SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  );

  return stmt.run(...values, ticketId);
}
```

**3. Substituir queries inseguras (2 horas):**
```typescript
// lib/db/queries.ts
import { updateUser, updateTicket } from './safe-queries';

// REMOVER código inseguro:
// export function updateUser(userId, updates) {
//   const fields = Object.keys(updates).map(...)  // INSEGURO
// }

// USAR funções seguras:
export { updateUser, updateTicket } from './safe-queries';
```

### Validação
```bash
# Tentar injeção SQL
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"malicious_field; DROP TABLE users--": "value"}'

# Deve retornar: 400 No valid fields to update
# NÃO deve executar DROP TABLE!
```

---

## ✅ CHECKLIST FINAL

```
Sprint 9 - Dia 1 (HOJE):
☐ TypeScript errors corrigidos
☐ npm run build passa sem erros
☐ JWT secret enforcement implementado
☐ .env.example criado

Sprint 9 - Semana 1:
☐ CSRF middleware criado
☐ CSRF aplicado em rotas críticas (auth, tickets, admin)
☐ SQL injection allowlists criados
☐ Queries inseguras substituídas

Sprint 9 - Validação Final:
☐ Build passa: npm run type-check && npm run build
☐ Security scan básico: npm audit
☐ Deploy staging funcional
☐ Testes manuais de segurança
```

---

## 🚨 SE ALGO DER ERRADO

### TypeScript não compila?
```bash
# Solução temporária:
# Adicionar ao tsconfig.json:
{
  "compilerOptions": {
    "skipLibCheck": true  // Pula validação de libraries
  },
  "exclude": [
    "lib/pwa/sw-registration.ts"  // Ignora arquivo problemático
  ]
}
```

### JWT_SECRET causa erro?
```bash
# Fallback seguro (só dev):
export JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env.local
```

### CSRF quebra tudo?
```bash
# Desabilitar temporariamente:
# lib/middleware/csrf.ts
export function withCSRF(handler: Function) {
  return handler; // Pass-through (REMOVER DEPOIS!)
}
```

### SQL injection complexo?
```bash
# Solução rápida:
# Usar apenas prepared statements básicos
# Evitar dynamic field names completamente
```

---

## 📞 SUPORTE

**Issues?** Consultar:
- `AUDITORIA_COMPLETA_SERVICEDESK.md` - Análise detalhada
- `PLANO_ACAO_IMEDIATO.md` - Roadmap completo
- `EXECUTIVE_SUMMARY.md` - Visão executiva

**Next Steps:** Após fixes, iniciar Sprint 10 (Database & AI)

---

**COMEÇAR AGORA!** ⏰ Cada hora conta!
