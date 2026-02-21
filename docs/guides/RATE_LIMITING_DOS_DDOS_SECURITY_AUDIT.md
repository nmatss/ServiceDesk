# Rate Limiting & DoS/DDoS Protection Security Audit

**ServiceDesk Application Security Assessment**
**Date**: 2025-12-26
**Auditor**: Claude Code Security Analyzer
**Scope**: Rate Limiting, DoS/DDoS Protection, Application Layer Security

---

## Executive Summary

### Overall Security Posture: ⚠️ **MODERATE RISK**

The ServiceDesk application implements **three different rate limiting systems** with varying levels of effectiveness, creating a fragmented protection landscape. While some endpoints have robust protection, **critical vulnerabilities exist** due to:

1. **Inconsistent Rate Limiting** - Only ~16 out of 120+ API routes protected
2. **Memory-Based Storage Vulnerability** - Default in-memory rate limiting fails in cluster/multi-server environments
3. **Missing DoS Protection** - No global request size limits, query timeouts, or connection limits
4. **IP Spoofing Susceptibility** - Naive IP extraction from X-Forwarded-For header
5. **Resource Exhaustion Risks** - Complex database queries without timeouts or pagination limits

### Risk Level Distribution
- **CRITICAL** (Immediate Action Required): 4 findings
- **HIGH** (Urgent - Fix within 7 days): 6 findings
- **MEDIUM** (Important - Fix within 30 days): 8 findings
- **LOW** (Enhancement - Backlog): 3 findings

---

## 1. Rate Limiting Implementation Analysis

### 1.1 Three Conflicting Rate Limiting Systems Found

#### System 1: `/lib/api/rate-limit.ts` (Enterprise-Grade - **NOT USED**)
```typescript
// Location: /home/nic20/ProjetosWeb/ServiceDesk/lib/api/rate-limit.ts
// Status: IMPLEMENTED BUT NOT INTEGRATED IN MIDDLEWARE

Features:
✅ Redis + LRU Cache support (production/dev switch)
✅ Multiple algorithms (Fixed Window, Sliding Window, Token Bucket, Leaky Bucket)
✅ Proper rate limit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
✅ User ID + IP based keying
✅ Fail-open on errors (graceful degradation)
❌ NOT called from middleware.ts - only used in some API routes manually
```

**Configuration** (`lib/api/rate-limit.ts:141-197`):
```typescript
export const rateLimitStrategies = {
  api: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 req/15min - TOO PERMISSIVE
  auth: { windowMs: 15 * 60 * 1000, max: 10 },  // 10 req/15min - GOOD
  passwordReset: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 req/1hour - GOOD
  upload: { windowMs: 60 * 60 * 1000, max: 50 }, // 50 uploads/hour - GOOD
  search: { windowMs: 60 * 1000, max: 30 }, // 30 req/min - GOOD
  webhook: { windowMs: 60 * 1000, max: 100 }, // 100 req/min - REASONABLE
  admin: { windowMs: 5 * 60 * 1000, max: 100 }, // 100 req/5min - GOOD
  public: { windowMs: 15 * 60 * 1000, max: 50 }, // 50 req/15min - GOOD
}
```

#### System 2: `/lib/rate-limit/index.ts` (SQLite-Based - PARTIALLY USED)
```typescript
// Location: /home/nic20/ProjetosWeb/ServiceDesk/lib/rate-limit/index.ts
// Status: USED IN 16 API ROUTES ONLY

Features:
✅ SQLite database storage (persistent across server restarts)
✅ Automatic cleanup of expired entries
❌ NOT scalable to multiple servers (SQLite file lock)
❌ Performance overhead (disk I/O for every request)
❌ Manual application required in each route
```

**Configuration** (`lib/rate-limit/index.ts:21-72`):
```typescript
export const rateLimitConfigs = {
  api: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // GOOD
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // GOOD
  'auth-strict': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // GOOD
  upload: { windowMs: 5 * 60 * 1000, maxRequests: 10 }, // TOO RESTRICTIVE for multi-file
  search: { windowMs: 1 * 60 * 1000, maxRequests: 30 }, // GOOD
  'password-reset': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // GOOD
  'embedding-generation': { windowMs: 5 * 60 * 1000, maxRequests: 20 }, // GOOD
  'semantic-search': { windowMs: 1 * 60 * 1000, maxRequests: 50 }, // GOOD
  'search-suggest': { windowMs: 1 * 60 * 1000, maxRequests: 60 }, // GOOD
}
```

#### System 3: `/src/lib/rate-limit.ts` (Simple LRU - LEGACY)
```typescript
// Location: /home/nic20/ProjetosWeb/ServiceDesk/src/lib/rate-limit.ts
// Status: LEGACY CODE - SHOULD BE REMOVED

Features:
❌ Simple LRU cache only (no Redis support)
❌ No rate limit headers
❌ 500 token limit (too low for production)
❌ No sliding window support
⚠️  Still imported in some legacy code
```

### 1.2 Endpoint Protection Coverage

**Protected Endpoints** (16 total):
```
✅ /api/auth/login - SQLite rate limit (5 req/15min)
✅ /api/auth/register - SQLite rate limit (5 req/15min)
✅ /api/auth/refresh - SQLite rate limit (10 req/5min)
✅ /api/auth/verify - SQLite rate limit
✅ /api/tickets/create - SQLite rate limit (100 req/15min)
✅ /api/admin/users - SQLite rate limit (100 req/15min)
✅ /api/embeddings/generate - SQLite rate limit (20 req/5min)
✅ /api/search/semantic - SQLite rate limit (50 req/min)
✅ /api/search/suggest - SQLite rate limit (60 req/min)
✅ /api/ai/classify-ticket - SQLite rate limit
✅ /api/ai/train - SQLite rate limit
✅ /api/ai/detect-duplicates - SQLite rate limit
✅ /api/ai/generate-response - SQLite rate limit
✅ /api/ai/suggest-solutions - SQLite rate limit
✅ /api/ai/analyze-sentiment - SQLite rate limit
✅ /api/ai/feedback - SQLite rate limit
```

**UNPROTECTED Critical Endpoints** (104+ total):
```
❌ /api/tickets - NO RATE LIMIT (can create thousands of tickets)
❌ /api/tickets/[id] - NO RATE LIMIT
❌ /api/tickets/[id]/comments - NO RATE LIMIT (comment spam)
❌ /api/tickets/[id]/attachments - NO RATE LIMIT (upload DoS)
❌ /api/tickets/[id]/activities - NO RATE LIMIT
❌ /api/problems - NO RATE LIMIT
❌ /api/problems/[id] - NO RATE LIMIT
❌ /api/knowledge/search - NO RATE LIMIT (expensive queries)
❌ /api/knowledge/articles - NO RATE LIMIT
❌ /api/knowledge/[id]/feedback - NO RATE LIMIT (vote manipulation)
❌ /api/analytics/* - NO RATE LIMIT (expensive aggregations)
❌ /api/dashboard/* - NO RATE LIMIT (complex queries)
❌ /api/admin/tickets - NO RATE LIMIT
❌ /api/admin/reports - NO RATE LIMIT (resource intensive)
❌ /api/cmdb/* - NO RATE LIMIT
❌ /api/notifications - NO RATE LIMIT
❌ /api/workflows/execute - NO RATE LIMIT (workflow bombs)
❌ /api/email/send - NO RATE LIMIT (email flooding)
❌ /api/integrations/whatsapp/* - NO RATE LIMIT
❌ /api/integrations/email/* - NO RATE LIMIT
```

### 1.3 Rate Limit Storage Analysis

#### Current Implementation Issues

**Default Storage: In-Memory LRU Cache** (`lib/api/rate-limit.ts:28-66`)
```typescript
class MemoryRateLimitStore implements RateLimitStore {
  private cache = new LRUCache<string, RateLimitRecord>({
    max: 10000, // ⚠️ Only 10,000 entries max
    ttl: 1000 * 60 * 60, // 1 hour
  })
  // ...
}

const defaultStore = new MemoryRateLimitStore() // ❌ SINGLETON
```

