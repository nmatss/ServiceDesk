# API Migration Guide - ServiceDesk Pro

## 🚨 Critical Security Update Required

**Status**: 76 API routes need security migration
**Priority**: HIGH
**Impact**: Security vulnerabilities in existing routes

---

## Executive Summary

This guide provides a systematic approach to migrate all existing API routes to use the new security infrastructure. **All 76 routes** currently bypass critical security measures and must be updated.

### Current State
- ❌ Routes use manual validation
- ❌ Direct database queries without safe wrappers
- ❌ Inconsistent error handling
- ❌ No centralized authentication checks
- ❌ Missing tenant isolation validation

### Target State
- ✅ Zod schema validation
- ✅ Safe query wrappers
- ✅ Centralized error handling
- ✅ API helper utilities
- ✅ Multi-tenant security enforcement

---

## Migration Pattern

### Before (Insecure Pattern)
```typescript
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // ❌ Manual validation
    if (!data.title || !data.description) {
      return NextResponse.json(
        { success: false, error: 'Missing fields' },
        { status: 400 }
      )
    }

    // ❌ Direct database access
    const result = db.prepare(`
      INSERT INTO tickets (title, description)
      VALUES (?, ?)
    `).run(data.title, data.description)

    // ❌ Manual success response
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    // ❌ Generic error handling
    return NextResponse.json(
      { success: false, error: 'Failed' },
      { status: 500 }
    )
  }
}
```

### After (Secure Pattern) ✅
```typescript
import {
  apiHandler,
  getUserFromRequest,
  getTenantFromRequest,
  parseJSONBody,
  validateTenantAccess,
} from '@/lib/api/api-helpers'
import { NotFoundError } from '@/lib/errors/error-handler'
import { ticketSchemas } from '@/lib/validation/schemas'
import { safeQuery, safeTransaction } from '@/lib/db/safe-queries'

export const POST = apiHandler(async (request: NextRequest) => {
  // 1. Extract authenticated user
  const user = getUserFromRequest(request)
  const tenant = getTenantFromRequest(request)

  // 2. Validate input with Zod
  const data = await parseJSONBody(request, ticketSchemas.create)

  // 3. Validate tenant access
  validateTenantAccess(user, data.organization_id)

  // 4. Use safe query
  const result = safeQuery(
    () => db.prepare(`
      INSERT INTO tickets (tenant_id, user_id, title, description)
      VALUES (?, ?, ?, ?)
    `).run(tenant.id, user.id, data.title, data.description),
    'create ticket'
  )

  if (!result.success) {
    throw new Error(result.error)
  }

  // 5. Return data (apiHandler wraps in success response)
  return { ticket_id: result.data }
})
```

---

## Step-by-Step Migration

### Step 1: Import Security Modules

```typescript
import type { NextRequest } from 'next/server'
import {
  apiHandler,
  getUserFromRequest,
  getTenantFromRequest,
  parseJSONBody,
  parseQueryParams,
  getIdFromParams,
  requireAdmin,
  requireRole,
  validateTenantAccess,
} from '@/lib/api/api-helpers'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@/lib/errors/error-handler'
import { [entityName]Schemas } from '@/lib/validation/schemas'
import { safeQuery, safeTransaction } from '@/lib/db/safe-queries'
```

### Step 2: Wrap Handler with apiHandler

**Before:**
```typescript
export async function GET(request: NextRequest) {
  try {
    // ...
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}
```

**After:**
```typescript
export const GET = apiHandler(async (request: NextRequest) => {
  // ... (no try-catch needed)
  return data // apiHandler wraps in { success: true, data }
})
```

### Step 3: Extract User & Tenant

```typescript
export const GET = apiHandler(async (request: NextRequest) => {
  const user = getUserFromRequest(request)
  const tenant = getTenantFromRequest(request)

  // Now you have:
  // - user.id
  // - user.organization_id
  // - user.role
  // - tenant.id
  // - tenant.slug
})
```

### Step 4: Replace Manual Validation with Zod

**Before:**
```typescript
const data = await request.json()
if (!data.email || !data.password) {
  return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
}
```

**After:**
```typescript
const data = await parseJSONBody(request, userSchemas.create)
// Automatically validated with detailed error messages
```

### Step 5: Replace Direct DB Queries with Safe Wrappers

**Before:**
```typescript
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
if (!user) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
```

**After:**
```typescript
const result = safeQuery(
  () => db.prepare('SELECT * FROM users WHERE id = ?').get(userId),
  'get user'
)

if (!result.success || !result.data) {
  throw new NotFoundError('User')
}

const user = result.data
```

### Step 6: Add Multi-Tenant Security

