# ServiceDesk Testing Infrastructure

Comprehensive testing documentation for the ServiceDesk application.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Utilities](#test-utilities)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)

## Overview

The ServiceDesk application uses a multi-layered testing approach:

- **Unit Tests** - Test individual functions and modules in isolation (Vitest)
- **Integration Tests** - Test API routes and database interactions (Vitest)
- **E2E Tests** - Test complete user journeys (Playwright)
- **Accessibility Tests** - Test WCAG compliance (Playwright + axe-core)
- **Load Tests** - Test performance and scalability (k6)
- **Security Tests** - Test authentication, authorization, and OWASP vulnerabilities

### Testing Stack

| Tool | Purpose | Config File |
|------|---------|-------------|
| **Vitest** | Unit & Integration Tests | `vitest.config.ts` |
| **Playwright** | E2E & Accessibility Tests | `playwright.config.ts` |
| **Testing Library** | React Component Testing | Included in Vitest |
| **MSW** | API Mocking | - |
| **k6** | Load Testing | `tests/load/*.js` |

## Test Structure

```
tests/
├── utils/                    # Test utilities and helpers
│   ├── mockDatabase.ts       # Database mocking helpers
│   ├── mockAuth.ts          # Authentication mocking helpers
│   ├── testHelpers.ts       # General test utilities
│   └── __tests__/           # Tests for utilities themselves
├── unit/                    # Unit tests
├── integration/             # Integration tests
├── e2e/                     # End-to-end tests
├── a11y/                    # Accessibility tests
├── security/                # Security tests
├── load/                    # Load tests
└── setup.ts                 # Global test setup
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with UI
npm run test:unit:ui

# Run unit tests with coverage
npm run test:unit:coverage
```

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run specific integration test suites
npm run test:integration:auth
npm run test:integration:tickets
npm run test:integration:knowledge
npm run test:integration:admin
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in watch mode
npm run test:e2e:watch
```

### Accessibility Tests

```bash
# Run all accessibility tests
npm run test:a11y

# Generate accessibility report
npm run test:a11y:report

# Run specific accessibility test suites
npm run test:a11y:automated    # Automated WCAG checks
npm run test:a11y:keyboard     # Keyboard navigation
npm run test:a11y:screen-reader # Screen reader support
npm run test:a11y:contrast     # Color contrast
npm run test:a11y:focus        # Focus management
npm run test:a11y:mobile       # Mobile accessibility
npm run test:a11y:forms        # Form accessibility
```

### Security Tests

```bash
# Run all security tests
npm run test:security

# Run specific security test suites
npm run test:security:owasp    # OWASP Top 10 tests
npm run test:security:headers  # Security headers
npm run test:security:jwt      # JWT security
npm run test:security:rate-limit # Rate limiting
npm run test:security:input    # Input validation
```

### Load Tests

```bash
# Run load tests
npm run load:test              # Basic ticket creation load test
npm run load:test:search       # Knowledge base search load test
npm run load:test:stress       # API stress test
npm run load:test:all          # Run all load tests

# Analyze load test results
npm run load:analyze
```

### Run All Tests

```bash
# Run all tests (unit + E2E)
npm test

# Validate entire codebase (type-check + lint + format + tests)
npm run validate
```

## Test Utilities

The `tests/utils/` directory provides comprehensive testing utilities.

### Database Mocking (`mockDatabase.ts`)

#### Setup Test Database

```typescript
import { setupTestDatabase, cleanupTestDatabase } from '@/tests/utils'

describe('My Test Suite', () => {
  let mockDb

  beforeEach(async () => {
    mockDb = await setupTestDatabase()
  })

  afterEach(() => {
    cleanupTestDatabase(mockDb)
  })

  it('should work with database', () => {
    // Your test code
  })
})
```

#### Create Mock Data

```typescript
import {
  createMockUser,
  createMockTicket,
  createMockComment,
  createMockArticle
} from '@/tests/utils'

// Create a mock user
const user = await createMockUser(mockDb.db, {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin'
})

// Create a mock ticket
const ticket = createMockTicket(mockDb.db, {
  title: 'Test Ticket',
  user_id: user.id,
  priority_id: 1
})

// Create a mock comment
const comment = createMockComment(mockDb.db, {
  ticket_id: ticket.id,
  user_id: user.id,
  content: 'Test comment'
})

// Create a mock KB article
const article = createMockArticle(mockDb.db, {
  title: 'How to...',
  author_id: user.id
})
```

### Authentication Mocking (`mockAuth.ts`)

#### Create Mock Users

```typescript
import {
  createMockUser,
  createMockAdmin,
  createMockAgent
} from '@/tests/utils'

const user = createMockUser()        // Regular user
const admin = createMockAdmin()      // Admin user
const agent = createMockAgent()      // Agent user

// Custom user
const customUser = createMockUser({
  id: 123,
  email: 'custom@example.com',
  role: 'admin'
})
```

#### Create Authentication Tokens

```typescript
import {
  createMockToken,
  createAdminToken,
  createAgentToken
} from '@/tests/utils'

const userToken = await createMockToken()
const adminToken = await createAdminToken()
const agentToken = await createAgentToken()
```

#### Create Authenticated Requests

```typescript
import {
  createAuthenticatedRequest,
  createAdminRequest,
  createAgentRequest
} from '@/tests/utils'

// Authenticated user request
const request = await createAuthenticatedRequest({
  method: 'POST',
  url: '/api/tickets',
  body: { title: 'New Ticket' }
})

// Admin request
const adminReq = await createAdminRequest({
  method: 'GET',
  url: '/api/admin/users'
})

// Agent request
const agentReq = await createAgentRequest({
  method: 'PUT',
  url: '/api/tickets/1',
  body: { status_id: 2 }
})
```

#### Setup Authentication Context

```typescript
import { setupAuthContext } from '@/tests/utils'

// Setup complete auth context
const context = await setupAuthContext('admin')

console.log(context.user)     // Mock user object
console.log(context.token)    // JWT token
console.log(context.headers)  // Auth headers
console.log(context.request)  // Authenticated request
```

### Test Helpers (`testHelpers.ts`)

#### Async Utilities

```typescript
import { sleep, waitFor, withTimeout, retry } from '@/tests/utils'

// Sleep for 100ms
await sleep(100)

// Wait for condition
await waitFor(() => someCondition === true, {
  timeout: 5000,
  interval: 100
})

// Execute with timeout
const result = await withTimeout(somePromise, 3000)

// Retry failed operations
const data = await retry(async () => {
  return await fetchData()
}, { retries: 3, delay: 100 })
```

#### Mock Functions

```typescript
import { createMockFn } from '@/tests/utils'

const mockFn = createMockFn<(a: number, b: number) => number>()

// Mock return value
mockFn.mockReturnValue(42)

// Mock implementation
mockFn.mockImplementation((a, b) => a + b)

// Use the function
mockFn(1, 2)  // Returns 3

// Check calls
console.log(mockFn.calls)    // [[1, 2]]
console.log(mockFn.results)  // [3]

// Reset
mockFn.reset()
```

#### Random Data Generation

```typescript
import { randomData } from '@/tests/utils'

const str = randomData.string(10)           // Random 10-char string
const email = randomData.email()            // Random email
const num = randomData.number(1, 100)       // Random number 1-100
const bool = randomData.boolean()           // Random boolean
const date = randomData.date()              // Random date
const uuid = randomData.uuid()              // Random UUID
const arr = randomData.array(() => randomData.number(), 5)  // Array of 5 random numbers
```

#### API Response Assertions

```typescript
import { assertApiSuccess, assertApiError } from '@/tests/utils'

const response = await fetch('/api/tickets')
const json = await response.json()

// Assert success
assertApiSuccess(json)  // Checks json.success === true

// Assert error
assertApiError(json)    // Checks json.success === false && json.error exists
```

#### Performance Measurement

```typescript
import { createTimer } from '@/tests/utils'

const timer = createTimer()

// Measure execution time
await timer.measure('db-query', async () => {
  await db.query('SELECT * FROM tickets')
})

// Get statistics
const stats = timer.getStats('db-query')
console.log(stats.average)  // Average execution time
console.log(stats.min)      // Minimum time
console.log(stats.max)      // Maximum time
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setupTestDatabase, cleanupTestDatabase } from '@/tests/utils'
import { getTicketById } from '@/lib/db/queries'

