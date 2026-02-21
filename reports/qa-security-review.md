# ServiceDesk Security & DevOps Review Report

**Date**: 2026-02-21
**Reviewer**: QA Security Agent (Claude Opus 4.6)
**Scope**: Full security audit, DevOps/infra review, OWASP Top 10 assessment

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Security Score** | **68/100** (Needs Improvement) |
| **CRITICAL vulnerabilities** | 4 |
| **HIGH vulnerabilities** | 8 |
| **MEDIUM vulnerabilities** | 12 |
| **LOW vulnerabilities** | 9 |
| **DevOps Maturity** | Intermediate |

The ServiceDesk project has a solid security foundation with JWT-based auth, CSRF protection, rate limiting, tenant isolation, and comprehensive security headers. However, several critical issues remain that must be addressed before production deployment, including **code injection via `new Function()` and `eval()`**, **SQL injection in LGPD module**, **65 npm dependency vulnerabilities (3 critical)**, and a **weak account lockout policy**.

---

## 1. OWASP Top 10 Assessment

### A01: Broken Access Control -- MEDIUM RISK

**Findings:**

- **GOOD**: Multi-tenant isolation enforced via `organization_id` scoping in all queries
- **GOOD**: JWT tenant validation in middleware (`middleware.ts:588`) prevents cross-tenant access
- **GOOD**: `validateTenantAccess()` function in `lib/tenant/context.ts` validates resource ownership
- **GOOD**: Admin routes require specific roles (`super_admin`, `tenant_admin`, `team_manager`, `admin`)
- **GOOD**: File access verifies tenant ownership via DB record check

**Issues:**

1. **[MEDIUM] RBAC not enforced per-route in API handlers**: Most API routes check only role strings (e.g., `admin`, `agent`) rather than granular permissions from the RBAC engine. The `rbac.ts` and `rbac-engine.ts` modules exist but are rarely used in actual route handlers.
   - File: Most `app/api/*/route.ts` files
   - Impact: Coarse-grained access control; permission escalation possible if role names change

2. **[LOW] `request-guard.ts` uses synchronous context extraction**: The `requireTenantUserContext()` function calls `getUserContextFromRequest(request)` and `getTenantContextFromRequest(request)` which are async functions but called synchronously on lines 23-24.
   - File: `lib/tenant/request-guard.ts:23-33`
   - Impact: May return null context, bypassing checks

---

### A02: Cryptographic Failures -- LOW RISK

**Findings:**

- **GOOD**: JWT uses HS256 with `jose` library (not custom crypto)
- **GOOD**: JWT secret validated to be >= 32 chars with weak-pattern detection
- **GOOD**: Refresh tokens stored as SHA-256 hashes in database
- **GOOD**: Passwords hashed with bcrypt via `hashPassword()`
- **GOOD**: CSRF tokens use HMAC-SHA256 via Web Crypto API
- **GOOD**: Device fingerprinting uses SHA-256
- **GOOD**: Timing-safe comparison for CSRF validation (`timingSafeEqual()` in `lib/security/csrf.ts:103`)

**Issues:**

1. **[LOW] HS256 algorithm**: While secure, HS256 uses symmetric signing. RS256 (asymmetric) would be more appropriate for a multi-service architecture. Current implementation is acceptable for single-service deployment.

---

### A03: Injection -- CRITICAL RISK

**Findings:**

1. **[CRITICAL] Code Injection via `new Function()` in Dynamic Permissions**
   - File: `lib/auth/dynamic-permissions.ts:421`
   - The `safeEvaluate()` method constructs and executes arbitrary JavaScript using `new Function()`. The `condition` string is stored in the database (`dynamic_permission_rules` table) and directly evaluated.
   - While only admins can create rules, a compromised admin account or SQL injection elsewhere could inject arbitrary code execution.
   - **PoC**: An attacker who can insert into `dynamic_permission_rules` can execute:
     ```
     condition: "(() => { require('child_process').execSync('id > /tmp/pwned'); return true; })()"
     ```
   - The "allowedGlobals" sandbox is trivially bypassable since `new Function()` has access to the global scope.

