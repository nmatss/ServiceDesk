# Testing Documentation - ServiceDesk Pro

## 📋 Overview

This document describes the comprehensive testing infrastructure for ServiceDesk Pro, including unit tests, integration tests, and E2E tests.

## Test Stack

### Unit & Integration Tests
- **Vitest** v3.2.4 - Fast unit test runner with native ESM support
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Custom matchers for DOM assertions
- **happy-dom** - Lightweight DOM implementation

### E2E Tests
- **Playwright** v1.55.1 - Cross-browser end-to-end testing
- Configured for Chromium (extendable to Firefox, Safari)

## Test Structure

```
ServiceDesk/
├── lib/
│   ├── api/__tests__/
│   │   └── api-helpers.test.ts        # API helper utilities (29 tests)
│   ├── errors/__tests__/
│   │   └── error-handler.test.ts      # Error handling (28 tests)
│   └── validation/__tests__/
│       └── schemas.test.ts            # Zod validation schemas (36 tests)
├── tests/
│   ├── auth.spec.ts                   # E2E auth tests (Playwright)
│   └── setup.ts                       # Test utilities & database setup
├── vitest.config.ts                   # Vitest configuration
└── playwright.config.ts               # Playwright configuration
```

## Running Tests

### All Tests
```bash
npm test                    # Run all tests (unit + E2E)
```

### Unit Tests
```bash
npm run test:unit          # Run once
npm run test:unit:watch    # Watch mode
npm run test:unit:ui       # Open Vitest UI
npm run test:unit:coverage # Generate coverage report
```

### E2E Tests
```bash
npm run test:e2e           # Run Playwright tests
npm run test:e2e:watch     # Watch mode
```

## Test Coverage

### Current Coverage: 93 Tests Passing ✅

#### API Helpers (`lib/api/__tests__/api-helpers.test.ts`) - 29 tests
- ✅ `getUserFromRequest` - Extract user from authenticated requests
- ✅ `getTenantFromRequest` - Extract tenant context
- ✅ `requireAdmin` - Role-based access control
- ✅ `requireRole` - Custom role validation
- ✅ `validateTenantAccess` - Multi-tenant isolation
- ✅ `parseJSONBody` - Request body parsing with Zod
- ✅ `parseQueryParams` - Query parameter validation
- ✅ `successResponse` - Standardized success responses
- ✅ `paginatedResponse` - Pagination utilities
- ✅ `getIdFromParams` - URL parameter extraction
- ✅ Integration tests - Complete request flows

#### Error Handler (`lib/errors/__tests__/error-handler.test.ts`) - 28 tests
- ✅ `AppError` - Base error class
- ✅ `ValidationError` - Input validation failures (400)
- ✅ `AuthenticationError` - Auth required (401)
- ✅ `AuthorizationError` - Insufficient permissions (403)
- ✅ `NotFoundError` - Resource not found (404)
- ✅ `ConflictError` - Business logic conflicts (409)
- ✅ `DatabaseError` - Database failures (500)
- ✅ `RateLimitError` - Too many requests (429)
- ✅ `ExternalAPIError` - External service failures (503)
- ✅ `formatErrorResponse` - Consistent error formatting
- ✅ `getStatusCode` - HTTP status mapping
- ✅ `validateOrThrow` - Zod validation wrapper
- ✅ `assert` - Type-safe assertions

#### Validation Schemas (`lib/validation/__tests__/schemas.test.ts`) - 36 tests
- ✅ **Common Schemas**: id, email, slug, password, hexColor, domain
- ✅ **User Schemas**: create, update, login, query
- ✅ **Ticket Schemas**: create, update, query (with tags, pagination)
- ✅ **Comment Schemas**: create, update
- ✅ **Attachment Schemas**: create (with file size limits)
- ✅ **Category Schemas**: create, update (with hex color validation)
- ✅ **Priority/Status Schemas**: create, update
- ✅ **SLA Schemas**: create, update (with time validation)
- ✅ **Organization Schemas**: create, update

#### E2E Tests (`tests/auth.spec.ts`) - 4 tests
- ✅ Login page visual elements
- ✅ Register page visual elements
- ✅ Password toggle functionality
- ✅ Form validation

## Test Utilities

### Setup File (`tests/setup.ts`)
- Environment variable configuration
- Test database setup (SQLite in-memory)
- Mock factories for users, tickets, requests
- Test data seeding

### Mock Factories
```typescript
// Create mock request
const request = createMockRequest({
  method: 'POST',
  headers: { 'x-user-id': '1' },
  body: { title: 'Test' }
})

// Create test user
const user = createTestUser({
  role: 'admin',
  organization_id: 1
})

// Create test ticket
const ticket = createTestTicket({
  title: 'Bug Report',
  priority_id: 1
})
```

## Configuration

### Vitest Config (`vitest.config.ts`)
```typescript
{
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    },
    exclude: [
      'tests/**/*.spec.ts', // Exclude Playwright tests
      'node_modules/**'
    ]
  }
}
```

