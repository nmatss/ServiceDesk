# ServiceDesk Test Suite

## Folder Structure

```
tests/
├── README.md                          # This file
├── setup.ts                           # Global test setup (Vitest)
├── unit/                              # Unit tests (Vitest)
│   ├── lib/
│   │   ├── auth/                      # Auth module tests
│   │   ├── ai/                        # AI module tests
│   │   ├── db/                        # Database adapter tests
│   │   ├── security/                  # Security module tests
│   │   ├── tenant/                    # Multi-tenancy tests
│   │   ├── workflow/                  # Workflow engine tests
│   │   ├── sla/                       # SLA calculation tests
│   │   ├── esm/                       # ESM module tests
│   │   └── self-healing/              # Self-healing tests
│   └── components/                    # React component tests
├── integration/                       # Integration tests (Vitest + real DB)
│   ├── api/                           # API route tests by module
│   │   ├── auth.test.ts
│   │   ├── tickets.test.ts
│   │   ├── problems.test.ts
│   │   ├── changes.test.ts
│   │   ├── cmdb.test.ts
│   │   ├── knowledge.test.ts
│   │   ├── ai.test.ts
│   │   ├── workflows.test.ts
│   │   ├── admin.test.ts
│   │   ├── esm.test.ts
│   │   └── self-healing.test.ts
│   └── setup.ts                       # Integration-specific setup
├── e2e/                               # E2E tests (Playwright)
│   ├── smoke.spec.ts                  # Smoke tests (15 tests, < 2 min)
│   ├── specs/                         # Feature specs
│   │   ├── 01-auth.spec.ts
│   │   ├── 02-ticket-management.spec.ts
│   │   ├── 03-admin-functions.spec.ts
│   │   ├── 04-role-based-access.spec.ts
│   │   ├── 05-mobile-accessibility.spec.ts
│   │   └── 06-error-handling.spec.ts
│   ├── fixtures/                      # Test data and fixtures
│   ├── helpers/                       # Auth + navigation helpers
│   └── utils/                         # E2E-specific utilities
├── security/                          # Security tests
│   ├── tenant-isolation.test.ts       # Cross-tenant isolation
│   ├── owasp/                         # OWASP Top 10 tests
│   │   ├── auth-bypass.test.ts
│   │   ├── authz-bypass.test.ts
│   │   ├── sql-injection.test.ts
│   │   ├── xss.test.ts
│   │   ├── csrf.test.ts
│   │   └── advanced-injection.test.ts
│   └── auth/                          # Auth-specific security tests
│       ├── headers.test.ts
│       ├── jwt.test.ts
│       └── rate-limit.test.ts
├── a11y/                              # Accessibility tests (Playwright + axe-core)
│   ├── axe.config.ts
│   ├── automated.spec.ts
│   ├── keyboard.spec.ts
│   ├── screen-reader.spec.ts
│   ├── color-contrast.spec.ts
│   ├── focus.spec.ts
│   ├── mobile.spec.ts
│   └── forms.spec.ts
├── performance/                       # K6 load tests
│   └── load/
│       ├── ticket-creation.js
│       ├── search-knowledge.js
│       └── api-stress-test.js
├── utils/                             # Shared test utilities
│   ├── mockAuth.ts                    # Auth mocking (createMockUser, tokens)
│   ├── mockDatabase.ts               # DB mocking (setupTestDatabase)
│   ├── testHelpers.ts                # General helpers (sleep, retry, waitFor)
│   ├── test-helpers.ts               # Additional helpers
│   └── index.ts                       # Barrel export
└── __snapshots__/                     # Visual regression baselines
```

## Running Tests

### Unit Tests (Vitest)
```bash
npm run test:unit                # Run all unit tests
npm run test:unit:watch          # Watch mode
npm run test:unit:coverage       # With coverage report + threshold enforcement
npm run test:unit:ui             # Vitest UI
```

### Integration Tests (Vitest + DB)
```bash
npm run test:integration         # Run all integration tests
npm run test:integration:auth    # Auth routes only
npm run test:integration:tickets # Ticket routes only
```

### E2E Tests (Playwright)
```bash
npm run test:e2e                 # Run all E2E tests
npm run test:e2e -- --shard=1/2  # Run shard 1 of 2 (CI)
```

### Security Tests
```bash
npm run test:security            # All security tests
npm run test:security:owasp      # OWASP Top 10 only
```

### Accessibility Tests
```bash
npm run test:a11y                # All a11y tests
```

### Load Tests (K6)
```bash
npm run load:test                # Ticket creation load
npm run load:test:stress         # API stress test
npm run load:test:all            # All load tests
```

### Full Suite
```bash
npm test                         # Unit + E2E
npm run validate                 # Type-check + lint + format + tests
```

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Unit tests | `*.test.ts` / `*.test.tsx` | `token-manager.test.ts` |
| Integration tests | `*.test.ts` | `auth.test.ts` |
| E2E tests | `*.spec.ts` | `01-auth.spec.ts` |
| Security tests | `*.test.ts` | `sql-injection.test.ts` |
| A11y tests | `*.spec.ts` | `keyboard.spec.ts` |
| Load tests | `*.js` (K6) | `ticket-creation.js` |