**CRITICAL VULNERABILITY: Multi-Server/Cluster Bypass**
```
Scenario:
1. Attacker sends 100 requests to Server A → Rate limited after 10
2. Attacker sends 100 requests to Server B → Rate limited after 10
3. Attacker sends 100 requests to Server C → Rate limited after 10
4. Total: 30 successful requests instead of 10 (3x rate limit bypass)

Impact: Load balancer + horizontal scaling = COMPLETE RATE LIMIT BYPASS
```

**Redis Implementation Exists But NOT Configured** (`lib/api/rate-limit.ts:375-387`):
```typescript
export function configureRateLimitStore(redisClient?: any): void {
  if (redisClient && process.env.NODE_ENV === 'production') {
    // ❌ NEVER CALLED - Redis store is never initialized
    const redisStore = new RedisRateLimitStore(redisClient)
    // ...
  }
}
```

---

## 2. DoS/DDoS Attack Vectors

### 2.1 CRITICAL: File Upload DoS (CVE-Severity: HIGH)

**Vulnerability**: `/api/tickets/[id]/attachments`
- **Location**: `/home/nic20/ProjetosWeb/ServiceDesk/app/api/tickets/[id]/attachments/route.ts:92-96`

```typescript
// ❌ VULNERABILITY: Per-file limit but NO total user storage limit
const maxSize = 10 * 1024 * 1024; // 10MB per file
if (file.size > maxSize) {
  return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB' }, { status: 400 });
}
```

**Attack Vector**:
```
1. Attacker creates 1000 tickets
2. Uploads 10MB attachment to each ticket
3. Total storage used: 10GB (10MB × 1000)
4. Repeat with different user accounts
5. Server runs out of disk space → SERVICE DOWN
```

**Missing Protections**:
- ❌ No total storage quota per user
- ❌ No total storage quota per organization
- ❌ No rate limiting on upload endpoint
- ❌ Files stored locally (no cleanup policy)
- ❌ No virus/malware scanning

### 2.2 CRITICAL: Database Query DoS

**Vulnerability**: Complex queries without timeouts

**Example 1**: `/api/knowledge/search` (Line 51-76)
```typescript
// ❌ NO LIMIT, NO TIMEOUT
const articleRows = db.prepare(`
  SELECT
    a.id, a.title, a.slug, a.summary, a.content,
    a.search_keywords, a.view_count, a.helpful_votes,
    a.not_helpful_votes, a.category_id, a.author_id,
    a.created_at, a.updated_at,
    c.name as category_name, c.slug as category_slug,
    c.color as category_color,
    GROUP_CONCAT(DISTINCT t.name) as tags
  FROM kb_articles a
  LEFT JOIN kb_categories c ON a.category_id = c.id
  LEFT JOIN kb_article_tags at ON a.id = at.article_id
  LEFT JOIN kb_tags t ON at.tag_id = t.id
  ${whereClause}
  GROUP BY a.id  -- ❌ EXPENSIVE OPERATION
`).all(...params)  -- ❌ Returns ALL rows, no LIMIT
```

**Attack Vector**:
```
1. Send search query with no filters
2. Database performs full table scan + GROUP BY on all articles
3. If 100,000 articles exist → 100,000 rows processed
4. Repeat 100x simultaneously → Database CPU 100% → TIMEOUT
```

**Example 2**: `/api/analytics/detailed` (19 JOINs found)
```typescript
// Multiple endpoints with complex analytics queries
// No query timeout configured
// No result set size limits
```

**Database Configuration Issues** (`lib/db/connection.ts`):
```typescript
// ✅ Good: WAL mode, 64MB cache, mmap
// ❌ Missing: Query timeout, connection pool limits
legacyDb.pragma('busy_timeout = 5000'); // Only 5 seconds - NOT query timeout
```

**Missing Protections**:
- ❌ No `LIMIT` clause in most queries
- ❌ No query execution timeout (SQLite `busy_timeout` ≠ query timeout)
- ❌ No query complexity analysis
- ❌ No slow query logging
- ❌ No query result size limits

### 2.3 HIGH: JSON Parsing Bomb

**Vulnerability**: No request body size limit globally

**Finding**: 193 `JSON.parse()` / `request.json()` calls across 125 files
- No `Content-Length` validation before parsing
- Next.js default limit: **1MB** (reasonable but not explicitly enforced)

**Attack Vector**:
```json
POST /api/tickets/create
Content-Type: application/json
Content-Length: 50000000

{
  "title": "a",
  "description": "{"a": "{"a": "{"a": ... [50MB nested JSON] }}}}}",
  "category_id": 1
}
```

**Impact**:
- Memory exhaustion (JSON parser loads entire payload)
- CPU spike (parsing nested structures)
- Service unavailable

**Current Protection**: ⚠️ **IMPLICIT ONLY**
- Next.js has default 1MB body limit
- Not explicitly configured or documented
- No custom error message for oversized payloads

### 2.4 HIGH: ReDoS (Regular Expression Denial of Service)

**Vulnerability**: Validation regex without complexity limits

**Example 1**: Password validation (`lib/validation/schemas.ts:17-21`)
```typescript
password: z.string()
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, '...special character')
  // ✅ SAFE: Simple character class matching, no backtracking
```

**Example 2**: Slug validation (`lib/validation/schemas.ts:14`)
```typescript
slug: z.string().regex(/^[a-z0-9-]+$/)
// ✅ SAFE: No catastrophic backtracking
```

**Example 3**: Email validation
```typescript
email: z.string().email().max(254)
// ✅ SAFE: Zod's built-in email validation (tested against ReDoS)
```

**Finding**: ✅ **NO REDOS VULNERABILITIES FOUND**
- All regex patterns are simple character classes
- No nested quantifiers (e.g., `(a+)+`)
- Max length constraints prevent exponential backtracking

### 2.5 MEDIUM: Slowloris / Connection Exhaustion

**Vulnerability**: No explicit connection limits

**Server Configuration** (`server.ts:28-57`):
```typescript
const server = createServer(async (req, res) => {
  // ❌ No connection limit
  // ❌ No request timeout
  // ❌ No keepAlive timeout configuration
  compress(req, res, async () => {
    const parsedUrl = parse(req.url!, true)
    await handle(req, res, parsedUrl)
  })
})
```

**Socket.io Configuration** (`server.ts:60-70`):
```typescript
const io = new SocketIOServer(server, {
  pingTimeout: 60000,    // ✅ Good
  pingInterval: 25000,   // ✅ Good
  // ❌ No maxHttpBufferSize limit (default: 1MB)
  // ❌ No connectionStateRecovery timeout
})
```

**Attack Vector**:
```
1. Open 10,000 HTTP connections to server
2. Send partial HTTP headers (slowloris attack)
3. Keep connections alive without completing requests
4. Server runs out of file descriptors → NEW CONNECTIONS FAIL
```

**Missing Protections**:
- ❌ No `server.maxConnections` configured
- ❌ No `server.timeout` configured
- ❌ No `server.keepAliveTimeout` configured
- ❌ No connection-per-IP limit
- ⚠️ Relies on reverse proxy (nginx/cloudflare) for protection

### 2.6 MEDIUM: Database Connection Pool Exhaustion

**Current Setup** (`lib/db/connection.ts`):
```typescript
// ❌ LEGACY: Direct SQLite connection (single-threaded)
const legacyDb = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// ✅ Connection pool exists but NOT used in most code
export async function getPooledConnection<T>(
  operation: (db: Database.Database) => T | Promise<T>
): Promise<T> {
  return pool.execute(operation);
}
```

**Finding**:
- Most code uses direct `db` import → **NO CONNECTION POOLING**
- SQLite WAL mode allows concurrent reads but **single writer**
- Busy timeout: 5 seconds (can cause request timeouts)

