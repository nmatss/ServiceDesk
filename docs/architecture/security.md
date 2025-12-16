# Security Architecture

## Table of Contents

1. [Security Model Overview](#security-model-overview)
2. [Authentication Security](#authentication-security)
3. [Authorization (RBAC)](#authorization-rbac)
4. [CSRF Protection](#csrf-protection)
5. [Rate Limiting](#rate-limiting)
6. [Data Encryption](#data-encryption)
7. [Security Headers](#security-headers)
8. [Input Validation](#input-validation)
9. [Audit Logging](#audit-logging)
10. [LGPD/GDPR Compliance](#lgpdgdpr-compliance)

## Security Model Overview

### Defense in Depth

ServiceDesk implements multiple security layers:

```
Layer 1: Network Security (Firewall, DDoS Protection)
   ↓
Layer 2: Infrastructure Security (Kubernetes Network Policies)
   ↓
Layer 3: Application Security (Middleware, Headers)
   ↓
Layer 4: Authentication (JWT, 2FA, SSO)
   ↓
Layer 5: Authorization (RBAC, Permissions)
   ↓
Layer 6: Data Security (Encryption, Validation)
   ↓
Layer 7: Audit & Monitoring (Logs, Alerts)
```

### Security Principles

1. **Zero Trust**: Never trust, always verify
2. **Least Privilege**: Minimal permissions by default
3. **Defense in Depth**: Multiple security layers
4. **Secure by Default**: Security-first configurations
5. **Fail Securely**: Errors don't expose vulnerabilities
6. **Separation of Duties**: RBAC enforcement
7. **Audit Everything**: Comprehensive logging

## Authentication Security

### Password Security

**Location**: `lib/auth/password-policies.ts`

#### Password Policies

```typescript
interface PasswordPolicy {
  min_length: number;             // Minimum 8 characters
  require_uppercase: boolean;      // At least one uppercase
  require_lowercase: boolean;      // At least one lowercase
  require_numbers: boolean;        // At least one number
  require_special_chars: boolean;  // At least one special char
  min_special_chars: number;       // Minimum special chars
  max_age_days: number;            // Password expiration (90 days)
  prevent_reuse_last: number;      // Prevent reuse of last N passwords
  max_failed_attempts: number;     // Account lockout threshold
  lockout_duration_minutes: number; // Lockout duration
}
```

#### Password Hashing

```typescript
// bcrypt with cost factor 10
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

#### Password History

```sql
-- Prevent password reuse
CREATE TABLE password_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Check last N passwords
SELECT COUNT(*) FROM password_history
WHERE user_id = ? AND password_hash = ?
LIMIT 5;
```

### JWT Token Security

**Location**: `lib/auth/index.ts`, `middleware.ts`

#### Token Configuration

```typescript
const JWT_CONFIG = {
  accessToken: {
    expiresIn: '15m',
    algorithm: 'HS256',
    issuer: 'servicedesk',
    audience: 'servicedesk-users'
  },
  refreshToken: {
    expiresIn: '7d',
    rotateOnRefresh: true,
    revokeOnLogout: true
  }
};
```

#### Token Storage

- **Access Token**: httpOnly, secure, sameSite=lax cookie
- **Refresh Token**: Database with device info, IP tracking
- **No localStorage**: Prevents XSS token theft

#### Token Validation

```typescript
export async function verifyToken(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'servicedesk',
      audience: 'servicedesk-users',
      clockTolerance: 10 // 10 seconds
    });

    // Validate payload structure
    if (!isValidPayload(payload)) {
      throw new Error('Invalid token payload');
    }

    // Check if token is blacklisted (logout, password change)
    if (await isTokenBlacklisted(payload.jti)) {
      throw new Error('Token has been revoked');
    }

    return payload;
  } catch (error) {
    captureAuthError(error);
    return null;
  }
}
```

#### Token Revocation

```typescript
// Blacklist tokens on logout or password change
export async function revokeToken(tokenId: string, reason: string) {
  await redis.setex(
    `blacklist:${tokenId}`,
    60 * 60 * 24 * 7, // 7 days (max token lifetime)
    JSON.stringify({ reason, revokedAt: new Date().toISOString() })
  );
}
```

### Multi-Factor Authentication (2FA)

**Location**: `lib/auth/mfa-manager.ts`

#### TOTP Implementation

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export async function enable2FA(userId: number) {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `ServiceDesk (${user.email})`,
    issuer: 'ServiceDesk'
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  // Store encrypted secret
  await db.prepare(`
    UPDATE users
    SET two_factor_secret = ?,
        two_factor_backup_codes = ?
    WHERE id = ?
  `).run(
    encrypt(secret.base32),
    JSON.stringify(backupCodes.map(hashBackupCode)),
    userId
  );

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
    backupCodes
  };
}

export function verify2FA(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2 // Allow 2 time steps (60 seconds)
  });
}
```

#### Backup Codes

```typescript
function generateBackupCodes(count: number): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString('hex')
  );
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function useBackupCode(userId: number, code: string): Promise<boolean> {
  const user = await getUser(userId);
  const backupCodes = JSON.parse(user.two_factor_backup_codes);
  const hashedCode = hashBackupCode(code);

  const index = backupCodes.indexOf(hashedCode);
  if (index === -1) return false;

  // Remove used code
  backupCodes.splice(index, 1);
  await updateUserBackupCodes(userId, backupCodes);

  return true;
}
```

### Session Management

**Location**: `lib/auth/index.ts`

#### Session Tracking

```sql
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  device_info TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Session Limits

```typescript
const MAX_SESSIONS_PER_USER = 5;

export async function createSession(userId: number, deviceInfo: any) {
  // Limit concurrent sessions
  const activeSessions = await getActiveSessions(userId);
  if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
    // Revoke oldest session
    await revokeSession(activeSessions[0].id);
  }

  // Create new session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.prepare(`
    INSERT INTO user_sessions (id, user_id, device_info, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, JSON.stringify(deviceInfo), deviceInfo.ip, expiresAt);

  return sessionId;
}
```

## Authorization (RBAC)

### Permission Model

**Location**: `lib/auth/rbac.ts`

#### Permission Structure

```
Resource:Action format
Examples:
- tickets:create
- tickets:read
- tickets:update
- tickets:delete
- tickets:assign
- tickets:manage (includes all actions)
- admin:manage (super permission)
```

#### Role Hierarchy

```typescript
const ROLE_HIERARCHY = {
  admin: ['manager', 'agent', 'user', 'read_only'],
  manager: ['agent', 'user'],
  agent: ['user'],
  user: [],
  read_only: []
};

function hasRole(userId: number, requiredRole: string): boolean {
  const userRoles = getUserRoles(userId);

  for (const userRole of userRoles) {
    // Exact match
    if (userRole.name === requiredRole) return true;

    // Hierarchical match
    if (ROLE_HIERARCHY[userRole.name]?.includes(requiredRole)) {
      return true;
    }
  }

  return false;
}
```

#### Conditional Permissions

```typescript
// Row-level security with conditions
const permission = {
  resource: 'tickets',
  action: 'update',
  conditions: {
    owner_only: true,      // User owns the resource
    department_only: true, // Same department
    business_hours: true   // Only during business hours
  }
};

function evaluateConditions(
  permission: Permission,
  context: {
    userId: number;
    resourceOwnerId: number;
    userDepartment: string;
    resourceDepartment: string;
  }
): boolean {
  const conditions = JSON.parse(permission.conditions || '{}');

  if (conditions.owner_only && context.userId !== context.resourceOwnerId) {
    return false;
  }

  if (conditions.department_only &&
      context.userDepartment !== context.resourceDepartment) {
    return false;
  }

  if (conditions.business_hours && !isBusinessHours()) {
    return false;
  }

  return true;
}
```

## CSRF Protection

**Location**: `lib/security/csrf.ts`, `middleware.ts`

### Double Submit Cookie Pattern

```typescript
import crypto from 'crypto';

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function setCSRFToken(response: NextResponse): NextResponse {
  const token = generateCSRFToken();

  // Set in cookie (httpOnly for security)
  response.cookies.set('csrf_token', token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 // 24 hours
  });

  // Also set in header for client to read
  response.headers.set('X-CSRF-Token', token);

  return response;
}

export function validateCSRFToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get('csrf_token')?.value;
  const headerToken = request.headers.get('X-CSRF-Token');

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}
```

### Middleware Integration

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // State-changing methods require CSRF validation
  const needsCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  if (needsCSRF && !validateCSRFToken(request)) {
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }

  // Rotate CSRF token on every request
  const response = NextResponse.next();
  setCSRFToken(response);

  return response;
}
```

## Rate Limiting

**Location**: `lib/api/rate-limit.ts`

### Implementation

```typescript
import Redis from 'ioredis';

export class RateLimiter {
  private redis: Redis;

  async checkLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();

    // Sliding window counter
    const requests = await this.redis.zrangebyscore(
      key,
      now - windowSeconds * 1000,
      now
    );

    if (requests.length >= limit) {
      return { allowed: false, remaining: 0 };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${crypto.randomUUID()}`);

    // Set expiration
    await this.redis.expire(key, windowSeconds);

    return {
      allowed: true,
      remaining: limit - requests.length - 1
    };
  }
}

// Rate limit configurations
export const RATE_LIMITS = {
  login: { limit: 5, window: 900 },      // 5 attempts per 15 minutes
  api: { limit: 100, window: 60 },       // 100 requests per minute
  create_ticket: { limit: 10, window: 60 } // 10 tickets per minute
};
```

### API Route Protection

```typescript
// app/api/auth/login/route.ts
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Check rate limit
  const { allowed, remaining } = await rateLimiter.checkLimit(
    `login:${ip}`,
    RATE_LIMITS.login.limit,
    RATE_LIMITS.login.window
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': RATE_LIMITS.login.window.toString(),
          'X-RateLimit-Limit': RATE_LIMITS.login.limit.toString(),
          'X-RateLimit-Remaining': '0'
        }
      }
    );
  }

  // Process login...
}
```

## Data Encryption

### At-Rest Encryption

#### Sensitive Data Fields

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Usage
await db.prepare(`
  UPDATE users
  SET two_factor_secret = ?
  WHERE id = ?