```typescript
export const GET = apiHandler(async (request: NextRequest, context) => {
  const user = getUserFromRequest(request)
  const resourceId = getIdFromParams(context?.params)

  // Get resource
  const result = safeQuery(
    () => db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId),
    'get resource'
  )

  if (!result.success || !result.data) {
    throw new NotFoundError('Resource')
  }

  // ✅ Validate tenant access
  validateTenantAccess(user, result.data.organization_id)

  return result.data
})
```

### Step 7: Add Role-Based Access Control

**For admin-only routes:**
```typescript
export const DELETE = apiHandler(async (request: NextRequest) => {
  const user = getUserFromRequest(request)

  // ✅ Require admin role
  requireAdmin(user)

  // ... rest of logic
})
```

**For custom roles:**
```typescript
export const PUT = apiHandler(async (request: NextRequest) => {
  const user = getUserFromRequest(request)

  // ✅ Require specific roles
  requireRole(user, ['agent', 'admin', 'team_manager'])

  // ... rest of logic
})
```

### Step 8: Use Transactions for Multi-Step Operations

**Before:**
```typescript
const ticket = db.prepare('INSERT INTO tickets ...').run(...)
db.prepare('INSERT INTO comments ...').run(...)
db.prepare('INSERT INTO audit_logs ...').run(...)
```

**After:**
```typescript
const result = safeTransaction(db, (db) => {
  const ticketResult = db.prepare('INSERT INTO tickets ...').run(...)
  const ticketId = ticketResult.lastInsertRowid

  db.prepare('INSERT INTO comments ...').run(ticketId, ...)
  db.prepare('INSERT INTO audit_logs ...').run(ticketId, ...)

  return ticketId
}, 'create ticket with audit')

if (!result.success) {
  throw new Error(result.error)
}
```

### Step 9: Throw Proper Errors

