# E2E Journey Tests - Quick Start Guide

## What Are Journey Tests?

Journey tests are comprehensive End-to-End tests that validate complete user workflows through the ServiceDesk application. Unlike component tests that test individual features, journey tests simulate real-world user scenarios from start to finish.

## Available Journey Tests

### 1. User Journey (`user-journey.spec.ts`)
**Workflow**: Create Ticket → Track → View Resolution

Tests a complete user experience:
- Login as regular user
- Create support ticket
- Track ticket status
- Add comments
- View portal dashboard
- Logout

**Run it:**
```bash
npm run test:e2e -- user-journey.spec.ts
```

### 2. Agent Journey (`agent-journey.spec.ts`)
**Workflow**: Login → View Queue → Resolve Ticket

Tests a complete agent workflow:
- Login as agent
- View ticket queue
- Filter and prioritize tickets
- Assign and update tickets
- Respond to customers
- Resolve tickets

**Run it:**
```bash
npm run test:e2e -- agent-journey.spec.ts
```

### 3. Admin Journey (`admin-journey.spec.ts`)
**Workflow**: Login → Dashboard → Reports → Management

Tests complete admin functionality:
- Login as admin
- View analytics dashboard
- Manage users and teams
- Configure SLA policies
- Generate reports
- Review audit logs

**Run it:**
```bash
npm run test:e2e -- admin-journey.spec.ts
```

### 4. Knowledge Base Journey (`knowledge-base-journey.spec.ts`)
**Workflow**: Search → View → Rate Article

Tests knowledge base functionality:
- Browse categories
- Search articles
- View article details
- Rate articles
- Create new articles (admin)

**Run it:**
```bash
npm run test:e2e -- knowledge-base-journey.spec.ts
```

## Quick Commands

### Run All Journey Tests
```bash
npm run test:e2e -- user-journey.spec.ts agent-journey.spec.ts admin-journey.spec.ts knowledge-base-journey.spec.ts
```

### Run with UI (Recommended for First Time)
```bash
npx playwright test --ui
```

### Debug a Specific Journey
```bash
npx playwright test user-journey.spec.ts --debug
```

### Run Only Desktop Tests
```bash
npm run test:e2e -- --project=chromium-desktop user-journey.spec.ts
```

## Prerequisites

1. **Database initialized**:
   ```bash
   npm run init-db
   ```

2. **Development server running** (optional - Playwright will start it):
   ```bash
   PORT=4000 npm run dev
   ```

3. **Test users exist** (created by init-db):
   - User: `teste@servicedesk.com` / `123456`
   - Agent: `agent@test.com` / `Agent@123`
   - Admin: `admin@test.com` / `Admin@123`

## Test Structure

Each journey test consists of multiple steps:

```typescript
test('complete journey', async ({ page }) => {
  await test.step('Step 1: Login', async () => {
    // Login logic
  });

  await test.step('Step 2: Perform action', async () => {
    // Action logic
  });

  // More steps...
});
```

## Understanding Test Results

### Success
- All steps pass ✅
- Screenshots saved in `test-results/`
- HTML report in `playwright-report/`

### Failure
- Test stops at failed step ❌
- Screenshot of failure saved
- Video recording saved (if enabled)
- Trace file available for debugging

### View Results
```bash
npx playwright show-report
```

## Common Issues

### Issue: Tests fail at login
**Solution**: Verify test users exist in database
```bash
npm run init-db
```

### Issue: Timeout errors
**Solution**: Increase timeout in playwright.config.ts or ensure dev server is running

### Issue: Element not found
**Solution**: UI might have changed. Check if selectors need updating.

## Best Practices

### 1. Run Locally First
Before committing, run tests locally to ensure they pass:
```bash
npm run test:e2e -- user-journey.spec.ts
```

### 2. Use UI Mode for Debugging
When fixing tests, use UI mode to see what's happening:
```bash
npx playwright test --ui
```

### 3. Run Specific Tests
Don't run all tests every time. Run the journey you're working on:
```bash
npm run test:e2e -- agent-journey.spec.ts
```

### 4. Check Screenshots
Review screenshots in `test-results/` to understand test flow

### 5. Update When UI Changes
When UI changes, update the affected journey tests immediately

## Test Statistics

| Metric | Value |
|--------|-------|
| Total Journey Tests | 4 |
| Total Test Scenarios | 14 |
| Total Test Steps | 75+ |
| Lines of Code | 2,029 |
| Estimated Runtime | 10-15 min |

## Next Steps

1. **Run your first journey test**:
   ```bash
   npm run test:e2e -- user-journey.spec.ts
   ```

2. **View the results**:
   ```bash
   npx playwright show-report
   ```

3. **Explore test code**:
   - Open `tests/e2e/user-journey.spec.ts`
   - Read through the test steps
   - Understand the workflow

4. **Read full documentation**:
   - See `tests/e2e/README.md` for complete details
   - See `E2E_JOURNEY_TESTS_SUMMARY.md` for implementation details

## Support

- **Playwright Documentation**: https://playwright.dev
- **Test Helpers**: `tests/e2e/helpers/auth.ts`
- **Existing Component Tests**: `tests/e2e/auth/`, `tests/e2e/tickets/`, etc.

## Quick Test Command Reference

```bash
# Run all E2E tests (component + journey)
npm run test:e2e

# Run just journey tests
npm run test:e2e -- user-journey.spec.ts agent-journey.spec.ts admin-journey.spec.ts knowledge-base-journey.spec.ts

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test user-journey.spec.ts --debug

# Desktop only
npm run test:e2e -- --project=chromium-desktop

# Mobile only
npm run test:e2e -- --project=chromium-mobile

# Show report
npx playwright show-report

# Re-run failed tests
npm run test:e2e -- --last-failed
```

---

**Ready to start?** Run your first journey test:
```bash
npm run test:e2e -- user-journey.spec.ts
```
