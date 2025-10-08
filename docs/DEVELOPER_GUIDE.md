# ServiceDesk Developer Guide

Complete guide for developers working on the ServiceDesk platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Architecture](#project-architecture)
4. [Development Workflow](#development-workflow)
5. [Testing Strategy](#testing-strategy)
6. [Code Style & Standards](#code-style--standards)
7. [Database Development](#database-development)
8. [API Development](#api-development)
9. [Frontend Development](#frontend-development)
10. [Debugging & Troubleshooting](#debugging--troubleshooting)
11. [Performance Optimization](#performance-optimization)
12. [Security Best Practices](#security-best-practices)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.x or higher ([Download](https://nodejs.org/))
- **npm**: v9.x or higher (comes with Node.js)
- **Git**: Latest version ([Download](https://git-scm.com/))
- **VSCode** (recommended): Latest version ([Download](https://code.visualstudio.com/))

### Recommended VSCode Extensions

Install these extensions for the best development experience:

```
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
- TypeScript Error Translator (mattpocock.ts-error-translator)
- GitLens (eamodio.gitlens)
- Auto Rename Tag (formulahendry.auto-rename-tag)
- Path Intellisense (christian-kohler.path-intellisense)
- ES7+ React/Redux/React-Native snippets (dsznajder.es7-react-js-snippets)
```

### Quick Start (5 Minutes)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ServiceDesk.git
cd ServiceDesk

# 2. Install dependencies
npm install

# 3. Initialize the database
npm run init-db

# 4. Start development server
npm run dev

# 5. Open your browser
# Visit http://localhost:3000
```

You should see the ServiceDesk landing page. Congratulations!

---

## Development Environment Setup

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Database
DATABASE_URL=sqlite:./data/servicedesk.db

# JWT Secrets
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production

# Environment
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Email (Optional for development)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-password

# Redis (Optional - for caching)
REDIS_URL=redis://localhost:6379

# Socket.io (Optional)
SOCKET_URL=http://localhost:3000
```

### Database Setup

The project uses SQLite for development with 18 interconnected tables:

```bash
# Initialize database with schema and seed data
npm run init-db

# Test database connection
npm run test-db

# Clear all data (destructive!)
npm run db:clear

# Re-seed data only
npm run db:seed
```

**Database file location**: `data/servicedesk.db`

### Development Server

```bash
# Start development server (with hot reload)
npm run dev

# Server runs on http://localhost:3000
# API endpoints: http://localhost:3000/api/*
```

### Production Build

```bash
# Type check
npm run type-check

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

---

## Project Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 15 | React framework with App Router |
| **Language** | TypeScript 5 | Type-safe JavaScript |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Database** | SQLite (dev) / PostgreSQL (prod) | Relational database |
| **Authentication** | JWT + bcrypt | Secure auth with tokens |
| **Real-time** | Socket.io | WebSocket for live updates |
| **UI Components** | Headless UI | Accessible component primitives |
| **Icons** | Heroicons | SVG icon library |
| **Forms** | React Hook Form + Zod | Form handling + validation |
| **Charts** | Recharts | Data visualization |
| **Rich Text** | React Quill | WYSIWYG editor |
| **Testing** | Vitest + Playwright | Unit + E2E testing |

### Directory Structure

```
ServiceDesk/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── tickets/              # Ticket management
│   │   ├── analytics/            # Analytics & reporting
│   │   ├── knowledge/            # Knowledge base
│   │   └── workflows/            # Workflow automation
│   ├── admin/                    # Admin dashboard pages
│   ├── auth/                     # Auth pages (login, register)
│   ├── portal/                   # User portal
│   ├── tickets/                  # Ticket pages
│   ├── analytics/                # Analytics pages
│   ├── knowledge/                # Knowledge base pages
│   ├── globals.css               # Global styles + Tailwind
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
│
├── lib/                          # Business logic & utilities
│   ├── auth/                     # Auth utilities (JWT, RBAC, MFA, SSO)
│   ├── db/                       # Database layer
│   │   ├── schema.sql            # Database schema (18 tables)
│   │   ├── connection.ts         # DB connection management
│   │   ├── queries.ts            # Type-safe query functions
│   │   ├── init.ts               # DB initialization
│   │   └── seed.ts               # Seed data
│   ├── types/                    # TypeScript type definitions
│   │   └── database.ts           # Database entity types
│   ├── validation/               # Zod validation schemas
│   ├── notifications/            # Notification system
│   ├── workflow/                 # Workflow engine
│   ├── ai/                       # AI/ML features
│   ├── analytics/                # Analytics engine
│   ├── knowledge/                # KB search & indexing
│   ├── integrations/             # External integrations
│   ├── security/                 # Security utilities
│   ├── performance/              # Performance optimization
│   └── utils.ts                  # Shared utilities
│
├── src/                          # React components
│   ├── components/               # Reusable components
│   │   ├── admin/                # Admin components
│   │   ├── analytics/            # Analytics widgets
│   │   ├── dashboard/            # Dashboard components
│   │   ├── tickets/              # Ticket components
│   │   ├── knowledge/            # KB components
│   │   ├── ui/                   # UI primitives
│   │   └── layouts/              # Layout components
│   └── hooks/                    # Custom React hooks
│
├── components/ui/                # Shadcn UI components
├── public/                       # Static assets
├── scripts/                      # Utility scripts
├── tests/                        # Test files
├── docs/                         # Documentation
└── .github/                      # GitHub Actions CI/CD

```

### Key Architectural Patterns

#### 1. Custom ORM Layer

We use a custom database layer instead of Prisma/Drizzle for better control:

```typescript
// lib/db/queries.ts
import { db } from './connection';

export const ticketQueries = {
  getAll: () => db.prepare('SELECT * FROM tickets').all(),
  getById: (id: number) => db.prepare('SELECT * FROM tickets WHERE id = ?').get(id),
  create: (data: CreateTicketInput) => { /* ... */ }
};
```

#### 2. Middleware-First Authentication

All route protection happens in `middleware.ts`:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) return redirect('/auth/login');
    // Verify JWT and role
  }
}
```

#### 3. Type-Safe API Routes

```typescript
// app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ticketQueries } from '@/lib/db/queries';
import { CreateTicketSchema } from '@/lib/validation/ticket';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = CreateTicketSchema.parse(body); // Zod validation
  const ticket = ticketQueries.create(validated);
  return NextResponse.json({ ticket }, { status: 201 });
}
```

#### 4. Component Composition Pattern

```typescript
// src/components/tickets/TicketCard.tsx
export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card>
      <CardHeader>
        <TicketBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </CardHeader>
      <CardBody>
        <TicketTitle>{ticket.title}</TicketTitle>
        <TicketMeta ticket={ticket} />
      </CardBody>
      <CardFooter>
        <TicketActions ticket={ticket} />
      </CardFooter>
    </Card>
  );
}
```

---

## Development Workflow

### Daily Development Flow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Create feature branch
git checkout -b feature/add-ticket-filters

# 3. Make changes and test
npm run dev

# 4. Run quality checks
npm run type-check
npm run lint
npm run test:unit

# 5. Commit changes
git add .
git commit -m "feat: add advanced ticket filters"

# 6. Push and create PR
git push origin feature/add-ticket-filters
```

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-sla-dashboard`)
- `fix/` - Bug fixes (e.g., `fix/ticket-assignment-bug`)
- `refactor/` - Code refactoring (e.g., `refactor/optimize-queries`)
- `docs/` - Documentation updates (e.g., `docs/add-api-examples`)
- `test/` - Test additions (e.g., `test/add-auth-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**

```
feat(tickets): add bulk assignment feature

Implemented bulk ticket assignment with role-based filtering
and optimistic UI updates.

Closes #123

---

fix(auth): resolve token refresh race condition

Added mutex lock to prevent multiple simultaneous refresh attempts.

Fixes #456

---

refactor(db): optimize ticket query performance

Reduced query time by 75% using indexed joins and query planning.
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Tests
- `chore` - Maintenance
- `perf` - Performance improvement
- `style` - Code style changes

---

## Testing Strategy

### Test Structure

```
tests/
├── unit/                    # Unit tests (Vitest)
│   ├── lib/
│   │   ├── auth.test.ts
│   │   ├── db.test.ts
│   │   └── validation.test.ts
│   └── components/
│       └── TicketCard.test.tsx
│
├── integration/             # Integration tests
│   └── api/
│       ├── auth.test.ts
│       └── tickets.test.ts
│
└── e2e/                     # E2E tests (Playwright)
    ├── auth.spec.ts
    ├── tickets.spec.ts
    └── admin.spec.ts
```

### Running Tests

```bash
# Unit tests
npm run test:unit          # Run once
npm run test:unit:watch    # Watch mode
npm run test:unit:ui       # UI mode
npm run test:unit:coverage # With coverage

# E2E tests
npm run test:e2e           # Run all E2E tests
npm run test:e2e:watch     # Watch mode

# All tests
npm test
```

### Writing Unit Tests

```typescript
// tests/unit/lib/auth.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password Hashing', () => {
  it('should hash password correctly', async () => {
    const password = 'SecurePassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('should verify correct password', async () => {
    const password = 'SecurePassword123!';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await hashPassword('correct');
    const isValid = await verifyPassword('incorrect', hash);

    expect(isValid).toBe(false);
  });
});
```

### Writing E2E Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/portal');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });
});
```

### Test Coverage Goals

- **Overall Coverage**: > 80%
- **Critical Paths**: > 95% (auth, payments, data integrity)
- **Business Logic**: > 90%
- **UI Components**: > 70%

---

## Code Style & Standards

### TypeScript Configuration

We use **strict mode** with enhanced type checking:

```json
// tsconfig.json highlights
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Code Style Rules

#### 1. No `any` Type

```typescript
// Bad
function processData(data: any) { }

// Good
interface ProcessData {
  id: number;
  value: string;
}
function processData(data: ProcessData) { }
```

#### 2. Explicit Return Types

```typescript
// Bad
function getTicket(id: number) {
  return db.query('SELECT * FROM tickets WHERE id = ?', id);
}

// Good
function getTicket(id: number): Ticket | null {
  return db.query('SELECT * FROM tickets WHERE id = ?', id);
}
```

#### 3. Immutable Data Structures

```typescript
// Bad
function updateTicket(ticket: Ticket, updates: Partial<Ticket>) {
  Object.assign(ticket, updates);
  return ticket;
}

// Good
function updateTicket(ticket: Ticket, updates: Partial<Ticket>): Ticket {
  return { ...ticket, ...updates };
}
```

#### 4. Functional Error Handling

```typescript
// Bad
function parseJSON(str: string) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// Good
import { Result } from '@/lib/utils/result';

function parseJSON(str: string): Result<unknown, Error> {
  try {
    return Result.ok(JSON.parse(str));
  } catch (e) {
    return Result.err(new Error('Invalid JSON'));
  }
}
```

### File Organization

```typescript
// ComponentName.tsx structure
import { ... } from 'react';        // React imports
import { ... } from 'next/...';     // Next.js imports
import { ... } from '@/lib/...';    // Internal libs
import { ... } from '@/components'; // Internal components

// Types
interface Props { }
type State = { };

// Component
export function ComponentName({ }: Props) {
  // Hooks
  const [state, setState] = useState();

  // Effects
  useEffect(() => { }, []);

  // Handlers
  const handleClick = () => { };

  // Render
  return ( );
}

// Exports
export type { Props };
```

### Naming Conventions

- **Components**: PascalCase (`TicketCard`, `UserProfile`)
- **Functions**: camelCase (`getUserTickets`, `calculateSLA`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_TICKETS`, `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (`User`, `TicketStatus`)
- **Files**: kebab-case (`ticket-card.tsx`, `user-profile.tsx`)
- **Folders**: kebab-case (`admin-dashboard`, `ticket-list`)

---

## Database Development

### Schema Management

The database schema is defined in `lib/db/schema.sql` with 18 tables:

**Core Tables:**
- `users` - User accounts (admin, agent, user roles)
- `tickets` - Support tickets
- `comments` - Ticket comments
- `attachments` - File attachments

**Classification:**
- `categories` - Ticket categories
- `priorities` - Priority levels
- `statuses` - Ticket statuses

**SLA & Tracking:**
- `sla_policies` - SLA rules
- `sla_tracking` - SLA compliance tracking

**Knowledge Base:**
- `kb_articles` - Knowledge articles
- `kb_categories` - KB categories

**Analytics:**
- `analytics_daily_metrics` - Daily stats
- `analytics_agent_metrics` - Agent performance

**Advanced:**
- `notifications` - User notifications
- `automations` - Workflow automations
- `user_sessions` - Active sessions
- `audit_logs` - Audit trail

### Adding a New Table

1. **Update schema.sql:**

```sql
-- lib/db/schema.sql
CREATE TABLE ticket_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title_template TEXT NOT NULL,
  description_template TEXT NOT NULL,
  category_id INTEGER,
  priority_id INTEGER,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (priority_id) REFERENCES priorities(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Trigger for auto-update
CREATE TRIGGER ticket_templates_updated_at
AFTER UPDATE ON ticket_templates
FOR EACH ROW
BEGIN
  UPDATE ticket_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
```

2. **Add TypeScript types:**

```typescript
// lib/types/database.ts
export interface TicketTemplate {
  id: number;
  name: string;
  title_template: string;
  description_template: string;
  category_id: number | null;
  priority_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketTemplateInput {
  name: string;
  title_template: string;
  description_template: string;
  category_id?: number;
  priority_id?: number;
  created_by: number;
}
```

3. **Add query functions:**

```typescript
// lib/db/queries.ts
export const ticketTemplateQueries = {
  getAll: (): TicketTemplate[] => {
    return db.prepare('SELECT * FROM ticket_templates ORDER BY name').all();
  },

  getById: (id: number): TicketTemplate | null => {
    return db.prepare('SELECT * FROM ticket_templates WHERE id = ?').get(id);
  },

  create: (data: CreateTicketTemplateInput): TicketTemplate => {
    const result = db.prepare(`
      INSERT INTO ticket_templates (name, title_template, description_template, category_id, priority_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.name, data.title_template, data.description_template, data.category_id, data.priority_id, data.created_by);

    return ticketTemplateQueries.getById(result.lastInsertRowid);
  }
};
```

4. **Re-initialize database:**

```bash
npm run db:clear
npm run init-db
```

### Database Migrations

For production, use migrations:

```typescript
// lib/db/migrations/001_add_ticket_templates.ts
export const up = (db: Database) => {
  db.exec(`
    CREATE TABLE ticket_templates ( ... );
  `);
};

export const down = (db: Database) => {
  db.exec(`DROP TABLE ticket_templates;`);
};
```

Run migrations:

```bash
npm run migrate:up
npm run migrate:down
```

---

## API Development

### Creating API Routes

```typescript
// app/api/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ticketTemplateQueries } from '@/lib/db/queries';
import { CreateTicketTemplateSchema } from '@/lib/validation/templates';
import { verifyAuth } from '@/lib/auth/middleware';

// GET /api/templates
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = ticketTemplateQueries.getAll();
  return NextResponse.json({ templates });
}

// POST /api/templates
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validated = CreateTicketTemplateSchema.parse(body);

    const template = ticketTemplateQueries.create({
      ...validated,
      created_by: user.id
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### API Response Standards

Always use consistent response formats:

```typescript
// Success responses
return NextResponse.json({
  data: { ... },
  message: 'Operation successful'
}, { status: 200 });

// Error responses
return NextResponse.json({
  error: 'ERROR_CODE',
  message: 'Human-readable message',
  details: { field: 'validation error' }
}, { status: 400 });

// Paginated responses
return NextResponse.json({
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    total_pages: 5
  }
});
```

---

## Frontend Development

### Component Best Practices

```typescript
// Good component structure
interface TicketCardProps {
  ticket: Ticket;
  onUpdate?: (ticket: Ticket) => void;
  className?: string;
}

export function TicketCard({ ticket, onUpdate, className }: TicketCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setIsLoading(true);
    try {
      const updated = await updateTicketStatus(ticket.id, newStatus);
      onUpdate?.(updated);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('card', className)}>
      {/* Component content */}
    </div>
  );
}
```

### State Management

Use React hooks and context for state:

```typescript
// lib/context/auth-context.tsx
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## Debugging & Troubleshooting

### Common Issues

#### Database locked

```bash
# Kill any process holding the database
pkill -9 node
rm data/servicedesk.db-wal
npm run init-db
```

#### Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

#### Type errors after schema changes

```bash
# Regenerate types
npm run type-check
```

### Debug Configuration (VSCode)

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

---

## Performance Optimization

### Database Optimization

```typescript
// Use prepared statements
const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
const ticket = stmt.get(id);

// Batch inserts
const insert = db.prepare('INSERT INTO tickets (title, description) VALUES (?, ?)');
const insertMany = db.transaction((tickets) => {
  for (const ticket of tickets) insert.run(ticket.title, ticket.description);
});
```

### Frontend Optimization

```typescript
// Use React.memo for expensive components
export const TicketList = React.memo(({ tickets }: { tickets: Ticket[] }) => {
  return <div>{tickets.map(t => <TicketCard key={t.id} ticket={t} />)}</div>;
});

// Use useMemo for expensive calculations
const filteredTickets = useMemo(() => {
  return tickets.filter(t => t.status === 'open');
}, [tickets]);

// Use useCallback for stable function references
const handleUpdate = useCallback((ticket: Ticket) => {
  setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t));
}, []);
```

---

## Security Best Practices

### Input Validation

```typescript
import { z } from 'zod';

const CreateTicketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  category_id: z.number().int().positive(),
  priority_id: z.number().int().min(1).max(4)
});
```

### SQL Injection Prevention

```typescript
// Bad - SQL injection vulnerable
db.prepare(`SELECT * FROM tickets WHERE title = '${userInput}'`);

// Good - Parameterized query
db.prepare('SELECT * FROM tickets WHERE title = ?').get(userInput);
```

### XSS Prevention

```typescript
// Always sanitize user input
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(userInput);
```

### Authentication Best Practices

- Store JWT in httpOnly cookies
- Use short-lived access tokens (1 hour)
- Implement refresh token rotation
- Add rate limiting to auth endpoints
- Implement MFA for admin accounts

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Project README](../README.md)
- [API Documentation](./api/README.md)
- [Contributing Guide](./CONTRIBUTING.md)

---

**Questions?** Contact the development team or open an issue on GitHub.