2. **[CRITICAL] `eval()` in Notification Batching**
   - File: `lib/notifications/batching.ts:113`
   - `eval(config.custom_grouper)` directly evaluates a string from the database as code.
   - Any attacker who can write to the notification batch configuration table gets arbitrary code execution.

3. **[CRITICAL] `eval()` in ML Pipeline**
   - File: `lib/analytics/ml-pipeline.ts:253`
   - `eval(formula)` evaluates derived feature formulas. If formulas come from user-controllable input or DB records, this is code injection.

4. **[HIGH] SQL Injection in LGPD Data Portability**
   - File: `lib/lgpd/data-portability.ts:299`
   - String interpolation used for date filters: `AND created_at BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`
   - While `Date.toISOString()` output is predictable, this violates the parameterized query pattern and sets a dangerous precedent.
   - Same pattern in `lib/lgpd/consent-manager.ts:305`

5. **[MEDIUM] Dynamic SQL in RBAC Engine Row-Level Security**
   - File: `lib/auth/rbac-engine.ts:518-526`
   - `applyRowLevelSecurity()` concatenates `p.condition` values (from `row_level_policies` table) directly into SQL WHERE clauses.
   - If an attacker can insert into `row_level_policies`, they can inject arbitrary SQL.

- **GOOD**: All standard API routes use parameterized queries via the adapter (`executeQuery`, `executeRun`)
- **GOOD**: No string concatenation found in standard CRUD routes

---

### A04: Insecure Design -- MEDIUM RISK

**Issues:**

1. **[HIGH] Account Lockout Duration Too Short**
   - File: `app/api/auth/login/route.ts:303-304`
   - `LOCKOUT_DURATION_MINUTES = 1` -- Only 1 minute lockout after 5 failed attempts
   - An attacker can attempt 5 passwords per minute indefinitely (300/hour)
   - Should be at least 15-30 minutes with exponential backoff

2. **[MEDIUM] Login Route Does Not Use Refresh Token Rotation**
   - File: `app/api/auth/login/route.ts:397-404`
   - Login creates only an access token (line 398-404) but does NOT generate a refresh token
   - The register route (`register/route.ts:377-378`) correctly generates both tokens
   - Inconsistent token management between login and registration flows

3. **[MEDIUM] Tenant Context Cookie Not HttpOnly**
   - File: `middleware.ts:368` and `app/api/auth/login/route.ts:432-446`
   - `tenant-context` cookie set with `httpOnly: false`
   - Contains tenant ID and slug -- XSS could leak organizational info
   - While not auth-critical, reduces defense-in-depth

---

### A05: Security Misconfiguration -- MEDIUM RISK

**Issues:**

1. **[HIGH] CSP Allows `unsafe-inline` and `unsafe-eval` in Production**
   - File: `lib/security/helmet.ts:43-48`
   - Production default CSP includes `'unsafe-inline'` and `'unsafe-eval'` for script-src
   - This completely negates CSP XSS protection
   - The `lib/security/headers.ts:66-68` has stricter production CSP, but `helmet.ts` overwrites it (applied after)
   - Conflicting CSP headers: both `headers.ts` and `helmet.ts` set Content-Security-Policy, with helmet's version (less strict) applied last

2. **[MEDIUM] Nginx Missing TLS Configuration**
   - File: `nginx/conf.d/default.conf`
   - Server listens only on port 80 (HTTP)
   - No SSL/TLS configuration
   - No redirect from HTTP to HTTPS
   - Missing: `ssl_protocols TLSv1.2 TLSv1.3`, `ssl_ciphers`, `ssl_certificate`

3. **[MEDIUM] Nginx Missing Request Size Limits**
   - File: `nginx/conf.d/default.conf`
   - No `client_max_body_size` directive -- defaults to 1MB but should be explicit
   - No `proxy_read_timeout` protection on `/socket.io/` location

4. **[MEDIUM] Dev Redis Has No Password**
   - File: `docker-compose.dev.yml:38`
   - `redis-server --appendonly yes` without `--requirepass`
   - If dev Redis port is exposed (it is, port 6379), anyone can connect
   - Production correctly requires a password

