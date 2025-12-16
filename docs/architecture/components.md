# System Components

## Table of Contents

1. [Frontend Architecture](#frontend-architecture)
2. [Backend Architecture](#backend-architecture)
3. [Database Architecture](#database-architecture)
4. [Caching Architecture](#caching-architecture)
5. [Authentication Architecture](#authentication-architecture)
6. [Multi-Tenant Architecture](#multi-tenant-architecture)
7. [AI/ML Components](#aiml-components)
8. [Monitoring Components](#monitoring-components)

## Frontend Architecture

### Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 18
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 3.3
- **State Management**: React Context + hooks
- **Real-time**: Socket.io Client
- **Forms**: React Hook Form (implied)
- **Rich Text**: React Quill

### Directory Structure

```
app/
├── (routes)/
│   ├── layout.tsx              # Root layout with AppLayout
│   ├── page.tsx                # Dashboard home
│   ├── auth/
│   │   ├── login/page.tsx      # Login page
│   │   └── register/page.tsx   # Registration page
│   ├── tickets/
│   │   ├── page.tsx            # Ticket list
│   │   ├── new/page.tsx        # Create ticket
│   │   ├── [id]/page.tsx       # View ticket
│   │   └── [id]/edit/page.tsx  # Edit ticket
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout
│   │   ├── dashboard/page.tsx  # Admin dashboard
│   │   ├── users/page.tsx      # User management
│   │   ├── settings/page.tsx   # System settings
│   │   └── reports/page.tsx    # Reports
│   ├── portal/
│   │   ├── page.tsx            # Customer portal home
│   │   ├── create/page.tsx     # Submit ticket
│   │   └── tickets/page.tsx    # View tickets
│   ├── knowledge/
│   │   ├── page.tsx            # KB home
│   │   └── article/[slug]/page.tsx
│   └── analytics/
│       └── page.tsx            # Analytics dashboard
├── api/                        # API routes (see Backend)
├── error.tsx                   # Error boundary
├── global-error.tsx            # Global error handler
├── not-found.tsx               # 404 page
└── landing/
    └── page.tsx                # Public landing page
```

### Component Architecture

#### 1. Page Components

**Location**: `app/**/page.tsx`

Server Components by default (Next.js App Router):
- Fetch data on server
- Pre-render HTML
- Send minimal JavaScript to client
- SEO-friendly

```typescript
// Example: app/tickets/page.tsx
export default async function TicketsPage() {
  // Server-side data fetching
  const tickets = await getTickets();

  return (
    <div>
      <TicketList tickets={tickets} />
    </div>
  );
}
```

#### 2. Client Components

**Location**: `components/**/*.tsx`

Interactive components with `'use client'` directive:
- Event handlers
- State management
- Browser APIs
- Third-party libraries that use browser APIs

```typescript
// Example: components/TicketForm.tsx
'use client';

export function TicketForm() {
  const [title, setTitle] = useState('');

  const handleSubmit = async () => {
    await createTicket({ title });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### 3. Layout Components

**Location**: `app/**/layout.tsx`

Nested layouts for consistent UI:
- Root layout: Global navigation, providers
- Admin layout: Admin sidebar
- Portal layout: Customer-facing navigation

```typescript
// Example: app/admin/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  );
}
```

### UI Component Library

**Location**: `components/ui/`

Reusable, accessible components:
- **Button**: Primary, secondary, danger variants
- **Input**: Text, email, password, textarea
- **Select**: Dropdown with search
- **Modal**: Dialog with backdrop
- **Card**: Container with header/footer
- **Badge**: Status indicators
- **Alert**: Success, error, warning, info
- **Loading**: Spinners, skeletons
- **Table**: Sortable, paginated data tables

### Design System

**Location**: `lib/design-system/`

- **Tokens** (`tokens.ts`): Colors, spacing, typography
- **Themes** (`themes.ts`): Light, dark, high-contrast
- **Utils** (`utils.ts`): Style helpers, classname utilities
- **Persona Variants** (`persona-variants.ts`): Role-based customizations

### State Management

#### Global State
- **AuthContext**: User session, permissions
- **TenantContext**: Current tenant information
- **NotificationContext**: Real-time notifications
- **ThemeContext**: Dark mode, theme preferences

#### Local State
- React `useState` for component state
- React `useReducer` for complex state logic
- Custom hooks for reusable logic

### Real-Time Features

**Implementation**: Socket.io Client

```typescript
// hooks/useRealtimeTickets.ts
export function useRealtimeTickets() {
  useEffect(() => {
    socket.on('ticket:created', handleTicketCreated);
    socket.on('ticket:updated', handleTicketUpdated);

    return () => {
      socket.off('ticket:created');
      socket.off('ticket:updated');
    };
  }, []);
}
```

### Performance Optimizations

1. **Code Splitting**: Automatic with Next.js App Router
2. **Image Optimization**: `next/image` with Sharp
3. **Font Optimization**: `next/font` with preloading
4. **Bundle Analysis**: webpack-bundle-analyzer
5. **Critical CSS**: Critters for inline critical CSS
6. **Lazy Loading**: Dynamic imports for heavy components

## Backend Architecture

### API Routes Structure

```
app/api/
├── auth/
│   ├── login/route.ts          # POST /api/auth/login
│   ├── register/route.ts       # POST /api/auth/register
│   ├── logout/route.ts         # POST /api/auth/logout
│   ├── verify/route.ts         # GET /api/auth/verify
│   ├── refresh/route.ts        # POST /api/auth/refresh
│   └── mfa/
│       ├── enable/route.ts     # POST /api/auth/mfa/enable
│       ├── verify/route.ts     # POST /api/auth/mfa/verify
│       └── disable/route.ts    # POST /api/auth/mfa/disable
├── tickets/
│   ├── route.ts                # GET, POST /api/tickets
│   ├── [id]/route.ts           # GET, PUT, DELETE /api/tickets/:id
│   ├── [id]/comments/route.ts  # GET, POST /api/tickets/:id/comments
│   └── [id]/attachments/route.ts
├── users/
│   ├── route.ts                # GET, POST /api/users
│   ├── [id]/route.ts           # GET, PUT, DELETE /api/users/:id
│   └── me/route.ts             # GET /api/users/me
├── admin/
│   ├── users/route.ts
│   ├── teams/route.ts
│   ├── settings/route.ts
│   └── reports/route.ts
├── analytics/
│   ├── dashboard/route.ts
│   ├── tickets/route.ts
│   └── agents/route.ts
├── notifications/
│   ├── route.ts                # GET /api/notifications
│   ├── [id]/read/route.ts      # PUT /api/notifications/:id/read
│   └── mark-all-read/route.ts
└── health/route.ts             # GET /api/health
```

### API Route Pattern

```typescript
// app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { validateRequest } from '@/lib/validation';
import { ticketSchema } from '@/lib/validation/schemas';
import { createTicket, getTickets } from '@/lib/db/queries';

// GET /api/tickets
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Authorization
    if (!hasPermission(user, 'tickets', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Tenant filtering
    const tenant = getTenantFromRequest(request);

    // 4. Query database
    const tickets = await getTickets(tenant.id, user.id);

    // 5. Return response
    return NextResponse.json({ tickets });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/tickets
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequest(body, ticketSchema);
    if (!validation.success) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }

    // Create ticket
    const ticket = await createTicket({
      ...validation.data,
      user_id: user.id,
      organization_id: tenant.id
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Middleware Layer

**Location**: `middleware.ts` (root level)

Request processing pipeline:

```typescript
export async function middleware(request: NextRequest) {
  // 1. CSRF Protection
  if (needsCSRFValidation(request)) {
    if (!validateCSRFToken(request)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }
  }

  // 2. Tenant Resolution
  const tenantResult = await resolveTenant({
    hostname: request.headers.get('host'),
    pathname: request.nextUrl.pathname,
    headers: Object.fromEntries(request.headers)
  });

  if (!tenantResult.tenant && requiresTenant(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/tenant-not-found', request.url));
  }

  // 3. Authentication
  if (requiresAuth(request.nextUrl.pathname)) {
    const authResult = await checkAuthentication(request, tenantResult.tenant);
    if (!authResult.authenticated) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // 4. Authorization (RBAC)
    if (requiresAdminAccess(request.nextUrl.pathname)) {
      if (!checkAdminAccess(authResult.user, tenantResult.tenant)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  // 5. Security Headers
  const response = NextResponse.next();
  applySecurityHeaders(response);
  applyHelmetHeaders(response);

  // 6. CSRF Token Rotation
  setCSRFToken(response);

  return response;
}
```

### Business Logic Layer

**Location**: `lib/**/*.ts`

#### Core Services

1. **Authentication Service** (`lib/auth/`)
   - `index.ts`: Main auth functions
   - `rbac.ts`: Role-based access control
   - `mfa-manager.ts`: 2FA management
   - `password-policies.ts`: Password validation
   - `sso-manager.ts`: SSO integration

2. **Database Service** (`lib/db/`)
   - `connection.ts`: Connection pooling
   - `queries.ts`: Type-safe queries
   - `optimizer.ts`: Query optimization
   - `analytics-optimizer.ts`: Analytics queries

3. **Notification Service** (`lib/notifications/`)
   - `index.ts`: Main notification functions
   - `channels.ts`: Email, SMS, push, WebSocket
   - `batching.ts`: Batch notification delivery
   - `smart-filtering.ts`: Notification preferences

4. **AI Service** (`lib/ai/`)
   - `ticket-classifier.ts`: Auto-categorization
   - `sentiment.ts`: Sentiment analysis
   - `solution-suggester.ts`: KB recommendations
   - `duplicate-detector.ts`: Find similar tickets

5. **Workflow Service** (`lib/workflow/`)
   - `engine.ts`: Workflow execution
   - `automation-engine.ts`: Rule-based automation

6. **Caching Service** (`lib/cache/`)
   - `strategy.ts`: Multi-level caching
   - See [Caching Architecture](#caching-architecture)

## Database Architecture

### Database Stack

- **Development**: SQLite 5.1 (better-sqlite3)
- **Production**: PostgreSQL via Neon Serverless
- **Connection**: Connection pooling with automatic failover
- **Migrations**: Custom migration system

### Schema Overview

**Total Tables**: 40+ tables organized into domains

#### 1. User & Authentication Domain (9 tables)

- `users`: User accounts with 2FA, SSO support
- `refresh_tokens`: JWT refresh tokens with device tracking
- `roles`: Granular role definitions
- `permissions`: Resource-action permissions
- `role_permissions`: Role-permission mapping (many-to-many)
- `user_roles`: User-role mapping with expiration
- `password_policies`: Configurable password rules
- `password_history`: Prevent password reuse
- `login_attempts`: Security audit trail

#### 2. Ticket Management Domain (6 tables)

- `tickets`: Core ticket entity
- `comments`: Ticket discussions
- `attachments`: File uploads
- `ticket_templates`: Reusable ticket templates
- `categories`: Ticket categorization
- `priorities`: Priority levels (low, medium, high, critical)
- `statuses`: Ticket lifecycle states

#### 3. SLA & Escalation Domain (3 tables)

- `sla_policies`: Service level agreements
- `sla_tracking`: SLA compliance tracking
- `escalations`: Automated escalations

#### 4. Multi-Tenant Domain (3 tables)

- `organizations`: Tenant organizations
- `departments`: Organizational structure
- `user_departments`: User-department relationships

#### 5. Analytics Domain (4 tables)

- `analytics_daily_metrics`: Aggregated daily stats
- `analytics_agent_metrics`: Agent performance
- `analytics_events`: Event tracking
- `analytics_realtime_metric`: Real-time dashboards

#### 6. AI/ML Domain (4 tables)

- `ai_classifications`: Ticket categorization results
- `ai_suggestions`: Solution recommendations
- `ai_training_data`: ML training dataset
- `vector_embeddings`: Semantic search vectors

#### 7. Workflow Domain (6 tables)

- `workflows`: Workflow definitions
- `workflow_steps`: Step configurations
- `workflow_executions`: Execution logs
- `workflow_step_executions`: Step-level logs
- `approvals`: Approval requests
- `approval_history`: Approval audit trail

#### 8. Integration Domain (4 tables)

- `integrations`: External system connections
- `integration_logs`: Integration execution logs
- `webhooks`: Outbound webhooks
- `webhook_deliveries`: Delivery tracking

#### 9. Notifications Domain (2 tables)

- `notifications`: User notifications
- `notification_events`: Real-time event stream

#### 10. Audit & Compliance (3 tables)

- `audit_logs`: System audit trail
- `auth_audit_logs`: Authentication events
- `lgpd_consents`: GDPR/LGPD consent tracking

### Database Patterns

#### 1. Soft Deletes

```sql
-- Users table has is_active flag
UPDATE users SET is_active = 0 WHERE id = ?;

-- Query only active users
SELECT * FROM users WHERE is_active = 1;
```

#### 2. Timestamps

All tables include:
```sql
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

Automatic update trigger:
```sql
CREATE TRIGGER update_users_timestamp
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

#### 3. JSON Columns

Flexible metadata storage:
```sql
-- User metadata
metadata TEXT, -- JSON object

-- Permission conditions
conditions TEXT, -- JSON for complex permission rules

-- Workflow configuration
configuration TEXT -- JSON workflow definition
```

#### 4. Foreign Key Constraints

Referential integrity:
```sql
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
```

#### 5. Indexes for Performance

Strategic indexing:
```sql
-- Frequently queried columns
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_tickets_status_priority ON tickets(status_id, priority_id);

-- Full-text search indexes (PostgreSQL)
CREATE INDEX idx_tickets_search ON tickets USING gin(to_tsvector('english', title || ' ' || description));
```

### Query Optimization

#### 1. Connection Pooling

**Location**: `lib/db/connection.ts`

```typescript
const pool: Database[] = [];
const POOL_SIZE = 10;

export function getPooledConnection<T>(
  callback: (db: Database) => T
): T {
  const db = pool.pop() || new Database(dbPath);
  try {
    return callback(db);
  } finally {
    if (pool.length < POOL_SIZE) {
      pool.push(db);
    } else {
      db.close();
    }
  }
}
```

#### 2. Prepared Statements

All queries use prepared statements:
```typescript
const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
const ticket = stmt.get(id);
```

Benefits:
- SQL injection prevention
- Query plan caching
- Parameter sanitization

#### 3. Batch Operations

```typescript
export function createTickets(tickets: CreateTicket[]): number {
  const stmt = db.prepare(`
    INSERT INTO tickets (title, description, user_id, ...)
    VALUES (?, ?, ?, ...)
  `);

  const transaction = db.transaction(() => {
    for (const ticket of tickets) {
      stmt.run(...Object.values(ticket));
    }
  });

  transaction();
  return tickets.length;
}
```

#### 4. Read Replicas

**Location**: `lib/performance/read-replicas.ts`

- Write operations: Primary database
- Read operations: Read replicas
- Automatic failover to primary if replica unavailable

## Caching Architecture

### Multi-Level Caching Strategy

**Location**: `lib/cache/strategy.ts`

```
L1: In-Memory LRU Cache (1ms latency)
  ↓ miss
L2: Redis Distributed Cache (10ms latency)
  ↓ miss
L3: CDN Edge Cache (50ms latency)
  ↓ miss
Database Query (50-200ms latency)
```

### L1: In-Memory LRU Cache

**Implementation**: `lru-cache` package

```typescript
class L1Cache {
  private cache: LRUCache<string, CacheEntry<any>>;

  constructor(maxSize = 500, maxAge = 5 * 60 * 1000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: maxAge,
      updateAgeOnGet: true
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && !isExpired(entry)) {
      return entry.data as T;
    }
    return null;
  }
}
```

**Characteristics**:
- **Size**: 500 items per instance
- **TTL**: 5 minutes
- **Eviction**: LRU (Least Recently Used)
- **Scope**: Per Node.js process
- **Use Cases**: Hot data, user sessions, frequently accessed entities

### L2: Redis Distributed Cache

**Implementation**: ioredis

```typescript
class L2Cache {
  private redis: Redis;

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (data) {
      const entry: CacheEntry<T> = JSON.parse(data);
      if (!isExpired(entry)) {
        return entry.data;
      }
    }
    return null;
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags: []
    };
    await this.redis.setex(key, ttl, JSON.stringify(entry));
  }
}
```

**Characteristics**:
- **Size**: 10GB memory
- **TTL**: Configurable per key
- **Persistence**: RDB snapshots
- **Scope**: Shared across all instances
- **Use Cases**: User sessions, API responses, database query results

### Cache Invalidation Strategies

#### 1. Tag-Based Invalidation

```typescript
// Set with tags
await cache.set('ticket:123', ticket, {
  ttl: 300,
  tags: ['tickets', 'user:456', 'org:789']
});

// Invalidate all tickets for user
await cache.invalidateByTag('user:456');
```

#### 2. TTL-Based Expiration

```typescript
// Short TTL for frequently changing data
await cache.set('analytics:realtime', data, { ttl: 60 }); // 1 minute

// Long TTL for static data
await cache.set('categories:all', categories, { ttl: 3600 }); // 1 hour
```

#### 3. Event-Driven Invalidation

```typescript
// Invalidate cache on ticket update
eventBus.on('ticket:updated', async (ticketId) => {
  await cache.delete(`ticket:${ticketId}`);
  await cache.invalidateByTag(`ticket:${ticketId}`);
});
```

### Cache Key Patterns

```typescript
export const cacheKeys = {
  tickets: {
    byId: (id: number) => `ticket:${id}`,
    list: (filters?: any) => `tickets:list:${JSON.stringify(filters)}`,
    forUser: (userId: number) => `tickets:user:${userId}`
  },
  users: {
    byId: (id: number) => `user:${id}`,
    byEmail: (email: string) => `user:email:${email}`
  },
  analytics: {
    dashboard: (orgId: number, period: string) => `analytics:dashboard:${orgId}:${period}`
  }
};
```

### Cache Metrics

```typescript
export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number; // 0-1
  avgResponseTime: number; // ms
}
```

**Typical Performance**:
- L1 hit rate: 40-60%
- L2 hit rate: 30-40%
- Overall hit rate: 85-95%
- Average response time: 5-15ms (cached), 50-200ms (uncached)

## Authentication Architecture

### JWT-Based Authentication

**Location**: `lib/auth/index.ts`, `middleware.ts`

#### Token Types

1. **Access Token** (Short-lived)
   - Lifetime: 15 minutes
   - Stored: httpOnly cookie
   - Contains: User ID, role, tenant, permissions
   - Used: Every API request

2. **Refresh Token** (Long-lived)
   - Lifetime: 7 days
   - Stored: Database + httpOnly cookie
   - Contains: Token ID, user ID
   - Used: Renew access tokens

#### Authentication Flow

```
1. User submits credentials
2. Server validates username/password
3. [Optional] 2FA verification
4. Generate access token (15m) + refresh token (7d)
5. Store refresh token in database
6. Return tokens in httpOnly cookies
7. Client includes cookies in subsequent requests
8. Middleware verifies access token
9. When access token expires, use refresh token
10. Refresh token rotation (security best practice)
```

#### JWT Payload

```typescript
interface JWTPayload {
  id: number;              // User ID
  email: string;           // Email
  role: string;            // Primary role
  organization_id: number; // Tenant ID
  tenant_slug: string;     // Tenant identifier
  name: string;            // Display name
  permissions?: string[];  // Flattened permissions
  iat: number;             // Issued at
  exp: number;             // Expires at
  iss: 'servicedesk';      // Issuer
  aud: 'servicedesk-users'; // Audience
}
```

#### Token Verification

```typescript
// middleware.ts
async function checkAuthentication(request, tenant) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return { authenticated: false };

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'servicedesk',
      audience: 'servicedesk-users'
    });

    // CRITICAL: Validate tenant matches
    if (payload.organization_id !== tenant.id) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: extractUserFromPayload(payload)
    };
  } catch (error) {
    return { authenticated: false };
  }
}
```

### Multi-Factor Authentication (2FA)

**Location**: `lib/auth/mfa-manager.ts`

#### Supported Methods

1. **TOTP (Time-based One-Time Password)**
   - Standard: RFC 6238
   - Libraries: speakeasy, otplib
   - QR Code: qrcode package
   - Validity: 30 seconds per code

2. **Backup Codes**
   - Generated: 10 codes per user
   - Single-use: Each code used once
   - Storage: Hashed in database

3. **WebAuthn / FIDO2** (Future)
   - Biometric authentication
   - Security keys (YubiKey)

#### 2FA Enrollment Flow

```
1. User enables 2FA in settings
2. Generate secret key (speakeasy)
3. Create QR code for authenticator app
4. Display QR code + manual entry code
5. User scans QR code
6. User enters verification code
7. Verify code matches
8. Generate 10 backup codes
9. Store secret (encrypted) in database
10. Mark user.two_factor_enabled = true
```

#### 2FA Login Flow

```
1. User submits credentials
2. Validate username/password
3. Check if 2FA enabled
4. If yes, return { requiresTwoFactor: true }
5. User enters TOTP code
6. Verify code or backup code
7. Generate access + refresh tokens
8. Return tokens
```

### RBAC (Role-Based Access Control)

**Location**: `lib/auth/rbac.ts`

#### Permission Model

```typescript
interface Permission {
  id: number;
  name: string;                    // 'tickets:create'
  description: string;
  resource: string;                // 'tickets'
  action: string;                  // 'create', 'read', 'update', 'delete', 'manage'
  conditions?: string;             // JSON conditions
}

interface Role {
  id: number;
  name: string;                    // 'admin', 'agent', 'user'
  display_name: string;
  is_system: boolean;              // Cannot delete
  is_active: boolean;
}
```

#### Default Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| `admin` | Full system access | System administrators |
| `manager` | Team management, reports | Team leads, managers |
| `agent` | Ticket handling, KB editing | Support agents |
| `user` | Create/view own tickets | End users |
| `read_only` | View-only access | Auditors, observers |
| `api_client` | Programmatic access | Integrations |

#### Permission Checking

```typescript
// Check permission
if (hasPermission(userId, 'tickets', 'update')) {
  // Allow update
}

// Check role
if (hasRole(userId, 'admin')) {
  // Allow admin action
}

// Check any role
if (hasAnyRole(userId, ['admin', 'manager'])) {
  // Allow action
}

// Middleware usage
app.use('/api/admin', requireRole('admin'));
app.use('/api/tickets', requirePermission('tickets', 'read'));
```

#### Conditional Permissions

```typescript
// Permission with conditions
const permission = {
  resource: 'tickets',
  action: 'update',
  conditions: JSON.stringify({
    owner_only: true,           // User can only update their own tickets
    department_only: true,      // Or tickets in their department
    business_hours: true        // Only during business hours
  })
};

// Evaluate conditions
const context = {
  userId: 123,
  ownerId: 123,
  userDepartment: 'support',
  resourceDepartment: 'support'
};

hasPermission(userId, 'tickets', 'update', context); // true
```

## Multi-Tenant Architecture

### Tenant Resolution

**Location**: `lib/tenant/resolver.ts`

#### Resolution Strategies (Precedence Order)

1. **Explicit Headers** (Highest priority)
   ```
   x-tenant-id: 123
   x-tenant-slug: acme
   ```
   Use case: API clients, testing

2. **Subdomain**
   ```
   https://acme.servicedesk.com
   Extracted: "acme"
   ```
   Use case: Production deployments

3. **Path Prefix**
   ```
   https://servicedesk.com/t/acme/dashboard
   Extracted: "acme"
   ```
   Use case: Shared hosting

4. **Development Default** (Localhost only)
   ```
   http://localhost:3000
   Default: First active organization
   ```
   Use case: Local development

#### Tenant Data Structure

```typescript
interface Organization {
  id: number;
  name: string;                   // "Acme Corp"
  slug: string;                   // "acme" (URL-safe)
  domain?: string;                // "acme" for acme.servicedesk.com
  settings?: string;              // JSON config
  subscription_plan: string;      // "free", "pro", "enterprise"
  subscription_status: string;    // "active", "trialing", "suspended"
  subscription_expires_at?: string;
  max_users: number;              // Plan limit
  max_tickets_per_month: number;  // Plan limit
  features?: string;              // JSON feature flags
  billing_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

#### Tenant Caching

```typescript
// Cache tenant by multiple keys
setTenantInCache(tenant: Organization) {
  cache.set(`tenant:id:${tenant.id}`, tenant, { ttl: 3600 });
  cache.set(`tenant:slug:${tenant.slug}`, tenant, { ttl: 3600 });
  if (tenant.domain) {
    cache.set(`tenant:domain:${tenant.domain}`, tenant, { ttl: 3600 });
  }
}

// Retrieve from cache
getTenantFromCache(key: string): Organization | null {
  return cache.get(key);
}
```

### Data Isolation

#### Row-Level Security

All tenant-specific tables include `organization_id`:

```sql
-- Tickets table
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  ...
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- All queries must filter by organization
SELECT * FROM tickets WHERE organization_id = ? AND id = ?;
```

#### Query Enforcement

```typescript
// Database queries automatically filter by tenant
export function getTickets(organizationId: number, userId?: number) {
  const stmt = db.prepare(`
    SELECT * FROM tickets
    WHERE organization_id = ?
      AND (? IS NULL OR user_id = ?)
    ORDER BY created_at DESC
  `);

  return stmt.all(organizationId, userId, userId) as Ticket[];
}
```

#### Middleware Enforcement

```typescript
// Middleware adds tenant context to all requests
export async function middleware(request: NextRequest) {
  const tenant = await resolveTenant(request);

  // Set tenant in response headers
  response.headers.set('x-tenant-id', tenant.id.toString());

  // Set tenant cookie for client access
  response.cookies.set('tenant-context', JSON.stringify({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name
  }));

  return response;
}
```

### Tenant Features

#### Feature Flags

```typescript
// Feature configuration per tenant
interface TenantFeatures {
  ai_classification: boolean;
  advanced_analytics: boolean;
  sso: boolean;
  api_access: boolean;
  custom_branding: boolean;
  webhooks: boolean;
  max_file_size_mb: number;
  max_api_calls_per_day: number;
}

// Check feature availability
function hasFeature(tenant: Organization, feature: string): boolean {
  const features = JSON.parse(tenant.features || '{}');
  return features[feature] === true;
}
```

#### Tenant Limits

```typescript
// Enforce plan limits
async function canCreateTicket(organizationId: number): Promise<boolean> {
  const org = await getOrganization(organizationId);
  const ticketCount = await getTicketCountThisMonth(organizationId);

  return ticketCount < org.max_tickets_per_month;
}

async function canAddUser(organizationId: number): Promise<boolean> {
  const org = await getOrganization(organizationId);
  const userCount = await getUserCount(organizationId);

  return userCount < org.max_users;
}
```

## AI/ML Components

### Ticket Classification

**Location**: `lib/ai/ticket-classifier.ts`

#### Auto-Categorization

```typescript
export async function classifyTicket(
  ticket: { title: string; description: string }
): Promise<AIClassification> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'Classify support tickets into categories...'
      },
      {
        role: 'user',
        content: `Title: ${ticket.title}\nDescription: ${ticket.description}`
      }
    ],
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);

  return {
    suggested_category: result.category,
    suggested_priority: result.priority,
    confidence_score: result.confidence,
    reasoning: result.reasoning
  };
}
```

### Sentiment Analysis

**Location**: `lib/ai/sentiment.ts`

```typescript
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'Analyze sentiment of customer messages...'
      },
      {
        role: 'user',
        content: text
      }
    ]
  });

  return {
    sentiment: 'positive' | 'neutral' | 'negative',
    score: 0.85, // -1 to 1
    urgency: 'high' | 'medium' | 'low'
  };
}
```

### Solution Suggestions

**Location**: `lib/ai/solution-suggester.ts`

#### Vector Similarity Search

```typescript
export async function suggestSolutions(ticketDescription: string) {
  // 1. Generate embedding for ticket
  const embedding = await generateEmbedding(ticketDescription);

  // 2. Find similar tickets in vector database
  const similarTickets = await findSimilarTickets(embedding, limit: 5);

  // 3. Extract solutions from similar tickets
  const solutions = similarTickets
    .filter(t => t.status === 'resolved')
    .map(t => t.resolution);

  // 4. Generate AI-powered summary
  const summary = await summarizeSolutions(solutions);

  return {
    suggestions: solutions,
    summary,
    confidence: calculateConfidence(similarTickets)
  };
}
```

## Monitoring Components

### Error Tracking (Sentry)

**Location**: `sentry.*.config.ts`

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  // Release tracking
  release: process.env.SENTRY_RELEASE,

  // Performance monitoring
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],

  // Error filtering
  beforeSend(event, hint) {
    // Don't send 404s
    if (event.exception?.values?.[0]?.type === 'NotFoundError') {
      return null;
    }
    return event;
  }
});
```

### APM Tracing (Datadog)

**Location**: `lib/monitoring/datadog-tracer.ts`

```typescript
import tracer from 'dd-trace';

tracer.init({
  service: 'servicedesk',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  logInjection: true,
  runtimeMetrics: true
});

// Custom spans
export function traceFunction(name: string, fn: Function) {
  return tracer.trace(name, fn);
}
```

### Metrics Collection (Prometheus)

**Location**: `lib/monitoring/observability.ts`

```typescript
import client from 'prom-client';

// Define metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status_code']
});

const ticketCreationCounter = new client.Counter({
  name: 'tickets_created_total',
  help: 'Total tickets created',
  labelNames: ['organization', 'category']
});

// Expose /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

### Structured Logging (Pino)

**Location**: `lib/monitoring/logger.ts`

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['password', 'token', 'secret']
});

// Usage
logger.info({ userId: 123, ticketId: 456 }, 'Ticket created');
logger.error({ error, userId: 123 }, 'Failed to create ticket');
```

## Component Integration

### Request Lifecycle

```
1. Client Request
   ↓
2. Load Balancer / Ingress (Kubernetes)
   ↓
3. Next.js Server (App Pod)
   ↓
4. Middleware Pipeline
   ├─ CSRF Validation
   ├─ Tenant Resolution (with cache check)
   ├─ Authentication (JWT verify)
   ├─ Authorization (RBAC check)
   └─ Security Headers
   ↓
5. API Route Handler
   ├─ Request Validation (Zod)
   ├─ Business Logic
   └─ Database Query
       ├─ Check L1 Cache
       ├─ Check L2 Cache (Redis)
       └─ Query Database
   ↓
6. Response
   ├─ Set Cache (L1 + L2)
   ├─ Apply Response Headers
   └─ Return JSON/HTML
   ↓
7. Client Receives Response
```

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
