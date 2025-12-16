# Integration Tests

Comprehensive integration tests for ServiceDesk API endpoints.

## Overview

This test suite provides end-to-end testing for all major API endpoints including authentication, tickets, knowledge base, and admin operations.

## Test Structure

```
tests/integration/
├── setup.ts              # Test database setup and utilities
├── auth.test.ts          # Authentication API tests
├── tickets.test.ts       # Ticket CRUD and lifecycle tests
├── knowledge.test.ts     # Knowledge base tests
└── admin.test.ts         # Admin operations tests
```

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test Suite
```bash
npm run test:integration -- auth.test.ts
npm run test:integration -- tickets.test.ts
npm run test:integration -- knowledge.test.ts
npm run test:integration -- admin.test.ts
```

### Run with Coverage
```bash
npm run test:integration:coverage
```

### Watch Mode
```bash
npm run test:integration:watch
```

## Test Database

All integration tests use an **in-memory SQLite database** that is:
- Created fresh before each test suite
- Seeded with consistent test data
- Isolated per test (data cleared between tests)
- Automatically cleaned up after tests complete

### Test Data

The test database is pre-seeded with:

#### Tenant
- **ID**: 1
- **Slug**: test-tenant
- **Name**: Test Organization

#### Users
- **Admin**: admin@test.com (password: AdminPass123!)
- **Agent**: agent@test.com (password: AgentPass123!)
- **User**: user@test.com (password: UserPass123!)

#### Categories
1. Technical
2. Billing
3. General

#### Priorities
1. Low
2. Medium
3. High
4. Critical

#### Statuses
1. Open
2. In Progress
3. Resolved
4. Closed

#### Ticket Types
1. Incident
2. Request
3. Problem

#### KB Categories
1. Getting Started
2. Troubleshooting

## Test Coverage

### Authentication Tests (auth.test.ts)
- ✅ User registration (valid/invalid data)
- ✅ Login/logout flows
- ✅ Token verification
- ✅ Profile management
- ✅ Password validation
- ✅ Account lockout after failed attempts
- ✅ Rate limiting
- ✅ XSS prevention
- ✅ Cookie security

### Ticket Tests (tickets.test.ts)
- ✅ Ticket creation and validation
- ✅ Listing and filtering tickets
- ✅ Update ticket status
- ✅ Delete tickets
- ✅ Add/view comments
- ✅ Add attachments
- ✅ Tenant isolation
- ✅ Role-based permissions
- ✅ SLA tracking
- ✅ Audit logging
- ✅ Workflow automation

### Knowledge Base Tests (knowledge.test.ts)
- ✅ Article CRUD operations
- ✅ Article search (title, content, keywords)
- ✅ Category management
- ✅ Article feedback (helpful votes)
- ✅ Article tagging
- ✅ Slug generation
- ✅ Draft vs published articles
- ✅ Featured articles
- ✅ View count tracking
- ✅ Pagination

### Admin Tests (admin.test.ts)
- ✅ User management (list, get, update, delete)
- ✅ Report generation
- ✅ Audit log retrieval
- ✅ SLA statistics
- ✅ Admin-only access control
- ✅ Tenant isolation
- ✅ Security logging
- ✅ Role management

## Test Utilities

### Setup Functions

```typescript
import {
  getTestDb,
  generateTestToken,
  getAuthHeaders,
  createMockRequest,
  getResponseJSON,
  createTestTicket,
  createTestArticle
} from './setup';
```

### Creating Authenticated Requests

```typescript
// Create request with authentication
const request = await createMockRequest('/api/tickets', {
  method: 'GET',
  userId: TEST_USERS.user.id
});

// Create request with custom headers
const request = await createMockRequest('/api/tickets/create', {
  method: 'POST',
  userId: TEST_USERS.user.id,
  body: {
    title: 'Test Ticket',
    description: 'Description'
  }
});
```

### Working with Test Data

```typescript
// Create test ticket
const ticketId = createTestTicket({
  title: 'Test Ticket',
  description: 'Description',
  user_id: TEST_USERS.user.id
});

// Create test article
const articleId = createTestArticle({
  title: 'Test Article',
  content: 'Content',
  author_id: TEST_USERS.admin.id,
  status: 'published'
});

// Access test database
const db = getTestDb();
const result = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
```

## Writing New Tests

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { GET as getEndpoint } from '@/app/api/your-endpoint/route';
import { createMockRequest, getResponseJSON, TEST_USERS } from './setup';

describe('Your Endpoint Tests', () => {
  it('should do something', async () => {
    const request = await createMockRequest('/api/your-endpoint', {
      method: 'GET',
      userId: TEST_USERS.user.id
    });

    const response = await getEndpoint(request as any);
    const data = await getResponseJSON(response);

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });
});
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Don't rely on execution order
- Clean up test data in `beforeEach`

### 2. Use Descriptive Test Names
```typescript
// Good
it('should reject registration with weak password', async () => {});

// Bad
it('test password', async () => {});
```

### 3. Test Both Success and Failure Paths
```typescript
it('should create ticket successfully', async () => {});
it('should reject ticket with missing title', async () => {});
```

### 4. Verify Database State
```typescript
// After creating a resource, verify it exists
const response = await createTicket(request);
const db = getTestDb();
const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
expect(ticket).toBeDefined();
```

### 5. Test Security
```typescript
// Test authentication
it('should require authentication', async () => {
  const request = await createMockRequest('/api/protected', {
    method: 'GET'
    // No userId
  });
  const response = await handler(request);
  expect(response.status).toBe(401);
});

// Test authorization
it('should deny access to non-admin', async () => {
  const request = await createMockRequest('/api/admin/endpoint', {
    method: 'GET',
    userId: TEST_USERS.user.id // Regular user
  });
  const response = await handler(request);
  expect(response.status).toBe(403);
});

// Test tenant isolation
it('should enforce tenant isolation', async () => {
  const response = await getTickets(request);
  const data = await getResponseJSON(response);

  data.tickets.forEach(ticket => {
    expect(ticket.tenant_id).toBe(TEST_TENANT.id);
  });
});
```

## Debugging Tests

### Enable Verbose Output
```bash
npm run test:integration -- --reporter=verbose
```

### Run Single Test
```bash
npm run test:integration -- -t "should create ticket successfully"
```

### Inspect Test Database
```typescript
it('debug test', () => {
  const db = getTestDb();
  const users = db.prepare('SELECT * FROM users').all();
  console.log('Users:', users);
});
```

## CI/CD Integration

These tests are automatically run in CI/CD pipelines:

```yaml
# .github/workflows/ci.yml
- name: Run Integration Tests
  run: npm run test:integration
```

## Performance

- **In-memory database**: Tests run fast (~50-100ms per test)
- **Parallel execution**: Tests run in parallel when possible
- **Minimal I/O**: No file system operations

## Troubleshooting

### Tests Hanging
- Check for missing `await` on async operations
- Ensure database connections are closed

### Failed Assertions
- Verify test data is seeded correctly
- Check tenant isolation
- Ensure authentication tokens are valid

### Database Errors
- Schema may have changed - update setup.ts
- Check foreign key constraints
- Verify trigger behavior

## Coverage Goals

Target coverage for integration tests:
- **API Endpoints**: 90%+
- **Authentication Flow**: 95%+
- **CRUD Operations**: 90%+
- **Authorization**: 95%+

## Future Enhancements

- [ ] Add performance benchmarks
- [ ] Test concurrent operations
- [ ] Test database transactions
- [ ] Add API contract testing
- [ ] Test rate limiting edge cases
- [ ] Add load testing scenarios
