# Testing Quick Start Guide

Get started with testing in ServiceDesk in 5 minutes.

## Prerequisites

```bash
# Ensure dependencies are installed
npm install
```

## Running Your First Test

### 1. Run All Unit Tests

```bash
npm run test:unit
```

### 2. Run Tests in Watch Mode

```bash
npm run test:unit:watch
```

### 3. Generate Coverage Report

```bash
npm run test:unit:coverage
```

## Writing Your First Test

### Create a Test File

Create `tests/my-feature.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupTestDatabase, cleanupTestDatabase, createMockUser } from '@/tests/utils'

describe('My Feature', () => {
  let mockDb

  beforeEach(async () => {
    // Setup test database
    mockDb = await setupTestDatabase()
  })

  afterEach(() => {
    // Cleanup after tests
    cleanupTestDatabase(mockDb)
  })

  it('should work correctly', async () => {
    // Arrange
    const user = await createMockUser(mockDb.db, {
      name: 'Test User',
      email: 'test@example.com'
    })

    // Act
    const result = user.name

    // Assert
    expect(result).toBe('Test User')
  })
})
```

### Run Your Test

```bash
npm run test:unit -- my-feature.test.ts
```

## Common Test Patterns

### Testing API Routes

```typescript
import { setupAuthContext } from '@/tests/utils'

it('should create resource', async () => {
  const { token } = await setupAuthContext('user')

  const response = await fetch('/api/resource', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Test' })
  })

  expect(response.status).toBe(201)
})
```

### Testing Database Queries

```typescript
import { createMockTicket } from '@/tests/utils'

it('should fetch ticket', () => {
  const ticket = createMockTicket(mockDb.db, {
    title: 'Test Ticket'
  })

  const result = getTicketById(ticket.id)

  expect(result).toBeDefined()
  expect(result.title).toBe('Test Ticket')
})
```

### Testing Authentication

```typescript
import { createMockToken, createAuthHeaders } from '@/tests/utils'

it('should authenticate user', async () => {
  const token = await createMockToken()
  const headers = createAuthHeaders(token)

  expect(headers['Authorization']).toContain('Bearer ')
})
```

## Available Test Utilities

### Database Mocking

```typescript
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createMockUser,
  createMockTicket,
  createMockComment,
  createMockArticle,
} from '@/tests/utils'
```

### Authentication Mocking

```typescript
import {
  createMockAdmin,
  createMockAgent,
  createAdminToken,
  setupAuthContext,
  createAuthenticatedRequest,
} from '@/tests/utils'
```

### Test Helpers

```typescript
import {
  sleep,
  waitFor,
  withTimeout,
  retry,
  randomData,
  assertApiSuccess,
  createTimer,
} from '@/tests/utils'
```

## Next Steps

1. Read the [full testing documentation](./README.md)
2. Explore existing tests in `tests/` directory
3. Check test utilities in `tests/utils/`
4. Review example tests in `tests/utils/__tests__/`

## Common Commands

```bash
# Unit tests
npm run test:unit                 # Run all unit tests
npm run test:unit:watch           # Watch mode
npm run test:unit:coverage        # With coverage

# Integration tests
npm run test:integration          # All integration tests
npm run test:integration:auth     # Auth tests only
npm run test:integration:tickets  # Ticket tests only

# E2E tests
npm run test:e2e                  # All E2E tests
npm run test:a11y                 # Accessibility tests

# Security tests
npm run test:security             # All security tests
npm run test:security:owasp       # OWASP tests

# All tests
npm test                          # Unit + E2E
npm run validate                  # Full validation
```

## Getting Help

- **Documentation**: Check `tests/README.md`
- **Examples**: Look in `tests/utils/__tests__/`
- **Utilities**: Review `tests/utils/index.ts`

## Tips

1. **Always cleanup** - Use `afterEach` to cleanup test data
2. **Isolate tests** - Each test should be independent
3. **Use utilities** - Leverage `tests/utils` helpers
4. **Test errors** - Test both success and failure cases
5. **Be descriptive** - Use clear test names

Happy testing! 🎉