5. **[MEDIUM] Dev Docker Exposes Hardcoded JWT/Session Secrets**
   - File: `docker-compose.dev.yml:82-83`
   - `JWT_SECRET: dev-jwt-secret-not-for-production`
   - `SESSION_SECRET: dev-session-secret-not-for-production`
   - These default values would bypass the weak-secret validation in `lib/security/csrf.ts` because they contain "dev" pattern... but `csrf.ts` only checks CSRF_SECRET, not JWT_SECRET default values

6. **[LOW] Health Endpoint Exposes Internal Details**
   - File: `app/api/health/route.ts`
   - Returns database status, Redis status, observability health, version, environment
   - In production, health checks should return minimal info (healthy/unhealthy)

---

### A06: Vulnerable and Outdated Components -- HIGH RISK

**npm audit results: 65 vulnerabilities (3 critical, 54 high, 6 moderate, 2 low)**

| Package | Severity | Issue |
|---------|----------|-------|
| `next` (10.0.0-15.5.9) | HIGH | DoS via Image Optimizer, HTTP request deserialization DoS |
| `quill` (2.0.3) | HIGH | XSS via HTML export feature |
| `tar` (<=7.5.7) | HIGH | Path traversal, symlink poisoning, arbitrary file overwrite |
| `@aws-sdk/*` | HIGH | 54 high severity issues in AWS SDK packages |

**Impact**: The Quill XSS vulnerability is particularly relevant since ServiceDesk uses React Quill for rich text editing, which means user-generated HTML content could be weaponized.

---

### A07: Identification and Authentication Failures -- LOW RISK

**Findings:**

- **GOOD**: Bcrypt password hashing
- **GOOD**: Strong password policy (12+ chars, upper, lower, number, special)
- **GOOD**: Account lockout after 5 failed attempts
- **GOOD**: Login attempts logged to `login_attempts` table
- **GOOD**: Audit trail for login/register actions
- **GOOD**: Token type validation (access vs refresh) in middleware
- **GOOD**: Device fingerprinting for token binding
- **GOOD**: Refresh token stored in DB with revocation support

**Issues:**

1. **[HIGH] Lockout Duration Only 1 Minute** (covered in A04)
2. **[MEDIUM] No Account Recovery Rate Limit Specific Config**: `AUTH_FORGOT_PASSWORD` rate limit defined (3/hour) but no forgot-password route exists to use it

---

### A08: Software and Data Integrity Failures -- LOW RISK

**Findings:**

- **GOOD**: Docker images use specific versions (postgres:16-alpine, redis:7-alpine)
- **GOOD**: Docker compose enforces required secrets with `?:` syntax
- **GOOD**: App container runs as non-root user (1001:1001)
- **GOOD**: Read-only root filesystem with tmpfs for writable dirs
- **GOOD**: `no-new-privileges:true` and `cap_drop: ALL`

**Issues:**

1. **[LOW] No Dockerfile Present in Repo**: The `docker-compose.yml` references `Dockerfile` but it's not in the repo (possibly `.gitignore`d). Cannot audit build security.
2. **[LOW] No `package-lock.json` integrity verification step**: No evidence of `npm ci --ignore-scripts` pattern in build.

---

### A09: Security Logging and Monitoring Failures -- LOW RISK

**Findings:**

- **GOOD**: Comprehensive audit logging (`audit_logs` table)
- **GOOD**: Login attempts tracked with IP and user agent
- **GOOD**: RBAC permission checks logged to `permission_audit_log`
- **GOOD**: Sentry integration for error tracking
- **GOOD**: Structured logging via `lib/monitoring/structured-logger`
- **GOOD**: Prometheus/Grafana setup in docker-compose

**Issues:**

1. **[MEDIUM] Error Logging May Expose Sensitive Data**
   - File: `app/api/auth/login/route.ts:458`
   - `console.error('Login error:', error)` -- may log full error objects including query parameters
   - Should use structured logger with PII filtering

2. **[LOW] No Log Rotation Configuration for App Logs**
   - Docker logging configured with `max-size: 10m` and `max-file: 3` (good)
   - But application-level logs have no rotation configured

---

### A10: Server-Side Request Forgery (SSRF) -- LOW RISK

**Findings:**

- **GOOD**: CSP `connect-src` restricts outbound connections to specific domains
- **GOOD**: No user-controllable URL fetching in API routes
- **LOW**: `OPENAI_API_KEY` used for AI features -- OpenAI API calls are made server-side but URL is hardcoded