File placement rules:
- Unit tests go in `tests/unit/` mirroring the source tree (e.g., `tests/unit/lib/auth/` for `lib/auth/`)
- Integration tests go in `tests/integration/api/` grouped by API module
- E2E specs go in `tests/e2e/specs/` with numeric prefixes for ordering

## Coverage Targets

Coverage thresholds are enforced in `vitest.config.ts` and will fail CI if not met.

### Current Thresholds (baseline)

| Metric | Threshold | Target (Q3) | Target (Q4) |
|--------|-----------|-------------|-------------|
| Lines | 30% | 50% | 70% |
| Functions | 30% | 50% | 70% |
| Branches | 25% | 40% | 60% |
| Statements | 30% | 50% | 70% |

### Priority Modules for Coverage

| Module | Priority | Why |
|--------|----------|-----|
| `lib/auth/` | High | Security-critical (JWT, RBAC, MFA) |
| `lib/tenant/` | High | Multi-tenant isolation |
| `lib/security/` | High | Encryption, CSRF, input sanitization |
| `lib/db/adapter.ts` | High | All DB access flows through here |
| `lib/sla/` | Medium | Business logic for SLA tracking |
| `lib/workflow/` | Medium | Complex state machine logic |
| `lib/ai/` | Medium | Classification and NLP |
| `app/api/auth/` | High | Auth endpoints (login, register, MFA) |
| `app/api/tickets/` | Medium | Core CRUD operations |

### Coverage Scope

Included in coverage:
- `lib/**/*.ts` -- all library code
- `app/api/**/*.ts` -- all API routes

Excluded from coverage (by design):
- `lib/db/schema*.sql` -- SQL schema files
- `lib/db/init.ts`, `lib/db/connection.ts` -- DB bootstrap
- `lib/db/seed*.ts` -- Seed data scripts
- `lib/db/benchmark.ts`, `lib/db/backup*.ts`, `lib/db/batch.ts`, `lib/db/monitor.ts` -- SQLite-only dev utilities
- All test files and `node_modules`

## How to Add New Tests

### 1. Unit Test

Create the file mirroring the source path:
```
Source: lib/auth/mfa-manager.ts
Test:   tests/unit/lib/auth/mfa-manager.test.ts
```

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('MfaManager', () => {
  it('should generate a valid TOTP secret', () => {
    // Arrange
    // Act
    // Assert
  })
})
```

### 2. Integration Test

```
Test: tests/integration/api/changes.test.ts
```

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupTestDatabase, cleanupTestDatabase, createMockAdmin } from '@/tests/utils'

describe('POST /api/changes', () => {
  let mockDb: ReturnType<typeof setupTestDatabase>

  beforeEach(async () => { mockDb = await setupTestDatabase() })
  afterEach(() => { cleanupTestDatabase(mockDb) })

  it('should create a change request', async () => {
    // ...
  })
})
```

### 3. E2E Test

```
Test: tests/e2e/specs/07-new-feature.spec.ts
```

```typescript
import { test, expect } from '@playwright/test'

test.describe('New Feature', () => {
  test('user can perform action', async ({ page }) => {
    await page.goto('/feature')
    // ...
  })
})
```

## CI/CD Integration

Coverage is enforced in GitHub Actions (`.github/workflows/ci.yml`):

1. `npm run test:unit:coverage` runs with `--coverage` flag
2. Vitest enforces thresholds from `vitest.config.ts` -- the step fails if coverage drops below configured minimums
3. Coverage report is uploaded as artifact (`coverage-unit-tests`, retained 14 days)
4. On PRs, an lcov summary is posted as a comment
5. Coverage data is sent to Codecov for trend tracking

## Test Utilities Reference

| Utility | Import | Purpose |
|---------|--------|---------|
| `setupTestDatabase()` | `@/tests/utils` | Create isolated test DB |
| `cleanupTestDatabase()` | `@/tests/utils` | Tear down test DB |
| `createMockUser()` | `@/tests/utils` | Mock user with defaults |
| `createMockAdmin()` | `@/tests/utils` | Mock admin user |
| `createMockAgent()` | `@/tests/utils` | Mock agent user |
| `createMockToken()` | `@/tests/utils` | Generate JWT for tests |
| `createAuthenticatedRequest()` | `@/tests/utils` | Request with auth headers |
| `setupAuthContext()` | `@/tests/utils` | Full auth context (user + token + request) |
| `randomData.*` | `@/tests/utils` | Random strings, emails, UUIDs |
| `waitFor()` | `@/tests/utils` | Poll until condition is true |
| `retry()` | `@/tests/utils` | Retry with backoff |

See `tests/utils/` source files for full API details.
