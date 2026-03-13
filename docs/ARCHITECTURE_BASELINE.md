# Architecture Decision Baseline

This document is the **constitution** for all code in the ServiceDesk project.
Every API route, database query, and component MUST follow these rules.
Violations are bugs.

---

## 1. API Route Pattern (Canonical)

Every API handler follows this exact order:

1. **Rate limiting** -- reject abusive traffic before any work
2. **Authentication** -- verify identity via JWT
3. **Input validation** -- parse and validate with Zod
4. **Business logic** -- query/mutate data
5. **Response** -- return standardized JSON

### GET (List with Pagination)

```typescript
import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, sqlNow } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { z } from 'zod';
import logger from '@/lib/monitoring/structured-logger';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(255).optional(),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    // 1. Rate limit
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
    if (rateLimitResponse) return rateLimitResponse;

    // 2. Auth
    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    // 3. Validate input
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }
    const { page, limit, search, sort, order } = parsed.data;

    // 4. Business logic
    const offset = (page - 1) * limit;
    const conditions = ['organization_id = ?'];
    const values: any[] = [auth.organizationId];

    if (search) {
      const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push("name LIKE ? ESCAPE '\\'");
      values.push(`%${escaped}%`);
    }

    const where = conditions.join(' AND ');
    const items = await executeQuery(
      `SELECT * FROM items WHERE ${where} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    const countRow = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM items WHERE ${where}`,
      values
    );
    const total = countRow?.total ?? 0;

    // 5. Response
    return apiSuccess(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error('GET /api/items failed', { error });
    return apiError('Internal server error', 500);
  }
}
```