**Attack Vector**:
```
1. Send 1000 concurrent write requests (POST /api/tickets/create)
2. SQLite locks database for first write
3. Other 999 requests wait up to 5 seconds each
4. Requests timeout → Error responses
5. Repeat → Service degradation
```

---

## 3. IP Spoofing & Bypass Vulnerabilities

### 3.1 CRITICAL: Naive IP Extraction

**Vulnerability**: Trusts `X-Forwarded-For` header without validation

**Location**: Multiple files (`lib/api/rate-limit.ts:227-229`, `lib/rate-limit/index.ts:103-106`)

```typescript
// ❌ CRITICAL VULNERABILITY
private defaultKeyGenerator(req: NextRequest, context?: ApiContext): string {
  if (context?.user?.id) {
    return `user:${context.user.id}`
  }

  // ❌ TRUSTS X-Forwarded-For WITHOUT VALIDATION
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'

  return `ip:${ip}`
}
```

**Attack Vector**:
```http
POST /api/auth/login HTTP/1.1
Host: servicedesk.com
X-Forwarded-For: 1.2.3.4
Content-Type: application/json

{"email": "victim@example.com", "password": "guessed_password_1"}
```

```http
POST /api/auth/login HTTP/1.1
Host: servicedesk.com
X-Forwarded-For: 5.6.7.8  ← Different IP
Content-Type: application/json

{"email": "victim@example.com", "password": "guessed_password_2"}
```

**Impact**:
- Attacker can bypass rate limiting by rotating `X-Forwarded-For` header
- Brute force attacks remain effective
- Account lockout mechanisms bypassed

**Proper Implementation** (MISSING):
```typescript
function getTrustedClientIP(req: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === 'true'
  const trustedProxies = process.env.TRUSTED_PROXIES?.split(',') || []

  if (!trustProxy) {
    // Direct connection - use socket IP (NOT available in Next.js Edge)
    return 'connection-ip' // Would need custom server
  }

  const forwarded = req.headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'

  const ips = forwarded.split(',').map(ip => ip.trim())

  // Remove trusted proxies from the right
  let clientIP = ips[0]
  for (let i = ips.length - 1; i >= 0; i--) {
    if (trustedProxies.includes(ips[i])) {
      continue
    }
    clientIP = ips[i]
    break
  }

  return clientIP
}
```

### 3.2 MEDIUM: No Fingerprinting Beyond IP

**Current Implementation**:
```typescript
const hash = Buffer.from(`${ip}-${userAgent}-${endpoint}`).toString('base64')
return `rate_limit:${hash}`
```

**Issues**:
- User-Agent can be randomized easily
- No device fingerprinting
- No session-based tracking

**Recommended Enhancement**:
```typescript
// Add additional signals
const fingerprint = {
  ip: getTrustedClientIP(req),
  userAgent: req.headers.get('user-agent'),
  acceptLanguage: req.headers.get('accept-language'),
  acceptEncoding: req.headers.get('accept-encoding'),
  // For authenticated users
  userId: context?.user?.id,
  sessionId: req.cookies.get('session_id')?.value
}

const hash = createHash('sha256')
  .update(JSON.stringify(fingerprint))
  .digest('hex')
```

---

## 4. Application Layer DDoS Protection

### 4.1 Resource Exhaustion Vectors

#### A. CPU Exhaustion
**Vulnerable Endpoints**:
1. `/api/knowledge/search` - Full-text search + GROUP BY
2. `/api/ai/*` - AI/ML inference (compute-intensive)
3. `/api/analytics/*` - Complex aggregations
4. `/api/dashboard/*` - Multiple JOINs

**Missing Protections**:
- ❌ No CPU time limit per request
- ❌ No request queue depth limit
- ❌ No circuit breaker pattern
- ❌ No request shedding under load

#### B. Memory Exhaustion
**Vulnerable Endpoints**:
1. `/api/tickets` - Can return all tickets (no default LIMIT)
2. `/api/knowledge/articles` - Full article content in response
3. `/api/admin/reports` - Large result sets

**Missing Protections**:
- ❌ No max result set size
- ❌ No streaming responses for large datasets
- ❌ No memory usage monitoring

#### C. Disk I/O Exhaustion
**Vulnerable Areas**:
1. File uploads (`/api/tickets/[id]/attachments`)
2. SQLite database writes (single writer bottleneck)
3. Log file writes (no rotation visible)

### 4.2 Compression Bomb

**Configuration** (`server.ts:30-41`):
```typescript
const compress = compression({
  threshold: 1024, // ✅ Good: Only compress > 1KB
  level: 6,        // ✅ Good: Balanced compression
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  },
})
```

**Finding**: ✅ **NO COMPRESSION BOMB VULNERABILITY**
- Server compresses RESPONSES, not REQUEST bodies
- No decompression of client data

---

## 5. Detailed Vulnerability Findings

### CRITICAL Vulnerabilities (Fix Immediately)

#### [CRIT-1] Multi-Server Rate Limit Bypass
**Risk**: Complete rate limit bypass in production clusters
**Location**: `lib/api/rate-limit.ts:200`
**Impact**: Attackers can bypass rate limits by distributing requests across load-balanced servers

**Evidence**:
```typescript
const defaultStore = new MemoryRateLimitStore() // In-memory = per-process
```

**Exploitation**:
```bash
# Attacker script
for i in {1..1000}; do
  curl -H "Host: server-$((i % 10)).servicedesk.com" \
       -X POST https://servicedesk.com/api/auth/login \
       -d '{"email":"victim@example.com","password":"guess_'$i'"}'
done
# 10 servers × 10 attempts each = 100 login attempts bypassing 10 req/15min limit
```

**Remediation**:
```typescript
// 1. Configure Redis in production
import { createClient } from 'redis'

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
})

await redis.connect()

// 2. Initialize rate limiter with Redis
configureRateLimitStore(redis)

// 3. Update deployment
// - Add Redis to docker-compose.yml / Kubernetes
// - Set REDIS_URL environment variable
// - Implement health checks
```

#### [CRIT-2] File Upload Storage DoS
**Risk**: Unlimited file upload leading to disk exhaustion
**Location**: `/app/api/tickets/[id]/attachments/route.ts:92-96`
**Impact**: Service outage, data loss

**Remediation**:
```typescript
// 1. Add user storage quota
const getUserStorageUsed = (userId: number, orgId: number): number => {
  const result = db.prepare(`
    SELECT SUM(size) as total
    FROM attachments
    WHERE uploaded_by = ? AND organization_id = ?
  `).get(userId, orgId) as { total: number }

  return result.total || 0
}

// 2. Enforce quota
const MAX_USER_STORAGE = 1024 * 1024 * 1024 // 1GB per user
const currentUsage = getUserStorageUsed(user.id, tenant.id)

if (currentUsage + file.size > MAX_USER_STORAGE) {
  return NextResponse.json({
    error: 'Storage quota exceeded',
    quota: MAX_USER_STORAGE,
    used: currentUsage,
    available: MAX_USER_STORAGE - currentUsage
  }, { status: 413 })
}

// 3. Add rate limiting
const uploadRateLimit = createRateLimitMiddleware('upload') // 10 uploads/5min
const rateLimitResult = await uploadRateLimit(request, '/api/tickets/attachments')
if (rateLimitResult instanceof Response) return rateLimitResult
```

#### [CRIT-3] IP Spoofing in Rate Limiting
**Risk**: Rate limit bypass via header injection
**Location**: `lib/api/rate-limit.ts:227-229`, `lib/rate-limit/index.ts:103-106`
**Impact**: Brute force attacks, credential stuffing

