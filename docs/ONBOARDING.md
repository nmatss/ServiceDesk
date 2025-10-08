# Developer Onboarding Checklist

Welcome to the ServiceDesk development team! This checklist will guide you through your first week and help you get productive quickly.

## Table of Contents

- [Before Your First Day](#before-your-first-day)
- [Day 1: Environment Setup](#day-1-environment-setup)
- [Day 2: Codebase Exploration](#day-2-codebase-exploration)
- [Day 3: First Contribution](#day-3-first-contribution)
- [Day 4: Testing & Quality](#day-4-testing--quality)
- [Day 5: Deployment & CI/CD](#day-5-deployment--cicd)
- [Week 2+: Advanced Topics](#week-2-advanced-topics)
- [Resources](#resources)
- [Getting Help](#getting-help)

---

## Before Your First Day

### Account Access

- [ ] GitHub account created and added to organization
- [ ] Slack/Discord workspace invitation accepted
- [ ] Email account configured
- [ ] VPN access configured (if required)
- [ ] Password manager set up (1Password, LastPass, etc.)

### Hardware & Software

- [ ] Development machine received and configured
- [ ] Node.js v20+ installed
- [ ] Git installed and configured
- [ ] VSCode or preferred IDE installed
- [ ] Docker Desktop installed (optional but recommended)

---

## Day 1: Environment Setup

**Goal**: Get the application running locally

### Morning (9:00 AM - 12:00 PM)

#### 1. Team Introduction

- [ ] Meet your team lead and teammates
- [ ] Understand team structure and roles
- [ ] Get added to relevant Slack channels
- [ ] Schedule recurring 1-on-1 with manager

#### 2. Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ServiceDesk.git
cd ServiceDesk

# Install dependencies
npm install

# Initialize database
npm run init-db
```

- [ ] Repository cloned successfully
- [ ] Dependencies installed without errors
- [ ] Database initialized with seed data

#### 3. VSCode Configuration

Install recommended extensions:

```
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
- TypeScript Error Translator (mattpocock.ts-error-translator)
- GitLens (eamodio.gitlens)
```

- [ ] All recommended extensions installed
- [ ] VSCode settings configured
- [ ] ESLint and Prettier working

### Afternoon (1:00 PM - 5:00 PM)

#### 4. Run the Application

```bash
# Start development server
npm run dev

# Open browser to http://localhost:3000
```

- [ ] Development server starts without errors
- [ ] Landing page loads successfully
- [ ] Can navigate to login page
- [ ] Can log in with seed user credentials

**Test Login Credentials:**
- Admin: `admin@example.com` / `password`
- Agent: `agent1@example.com` / `password`
- User: `user1@example.com` / `password`

#### 5. Explore the Application

Navigate through the main features:

- [ ] User Portal - Create a test ticket
- [ ] Admin Dashboard - View tickets and statistics
- [ ] Knowledge Base - Browse articles
- [ ] Analytics - View charts and metrics
- [ ] User Profile - Update profile information

#### 6. Read Documentation

Spend time reading:

- [ ] [README.md](/home/nic20/ProjetosWeb/ServiceDesk/README.md) - Project overview
- [ ] [CLAUDE.md](/home/nic20/ProjetosWeb/ServiceDesk/CLAUDE.md) - Development guidance
- [ ] [DEVELOPER_GUIDE.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/DEVELOPER_GUIDE.md) - Comprehensive dev guide
- [ ] [docs/api/README.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/api/README.md) - API documentation

### End of Day 1

**Self-Assessment:**
- Can you run the application locally? ✅/❌
- Can you navigate the UI? ✅/❌
- Have you read the core documentation? ✅/❌

**Tomorrow's Preview**: We'll explore the codebase architecture and directory structure.

---

## Day 2: Codebase Exploration

**Goal**: Understand the codebase structure and key components

### Morning (9:00 AM - 12:00 PM)

#### 1. Architecture Overview

Review the project structure:

```
ServiceDesk/
├── app/              # Next.js App Router (UI + API)
├── lib/              # Business logic & utilities
├── src/              # React components
├── public/           # Static assets
├── scripts/          # Utility scripts
└── tests/            # Test files
```

- [ ] Understand the purpose of each top-level directory
- [ ] Know where to find API routes (`app/api/`)
- [ ] Know where to find components (`src/components/`)
- [ ] Know where to find business logic (`lib/`)

#### 2. Database Exploration

Open `lib/db/schema.sql` and review the database structure:

- [ ] Understand the 18 core tables
- [ ] Review relationships between tables
- [ ] Understand the seed data in `lib/db/seed.ts`

**Key Tables:**
- `users` - User accounts (admin, agent, user)
- `tickets` - Support tickets
- `comments` - Ticket comments
- `sla_policies` - SLA rules
- `kb_articles` - Knowledge base articles
- `notifications` - User notifications

```bash
# Test database connection
npm run test-db

# View database schema
cat lib/db/schema.sql | less
```

- [ ] Can identify main tables
- [ ] Understand ticket workflow (statuses, priorities)
- [ ] Understand authentication model

#### 3. Authentication System

Review authentication implementation:

**Files to explore:**
- `lib/auth/sqlite-auth.ts` - JWT authentication
- `middleware.ts` - Route protection
- `app/api/auth/login/route.ts` - Login endpoint
- `app/api/auth/register/route.ts` - Registration endpoint

- [ ] Understand JWT flow (access + refresh tokens)
- [ ] Understand role-based access control (admin, agent, user)
- [ ] Understand middleware route protection

### Afternoon (1:00 PM - 5:00 PM)

#### 4. Frontend Components

Explore key React components:

**Admin Dashboard:**
- `src/components/admin/AdminDashboard.tsx`
- `src/components/analytics/OverviewCards.tsx`
- `src/components/analytics/TicketTrendChart.tsx`

**Ticket System:**
- `src/components/tickets/SmartTicketForm.tsx`
- `src/components/tickets/TicketCard.tsx`
- `src/components/tickets/TicketList.tsx`

- [ ] Understand component structure
- [ ] See how props and state are managed
- [ ] Notice TypeScript usage

#### 5. API Routes

Explore API implementation:

**Key endpoints:**
- `app/api/tickets/route.ts` - List and create tickets
- `app/api/tickets/[id]/route.ts` - Get, update, delete ticket
- `app/api/auth/login/route.ts` - Authentication
- `app/api/analytics/route.ts` - Analytics data

- [ ] Understand Next.js API route structure
- [ ] See how database queries are used
- [ ] Notice error handling patterns

#### 6. Run Tests

```bash
# Run unit tests
npm run test:unit

# Run with UI
npm run test:unit:ui

# Run E2E tests
npm run test:e2e
```

- [ ] All tests pass locally
- [ ] Understand test structure
- [ ] Can navigate test UI

### End of Day 2

**Self-Assessment:**
- Can you find your way around the codebase? ✅/❌
- Do you understand the database structure? ✅/❌
- Have you run the test suite successfully? ✅/❌

**Tomorrow's Preview**: Make your first code contribution!

---

## Day 3: First Contribution

**Goal**: Make a small, meaningful contribution

### Morning (9:00 AM - 12:00 PM)

#### 1. Find a Good First Issue

Browse GitHub issues labeled:
- `good first issue`
- `documentation`
- `help wanted`

**Good starter tasks:**
- Fix typos in documentation
- Add code comments to complex functions
- Improve error messages
- Add validation to forms
- Write missing tests

- [ ] Found a suitable first issue
- [ ] Commented on the issue to claim it
- [ ] Understood the requirements

#### 2. Create a Feature Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b fix/your-issue-name
```

- [ ] Feature branch created with descriptive name
- [ ] Branch is up to date with main

#### 3. Make Your Changes

Example: Adding validation to ticket title

```typescript
// lib/validation/ticket.ts
import { z } from 'zod';

export const CreateTicketSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters')
    .trim(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters'),
  // ... other fields
});
```

- [ ] Changes made following coding standards
- [ ] Code is properly typed (no `any`)
- [ ] Added comments where needed

### Afternoon (1:00 PM - 5:00 PM)

#### 4. Test Your Changes

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Run tests
npm run test:unit

# Test manually in browser
npm run dev
```

- [ ] Type check passes
- [ ] Linting passes
- [ ] Tests pass
- [ ] Manual testing successful

#### 5. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat(validation): add ticket title length validation

- Added min/max length validation
- Improved error messages
- Added trim to remove whitespace

Closes #123"
```

- [ ] Commit message follows conventional format
- [ ] Commit is atomic (one logical change)
- [ ] References the issue number

#### 6. Push and Create PR

```bash
# Push to your fork/branch
git push origin fix/your-issue-name
```

Then create a Pull Request on GitHub:

- [ ] PR title follows conventional commit format
- [ ] PR description is complete
- [ ] Issue is linked (Closes #123)
- [ ] Requested review from team

### End of Day 3

**Self-Assessment:**
- Did you successfully create a PR? ✅/❌
- Did all CI checks pass? ✅/❌
- Are you comfortable with the Git workflow? ✅/❌

**Tomorrow's Preview**: Deep dive into testing practices.

---

## Day 4: Testing & Quality

**Goal**: Master testing practices and quality standards

### Morning (9:00 AM - 12:00 PM)

#### 1. Write Unit Tests

Learn the testing framework by writing tests:

```typescript
// tests/unit/lib/validation.test.ts
import { describe, it, expect } from 'vitest';
import { CreateTicketSchema } from '@/lib/validation/ticket';

describe('Ticket Validation', () => {
  it('should validate valid ticket data', () => {
    const validData = {
      title: 'Valid Ticket Title',
      description: 'This is a valid description with enough characters',
      category_id: 1,
      priority_id: 2
    };

    expect(() => CreateTicketSchema.parse(validData)).not.toThrow();
  });

  it('should reject short title', () => {
    const invalidData = {
      title: 'Hi',
      description: 'Valid description',
      category_id: 1,
      priority_id: 2
    };

    expect(() => CreateTicketSchema.parse(invalidData)).toThrow();
  });
});
```

Tasks:
- [ ] Written 3+ unit tests
- [ ] All tests pass
- [ ] Tests cover edge cases
- [ ] Understand test structure (describe, it, expect)

#### 2. Write Component Tests

Test a React component:

```typescript
// tests/unit/components/TicketCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketCard } from '@/src/components/tickets/TicketCard';

describe('TicketCard', () => {
  it('should render ticket title', () => {
    const ticket = {
      id: 1,
      title: 'Test Ticket',
      status: 'open',
      priority: 'high'
    };

    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
  });
});
```

- [ ] Written component test
- [ ] Understands @testing-library/react
- [ ] Can use screen queries

### Afternoon (1:00 PM - 5:00 PM)

#### 3. Write E2E Tests

Create an end-to-end test with Playwright:

```typescript
// tests/e2e/tickets.spec.ts
import { test, expect } from '@playwright/test';

test('should create a new ticket', async ({ page }) => {
  // Login
  await page.goto('/auth/login');
  await page.fill('[name="email"]', 'user1@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Create ticket
  await page.goto('/portal/create');
  await page.fill('[name="title"]', 'E2E Test Ticket');
  await page.fill('[name="description"]', 'This is a test ticket created by E2E test');
  await page.selectOption('[name="category_id"]', '1');
  await page.selectOption('[name="priority_id"]', '2');
  await page.click('button[type="submit"]');

  // Verify
  await expect(page).toHaveURL(/\/tickets\/\d+/);
  await expect(page.locator('h1')).toContainText('E2E Test Ticket');
});
```

- [ ] Written E2E test
- [ ] Test passes locally
- [ ] Understands page object pattern

#### 4. Review Code Quality Standards

Read and practice:

- [ ] [CODE_QUALITY_REPORT.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/CODE_QUALITY_REPORT.md) - Quality standards
- [ ] [CONTRIBUTING.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/CONTRIBUTING.md) - Contribution guidelines

**Key takeaways:**
- No `any` types
- Explicit return types
- Immutable data structures
- Proper error handling

### End of Day 4

**Self-Assessment:**
- Can you write unit tests? ✅/❌
- Can you write E2E tests? ✅/❌
- Do you understand code quality standards? ✅/❌

**Tomorrow's Preview**: Learn about CI/CD and deployment.

---

## Day 5: Deployment & CI/CD

**Goal**: Understand deployment process and CI/CD pipelines

### Morning (9:00 AM - 12:00 PM)

#### 1. Understand CI/CD Pipeline

Read documentation:
- [ ] [CI_CD_GUIDE.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/CI_CD_GUIDE.md) - Complete CI/CD guide

**Key concepts:**
- CI pipeline runs on every PR
- Includes: linting, type-checking, testing, security scanning
- Deployment pipeline deploys to staging on merge to main
- Automatic rollback on test failure

#### 2. Explore GitHub Actions

Navigate to the Actions tab on GitHub:

- [ ] View recent workflow runs
- [ ] Click on a successful run and explore logs
- [ ] Click on a failed run and understand why it failed
- [ ] View artifacts (test reports, build output)

#### 3. Trigger a Workflow

Make a small change and push:

```bash
# Make a trivial change
echo "# Testing CI" >> README.md

# Commit and push
git add README.md
git commit -m "docs: test CI pipeline"
git push origin your-branch

# Create PR to trigger CI
```

- [ ] PR created
- [ ] CI pipeline triggered
- [ ] All checks passed
- [ ] Understand what each check does

### Afternoon (1:00 PM - 5:00 PM)

#### 4. Review Security Scanning

Understand security tools:

**Snyk**
- Scans dependencies for vulnerabilities
- Suggests fixes

**Trivy**
- Scans filesystem and containers
- Identifies OS vulnerabilities

**npm audit**
- Node.js security audit
- Finds known vulnerabilities

- [ ] Reviewed security scan results
- [ ] Understand how to fix vulnerabilities
- [ ] Know when to create security exceptions

#### 5. Understand Deployment Environments

**Environments:**
- **Development**: Your local machine
- **Staging**: Pre-production testing environment
- **Production**: Live customer-facing environment

**Deployment Flow:**
```
Local → PR → CI Checks → Merge → Deploy to Staging → Smoke Tests → Deploy to Production (manual)
```

- [ ] Understand environment differences
- [ ] Know the deployment flow
- [ ] Know how to rollback

#### 6. Practice Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# Visit http://localhost:3000
```

- [ ] Production build succeeds
- [ ] Application runs in production mode
- [ ] No console errors in browser

### End of Day 5

**Self-Assessment:**
- Do you understand the CI/CD pipeline? ✅/❌
- Can you trigger and monitor workflows? ✅/❌
- Do you know how deployment works? ✅/❌

**Congratulations!** You've completed your first week. You're now ready to take on larger tasks.

---

## Week 2+: Advanced Topics

### Week 2: Database & Backend

- [ ] Write database migrations
- [ ] Optimize database queries
- [ ] Implement new API endpoints
- [ ] Add real-time features with Socket.io
- [ ] Implement caching strategies

### Week 3: Frontend & UX

- [ ] Build complex React components
- [ ] Implement responsive designs
- [ ] Add animations and transitions
- [ ] Optimize bundle size
- [ ] Implement accessibility features

### Week 4: Advanced Features

- [ ] Implement workflow automation
- [ ] Add AI-powered features
- [ ] Build analytics dashboards
- [ ] Integrate external services
- [ ] Add performance monitoring

---

## Resources

### Documentation

- [DEVELOPER_GUIDE.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/DEVELOPER_GUIDE.md) - Comprehensive development guide
- [CONTRIBUTING.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/CONTRIBUTING.md) - How to contribute
- [CODE_QUALITY_REPORT.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/CODE_QUALITY_REPORT.md) - Quality standards
- [CI_CD_GUIDE.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/CI_CD_GUIDE.md) - Deployment guide
- [docs/api/README.md](/home/nic20/ProjetosWeb/ServiceDesk/docs/api/README.md) - API reference

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)

### Team Resources

- Slack channels: `#servicedesk-dev`, `#servicedesk-help`
- Weekly team sync: Mondays 10 AM
- Office hours: Daily 2-3 PM (ask any questions)
- Code review sessions: Wednesdays 3 PM

---

## Getting Help

### When You're Stuck

1. **Search documentation first** - Most answers are in the docs
2. **Search GitHub issues** - Someone may have had the same problem
3. **Ask in Slack** - `#servicedesk-help` channel
4. **Pair programming** - Schedule time with a teammate
5. **Ask your team lead** - They're here to help!

### Communication Guidelines

**Good Question:**
> "I'm trying to implement ticket assignment, but I'm getting a TypeScript error on line 42 of `ticket-form.tsx`. The error says 'Type X is not assignable to type Y'. I've tried casting it to the correct type, but that didn't work. Here's the code snippet... Any suggestions?"

**Vague Question:**
> "My code doesn't work. Help?"

### Debugging Tips

1. Read the error message carefully
2. Use `console.log` strategically (but remove before committing!)
3. Use VSCode debugger with breakpoints
4. Check the Network tab in DevTools for API issues
5. Search Google/Stack Overflow for error messages

---

## Onboarding Checklist Summary

### Week 1 Essentials

- [ ] Development environment set up
- [ ] Application running locally
- [ ] Core documentation read
- [ ] First PR created
- [ ] Tests written and passing
- [ ] CI/CD pipeline understood

### Week 2 Goals

- [ ] Merged first PR
- [ ] Completed 3+ tickets
- [ ] Written comprehensive tests
- [ ] Participated in code reviews
- [ ] Comfortable with codebase

### Month 1 Goals

- [ ] Working independently on tickets
- [ ] Contributing to architecture discussions
- [ ] Mentoring newer team members
- [ ] Deep expertise in one area (frontend, backend, DB, etc.)

---

## Feedback & Improvement

This onboarding guide is a living document. If you found something confusing or have suggestions for improvement, please:

1. Open an issue on GitHub with label `documentation`
2. Submit a PR with improvements
3. Share feedback in your 1-on-1 with your manager

**Welcome to the team! We're excited to have you here.**
