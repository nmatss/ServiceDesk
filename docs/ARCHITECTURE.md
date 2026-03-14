---

# ServiceDesk Application - Comprehensive Architecture Document

## Overview

**ServiceDesk** is an enterprise-grade ITSM (IT Service Management) application built with Next.js 15, TypeScript, and PostgreSQL/Supabase. It implements ITIL processes (Problem, Change, CMDB, Service Catalog, CAB), multi-tenant architecture, role-based access control, real-time notifications via Socket.io, and extensive security hardening.

**Current Status (March 2026):**
- Build: SUCCESS (0 TypeScript errors)
- API Routes: 195 (352 HTTP handlers)
- Pages: 76
- Components: 170 (123 in src/, 50 UI components)
- Database Tables: 119
- Database Indexes: 365
- Database Triggers: 59

---

## Part 1: Technology Stack

### Core Framework & Runtime
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.5.4 | React meta-framework with App Router |
| `react` | ^18 | UI library |
| `react-dom` | ^18 | React DOM rendering |
| `typescript` | ^5 | Type safety and compile-time checking |

### Database & ORM
| Package | Version | Purpose |
|---------|---------|---------|
| `better-sqlite3` | ^9.6.0 | SQLite3 for development (sync API) |
| `sqlite` | ^5.1.1 | SQLite driver (alternative) |
| `pg` | ^8.16.3 | PostgreSQL driver for production (async/pooling) |
| `ioredis` | ^5.8.0 | Redis client for caching and rate limiting |

### Authentication & Security
| Package | Version | Purpose |
|---------|---------|---------|
| `jose` | ^6.1.0 | JWT creation/verification (Edge compatible) |
| `jsonwebtoken` | ^9.0.2 | Alternative JWT handling |
| `bcryptjs` | ^3.0.3 | Password hashing (bcrypt) |
| `otplib` | ^12.0.1 | TOTP/HOTP for MFA |
| `speakeasy` | ^2.0.0 | Alternative OTP library |
| `helmet` | ^8.1.0 | Security headers middleware |

