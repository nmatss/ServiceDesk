# Security Quick Reference Guide

**Quick access to security features, configurations, and best practices**

---

## Table of Contents
1. [Running Security Tests](#running-security-tests)
2. [Security Configuration](#security-configuration)
3. [Common Security Tasks](#common-security-tasks)
4. [Security Checklist](#security-checklist)
5. [Incident Response](#incident-response)

---

## Running Security Tests

### Run All Security Tests
```bash
npm run test:security
```

### Run Specific Test Suites
```bash
# CSRF protection tests
npx playwright test tests/security/csrf.spec.ts

# SQL injection tests
npx playwright test tests/security/sql-injection.spec.ts

# Comprehensive security tests
npx playwright test tests/security/comprehensive-security.spec.ts

# Authentication tests
npx playwright test tests/security/authentication.spec.ts
```

### Run Tests with UI
```bash
npx playwright test --ui
```

### Generate Test Report
```bash
npx playwright show-report
```

---

## Security Configuration

### Environment Variables (Required for Production)

```bash
# JWT Configuration
JWT_SECRET=<generate-with: openssl rand -base64 64>
JWT_EXPIRY=8h

# Encryption
ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>

# Redis (Session Management)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=<your-database-url>

# Security
NODE_ENV=production
ENABLE_RATE_LIMITING=true
ENABLE_CSRF=true

# Monitoring (Optional)
SENTRY_DSN=<your-sentry-dsn>
```

### Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate encryption key
openssl rand -hex 32

# Generate CSRF secret
openssl rand -base64 32

# Generate API key
openssl rand -hex 32
```

---

## Common Security Tasks

### 1. Password Management

#### Validate Password Strength
```typescript
import { passwordPolicyManager } from '@/lib/auth/password-policies';

const result = passwordPolicyManager.validatePassword(
  'UserP@ssw0rd123',
  'user', // user role
  userId  // optional, for reuse check
);

if (!result.isValid) {
  console.log('Errors:', result.errors);
} else {
  console.log('Password strength:', result.score);
}
```

#### Get Password Requirements
```typescript
const requirements = passwordPolicyManager.getRequirements('admin');
console.log('Min length:', requirements.minLength);
console.log('Requires uppercase:', requirements.requireUppercase);
```

### 2. Input Sanitization

#### Sanitize User Input
```typescript
import { inputSanitizer } from '@/lib/security/input-sanitization';

const result = inputSanitizer.sanitizeString(userInput, {
  maxLength: 1000,
  preventXSS: true,
  preventSQLInjection: true
});

console.log('Sanitized:', result.sanitized);
console.log('Violations:', result.violations);
```

#### Validate and Sanitize Object
```typescript
import { inputValidator, ValidationRule } from '@/lib/security/input-sanitization';

const rules: ValidationRule[] = [
  { field: 'email', type: 'email', required: true },
  { field: 'name', type: 'string', required: true, minLength: 2 },
  { field: 'password', type: 'string', required: true, minLength: 8 }
];

const result = inputValidator.validateInput(userData, rules);
if (result.valid) {
  // Use result.sanitized
} else {
  console.log('Errors:', result.errors);
}
```

### 3. SQL Injection Prevention

#### Use Safe Query Builder
```typescript
import { executeSafeSelect } from '@/lib/db/safe-query';

const tickets = executeSafeSelect({
  table: 'tickets',
  columns: ['id', 'title', 'status'],
  where: [
    { column: 'user_id', operator: '=', value: userId },
    { column: 'status', operator: 'IN', value: ['open', 'in_progress'] }
  ],
  orderBy: 'created_at',
  orderDirection: 'DESC',
  limit: 50
});
```

#### Safe LIKE Queries
```typescript
import { buildLikePattern } from '@/lib/db/safe-query';

const searchPattern = buildLikePattern(userSearch, 'contains');
const results = executeSafeSelect({
  table: 'tickets',
  where: [
    { column: 'title', operator: 'LIKE', value: searchPattern }
  ]
});
```

### 4. CSRF Protection

#### Add CSRF Token to Request (Client-Side)
```javascript
// Get CSRF token from cookie or header
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf_token='))
  ?.split('=')[1];

// Include in request
fetch('/api/tickets/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  body: JSON.stringify(data)
});
```

#### Validate CSRF in API Route (Server-Side)
```typescript
import { validateCSRFToken } from '@/lib/security/csrf';

export async function POST(request: NextRequest) {
  // CSRF validation happens in middleware automatically
  // for protected routes

  // Your API logic here
}
```

### 5. Rate Limiting

#### Apply Rate Limit to API Route
```typescript
import { apiProtection } from '@/lib/auth/api-protection';

export async function POST(request: NextRequest) {
  // Check rate limit
  const result = await apiProtection.protectAPI(request, {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      identifier: 'ip'
    }
  });

  if (result) return result; // Rate limit exceeded

  // Your API logic here
}
```

### 6. Session Management

#### Create User Session
```typescript
import { createSession } from '@/lib/auth/session-manager';

const session = await createSession(
  user,
  {
    userAgent: request.headers.get('user-agent') || '',
    platform: 'web'
  },
  {
    ip: getClientIP(request),
    country: 'BR'
  },
  'password' // login method
);
```

#### Get Active Sessions
```typescript
import { getUserActiveSessions } from '@/lib/auth/session-manager';

const sessions = await getUserActiveSessions(userId);
console.log(`User has ${sessions.length} active sessions`);
```

### 7. Encryption

#### Encrypt Sensitive Data
```typescript
import { EncryptionManager } from '@/lib/security/encryption';

const encryption = EncryptionManager.getInstance();
const encrypted = await encryption.encrypt('sensitive data');

// Store encrypted.encrypted, encrypted.iv, encrypted.salt, encrypted.authTag
```

#### Decrypt Data
```typescript
const decrypted = await encryption.decrypt({
  encrypted: stored.encrypted,
  iv: stored.iv,
  salt: stored.salt,
  authTag: stored.authTag
});
```

### 8. Audit Logging

#### Log Security Event
```typescript
import { logAuditAction } from '@/lib/audit/logger';

await logAuditAction({
  user_id: userId,
  action: 'LOGIN_FAILURE',
  entity_type: 'user',
  entity_id: userId,
  details: JSON.stringify({
    reason: 'invalid_password',
    ip: clientIP,
    user_agent: userAgent
  })
});
```

---

## Security Checklist

### Development

- [ ] Use parameterized queries for all database operations
- [ ] Sanitize all user inputs
- [ ] Validate input data types and formats
- [ ] Never log sensitive data (passwords, tokens, PII)
- [ ] Use HTTPS for all external API calls
- [ ] Implement proper error handling (no stack traces to users)
- [ ] Follow principle of least privilege
- [ ] Use security linting tools

### Pre-Deployment

- [ ] All security tests passing
- [ ] No hardcoded secrets in code
- [ ] Environment variables configured
- [ ] Encryption keys generated and stored securely
- [ ] Database migrations tested
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Audit logging enabled
- [ ] Session management configured

### Production

- [ ] HTTPS enforced
- [ ] Security headers verified
- [ ] Rate limiting active
- [ ] Monitoring and alerting configured
- [ ] Audit logs retention policy active
- [ ] Backup encryption enabled
- [ ] Incident response plan documented
- [ ] Security contact information updated

---

## Incident Response

### Security Incident Categories

1. **Authentication Breach**
   - Unauthorized access detected
   - Credential compromise suspected
   - Multiple failed login attempts

2. **Data Breach**
   - Unauthorized data access
   - Data exfiltration detected
   - PII exposure

3. **Service Disruption**
   - DDoS attack
   - Resource exhaustion
   - System unavailability

4. **Malicious Activity**
   - SQL injection attempts
   - XSS attempts
   - CSRF attacks
   - Suspicious API usage

### Immediate Response Steps

1. **Detect & Confirm**
   - Review security logs
   - Confirm incident scope
   - Document timeline

2. **Contain**
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs
   - Enable additional logging

3. **Assess**
   - Determine impact
   - Identify affected users/data
   - Review audit logs
   - Collect evidence

4. **Remediate**
   - Patch vulnerabilities
   - Reset compromised accounts
   - Update security policies
   - Deploy fixes

5. **Notify**
   - Internal stakeholders
   - Affected users (if required)
   - Regulatory authorities (if required)
   - Legal/compliance teams

6. **Learn**
   - Post-incident review
   - Update procedures
   - Implement preventive measures
   - Document lessons learned

### Emergency Contacts

```
Security Team: security@company.com
DPO: dpo@company.com
Legal: legal@company.com
On-Call: [Configure PagerDuty/OpsGenie]
```

### Useful Commands

```bash
# Check failed login attempts
sqlite3 servicedesk.db "SELECT * FROM audit_logs WHERE action LIKE '%LOGIN%FAILURE%' AND created_at > datetime('now', '-1 hour')"

# Check rate limit violations
sqlite3 servicedesk.db "SELECT * FROM rate_limits WHERE attempts > 100 AND last_attempt_at > datetime('now', '-1 hour')"

# Check active sessions
sqlite3 servicedesk.db "SELECT * FROM user_sessions WHERE is_active = 1"

# View security events
sqlite3 servicedesk.db "SELECT * FROM security_events WHERE severity IN ('high', 'critical') ORDER BY created_at DESC LIMIT 50"
```

---

## Security Resources

### Internal Documentation
- [Security Audit Report](./SECURITY_AUDIT_REPORT.md)
- [Vulnerability Report](./SECURITY_VULNERABILITIES.md)
- [Database Schema](./lib/db/SCHEMA_DOCUMENTATION.md)

### External Resources
- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [LGPD Official Site](https://www.gov.br/lgpd)
- [CWE Database](https://cwe.mitre.org/)

### Security Tools
- [SQLMap](https://sqlmap.org/) - SQL injection testing
- [OWASP ZAP](https://www.zaproxy.org/) - Web app security scanner
- [Burp Suite](https://portswigger.net/burp) - Security testing platform
- [Snyk](https://snyk.io/) - Dependency vulnerability scanning

---

## Code Examples

### Secure API Route Template

```typescript
// app/api/secure-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiProtection } from '@/lib/auth/api-protection';
import { executeSafeSelect } from '@/lib/db/safe-query';
import { inputValidator } from '@/lib/security/input-sanitization';
import { logAuditAction } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  try {
    // 1. API Protection (CSRF, rate limit, auth)
    const protectionResult = await apiProtection.protectAPI(request, {
      requireAuth: true,
      requirePermission: 'resource:create',
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10,
        identifier: 'user'
      }
    });

    if (protectionResult) return protectionResult;

    // 2. Get user info from headers (set by middleware)
    const userId = parseInt(request.headers.get('X-User-ID') || '0');
    const userRole = request.headers.get('X-User-Role') || '';

    // 3. Parse and validate input
    const body = await request.json();
    const validation = inputValidator.validateInput(body, [
      { field: 'title', type: 'string', required: true, maxLength: 200 },
      { field: 'description', type: 'string', required: true, maxLength: 5000 }
    ]);

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // 4. Use safe database operations
    // ... your business logic using executeSafeSelect, etc.

    // 5. Log the action
    await logAuditAction({
      user_id: userId,
      action: 'RESOURCE_CREATED',
      entity_type: 'resource',
      entity_id: newResourceId,
      details: JSON.stringify({ title: validation.sanitized.title })
    });

    // 6. Return response
    return NextResponse.json({ success: true, id: newResourceId });

  } catch (error) {
    // 7. Secure error handling (no stack traces to user)
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
```

---

## Quick Wins

### Enable Security Headers (5 minutes)
Already implemented in middleware.ts - verify they're active:
```bash
curl -I http://localhost:3000 | grep -E 'X-|Content-Security'
```

### Enable Rate Limiting (5 minutes)
Already implemented - configure limits in environment:
```bash
export RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
export RATE_LIMIT_MAX_REQUESTS=100
```

### Enable CSRF Protection (5 minutes)
Already implemented - ensure cookies are being set:
```bash
curl -v http://localhost:3000/api/health | grep csrf_token
```

---

**Last Updated:** 2025-10-05
**Maintained By:** Security Team
**Review Frequency:** Monthly

---