`).run(encrypt(secret), userId);
```

### In-Transit Encryption

- **HTTPS**: TLS 1.3 only, strong cipher suites
- **HSTS**: Strict-Transport-Security header
- **Certificate Pinning**: Future implementation

## Security Headers

**Location**: `lib/security/headers.ts`, `lib/security/helmet.ts`

### Comprehensive Security Headers

```typescript
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = {
    // HSTS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // Prevent clickjacking
    'X-Frame-Options': 'SAMEORIGIN',

    // XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Content type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

    // CSP
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'self'"
    ].join('; ')
  };

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}
```

## Input Validation

**Location**: `lib/validation/schemas.ts`

### Zod Schema Validation

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const createTicketSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must not exceed 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,!?]+$/, 'Invalid characters in title'),

  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(10000, 'Description too long'),

  category_id: z.number().int().positive(),
  priority_id: z.number().int().positive()
});

// SQL Injection prevention through prepared statements
const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
const ticket = stmt.get(sanitizedInput);
```

### HTML Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target']
  });
}
```

## Audit Logging

**Location**: `lib/audit/logger.ts`

### Comprehensive Audit Trail

```typescript
export async function logAuditEvent(event: AuditEvent) {
  await db.prepare(`
    INSERT INTO audit_logs (
      user_id, entity_type, entity_id, action,
      old_values, new_values,
      ip_address, user_agent,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    event.userId,
    event.entityType,
    event.entityId,
    event.action,
    JSON.stringify(event.oldValues),
    JSON.stringify(event.newValues),
    event.ipAddress,
    event.userAgent
  );

  // Also log to Datadog/Sentry for alerting
  logger.info('Audit event', {
    event,
    tags: ['audit', event.entityType, event.action]
  });
}