**Remediation**:
```typescript
// lib/security/ip-detection.ts
export function getTrustedClientIP(req: NextRequest): string {
  // 1. Check if behind proxy
  const trustProxy = process.env.TRUST_PROXY === 'true'
  if (!trustProxy) {
    // Not behind proxy - would use connection IP (not available in Edge Runtime)
    // For Next.js Edge: require X-Forwarded-For but validate
    const forwarded = req.headers.get('x-forwarded-for')
    if (!forwarded) return 'direct-connection'
    return forwarded.split(',')[0].trim()
  }

  // 2. Parse X-Forwarded-For with trust validation
  const forwarded = req.headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'

  const ips = forwarded.split(',').map(ip => ip.trim())

  // 3. Validate against trusted proxies (from env)
  const trustedProxies = (process.env.TRUSTED_PROXIES || '').split(',')

  // 4. Get leftmost non-trusted IP
  for (const ip of ips) {
    if (!trustedProxies.includes(ip)) {
      // Validate IP format
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ||
          /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)) {
        return ip
      }
    }
  }

  return 'unknown'
}

// Update rate limiter
function defaultKeyGenerator(req: NextRequest, context?: ApiContext): string {
  if (context?.user?.id) {
    return `user:${context.user.id}`
  }

  const ip = getTrustedClientIP(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const fingerprint = `${ip}:${userAgent.slice(0, 100)}`

  return `ip:${createHash('sha256').update(fingerprint).digest('hex')}`
}
```

**Environment Configuration**:
```bash
# .env
TRUST_PROXY=true
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,cloudflare-ranges
```

#### [CRIT-4] Missing Rate Limiting on 104 Critical Endpoints
**Risk**: Unlimited API access, resource exhaustion
**Impact**: Service degradation, increased infrastructure costs

**Remediation Strategy**:

**Phase 1: Global Middleware Rate Limiting** (Immediate)
```typescript
// middleware.ts - Add global rate limiting
import { RateLimiter, rateLimitStrategies } from './lib/api/rate-limit'

// Create global rate limiter
const globalRateLimiter = new RateLimiter({
  ...rateLimitStrategies.api,
  max: 100, // 100 req/15min for authenticated users
  keyGenerator: (req, context) => {
    // Use user ID if authenticated
    if (context?.user?.id) {
      return `global:user:${context.user.id}`
    }
    // Use IP for unauthenticated
    return `global:ip:${getTrustedClientIP(req)}`
  }
})

export async function middleware(request: NextRequest) {
  // ... existing tenant resolution ...

  // Apply global rate limiting AFTER tenant resolution
  if (requiresAuth(pathname)) {
    const rateLimitResult = await globalRateLimiter.middleware(request, {
      user: authResult.user,
      tenant: tenant,
      requestId: crypto.randomUUID()
    })

    if (rateLimitResult) {
      return rateLimitResult // 429 response
    }
  }

  // ... rest of middleware ...
}
```

**Phase 2: Endpoint-Specific Rate Limits** (Week 1-2)
```typescript
// Apply stricter limits to expensive operations
// app/api/tickets/[id]/comments/route.ts
const commentRateLimit = createRateLimiter('api', {
  max: 10, // 10 comments/15min per user
  windowMs: 15 * 60 * 1000
})

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  const rateLimitResult = await commentRateLimit.middleware(request, { user })
  if (rateLimitResult) return rateLimitResult

  // ... existing comment creation logic ...
}
```

### HIGH Priority Vulnerabilities (Fix within 7 days)

#### [HIGH-1] Database Query DoS via Unbounded Results
**Risk**: Database CPU exhaustion, memory overflow
**Location**: Multiple endpoints (78+ files with SELECT...JOIN)

**Remediation**:
```typescript
// 1. Add default LIMIT to all queries
// lib/db/safe-queries.ts
export const DEFAULT_MAX_RESULTS = 1000
export const DEFAULT_PAGE_SIZE = 25

export function addDefaultLimit(sql: string, limit?: number): string {
  if (!/LIMIT\s+\d+/i.test(sql)) {
    return sql + ` LIMIT ${limit || DEFAULT_MAX_RESULTS}`
  }
  return sql
}

// 2. Implement query timeout (requires better-sqlite3 update)
// lib/db/connection.ts
export function executeWithTimeout<T>(
  query: () => T,
  timeoutMs: number = 5000
): T {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    try {
      const result = query()
      clearTimeout(timer)
      resolve(result)
    } catch (error) {
      clearTimeout(timer)
      reject(error)
    }
  })
}

// 3. Update knowledge search endpoint
// app/api/knowledge/search/route.ts
const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // MAX 100
const offset = parseInt(searchParams.get('offset') || '0')

const articleRows = await executeWithTimeout(() =>
  db.prepare(`
    SELECT ... FROM kb_articles a
    LEFT JOIN ...
    WHERE ...
    GROUP BY a.id
    LIMIT ? OFFSET ?  -- ✅ REQUIRED
  `).all(limit, offset),
  5000 // 5 second timeout
)
```

#### [HIGH-2] Missing Request Body Size Limits
**Risk**: Memory exhaustion via large JSON payloads

**Remediation**:
```typescript
// next.config.js
const nextConfig = {
  // Add explicit body size limits
  api: {
    bodyParser: {
      sizeLimit: '1mb', // Default
    },
  },

  // For file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Match upload limit
    },
  },
}

// Middleware validation
export async function middleware(request: NextRequest) {
  // Check Content-Length before parsing
  const contentLength = request.headers.get('content-length')
  const MAX_BODY_SIZE = 1024 * 1024 // 1MB

  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return NextResponse.json({
      error: 'Request body too large',
      maxSize: '1MB',
      received: `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`
    }, { status: 413 })
  }

  // ... rest of middleware ...
}
```

#### [HIGH-3] No Connection Limits (Slowloris Vulnerability)
**Risk**: Connection exhaustion, service unavailability

**Remediation**:
```typescript
// server.ts
import { createServer } from 'http'

const server = createServer(async (req, res) => {
  // ... existing code ...
})

// Configure connection limits
server.maxConnections = 1000 // Max concurrent connections
server.timeout = 30000 // 30 second request timeout
server.keepAliveTimeout = 5000 // 5 second keepalive
server.headersTimeout = 10000 // 10 second header timeout

// Monitor connections
let currentConnections = 0
server.on('connection', (socket) => {
  currentConnections++
  console.log(`Connections: ${currentConnections}/${server.maxConnections}`)

  socket.on('close', () => {
    currentConnections--
  })

  // Limit connections per IP
  const clientIP = socket.remoteAddress
  const connectionsFromIP = getConnectionCountByIP(clientIP)

  if (connectionsFromIP > 10) {
    console.warn(`Too many connections from ${clientIP}: ${connectionsFromIP}`)
    socket.destroy()
  }
})
```

#### [HIGH-4] Email/WhatsApp API No Rate Limiting
**Risk**: Email bombing, SMS flooding, external service quota exhaustion

**Remediation**:
```typescript
// app/api/email/send/route.ts
const emailRateLimit = createRateLimiter('api', {
  max: 10, // 10 emails per 15 minutes
  windowMs: 15 * 60 * 1000,
  message: 'Too many emails sent. Please try again later.'
})

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)

  // Apply user-based rate limiting
  const rateLimitResult = await emailRateLimit.middleware(request, { user })
  if (rateLimitResult) return rateLimitResult

  // Apply per-recipient rate limiting (prevent targeted spam)
  const body = await request.json()
  const recipientRateLimit = createRateLimiter('api', {
    max: 3, // Max 3 emails to same recipient per hour
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => `email-recipient:${body.to}`
  })

  const recipientLimit = await recipientRateLimit.middleware(request, { user })
  if (recipientLimit) return recipientLimit

  // ... existing email sending logic ...
}

// Similar implementation for WhatsApp API
// app/api/integrations/whatsapp/send/route.ts
const whatsappRateLimit = createRateLimiter('api', {
  max: 20, // 20 messages per hour
  windowMs: 60 * 60 * 1000
})
```

#### [HIGH-5] Workflow Execution DoS
**Risk**: Infinite loops, recursive workflows, workflow bombs