### GET (Single by ID)

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
    if (rateLimitResponse) return rateLimitResponse;

    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    const { id } = await params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId) || itemId <= 0) return apiError('Invalid ID', 400);

    const item = await executeQueryOne(
      'SELECT * FROM items WHERE id = ? AND organization_id = ?',
      [itemId, auth.organizationId]
    );
    if (!item) return apiError('Not found', 404);

    return apiSuccess(item);
  } catch (error) {
    logger.error('GET /api/items/[id] failed', { error });
    return apiError('Internal server error', 500);
  }
}
```

### POST (Create)

```typescript
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.TICKET_MUTATION);
    if (rateLimitResponse) return rateLimitResponse;

    const { auth, response } = requireTenantUserContext(request);
    if (response) return response;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);

    const { name, description } = parsed.data;
    const sanitizedDesc = sanitizeHTML(description);

    const result = await executeRun(
      `INSERT INTO items (name, description, organization_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ${sqlNow()})`,
      [name, sanitizedDesc, auth.organizationId, auth.userId]
    );

    return apiSuccess({ id: result.lastInsertRowid }, undefined, 201);
  } catch (error) {
    logger.error('POST /api/items failed', { error });
    return apiError('Internal server error', 500);
  }
}
```

### PUT (Update) and DELETE

Follow the same pattern: rate limit, auth, validate, verify ownership via `organization_id`, execute, respond.

**DO:**
```typescript
const { auth, response } = requireTenantUserContext(request);
if (response) return response;
```

**DON'T:**
```typescript
// DEPRECATED -- never use these directly
const user = verifyToken(request);
const tenant = getTenantContextFromRequest(request);
```

---

## 2. Response Format Standard

All responses use helpers from `lib/api/api-helpers.ts`.

### Success (single item)
```json
{ "success": true, "data": { "id": 1, "name": "..." } }
```
```typescript
return apiSuccess(item);             // 200
return apiSuccess(item, undefined, 201); // 201 Created
```

### Success (paginated list)
```json
{
  "success": true,
  "data": [{ "id": 1 }, { "id": 2 }],
  "meta": { "page": 1, "limit": 25, "total": 42, "totalPages": 2 }
}
```
```typescript
return apiSuccess(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
```

### Error
```json
{ "success": false, "error": "Resource not found" }
```
```typescript
return apiError('Resource not found', 404);
```

### Status Code Reference

| Code | Meaning           | When to use                                    |
|------|-------------------|------------------------------------------------|
| 200  | OK                | Successful GET, PUT, DELETE                    |
| 201  | Created           | Successful POST that creates a resource        |
| 400  | Bad Request       | Invalid input, malformed JSON, bad parameters  |
| 401  | Unauthorized      | Missing or invalid JWT                         |
| 403  | Forbidden         | Valid JWT but insufficient role/permissions     |
| 404  | Not Found         | Resource does not exist or wrong tenant         |
| 409  | Conflict          | Duplicate entry, unique constraint violation    |
| 422  | Validation Error  | Zod schema validation failure                  |
| 429  | Rate Limited      | Too many requests                              |
| 500  | Internal Error    | Unhandled server error (never expose details)  |

**DO:** `return apiError('Ticket not found', 404);`

**DON'T:** `return NextResponse.json({ error: 'not found' }, { status: 404 });`

---

## 3. Authentication & Authorization

### Auth Guard

Every protected route MUST use the unified guard as its first auth step:

```typescript
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

const { auth, context, response } = requireTenantUserContext(request);
if (response) return response;
// auth.userId, auth.organizationId, auth.role, auth.email are now available
```

### Super Admin Guard

Cross-tenant routes under `/api/admin/super/*` use:

```typescript
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';

const { auth, response } = requireSuperAdmin(request);
if (response) return response;
```

### Role Checks

```typescript
import { ADMIN_ROLES, TICKET_MANAGEMENT_ROLES, isAdmin } from '@/lib/auth/roles';

// Require admin-level access
const { auth, response } = requireTenantUserContext(request, {
  requireRoles: [...ADMIN_ROLES],
});

// Inline role check
if (!isAdmin(auth.role)) return apiError('Insufficient permissions', 403);
```

### Role Hierarchy (6 levels)
```
super_admin > admin > tenant_admin > team_manager > agent > user
```

**DO:** `const orgId = auth.organizationId; // from JWT`

**DON'T:** `const orgId = body.organization_id; // NEVER trust client input for org`

---

## 4. Database Access

### Adapter Functions

All database access goes through the adapter. No exceptions.

```typescript
import {
  executeQuery,      // SELECT -> T[]
  executeQueryOne,   // SELECT -> T | undefined
  executeRun,        // INSERT/UPDATE/DELETE -> { changes, lastInsertRowid? }
  executeTransaction // Transaction with isolation
} from '@/lib/db/adapter';
```

### Dialect Helpers

Use helpers for cross-database SQL compatibility (SQLite + PostgreSQL):

```typescript
import { sqlNow, sqlDateSub, sqlGroupConcat, sqlTrue, sqlFalse } from '@/lib/db/adapter';

// Timestamps
`created_at = ${sqlNow()}`           // NOW() or datetime('now')
`created_at > ${sqlDateSub(30)}`     // CURRENT_DATE - INTERVAL '30 days'

// Booleans
`is_active = ${sqlTrue()}`           // TRUE or 1

// Aggregation
`${sqlGroupConcat('tag_name', ',')}`  // STRING_AGG or GROUP_CONCAT
```

### Mandatory Rules

| Rule | Implementation |
|------|---------------|
| Tenant isolation | `WHERE organization_id = ?` on every query |
| Parameterized queries | `executeQuery('SELECT * FROM t WHERE id = ?', [id])` |
| LIKE escaping | `search.replace(/%/g, '\\%').replace(/_/g, '\\_')` |
| Pagination cap | `const limit = Math.min(parsed.limit, 100)` |
| Sort whitelist | `z.enum(['created_at', 'name', 'status'])` |
| Division safety | `NULLIF(divisor, 0)` |
| Empty IN clause | Check `ids.length > 0` before building `IN (?)` |
| Transaction isolation | Use `db` param inside `executeTransaction(async (db) => { ... })` |

**DO:**
```typescript
const items = await executeQuery(
  'SELECT * FROM tickets WHERE organization_id = ? AND status = ?',
  [auth.organizationId, status]
);
```

**DON'T:**
```typescript
// SQL injection risk -- NEVER interpolate user input
const items = await executeQuery(
  `SELECT * FROM tickets WHERE organization_id = ${orgId} AND status = '${status}'`
);
```

---

## 5. Input Validation

### Zod Schemas

Define schemas in `lib/validation/schemas.ts` or inline for route-specific shapes.

```typescript
import { z } from 'zod';
import { commonSchemas } from '@/lib/validation/schemas';

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10000),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string().max(50)).max(10).optional(),
});
```

### Validation Pattern

```typescript
const body = await request.json();
const parsed = createSchema.safeParse(body);
if (!parsed.success) {
  return apiError(parsed.error.errors[0].message, 400);
}
const { title, description } = parsed.data;
```

### Sanitization

```typescript
import { sanitizeHTML, stripHTML } from '@/lib/security/sanitize';

const safeHtml = sanitizeHTML(body.content);   // Allow safe tags
const plainText = stripHTML(body.title);        // Remove all HTML
```

### Array Input Limits

```typescript
const ids = body.ticket_ids.slice(0, 50); // Cap at 50
```

**DO:** Validate at handler entry, before any business logic.

**DON'T:** Trust raw `request.json()` without schema validation.

---

## 6. Multi-Tenancy

Every data query MUST be scoped to the authenticated user's organization.

### Rules

1. **SELECT**: `WHERE organization_id = ?` with `auth.organizationId`
2. **INSERT**: Include `organization_id` from `auth.organizationId`
3. **UPDATE/DELETE**: Include `WHERE organization_id = ?` to prevent cross-tenant mutation
4. **Cache keys**: Prefix with `org:${auth.organizationId}:`
5. **Search**: Scope by tenant before applying filters
6. **Exceptions**: System tables (`roles`, `permissions`, `sso_providers`) have no `organization_id`

**DO:**
```typescript
const tickets = await executeQuery(
  'SELECT * FROM tickets WHERE organization_id = ? AND status = ?',
  [auth.organizationId, 'open']
);
```

**DON'T:**
```typescript
// Missing tenant scope -- leaks cross-tenant data
const tickets = await executeQuery(
  'SELECT * FROM tickets WHERE status = ?',
  ['open']
);
```

---

## 7. Error Handling

### Pattern

Every handler is wrapped in `try/catch`:

```typescript
export async function GET(request: NextRequest) {
  try {
    // ... rate limit, auth, validation, logic, response
  } catch (error) {
    logger.error('GET /api/items failed', { error });
    return apiError('Internal server error', 500);
  }
}
```

### Rules

| Rule | Detail |
|------|--------|
| Log with logger | `import logger from '@/lib/monitoring/structured-logger'` |
| Never expose internals | Return generic message; log the real error |
| Never use console.log | Use `logger.info()`, `logger.warn()`, `logger.error()` |
| Include context in logs | `logger.error('msg', { userId, path, error })` |

**DO:** `logger.error('Failed to create ticket', { error, userId: auth.userId });`

**DON'T:** `console.log(error.stack); return apiError(error.message, 500);`

---

## 8. Security Checklist

Every endpoint MUST satisfy all applicable items:

- [ ] **Rate limiting**: `applyRateLimit(request, RATE_LIMITS.*)` at handler entry
- [ ] **CSRF**: Mutations (POST/PUT/PATCH/DELETE) validated by middleware automatically
- [ ] **XSS sanitization**: User-supplied HTML passed through `sanitizeHTML()` before storage
- [ ] **SQL injection**: All queries use parameterized `?` placeholders; LIKE wildcards escaped
- [ ] **RBAC**: Role checked via `requireTenantUserContext({ requireRoles })` or inline
- [ ] **Tenant isolation**: Every query scoped by `organization_id` from JWT
- [ ] **File upload validation**: Validate MIME type, enforce size limit, reject path traversal
- [ ] **No secret leakage**: Error responses never include stack traces, SQL, or internal paths
- [ ] **Crypto-safe randomness**: Use `crypto.getRandomValues()` or `crypto.randomUUID()`, never `Math.random()`

**DO:**
```typescript
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex');
```

**DON'T:**
```typescript
const token = Math.random().toString(36).substring(2);
```

---

## 9. Code Organization

### Directory Responsibilities

| Directory | Responsibility | Contains |
|-----------|---------------|----------|
| `app/api/` | Thin route handlers | Auth + validation + service call + response |
| `lib/db/queries/` | Data access layer | SQL queries via adapter, tenant-scoped |
| `lib/validation/` | Input schemas | Zod schemas, reusable across routes |
| `lib/types/` | Type definitions | TypeScript interfaces matching DB schema |
| `lib/auth/` | Authentication | JWT, RBAC, MFA, SSO, password policies |
| `lib/security/` | Security utilities | CSRF, sanitization, encryption, CSP |
| `lib/tenant/` | Multi-tenancy | Context resolution, request guard |
| `lib/monitoring/` | Observability | Logger, Sentry, Datadog, metrics |
| `src/components/` | React components | Feature-grouped, with dark mode |
| `components/ui/` | Design system | Primitives (Button, Modal, Table, etc.) |

### Naming Conventions

- API routes: `app/api/{resource}/route.ts` (Next.js convention)
- Query modules: `lib/db/queries/{module}-queries.ts`
- Validation: `lib/validation/schemas.ts` (centralized)
- Types: `lib/types/{module}.ts`
- Components: PascalCase files in feature directories

**DO:** Keep API route handlers thin -- delegate complex logic to service/query modules.

**DON'T:** Put 500 lines of business logic directly in `route.ts`.

---

## 10. Deprecation Policy

### Deprecated Patterns (MUST NOT use in new code)

| Deprecated | Replacement |
|-----------|-------------|
| `verifyToken(request)` | `requireTenantUserContext(request)` |
| `getTenantContextFromRequest(request)` | `requireTenantUserContext(request)` |
| `getDatabase().prepare(sql)` | `executeQuery(sql, params)` |
| `NextResponse.json({ ... })` for success | `apiSuccess(data, meta?)` |
| `NextResponse.json({ error })` for errors | `apiError(message, status)` |
| `console.log` / `console.error` | `logger.info()` / `logger.error()` |
| `Math.random()` for tokens/secrets | `crypto.getRandomValues()` |
| Accepting `organization_id` from body | Use `auth.organizationId` from JWT |

### Route Versioning

**PROHIBITED**: Maintaining parallel `/api/v1/` and `/api/v2/` routes.
Always consolidate into a single route. If a breaking change is needed, migrate all consumers.

### Marking Deprecated Code

```typescript
/**
 * @deprecated Use requireTenantUserContext() from lib/tenant/request-guard.ts instead.
 * Scheduled for removal in next major version.
 */
export function verifyToken(request: NextRequest): UserInfo { ... }
```

**DO:** Add `@deprecated` JSDoc with the replacement path.

**DON'T:** Silently leave two competing patterns without marking one as deprecated.
