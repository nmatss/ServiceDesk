# Security Testing Guide

Comprehensive guide for security scanning and testing in the ServiceDesk application.

## Table of Contents

- [Overview](#overview)
- [Security Scanning](#security-scanning)
- [OWASP Top 10 Coverage](#owasp-top-10-coverage)
- [Running Security Scans](#running-security-scans)
- [Test Suite](#test-suite)
- [CI/CD Integration](#cicd-integration)
- [Remediation Guide](#remediation-guide)

## Overview

This project implements comprehensive security testing covering:

- **Dependency vulnerability scanning** (npm audit)
- **Secret detection** (hardcoded credentials, API keys)
- **SQL injection protection**
- **XSS vulnerability detection**
- **Authentication/authorization testing**
- **OWASP Top 10 compliance**
- **Cryptography validation**

## Security Scanning

### Automated Security Scan

Run the comprehensive security scanner:

```bash
./scripts/security/run-security-scan.sh
```

This script performs:

1. **NPM Audit** - Checks for known vulnerabilities in dependencies
2. **Secret Detection** - Scans for hardcoded passwords, API keys, tokens
3. **SQL Injection Patterns** - Detects unsafe query construction
4. **Dangerous Code Patterns** - Finds eval(), Function constructor usage
5. **XSS Vulnerabilities** - Identifies innerHTML, document.write usage
6. **Authentication Issues** - Checks password policies, sensitive data logging
7. **Cryptography Issues** - Detects weak hashing algorithms (MD5, SHA1)

### Report Output

Reports are saved to `reports/security/` with timestamps:

- `security-scan-TIMESTAMP.txt` - Full text report
- `npm-audit-TIMESTAMP.json` - JSON output from npm audit

### Exit Codes

- `0` - No security issues found
- `1` - Security issues detected (review report)

## OWASP Top 10 Coverage

### A01:2021 - Broken Access Control

**Tests:**
- `/tests/security/owasp/authz-bypass.test.ts`
- `/tests/security/authentication.spec.ts`

**Coverage:**
- Role-based access control (RBAC) validation
- Horizontal privilege escalation prevention
- Vertical privilege escalation prevention
- JWT token validation

**Example:**
```typescript
// Test that users can't access other users' tickets
test('prevent horizontal privilege escalation', async () => {
  const response = await fetch('/api/tickets/999', {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  expect(response.status).toBe(403);
});
```

### A02:2021 - Cryptographic Failures

**Tests:**
- `/tests/security/jwt.test.ts`
- Security scan checks for MD5/SHA1 usage

**Coverage:**
- Strong password hashing (bcrypt)
- JWT secret strength validation
- HTTPS enforcement
- Secure cookie settings

### A03:2021 - Injection

**Tests:**
- `/tests/security/owasp/sql-injection.test.ts`
- `/tests/security/owasp/advanced-injection.test.ts`

**Coverage:**
- SQL injection protection (parameterized queries)
- NoSQL injection prevention
- Command injection protection
- LDAP injection (if applicable)

**Example Payloads Tested:**
```javascript
const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "' UNION SELECT NULL--",
  "'; DROP TABLE users--",
  // ... 20+ more payloads
];
```

### A04:2021 - Insecure Design

**Coverage:**
- SLA policy enforcement
- Audit logging
- Rate limiting
- Input validation schemas (Zod)

### A05:2021 - Security Misconfiguration

**Tests:**
- `/tests/security/headers.test.ts`

**Coverage:**
- Security headers (CSP, HSTS, X-Frame-Options)
- CORS configuration
- Error message sanitization
- Development mode detection

**Example:**
```typescript
test('security headers present', async () => {
  const response = await fetch('/api/health');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
});
```

### A06:2021 - Vulnerable and Outdated Components

**Coverage:**
- Automated npm audit in CI/CD
- Dependency scanning with Dependabot
- Regular security updates

**Run:**
```bash
npm audit --production
npm audit fix
```

### A07:2021 - Identification and Authentication Failures

**Tests:**
- `/tests/security/owasp/auth-bypass.test.ts`
- `/tests/security/authentication.spec.ts`

**Coverage:**
- Password strength requirements
- Account lockout after failed attempts
- Session management
- JWT expiration

**Example:**
```typescript
test('account lockout after 5 failed attempts', async () => {
  for (let i = 0; i < 5; i++) {
    await login('user@example.com', 'wrong-password');
  }
  const response = await login('user@example.com', 'wrong-password');
  expect(response.status).toBe(423); // Locked
});
```

### A08:2021 - Software and Data Integrity Failures

**Coverage:**
- Subresource Integrity (SRI) for CDN resources
- Code signing in CI/CD
- Audit trail for data changes

### A09:2021 - Security Logging and Monitoring Failures

**Coverage:**
- Comprehensive audit logging (`lib/audit/`)
- Datadog integration for monitoring
- Failed login attempt tracking
- Suspicious activity detection

### A10:2021 - Server-Side Request Forgery (SSRF)

**Coverage:**
- URL validation and sanitization
- Whitelist-based external requests
- Network segmentation

## Running Security Scans

### Quick Scan

```bash
# Run security scan
./scripts/security/run-security-scan.sh

# View latest report
cat reports/security/security-scan-*.txt | tail -100
```

### Full Security Test Suite

```bash
# Run all OWASP tests
npm test -- tests/security/owasp/

# Run specific test category
npm test -- tests/security/owasp/sql-injection.test.ts

# Run with coverage
npm test -- --coverage tests/security/
```

### CI/CD Integration

Add to `.github/workflows/security.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run security scan
        run: ./scripts/security/run-security-scan.sh

      - name: Upload security report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: reports/security/

      - name: Run OWASP tests
        run: npm test -- tests/security/owasp/
```

## Test Suite

### Available Security Tests

| Test File | Coverage | Location |
|-----------|----------|----------|
| `sql-injection.test.ts` | SQL injection protection | `/tests/security/owasp/` |
| `xss.test.ts` | XSS prevention | `/tests/security/owasp/` |
| `csrf.test.ts` | CSRF protection | `/tests/security/owasp/` |
| `auth-bypass.test.ts` | Authentication bypass | `/tests/security/owasp/` |
| `authz-bypass.test.ts` | Authorization bypass | `/tests/security/owasp/` |
| `advanced-injection.test.ts` | Advanced injection attacks | `/tests/security/owasp/` |
| `headers.test.ts` | Security headers | `/tests/security/` |
| `jwt.test.ts` | JWT security | `/tests/security/` |
| `rate-limit.test.ts` | Rate limiting | `/tests/security/` |
| `input-validation.test.ts` | Input validation | `/tests/security/` |

### Running Individual Tests

```bash
# SQL Injection tests
npm test -- tests/security/owasp/sql-injection.test.ts

# XSS tests
npm test -- tests/security/owasp/xss.test.ts

# All security tests
npm test -- tests/security/
```

## Remediation Guide

### High Severity: SQL Injection

**Detection:**
```bash
# Scanner output
[HIGH] Found 3 potential SQL injection via template literals in db.prepare
./lib/db/queries.ts:45: db.prepare(`SELECT * FROM users WHERE id = ${userId}`)
```

**Fix:**
```typescript
// ❌ Vulnerable
const user = db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();

// ✅ Secure
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

### High Severity: Hardcoded Secrets

**Detection:**
```bash
[HIGH] Found 2 potential hardcoded secrets
./lib/config/secrets.ts:5: const JWT_SECRET = "my-secret-key"
```

**Fix:**
```typescript
// ❌ Vulnerable
const JWT_SECRET = "my-secret-key";

// ✅ Secure
const JWT_SECRET = process.env.JWT_SECRET || throwError('JWT_SECRET required');
```

### Medium Severity: XSS via dangerouslySetInnerHTML

**Detection:**
```bash
[MEDIUM] Found 5 instances of dangerouslySetInnerHTML (review for XSS)
./components/TicketView.tsx:42: dangerouslySetInnerHTML={{ __html: content }}
```

**Fix:**
```typescript
// ❌ Vulnerable
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ Secure - use DOMPurify
import DOMPurify from 'dompurify';

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

// ✅ Better - avoid dangerouslySetInnerHTML
<div>{userContent}</div>
```

### Critical: eval() Usage

**Detection:**
```bash
[CRITICAL] Found 1 instances of eval() usage
./lib/workflow/executor.ts:78: eval(workflowCode)
```

**Fix:**
```typescript
// ❌ Vulnerable
const result = eval(workflowCode);

// ✅ Secure - use safer alternatives
const vm = require('vm');
const sandbox = { allowed: 'values' };
const result = vm.runInNewContext(workflowCode, sandbox, { timeout: 1000 });
```

## Security Best Practices

### 1. Never Trust User Input

```typescript
// Always validate and sanitize
import { z } from 'zod';

const ticketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  priority_id: z.number().int().min(1).max(4),
});

const validatedData = ticketSchema.parse(userInput);
```

### 2. Use Parameterized Queries

```typescript
// ✅ Always use placeholders
db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
db.prepare('INSERT INTO tickets (title, description) VALUES (?, ?)').run(title, desc);
```

### 3. Implement Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. Use Security Headers

```typescript
// In next.config.js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
```

### 5. Strong Authentication

```typescript
import bcrypt from 'bcrypt';

// Hash passwords with high cost factor
const hashedPassword = await bcrypt.hash(password, 12);

// Verify with constant-time comparison
const isValid = await bcrypt.compare(password, hashedPassword);
```

## Continuous Security

### Weekly Tasks

- [ ] Run `npm audit` and update dependencies
- [ ] Review security scan reports
- [ ] Check for new CVEs affecting dependencies

### Monthly Tasks

- [ ] Run full OWASP test suite
- [ ] Review access logs for suspicious activity
- [ ] Update security policies
- [ ] Conduct code review for new features

### Quarterly Tasks

- [ ] Penetration testing
- [ ] Security training for developers
- [ ] Update security documentation
- [ ] Review and rotate secrets

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [Snyk Vulnerability Database](https://snyk.io/vuln)

## Support

For security issues or questions:
- Open a security issue in GitHub
- Contact security team
- Review security documentation in `/docs/SECURITY.md`