describe('getTicketById', () => {
  let mockDb

  beforeEach(async () => {
    mockDb = await setupTestDatabase()
  })

  afterEach(() => {
    cleanupTestDatabase(mockDb)
  })

  it('should return ticket by ID', async () => {
    const user = await createMockUser(mockDb.db)
    const ticket = createMockTicket(mockDb.db, { user_id: user.id })

    const result = getTicketById(ticket.id)

    expect(result).toBeDefined()
    expect(result.id).toBe(ticket.id)
    expect(result.title).toBe(ticket.title)
  })

  it('should return null for non-existent ticket', () => {
    const result = getTicketById(99999)
    expect(result).toBeNull()
  })
})
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setupAuthContext } from '@/tests/utils'

describe('POST /api/tickets', () => {
  it('should create a new ticket', async () => {
    const { token } = await setupAuthContext('user')

    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'New Ticket',
        description: 'Test description',
        priority_id: 2
      })
    })

    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.ticket).toBeDefined()
    expect(json.data.ticket.title).toBe('New Ticket')
  })

  it('should return 401 for unauthenticated request', async () => {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' })
    })

    expect(response.status).toBe(401)
  })
})
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test'

test('user can create a ticket', async ({ page }) => {
  // Login
  await page.goto('/auth/login')
  await page.fill('[name="email"]', 'user@example.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  // Navigate to create ticket
  await page.goto('/portal/create')

  // Fill form
  await page.fill('[name="title"]', 'E2E Test Ticket')
  await page.fill('[name="description"]', 'This is a test ticket')
  await page.selectOption('[name="priority_id"]', '2')

  // Submit
  await page.click('button[type="submit"]')

  // Verify success
  await expect(page.locator('.success-message')).toBeVisible()
  await expect(page).toHaveURL(/\/portal\/tickets\/\d+/)
})
```

## Best Practices

### 1. Isolation

Each test should be independent and not rely on other tests:

```typescript
// Good
beforeEach(async () => {
  mockDb = await setupTestDatabase()
})

afterEach(() => {
  cleanupTestDatabase(mockDb)
})

// Bad - Tests depend on execution order
let sharedTicket
it('creates ticket', () => { sharedTicket = createMockTicket() })
it('updates ticket', () => { updateTicket(sharedTicket.id) })
```

### 2. Descriptive Test Names

Use clear, descriptive test names:

```typescript
// Good
it('should return 401 when user is not authenticated', ...)
it('should create ticket with valid data', ...)

// Bad
it('works', ...)
it('test 1', ...)
```

### 3. AAA Pattern

Follow the Arrange-Act-Assert pattern:

```typescript
it('should update ticket status', async () => {
  // Arrange
  const user = await createMockUser(mockDb.db)
  const ticket = createMockTicket(mockDb.db, { user_id: user.id })

  // Act
  const result = updateTicketStatus(ticket.id, 2)

  // Assert
  expect(result).toBe(true)
  expect(getTicketById(ticket.id).status_id).toBe(2)
})
```

### 4. Test Error Cases

Always test both success and failure paths:

```typescript
describe('authenticateUser', () => {
  it('should authenticate valid credentials', ...)
  it('should reject invalid password', ...)
  it('should reject non-existent user', ...)
  it('should reject empty credentials', ...)
})
```

### 5. Use Test Utilities

Leverage the provided test utilities to reduce boilerplate:

```typescript
// Good - Using utilities
const { request, user } = await setupAuthContext('admin')

// Bad - Manual setup
const user = { id: 1, email: 'admin@example.com', role: 'admin' }
const token = await generateToken(user)
const request = createRequest({ headers: { Authorization: `Bearer ${token}` }})
```

## Coverage Reports

### Generate Coverage

```bash
npm run test:unit:coverage
```

Coverage reports are generated in:
- **HTML Report**: `coverage/index.html`
- **JSON Report**: `coverage/coverage-final.json`
- **Text Report**: Terminal output

### Coverage Goals

Target coverage thresholds:
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### View Coverage Report

```bash
# Generate and open HTML report
npm run test:unit:coverage
open coverage/index.html
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

### Test Scripts in CI

```yaml
# Example .github/workflows/test.yml
- name: Run unit tests
  run: npm run test:unit

- name: Run integration tests
  run: npm run test:integration

- name: Run E2E tests
  run: npm run test:e2e

- name: Generate coverage
  run: npm run test:unit:coverage
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```typescript
// Ensure cleanup in afterEach
afterEach(() => {
  if (mockDb) {
    cleanupTestDatabase(mockDb)
  }
})
```

#### Timeout Errors

```typescript
// Increase timeout for slow tests
it('slow test', async () => {
  // ...
}, 10000)  // 10 second timeout
```

#### Authentication Errors

```typescript
// Ensure JWT_SECRET is set in test environment
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long'
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [k6 Documentation](https://k6.io/docs/)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage above 80%
4. Update this documentation if needed

## Questions?

For questions about testing:
- Check existing tests for examples
- Review test utilities in `tests/utils/`
- Consult this documentation
- Ask the development team