---

## 2. Detailed Vulnerability Analysis

### CRITICAL (4)

#### CRIT-01: Code Injection via `new Function()` in Dynamic Permissions
- **File**: `lib/auth/dynamic-permissions.ts:421`
- **CVSS**: 9.8 (Critical)
- **Description**: The `safeEvaluate()` method uses `new Function()` to evaluate JavaScript expressions stored in the database. The "allowedGlobals" sandbox provides zero actual protection because `new Function()` still has access to the global scope, `process`, `require`, etc.
- **Attack Vector**: Any user who can write to `dynamic_permission_rules` table (admin, or via SQLi) can execute arbitrary server-side code.
- **Remediation**: Replace with a safe expression evaluator (e.g., `expr-eval`, `jsep`, or a custom AST-based evaluator). Never use `new Function()` or `eval()` with data from the database.

#### CRIT-02: `eval()` in Notification Batching
- **File**: `lib/notifications/batching.ts:113`
- **CVSS**: 9.1 (Critical)
- **Description**: `eval(config.custom_grouper)` evaluates arbitrary JS from DB records.
- **Remediation**: Use a lookup map of predefined grouper functions instead of `eval()`.

#### CRIT-03: `eval()` in ML Pipeline
- **File**: `lib/analytics/ml-pipeline.ts:253`
- **CVSS**: 8.6 (High/Critical)
- **Description**: `eval(formula)` evaluates mathematical formulas that may originate from configuration.
- **Remediation**: Use a safe math expression parser (e.g., `mathjs` or `expr-eval`).

#### CRIT-04: 65 npm Dependency Vulnerabilities (3 Critical, 54 High)
- **CVSS**: Variable (up to 9.8)
- **Description**: `npm audit` reports 65 vulnerabilities including critical issues in `next`, `quill`, `tar`, and `@aws-sdk`.
- **Remediation**: Run `npm audit fix` for non-breaking fixes. Evaluate breaking changes for `npm audit fix --force`. Prioritize upgrading `next` and `quill`.

---

### HIGH (8)

#### HIGH-01: Account Lockout Only 1 Minute
- **File**: `app/api/auth/login/route.ts:303-304`
- **Description**: `LOCKOUT_DURATION_MINUTES = 1` allows 300 password guesses per hour.
- **Remediation**: Increase to at least 15 minutes. Consider exponential backoff (1m, 5m, 15m, 60m).

#### HIGH-02: SQL Injection in LGPD Module
- **File**: `lib/lgpd/data-portability.ts:299`
- **Description**: Date values interpolated directly into SQL strings.
- **Remediation**: Use parameterized queries with `?` placeholders.

#### HIGH-03: CSP Allows unsafe-inline/unsafe-eval in Production
- **File**: `lib/security/helmet.ts:43-48`
- **Description**: Production CSP includes `'unsafe-inline'` and `'unsafe-eval'` which negates XSS protection.
- **Remediation**: Remove `unsafe-eval` from production. Use nonces for necessary inline scripts.

#### HIGH-04: Quill XSS Vulnerability (CVE in quill 2.0.3)
- **Description**: Known XSS vulnerability in Quill HTML export. Users can inject scripts via rich text content.
- **Remediation**: Update Quill to latest fixed version. Always sanitize HTML output with DOMPurify.

#### HIGH-05: Nginx Has No TLS Configuration
- **File**: `nginx/conf.d/default.conf`
- **Description**: Only HTTP (port 80), no HTTPS configured.
- **Remediation**: Add SSL certificate configuration, enforce HTTPS redirect.

#### HIGH-06: Login Does Not Generate Refresh Token
- **File**: `app/api/auth/login/route.ts:397-404`
- **Description**: Login only creates access token. Users must re-login every 15 minutes.
- **Remediation**: Add refresh token generation and cookie setting (as done in register route).

#### HIGH-07: SQL Injection in LGPD Consent Manager
- **File**: `lib/lgpd/consent-manager.ts:305`
- **Description**: Same date interpolation pattern as HIGH-02.
- **Remediation**: Use parameterized queries.