**Remediation**:
```typescript
// lib/workflow/engine.ts
const MAX_WORKFLOW_STEPS = 100
const MAX_WORKFLOW_DURATION_MS = 60000 // 1 minute
const MAX_CONCURRENT_WORKFLOWS = 50

export class WorkflowEngine {
  private activeWorkflows = new Set<string>()

  async executeWorkflow(workflowId: string, context: any): Promise<WorkflowResult> {
    // 1. Check concurrent workflow limit
    if (this.activeWorkflows.size >= MAX_CONCURRENT_WORKFLOWS) {
      throw new Error('Too many workflows executing. Please try again later.')
    }

    const executionId = crypto.randomUUID()
    this.activeWorkflows.add(executionId)

    try {
      // 2. Set execution timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Workflow timeout')), MAX_WORKFLOW_DURATION_MS)
      )

      // 3. Track step count
      let stepCount = 0
      const executeStep = async (step: WorkflowStep) => {
        if (stepCount++ > MAX_WORKFLOW_STEPS) {
          throw new Error('Workflow exceeded maximum steps')
        }
        // ... execute step ...
      }

      // 4. Race between workflow and timeout
      const result = await Promise.race([
        this.executeWorkflowSteps(workflowId, context, executeStep),
        timeoutPromise
      ])

      return result as WorkflowResult
    } finally {
      this.activeWorkflows.delete(executionId)
    }
  }
}
```

#### [HIGH-6] Analytics Query Performance
**Risk**: Expensive aggregations causing database locks

**Remediation**:
```typescript
// 1. Add database indexes for analytics
// lib/db/analytics-indexes.sql
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date
  ON analytics_daily_metrics(date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_agent_date_user
  ON analytics_agent_metrics(date DESC, agent_id);

CREATE INDEX IF NOT EXISTS idx_tickets_created_tenant
  ON tickets(created_at DESC, tenant_id);

// 2. Use materialized views for common aggregations
// lib/db/analytics-summaries.ts (already exists - UTILIZE IT)
export function updateDailySummaries() {
  db.transaction(() => {
    // Pre-compute expensive aggregations
    db.prepare(`
      INSERT OR REPLACE INTO analytics_daily_metrics (date, ...)
      SELECT date('now'), COUNT(*), AVG(...), ...
      FROM tickets
      WHERE created_at >= date('now')
      GROUP BY date(created_at)
    `).run()
  })()
}

// 3. Schedule background updates (cron job)
// Use pre-computed data in API responses
```

### MEDIUM Priority Vulnerabilities (Fix within 30 days)

#### [MED-1] Inconsistent Rate Limiting Implementation
**Risk**: Confusion, maintenance burden, security gaps

**Remediation**: Consolidate to single system
```typescript
// 1. Remove legacy systems
// ❌ DELETE: src/lib/rate-limit.ts (LRU-only implementation)
// ✅ KEEP: lib/api/rate-limit.ts (enterprise-grade)
// ✅ MIGRATE: lib/rate-limit/index.ts → lib/api/rate-limit.ts

// 2. Update all imports
// Before:
import { applyRateLimit } from '@/lib/rate-limit'

// After:
import { createRateLimiter } from '@/lib/api/rate-limit'
```

#### [MED-2] No Circuit Breaker Pattern
**Risk**: Cascading failures from downstream services

**Remediation**:
```typescript
// lib/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED'
        this.failureCount = 0
      }
      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN'
      }

      throw error
    }
  }
}

// Usage in API calls
const dbCircuitBreaker = new CircuitBreaker(5, 60000)

export async function queryWithProtection<T>(query: () => T): Promise<T> {
  return dbCircuitBreaker.execute(async () => query())
}
```

#### [MED-3] No Request Queueing/Shedding
**Risk**: Server overload during traffic spikes

**Remediation**:
```typescript
// lib/queue/request-queue.ts
export class RequestQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = 0
  private maxConcurrent = 100
  private maxQueueSize = 1000

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    // Reject if queue is full (load shedding)
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Server is overloaded. Please try again later.')
    }

    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    this.processing++
    const fn = this.queue.shift()

    if (fn) {
      await fn()
    }

    this.processing--
    this.processQueue()
  }
}

// Apply to expensive operations
const analyticsQueue = new RequestQueue()

export async function POST(request: NextRequest) {
  return analyticsQueue.enqueue(async () => {
    // Expensive analytics calculation
  })
}
```

#### [MED-4] SQLite Single-Writer Bottleneck
**Risk**: Write contention in high-traffic scenarios

**Remediation Options**:
```typescript
// Option A: Read replicas (for reads)
// Option B: Migrate to PostgreSQL (production recommendation)
// Option C: Write batching

// Write batching implementation
class WriteBatcher {
  private batch: Array<{ query: string, params: any[] }> = []
  private batchTimer: NodeJS.Timeout | null = null

  add(query: string, params: any[]) {
    this.batch.push({ query, params })

    // Flush after 100 writes or 100ms
    if (this.batch.length >= 100) {
      this.flush()
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), 100)
    }
  }

  flush() {
    if (this.batch.length === 0) return

    db.transaction(() => {
      for (const { query, params } of this.batch) {
        db.prepare(query).run(...params)
      }
    })()

    this.batch = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }
}
```

#### [MED-5] No Monitoring/Alerting for Rate Limit Events
**Risk**: Attacks go unnoticed

**Remediation**:
```typescript
// lib/monitoring/rate-limit-alerts.ts
export function monitorRateLimitEvents() {
  // Log to structured logger
  const onLimitReached = (req: NextRequest, context: ApiContext, info: RateLimitInfo) => {
    logger.warn('Rate limit exceeded', {
      ip: getTrustedClientIP(req),
      userId: context.user?.id,
      path: req.nextUrl.pathname,
      limit: info.limit,
      remaining: info.remaining,
      resetTime: info.reset
    })

    // Send alert if threshold exceeded
    const key = `rate-limit-alert:${getTrustedClientIP(req)}`
    const alertCount = cache.get(key) || 0

    if (alertCount > 10) {
      // Send notification to security team
      sendSecurityAlert({
        type: 'RATE_LIMIT_ABUSE',
        ip: getTrustedClientIP(req),
        path: req.nextUrl.pathname,
        count: alertCount
      })
    }

    cache.set(key, alertCount + 1, 60 * 60) // 1 hour TTL
  }

  // Update rate limiter config
  const rateLimiter = new RateLimiter({
    ...rateLimitStrategies.auth,
    onLimitReached
  })
}
```

#### [MED-6] WebSocket DoS Protection
**Risk**: WebSocket connection flooding

**Remediation**:
```typescript
// server.ts - Socket.io configuration
const io = new SocketIOServer(server, {
  cors: { /* ... */ },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,

  // ✅ ADD THESE PROTECTIONS
  maxHttpBufferSize: 1e6, // 1MB max message size
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  },

  // Connection rate limiting
  allowRequest: (req, fn) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const key = `ws-connect:${ip}`

    const connectCount = cache.get(key) || 0
    if (connectCount > 10) {
      fn('Too many WebSocket connections', false)
      return
    }

    cache.set(key, connectCount + 1, 60) // 1 minute window
    fn(null, true)
  }
})

// Per-user message rate limiting
io.on('connection', (socket) => {
  const messageRateLimit = new RateLimiter({
    windowMs: 60 * 1000,
    max: 60, // 60 messages per minute
    keyGenerator: () => `ws-msg:${socket.id}`
  })

  socket.onAny(async (event, ...args) => {
    const mockRequest = {
      headers: new Map([['x-socket-id', socket.id]]),
      nextUrl: { pathname: `/ws/${event}` }
    } as any

    const rateLimitResult = await messageRateLimit.middleware(mockRequest, {})
    if (rateLimitResult) {
      socket.emit('error', { message: 'Too many messages' })
      socket.disconnect(true)
    }
  })
})
```

#### [MED-7] No Pagination Enforcement
**Risk**: Large result sets cause performance issues

