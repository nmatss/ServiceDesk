# Security Policy

## Overview

ServiceDesk takes security seriously. This document describes our security policy, the security features implemented in the platform, and how to report vulnerabilities.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |

Only the latest release in the 1.0.x line receives security updates. We recommend always running the latest version.

## Reporting a Vulnerability

**Do NOT create public GitHub issues for security vulnerabilities.**

### How to Report

Email: **security@servicedesk.com.br**

Include the following in your report:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Affected component(s) and version(s)
- Suggested fix, if any

### Response Timeline

| Action | Timeframe |
|--------|-----------|
| Acknowledgment of report | 48 hours |
| Initial assessment | 5 business days |
| Status update to reporter | 10 business days |
| Fix for critical vulnerabilities | 15 business days |
| Fix for non-critical vulnerabilities | 30 business days |

We will keep reporters informed throughout the process. If the vulnerability is confirmed, we will credit the reporter in the security advisory (unless anonymity is requested).

## Security Features

### Authentication

- **JWT Tokens**: HS256-signed access tokens (15-minute expiry) and refresh tokens (7-day expiry) stored in httpOnly cookies with device fingerprinting
- **Password Hashing**: bcryptjs with 12 salt rounds
- **Password Policies**: Entropy checks, dictionary validation, history tracking (last 5 passwords), 90-day expiration
- **Multi-Factor Authentication (MFA)**: TOTP (authenticator apps), SMS, Email, and 10 backup codes stored with HMAC-SHA256 hashing
- **Single Sign-On (SSO)**: OAuth2 and SAML provider support
- **Gov.br Integration**: Authentication for Brazilian government agencies
- **WebAuthn/Biometric**: Passwordless authentication via platform authenticators
- **Login Monitoring**: Login attempt tracking with suspicious activity detection

### Authorization (RBAC)

Six-tier role hierarchy with 29 granular permissions:

```
super_admin > admin > tenant_admin > team_manager > agent > user
```

- Role checks use constants from `lib/auth/roles.ts` (never hardcoded strings)
- Conditional permissions: `owner_only`, `department_only`, `business_hours`
- Permission engine in `lib/auth/rbac.ts`
- Unified auth guard: `requireTenantUserContext(request)` on all protected endpoints
- Super Admin guard: `requireSuperAdmin(request)` for cross-tenant operations

### CSRF Protection

- Double Submit Cookie pattern with HMAC-SHA256 signing
- Session-bound tokens with 1-hour expiry
- Pre-authentication endpoints (login, register) are exempt
- Implementation in `lib/security/csrf.ts`

### Encryption

- **AES-256-GCM** encryption for sensitive database fields
- Key rotation support for encrypted data
- Implementation in `lib/security/` modules

### Content Security Policy (CSP)

- Strict CSP in production mode
- `X-Frame-Options: DENY` to prevent clickjacking
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` with `includeSubDomains`
- `Permissions-Policy` restricting camera, microphone, and geolocation
- `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting

Per-endpoint rate limits enforced via Redis (with graceful fallback):

| Endpoint | Limit |
|----------|-------|
| Login | 5 requests / 15 minutes |
| Register | 3 requests / hour |
| Password reset | 3 requests / hour |
| Webhooks | Rate-limited per endpoint |
| Cron jobs | 60 requests / minute |
| Default API | 60 requests / minute |

### SQL Injection Prevention

- All queries use parameterized statements via the database adapter
- No string concatenation in SQL
- LIKE wildcard escaping (`%` and `_`) on all search parameters
- Pagination capped at 100 results per request
- Array input limited to 50 items per request

### XSS Prevention

- Input sanitization via `isomorphic-dompurify`
- Output encoding in React components (default behavior)
- CSP headers restrict inline script execution

### Multi-Tenant Isolation

- Every database query is scoped by `organization_id` from the authenticated JWT
- Tenant resolution via middleware (subdomain, header, or JWT claim)
- Cross-tenant access is blocked at the middleware, API, and database layers
- Super Admin operations require explicit `organizationId === 1` or `super_admin` role

### SSRF Protection