#### HIGH-08: Row-Level Security SQL Injection
- **File**: `lib/auth/rbac-engine.ts:518-526`
- **Description**: `applyRowLevelSecurity()` concatenates `condition` field from DB directly into SQL.
- **Remediation**: Only allow whitelisted condition patterns or use a safe expression builder.

---

### MEDIUM (12)

| ID | Issue | File | Description |
|----|-------|------|-------------|
| MED-01 | RBAC not enforced per-route | `app/api/*/route.ts` | Routes use role-string checks, not RBAC engine |
| MED-02 | Nginx missing request size limits | `nginx/conf.d/default.conf` | No `client_max_body_size` |
| MED-03 | Dev Redis no password | `docker-compose.dev.yml:38` | Port 6379 exposed without auth |
| MED-04 | Dev Docker hardcoded secrets | `docker-compose.dev.yml:82-83` | Weak default JWT/session secrets |
| MED-05 | Tenant context cookie not httpOnly | `middleware.ts:368` | XSS can leak tenant info |
| MED-06 | Error logging may expose PII | `app/api/auth/login/route.ts:458` | `console.error` with full error |
| MED-07 | Duplicate CSP headers | `headers.ts` + `helmet.ts` | Conflicting CSP policies applied |
| MED-08 | No forgot-password route | N/A | Rate limit defined but no implementation |
| MED-09 | File validation MIME-only | `lib/utils/file-upload.ts:114-118` | No magic byte validation, trusts client MIME type |
| MED-10 | No virus scanning | `app/api/files/upload/route.ts:220` | `virus_scanned = 0` hardcoded, TODO comment |
| MED-11 | `request-guard.ts` async/sync mismatch | `lib/tenant/request-guard.ts:23-33` | Async functions called synchronously |
| MED-12 | BYPASS_RATE_LIMIT env var | `lib/rate-limit/redis-limiter.ts:143` | Could accidentally be enabled in prod |

---

### LOW (9)

| ID | Issue | File | Description |
|----|-------|------|-------------|
| LOW-01 | HS256 vs RS256 | `lib/auth/token-manager.ts:155` | Symmetric JWT signing |
| LOW-02 | Health endpoint exposes details | `app/api/health/route.ts` | Returns DB/Redis status in prod |
| LOW-03 | No Dockerfile in repo | N/A | Cannot audit container build |
| LOW-04 | No package integrity verification | N/A | No `npm ci --ignore-scripts` evidence |
| LOW-05 | Content-Disposition header injection | `app/api/files/[...path]/route.ts:174` | `original_name` from DB used without sanitization |
| LOW-06 | No log rotation for app logs | N/A | Docker only, no app-level |
| LOW-07 | Grafana dev anonymous admin | `docker-compose.dev.yml:235-236` | Anonymous access with Admin role |
| LOW-08 | `server_tokens off` in nginx only | `nginx/nginx.conf:25` | But `nginx:alpine` image version may leak |
| LOW-09 | Elasticsearch dynamic import hack | `lib/knowledge/elasticsearch-integration.ts:119` | `new Function('return import(...)')` |

---

## 3. DevOps & Infrastructure Analysis

### Docker Configuration

**Production (`docker-compose.yml`)** -- GOOD

| Feature | Status | Details |
|---------|--------|---------|
| Secret enforcement | PASS | Required secrets use `?:` syntax |
| Non-root user | PASS | App runs as 1001:1001 |
| Read-only filesystem | PASS | `read_only: true` with tmpfs |
| Security options | PASS | `no-new-privileges`, `cap_drop: ALL` |
| Resource limits | PASS | 2 CPU, 2GB memory limit |
| Health checks | PASS | All services have health checks |
| Log rotation | PASS | `max-size: 10m`, `max-file: 3` |
| Network isolation | PASS | Custom bridge network |
| Postgres password | PASS | Required, not defaulted |
| Redis password | PASS | Required, not defaulted |

**Development (`docker-compose.dev.yml`)** -- ACCEPTABLE (dev only)

| Feature | Status | Details |
|---------|--------|---------|
| Default passwords | WARN | `dev_password` for Postgres |
| Redis no auth | WARN | No requirepass |
| Exposed ports | WARN | All services exposed to host |
| Hardcoded secrets | WARN | Default JWT/session secrets |
| Debugger port | INFO | Port 9229 exposed |