**Remediation**:
```typescript
// lib/api/pagination.ts
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  MAX_OFFSET: 10000 // Prevent deep pagination
}

export function validatePagination(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || String(PAGINATION_CONFIG.DEFAULT_PAGE_SIZE))

  if (limit > PAGINATION_CONFIG.MAX_PAGE_SIZE) {
    throw new ValidationError(`Maximum page size is ${PAGINATION_CONFIG.MAX_PAGE_SIZE}`)
  }

  const offset = (page - 1) * limit
  if (offset > PAGINATION_CONFIG.MAX_OFFSET) {
    throw new ValidationError(`Maximum offset is ${PAGINATION_CONFIG.MAX_OFFSET}. Use cursor-based pagination.`)
  }

  return { page, limit, offset }
}

// Usage in API routes
export async function GET(request: NextRequest) {
  const { page, limit, offset } = validatePagination(request.nextUrl.searchParams)

  const results = db.prepare(`
    SELECT * FROM tickets
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(tenantId, limit, offset)

  return paginatedResponse(results, page, limit, totalCount)
}
```

#### [MED-8] No Distributed Lock Mechanism
**Risk**: Race conditions in concurrent operations

**Remediation**:
```typescript
// lib/locks/distributed-lock.ts (requires Redis)
import { getRedisClient } from '@/lib/cache/redis-client'

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 10000 // 10 seconds
): Promise<T> {
  const redis = getRedisClient().getClient()
  const lockKey = `lock:${key}`
  const lockValue = crypto.randomUUID()

  // Acquire lock with SET NX EX
  const acquired = await redis.set(lockKey, lockValue, {
    NX: true,
    PX: ttl
  })

  if (!acquired) {
    throw new Error('Could not acquire lock')
  }

  try {
    return await fn()
  } finally {
    // Release lock only if we still own it
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    await redis.eval(luaScript, 1, lockKey, lockValue)
  }
}

// Usage
export async function POST(request: NextRequest) {
  const { ticketId } = await request.json()

  return withLock(`ticket:${ticketId}`, async () => {
    // Critical section - only one request can execute at a time
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId)
    // ... update ticket ...
    return ticket
  })
}
```

### LOW Priority Vulnerabilities (Enhancement)

#### [LOW-1] No GraphQL Query Depth Limiting
**Note**: No GraphQL detected in codebase - Not applicable

#### [LOW-2] Lack of Request Signature Validation
**Risk**: API request tampering (for webhook/integration endpoints)

**Remediation**:
```typescript
// lib/security/hmac-validation.ts
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// app/api/integrations/whatsapp/webhook/route.ts
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-whatsapp-signature')
  const payload = await request.text()

  if (!validateWebhookSignature(payload, signature, process.env.WHATSAPP_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Process webhook
}
```

#### [LOW-3] Missing Cache-Control on Error Responses
**Risk**: Caching of error pages by CDN

**Remediation**:
```typescript
// lib/errors/error-handler.ts
export function handleAPIError(error: Error, path: string): Response {
  const response = NextResponse.json(errorResponse, { status })

  // ✅ ADD: Prevent caching of errors
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}
```

---

## 6. Security Recommendations & Best Practices

### Immediate Actions (Week 1)

1. **Deploy Redis for Production**
   ```bash
   # docker-compose.yml
   services:
     redis:
       image: redis:7-alpine
       command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
       ports:
         - "6379:6379"
       volumes:
         - redis-data:/data
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 10s
         timeout: 3s
         retries: 3

   # .env.production
   REDIS_URL=redis://redis:6379
   TRUST_PROXY=true
   TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12
   ```

2. **Enable Global Rate Limiting in Middleware**
   - Implement middleware-level rate limiting (see [CRIT-4])
   - Configure Redis as rate limit store
   - Add monitoring/alerting

3. **Fix IP Spoofing Vulnerability**
   - Implement `getTrustedClientIP()` function
   - Configure `TRUSTED_PROXIES` environment variable
   - Update all rate limiters to use trusted IP extraction

4. **Add File Upload Quotas**
   - Implement user storage quota (1GB per user)
   - Add organization storage quota (100GB per org)
   - Implement cleanup for old attachments

### Short-Term Actions (Month 1)

5. **Database Query Protection**
   - Add `LIMIT` clause to all SELECT queries
   - Implement query timeout mechanism
   - Create database indexes for analytics
   - Enable slow query logging

6. **Connection Limits**
   - Configure `server.maxConnections = 1000`
   - Set request timeouts (30s)
   - Implement per-IP connection limiting
   - Monitor connection metrics

7. **Endpoint-Specific Rate Limiting**
   - Apply rate limiting to remaining 104 endpoints
   - Use appropriate limits per endpoint type
   - Implement user-based + IP-based limiting

8. **Request Body Size Limits**
   - Enforce 1MB limit for API requests
   - Implement Content-Length validation
   - Add custom error messages

### Medium-Term Actions (Quarter 1)

9. **Migrate to PostgreSQL** (Production)
   ```typescript
   // Benefits over SQLite:
   // - Multiple concurrent writers
   // - Better performance under load
   // - Advanced query optimization
   // - Streaming replication
   // - Connection pooling
   ```

10. **Implement Circuit Breaker Pattern**
    - Protect against cascading failures
    - Add graceful degradation
    - Implement health checks

11. **Add Request Queueing**
    - Prevent server overload
    - Implement load shedding
    - Monitor queue depth

12. **WebSocket Protection**
    - Connection rate limiting
    - Message rate limiting
    - Max message size enforcement

### Long-Term Actions (Quarter 2+)

13. **CDN + DDoS Protection**
    - Cloudflare / AWS CloudFront
    - Web Application Firewall (WAF)
    - Automatic DDoS mitigation
    - Geographic rate limiting

14. **Advanced Monitoring**
    - Real-time attack detection
    - Anomaly detection (AI/ML)
    - Automated response system
    - Security dashboard

15. **Performance Testing**
    - Load testing (1000+ concurrent users)
    - Stress testing (identify breaking points)
    - Spike testing (sudden traffic bursts)
    - Endurance testing (24+ hours)

---

## 7. Implementation Priority Matrix

| Priority | Vulnerability | Effort | Impact | Timeline |
|----------|--------------|--------|--------|----------|
| 🔴 **P0** | [CRIT-1] Multi-Server Rate Limit Bypass | High | Critical | Day 1-3 |
| 🔴 **P0** | [CRIT-3] IP Spoofing | Medium | Critical | Day 1-3 |
| 🔴 **P0** | [CRIT-4] Missing Rate Limiting (104 endpoints) | High | Critical | Week 1 |
| 🟠 **P1** | [CRIT-2] File Upload DoS | Medium | High | Week 1 |
| 🟠 **P1** | [HIGH-1] Database Query DoS | High | High | Week 1-2 |
| 🟠 **P1** | [HIGH-2] Body Size Limits | Low | High | Week 1 |
| 🟠 **P1** | [HIGH-3] Connection Limits | Medium | High | Week 2 |
| 🟡 **P2** | [HIGH-4] Email/WhatsApp Rate Limiting | Low | Medium | Week 2 |
| 🟡 **P2** | [HIGH-5] Workflow Execution DoS | Medium | Medium | Week 3 |
| 🟡 **P2** | [MED-1] Inconsistent Rate Limiting | Medium | Low | Month 1 |
| 🟡 **P2** | [MED-2] Circuit Breaker | High | Medium | Month 2 |
| 🟢 **P3** | [MED-3] Request Queueing | High | Medium | Quarter 1 |
| 🟢 **P3** | [MED-4] SQLite Migration | Very High | High | Quarter 1 |

---

## 8. Testing & Validation

### Rate Limiting Tests
```bash
#!/bin/bash
# test-rate-limiting.sh

# Test 1: Authentication rate limiting
echo "Testing /api/auth/login rate limiting..."
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo ""
done
# Expected: First 10 succeed (or fail auth), next 5 get 429

# Test 2: IP spoofing protection
echo "Testing IP spoofing..."
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "X-Forwarded-For: $i.$i.$i.$i" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Expected (before fix): All 15 succeed (VULNERABILITY)
# Expected (after fix): First 10 succeed, next 5 get 429

# Test 3: File upload quota
echo "Testing file upload quota..."
for i in {1..15}; do
  dd if=/dev/zero of=test$i.bin bs=1M count=10
  curl -X POST http://localhost:3000/api/tickets/1/attachments \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@test$i.bin"
  rm test$i.bin
done
# Expected (before fix): All 15 succeed (150MB stored)
# Expected (after fix): ~100 uploads succeed (1GB quota), rest get 413
```

### Load Testing
```javascript
// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Sustain 100 users
    { duration: '2m', target: 200 }, // Spike to 200 users
    { duration: '5m', target: 200 }, // Sustain 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.1'],    // Error rate < 10%
  },
};