- Webhook manager validates all target URLs before delivery:
  - Blocks private IPs (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  - Blocks localhost variants and cloud metadata endpoints (169.254.169.254)
  - Requires HTTPS in production
  - Only allows HTTP/HTTPS protocols
- Validation runs on both endpoint creation and webhook delivery
- IP validation via `lib/api/ip-validation.ts` (`isPrivateIP()`)

### File Upload Security

- Virus scanning via VirusTotal API v3 (`lib/security/virus-scanner.ts`)
- Files are scanned before storage — malicious files are rejected with 400 error
- Graceful degradation when `VIRUSTOTAL_API_KEY` is not configured (logs warning, allows upload)
- File type and size validation on upload

### Workflow Security

- Tenant isolation enforced on all workflow operations via `organization_id`
- Secrets are masked in variable logging
- Approval tokens stored in the database (not in memory)

### PII and Data Protection

- PII detection and masking in logs and exports
- Sensitive field encryption at rest (AES-256-GCM)
- Audit logging for all data access and modifications

## Security Best Practices for Contributors

### Code

1. **Never commit secrets** — use environment variables for all sensitive configuration
2. **Always use parameterized queries** — never concatenate user input into SQL
3. **Always scope by organization_id** — every query must filter by tenant
4. **Always apply rate limiting** — use `applyRateLimit(request, RATE_LIMITS.*)` on all endpoints
5. **Always validate input** — use Zod schemas for request body validation
6. **Always sanitize output** — use DOMPurify for user-generated content
7. **Never expose internal errors** — use `apiError()` with safe messages
8. **Use ROLES constants** — never hardcode role strings

### LIKE Escaping

```typescript
const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
conditions.push("(name LIKE ? ESCAPE '\\')");
params.push(`%${escaped}%`);
```

### Pagination Cap

```typescript
const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
```

### Division by Zero

```sql
SELECT total / NULLIF(divisor, 0) FROM table
```

### Date Validation

```typescript
const date = new Date(input);
if (isNaN(date.getTime())) return apiError('Invalid date', 400);
```

### Array Input Cap

```typescript
const ids = requestIds.slice(0, 50);
```

## Compliance

### LGPD (Lei Geral de Protecao de Dados) / GDPR

ServiceDesk implements the following data protection measures:

- **Consent Tracking**: All data processing requires explicit user consent with documented legal basis, stored in the `lgpd_consents` table
- **Privacy Policy**: Comprehensive privacy policy accessible to all users
- **Terms of Service**: Clear terms of service with acceptance tracking
- **Cookie Consent**: Banner for cookie consent with granular control
- **Data Portability**: Users can export all their personal data (Article 18, LGPD)
- **Right to Erasure**: Users can request deletion of their personal data (Article 18, LGPD)
- **Data Retention**: 3-year retention policy with automatic cleanup
- **Data Minimization**: Only necessary data is collected and stored
- **Audit Trail**: All data access and modifications are logged for compliance auditing
- **PII Detection**: Automated detection and masking of personally identifiable information

### Audit Logging

All security-relevant actions are recorded in audit logs:

- Authentication events (login, logout, failed attempts, MFA verification)
- Authorization failures (access denied)
- Data access and modifications
- Administrative actions (user management, configuration changes)
- Cross-tenant operations by Super Admin

Audit logs are queryable by date, organization, user, and action type.

## Security Architecture

```
Client Request
    |
    v
[Middleware] ── Rate Limiting ── Tenant Resolution ── JWT Verification
    |
    v
[API Route] ── requireTenantUserContext() ── Input Validation (Zod)
    |
    v
[Business Logic] ── RBAC Permission Check ── Data Sanitization
    |
    v
[Database Adapter] ── Parameterized Queries ── organization_id Scoping
    |
    v
[Response] ── apiSuccess() / apiError() ── Security Headers
```

## Infrastructure Security

- **Docker**: Multi-stage build (<200MB), non-root user, tini init system
- **Health Checks**: `/api/health/live`, `/api/health/ready`, `/api/health/startup`
- **Monitoring**: Sentry (server/client/edge) for error tracking, Prometheus for metrics
- **TLS**: HTTPS enforced in production with HSTS
- **Graceful Shutdown**: Custom server handles SIGTERM/SIGINT for clean shutdown

## Contact

- Security issues: security@servicedesk.com.br
- General inquiries: Open a GitHub issue

---

Last Updated: 2026-03-19
Maintained By: ServiceDesk Development Team
Security Review: Required quarterly