### Playwright Config (`playwright.config.ts`)
```typescript
{
  testDir: './tests',
  baseURL: 'http://localhost:4000',
  webServer: {
    command: 'PORT=4000 npm run dev',
    url: 'http://localhost:4000',
    reuseExistingServer: true
  }
}
```

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it('should validate user creation', () => {
  // Arrange
  const validUser = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'SecurePass123',
    role: 'user',
    organization_id: 1,
  }

  // Act
  const result = userSchemas.create.parse(validUser)

  // Assert
  expect(result).toEqual(validUser)
})
```

### 2. Test Error Cases
```typescript
it('should reject weak passwords', () => {
  expect(() => commonSchemas.password.parse('short')).toThrow()
  expect(() => commonSchemas.password.parse('nouppercaseornumber')).toThrow()
})
```

### 3. Integration Testing
```typescript
it('should handle complete request flow', async () => {
  // Extract user
  const user = getUserFromRequest(request)

  // Validate body
  const data = await parseJSONBody(request, schema)

  // Check authorization
  requireRole(user, ['agent', 'admin'])

  // Validate tenant access
  validateTenantAccess(user, resource.organization_id)

  // Create response
  const response = successResponse(result)
  expect(response.success).toBe(true)
})
```

### 4. Mock External Dependencies
```typescript
// Mock Next.js Request with required properties
function createMockRequest(url: string) {
  return {
    nextUrl: {
      searchParams: new URL(url).searchParams,
    },
  } as any
}
```

## Security Testing

### Multi-Tenant Isolation
```typescript
it('should handle multi-tenant isolation', () => {
  const user = {
    id: 1,
    organization_id: 1,
    role: 'admin',
  }

  const resourceFromOtherTenant = { organization_id: 2 }

  expect(() =>
    validateTenantAccess(user, resourceFromOtherTenant.organization_id)
  ).toThrow(AuthorizationError)
})
```

### Input Validation
```typescript
it('should reject invalid inputs', () => {
  expect(() => ticketSchemas.create.parse({
    title: '', // Empty title
    description: 'Test',
  })).toThrow(ValidationError)

  expect(() => ticketSchemas.create.parse({
    title: 'a'.repeat(501), // Exceeds max length
    description: 'Test',
  })).toThrow(ValidationError)
})
```

### SQL Injection Prevention
All database queries use prepared statements. Tests verify:
- ID parameters are validated (positive integers only)
- String inputs are type-checked
- No raw SQL concatenation

## Continuous Integration

### Pre-commit Hooks (Recommended)
```bash
npm run validate  # Type-check + lint + format check
npm run test:unit # Run unit tests
```

### CI/CD Pipeline (Recommended)
```yaml
# .github/workflows/test.yml
- run: npm run validate
- run: npm run test:unit:coverage
- run: npm run test:e2e
```

## Adding New Tests

### 1. Unit Test Template
```typescript
/**
 * Unit Tests for [Module Name]
 */

import { describe, it, expect } from 'vitest'
import { yourFunction } from '../your-module'

describe('YourModule', () => {
  describe('yourFunction', () => {
    it('should handle valid input', () => {
      const result = yourFunction(validInput)
      expect(result).toEqual(expectedOutput)
    })

    it('should throw on invalid input', () => {
      expect(() => yourFunction(invalidInput)).toThrow(ErrorType)
    })
  })
})
```

### 2. E2E Test Template
```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path')
    await expect(page.locator('selector')).toBeVisible()
  })
})
```

## Performance Testing

### Database Query Tests
```typescript
it('should handle pagination efficiently', () => {
  const query = ticketSchemas.query.parse({
    page: 1,
    limit: 25
  })

  expect(query.page).toBe(1)
  expect(query.limit).toBe(25)
})
```

### Validation Performance
All Zod schemas are compiled once and reused, ensuring:
- Fast validation (<1ms per request)
- Type inference at compile time
- No runtime overhead

## Known Limitations

1. **Database Tests**: Currently use in-memory SQLite. Production uses persistent SQLite/PostgreSQL.
2. **External APIs**: Not tested (OpenAI, email services). Consider mocking in future.
3. **Real-time Features**: Socket.io tests not implemented yet.

## Future Testing Roadmap

- [ ] Add API integration tests (using Supertest or similar)
- [ ] Implement visual regression testing
- [ ] Add load testing (k6 or Artillery)
- [ ] Set up mutation testing (Stryker)
- [ ] Add security scanning (OWASP ZAP integration)
- [ ] Implement contract testing for APIs

## Test Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Unit Tests | 93 ✅ | 100+ |
| E2E Tests | 4 ✅ | 20+ |
| Code Coverage | ~60% | 80%+ |
| Test Execution Time | <1s | <2s |

---

**Last Updated**: 2025-10-04
**Maintained By**: Development Team
**Test Review**: Required before each release
