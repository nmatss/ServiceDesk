# Testing Guide

Complete guide to testing in ServiceDesk.

## Test Stack

- **Unit**: Vitest
- **E2E**: Playwright
- **Security**: Custom tests + OWASP ZAP
- **Accessibility**: axe-core, Pa11y

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests

```bash
npm run test:unit
npm run test:unit:watch
npm run test:unit:coverage
```

### E2E Tests

```bash
npm run test:e2e
npm run test:e2e:watch
```

### Security Tests

```bash
npm run test:security
```

### Accessibility Tests

```bash
npm run test:a11y
```

## Writing Tests

### Unit Test Example

```typescript
// ticket.test.ts
import { describe, it, expect } from 'vitest';
import { createTicket } from './ticket';

describe('createTicket', () => {
  it('creates ticket with valid data', () => {
    const ticket = createTicket({
      title: 'Test',
      description: 'Description'
    });
    expect(ticket).toBeDefined();
    expect(ticket.title).toBe('Test');
  });
});
```

### E2E Test Example

```typescript
// login.spec.ts
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

## Coverage

Target coverage: 80%

View coverage report:

```bash
npm run test:unit:coverage
open coverage/index.html
```

## CI Integration

Tests run automatically on:
- Every push
- Every PR
- Scheduled (daily)

## Best Practices

1. Write tests before code (TDD)
2. Test edge cases
3. Mock external dependencies
4. Keep tests fast
5. Use descriptive test names
