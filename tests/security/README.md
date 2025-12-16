# Security Testing Suite

Comprehensive security testing suite for ServiceDesk application covering OWASP Top 10 and beyond.

## 🎯 Overview

This security testing suite validates the application against:

- **OWASP Top 10** vulnerabilities
- **JWT security** best practices
- **Authentication & Authorization** bypass attempts
- **Rate limiting** and brute force protection
- **Input validation** across all vectors
- **Security headers** configuration
- **Dependency vulnerabilities**
- **Hardcoded secrets** detection

## 📁 Test Structure

```
tests/security/
├── owasp/                      # OWASP Top 10 Tests
│   ├── sql-injection.test.ts   # A03: Injection
│   ├── xss.test.ts             # A03: XSS
│   ├── csrf.test.ts            # A01: Broken Access Control
│   ├── auth-bypass.test.ts     # A07: Auth Failures
│   └── authz-bypass.test.ts    # A01: Authorization
├── headers.test.ts             # Security Headers
├── jwt.test.ts                 # JWT Security
├── rate-limit.test.ts          # Rate Limiting
├── input-validation.test.ts    # Input Validation
├── payloads.ts                 # Attack Payloads
└── README.md                   # This file
```

## 🚀 Running Tests

### Run All Security Tests

```bash
npm run test:security
```

This runs:
1. All security unit tests
2. Dependency vulnerability scan
3. Secrets detection scan

### Run Specific Test Suites

```bash
# OWASP Top 10 tests
npm run test:security:owasp

# Security headers
npm run test:security:headers

# JWT security
npm run test:security:jwt

# Rate limiting
npm run test:security:rate-limit

# Input validation
npm run test:security:input
```

### Scan for Vulnerabilities

```bash
# Scan dependencies
npm run security:scan-deps

# Scan for secrets
npm run security:scan-secrets

# Run all scans
npm run security:scan
```

### Generate Comprehensive Report

```bash
npm run security:report
```

Generates HTML report in `security-reports/` directory.

## 📋 Test Coverage

### OWASP Top 10 (2021)

#### A01:2021 – Broken Access Control ✅
- **Tests**: `owasp/authz-bypass.test.ts`, `owasp/csrf.test.ts`
- **Coverage**:
  - Vertical privilege escalation
  - Horizontal privilege escalation
  - Insecure Direct Object References (IDOR)
  - Missing function-level access control
  - CSRF token validation
  - Multi-tenancy isolation

#### A02:2021 – Cryptographic Failures ✅
- **Tests**: `jwt.test.ts`, `headers.test.ts`
- **Coverage**:
  - JWT signature verification
  - Token encryption
  - Secure headers (HSTS, CSP)
  - Password hashing validation

#### A03:2021 – Injection ✅
- **Tests**: `owasp/sql-injection.test.ts`, `owasp/xss.test.ts`
- **Coverage**:
  - SQL injection in queries
  - XSS (stored, reflected, DOM-based)
  - Command injection
  - Path traversal
  - XXE (XML External Entity)

#### A04:2021 – Insecure Design ✅
- **Tests**: All test files
- **Coverage**:
  - Rate limiting design
  - Secure authentication flow
  - Defense in depth

#### A05:2021 – Security Misconfiguration ✅
- **Tests**: `headers.test.ts`
- **Coverage**:
  - Security headers
  - Error message disclosure
  - Default credentials
  - Unnecessary features

#### A06:2021 – Vulnerable Components ✅
- **Scripts**: `scripts/security/scan-dependencies.sh`
- **Coverage**:
  - npm audit
  - Snyk scanning
  - Outdated packages
  - Known vulnerabilities

#### A07:2021 – Authentication Failures ✅
- **Tests**: `owasp/auth-bypass.test.ts`
- **Coverage**:
  - Brute force protection
  - Credential stuffing
  - Session management
  - Username enumeration
  - Password reset security

#### A08:2021 – Software and Data Integrity ✅
- **Tests**: `input-validation.test.ts`
- **Coverage**:
  - Prototype pollution
  - Insecure deserialization
  - CI/CD pipeline validation

#### A09:2021 – Security Logging Failures ✅
- **Tests**: Integrated in all tests
- **Coverage**:
  - Audit logging validation
  - No sensitive data in logs
  - Error tracking

#### A10:2021 – Server-Side Request Forgery ✅
- **Tests**: `input-validation.test.ts`
- **Coverage**:
  - SSRF in URL fields
  - Metadata endpoint protection
  - Internal network access prevention

### Additional Security Tests

#### JWT Security ✅
- None algorithm attack
- Signature manipulation
- Token expiration
- Algorithm confusion
- Weak secret detection
- Claims validation