### Nginx Configuration

| Feature | Status | Details |
|---------|--------|---------|
| `server_tokens off` | PASS | Hides nginx version |
| WebSocket support | PASS | Proper upgrade handling |
| Security headers | PARTIAL | X-Frame, X-Content-Type, Referrer-Policy set; missing CSP, HSTS |
| TLS/SSL | FAIL | Not configured |
| Rate limiting | FAIL | No nginx-level rate limiting |
| Request size limit | FAIL | No `client_max_body_size` |
| gzip | PASS | Enabled with proper types |

### Health Checks

| Endpoint | Status | Details |
|----------|--------|---------|
| `/api/health` | PASS | Checks DB, Redis, observability |
| `/api/health/live` | EXISTS | Basic liveness probe |
| `/api/health/ready` | EXISTS | Readiness probe |
| `/api/health/startup` | EXISTS | Startup probe |

### Monitoring

| Tool | Status | Details |
|------|--------|---------|
| Sentry | CONFIGURED | Error tracking and source maps |
| Prometheus | CONFIGURED | Metrics collection (optional profile) |
| Grafana | CONFIGURED | Dashboard visualization (optional) |
| Datadog | CONFIGURED | APM, distributed tracing (optional) |
| Structured logging | PASS | `lib/monitoring/structured-logger` |
| Audit logging | PASS | `audit_logs` table for all actions |

### Deployment Scripts

| Script | Status | Details |
|--------|--------|---------|
| `scripts/docker/deploy.sh` | EXISTS | Deployment automation |
| `scripts/docker/health-check.sh` | EXISTS | Health verification |
| `scripts/docker/validate.sh` | EXISTS | Pre-deploy validation |

---

## 4. Prioritized Remediation Plan

### P0 -- Immediate (Week 1)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Remove `new Function()` from dynamic-permissions.ts** -- Replace with safe expression evaluator (`expr-eval` or `jsep`) | Eliminates CRIT-01 | 4h |
| 2 | **Remove `eval()` from batching.ts** -- Use a Map of predefined grouper functions | Eliminates CRIT-02 | 2h |
| 3 | **Remove `eval()` from ml-pipeline.ts** -- Use `mathjs` or safe math parser | Eliminates CRIT-03 | 2h |
| 4 | **Run `npm audit fix`** -- Fix non-breaking dependency vulnerabilities | Reduces CRIT-04 | 1h |
| 5 | **Increase lockout duration to 15 minutes** -- Change `LOCKOUT_DURATION_MINUTES` to 15 | Fixes HIGH-01 | 5m |
| 6 | **Fix SQL injection in LGPD modules** -- Use parameterized queries | Fixes HIGH-02, HIGH-07 | 1h |

### P1 -- Short-term (Week 2-3)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 7 | **Fix CSP to remove unsafe-eval/unsafe-inline in production** | Fixes HIGH-03 | 4h |
| 8 | **Update Quill to patched version** | Fixes HIGH-04 | 2h |
| 9 | **Add refresh token generation to login route** | Fixes HIGH-06 | 2h |
| 10 | **Configure Nginx TLS** -- Add SSL certificate, HTTPS redirect | Fixes HIGH-05 | 4h |
| 11 | **Fix row-level security SQL injection** -- Whitelist condition patterns | Fixes HIGH-08 | 4h |
| 12 | **Add magic byte validation to file uploads** | Fixes MED-09 | 4h |
| 13 | **Resolve duplicate CSP header issue** -- Remove CSP from either headers.ts or helmet.ts | Fixes MED-07 | 1h |

### P2 -- Medium-term (Week 4-6)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 14 | Implement virus scanning for file uploads (ClamAV) | Fixes MED-10 | 8h |
| 15 | Add nginx-level rate limiting | Defense-in-depth | 2h |
| 16 | Add `client_max_body_size` to Nginx | Fixes MED-02 | 5m |
| 17 | Sanitize Content-Disposition filename | Fixes LOW-05 | 1h |
| 18 | Add RBAC enforcement to API routes | Fixes MED-01 | 16h |
| 19 | Implement forgot-password flow | Fixes MED-08 | 8h |
| 20 | Fix request-guard async/sync mismatch | Fixes MED-11 | 1h |

