# Security Fixes Quick Reference

## Summary of Critical Security Fixes (2025-12-15)

### 1. Tenant Isolation - CRITICAL ✅
**File:** `lib/tenant/context.ts`
**Change:** Removed insecure fallback to tenant ID 1
**Impact:** Now throws error if tenant context missing (enforces strict isolation)

### 2. Rate Limiting - CRITICAL ✅
**File:** `lib/api/api-helpers.ts`
**Change:** Implemented actual rate limiting using database-backed solution
**Impact:** Protects against brute force, DoS, and resource exhaustion attacks

**Usage:**
```typescript
// Option 1: Check rate limit (returns boolean)
const isLimited = await checkRateLimit(request, 'login', 'auth');

// Option 2: Enforce rate limit (throws error if exceeded)
await enforceRateLimit(request, 'login', 'auth');
```

### 3. JWT Token Type Validation - HIGH ✅
**File:** `middleware.ts`
**Change:** Added validation that token type must be 'access' (not 'refresh')
**Impact:** Prevents token confusion attacks and enforces proper token lifecycle

### 4. Token Expiration - HIGH ✅
**File:** `app/api/auth/login/route.ts`
**Change:** Standardized access tokens to 15 minutes (was 8 hours)
**Impact:** Reduces attack window, aligns with OWASP best practices

**Token Lifetimes:**
- Access Token: 15 minutes
- Refresh Token: 7 days

### 5. Account Lockout - HIGH ✅
**File:** `app/api/auth/login/route.ts`
**Change:** Implemented automatic account lockout after failed login attempts
**Impact:** Protects against brute force password attacks

**Lockout Policy:**
- 5 failed attempts → 15 minute lockout
- HTTP 423 (Locked) status code
- Automatic reset after successful login or timeout

## Rate Limit Configurations

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| API (General) | 15 min | 100 |
| Authentication | 15 min | 5 |
| Auth Strict | 60 min | 3 |
| Refresh Token | 5 min | 10 |
| File Upload | 5 min | 10 |
| Search | 1 min | 30 |
| Password Reset | 60 min | 3 |

## Testing Commands

### Test Tenant Isolation
```bash
# Should fail with "Tenant context required"
curl -X GET http://localhost:3000/api/tickets
```

### Test Rate Limiting
```bash
# Should lock after 5 attempts
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### Test Account Lockout
```bash
# Attempt 5 will lock the account
for i in {1..5}; do
  echo "Attempt $i"
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@acme.com","password":"wrong"}' | jq
done
```

## Error Codes

| Code | Meaning | When |
|------|---------|------|
| 401 | Unauthorized | Invalid credentials, invalid token |
| 423 | Locked | Account locked due to failed attempts |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Missing tenant context |

## Database Schema

### Users Table
- `failed_login_attempts` - Counter for failed logins
- `locked_until` - Timestamp when lockout expires

### Login Attempts Table
- Logs all login attempts (success and failure)
- Includes IP, user agent, failure reason
- Used for security monitoring and forensics

## Security Monitoring

Monitor these metrics:
1. Failed login attempts per hour
2. Account lockouts per hour
3. Rate limit hits per endpoint
4. Tenant context errors
5. Token type validation failures

## Files Modified

1. `lib/tenant/context.ts` - Tenant isolation
2. `lib/api/api-helpers.ts` - Rate limiting
3. `middleware.ts` - JWT token type validation
4. `app/api/auth/login/route.ts` - Token expiration + account lockout

## See Full Report

For detailed information, see: `CRITICAL_SECURITY_FIXES_REPORT.md`