**Instead of:**
```typescript
return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

**Use:**
```typescript
throw new NotFoundError('Resource')
// or
throw new ConflictError('Email already exists')
// or
throw new AuthorizationError('Insufficient permissions')
```

### Step 10: Return Data Directly

**Before:**
```typescript
return NextResponse.json({
  success: true,
  data: result
})
```

**After:**
```typescript
return result // apiHandler automatically wraps in { success: true, data: result }
```

---

## Route-Specific Patterns

### GET Route with Query Params

```typescript
export const GET = apiHandler(async (request: NextRequest) => {
  const user = getUserFromRequest(request)

  const querySchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(25),
    search: z.string().optional(),
  })

  const query = parseQueryParams(request, querySchema)

  const result = safeQuery(
    () => db.prepare(`
      SELECT * FROM tickets
      WHERE organization_id = ?
      LIMIT ? OFFSET ?
    `).all(user.organization_id, query.limit, (query.page - 1) * query.limit),
    'get tickets'
  )

  return result.data
})
```

### GET Route with Path Parameters

```typescript
export const GET = apiHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const user = getUserFromRequest(request)
  const ticketId = getIdFromParams(context?.params)

  const result = safeQuery(
    () => db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId),
    'get ticket'
  )

  if (!result.success || !result.data) {
    throw new NotFoundError('Ticket')
  }

  validateTenantAccess(user, result.data.organization_id)

  return result.data
})
```

### POST Route with Validation

```typescript
export const POST = apiHandler(async (request: NextRequest) => {
  const user = getUserFromRequest(request)
  const data = await parseJSONBody(request, ticketSchemas.create)

  const result = safeQuery(
    () => db.prepare(`
      INSERT INTO tickets (organization_id, user_id, title, description)
      VALUES (?, ?, ?, ?)
    `).run(user.organization_id, user.id, data.title, data.description),
    'create ticket'
  )

  if (!result.success) {
    throw new Error(result.error)
  }

  return { id: result.data.lastInsertRowid }
})
```

### PUT Route with Validation

```typescript
export const PUT = apiHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const user = getUserFromRequest(request)
  const ticketId = getIdFromParams(context?.params)
  const data = await parseJSONBody(request, ticketSchemas.update.omit({ id: true }))

  // Get existing
  const existing = safeQuery(
    () => db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId),
    'get ticket'
  )

  if (!existing.success || !existing.data) {
    throw new NotFoundError('Ticket')
  }

  validateTenantAccess(user, existing.data.organization_id)

  // Update
  const result = safeQuery(
    () => db.prepare(`
      UPDATE tickets
      SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.title, data.description, ticketId),
    'update ticket'
  )

  return { updated: true }
})
```

### DELETE Route (Admin Only)

```typescript
export const DELETE = apiHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const user = getUserFromRequest(request)
  requireAdmin(user)

  const resourceId = getIdFromParams(context?.params)

  const existing = safeQuery(
    () => db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId),
    'get resource'
  )

  if (!existing.success || !existing.data) {
    throw new NotFoundError('Resource')
  }

  validateTenantAccess(user, existing.data.organization_id)

  const result = safeQuery(
    () => db.prepare('DELETE FROM resources WHERE id = ?').run(resourceId),
    'delete resource'
  )

  return { deleted: true }
})
```

---

## Migration Checklist

For each route, ensure:

### Authentication & Authorization
- [ ] Uses `apiHandler` wrapper
- [ ] Extracts user with `getUserFromRequest()`
- [ ] Extracts tenant with `getTenantFromRequest()`
- [ ] Uses `requireAdmin()` for admin routes
- [ ] Uses `requireRole()` for role-specific routes
- [ ] Validates tenant access with `validateTenantAccess()`

### Input Validation
- [ ] POST/PUT body validated with `parseJSONBody(request, schema)`
- [ ] GET query params validated with `parseQueryParams(request, schema)`
- [ ] URL params validated with `getIdFromParams(context?.params)`
- [ ] Uses appropriate Zod schema from `/lib/validation/schemas.ts`

### Database Security
- [ ] Uses `safeQuery()` for single queries
- [ ] Uses `safeTransaction()` for multi-step operations
- [ ] All queries use prepared statements (no string concatenation)
- [ ] Includes `organization_id` filter in WHERE clauses

### Error Handling
- [ ] No manual try-catch (apiHandler handles it)
- [ ] Throws proper error types (NotFoundError, ConflictError, etc.)
- [ ] No manual error responses
- [ ] Returns data directly (apiHandler wraps it)

### Response Format
- [ ] Returns data directly (not wrapped in { success: true, data })
- [ ] No manual NextResponse.json() calls
- [ ] Uses proper HTTP status codes via errors

---

## Route Priority List

### High Priority (Security Critical)
1. ✅ `/api/tickets/create` - **MIGRATED**
2. `/api/auth/login` - Credentials handling
3. `/api/auth/register` - User creation
4. `/api/admin/users/[id]` - User management
5. `/api/admin/tickets/[id]` - Admin ticket access

### Medium Priority (Data Access)
6. `/api/tickets/[id]` - Ticket details
7. `/api/tickets/route` - Ticket listing
8. `/api/comments/route` - Comment creation
9. `/api/attachments/route` - File uploads
10. `/api/knowledge/articles/[slug]` - KB access

### Low Priority (Read-Only)
11. `/api/analytics/route` - Analytics data
12. `/api/dashboard/route` - Dashboard metrics
13. `/api/search/route` - Search functionality

---

## Testing Requirements

For each migrated route, add:

### 1. Unit Tests (Schema Validation)
```typescript
describe('Validation', () => {
  it('should validate correct input', () => {
    const result = schema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid input', () => {
    const result = schema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})
```

### 2. Integration Tests (Full Flow)
```typescript
describe('POST /api/route', () => {
  it('should handle authenticated request', async () => {
    const request = createMockRequest(data, authHeaders)
    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it('should reject unauthenticated request', async () => {
    const request = createMockRequest(data, {})
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should enforce tenant isolation', async () => {
    // Test cross-tenant access prevention
  })
})
```

---

## Common Pitfalls

### ❌ Mistake 1: Forgetting to validate tenant access
```typescript
// BAD: No tenant validation
const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id)
return ticket
```

```typescript
// GOOD: Validate tenant access
const ticket = safeQuery(...)
validateTenantAccess(user, ticket.organization_id)
return ticket
```

### ❌ Mistake 2: Using hardcoded user IDs
```typescript
// BAD: Hardcoded user
user_id: data.user_id || 1
```

```typescript
// GOOD: From authenticated request
user_id: user.id
```

### ❌ Mistake 3: Manual error responses
```typescript
// BAD: Manual error response
return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

```typescript
// GOOD: Throw proper error
throw new NotFoundError('Resource')
```

### ❌ Mistake 4: Missing Zod schemas
```typescript
// BAD: Manual validation
if (!data.email || !data.password) { ... }
```

```typescript
// GOOD: Zod validation
const data = await parseJSONBody(request, userSchemas.login)
```

---

## Automated Migration Script (Future)

```bash
# TODO: Create automated migration tool
npm run migrate:routes

# Features:
# - Detect old patterns
# - Suggest Zod schemas
# - Auto-add imports
# - Generate tests
```

---

## Completion Tracking

Track migration progress:

```bash
# Total routes: 76
# Migrated: 1 (1.3%)
# Remaining: 75 (98.7%)

✅ /api/tickets/create
⏳ /api/auth/login
⏳ /api/auth/register
⏳ ... (73 more)
```

---

## Support Resources

- **Security Guide**: `/SECURITY.md`
- **Testing Guide**: `/TESTING.md`
- **Example Route**: `/EXAMPLE_API_ROUTE.md`
- **Implementation Summary**: `/IMPLEMENTATION_SUMMARY.md`

---

**Last Updated**: 2025-10-04
**Status**: Migration in progress (1/76 complete)
**Next Route**: `/api/auth/login`