#### Rate Limiting ✅
- Login endpoint protection
- API endpoint limits
- IP-based limiting
- User-based limiting
- Bypass attempt prevention

#### Input Validation ✅
- Email validation
- Password strength
- Type validation
- Length validation
- Special characters
- Regex DoS prevention

#### Security Headers ✅
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Content-Security-Policy
- Referrer-Policy
- Permissions-Policy

## 🔍 Attack Payloads

The `payloads.ts` file contains comprehensive attack payloads:

- **SQL Injection**: 20+ payloads (union, blind, time-based)
- **XSS**: 25+ payloads (script tags, event handlers, SVG)
- **Path Traversal**: 10+ payloads (Unix, Windows, encoded)
- **Command Injection**: 10+ payloads
- **XXE**: 3 XML entity payloads
- **Prototype Pollution**: 4 payloads
- **NoSQL Injection**: 7+ payloads
- **JWT Attacks**: 5+ attack vectors
- **SSRF**: 10+ internal endpoint attempts

## 📊 Test Expectations

### Pass Criteria

Tests pass when the application:

1. **Rejects malicious inputs** (400/422 status)
2. **Prevents unauthorized access** (401/403 status)
3. **Doesn't expose sensitive errors** (no stack traces)
4. **Implements rate limiting** (429 after threshold)
5. **Has security headers** (all critical headers present)
6. **Validates JWT properly** (rejects tampering)
7. **No HIGH/CRITICAL vulnerabilities** in dependencies
8. **No secrets in codebase**

### Fail Criteria

Tests fail when:

1. Malicious input is accepted without validation
2. Authentication/authorization can be bypassed
3. Database errors are exposed to users
4. No rate limiting on sensitive endpoints
5. Missing critical security headers
6. JWT vulnerabilities exist
7. HIGH/CRITICAL dependency vulnerabilities found
8. Secrets detected in code

## 🔧 Configuration

### Environment Variables

Security tests require:

```env
TEST_URL=http://localhost:3000  # Test target URL
```

### Test Database

Tests use isolated test database. Never run against production!

### Timeouts

Some tests (rate limiting, brute force) have extended timeouts:

- Normal tests: 5 seconds
- Rate limit tests: 30-60 seconds

## 📝 Writing New Security Tests

### Template

```typescript
import { describe, it, expect } from 'vitest';

describe('Security Feature Tests', () => {
  describe('Specific Attack Vector', () => {
    it('should prevent [specific attack]', async () => {
      const response = await fetch(`${BASE_URL}/api/endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'malicious' }),
      });

      // Verify protection
      expect([400, 403, 422]).toContain(response.status);
    });
  });
});
```

### Best Practices

1. **Test both positive and negative cases**
2. **Use realistic attack payloads**
3. **Verify error messages don't leak info**
4. **Test edge cases and boundary conditions**
5. **Document expected behavior**
6. **Keep tests independent**
7. **Clean up test data**

## 🚨 CI/CD Integration

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
npm run security:scan-secrets
if [ $? -ne 0 ]; then
    echo "❌ Secrets detected! Commit aborted."
    exit 1
fi
```

### GitHub Actions

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:security
      - run: npm run security:scan
```

### Fail Build on Vulnerabilities

```yaml
- run: npm run security:scan-deps
  # Fails build if HIGH/CRITICAL vulnerabilities found
```

## 📈 Metrics

Track security test results:

- **Test Pass Rate**: Target 100%
- **Vulnerability Count**: Target 0 HIGH/CRITICAL
- **Secrets Detected**: Target 0
- **Coverage**: Target >90% of endpoints

## 🛠️ Troubleshooting

### Tests Timing Out

Rate limiting tests may timeout if:
- Server is slow
- Rate limit threshold is high
- Network latency

**Solution**: Increase timeout in test file

### False Positives in Secrets Scan

Test files may trigger false positives:
- Add to exclude pattern in `scan-secrets.sh`
- Ensure `.env.example` is whitelisted

### Dependency Scan Failures

If dependencies have vulnerabilities:

```bash
# Update dependencies
npm audit fix

# For breaking changes
npm audit fix --force

# Check specific package
npm audit <package-name>
```

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)
- [Web Security Academy](https://portswigger.net/web-security)

## 🤝 Contributing

When adding new security tests:

1. Follow existing test structure
2. Add payloads to `payloads.ts` if reusable
3. Document attack vector in test description
4. Update this README
5. Ensure tests are deterministic

## 📞 Security Contact

Found a vulnerability not covered by tests?

**DO NOT** open a public issue!

Email: security@servicedesk.com

---

**Last Updated**: January 2024
**Maintained By**: Security Team
**Review Frequency**: Quarterly