### UI & Components
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.3.0 | Utility-first CSS framework |
| `@tailwindcss/forms` | ^0.5.10 | Form component styles |
| `@tailwindcss/typography` | ^0.5.19 | Prose styling |
| `@tailwindcss/aspect-ratio` | ^0.4.2 | Aspect ratio utility |
| `@headlessui/react` | ^2.2.9 | Accessible headless components |
| `@heroicons/react` | ^2.2.0 | Hero icons set |
| `lucide-react` | ^0.544.0 | Additional icon library |
| `framer-motion` | ^12.23.22 | Animation library |
| `react-hot-toast` | ^2.6.0 | Toast notifications |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` | ^2.1.1 | Conditional class composition |
| `tailwind-merge` | ^3.3.1 | Intelligent Tailwind class merging |

### Data Visualization & Charts
| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | ^3.2.1 | React charting library |
| `d3` | ^7.9.0 | Data visualization toolkit |
| `html2canvas` | ^1.4.1 | Canvas screenshot rendering |

### Workflow & UI Builders
| Package | Version | Purpose |
|---------|---------|---------|
| `reactflow` | ^11.11.4 | Node/edge graph editor (workflows) |
| `@reactflow/core` | ^11.11.4 | Core reactflow library |
| `@reactflow/background` | ^11.3.14 | Background rendering |
| `@reactflow/controls` | ^11.2.14 | UI controls for graphs |
| `@reactflow/minimap` | ^11.7.14 | Minimap visualization |
| `@reactflow/node-resizer` | ^2.2.14 | Node resize handling |
| `react-grid-layout` | ^1.5.3 | Dashboard grid layout |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop primitives |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable list functionality |
| `@dnd-kit/utilities` | ^3.2.2 | Utilities for dnd-kit |

### Document Processing & Export
| Package | Version | Purpose |
|---------|---------|---------|
| `exceljs` | ^4.1.1 | Excel file generation/parsing |
| `jspdf` | ^4.2.0 | PDF generation |
| `jspdf-autotable` | ^5.0.2 | PDF table plugin |
| `sharp` | ^0.34.4 | Image processing and resizing |

### Email & Communication
| Package | Version | Purpose |
|---------|---------|---------|
| `nodemailer` | ^7.0.6 | Email sending (SMTP) |
| `imapflow` | ^1.1.1 | IMAP email client |
| `mailparser` | ^3.9.0 | Email parsing |

### AI & NLP
| Package | Version | Purpose |
|---------|---------|---------|
| `openai` | ^4.104.0 | OpenAI API client (ChatGPT, embeddings) |

### Real-Time & WebSockets
| Package | Version | Purpose |
|---------|---------|---------|
| `socket.io` | ^4.8.1 | Real-time communication server |
| `socket.io-client` | ^4.8.1 | Real-time client |

### Monitoring & Error Tracking
| Package | Version | Purpose |
|---------|---------|---------|
| `@sentry/nextjs` | ^7.120.4 | Error tracking and APM |
| `winston` | ^3.18.3 | Structured logging |
| `prom-client` | ^15.1.3 | Prometheus metrics exposure |

### Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.13.2 | HTTP client |
| `compression` | ^1.8.1 | gzip/brotli compression middleware |
| `date-fns` | ^4.1.0 | Date manipulation library |
| `fuse.js` | ^7.1.0 | Fuzzy search library |
| `handlebars` | ^4.7.8 | Template engine |
| `isomorphic-dompurify` | ^2.16.0 | XSS sanitization (browser/Node) |
| `lru-cache` | ^10.4.3 | LRU in-memory cache |
| `qrcode` | ^1.5.4 | QR code generation |
| `slugify` | ^1.6.6 | URL-safe string conversion |
| `uuid` | ^13.0.0 | UUID generation |
| `web-push` | ^1.0.2 | Web push notification API |
| `zod` | ^4.1.11 | Schema validation and TypeScript inference |
| `dotenv` | ^17.3.1 | Environment variable loading |
| `bull` | ^4.16.5 | Job queue (Redis-backed) |

### Job Queue & Task Processing
| Package | Version | Purpose |
|---------|---------|---------|
| `bull` | ^4.16.5 | Background job queue |

### Testing & QA
| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^3.2.4 | Unit test runner (Vite-native) |
| `@vitest/ui` | ^3.2.4 | Vitest UI dashboard |
| `@vitest/coverage-v8` | ^4.0.18 | Code coverage reporting |
| `@playwright/test` | ^1.57.0 | E2E testing framework |
| `msw` | ^2.11.3 | Mock Service Worker (API mocking) |
| `@testing-library/react` | ^16.3.0 | React component testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM matchers |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `happy-dom` | ^20.0.11 | Lightweight DOM implementation |
| `@axe-core/playwright` | ^4.11.0 | Accessibility testing |
| `axe-playwright` | ^2.2.2 | Axe integration for Playwright |
| `axe-html-reporter` | ^2.2.11 | Accessibility report generation |

### Linting & Code Quality
| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^10.0.1 | Linting |
| `@typescript-eslint/eslint-plugin` | ^6.15.0 | TypeScript ESLint rules |
| `@typescript-eslint/parser` | ^6.15.0 | TypeScript parser for ESLint |
| `eslint-config-next` | ^12.0.4 | Next.js ESLint config |

### Build & Performance
| Package | Version | Purpose |
|---------|---------|---------|
| `@next/bundle-analyzer` | ^15.5.4 | Bundle size analysis |
| `webpack-bundle-analyzer` | ^4.10.2 | Webpack bundle visualization |
| `critters` | ^0.0.23 | Critical CSS extraction |
| `autoprefixer` | ^10.0.1 | CSS vendor prefixing |
| `postcss` | ^8 | CSS transformation |
| `tsx` | ^4.20.6 | TypeScript executor (Node scripts) |

### Development Tools
| Package | Version | Purpose |
|---------|---------|---------|
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^18 | React type definitions |
| `@types/react-dom` | ^18 | React DOM type definitions |
| `@types/bcryptjs` | ^2.4.6 | bcryptjs types |
| `@types/better-sqlite3` | ^7.6.13 | better-sqlite3 types |
| `@types/bull` | ^4.10.4 | bull types |
| `@types/compression` | ^1.8.1 | compression types |
| `@types/d3` | ^7.4.3 | D3 types |
| `@types/html2canvas` | ^0.5.35 | html2canvas types |
| `@types/jsonwebtoken` | ^9.0.10 | JWT types |
| `@types/nodemailer` | ^7.0.2 | Nodemailer types |
| `@types/pg` | ^8.15.6 | PostgreSQL types |
| `@types/qrcode` | ^1.5.5 | QR code types |
| `@types/react-grid-layout` | ^1.3.6 | React grid layout types |
| `@types/speakeasy` | ^2.0.10 | Speakeasy types |
| `@types/uuid` | ^11.0.0 | UUID types |

---

## Part 2: Backend Architecture

### 2.1 Middleware Stack

**File:** `middleware.ts`

**Purpose:** Comprehensive request processing pipeline for multi-tenant ServiceDesk

**Execution Order:**
1. Public route bypass (no auth required routes)
2. CSRF validation (POST/PUT/PATCH/DELETE)
3. Tenant resolution (headers > subdomain > path > dev default)
4. JWT authentication verification
5. Role-based authorization checks
6. Performance optimizations (caching, compression)
7. Security headers application

**Key Features:**
- **Multi-tenant Resolution:** Edge-compatible tenant extraction from headers, subdomain, or path
- **CSRF Protection:** Double Submit Cookie pattern with HMAC-SHA256
- **JWT Verification:** HS256 token validation with device fingerprinting
- **RBAC:** Role-based route protection (admin, agent, user)
- **Security Headers:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Cache Control:** Intelligent cache strategies per route type
- **Compression:** gzip/brotli compression for responses > 1KB
- **Rate Limiting:** Per-endpoint sliding window rate limiter
- **Error Capture:** Sentry integration for monitoring

**Protected Routes:**
- `/api/admin/*` — Requires admin/tenant_admin role
- `/api/admin/super/*` — Requires org 1 or super_admin role
- `/api/auth/*` — Login/register/verify (exempt from CSRF pre-auth)
- All other `/api/*` routes — Require valid JWT and tenant isolation

---

### 2.2 Database Adapter Pattern

**File:** `lib/db/adapter.ts`

**Purpose:** Unified abstraction layer supporting both SQLite (dev) and PostgreSQL (prod)

**Architecture:**
```
┌─────────────────────────────────────┐
│   Application Layer (API routes)    │
│   (uses executeQuery/executeRun)    │
└────────────────┬────────────────────┘
                 │
         ┌───────▼──────────┐
         │ Adapter (config) │
         └───────┬──────────┘
                 │
        ┌────────┴────────┐
        │                 │
   SQLite Adapter    PostgreSQL Adapter
   (sync/direct)     (async/pooling)
```

**Core Methods:**
- `executeQuery<T>(sql, params): Promise<T[]>` — SELECT returning typed array
- `executeQueryOne<T>(sql, params): Promise<T | undefined>` — Single result
- `executeRun(sql, params): Promise<RunResult>` — INSERT/UPDATE/DELETE
- `executeTransaction<T>(callback): Promise<T>` — Transactional isolation

**Database Type Selection:**
- **Development:** `DB_TYPE=sqlite` (default) — better-sqlite3
- **Production:** `DB_TYPE=postgresql` — pg client with connection pooling

**Dialect-Aware SQL Helpers (16 total):**
- `sqlNow()` — Current timestamp (SQLite: `CURRENT_TIMESTAMP`, PG: `NOW()`)
- `sqlDateSub()`, `sqlDateAdd()` — Date arithmetic
- `sqlDateDiff()` — Date difference calculation
- `sqlGroupConcat()` — String aggregation
- `sqlStartOfMonth()`, `sqlExtractHour()`, etc. — Date functions
- `sqlCastDate()`, `sqlColAddMinutes()` — Type conversions
- `getDatabaseType()` — Returns 'sqlite' | 'postgresql'

**Key Design Patterns:**
- All database access goes through adapter (zero direct SQLite in production)
- PostgreSQL connection pooling for scalability (pooler.supabase.com)
- Transaction callbacks must use provided `db` parameter (critical for PG)
- Type-safe queries with TypeScript generics

---

### 2.3 Database Configuration

**File:** `lib/db/config.ts`

**Environment Variables:**
```
DB_TYPE=sqlite|postgresql
DATABASE_URL=postgresql://...  (production)
POSTGRES_HOST=...
POSTGRES_PORT=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
```

**Supabase Configuration (Production):**
- Project ref: `gwctdzjptvzxukobiydx`
- Region: `us-east-2`
- Pooler host: `aws-1-us-east-2.pooler.supabase.com` (NOT aws-0)
- Session mode: Port 5432 | Transaction mode: Port 6543
- SSL auto-detected for pooler compatibility

---

### 2.4 Authentication System

**JWT Token Management** (`lib/auth/token-manager.ts`)

**Token Configuration:**
- **Access Token:** 15 minutes (httpOnly cookie)
- **Refresh Token:** 7 days (httpOnly cookie)
- **Algorithm:** HS256
- **Signing:** jose library (Edge compatible)

**Token Payload:**
```typescript
{
  user_id: number,
  tenant_id: number,
  name: string,
  email: string,
  role: string,
  tenant_slug: string,
  device_fingerprint?: string
}
```

**Security Features:**
- Device fingerprinting for token binding
- Automatic token rotation on refresh
- Token revocation support (refresh_tokens table)
- Secure cookie storage with httpOnly flag
- SameSite=Strict for CSRF protection

---

### 2.5 RBAC (Role-Based Access Control)

**File:** `lib/auth/roles.ts`

**Role Hierarchy:**
```
super_admin (org 1 only)
  ├─ admin (full org access)
  │  ├─ tenant_admin (tenant-scoped)
  │  │  ├─ team_manager (team-scoped)
  │  │  │  ├─ agent (ticket management)
  │  │  │  │  └─ user (basic access)
```

**6 Roles, 29 Permissions:**
| Role | Scope | Capabilities |
|------|-------|--------------|
| `super_admin` | Cross-tenant | System settings, org management, user admin |
| `admin` | Organization | All tickets, reports, integrations, settings |
| `tenant_admin` | Tenant | Tenant configuration, team management |
| `team_manager` | Team | Team tickets, assignments, performance |
| `agent` | Assigned tickets | Respond, assign, escalate |
| `user` | Own tickets | Create, view own tickets |

**Helper Functions:**
- `isAdmin(role)` — Checks admin-level access
- `isAgent(role)` — Checks agent role
- `isPrivileged(role)` — Checks if admin or agent
- `canManageTickets(role)` — Checks ticket management capability

---

### 2.6 Auth Guard Pattern

**File:** `lib/tenant/request-guard.ts`

**Unified Guard Function:**
```typescript
function requireTenantUserContext(request: NextRequest, options?: {
  requireRoles?: string[]
}): GuardResult
```

**Return Value (Success):**
```typescript
{
  auth: {
    userId: number,
    organizationId: number,
    role: string,
    email: string,
    name?: string,
    tenantSlug: string
  },
  context: {
    tenant: TenantContext,
    user: UserContext
  },
  response: undefined
}
```

**Return Value (Failure):**
```typescript
{
  response: NextResponse (401 or 403)
}
```

**Usage Pattern:**
```typescript
export async function GET(request: NextRequest) {
  const { auth, response } = requireTenantUserContext(request, {
    requireRoles: ['agent', 'admin']
  });
  
  if (response) return response; // 401/403
  
  // Safe to use auth.organizationId for tenant isolation
}
```

**Security Guarantees:**
- Never falls back to default organization_id
- Validates JWT signature and expiration
- Enforces tenant isolation on every request
- Optional role-based access control

---

### 2.7 Rate Limiting

**File:** `lib/rate-limit/redis-limiter.ts`

**Algorithm:** Sliding window with circular buffer (O(1) operations)

**Predefined Limits:**
| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 | 15 minutes |
| `/api/auth/register` | 3 | 1 hour |
| `/api/auth/forgot-password` | 3 | 1 hour |
| Default API | 60 | 1 minute |
| File upload | 10 | 1 hour |

**Implementation:**
- Memory store fallback (no Redis required)
- Timestamp tracking for precise window calculation
- Scheduled cleanup (1-minute interval)
- Client IP extraction with proxy trust

---

### 2.8 Custom Server with Socket.io

**File:** `server.ts`

**Real-Time Features:**
- Live ticket updates
- Real-time notifications
- User presence tracking
- Chat and collaboration
- Workflow state synchronization

**Configuration:**
```
Port: 3000 (configurable via PORT env)
CORS: Configured for multi-tenant origins
Transports: WebSocket (primary), HTTP polling (fallback)
Timeout: 10 seconds
Max buffer: 1MB per message
```

**Signal Handling:**
- Uses `tini` for proper PID 1 signal handling
- Graceful shutdown of HTTP server
- Socket.io cleanup on exit

**Compression:**
- gzip/brotli compression for responses > 1KB
- Compression level 6 (optimal balance)
- Respects client `x-no-compression` header

---

### 2.9 API Routes

**Total: 195 routes (352 HTTP handlers)**

**Main Categories:**

| Category | Routes | Example Endpoints |
|----------|--------|------------------|
| **Authentication** | 12 | login, register, verify, SSO, MFA, refresh, GovBR |
| **Tickets** | 18 | list, create, read, update, comments, attachments, tags |
| **ITIL Problem** | 15 | problems, root causes, known errors, problem activities |
| **ITIL Change** | 12 | change requests, approvals, tasks, calendar |
| **ITIL CMDB** | 10 | configuration items, relationships, history |
| **ITIL Catalog** | 8 | service categories, items, requests |
| **ITIL CAB** | 5 | configurations, members, meetings |
| **Knowledge Base** | 20 | articles, categories, tags, search, feedback |
| **AI Features** | 9 | classification, suggestions, embeddings, training |
| **Workflows** | 14 | definitions, execution, approvals, triggers |
| **Integrations** | 25 | email, WhatsApp, ERP, banking, GovBR |
| **Analytics** | 11 | metrics, reports, real-time, agent performance |
| **Admin** | 30 | settings, users, organizations, audit, SLA, cache |
| **Super Admin** | 10 | org management, cross-tenant users, system settings |
| **Portal** | 15 | end-user ticket management, profile, preferences |
| **Notifications** | 8 | fetch, mark read, delivery, batch config |
| **Catalog** | 4 | categories, items, requests |
| **Health & Status** | 5 | liveness, readiness, startup probes |
| **Other** | 19 | comments, tags, categories, priorities, statuses, etc. |

---

### 2.10 HTTP Handlers by Route

**Total: 352 handlers** across 195 routes

**Common Handler Patterns:**
```typescript
// Pattern 1: Unified guard + adapter pattern
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  const data = await executeQuery(
    'SELECT * FROM tickets WHERE organization_id = ?',
    [auth.organizationId]
  );
  
  return apiSuccess(data);
}

// Pattern 2: Data validation with Zod
import { z } from 'zod';

const CreateTicketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().optional(),
  category_id: z.number().int().positive()
});

export async function POST(request: NextRequest) {
  const { auth, response } = requireTenantUserContext(request);
  if (response) return response;

  const body = await request.json();
  const validated = CreateTicketSchema.parse(body);
  
  // ... create logic
}
```

**Response Format:**
- Success: `{ success: true, data: T, meta?: {...} }`
- Error: `{ success: false, error: string, code?: string }`

---

## Part 3: Frontend Architecture

### 3.1 Pages (76 total)

**Directory:** `app/`

**Main Page Categories:**

| Section | Routes | Description |
|---------|--------|-------------|
| **Auth** | 4 | login, register, forgot-password, govbr |
| **Dashboard** | 3 | main, analytics, widgets |
| **Tickets** | 12 | list, detail, create, bulk-edit, kanban, timeline |
| **Knowledge** | 8 | search, articles, categories, feedback |
| **Admin** | 15 | settings, users, organizations, audit, SLA |
| **Super Admin** | 6 | dashboard, orgs, users, audit, settings |
| **ITIL Problems** | 6 | list, detail, create, root causes |
| **ITIL Changes** | 5 | list, detail, create, calendar |
| **ITIL CMDB** | 4 | list, detail, create, relationships |
| **ITIL Catalog** | 4 | categories, items, requests |
| **Workflows** | 4 | builder, list, detail, execution |
| **Portal** | 5 | home, tickets, profile, settings |
| **Other** | 5 | error pages, onboarding, landing, etc. |

---

### 3.2 Components (170 total)

**Breakdown by Category:**

| Category | Count | Location | Examples |
|----------|-------|----------|----------|
| **Workflow** | 27 | `src/components/workflow/` | NodeTypes (15), EdgeTypes (3), Builder, Panel, Sidebar |
| **Dashboard** | 24 | `src/components/dashboard/` | Widgets (12), Builder, COBIT, Analytics |
| **Mobile** | 13 | `src/components/mobile/` | Gestures, Biometrics, BottomSheet, SwipeActions |
| **Tickets** | 12 | `src/components/tickets/` | Kanban, Timeline, Editor, Form, List |
| **Charts** | 7 | `src/components/charts/` | Heatmaps, Sankey, Radar, Gauges |
| **PWA** | 6 | `src/components/pwa/` | Install, Offline, Sync |
| **Admin** | 5 | `src/components/admin/` | SuperAdminDashboard, Tables, Menus |
| **Notifications** | 4 | `src/components/notifications/` | Bell, Provider, Center, Realtime |
| **Knowledge** | 4 | `src/components/knowledge/` | Search, Articles, Feedback |
| **Gamification** | 3 | `src/components/gamification/` | Badges, Leaderboard, Recognition |
| **Layout** | 3 | `src/components/layout/` | AppLayout, Header, Sidebar |
| **Other** | 62 | `src/components/` | Auth, Problems, Search, Security, Theme, etc. |
| **UI Base** | 50 | `components/ui/` | Button, Input, Dialog, Menu, Card, etc. |

**UI Component Library (50 base components):**
- Form: Input, Textarea, FormField, Checkbox, Radio, Select, ComboBox
- Layout: Button, Card, Dialog, Dropdown, Menu, Popover, Sheet, Tabs
- Data: Table, DataTable, Pagination, Breadcrumb, List
- Feedback: Toast, Alert, Progress, Skeleton, Spinner
- Navigation: Sidebar, Header, Tabs, Breadcrumb
- Display: Badge, Tag, Avatar, Tooltip, Popover
- Accessibility: Focus trap, Keyboard nav, ARIA labels

---

### 3.3 Root Layout

**File:** `app/layout.tsx`

**Features:**
- Metadata configuration (SEO, icons, manifest)
- Viewport settings (device-width, max-scale, theme-color)
- Favicon multi-resolution support
- Apple touch icon
- PWA manifest integration
- Theme initialization script (prevents FOUC)
- Sentry client config initialization
- HTML lang="pt-BR" (Portuguese Brazil)

**Viewport Configuration:**
```typescript
{
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ]
}
```

---

### 3.4 App Shell (AppLayout)

**File:** `src/components/layout/AppLayout.tsx`

**Purpose:** Main application container with sidebar, header, navigation

**Key Features:**
- Multi-tenant awareness (header display)
- User auth state management (30s cache)
- Real-time notification polling with exponential backoff
- Sidebar toggle and mobile responsive
- Theme context provider
- Notification provider integration
- Portal outlet for modals
- Keyboard shortcuts (cmd+K for search)

**Performance Optimizations:**
- Auth verification cache (eliminates 200-400ms API calls)
- useRef to prevent duplicate /api/auth/verify calls
- Debounced resize handler (150ms)
- React.memo for sub-components
- useCallback for stable event handlers

**Menu Sections:**
- Dashboard
- Tickets
- Knowledge Base
- ITIL (Problems, Changes, CMDB, Catalog, CAB)
- Workflows
- Admin (if permitted)
- Super Admin (if org 1 or super_admin role)

---

### 3.5 Design System

**File:** `lib/design-system/tokens.ts`

**Color Palette:**

**Brand Colors** (Sky Blue):
- Primary: `#0ea5e9` (brand-500)
- Used for: CTAs, links, accents, logo

**Semantic Colors:**
- Success: Green (`#22c55e`)
- Warning: Amber (`#f59e0b`)
- Error: Red (`#ef4444`)

**Neutral Colors** (NEVER use gray):
- Used for: Backgrounds, borders, text
- Shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950

**Status Colors:**
- Open: Blue (`brand-500`)
- In Progress: Yellow (`#facc15`)
- Resolved: Green (`#22c55e`)
- Closed: Neutral (`neutral-500`)

**Priority Colors:**
- Low: Green (`#22c55e`)
- Medium: Yellow (`#facc15`)
- High: Orange (`#f97316`)
- Critical: Red (`#ef4444`)

**Typography:**
- Font family: System fonts (sans-serif, mono)
- Font sizes: 12px to 32px
- Font weights: 400, 500, 600, 700
- Line heights: 1.25 to 1.75

**Spacing:**
- Base unit: 4px (0.25rem)
- Scales: 0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64

**Dark Mode:**
- Always pair light classes with `dark:` variants
- Theme set via `<html class="dark">` or no class
- Inline script prevents flash of unstyled content

---

### 3.6 Tailwind Configuration

**File:** `tailwind.config.js`

**Content Paths (optimized for performance):**
```javascript
content: [
  './components/**/*.{js,ts,jsx,tsx,mdx}',
  './app/**/*.{js,ts,jsx,tsx,mdx}',
  './src/**/*.{js,ts,jsx,tsx,mdx}',
  './lib/design-system/**/*.{js,ts,jsx,tsx}',
  './lib/performance/**/*.{tsx}',
  './lib/pwa/**/*.{tsx}',
]
```

**Key Extensions:**
- `darkMode: 'class'` — Class-based dark mode
- Design system tokens imported from `lib/design-system/tokens.ts`
- Glassmorphism colors for modern UI
- Persona-specific variables for multi-persona design
- breakpoints from tokens (xs, sm, md, lg, xl, 2xl)

---

## Part 4: Database Architecture

### 4.1 Database Statistics

**PostgreSQL/Supabase Production Database:**
| Metric | Count |
|--------|-------|
| Tables | 119 |
| Indexes | 365 |
| Triggers | 59 |
| Foreign Keys | 84 |
| CHECK Constraints | 28 |

**SQLite Development Database:**
- Same schema structure as PostgreSQL
- File-based at `lib/db/connection.ts`
- Synchronous API for development

---

### 4.2 Table Modules (Complete List)

**119 Tables organized by functional area:**

#### Core Tenancy & Organization (6 tables)
1. `organizations` — Top-level tenants
2. `tenants` — Tenant instances
3. `teams` — Team grouping
4. `departments` — Departmental structure
5. `user_departments` — User to department mapping
6. `tenant_configurations` — Tenant-specific settings

#### Users & Authentication (15 tables)
1. `users` — User accounts with roles
2. `refresh_tokens` — Token rotation tracking
3. `permissions` — Fine-grained capabilities
4. `roles` — Role definitions
5. `role_permissions` — Role-permission mapping
6. `user_roles` — User role assignment
7. `password_policies` — Password rules
8. `password_history` — Previous passwords (prevent reuse)
9. `rate_limits` — Rate limit tracking
10. `sso_providers` — OAuth, SAML, OIDC configs
11. `login_attempts` — Failed login tracking
12. `webauthn_credentials` — Biometric auth keys
13. `verification_codes` — Email/SMS codes
14. `auth_audit_logs` — Authentication events
15. `ticket_access_tokens` — Temporary ticket access

#### Core Tickets (12 tables)
1. `categories` — Ticket categories
2. `priorities` — Priority levels
3. `statuses` — Workflow statuses
4. `tickets` — Main ticket entity
5. `comments` — Ticket discussions
6. `ticket_activities` — Audit trail
7. `tags` — Free-form labeling
8. `ticket_tags` — Ticket-tag relationships
9. `ticket_followers` — Watchers
10. `ticket_relationships` — Links between tickets
11. `attachments` — File references
12. `file_storage` — File metadata

#### SLA & Escalation (5 tables)
1. `sla_policies` — Service level agreements
2. `sla_tracking` — Per-ticket SLA tracking
3. `escalations` — Escalation events
4. `escalation_rules` — Escalation triggers
5. `escalation_instances` — Active escalations

#### Notifications (5 tables)
1. `notifications` — User notifications
2. `notification_events` — Notification triggers
3. `notification_batches` — Batch delivery
4. `batch_configurations` — Batch settings
5. `filter_rules` — Notification filters

#### Workflows (10 tables)
1. `workflow_definitions` — Template definitions
2. `workflow_executions` — Running workflows
3. `workflow_steps` — Workflow stages
4. `workflow_step_executions` — Step instances
5. `workflow_approvals` — Approval nodes
6. `workflows` — Workflow instances
7. `approvals` — Approval requests
8. `approval_history` — Approval audit
9. `approval_tokens` — Approval links
10. `automations` — Automation triggers

#### Knowledge Base (8 tables)
1. `kb_categories` — Article categorization
2. `kb_articles` — Article content
3. `kb_tags` — Article tags
4. `kb_article_tags` — Tag relationships
5. `kb_article_feedback` — User ratings
6. `kb_article_attachments` — Article files
7. `kb_article_suggestions` — AI suggestions
8. `knowledge_articles` — Alternative schema

#### Analytics (6 tables)
1. `analytics_daily_metrics` — Daily summaries
2. `analytics_agent_metrics` — Per-agent stats
3. `analytics_category_metrics` — Per-category stats
4. `analytics_realtime_metrics` — Live metrics
5. `analytics_events` — Event tracking
6. `analytics_agent_performance` — Agent KPIs

#### Multi-Tenancy (6 tables)
- `organizations` — Top-level tenants
- `tenants` — Tenant instances
- `teams` — Team grouping
- `departments` — Departmental structure
- `user_departments` — User to department mapping
- `tenant_configurations` — Tenant-specific settings

#### AI/ML (4 tables)
1. `ai_classifications` — ML classifications
2. `ai_suggestions` — AI recommendations
3. `ai_training_data` — Training dataset
4. `vector_embeddings` — Vector search

#### Integrations (10 tables)
1. `integrations` — Integration configs
2. `integration_logs` — Integration audit
3. `webhooks` — Webhook endpoints
4. `webhook_deliveries` — Webhook tracking
5. `communication_channels` — Channel configs
6. `communication_messages` — Sent messages
7. `whatsapp_contacts` — WhatsApp contacts
8. `whatsapp_sessions` — WhatsApp sessions
9. `whatsapp_messages` — WhatsApp messages
10. `govbr_integrations` — GovBR configs

#### ITIL Problem Management (6 tables)
1. `root_cause_categories` — RCA categories
2. `problems` — Problem records
3. `known_errors` — Known error database
4. `problem_incident_links` — Incident-problem mapping
5. `problem_activities` — Problem audit
6. `problem_attachments` — Problem files

#### ITIL Change Management (5 tables)
1. `change_types` — Change categorization
2. `change_requests` — Change requests
3. `change_request_approvals` — Approval workflow
4. `change_tasks` — Implementation tasks
5. `change_calendar` — Change scheduling

#### ITIL Configuration Management (7 tables)
1. `ci_types` — Configuration item types
2. `ci_statuses` — CI status values
3. `ci_relationship_types` — Relationship types
4. `configuration_items` — CIs
5. `ci_relationships` — CI relationships
6. `ci_history` — CI version history
7. `ci_ticket_links` — CI-ticket associations

#### ITIL Service Catalog (5 tables)
1. `service_categories` — Service categories
2. `service_catalog_items` — Service items
3. `service_requests` — Service requests
4. `service_request_approvals` — Approvals
5. `service_request_tasks` — Implementation tasks

#### ITIL Change Advisory Board (3 tables)
1. `cab_configurations` — CAB settings
2. `cab_members` — CAB membership
3. `cab_meetings` — CAB meetings

#### Audit & Compliance (4 tables)
1. `audit_logs` — Activity audit trail
2. `audit_advanced` — Advanced audit data
3. `api_usage_tracking` — API call tracking
4. `user_sessions` — User session history

#### Configuration & Cache (3 tables)
1. `system_settings` — Key-value settings
2. `ticket_templates` — Template library
3. `cache` — Cache table

#### Other (8 tables)
1. `satisfaction_surveys` — NPS/CSAT
2. `scheduled_reports` — Report scheduling
3. `lgpd_consents` — LGPD/GDPR consent
4. `user_presence` — Real-time presence
5. `notification_deliveries` — Notification audit
6. Plus 3 more specialized tables

---

### 4.3 Schema Files

**SQLite Schema:** `lib/db/schema.sql`
- 3,400+ lines
- 119 table definitions
- Synchronous syntax (SQLite specific)

**PostgreSQL Schema:** `lib/db/schema.postgres.sql`
- 2,720+ lines
- Full parity with SQLite
- Async-safe syntax
- 365 indexes (vs SQLite's inline indexes)
- 59 triggers for audit and data consistency

**Seeding:**
- SQLite: `lib/db/init.ts` (TypeScript sync API)
- PostgreSQL: `lib/db/seed.postgres.sql` (SQL file)
- Both provide sample data for development/testing

---

### 4.4 Type Definitions

**File:** `lib/types/database.ts`

**Core Entity Types:**
```typescript
interface User { id, name, email, role, organization_id, is_active, ... }
interface Ticket { id, title, description, status_id, priority_id, ... }
interface Category { id, name, description, color, ... }
interface Priority { id, name, level, color, response_time, ... }
interface Status { id, name, color, is_final, ... }
interface Comment { id, ticket_id, user_id, content, created_at, ... }
// ... 119+ entity interfaces
```

**Specialized Types:**
- Create types: `Omit<Entity, 'id' | 'created_at' | 'updated_at'>`
- Update types: `Partial<Omit<Entity, 'id' | 'created_at'>> & { id: number }`
- WithDetails types: Flatten related entities via JOINs

**Field Conventions:**
- `id: number` — Auto-increment PKs
- `*_id: number` — Foreign keys
- `created_at, updated_at: string` — ISO timestamps
- `is_*: boolean` — Flags
- `JSON fields: string` — Must parse/stringify

---

## Part 5: Security Architecture

### 5.1 Security Modules (24 files)

**Directory:** `lib/security/`

| Module | Purpose |
|--------|---------|
| `csrf.ts` | CSRF token generation and validation |
| `csp.ts` | Content Security Policy headers |
| `headers.ts` | Comprehensive security headers (X-Frame-Options, X-Content-Type-Options, etc.) |
| `helmet.ts` | Helmet middleware integration |
| `encryption-manager.ts` | AES-256-GCM encryption |
| `encryption.ts` | Low-level encryption utilities |
| `session-manager.ts` | Session lifecycle management |
| `audit-logger.ts` | Security event logging |
| `input-sanitization.ts` | XSS prevention |
| `data-masking.ts` | PII redaction for logs |
| `data-protection.ts` | Sensitive data handling |
| `pii-detection.ts` | PII identification |
| `lgpd-compliance.ts` | LGPD consent tracking |
| `webhook-security.ts` | Webhook signature verification |
| `vulnerability-scanner.ts` | Dependency scanning |
| `monitoring.ts` | Security event monitoring |
| Additional: cors.ts, config.ts, index.ts, etc. |

---

### 5.2 Authentication Modules (21 files)

**Directory:** `lib/auth/`

| Module | Purpose |
|--------|---------|
| `token-manager.ts` | JWT creation, refresh, rotation |
| `mfa-manager.ts` | TOTP, SMS, Email, Backup codes |
| `biometric-auth.ts` | WebAuthn/FIDO2 |
| `password-policies.ts` | Password complexity, history, expiration |
| `rbac.ts` | Role-based access control engine |
| `rbac-engine.ts` | Advanced RBAC rules |
| `permissions.ts` | Permission definitions |
| `roles.ts` | Role constants and helpers |
| `auth-service.ts` | Main auth service |
| `sqlite-auth.ts` | SQLite auth implementation |
| `sso-manager.ts` | OAuth2, SAML, OIDC |
| `sso.ts` | SSO integrations |
| `enterprise-auth.ts` | Enterprise auth features |
| `super-admin-guard.ts` | Super admin route protection |
| `session-manager.ts` | Session tracking |
| `dynamic-permissions.ts` | Runtime permission rules |
| `data-row-security.ts` | Row-level security |
| Additional: context.ts, api-protection.ts, __tests__/ |

---

### 5.3 Implemented Protections

**Authentication & Credentials:**
- JWT: HS256, access (15min) + refresh (7d), httpOnly cookies, device fingerprinting
- Password: bcrypt 12 rounds, entropy check, dictionary validation, history (5), 90-day expiration
- MFA: TOTP + SMS + Email + Backup codes (10), HMAC-SHA256 hashed storage
- Sessions: Device tracking, concurrent session limiting, automatic expiration

**CSRF Protection:**
- Double Submit Cookie pattern with HMAC-SHA256
- Session-bound tokens, 1-hour expiry
- Validated on all state-changing requests (POST, PUT, PATCH, DELETE)
- Token rotation on successful validation

**Data Protection:**
- Encryption: AES-256-GCM with key rotation for sensitive fields
- PII Detection: Automatic identification of sensitive data
- Data Masking: Redaction in logs and audit trails
- LGPD/GDPR Compliance: Consent tracking, data portability, erasure

**Content Security:**
- CSP: Strict mode in production, Permissions-Policy, HSTS
- XSS Prevention: isomorphic-dompurify sanitization
- SQL Injection: Parameterized queries + LIKE wildcard escaping
- Input Validation: Zod schemas on all API endpoints

**Network Security:**
- HTTPS/TLS required in production
- HSTS headers (max-age 31536000)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Secure cookie flags (httpOnly, Secure, SameSite=Strict)

**Rate Limiting:**
- Per-endpoint limits (login 5/15min, register 3/hr, default 60/min)
- Sliding window with circular buffer
- Trusted client IP extraction (behind proxies)

**Tenant Isolation:**
- organization_id scoping on all queries
- JWT validation in middleware
- Never falls back to default organization_id

---

## Part 6: Library Modules Inventory

### 6.1 Library Directory Structure (49 modules)

**Core Infrastructure (11 modules):**
- `db/` — Database adapter, queries, schemas, migrations
- `config/` — Environment validation, configuration
- `tenant/` — Multi-tenancy context and guards
- `monitoring/` — Logging, Sentry, Datadog
- `health/` — Health check endpoints
- `di/` — Dependency injection
- `types/` — TypeScript interfaces
- `validation/` — Zod schemas

**Authentication & Authorization (4 modules):**
- `auth/` — Full auth system (21 files)
- `security/` — Security hardening (24 files)
- `token-manager.ts` — JWT management
- `rate-limit/` — Rate limiting

**Business Logic (15 modules):**
- `tickets/` — Ticket management
- `ai/` — AI/ML features
- `workflow/` — Workflow engine
- `analytics/` — Analytics & reporting
- `knowledge/` — Knowledge base
- `notifications/` — Real-time notifications
- `integrations/` — Email, WhatsApp, ERP, banking, GovBR
- `automations/` — Business automation
- `sla/` — SLA tracking
- `reports/` — Report generation
- `services/` — Utility services
- `repositories/` — Data repositories
- Plus 3 more specialized modules

**Performance & Caching (6 modules):**
- `cache/` — Redis caching, LRU cache
- `performance/` — Query optimization, CDN
- `pwa/` — PWA offline support
- `socket/` — Socket.io management
- `search/` — Full-text search

**Compliance & Legal (3 modules):**
- `lgpd/` — LGPD data protection
- `compliance/` — Regulatory compliance
- `audit/` — Audit logging

**UI & Content (4 modules):**
- `design-system/` — Design tokens and theming
- `email/` — Email templating
- `templates/` — Template engine
- `ui/` — UI component library
- `charts/` — Chart utilities

**Utilities (4 modules):**
- `utils/` — General utilities
- `errors/` — Error handling
- `api/` — API helpers
- `hooks/` — React hooks

---

### 6.2 API Routes by Category

**Total: 195 routes across 45 directories**

**Comprehensive API Endpoint Map:**

```
/api/
├── auth/                          (12 routes)
│   ├── login, register, verify
│   ├── refresh, logout
│   ├── profile, me
│   ├── mfa-*, sso-*
│   └── govbr/*
├── admin/                         (30 routes)
│   ├── settings, users, organizations
│   ├── audit, reports
│   ├── sla/[id], cache
│   └── super/*                    (10 routes)
│       └── dashboard, organizations, users, audit
├── tickets/                       (18 routes)
│   ├── [id], comments, attachments
│   ├── tags, categories, priorities, statuses
│   └── bulk operations, relationships
├── problems/                      (15 routes - ITIL)
│   ├── [id], known-errors, root-causes
│   ├── activities, attachments
│   └── incident-links
├── changes/                       (12 routes - ITIL)
│   ├── [id], approvals, tasks, calendar
├── cmdb/                          (10 routes - ITIL)
│   ├── [id], relationships, history, ci-types
├── catalog/                       (8 routes - ITIL)
│   ├── categories, items, requests
├── cab/                           (5 routes - ITIL)
│   ├── [id], members, meetings
├── knowledge/                     (20 routes)
│   ├── [id], articles, categories, tags
│   ├── search, feedback, suggestions
│   └── attachments
├── ai/                            (9 routes)
│   ├── classify, suggest, train, embeddings
├── workflows/                     (14 routes)
│   ├── [id], execute, approvals, definitions
├── integrations/                  (25 routes)
│   ├── email/*, whatsapp/*, erp/*, banking/*
│   └── govbr/*, webhook-manager
├── analytics/                     (11 routes)
│   ├── metrics, reports, real-time, agent-perf
├── notifications/                (8 routes)
│   ├── [id], fetch, mark-read, batch-config
├── portal/                        (15 routes)
│   ├── tickets, profile, preferences
├── health/                        (5 routes)
│   ├── live, ready, startup, metrics
└── other/                         (19 routes)
    └── comments, attachments, tags, cache, search
```

---

## Part 7: Infrastructure & Deployment

### 7.1 Docker Multi-Stage Build

**File:** `Dockerfile`

**Three Stages:**

**Stage 1: Dependencies** (Alpine Node 20)
- Install system dependencies (libc6-compat)
- Copy package.json
- `npm ci --only=production` (frozen lockfile)

**Stage 2: Builder** (Alpine Node 20)
- Install build tools (python3, make, g++)
- Install all dependencies (including devDeps)
- Copy source code
- `npm run build` → Next.js standalone output

**Stage 3: Runner** (Alpine Node 20 - final image)
- Install runtime only: tini, curl, ca-certificates, tzdata
- Create non-root user (uid 1001, gid 1001)
- Copy production dependencies from Stage 1
- Copy built app and static assets from Stage 2
- Copy database schemas (for runtime init)
- Create data directories
- Switch to non-root user
- Expose port 3000
- HEALTHCHECK: `/api/health` every 30s

**Image Size:** < 200MB
**Build Time:** < 5 minutes

**ENTRYPOINT:** tini (proper PID 1 signal handling)
**CMD:** `node server.js` (custom server with Socket.io)

---

### 7.2 Instrumentation

**File:** `instrumentation.ts`

**Initialization Sequence:**

1. **Sentry Error Tracking** (if `SENTRY_DSN` set)
   - Server-side error capture
   - Source map uploads
   - Release tracking

2. **Datadog APM** (if `DD_TRACE_ENABLED` set)
   - Request tracing
   - Database query monitoring
   - Performance metrics

3. **Cache Initialization** (non-blocking)
   - Redis connection attempt
   - Fallback to in-memory LRU
   - Fire-and-forget (no `await`)

4. **Performance Monitoring**
   - Prometheus metrics exposure
   - Custom APM instrumentation

**Key Design:**
- Fire-and-forget cache init (doesn't block startup)
- Non-blocking async operations
- Graceful degradation if external services unavailable

---

### 7.3 Sentry Configuration

**Server-Side:** `sentry.server.config.ts`
- Node.js runtime error capture
- Database performance monitoring
- Request tracing
- Custom context: user, organization, tenant

**Client-Side:** `sentry.client.config.ts`
- Browser error capture
- User interaction breadcrumbs
- Web Vitals monitoring
- Release tracking

**Configuration:**
- DSN: Environment variable `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`
- Environment: `production`, `staging`, `development`
- Enabled flag: `NEXT_PUBLIC_SENTRY_ENABLED`
- Browser tracing: Optional
- Session replay: Optional

---

## Part 8: Integration Points

### 8.1 Integration Modules

**Directory:** `lib/integrations/` (7 subdirectories)

#### Email Integration
- **Module:** `lib/integrations/email/`
- **Features:**
  - SMTP sending (Nodemailer)
  - IMAP inbox monitoring
  - Email parsing and attachment extraction
  - Template rendering (Handlebars)
  - Bounce handling
- **API Routes:** `/api/email/*`, `/api/integrations/email/*`

#### WhatsApp Integration
- **Module:** `lib/integrations/whatsapp/`
- **Features:**
  - Message sending and receiving
  - Contact management
  - Session handling
  - Template support
  - Media attachment handling
- **API Routes:** `/api/integrations/whatsapp/*`

#### ERP Integration
- **Module:** `lib/integrations/erp/`
- **Features:**
  - Enterprise Resource Planning sync
  - Inventory integration
  - Order management
  - Procurement workflows

#### Banking Integration
- **Module:** `lib/integrations/banking/`
- **Features:**
  - Payment processing
  - Account reconciliation
  - Transaction tracking
  - Compliance reporting

#### GovBR Integration
- **Module:** `lib/integrations/govbr/`
- **Features:**
  - Brazilian government authentication
  - OAuth2 authorization flow
  - Citizen data access
  - Compliance with Brazilian regulations
- **API Routes:** `/api/auth/govbr/*`

#### Webhook Manager
- **File:** `lib/integrations/webhook-manager.ts`
- **Features:**
  - Webhook registration and management
  - Signature verification
  - Delivery tracking
  - Retry logic with exponential backoff
  - Rate limiting per webhook

#### Email Automation
- **File:** `lib/integrations/email-automation.ts`
- **Features:**
  - Automated email triggers
  - Template interpolation
  - Batch processing
  - Scheduled sending

---

### 8.2 Integration API Routes

**Total: 25 routes**

```
/api/integrations/
├── email/
│   ├── send
│   ├── templates/[id]
│   ├── webhook
│   └── queue
├── whatsapp/
│   ├── send
│   ├── messages
│   ├── contacts
│   ├── sessions
│   ├── templates
│   ├── stats
│   ├── webhook
│   └── test
├── [custom-integration]/
│   └── ...

/api/auth/govbr/
├── authorize
├── callback
└── refresh

/api/email/ (legacy)
├── send
└── queue/
```

---

## Part 9: Performance Optimizations

### 9.1 Caching Strategies

**Level 1: Browser Cache**
- Static assets: 1 year immutable
- API responses: Cache-Control headers per route

**Level 2: In-Memory Cache (30s)**
- Auth verification (eliminates 200-400ms API calls)
- User context
- Populated via `populateAuthCache()`

**Level 3: Redis Cache**
- Session data
- Rate limit tracking
- Notification batches
- Search indexes
- Graceful fallback to memory if Redis unavailable

**Level 4: Database Indexes**
- 365 indexes on PostgreSQL
- Strategy: Equality (org_id), range (created_at), composite (org_id + status_id)

---

### 9.2 Query Optimization

**N+1 Query Prevention:**
- 5+ JOINs in complex queries (problems, changes, CMDB)
- Batch loading with `IN (?)` clauses
- Promise.all for parallel queries

**Pagination:**
- Limit cap: 100 results per page
- Cursor-based for large datasets
- LIMIT + OFFSET for traditional pagination

**Database Dialect Helpers:**
- Cross-DB compatibility without duplication
- Query plans identical on SQLite and PostgreSQL

---

### 9.3 Frontend Optimizations

**Bundle Splitting:**
- Code splitting for admin, charts, editors, PDF/Excel
- Lazy loading with React.lazy + Suspense
- Tree-shaking: 6+ packages in optimizePackageImports

**Component Optimization:**
- React.memo for expensive components
- useCallback for stable event handlers
- useMemo for derived state
- NotificationProvider moved inside auth boundary

**Network Optimization:**
- Middleware caching for static assets
- gzip/brotli compression (threshold 1KB)
- Exponential backoff for notification polling
- Fetch interceptor with stable dependencies

**Lighthouse Scores:**
- Performance: 92-95/100
- Mobile: 90-95/100
- TTFB: 300-450ms
- LCP: 2.1s (Good)
- FID: 85ms (Good)
- CLS: 0.05 (Good)

---

### 9.4 Database Performance

**Query Average:** 45ms
**Indexes:** 365 (vs 150+ for typical apps)
**Triggers:** 59 (for audit, data consistency, SLA tracking)

**Optimizations:**
- Connection pooling (6543 transaction mode, 5432 session mode)
- Query result caching (warm cache)
- Prepared statements for frequently used queries
- Batch operations (INSERT/UPDATE multiple rows)

---

## Part 10: Testing Infrastructure

### 10.1 Testing Framework

**Test Runners:**
- **Unit Tests:** Vitest (Vite-native, fast)
- **E2E Tests:** Playwright (cross-browser, multi-device)
- **A11y Tests:** Axe-core + Playwright
- **Security Tests:** Vitest + OWASP checks

**Coverage:**
- Target: 80%+ coverage on critical paths
- `npm run test:unit:coverage` — Code coverage report
- HTML report at `coverage/index.html`

---

### 10.2 Test Types

**Unit Tests** (`npm run test:unit`)
- API route handlers
- Database queries
- Auth functions
- Security utilities
- Date/time utilities
- Validation schemas

**Integration Tests** (`npm run test:integration`)
- Auth workflows
- Ticket creation/update
- Knowledge base operations
- Admin functions
- Multi-tenant isolation

**E2E Tests** (`npm run test:e2e`)
- Complete user journeys
- Auth flow (login, MFA, SSO)
- Ticket management
- Admin panel
- Role-based access

**A11y Tests** (`npm run test:a11y`)
- Automated checks (Axe)
- Keyboard navigation
- Screen reader compatibility
- Color contrast
- Form accessibility
- Mobile accessibility

**Security Tests** (`npm run test:security`)
- OWASP Top 10
- JWT validation
- Rate limiting
- Input validation
- CSRF protection
- SQL injection prevention

---

### 10.3 Test Commands

```bash
npm run test                           # Unit + E2E
npm run test:unit                      # Unit tests only
npm run test:unit:watch                # Watch mode
npm run test:unit:ui                   # UI dashboard
npm run test:unit:coverage             # Coverage report

npm run test:integration               # Integration suite
npm run test:integration:auth           # Auth tests
npm run test:integration:tickets        # Ticket tests
npm run test:integration:knowledge      # KB tests
npm run test:integration:admin          # Admin tests

npm run test:e2e                       # Full E2E
npm run test:e2e:watch                 # Watch mode
npm run test:e2e:ui                    # UI dashboard
npm run test:e2e:headed                # Browser visible
npm run test:e2e:debug                 # Debugger attached
npm run test:e2e:[specific]            # Auth, tickets, admin, rbac, mobile, errors

npm run test:a11y                      # A11y suite
npm run test:a11y:report               # A11y report
npm run test:a11y:automated            # Automated checks
npm run test:a11y:keyboard             # Keyboard nav
npm run test:a11y:screen-reader        # Screen reader
npm run test:a11y:contrast             # Color contrast
npm run test:a11y:focus                # Focus management
npm run test:a11y:mobile               # Mobile a11y
npm run test:a11y:forms                # Form a11y

npm run test:security                  # Security tests
npm run test:security:unit             # Unit security tests
npm run test:security:owasp            # OWASP Top 10
npm run test:security:headers          # Security headers
npm run test:security:jwt              # JWT validation
npm run test:security:rate-limit       # Rate limiting
npm run test:security:input            # Input validation
```

---

## Part 11: Summary Statistics

### Development Commands
```bash
npm run dev                            # Dev server + auto-reload
npm run build                          # Production build
npm run start                          # Production server
npm run lint                           # ESLint check
npm run lint:fix                       # Auto-fix
npm run type-check                     # TypeScript checking
npm run format                         # Prettier formatting

npm run init-db                        # Initialize SQLite
npm run init-db:postgres               # Initialize PostgreSQL
npm run test-db                        # Test DB connection
npm run db:seed                        # Add seed data
npm run db:clear                       # Clear all data
```

### Codebase Metrics
| Metric | Value |
|--------|-------|
| **Pages** | 76 |
| **API Routes** | 195 |
| **HTTP Handlers** | 352 |
| **React Components** | 170 |
| **UI Base Components** | 50 |
| **Library Modules** | 49 |
| **Library Files** | 352 |
| **Database Tables** | 119 |
| **Database Indexes** | 365 |
| **Database Triggers** | 59 |
| **Auth Files** | 21 |
| **Security Files** | 24 |
| **Integration Modules** | 7 |
| **Roles** | 6 |
| **Permissions** | 29 |

### Build Status
- **TypeScript:** 0 errors
- **Build:** SUCCESS
- **Lighthouse:** 92-95/100 (Performance)
- **Bundle Size:** 245KB gzipped
- **Bundle Time:** 11-16s (cold), 0.1-0.3s (warm)

### Deployment Infrastructure
- **Container:** Alpine Node 20 (<200MB)
- **Process Manager:** tini (PID 1)
- **Port:** 3000
- **Health Check:** /api/health
- **Database:** PostgreSQL (Supabase) production, SQLite dev
- **Cache:** Redis (optional, graceful fallback)
- **Real-Time:** Socket.io
- **Monitoring:** Sentry, Datadog, Prometheus

---

## Conclusion

This ServiceDesk application represents a **production-grade, enterprise-ready ITSM platform** with:

✓ **Comprehensive ITIL processes** (Problem, Change, CMDB, Catalog, CAB)
✓ **Multi-tenant isolation** with 6-role RBAC and 29 permissions
✓ **Security hardened** (JWT, MFA, CSRF, CSP, encryption, audit logging)
✓ **Performance optimized** (92-95/100 Lighthouse, 45ms avg query, 365 indexes)
✓ **Real-time capabilities** (Socket.io, notifications, presence tracking)
✓ **Extensively tested** (unit, integration, E2E, A11y, security tests)
✓ **Well-structured codebase** (adapter pattern, unified guards, design system)
✓ **Production deployment ready** (Docker, Kubernetes probes, health checks)

**Key Strengths:**
1. Cross-database compatibility (SQLite dev, PostgreSQL prod) via unified adapter
2. Comprehensive security architecture (24 dedicated modules)
3. ITIL-compliant workflows and approvals
4. Multi-language/persona support (Portuguese, enduser/agent/manager)
5. Extensive integration ecosystem (email, WhatsApp, ERP, banking, GovBR)

---

Generated: March 14, 2026
Architecture Version: 1.0.0 (Production)