export default function () {
  // Test API endpoints
  const res = http.get('http://localhost:3000/api/tickets');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'not rate limited': (r) => r.status !== 429,
  });

  sleep(1);
}
```

### Penetration Testing Checklist
- [ ] Rate limit bypass attempts (X-Forwarded-For spoofing)
- [ ] Large payload attacks (JSON bombs)
- [ ] File upload exhaustion
- [ ] Slowloris attack simulation
- [ ] Database query performance under load
- [ ] WebSocket connection flooding
- [ ] Email/SMS bombing
- [ ] Workflow recursion attacks
- [ ] Cache poisoning attempts
- [ ] Session fixation/hijacking

---

## 9. Monitoring & Alerting Configuration

### Metrics to Track
```typescript
// lib/monitoring/metrics.ts
export const rateLimitMetrics = {
  // Rate limiting
  'rate_limit.requests_total': Counter,
  'rate_limit.requests_blocked': Counter,
  'rate_limit.requests_allowed': Counter,

  // Response times
  'api.request_duration': Histogram,
  'api.response_size': Histogram,

  // Database
  'db.query_duration': Histogram,
  'db.connection_pool_size': Gauge,
  'db.query_errors': Counter,

  // Server
  'server.connections_active': Gauge,
  'server.memory_usage': Gauge,
  'server.cpu_usage': Gauge,

  // File uploads
  'uploads.total_storage': Gauge,
  'uploads.count': Counter,

  // WebSocket
  'websocket.connections_active': Gauge,
  'websocket.messages_rate': Counter,
}
```

### Alert Rules
```yaml
# prometheus-alerts.yml
groups:
  - name: rate_limiting
    interval: 30s
    rules:
      - alert: HighRateLimitBlocking
        expr: rate(rate_limit_requests_blocked[5m]) > 10
        for: 5m
        annotations:
          summary: "High rate limit blocking detected"
          description: "{{ $value }} requests blocked per second"

      - alert: PossibleDDoSAttack
        expr: rate(http_requests_total[1m]) > 1000
        for: 2m
        annotations:
          summary: "Possible DDoS attack"
          description: "{{ $value }} requests per second"

      - alert: DatabaseSlowQueries
        expr: histogram_quantile(0.95, db_query_duration) > 1000
        for: 5m
        annotations:
          summary: "Slow database queries"
          description: "P95 query duration: {{ $value }}ms"

      - alert: HighStorageUsage
        expr: uploads_total_storage > 50 * 1024 * 1024 * 1024 # 50GB
        annotations:
          summary: "High storage usage"
          description: "{{ $value }} bytes used"
```

---

## 10. Compliance & Audit Trail

### Logging Requirements
```typescript
// Log all rate limiting events
logger.info('rate_limit_applied', {
  timestamp: new Date().toISOString(),
  ip: getTrustedClientIP(request),
  userId: user?.id,
  endpoint: request.nextUrl.pathname,
  limit: rateLimitInfo.limit,
  remaining: rateLimitInfo.remaining,
  resetTime: rateLimitInfo.reset,
  blocked: !rateLimitInfo.allowed
})

// Log security events
logger.warn('security_event', {
  type: 'IP_SPOOFING_ATTEMPT',
  ip: request.headers.get('x-forwarded-for'),
  trustedIp: getTrustedClientIP(request),
  endpoint: request.nextUrl.pathname
})
```

### Audit Requirements
- **Retention**: 90 days minimum for security logs
- **Immutability**: Logs should be write-once (append-only)
- **Encryption**: Logs should be encrypted at rest
- **Access Control**: Only security team can access raw logs
- **Compliance**: GDPR, SOC2, ISO27001 considerations

---

## 11. Conclusion

### Security Posture Summary

**Current State**: ⚠️ **MODERATE RISK**
- 16 endpoints protected (13% coverage)
- In-memory rate limiting (cluster vulnerable)
- Multiple conflicting implementations
- No global protection layer

**Target State**: ✅ **STRONG PROTECTION**
- 100% endpoint coverage
- Redis-backed distributed rate limiting
- Single unified implementation
- Global + endpoint-specific protection
- Real-time monitoring & alerting

### Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Protected Endpoints | 16 (13%) | 120 (100%) |
| Rate Limit Storage | Memory | Redis |
| IP Validation | None | Trusted Proxies |
| Query Timeouts | None | 5s |
| File Upload Quota | None | 1GB/user |
| Connection Limits | Unlimited | 1000 |
| Request Body Limit | Implicit 1MB | Explicit 1MB |

### Estimated Implementation Time
- **Critical Fixes**: 1 week (40 hours)
- **High Priority**: 2 weeks (80 hours)
- **Medium Priority**: 1 month (160 hours)
- **Long-Term**: Ongoing

### Risk Reduction
- **Before**: 4 Critical + 6 High = **10 Severe Vulnerabilities**
- **After Phase 1**: 0 Critical + 2 High = **2 Remaining Issues**
- **After Phase 2**: 0 Critical + 0 High = **Production Ready**

---

## Appendix A: Code Examples

### A.1 Complete Rate Limiting Middleware
```typescript
// middleware.ts - RECOMMENDED IMPLEMENTATION
import { getTrustedClientIP } from './lib/security/ip-detection'
import { RateLimiter, rateLimitStrategies } from './lib/api/rate-limit'
import { getRedisClient } from './lib/cache/redis-client'
import { RedisRateLimitStore } from './lib/api/rate-limit'

// Initialize Redis store for production
const redis = process.env.REDIS_URL ? getRedisClient() : null
const rateLimitStore = redis
  ? new RedisRateLimitStore(redis.getClient())
  : undefined // Falls back to in-memory

// Global rate limiter
const globalRateLimiter = new RateLimiter({
  ...rateLimitStrategies.api,
  max: 100, // 100 req/15min for authenticated users
  store: rateLimitStore,
  keyGenerator: (req, context) => {
    // Prioritize user ID over IP
    if (context?.user?.id) {
      return `global:user:${context.user.id}:${context.tenant?.id}`
    }
    // Use trusted IP for unauthenticated
    return `global:ip:${getTrustedClientIP(req)}`
  },
  onLimitReached: (req, context, info) => {
    logger.warn('Global rate limit exceeded', {
      ip: getTrustedClientIP(req),
      userId: context?.user?.id,
      path: req.nextUrl.pathname,
      limit: info.limit,
      remaining: info.remaining
    })
  }
})

