# API Route Consistency Guide

## Overview
This document outlines the **standardized patterns** for all API routes in the ServiceDesk application. Follow these patterns to ensure security, consistency, and maintainability.

---

## 1. Authentication Pattern (MANDATORY)

### ✅ CORRECT Pattern - Cookie-Based Auth

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromCookies } from '@/lib/auth/sqlite-auth';
import { getTenantContextFromRequest } from '@/lib/tenant/context';

export async function GET(request: NextRequest) {
  try {
    // STEP 1: Verify authentication (ALWAYS FIRST)
    const user = await verifyTokenFromCookies(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // STEP 2: Check permissions (if needed)
    if (!['admin', 'agent'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied', code: 'PERMISSION_DENIED' },
        { status: 403 }
      );
    }

    // STEP 3: Verify tenant context
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // STEP 4: Validate user belongs to tenant
    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json(
        { error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // STEP 5: Execute business logic
    const data = await fetchData(tenantContext.id, user);

    // STEP 6: Return standardized response
    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    logger.error('Error in route', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

### ❌ DEPRECATED Patterns (DO NOT USE)

#### Pattern 1: Bearer Token from Header (DEPRECATED)
```typescript
// ❌ WRONG - Do not use this pattern
const authHeader = request.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Token required' }, { status: 401 });
}
const token = authHeader.substring(7);
const user = await verifyToken(token);
```

#### Pattern 2: Mixed Cookie/Bearer (DEPRECATED)
```typescript
// ❌ WRONG - Inconsistent auth pattern
const authHeader = request.headers.get('authorization');
const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
```

#### Pattern 3: Manual JWT Verification (DEPRECATED)
```typescript
// ❌ WRONG - Use helper functions instead
const token = request.cookies.get('auth_token')?.value;
const { payload } = await jwtVerify(token, JWT_SECRET);
```

---

## 2. Response Format Standards

### Success Responses

#### Single Resource
```typescript
return NextResponse.json({
  success: true,
  data: resourceObject,
  message: 'Optional success message' // Optional
}, { status: 200 });
```

#### Collection of Resources
```typescript
return NextResponse.json({
  success: true,
  data: {
    items: resourceArray,
    pagination: {
      total: 100,
      limit: 20,
      offset: 0,
      hasMore: true
    }
  }
}, { status: 200 });
```

#### Create/Update Operations
```typescript
return NextResponse.json({
  success: true,
  data: createdResource,
  message: 'Resource created successfully'
}, { status: 201 }); // 201 for POST, 200 for PUT
```

### Error Responses

```typescript
// 400 - Bad Request
return NextResponse.json({
  error: 'Invalid input',
  code: 'VALIDATION_ERROR',
  details: { field: 'email', message: 'Invalid format' } // Optional
}, { status: 400 });

// 401 - Unauthorized
return NextResponse.json({
  error: 'Unauthorized',
  code: 'AUTH_REQUIRED'
}, { status: 401 });

// 403 - Forbidden
return NextResponse.json({
  error: 'Access denied',
  code: 'PERMISSION_DENIED'
}, { status: 403 });

// 404 - Not Found
return NextResponse.json({
  error: 'Resource not found',
  code: 'NOT_FOUND'
}, { status: 404 });

// 409 - Conflict
return NextResponse.json({
  error: 'Resource already exists',
  code: 'CONFLICT'
}, { status: 409 });

// 500 - Internal Server Error
return NextResponse.json({
  error: 'Internal server error',
  code: 'INTERNAL_ERROR'
}, { status: 500 });
```

### Standard Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | No valid authentication token |
| `PERMISSION_DENIED` | 403 | User lacks required permissions |
| `TENANT_NOT_FOUND` | 404 | Tenant context not found |
| `TENANT_ACCESS_DENIED` | 403 | User doesn't belong to tenant |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `CONFLICT` | 409 | Resource conflict (duplicate) |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 3. Database Query Security

### ✅ ALWAYS Filter by Tenant

```typescript
// ✅ CORRECT - Includes tenant_id filter
const tickets = db.prepare(`
  SELECT * FROM tickets
  WHERE tenant_id = ? AND status_id = ?
`).all(tenantId, statusId);

// ✅ CORRECT - Join with tenant validation
const templates = db.prepare(`
  SELECT t.*, u.name as created_by_name
  FROM templates t
  LEFT JOIN users u ON t.created_by = u.id
  WHERE u.organization_id = ?
`).all(tenantId);
```

### ❌ NEVER Query Without Tenant Filter

```typescript
// ❌ WRONG - Missing tenant_id filter (SECURITY VULNERABILITY)
const tickets = db.prepare(`
  SELECT * FROM tickets
  WHERE status_id = ?
`).all(statusId);
```

---

## 4. Common Patterns by Route Type

### Admin Routes
```typescript
// Must check:
// 1. Authentication
// 2. Admin role
// 3. Tenant context
// 4. Tenant membership

if (user.role !== 'admin' && user.role !== 'tenant_admin') {
  return NextResponse.json(
    { error: 'Access denied', code: 'PERMISSION_DENIED' },
    { status: 403 }
  );
}
```

### Public/Portal Routes
```typescript
// Must check:
// 1. Authentication (optional for some public routes)
// 2. Tenant context
// 3. Tenant membership (if authenticated)

// For public routes, tenant context might come from subdomain
const tenantContext = getTenantContextFromRequest(request);
```

### Agent Routes
```typescript
// Must check:
// 1. Authentication
// 2. Agent or Admin role
// 3. Tenant context
// 4. Tenant membership

if (!['admin', 'agent', 'tenant_admin'].includes(user.role)) {
  return NextResponse.json(
    { error: 'Access denied', code: 'PERMISSION_DENIED' },
    { status: 403 }
  );
}
```

---

## 5. Migration Checklist

Use this checklist when updating existing routes:

- [ ] Import `verifyTokenFromCookies` instead of `verifyToken`
- [ ] Remove all Bearer token header extraction code
- [ ] Call `verifyTokenFromCookies` first in the handler
- [ ] Verify tenant context after authentication
- [ ] Validate user belongs to tenant
- [ ] Use standardized response format: `{ success: true, data: {...} }`
- [ ] Use standardized error format: `{ error: string, code: string }`
- [ ] Include tenant_id in ALL database queries
- [ ] Add proper error logging
- [ ] Update error messages to English (if currently in Portuguese)

---

## 6. Files Requiring Updates

### High Priority (Security Critical)
- [x] `/app/api/admin/templates/route.ts` - FIXED (ID issue + auth)
- [x] `/app/api/agents/route.ts` - FIXED
- [x] `/app/api/analytics/route.ts` - FIXED (added tenant validation)
- [x] `/app/api/admin/automations/route.ts` - FIXED
- [ ] `/app/api/admin/audit/route.ts`
- [ ] `/app/api/admin/stats/route.ts`
- [ ] `/app/api/admin/users/[id]/route.ts`
- [ ] `/app/api/admin/sla/route.ts`
- [ ] `/app/api/admin/settings/route.ts`

### Medium Priority
- [ ] `/app/api/ai/*.ts` (all AI routes)
- [ ] `/app/api/knowledge/*.ts` (knowledge base routes)
- [ ] `/app/api/tickets/[id]/*.ts` (ticket routes)
- [ ] `/app/api/search/*.ts` (search routes)

### Low Priority (Less sensitive)
- [ ] `/app/api/auth/profile/route.ts`
- [ ] `/app/api/auth/change-password/route.ts`
- [ ] Various utility routes

---

## 7. Testing Updated Routes

After updating a route, test:

1. **Authentication**: Request without cookie returns 401
2. **Authorization**: Request with wrong role returns 403
3. **Tenant Isolation**: Request from User A can't access Tenant B data
4. **Response Format**: Responses match standard format
5. **Error Handling**: Errors return proper codes and formats

---

## 8. Examples

### Before (Inconsistent)
```typescript
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  const user = await verifyToken(token);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getData();
  return NextResponse.json({ agents: data });
}
```

### After (Consistent)
```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await verifyTokenFromCookies(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (user.organization_id !== tenantContext.id) {
      return NextResponse.json(
        { error: 'Access denied to this tenant', code: 'TENANT_ACCESS_DENIED' },
        { status: 403 }
      );
    }

    const data = await getData(tenantContext.id);

    return NextResponse.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('Error fetching data', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

---

## Notes

- **Security First**: Authentication and tenant validation are non-negotiable
- **Consistency**: All routes should follow the same pattern
- **Error Codes**: Use standard error codes for client-side handling
- **Logging**: Always log errors for debugging
- **Type Safety**: Leverage TypeScript for compile-time checks

---

**Last Updated**: 2025-12-15
**Status**: Implementation in progress (4 critical routes fixed, 40+ remaining)
