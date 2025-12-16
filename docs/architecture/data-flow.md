# Data Flow Architecture

## Table of Contents

1. [Request Lifecycle](#request-lifecycle)
2. [Authentication Flow](#authentication-flow)
3. [Ticket Creation Flow](#ticket-creation-flow)
4. [SLA Tracking Flow](#sla-tracking-flow)
5. [Notification Flow](#notification-flow)
6. [Caching Flow](#caching-flow)
7. [Multi-Tenant Data Flow](#multi-tenant-data-flow)

## Request Lifecycle

### Complete Request Processing Pipeline

```mermaid
sequenceDiagram
    participant Client
    participant LB as Load Balancer
    participant MW as Middleware
    participant API as API Route
    participant Cache
    participant DB as Database
    participant Monitor as Monitoring

    Client->>LB: HTTP Request
    LB->>MW: Forward to App Pod

    rect rgb(255, 240, 240)
        Note over MW: Security Layer
        MW->>MW: 1. Validate CSRF Token
        MW->>MW: 2. Apply Security Headers
    end

    rect rgb(240, 255, 240)
        Note over MW: Tenant Resolution
        MW->>Cache: Check Tenant Cache
        alt Cache Hit
            Cache-->>MW: Tenant Data
        else Cache Miss
            MW->>DB: Query Tenant
            DB-->>MW: Tenant Data
            MW->>Cache: Store in Cache
        end
    end

    rect rgb(240, 240, 255)
        Note over MW: Authentication
        MW->>MW: Extract JWT Token
        MW->>MW: Verify Token Signature
        MW->>MW: Check Expiration
        MW->>MW: Validate Tenant Match
    end

    rect rgb(255, 255, 240)
        Note over MW: Authorization (RBAC)
        MW->>DB: Get User Permissions
        MW->>MW: Check Route Permission
    end

    MW->>API: Forward Request

    API->>API: Validate Request Body
    API->>Cache: Check Data Cache
    alt Cache Hit
        Cache-->>API: Cached Data
    else Cache Miss
        API->>DB: Execute Query
        DB-->>API: Query Result
        API->>Cache: Store Result
    end

    API->>Monitor: Log Request Metrics
    API-->>Client: JSON Response
```

### Middleware Processing Steps

```typescript
// middleware.ts - Step-by-step processing
export async function middleware(request: NextRequest) {
  const startTime = performance.now();

  // Step 1: CSRF Protection (state-changing requests)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (!validateCSRFToken(request)) {
      return errorResponse('CSRF validation failed', 403);
    }
  }

  // Step 2: Tenant Resolution
  const tenantResult = await resolveTenant({
    hostname: request.headers.get('host'),
    pathname: request.nextUrl.pathname,
    headers: Object.fromEntries(request.headers)
  });

  if (!tenantResult.tenant && requiresTenant(pathname)) {
    return redirectToTenantNotFound();
  }

  // Step 3: Authentication
  if (requiresAuth(pathname)) {
    const authResult = await checkAuthentication(request, tenantResult.tenant);

    if (!authResult.authenticated) {
      return redirectToLogin();
    }

    // Step 4: Authorization (RBAC)
    if (requiresAdminAccess(pathname)) {
      if (!checkAdminAccess(authResult.user, tenantResult.tenant)) {
        return errorResponse('Insufficient permissions', 403);
      }
    }

    // Set user context in headers
    response.headers.set('x-user-id', authResult.user.id);
    response.headers.set('x-user-role', authResult.user.role);
  }

  // Step 5: Performance Tracking
  const processingTime = performance.now() - startTime;
  response.headers.set('X-Response-Time', `${processingTime}ms`);

  // Step 6: Security Headers
  applySecurityHeaders(response);

  return response;
}
```

## Authentication Flow

### Login Flow (Without 2FA)

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API as /api/auth/login
    participant DB as Database
    participant Redis
    participant JWT

    User->>Client: Enter Email + Password
    Client->>API: POST /api/auth/login

    API->>DB: Find User by Email
    DB-->>API: User Record

    alt User Not Found
        API-->>Client: 401 Invalid Credentials
    end

    API->>API: Verify Password (bcrypt)

    alt Invalid Password
        API->>DB: Increment failed_login_attempts
        API->>DB: Create Login Attempt Log
        API-->>Client: 401 Invalid Credentials
    end

    API->>API: Check Account Status
    alt Account Locked
        API-->>Client: 403 Account Locked
    end

    API->>JWT: Generate Access Token (15m TTL)
    API->>JWT: Generate Refresh Token (7d TTL)

    API->>DB: Store Refresh Token
    API->>DB: Update last_login_at
    API->>DB: Reset failed_login_attempts
    API->>DB: Create Success Login Attempt Log

    API->>Redis: Cache User Session
    API->>Redis: Cache User Permissions

    API-->>Client: Set Auth Cookies
    Note over Client: httpOnly, secure, sameSite=lax

    API-->>Client: Return User Data + Tokens

    Client->>Client: Store User in State
    Client-->>User: Redirect to Dashboard
```

### Login Flow (With 2FA)

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API as /api/auth/login
    participant MFA as /api/auth/mfa/verify
    participant DB

    User->>Client: Enter Email + Password
    Client->>API: POST /api/auth/login

    API->>DB: Find User + Validate Password
    API->>API: Check two_factor_enabled

    alt 2FA Enabled
        API-->>Client: 200 { requiresTwoFactor: true }

        Client-->>User: Request TOTP Code
        User->>Client: Enter TOTP Code

        Client->>MFA: POST /api/auth/mfa/verify
        MFA->>MFA: Verify TOTP Code (speakeasy)

        alt Invalid TOTP
            MFA-->>Client: 401 Invalid Code
        end

        MFA->>DB: Generate Tokens
        MFA-->>Client: Return Tokens + User Data
    else 2FA Disabled
        API->>DB: Generate Tokens
        API-->>Client: Return Tokens + User Data
    end
```

### JWT Token Refresh Flow

```mermaid
sequenceDiagram
    participant Client
    participant MW as Middleware
    participant Refresh as /api/auth/refresh
    participant DB
    participant Redis

    Client->>MW: Request with Expired Access Token
    MW->>MW: Verify JWT
    MW-->>Client: 401 Token Expired

    Client->>Refresh: POST /api/auth/refresh
    Note over Client: Include refresh_token cookie

    Refresh->>Refresh: Extract Refresh Token
    Refresh->>DB: Validate Refresh Token
    DB-->>Refresh: Token Valid + User Data

    alt Refresh Token Expired or Revoked
        Refresh-->>Client: 401 Invalid Refresh Token
        Client->>Client: Clear Auth State
        Client-->>User: Redirect to Login
    end

    Refresh->>Refresh: Generate New Access Token
    Refresh->>DB: Rotate Refresh Token
    Note over Refresh: Revoke old, create new

    Refresh->>Redis: Update User Session

    Refresh-->>Client: New Access + Refresh Tokens
    Client->>Client: Update Auth State
    Client->>MW: Retry Original Request
```

## Ticket Creation Flow

### Complete Ticket Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API as /api/tickets
    participant AI as AI Classifier
    participant DB
    participant SLA as SLA Engine
    participant Notify as Notification Service
    participant WS as WebSocket

    User->>UI: Fill Ticket Form
    UI->>UI: Client Validation

    UI->>API: POST /api/tickets
    Note over API: { title, description, category?, priority? }

    API->>API: Validate Request Body (Zod)

    rect rgb(255, 250, 240)
        Note over API,AI: AI Classification (if enabled)
        API->>AI: Classify Ticket
        AI-->>API: Suggested Category + Priority + Confidence
        API->>API: Apply AI Suggestions if Confident
    end

    rect rgb(240, 255, 250)
        Note over API,DB: Database Transaction
        API->>DB: BEGIN TRANSACTION

        API->>DB: INSERT INTO tickets
        DB-->>API: Ticket ID

        API->>DB: INSERT INTO ai_classifications
        API->>DB: INSERT INTO audit_logs

        API->>DB: COMMIT TRANSACTION
    end

    rect rgb(250, 240, 255)
        Note over SLA: SLA Policy Application
        API->>SLA: Apply SLA Policy
        SLA->>DB: Find Matching SLA Policy
        DB-->>SLA: SLA Policy

        SLA->>SLA: Calculate Due Dates
        Note over SLA: response_due_at, resolution_due_at

        SLA->>DB: INSERT INTO sla_tracking
    end

    rect rgb(255, 240, 250)
        Note over Notify: Notification Dispatch
        API->>Notify: Ticket Created Event

        par Notification Channels
            Notify->>DB: Create In-App Notification
            Notify->>WS: Broadcast to Agents
            Notify->>Notify: Queue Email Notification
        end
    end

    API-->>UI: 201 Created { ticket }
    UI-->>User: Show Success + Ticket Number

    WS-->>UI: Real-time Update (other users)
```

### AI Classification Detail

```typescript
// lib/ai/ticket-classifier.ts
export async function classifyTicket(ticket: {
  title: string;
  description: string;
}): Promise<AIClassification> {
  // 1. Prepare prompt
  const prompt = `
    Classify this support ticket:
    Title: ${ticket.title}
    Description: ${ticket.description}

    Available categories: ${categories.join(', ')}
    Available priorities: Low, Medium, High, Critical

    Return JSON with:
    - category: string
    - priority: string
    - confidence: number (0-1)
    - reasoning: string
  `;

  // 2. Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a ticket classifier.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  // 3. Parse result
  const result = JSON.parse(response.choices[0].message.content);

  // 4. Store classification
  await storeClassification({
    ticket_id: ticket.id,
    model_name: 'gpt-4',
    suggested_category: result.category,
    suggested_priority: result.priority,
    confidence_score: result.confidence,
    reasoning: result.reasoning
  });

  return result;
}
```

## SLA Tracking Flow

### Automatic SLA Management

```mermaid
graph TB
    Start[Ticket Created] --> FindPolicy[Find Matching SLA Policy]

    FindPolicy --> CalcDue[Calculate Due Dates]
    Note1[Based on priority + category]

    CalcDue --> CreateTracking[Create SLA Tracking Record]

    CreateTracking --> Monitor{SLA Monitoring Loop}

    Monitor -->|Every 5 min| CheckDue{Check Due Dates}

    CheckDue -->|Response Due Soon| WarnResponse[Send Warning Notification]
    CheckDue -->|Resolution Due Soon| WarnResolution[Send Warning Notification]
    CheckDue -->|Breach Occurred| Breach[Mark SLA Breached]

    WarnResponse --> Escalate{Auto-Escalate?}
    WarnResolution --> Escalate

    Escalate -->|Yes| CreateEscalation[Create Escalation Record]
    Escalate -->|No| Monitor

    CreateEscalation --> AssignSenior[Assign to Senior Agent]
    AssignSenior --> NotifyManager[Notify Manager]
    NotifyManager --> Monitor

    Breach --> UpdateMetrics[Update SLA Metrics]
    UpdateMetrics --> Monitor

    TicketResolved[Ticket Resolved] --> FinalCheck[Calculate Actual Times]
    FinalCheck --> UpdateTracking[Update SLA Tracking]
    UpdateTracking --> MarkCompliance{SLA Met?}

    MarkCompliance -->|Yes| GoodMetrics[Increment Success Count]
    MarkCompliance -->|No| BadMetrics[Increment Breach Count]

    style Start fill:#e1f5ff
    style Breach fill:#ffebee
    style GoodMetrics fill:#e8f5e9
    style BadMetrics fill:#ffebee
```

### SLA Calculation Logic

```typescript
// lib/workflow/automation-engine.ts
export async function applySLAPolicy(ticket: Ticket) {
  // 1. Find matching SLA policy
  const policy = await getSLAPolicy(ticket.priority_id, ticket.category_id);

  if (!policy) {
    // No SLA policy for this combination
    return;
  }

  // 2. Calculate due dates
  const now = new Date();
  const response_due_at = addMinutes(now, policy.response_time_minutes);
  const resolution_due_at = addMinutes(now, policy.resolution_time_minutes);

  // Handle business hours
  if (policy.business_hours_only) {
    response_due_at = nextBusinessTime(response_due_at);
    resolution_due_at = nextBusinessTime(resolution_due_at);
  }

  // 3. Create SLA tracking record
  await createSLATracking({
    ticket_id: ticket.id,
    sla_policy_id: policy.id,
    response_due_at,
    resolution_due_at,
    escalation_due_at: policy.escalation_time_minutes
      ? addMinutes(now, policy.escalation_time_minutes)
      : null
  });

  // 4. Schedule SLA monitoring job
  await scheduleSLACheck(ticket.id, response_due_at, resolution_due_at);
}
```

## Notification Flow

### Multi-Channel Notification System

```mermaid
graph TB
    Event[Notification Event] --> Filter{Smart Filtering}

    Filter -->|User Preferences| CheckPrefs[Check User Preferences]
    Filter -->|Quiet Hours| CheckQuiet[Check Quiet Hours]
    Filter -->|Deduplication| CheckDupe[Check Recent Similar]

    CheckPrefs --> ShouldSend{Should Send?}
    CheckQuiet --> ShouldSend
    CheckDupe --> ShouldSend

    ShouldSend -->|Yes| Batch{Batching Enabled?}
    ShouldSend -->|No| Skip[Skip Notification]

    Batch -->|Yes| AddBatch[Add to Batch Queue]
    Batch -->|No| Channels[Select Channels]

    AddBatch -->|Batch Full or Timeout| Channels

    Channels --> InApp[In-App Notification]
    Channels --> Email[Email Queue]
    Channels --> Push[Push Notification]
    Channels --> WS[WebSocket]

    InApp --> DB[(Database)]
    Email --> BullQueue[Bull Queue]
    Push --> PushService[Push Service]
    WS --> SocketIO[Socket.io]

    BullQueue --> EmailWorker[Email Worker]
    EmailWorker --> SMTP[SMTP Server]

    WS --> ConnectedClients[Connected Clients]

    DB --> Track[Track Delivery]
    SMTP --> Track
    PushService --> Track
    SocketIO --> Track

    style Event fill:#e3f2fd
    style Skip fill:#ffebee
    style Track fill:#e8f5e9
```

### Notification Channel Selection

```typescript
// lib/notifications/channels.ts
export async function sendNotification(notification: Notification) {
  const user = await getUser(notification.user_id);
  const preferences = await getUserNotificationPreferences(user.id);

  // Smart filtering
  if (await shouldSkipNotification(notification, preferences)) {
    return;
  }

  // Channel selection based on preferences
  const channels: NotificationChannel[] = [];

  // In-app (always)
  channels.push('in_app');

  // Email (if enabled and not in quiet hours)
  if (preferences.email_enabled && !isQuietHours(user.timezone)) {
    channels.push('email');
  }

  // Push (if enabled and device registered)
  if (preferences.push_enabled && await hasRegisteredDevice(user.id)) {
    channels.push('push');
  }

  // WebSocket (if user is online)
  if (await isUserOnline(user.id)) {
    channels.push('websocket');
  }

  // Dispatch to all selected channels
  await Promise.all(
    channels.map(channel => deliverNotification(notification, channel))
  );
}
```

## Caching Flow

### Multi-Level Cache Strategy

```mermaid
graph TB
    Request[Data Request] --> CheckL1{Check L1 Cache}

    CheckL1 -->|Hit| L1Hit[Return from L1]
    CheckL1 -->|Miss| CheckL2{Check L2 Cache}

    CheckL2 -->|Hit| L2Hit[Return from L2]
    CheckL2 -->|Miss| FetchDB[Query Database]

    L2Hit --> PromoteL1[Promote to L1]
    PromoteL1 --> Return[Return Data]

    FetchDB --> StoreL2[Store in L2]
    StoreL2 --> StoreL1[Store in L1]
    StoreL1 --> Return

    L1Hit --> Return
    Return --> RecordMetrics[Record Cache Metrics]

    RecordMetrics --> End[End]

    style L1Hit fill:#c8e6c9
    style L2Hit fill:#fff9c4
    style FetchDB fill:#ffccbc
```

### Cache-Aside Pattern Implementation

```typescript
// lib/cache/strategy.ts
export class CacheStrategy {
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try L1 cache (in-memory LRU)
    const l1Result = this.l1.get<T>(key);
    if (l1Result !== null) {
      this.recordHit('l1');
      return l1Result;
    }

    // Try L2 cache (Redis)
    const l2Result = await this.l2.get<T>(key);
    if (l2Result !== null) {
      // Promote to L1
      this.l1.set(key, l2Result, options);
      this.recordHit('l2');
      return l2Result;
    }

    // Cache miss - fetch from source
    this.recordMiss();
    const data = await fetcher();

    // Store in both cache levels
    await this.set(key, data, options);

    return data;
  }

  async set<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    // Set in L1 (sync)
    this.l1.set(key, data, options);

    // Set in L2 (async)
    await this.l2.set(key, data, options);

    // Tag-based invalidation support
    if (options.tags) {
      await this.indexTags(key, options.tags);
    }
  }
}
```

### Cache Invalidation Patterns

```typescript
// Event-driven cache invalidation
eventBus.on('ticket:updated', async (ticketId, organizationId) => {
  // Invalidate specific ticket
  await cache.delete(`ticket:${ticketId}`);

  // Invalidate by tags
  await cache.invalidateByTag(`org:${organizationId}:tickets`);
  await cache.invalidateByTag(`ticket:${ticketId}`);

  // Invalidate list views
  await cache.invalidateByPattern(`tickets:list:*`);
});

eventBus.on('user:role-changed', async (userId) => {
  // Invalidate user permissions cache
  await cache.delete(`user:${userId}:permissions`);
  await cache.delete(`user:${userId}:roles`);
});
```

## Multi-Tenant Data Flow

### Tenant Resolution Pipeline

```mermaid
sequenceDiagram
    participant Request
    participant MW as Middleware
    participant Cache
    participant DB

    Request->>MW: HTTP Request

    rect rgb(240, 255, 240)
        Note over MW: Strategy 1: Headers
        MW->>MW: Check x-tenant-id header
        alt Header Present
            MW->>Cache: Check Cache
            alt Cache Hit
                Cache-->>MW: Tenant Data
            else Cache Miss
                MW->>DB: Query by ID
                DB-->>MW: Tenant Data
                MW->>Cache: Store
            end
        end
    end

    rect rgb(255, 250, 240)
        Note over MW: Strategy 2: Subdomain
        MW->>MW: Extract Subdomain
        Note over MW: "acme" from "acme.servicedesk.com"
        alt Subdomain Valid
            MW->>Cache: Check Cache
            alt Cache Hit
                Cache-->>MW: Tenant Data
            else Cache Miss
                MW->>DB: Query by Domain
                DB-->>MW: Tenant Data
                MW->>Cache: Store
            end
        end
    end

    rect rgb(255, 240, 250)
        Note over MW: Strategy 3: Path
        MW->>MW: Extract from Path
        Note over MW: "acme" from "/t/acme/..."
        alt Path Valid
            MW->>Cache: Check Cache
            alt Cache Hit
                Cache-->>MW: Tenant Data
            else Cache Miss
                MW->>DB: Query by Slug
                DB-->>MW: Tenant Data
                MW->>Cache: Store
            end
        end
    end

    alt Tenant Found
        MW->>MW: Set Tenant Context
        MW->>Request: Add Tenant Headers
    else No Tenant Found
        MW-->>Request: Redirect to Error Page
    end
```

### Tenant Data Isolation

```typescript
// All database queries automatically filtered by organization_id

// Example: Get tickets (automatically filtered)
export function getTickets(organizationId: number, filters?: TicketFilters) {
  const stmt = db.prepare(`
    SELECT t.*
    FROM tickets t
    WHERE t.organization_id = ?
      AND (? IS NULL OR t.status_id = ?)
      AND (? IS NULL OR t.priority_id = ?)
      AND (? IS NULL OR t.assigned_to = ?)
    ORDER BY t.created_at DESC
  `);

  return stmt.all(
    organizationId,
    filters?.status_id, filters?.status_id,
    filters?.priority_id, filters?.priority_id,
    filters?.assigned_to, filters?.assigned_to
  ) as Ticket[];
}

// Middleware enforcement - sets organization context
export async function middleware(request: NextRequest) {
  const tenant = await resolveTenant(request);

  // CRITICAL: Set tenant context for all downstream operations
  request.headers.set('x-organization-id', tenant.id.toString());

  // All API routes can access via:
  // const orgId = parseInt(request.headers.get('x-organization-id'));
}
```

## Performance Metrics

### Typical Response Times

| Operation | L1 Cache | L2 Cache | Database | Total |
|-----------|----------|----------|----------|-------|
| Get Ticket | 0.5ms | 8ms | 45ms | 0.5-45ms |
| List Tickets | 1ms | 12ms | 80ms | 1-80ms |
| Create Ticket | N/A | N/A | 50ms | 50ms |
| User Login | 2ms | 15ms | 120ms | 2-120ms |
| Get Categories | 0.3ms | 5ms | 20ms | 0.3-20ms |

### Cache Hit Rates (Target)

- **L1 Cache**: 40-60% hit rate
- **L2 Cache**: 30-40% hit rate
- **Overall**: 85-95% cache hit rate
- **Average Response**: 5-15ms (cached), 50-200ms (uncached)

### Database Query Performance

- **Simple Queries** (<100 rows): < 50ms
- **Complex Queries** (joins, aggregations): < 200ms
- **Analytics Queries**: < 500ms
- **Batch Operations**: < 1s (1000 records)

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
