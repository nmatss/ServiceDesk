# Example: Secure API Route Implementation

This document shows how to implement a secure API route using all the security and validation modules we've created.

## Complete Example: Ticket API Route

```typescript
/**
 * app/api/tickets/[id]/route.ts
 * Example of a fully secured and validated API endpoint
 */

import type { NextRequest } from 'next/server'
import {
  apiHandler,
  getUserFromRequest,
  getTenantFromRequest,
  parseJSONBody,
  getIdFromParams,
  requireAdmin,
  validateTenantAccess,
} from '@/lib/api/api-helpers'
import {
  NotFoundError,
  ConflictError,
} from '@/lib/errors/error-handler'
import { ticketSchemas } from '@/lib/validation/schemas'
import { ticketQueries } from '@/lib/db/queries'
import { safeQuery } from '@/lib/db/safe-queries'

/**
 * GET /api/tickets/[id]
 * Get a single ticket by ID
 */
export const GET = apiHandler(async (
  request: NextRequest,
  context
) => {
  // 1. Extract authenticated user (from middleware)
  const user = getUserFromRequest(request)
  const tenant = getTenantFromRequest(request)

  // 2. Validate URL parameters
  const ticketId = getIdFromParams(context?.params)

  // 3. Query database with safety wrapper
  const result = safeQuery(
    () => ticketQueries.getById(ticketId),
    'get ticket by ID'
  )

  if (!result.success) {
    throw new Error(result.error)
  }

  if (!result.data) {
    throw new NotFoundError('Ticket')
  }

  // 4. Validate tenant access (multi-tenant security)
  validateTenantAccess(user, result.data.organization_id)

  // 5. Return data
  return result.data
})

/**
 * PUT /api/tickets/[id]
 * Update a ticket
 */
export const PUT = apiHandler(async (
  request: NextRequest,
  context
) => {
  // 1. Authentication
  const user = getUserFromRequest(request)
  const tenant = getTenantFromRequest(request)

  // 2. Validate URL parameters
  const ticketId = getIdFromParams(context?.params)

  // 3. Validate request body with Zod schema
  const updateData = await parseJSONBody(
    request,
    ticketSchemas.update.omit({ id: true })
  )

  // 4. Get existing ticket
  const existingResult = safeQuery(
    () => ticketQueries.getById(ticketId),
    'get existing ticket'
  )

  if (!existingResult.success || !existingResult.data) {
    throw new NotFoundError('Ticket')
  }

  // 5. Validate tenant access
  validateTenantAccess(user, existingResult.data.organization_id)

  // 6. Update ticket
  const updateResult = safeQuery(
    () =>
      ticketQueries.update({
        id: ticketId,
        ...updateData,
      }),
    'update ticket'
  )

  if (!updateResult.success) {
    throw new Error(updateResult.error)
  }

  // 7. Return updated ticket
  return updateResult.data
})

/**
 * DELETE /api/tickets/[id]
 * Delete a ticket (admin only)
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  context
) => {
  // 1. Authentication & authorization
  const user = getUserFromRequest(request)
  requireAdmin(user) // Only admins can delete tickets

  // 2. Validate URL parameters
  const ticketId = getIdFromParams(context?.params)

  // 3. Get existing ticket
  const existingResult = safeQuery(
    () => ticketQueries.getById(ticketId),
    'get ticket for deletion'
  )

  if (!existingResult.success || !existingResult.data) {
    throw new NotFoundError('Ticket')
  }

  // 4. Validate tenant access
  validateTenantAccess(user, existingResult.data.organization_id)

  // 5. Check if ticket can be deleted (business logic)
  if (existingResult.data.status_name === 'closed') {
    throw new ConflictError('Cannot delete closed tickets')
  }

  // 6. Delete ticket
  const deleteResult = safeQuery(
    () => ticketQueries.delete(ticketId),
    'delete ticket'
  )

  if (!deleteResult.success || !deleteResult.data) {
    throw new Error('Failed to delete ticket')
  }

  // 7. Return success
  return { deleted: true, id: ticketId }
})
```

## Key Security Features Implemented

### 1. **Authentication** ✅
- User extracted from middleware-validated JWT
- Automatic rejection if not authenticated

### 2. **Authorization** ✅
- Role-based access control
- Tenant isolation (multi-tenant security)
- Resource-level permissions

### 3. **Input Validation** ✅
- Zod schemas validate all inputs
- Type-safe parameters
- Sanitized data

### 4. **Error Handling** ✅
- Consistent error responses
- Proper HTTP status codes
- No sensitive data leakage

### 5. **Database Security** ✅
- Prepared statements (SQL injection prevention)
- Safe query wrappers
- Transaction support

### 6. **Multi-Tenant Security** ✅
- Automatic organization_id filtering
- Cross-tenant access prevention
- Tenant context validation

## Request Flow

```
1. Client Request
   ↓
2. Middleware (authentication, tenant resolution)
   ↓
3. API Route Handler
   ├→ Extract user/tenant from headers
   ├→ Validate input (Zod schemas)
   ├→ Check permissions
   ├→ Execute business logic
   ├→ Database operations (safe queries)
   └→ Return response
   ↓
4. Error Handler (if error)
   ├→ Log error
   ├→ Format response
   └→ Return appropriate status
```

## Testing the API

```bash
# Valid request
curl -X GET http://localhost:3000/api/tickets/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Response (success)
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Example ticket",
    ...
  }
}

# Response (error)
{
  "success": false,
  "error": {
    "type": "AUTHENTICATION_ERROR",
    "message": "Authentication required",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Environment Variables Required

```env
# Critical - Must be set in production
JWT_SECRET=your-super-secure-secret-key-min-32-chars

# Optional
DATABASE_URL=./servicedesk.db
NODE_ENV=production
```

## Pre-deployment Checklist

- [ ] All environment variables set
- [ ] `npm run validate` passes
- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Database migrations applied
- [ ] Security headers configured
- [ ] Rate limiting enabled (if using Redis)
- [ ] Error logging configured

## Additional Security Recommendations

1. **Rate Limiting**: Implement Redis-based rate limiting
2. **Request Logging**: Add structured logging for audit trails
3. **CORS**: Configure allowed origins properly
4. **CSP**: Fine-tune Content Security Policy
5. **Monitoring**: Set up error tracking (Sentry, etc.)
6. **Backups**: Automated database backups
7. **SSL/TLS**: Always use HTTPS in production
8. **Security Audits**: Regular dependency updates

## Performance Considerations

- Use database indexes for frequently queried fields
- Implement caching for read-heavy operations
- Paginate large result sets
- Use connection pooling for database
- Monitor query performance
- Optimize N+1 queries

---

**This pattern ensures:**
- ✅ Type safety
- ✅ Input validation
- ✅ Authentication & authorization
- ✅ Multi-tenant security
- ✅ Error handling
- ✅ Consistent responses
- ✅ SQL injection prevention
- ✅ Audit trails ready
