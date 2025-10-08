# Contributing to ServiceDesk

Thank you for your interest in contributing to ServiceDesk! This document provides guidelines and best practices for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)
9. [Issue Reporting](#issue-reporting)
10. [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. By participating in this project, you agree to:

- Be respectful and considerate of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or derogatory comments
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Instances of unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Forked the repository** on GitHub
2. **Cloned your fork** locally
3. **Set up the development environment** (see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md))
4. **Read the documentation** in the `docs/` folder

### First-Time Contributors

Looking for a good first issue? Check out:

- [Good First Issue](https://github.com/your-org/ServiceDesk/labels/good%20first%20issue) - Beginner-friendly issues
- [Help Wanted](https://github.com/your-org/ServiceDesk/labels/help%20wanted) - Issues needing assistance
- [Documentation](https://github.com/your-org/ServiceDesk/labels/documentation) - Documentation improvements

### Setting Up Your Development Environment

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/ServiceDesk.git
cd ServiceDesk

# 2. Add upstream remote
git remote add upstream https://github.com/your-org/ServiceDesk.git

# 3. Install dependencies
npm install

# 4. Initialize database
npm run init-db

# 5. Create a feature branch
git checkout -b feature/my-awesome-feature

# 6. Start developing!
npm run dev
```

---

## Development Process

### Workflow Overview

```
1. Find/Create Issue → 2. Fork & Branch → 3. Develop & Test →
4. Commit → 5. Push → 6. Pull Request → 7. Code Review → 8. Merge
```

### Step-by-Step Guide

#### 1. Find or Create an Issue

- **Search existing issues** before creating a new one
- **Comment on the issue** to indicate you're working on it
- **Get assigned** to avoid duplicate work

#### 2. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/descriptive-name

# Branch naming conventions:
# - feature/add-ticket-filters
# - fix/authentication-bug
# - refactor/optimize-queries
# - docs/update-api-docs
# - test/add-e2e-tests
```

#### 3. Make Your Changes

- **Write clean, readable code** following our [coding standards](#coding-standards)
- **Add tests** for new features
- **Update documentation** as needed
- **Keep commits atomic** - one logical change per commit

#### 4. Test Your Changes

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Unit tests
npm run test:unit

# E2E tests (if applicable)
npm run test:e2e

# Build test
npm run build
```

#### 5. Commit Your Changes

Follow our [commit guidelines](#commit-guidelines):

```bash
git add .
git commit -m "feat(tickets): add advanced filtering options"
```

#### 6. Keep Your Branch Updated

```bash
# Regularly sync with upstream
git fetch upstream
git rebase upstream/main
```

#### 7. Push to Your Fork

```bash
git push origin feature/my-awesome-feature
```

#### 8. Create a Pull Request

- Go to GitHub and create a PR from your branch
- Fill out the PR template completely
- Link related issues (e.g., "Closes #123")
- Request review from maintainers

---

## Coding Standards

### TypeScript

#### 1. Type Safety

```typescript
// ✅ Good - Explicit types
interface User {
  id: number;
  email: string;
  role: 'admin' | 'agent' | 'user';
}

function getUser(id: number): User | null {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null;
}

// ❌ Bad - Using 'any'
function getUser(id: any): any {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
```

#### 2. Strict Null Checks

```typescript
// ✅ Good - Handle null/undefined
const user = getUser(id);
if (user) {
  console.log(user.email);
}

// ❌ Bad - Assuming non-null
const user = getUser(id);
console.log(user.email); // Possible error
```

#### 3. Immutability

```typescript
// ✅ Good - Immutable updates
const updatedTicket = { ...ticket, status: 'resolved' };

// ❌ Bad - Mutating original
ticket.status = 'resolved';
```

### React/Next.js

#### 1. Component Structure

```typescript
// ✅ Good - Well-structured component
interface TicketCardProps {
  ticket: Ticket;
  onUpdate?: (ticket: Ticket) => void;
}

export function TicketCard({ ticket, onUpdate }: TicketCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(() => {
    // Handler logic
  }, [ticket.id]);

  return (
    <div className="ticket-card">
      {/* JSX */}
    </div>
  );
}
```

#### 2. Hooks Usage

```typescript
// ✅ Good - Proper dependency array
useEffect(() => {
  fetchTickets(userId);
}, [userId]);

// ❌ Bad - Missing dependencies
useEffect(() => {
  fetchTickets(userId);
}, []); // Warning: missing 'userId'
```

#### 3. Error Boundaries

```typescript
// Wrap risky components in error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <TicketList tickets={tickets} />
</ErrorBoundary>
```

### CSS/Tailwind

#### 1. Use Tailwind Utilities

```tsx
// ✅ Good - Tailwind utilities
<div className="flex items-center justify-between p-4 rounded-lg shadow-md">

// ❌ Bad - Inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

#### 2. Custom Classes Only When Necessary

```tsx
// ✅ Good - Reusable Tailwind pattern
<button className="btn-primary">Submit</button>

// tailwind.config.js
{
  components: {
    '.btn-primary': {
      '@apply px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700': {}
    }
  }
}
```

### Database

#### 1. Always Use Parameterized Queries

```typescript
// ✅ Good - Safe from SQL injection
db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

// ❌ Bad - SQL injection vulnerable
db.prepare(`SELECT * FROM tickets WHERE id = ${ticketId}`).get();
```

#### 2. Use Transactions for Multiple Operations

```typescript
// ✅ Good - Atomic operations
const createTicketWithComments = db.transaction((ticket, comments) => {
  const result = db.prepare('INSERT INTO tickets (...) VALUES (...)').run(ticket);
  const ticketId = result.lastInsertRowid;

  for (const comment of comments) {
    db.prepare('INSERT INTO comments (...) VALUES (...)').run(ticketId, comment);
  }
});
```

### API Routes

#### 1. Consistent Response Format

```typescript
// ✅ Good - Consistent format
export async function GET(req: NextRequest) {
  try {
    const tickets = await ticketQueries.getAll();
    return NextResponse.json({ data: tickets }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'FETCH_FAILED', message: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}
```

#### 2. Input Validation

```typescript
// ✅ Good - Validate with Zod
import { z } from 'zod';

const CreateTicketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  priority_id: z.number().int().min(1).max(4)
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = CreateTicketSchema.parse(body); // Throws if invalid
  // ...
}
```

#### 3. Authentication & Authorization

```typescript
// ✅ Good - Check auth before processing
export async function DELETE(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with deletion
}
```

---

## Commit Guidelines

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(tickets): add bulk assignment` |
| `fix` | Bug fix | `fix(auth): resolve token refresh race condition` |
| `refactor` | Code refactoring | `refactor(db): optimize query performance` |
| `docs` | Documentation | `docs(api): add filtering examples` |
| `style` | Code style (formatting) | `style: fix indentation in header` |
| `test` | Add/update tests | `test(tickets): add E2E tests for creation` |
| `chore` | Maintenance | `chore: update dependencies` |
| `perf` | Performance improvement | `perf(db): add index to tickets.status` |
| `ci` | CI/CD changes | `ci: add Playwright to GitHub Actions` |

### Commit Message Examples

#### Good Commits

```
feat(tickets): add advanced filtering options

- Add status, priority, and date range filters
- Implement client-side filter state management
- Add URL query parameter sync

Closes #123

---

fix(auth): prevent duplicate token refresh requests

Added mutex lock to ensure only one refresh request
is in flight at a time.

Fixes #456

---

refactor(db): optimize ticket query performance

- Reduced query time from 2.3s to 0.6s
- Added compound index on (status, priority, created_at)
- Implemented query result caching with 5min TTL

Performance improvement: 74%
```

#### Bad Commits

```
❌ update stuff
❌ fix bug
❌ WIP
❌ asdfasdf
❌ final final final
```

### Commit Best Practices

1. **Keep commits atomic** - One logical change per commit
2. **Write descriptive messages** - Explain what and why, not how
3. **Reference issues** - Use "Closes #123" or "Fixes #456"
4. **Use present tense** - "add feature" not "added feature"
5. **Capitalize subject line** - "Fix bug" not "fix bug"
6. **Limit subject to 50 characters** - Use body for details
7. **Separate subject from body** - Blank line between them

---

## Pull Request Process

### Before Creating a PR

- [ ] All tests pass (`npm test`)
- [ ] Code is properly typed (`npm run type-check`)
- [ ] Code is linted (`npm run lint`)
- [ ] Documentation is updated
- [ ] Commits follow conventional commit format
- [ ] Branch is up to date with `main`

### PR Title Format

Use the same format as commits:

```
feat(tickets): add bulk assignment feature
fix(auth): resolve token refresh race condition
docs(api): add filtering examples
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Closes #123
Fixes #456

## Changes Made
- Added bulk ticket assignment feature
- Implemented role-based filtering
- Added optimistic UI updates

## Screenshots (if applicable)
![Screenshot](url)

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Code Review Process

1. **Automated Checks** - CI pipeline must pass
2. **Peer Review** - At least 1 approval required
3. **Maintainer Review** - For significant changes
4. **Address Feedback** - Respond to all comments
5. **Approval** - All reviewers approve
6. **Merge** - Maintainer merges to main

### Responding to Review Comments

```markdown
✅ Good Response:
"Great catch! Fixed in abc1234. I also added a test case to prevent regression."

❌ Bad Response:
"Fixed"
"done"
"ok"
```

### When Your PR is Approved

1. **Squash commits** if requested
2. **Rebase on main** to ensure clean history
3. **Wait for maintainer merge** - Don't merge your own PR

---

## Testing Requirements

### Unit Tests (Required)

All new features and bug fixes must include unit tests:

```typescript
// tests/unit/lib/ticket-utils.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSLA } from '@/lib/tickets/sla';

describe('SLA Calculation', () => {
  it('should calculate correct SLA for high priority tickets', () => {
    const result = calculateSLA('high', new Date('2024-01-01'));
    expect(result).toBe('2024-01-01T04:00:00Z'); // 4 hours
  });
});
```

### Integration Tests (Recommended)

For API routes and database operations:

```typescript
// tests/integration/api/tickets.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

describe('Tickets API', () => {
  beforeAll(() => {
    // Setup test database
  });

  it('POST /api/tickets creates a new ticket', async () => {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', description: 'Test' })
    });
    expect(response.status).toBe(201);
  });
});
```

### E2E Tests (For UI Changes)

User-facing changes should include Playwright tests:

```typescript
// tests/e2e/tickets.spec.ts
import { test, expect } from '@playwright/test';

test('should create a new ticket', async ({ page }) => {
  await page.goto('/tickets/new');
  await page.fill('[name="title"]', 'Bug report');
  await page.fill('[name="description"]', 'Description here');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/tickets\/\d+/);
  await expect(page.locator('h1')).toContainText('Bug report');
});
```

### Test Coverage

Aim for these coverage targets:

- **Overall**: > 80%
- **Critical paths** (auth, payments): > 95%
- **Business logic**: > 90%
- **UI components**: > 70%

```bash
# Check coverage
npm run test:unit:coverage
```

---

## Documentation

### When to Update Documentation

Update documentation when you:

- Add new features
- Change existing behavior
- Add new API endpoints
- Modify configuration options
- Fix bugs that affect documented behavior

### Documentation Types

#### 1. Code Comments

```typescript
/**
 * Calculates SLA deadline based on priority and creation time.
 *
 * @param priority - Ticket priority level (1-4)
 * @param createdAt - Ticket creation timestamp
 * @returns ISO 8601 deadline timestamp
 *
 * @example
 * calculateSLA('high', new Date('2024-01-01'))
 * // Returns: '2024-01-01T04:00:00Z' (4 hours from creation)
 */
export function calculateSLA(priority: string, createdAt: Date): string {
  // Implementation
}
```

#### 2. README Updates

Update `README.md` for:
- Installation changes
- Configuration changes
- New CLI commands

#### 3. API Documentation

Update `docs/api/README.md` for:
- New endpoints
- Changed request/response formats
- New authentication methods

#### 4. Developer Guide

Update `docs/DEVELOPER_GUIDE.md` for:
- New development workflows
- Architecture changes
- New patterns/conventions

---

## Issue Reporting

### Before Creating an Issue

1. **Search existing issues** - Your issue may already exist
2. **Check documentation** - The answer might be there
3. **Try the latest version** - Bug might be fixed
4. **Prepare a minimal reproduction** - Helps us fix faster

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable

## Environment
- OS: [e.g., macOS 13.0]
- Browser: [e.g., Chrome 120]
- Node.js: [e.g., 20.10.0]
- ServiceDesk version: [e.g., 1.2.3]

## Additional Context
Any other relevant information
```

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Problem Statement
What problem does this solve?

## Proposed Solution
How should this work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Mockups, examples, etc.
```

---

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Slack/Discord** - Real-time chat (if available)
- **Email** - security@servicedesk.com for security issues

### Getting Help

1. **Check documentation first**
2. **Search existing issues/discussions**
3. **Ask in GitHub Discussions**
4. **Be respectful and patient**

### Recognition

Contributors are recognized in:

- `CONTRIBUTORS.md` file
- Release notes
- Project README

---

## License

By contributing to ServiceDesk, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](../LICENSE) file).

---

## Questions?

If you have questions about contributing, please:

1. Check the [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
2. Search [GitHub Discussions](https://github.com/your-org/ServiceDesk/discussions)
3. Open a new discussion
4. Contact the maintainers

---

**Thank you for contributing to ServiceDesk!**