### P3 -- Long-term

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 21 | Consider RS256 for JWT | Better multi-service auth | 8h |
| 22 | Add Dockerfile to repo | Enables build security audit | 4h |
| 23 | Implement CSP nonces for inline scripts | Strict CSP | 16h |
| 24 | Add security scanning to CI/CD pipeline | Automated vuln detection | 8h |
| 25 | Add `npm ci --ignore-scripts` to build | Supply chain security | 1h |

---

## 5. Quick Security Fixes

These can be applied immediately with minimal risk:

### Fix 1: Increase Lockout Duration
```
File: app/api/auth/login/route.ts:303-304
Change: LOCKOUT_DURATION_MINUTES = 1
To:     LOCKOUT_DURATION_MINUTES = 15
```

### Fix 2: Add client_max_body_size to Nginx
```
File: nginx/conf.d/default.conf
Add to server block:
  client_max_body_size 10M;
```

### Fix 3: Remove BYPASS_RATE_LIMIT from Production
```
Ensure .env.production has:
  BYPASS_RATE_LIMIT=false
And add validation in redis-limiter.ts to prevent bypass in production:
  if (process.env.BYPASS_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'production') {
    throw new Error('Cannot bypass rate limit in production');
  }
```

### Fix 4: Fix Dev Redis Password
```
File: docker-compose.dev.yml:38
Change: redis-server --appendonly yes
To:     redis-server --appendonly yes --requirepass devpassword
```

### Fix 5: Sanitize Content-Disposition Filename
```
File: app/api/files/[...path]/route.ts:174
Change: `inline; filename="${fileRecord.original_name || ...}"`
To:     `inline; filename="${(fileRecord.original_name || ...).replace(/["\n\r]/g, '_')}"`
```

---

## 6. Positive Security Aspects

The project has many security features already implemented correctly:

1. **JWT with short-lived access tokens (15min)** with proper issuer/audience validation
2. **Refresh token rotation** with database storage and revocation support
3. **CSRF protection** with session-bound HMAC tokens and timing-safe comparison
4. **Multi-tenant isolation** enforced at middleware, context, and query levels
5. **Rate limiting** on all sensitive endpoints (auth, AI, mutations)
6. **Security headers** (CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.)
7. **Input sanitization** via `stripHTML()` and Zod schemas
8. **File upload security**: MIME type validation, secure filename generation, path traversal protection
9. **Audit logging** for authentication and critical actions
10. **Docker security**: Non-root user, read-only fs, dropped capabilities, resource limits
11. **Password policy**: 12+ chars, complexity requirements
12. **Account lockout** mechanism (though duration needs increasing)
13. **Device fingerprinting** for token binding
14. **Structured error handling** that avoids leaking internal details in responses

---

## Appendix: Files Reviewed

| Category | Files |
|----------|-------|
| Auth | `lib/auth/auth-service.ts`, `token-manager.ts`, `rbac.ts`, `rbac-engine.ts`, `context.ts`, `dynamic-permissions.ts`, `index.ts` |
| Middleware | `middleware.ts` |
| Security | `lib/security/csrf.ts`, `headers.ts`, `helmet.ts`, `sanitize.ts`, `input-sanitization.ts` |
| Rate Limiting | `lib/rate-limit/redis-limiter.ts` |
| Tenant | `lib/tenant/context.ts`, `request-guard.ts`, `resolver.ts` |
| API Routes | `auth/login/route.ts`, `auth/register/route.ts`, `files/upload/route.ts`, `files/[...path]/route.ts`, `attachments/route.ts`, `health/route.ts` |
| File Upload | `lib/utils/file-upload.ts` |
| LGPD | `lib/lgpd/data-portability.ts`, `consent-manager.ts` |
| Injection Targets | `lib/notifications/batching.ts`, `lib/analytics/ml-pipeline.ts` |
| Docker | `docker-compose.yml`, `docker-compose.dev.yml` |
| Nginx | `nginx/nginx.conf`, `nginx/conf.d/default.conf` |
| Environment | `.env.example` |
| Dependencies | `package.json` (via `npm audit`) |

---

*End of Security & DevOps Review Report*