// Usage
await logAuditEvent({
  userId: user.id,
  entityType: 'ticket',
  entityId: ticket.id,
  action: 'update',
  oldValues: { status: 'open' },
  newValues: { status: 'resolved' },
  ipAddress: request.ip,
  userAgent: request.headers.get('user-agent')
});
```

### Authentication Audit

```sql
CREATE TABLE auth_audit_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  event_type TEXT NOT NULL, -- 'login', 'logout', 'password_change', etc.
  ip_address TEXT,
  user_agent TEXT,
  details TEXT, -- JSON
  consent_given BOOLEAN,
  data_retention_expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

## LGPD/GDPR Compliance

**Location**: `lib/compliance/lgpd-manager.ts`

### Data Subject Rights

```typescript
// Right to Access
export async function exportUserData(userId: number) {
  const user = await getUser(userId);
  const tickets = await getUserTickets(userId);
  const comments = await getUserComments(userId);
  const consents = await getUserConsents(userId);

  return {
    personal_data: {
      name: user.name,
      email: user.email,
      created_at: user.created_at
    },
    tickets,
    comments,
    consents,
    export_date: new Date().toISOString()
  };
}

// Right to Erasure (Right to be Forgotten)
export async function anonymizeUser(userId: number) {
  await db.transaction(() => {
    // Anonymize personal data
    db.prepare(`
      UPDATE users
      SET name = 'Anonymous User',
          email = ?,
          avatar_url = NULL,
          phone = NULL,
          metadata = NULL
      WHERE id = ?
    `).run(`deleted-${userId}@anonymized.local`, userId);

    // Keep audit logs but mark for deletion
    db.prepare(`
      UPDATE audit_logs
      SET data_retention_expires_at = datetime('now', '+30 days')
      WHERE user_id = ?
    `).run(userId);
  })();
}

// Consent Management
export async function recordConsent(userId: number, consentType: string) {
  await db.prepare(`
    INSERT INTO lgpd_consents (
      user_id, consent_type, purpose, legal_basis,
      is_given, consent_method, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    userId,
    consentType,
    'Data processing for service delivery',
    'contract',
    'web_form',
    request.ip,
    request.headers.get('user-agent')
  );
}
```

### Data Retention Policies

```typescript
// Automatic data cleanup
export async function cleanupExpiredData() {
  // Delete expired audit logs
  await db.prepare(`
    DELETE FROM audit_logs
    WHERE data_retention_expires_at < datetime('now')
  `).run();

  // Delete old login attempts (90 days)
  await db.prepare(`
    DELETE FROM login_attempts
    WHERE created_at < datetime('now', '-90 days')
  `).run();

  // Archive resolved tickets after 2 years
  await db.prepare(`
    UPDATE tickets
    SET archived = 1
    WHERE status_id IN (SELECT id FROM statuses WHERE is_final = 1)
      AND resolved_at < datetime('now', '-2 years')
  `).run();
}
```

## Security Monitoring

### Alerts & Anomalies

```typescript
// Monitor for suspicious activity
export async function detectAnomalies() {
  // Multiple failed logins
  const suspiciousIPs = await db.prepare(`
    SELECT ip_address, COUNT(*) as attempts
    FROM login_attempts
    WHERE success = 0
      AND created_at > datetime('now', '-1 hour')
    GROUP BY ip_address
    HAVING attempts > 10
  `).all();

  for (const ip of suspiciousIPs) {
    await alertSecurityTeam('Multiple failed logins', { ip });
  }

  // Unusual access patterns
  // Large data exports
  // Permission escalation attempts
  // etc.
}
```

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
