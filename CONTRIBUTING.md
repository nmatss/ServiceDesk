# Contributing to ServiceDesk

Thank you for your interest in contributing to ServiceDesk! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [CI/CD Pipeline](#cicd-pipeline)
- [Security](#security)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+ or 20+ (LTS versions)
- npm 9+
- Git
- SQLite (for local development)

### Initial Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ServiceDesk.git
   cd ServiceDesk
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Initialize the database:**
   ```bash
   npm run init-db
   ```

5. **Verify setup:**
   ```bash
   npm run validate
   npm run test:unit
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to see the application running.

## Development Workflow

### Branch Strategy

We use a simplified Git Flow strategy:

- `main` - Production-ready code
- `develop` - Development branch (integration)
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Emergency production fixes
- `chore/*` - Maintenance tasks (deps, config, etc.)

### Creating a New Feature

1. **Create a feature branch:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write code following our [coding standards](#coding-standards)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes:**
   ```bash
   npm run validate          # Lint, type-check, format
   npm run test:unit         # Unit tests
   npm run test:e2e          # E2E tests
   npm run build             # Verify build
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   # Create PR via GitHub UI
   ```

## Coding Standards

### TypeScript

- **Strict mode enabled** - No implicit `any`, proper null checks
- **Use TypeScript types** - Avoid `any`, prefer interfaces/types
- **Path aliases** - Use `@/` for imports from `lib/` or `app/`

```typescript
// Good
import { getUserById } from '@/lib/db/queries';
import type { User } from '@/lib/types/database';

// Bad
import { getUserById } from '../../../lib/db/queries';
```

### Code Style

We use ESLint and Prettier for code formatting:

```bash
npm run lint              # Check for issues
npm run lint:fix          # Auto-fix issues
npm run format            # Format code
npm run format:check      # Check formatting
```

**Key rules:**
- Use `const` over `let`, avoid `var`
- Prefer arrow functions for callbacks
- Use async/await over raw Promises
- Destructure objects and arrays
- Use template literals for strings

### Component Structure

```typescript
// components/MyComponent.tsx
import { useState } from 'react';
import type { ComponentProps } from '@/lib/types';

interface MyComponentProps extends ComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState(false);

  return (
    <div className="component-wrapper">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

### Database Queries

- **Use existing query functions** from `lib/db/queries.ts`
- **Type-safe queries** - Always use TypeScript interfaces
- **Error handling** - Wrap queries in try/catch
- **Transactions** - Use for multi-step operations

```typescript
import { db } from '@/lib/db/connection';
import type { Ticket } from '@/lib/types/database';

export async function createTicket(data: Partial<Ticket>): Promise<Ticket> {
  try {
    const stmt = db.prepare(`
      INSERT INTO tickets (title, description, user_id)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(data.title, data.description, data.user_id);
    return getTicketById(result.lastInsertRowid as number);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    throw new Error('Failed to create ticket');
  }
}
```

## Testing Guidelines

### Unit Tests (Vitest)

- **Location:** `__tests__/` directories or `*.test.ts` files
- **Coverage:** Aim for 80%+ coverage
- **Naming:** `describe` blocks for components/functions, `it` for test cases

```typescript
// lib/utils/__tests__/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from '../helpers';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2025-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2025');
  });

  it('should handle invalid dates', () => {
    expect(() => formatDate(null)).toThrow();
  });
});
```

### E2E Tests (Playwright)

- **Location:** `tests/e2e/` directory
- **Coverage:** Critical user flows
- **Tags:** Use `@smoke`, `@critical`, `@regression`

```typescript
// tests/e2e/tickets.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Ticket Management', () => {
  test('should create a new ticket @smoke', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.fill('[name="title"]', 'Test Ticket');
    await page.fill('[name="description"]', 'Test description');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tickets\/\d+/);
    await expect(page.locator('h1')).toContainText('Test Ticket');
  });
});
```

### Running Tests

```bash
# Unit tests
npm run test:unit              # Run once
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With coverage
npm run test:unit:ui           # Visual UI

# E2E tests
npm run test:e2e               # Headless
npm run test:e2e:watch         # Watch mode
npx playwright test --ui       # Interactive UI

# All tests
npm test
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, missing semicolons, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvement
- `test` - Adding/updating tests
- `chore` - Maintenance (deps, build, CI, etc.)
- `ci` - CI/CD changes
- `security` - Security fixes

### Examples

```bash
# Feature
feat(tickets): add bulk delete functionality

# Bug fix
fix(auth): resolve JWT token expiration issue

# Breaking change
feat(api)!: change tickets API response format

BREAKING CHANGE: Tickets API now returns paginated results

# Chore
chore(deps): update dependencies to latest versions

# Security
security(auth): patch XSS vulnerability in user input
```

## Pull Request Process

### Before Creating a PR

1. **Sync with develop:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout your-branch
   git rebase develop
   ```

2. **Run validation:**
   ```bash
   npm run validate
   npm test
   npm run build
   ```

3. **Update documentation:**
   - Update README if needed
   - Add JSDoc comments for new functions
   - Update CHANGELOG.md (if applicable)

### PR Checklist

When creating a PR, ensure:

- [ ] Code follows project coding standards
- [ ] Tests added/updated for new functionality
- [ ] All tests pass locally
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts with `develop`
- [ ] PR title follows conventional commits format
- [ ] PR description explains what/why/how

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. **Automated checks** - CI pipeline must pass
2. **Code review** - At least 1 approval required
3. **Security review** - For security-sensitive changes
4. **Testing** - Verify in staging environment

### Merging

- Use **Squash and merge** for feature branches
- Use **Merge commit** for release branches
- Delete branch after merge

## CI/CD Pipeline

### Workflows

Our CI/CD pipeline includes:

#### CI Pipeline (`ci.yml`)
Runs on every push and PR:
- Linting (ESLint)
- Format check (Prettier)
- Type checking (TypeScript)
- Unit tests (Vitest) - Node 18 & 20
- E2E tests (Playwright) - Sharded
- Security audit (npm audit, Trivy)
- Build verification - Node 18 & 20
- Bundle size analysis (PR only)
- Database migration check

#### Security Pipeline (`security.yml`)
Runs daily and on push:
- CodeQL analysis
- Secret scanning (TruffleHog, Gitleaks)
- SAST (Semgrep)
- Dependency vulnerabilities
- Container scanning
- IaC scanning (Checkov)
- License compliance

#### Dependency Management (`dependencies.yml`)
Runs weekly:
- Dependency analysis
- Security audit
- License compliance
- Auto-update PR creation
- Bundle size impact (PR only)

#### Deployment (`deploy-staging.yml`, `deploy-production.yml`)
- **Staging:** Auto-deploy on push to `main`/`develop`
- **Production:** Manual approval required for tag `v*`

### Status Checks

All PRs must pass:
- ✅ Lint
- ✅ Format check
- ✅ Type check
- ✅ Unit tests
- ✅ E2E tests
- ✅ Build
- ✅ Security scan

### Artifacts

CI generates artifacts:
- Test coverage reports
- Playwright reports
- Build outputs
- Security scan results

Access via GitHub Actions tab.

## Security

### Reporting Vulnerabilities

**Do NOT create public issues for security vulnerabilities.**

Instead:
1. Email security contact (if available)
2. Use GitHub Security Advisories
3. Include detailed description and reproduction steps

### Security Best Practices

- **Never commit secrets** - Use environment variables
- **Validate all inputs** - Use Zod schemas
- **Sanitize user data** - Prevent XSS/SQL injection
- **Use HTTPS** - Always in production
- **Keep dependencies updated** - Review Dependabot PRs
- **Follow OWASP guidelines** - Top 10 security risks

### Environment Variables

Never commit `.env` files. Required variables:

```bash
# .env.example
DATABASE_URL=sqlite:./servicedesk.db
JWT_SECRET=your-secret-here
NODE_ENV=development
```

## Additional Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)

### Project-Specific
- Architecture overview: `CLAUDE.md`
- Database schema: `lib/db/schema.sql`
- API routes: `app/api/`
- Type definitions: `lib/types/`

## Questions?

If you have questions:
1. Check existing issues/discussions
2. Review documentation
3. Ask in discussions
4. Create a new issue

---

Thank you for contributing to ServiceDesk!
