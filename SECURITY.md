# Security Guide - ServiceDesk Pro

## 🔒 Security Architecture

This document outlines the comprehensive security measures implemented in ServiceDesk Pro.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Multi-Tenant Security](#multi-tenant-security)
3. [Input Validation](#input-validation)
4. [Database Security](#database-security)
5. [API Security](#api-security)
6. [Error Handling](#error-handling)
7. [Environment Configuration](#environment-configuration)
8. [Security Headers](#security-headers)
9. [Deployment Security](#deployment-security)
10. [Security Checklist](#security-checklist)

---

## Authentication & Authorization

### JWT-Based Authentication

**Location**: `middleware.ts`, `lib/config/env.ts`

- **Algorithm**: HS256
- **Token Storage**: HTTP-only cookies (primary) + Authorization header (fallback)
- **Validation**: Issuer + Audience + Expiration checks
- **Secret Management**: Validated at startup, minimum 32 characters

```typescript
// Token validation includes:
- Signature verification
- Tenant/organization match
- Role validation
- Expiration check
```

### Role-Based Access Control (RBAC)

**Roles Hierarchy**:
1. `super_admin` - Full system access
2. `tenant_admin` - Tenant-wide administration
3. `team_manager` - Team management
4. `admin` - Administrative functions
5. `agent` - Ticket handling
6. `user` - End user access

**Implementation**:
```typescript
import { requireAdmin, requireRole } from '@/lib/api/api-helpers'

// Require admin access
requireAdmin(user)

// Require specific roles
requireRole(user, ['admin', 'team_manager'])
```

---

## Multi-Tenant Security

### Tenant Isolation

**Critical Feature**: Every database query MUST include `organization_id` filter

**Enforcement Layers**:

1. **Middleware Level**: Validates tenant context
2. **API Level**: Validates resource access
3. **Database Level**: Automatic filtering

```typescript
import { validateTenantAccess } from '@/lib/api/api-helpers'

// Validate user can access resource
validateTenantAccess(user, resource.organization_id)
```

### Tenant Resolution Methods

1. **Subdomain**: `demo.servicedesk.com` → tenant `demo`
2. **Path-based**: `/t/demo/portal` → tenant `demo`
3. **Headers**: Explicit tenant headers (for APIs)

---

## Input Validation

### Zod Schema Validation

**Location**: `lib/validation/schemas.ts`

All API inputs validated with type-safe Zod schemas:

```typescript
import { parseJSONBody } from '@/lib/api/api-helpers'
import { ticketSchemas } from '@/lib/validation/schemas'

// Automatically validates and throws on error
const data = await parseJSONBody(request, ticketSchemas.create)
```

### Validation Rules

- **Email**: RFC 5322 compliant
- **Password**: Min 8 chars, uppercase, lowercase, number
- **Slug**: Lowercase alphanumeric + hyphens only
- **ID**: Positive integers only
- **File Size**: Max 50MB
- **String Length**: Context-specific limits

### Sanitization

```typescript
import { sanitizeString } from '@/lib/db/safe-queries'

// Remove control characters
const safe = sanitizeString(userInput, maxLength)
```

---

## Database Security

### SQL Injection Prevention

**Status**: ✅ **PROTECTED**

- All queries use prepared statements
- No string concatenation in SQL
- Parameterized queries only

```typescript
// ❌ NEVER DO THIS
db.prepare(`SELECT * FROM users WHERE email = '${email}'`)

// ✅ ALWAYS DO THIS
db.prepare('SELECT * FROM users WHERE email = ?').get(email)
```

### Safe Query Wrappers

```typescript
import { safeQuery, validateId } from '@/lib/db/safe-queries'

// Wrapped execution with error handling
const result = safeQuery(
  () => userQueries.getById(id),
  'get user by ID'
)

if (!result.success) {
  throw new Error(result.error)
}
```

### Transaction Support

```typescript
import { safeTransaction } from '@/lib/db/safe-queries'

const result = safeTransaction(db, (db) => {
  // Multiple operations
  const ticket = ticketQueries.create(data)
  commentQueries.create({ ticket_id: ticket.id, ...commentData })
  return ticket
}, 'create ticket with comment')
```

---

## API Security

### Request Flow

```
Client → Middleware → Route Handler → Business Logic → Database
         ↓           ↓                ↓                 ↓
         Auth        Validation       Authorization     Safe Queries
```

### Security Layers

1. **Middleware** (`middleware.ts`)
   - Authentication
   - Tenant resolution
   - Security headers

2. **Route Handler** (API routes)
   - Input validation
   - Authorization checks
   - Business logic

3. **Database Layer** (`lib/db/queries.ts`)
   - Prepared statements
   - Safe wrappers
   - Tenant filtering

### API Helper Functions

```typescript
import {
  apiHandler,           // Error handling wrapper
  getUserFromRequest,   // Extract authenticated user
  getTenantFromRequest, // Extract tenant context
  parseJSONBody,        // Validate JSON body
  parseQueryParams,     // Validate query params
  getIdFromParams,      // Validate URL params
} from '@/lib/api/api-helpers'
```

---

## Error Handling

### Centralized Error System

**Location**: `lib/errors/error-handler.ts`

**Error Types**:
- `ValidationError` - Input validation failures (400)
- `AuthenticationError` - Authentication required (401)
- `AuthorizationError` - Insufficient permissions (403)
- `NotFoundError` - Resource not found (404)
- `ConflictError` - Business logic conflicts (409)
- `RateLimitError` - Too many requests (429)
- `DatabaseError` - Database failures (500)
- `ExternalAPIError` - External service failures (503)

### Usage

```typescript
import { NotFoundError, ConflictError } from '@/lib/errors/error-handler'

if (!ticket) {
  throw new NotFoundError('Ticket')
}

if (ticket.status === 'closed') {
  throw new ConflictError('Cannot modify closed tickets')
}
```

### Consistent API Responses

**Success**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error**:
```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { "email": ["Invalid email format"] },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Environment Configuration

### Critical Variables

**Location**: `lib/config/env.ts`

```env
# REQUIRED in production
JWT_SECRET=your-very-strong-secret-minimum-32-characters

# OPTIONAL
DATABASE_URL=./servicedesk.db
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
```

### Validation on Startup

```bash
npm run env:validate
```

Validates:
- JWT_SECRET exists and is strong
- All required variables present
- Variable format correctness

---

## Security Headers

**Location**: `lib/security/headers.ts`

### Applied Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: [detailed policy]
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Content Security Policy (CSP)

```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:
img-src 'self' data: https: blob:
connect-src 'self' https://api.openai.com wss:
frame-ancestors 'none'
```

---

## Deployment Security

### Pre-Deployment Checklist

- [ ] **Environment Variables**
  - [ ] JWT_SECRET set (32+ chars)
  - [ ] All secrets configured
  - [ ] No default values in production

- [ ] **Code Quality**
  - [ ] `npm run validate` passes
  - [ ] `npm run type-check` passes (no TypeScript errors)
  - [ ] `npm run lint` passes
  - [ ] All tests pass

- [ ] **Database**
  - [ ] Migrations applied
  - [ ] Indexes created
  - [ ] Backup strategy configured

- [ ] **Security**
  - [ ] HTTPS enforced
  - [ ] Security headers configured
  - [ ] Rate limiting enabled
  - [ ] CORS properly configured

- [ ] **Monitoring**
  - [ ] Error tracking setup (Sentry, etc.)
  - [ ] Performance monitoring
  - [ ] Audit logging enabled
  - [ ] Uptime monitoring

### Production Environment

```bash
# Build with validation
npm run build

# Starts with env validation
npm run start
```

---

## Security Checklist

### Development

- [x] TypeScript strict mode enabled
- [x] ESLint configured
- [x] No `any` types (strict typing)
- [x] All inputs validated with Zod
- [x] Prepared statements for SQL
- [x] Error handling on all async operations

### Authentication

- [x] JWT with strong secret
- [x] HTTP-only cookies
- [x] Token expiration
- [x] Refresh token mechanism
- [x] Password hashing (bcrypt)
- [x] Multi-factor authentication support

### Authorization

- [x] Role-based access control
- [x] Resource-level permissions
- [x] Tenant isolation enforced
- [x] Cross-tenant access prevention

### Data Protection

- [x] Input validation (Zod schemas)
- [x] Input sanitization
- [x] SQL injection prevention
- [x] XSS prevention
- [x] CSRF protection (SameSite cookies)

### API Security

- [x] Rate limiting ready
- [x] Request size limits
- [x] Timeout configurations
- [x] CORS configured
- [x] Security headers applied

### Error Handling

- [x] No sensitive data in errors
- [x] Consistent error responses
- [x] Proper status codes
- [x] Error logging
- [x] Production vs development messages

---

## Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, email: security@yourcompany.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

---

## Security Audit Log

| Date | Version | Changes |
|------|---------|---------|
| 2024-01-01 | 0.1.0 | Initial security implementation |
| 2024-01-01 | 0.2.0 | Enhanced middleware, validation, error handling |

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated**: 2024-10-04
**Maintained By**: Development Team
**Security Review**: Required quarterly