// Stricter rate limiter for auth endpoints
const authRateLimiter = new RateLimiter({
  ...rateLimitStrategies.auth,
  store: rateLimitStore,
  keyGenerator: (req) => {
    const ip = getTrustedClientIP(req)
    const email = req.headers.get('x-login-email') // Set from body
    return `auth:${ip}:${email || 'unknown'}`
  }
})

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ... existing tenant resolution ...

  // Apply auth-specific rate limiting
  if (pathname.startsWith('/api/auth/login') ||
      pathname.startsWith('/api/auth/register')) {
    const rateLimitResult = await authRateLimiter.middleware(request, {
      requestId: crypto.randomUUID()
    })
    if (rateLimitResult) return rateLimitResult
  }

  // Apply global rate limiting to all API routes
  if (pathname.startsWith('/api/') && requiresAuth(pathname)) {
    const rateLimitResult = await globalRateLimiter.middleware(request, {
      user: authResult.user,
      tenant: tenant,
      requestId: crypto.randomUUID()
    })
    if (rateLimitResult) return rateLimitResult
  }

  // ... rest of middleware ...
}
```

### A.2 Trusted IP Extraction
```typescript
// lib/security/ip-detection.ts
export function getTrustedClientIP(req: NextRequest): string {
  // 1. Check if we trust the proxy
  const trustProxy = process.env.TRUST_PROXY === 'true'

  // 2. Get X-Forwarded-For header
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')

  if (!trustProxy) {
    // Not behind trusted proxy - be suspicious
    if (forwarded) {
      logger.warn('X-Forwarded-For header present but TRUST_PROXY=false', {
        forwarded,
        path: req.nextUrl.pathname
      })
    }
    return realIp || 'unknown'
  }

  // 3. Parse X-Forwarded-For with trust chain
  if (!forwarded) return realIp || 'unknown'

  const ips = forwarded.split(',').map(ip => ip.trim())
  const trustedProxies = (process.env.TRUSTED_PROXIES || '').split(',')

  // 4. Walk backwards through the chain, stopping at first untrusted IP
  for (let i = ips.length - 1; i >= 0; i--) {
    const ip = ips[i]

    // Check if this IP is in our trusted proxy list
    if (!isTrustedProxy(ip, trustedProxies)) {
      // Validate IP format before returning
      if (isValidIP(ip)) {
        return ip
      }
    }
  }

  // If all IPs are trusted (shouldn't happen), return first
  return ips[0] || 'unknown'
}

function isTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  for (const trusted of trustedProxies) {
    // Support CIDR notation
    if (trusted.includes('/')) {
      if (ipMatchesCIDR(ip, trusted)) return true
    } else {
      if (ip === trusted) return true
    }
  }
  return false
}

function isValidIP(ip: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    const octets = ip.split('.').map(Number)
    return octets.every(octet => octet >= 0 && octet <= 255)
  }

  // IPv6 (simplified check)
  if (/^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/.test(ip)) {
    return true
  }

  return false
}

function ipMatchesCIDR(ip: string, cidr: string): boolean {
  // Implement CIDR matching (use library like 'ip-cidr' in production)
  // Simplified example:
  const [subnet, bits] = cidr.split('/')
  // ... implementation ...
  return false // Placeholder
}
```

### A.3 File Upload Quota System
```typescript
// lib/storage/quota.ts
export interface StorageQuota {
  userQuota: number      // Per user limit
  orgQuota: number       // Per organization limit
  maxFileSize: number    // Per file limit
}

export const DEFAULT_QUOTAS: StorageQuota = {
  userQuota: 1024 * 1024 * 1024,      // 1GB per user
  orgQuota: 100 * 1024 * 1024 * 1024, // 100GB per organization
  maxFileSize: 10 * 1024 * 1024        // 10MB per file
}

export class StorageQuotaManager {
  constructor(private quotas: StorageQuota = DEFAULT_QUOTAS) {}

  getUserStorageUsed(userId: number, orgId: number): number {
    const result = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total
      FROM attachments
      WHERE uploaded_by = ? AND organization_id = ?
    `).get(userId, orgId) as { total: number }

    return result.total
  }

  getOrgStorageUsed(orgId: number): number {
    const result = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total
      FROM attachments
      WHERE organization_id = ?
    `).get(orgId) as { total: number }

    return result.total
  }

  canUpload(userId: number, orgId: number, fileSize: number): {
    allowed: boolean
    reason?: string
    quotaInfo: {
      userUsed: number
      userQuota: number
      orgUsed: number
      orgQuota: number
    }
  } {
    // Check file size
    if (fileSize > this.quotas.maxFileSize) {
      return {
        allowed: false,
        reason: `File too large. Maximum: ${this.formatBytes(this.quotas.maxFileSize)}`,
        quotaInfo: this.getQuotaInfo(userId, orgId)
      }
    }

    // Check user quota
    const userUsed = this.getUserStorageUsed(userId, orgId)
    if (userUsed + fileSize > this.quotas.userQuota) {
      return {
        allowed: false,
        reason: `User storage quota exceeded. Used: ${this.formatBytes(userUsed)}, Quota: ${this.formatBytes(this.quotas.userQuota)}`,
        quotaInfo: this.getQuotaInfo(userId, orgId)
      }
    }

    // Check org quota
    const orgUsed = this.getOrgStorageUsed(orgId)
    if (orgUsed + fileSize > this.quotas.orgQuota) {
      return {
        allowed: false,
        reason: `Organization storage quota exceeded. Contact administrator.`,
        quotaInfo: this.getQuotaInfo(userId, orgId)
      }
    }

    return {
      allowed: true,
      quotaInfo: this.getQuotaInfo(userId, orgId)
    }
  }

  private getQuotaInfo(userId: number, orgId: number) {
    return {
      userUsed: this.getUserStorageUsed(userId, orgId),
      userQuota: this.quotas.userQuota,
      orgUsed: this.getOrgStorageUsed(orgId),
      orgQuota: this.quotas.orgQuota
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
}

// Usage in upload route
const quotaManager = new StorageQuotaManager()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request)
  const tenant = getTenantFromRequest(request)

  const formData = await request.formData()
  const file = formData.get('file') as File

  // Check quota BEFORE saving file
  const quotaCheck = quotaManager.canUpload(user.id, tenant.id, file.size)

  if (!quotaCheck.allowed) {
    return NextResponse.json({
      error: quotaCheck.reason,
      quota: quotaCheck.quotaInfo
    }, { status: 413 })
  }

  // ... proceed with file upload ...
}
```

---

## Appendix B: Configuration Templates

### B.1 Environment Variables
```bash
# .env.production

# Rate Limiting
REDIS_URL=redis://redis:6379/0
TRUST_PROXY=true
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

# Storage Quotas
MAX_USER_STORAGE_GB=1
MAX_ORG_STORAGE_GB=100
MAX_FILE_SIZE_MB=10

# Database
DATABASE_QUERY_TIMEOUT_MS=5000
DATABASE_MAX_RESULTS=1000

# Server
SERVER_MAX_CONNECTIONS=1000
SERVER_REQUEST_TIMEOUT_MS=30000
SERVER_KEEPALIVE_TIMEOUT_MS=5000

# Monitoring
SENTRY_DSN=https://...
METRICS_ENABLED=true
```

### B.2 Docker Compose
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379/0
      - TRUST_PROXY=true
      - TRUSTED_PROXIES=10.0.0.0/8
    depends_on:
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G

  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app

volumes:
  redis-data:
```

### B.3 Nginx Configuration
```nginx
# nginx.conf
http {
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn:10m;

    upstream app {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    server {
        listen 80;
        server_name servicedesk.example.com;

        # Global connection limit
        limit_conn conn 10;

        # Client body size
        client_max_body_size 10M;
        client_body_timeout 30s;

        # Headers timeout
        client_header_timeout 10s;

        # Auth endpoints - stricter limits
        location ~ ^/api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://app;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Static files - no rate limit
        location /_next/static/ {
            proxy_pass http://app;
            proxy_cache_valid 200 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

---

## Document Information

**Version**: 1.0
**Last Updated**: 2025-12-26
**Next Review**: 2025-01-26
**Author**: Claude Code Security Analyzer
**Classification**: Internal - Security Team Only

**Distribution List**:
- CTO / VP Engineering
- Security Team
- DevOps Team
- Backend Development Team

**Approval Required From**:
- [ ] Chief Information Security Officer (CISO)
- [ ] VP Engineering
- [ ] Lead Backend Developer

---

*This document contains sensitive security information. Unauthorized distribution is prohibited.*
