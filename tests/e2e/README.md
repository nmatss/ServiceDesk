# E2E Test Suite - ServiceDesk

## Overview

Complete End-to-End test suite for ServiceDesk using Playwright with accessibility testing via @axe-core/playwright.

## Test Statistics

- **Total Test Files**: 9
- **Total Test Cases**: 77+ component tests + 4 journey tests (per browser configuration)
- **Browser Configurations**: 2 (Desktop + Mobile)
- **Total Test Executions**: 200+

## Test Structure

### Component Tests (Existing)
Individual feature testing with focused test cases for specific functionality.

### Journey Tests (New)
Complete end-to-end user journeys that test real-world scenarios across multiple pages and interactions.

## Test Categories

### 1. Authentication Flow (auth/login.spec.ts)
**16 Test Cases**

Critical authentication and security tests:
- ✅ Display login page with correct elements
- ✅ Login successfully with valid credentials
- ✅ Show error with invalid email
- ✅ Show error with invalid password
- ✅ Handle rate limiting after multiple failed attempts
- ✅ Toggle password visibility
- ✅ Logout successfully
- ✅ Auto-redirect when already authenticated
- ✅ Persist session across page reloads
- ✅ Accessible login form (WCAG compliance)
- ✅ Show loading state during login
- ✅ Validate email format on client side
- ✅ Show server error gracefully
- ✅ Proper ARIA labels for screen readers
- ✅ Support keyboard navigation
- ✅ Verify httpOnly cookie security

**Security Features Tested:**
- JWT tokens with httpOnly cookies
- Rate limiting (5 attempts)
- Session persistence
- CSRF protection via cookies
- Password visibility toggle

### 2. Ticket Creation Flow (tickets/create-ticket.spec.ts)
**15 Test Cases**

Complete ticket lifecycle testing:
- ✅ Navigate to new ticket page
- ✅ Create ticket with all required fields
- ✅ Validate required fields
- ✅ Attach files to ticket
- ✅ Add tags to ticket
- ✅ Cancel ticket creation
- ✅ Show loading state during submission
- ✅ Accessible form (WCAG compliance)
- ✅ Support keyboard navigation in form
- ✅ Display SLA information after creation
- ✅ Validate title length
- ✅ Handle network errors gracefully
- ✅ Support drag and drop for file upload

**Features Tested:**
- Form validation
- File attachments
- Tag management
- SLA tracking
- Error handling

### 3. Admin Dashboard (admin/dashboard.spec.ts)
**19 Test Cases**

Admin-only functionality and role-based access:
- ✅ Only allow admin access to dashboard
- ✅ Display dashboard with key metrics
- ✅ Display statistics cards
- ✅ Navigate to user management
- ✅ Access user management and view users list
- ✅ Navigate to SLA configuration
- ✅ Access reports section
- ✅ Display recent activity table
- ✅ Show metrics with proper formatting
- ✅ Working navigation menu
- ✅ Display percentage changes in metrics
- ✅ Responsive on mobile
- ✅ Accessible dashboard (WCAG compliance)
- ✅ Update metrics in real-time
- ✅ Handle empty data gracefully
- ✅ Allow admin to create new user
- ✅ Logout from admin panel
- ✅ Display loading states
- ✅ Handle API errors gracefully

**Features Tested:**
- Role-based access control (RBAC)
- Real-time metrics
- User management
- SLA configuration
- Responsive design

### 4. Knowledge Base (knowledge/search.spec.ts)
**19 Test Cases**

Knowledge base search and article management:
- ✅ Display knowledge base page
- ✅ Search for articles
- ✅ Filter articles by category
- ✅ Display article categories
- ✅ View article details
- ✅ Show article metadata
- ✅ Provide helpful/not helpful feedback
- ✅ Display popular/recent articles
- ✅ Handle empty search results
- ✅ Display article tags
- ✅ Support keyboard navigation in search
- ✅ Accessible (WCAG compliance)
- ✅ Responsive on mobile
- ✅ Allow admins to create articles
- ✅ Track article views
- ✅ Handle API errors gracefully
- ✅ Clear search query
- ✅ Show article breadcrumbs

**Features Tested:**
- Full-text search
- Category filtering
- Article feedback system
- View tracking
- Admin content management

### 5. Multi-Tenant Isolation (multi-tenant/isolation.spec.ts)
**12 Test Cases**

Critical tenant isolation and security:
- ✅ Isolate data between different tenants
- ✅ Prevent cross-tenant data access via API
- ✅ Maintain tenant context in cookies
- ✅ Handle subdomain-based tenant resolution
- ✅ Prevent tenant switching without re-authentication
- ✅ Show correct tenant name in UI
- ✅ Isolate search results by tenant
- ✅ Enforce tenant isolation in file uploads
- ✅ Maintain tenant context across page navigation
- ✅ Prevent SQL injection in tenant parameter
- ✅ Handle invalid tenant gracefully
- ✅ Log tenant context in audit logs

**Security Features Tested:**
- Data isolation
- SQL injection prevention
- Cookie security
- Audit logging
- Session management

---

## Journey Tests (Complete User Flows)

### 6. User Journey (user-journey.spec.ts)
**Complete User Experience: Create → Track → View Resolution**

Tests the entire user lifecycle:
1. ✅ User login and authentication
2. ✅ Create new support ticket with detailed information
3. ✅ View ticket details and status
4. ✅ Track ticket progress
5. ✅ Add comments to ticket
6. ✅ View portal dashboard
7. ✅ Filter and search tickets
8. ✅ Receive real-time updates
9. ✅ Accessibility compliance
10. ✅ User logout

**User Journey Features:**
- Complete ticket creation workflow
- Ticket tracking and monitoring
- Comment system
- Dashboard overview
- Search and filters
- Real-time notifications

### 7. Agent Journey (agent-journey.spec.ts)
**Complete Agent Workflow: Login → View Queue → Resolve Ticket**

Tests the full agent experience:
1. ✅ Agent login with role verification
2. ✅ View agent dashboard with metrics
3. ✅ View and filter ticket queue
4. ✅ View ticket details
5. ✅ Assign ticket to self
6. ✅ Update ticket status to "In Progress"
7. ✅ Add internal notes
8. ✅ Respond to customer
9. ✅ Resolve ticket
10. ✅ View agent statistics
11. ✅ Bulk operations on tickets
12. ✅ Advanced search and filtering

**Agent Journey Features:**
- Queue management
- Ticket assignment
- Status workflow
- Internal notes
- Customer communication
- Performance tracking
- Bulk actions

### 8. Admin Journey (admin-journey.spec.ts)
**Complete Admin Experience: Login → Dashboard → Reports → Management**

Tests comprehensive admin functionality:
1. ✅ Admin login and authorization
2. ✅ View comprehensive analytics dashboard
3. ✅ Navigate admin menu
4. ✅ User management (create, view, edit)
5. ✅ View user details and permissions
6. ✅ Configure SLA policies
7. ✅ Manage teams
8. ✅ View and generate reports
9. ✅ Explore analytics with charts
10. ✅ Review audit logs
11. ✅ Access system settings
12. ✅ Manage email templates
13. ✅ Export reports in different formats
14. ✅ View real-time metrics

**Admin Journey Features:**
- Complete admin dashboard
- User and team management
- SLA configuration
- Report generation
- Analytics and insights
- Audit trail
- System configuration
- Role-based access control

### 9. Knowledge Base Journey (knowledge-base-journey.spec.ts)
**Complete KB Experience: Search → View → Rate Article**

Tests knowledge base functionality:
1. ✅ Access knowledge base
2. ✅ Browse categories
3. ✅ Search for articles
4. ✅ View article details
5. ✅ Rate articles (helpful/not helpful)
6. ✅ View related articles
7. ✅ Browse popular articles
8. ✅ Filter by categories
9. ✅ Advanced search with filters
10. ✅ Admin creates new article
11. ✅ Article recommendations
12. ✅ Public access (optional)

**Knowledge Base Features:**
- Category navigation
- Full-text search
- Article rating system
- Related articles
- Popular/trending articles
- Article creation (admin)
- Smart recommendations
- Public/private access

## Configuration

### Playwright Config (playwright.config.ts)

```typescript
{
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: ['html', 'json', 'list'],
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'chromium-desktop', viewport: { width: 1920, height: 1080 } },
    { name: 'chromium-mobile', device: 'Pixel 5' }
  ]
}
```

## Test Helpers

### Authentication Helper (helpers/auth.ts)

Provides reusable authentication functions:
- `login(page, user)` - Full UI login flow
- `loginViaAPI(page, user)` - Fast API-based login
- `logout(page)` - Complete logout with cleanup
- `isAuthenticated(page)` - Check auth status
- `verifySecureCookies(page)` - Verify httpOnly cookies
- `setupAuthenticatedSession(page, role)` - Quick setup for tests

### Test Users

```typescript
TEST_USERS = {
  admin: { email: 'admin@test.com', password: 'Admin@123', role: 'admin' },
  agent: { email: 'agent@test.com', password: 'Agent@123', role: 'agent' },
  user: { email: 'teste@servicedesk.com', password: '123456', role: 'user' }
}
```

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Component Tests
```bash
npm run test:e2e -- auth/login.spec.ts
npm run test:e2e -- tickets/create-ticket.spec.ts
npm run test:e2e -- admin/dashboard.spec.ts
npm run test:e2e -- knowledge/search.spec.ts
npm run test:e2e -- multi-tenant/isolation.spec.ts
```

### Journey Tests (Complete User Flows)
```bash
# User journey: Create ticket → Track → View resolution
npm run test:e2e -- user-journey.spec.ts

# Agent journey: Login → View queue → Resolve ticket
npm run test:e2e -- agent-journey.spec.ts

# Admin journey: Login → Dashboard → View reports
npm run test:e2e -- admin-journey.spec.ts

# Knowledge base journey: Search → View → Rate article
npm run test:e2e -- knowledge-base-journey.spec.ts

# Run all journey tests
npm run test:e2e -- user-journey.spec.ts agent-journey.spec.ts admin-journey.spec.ts knowledge-base-journey.spec.ts
```

### Watch Mode
```bash
npm run test:e2e:watch
```

### Desktop Only
```bash
npm run test:e2e -- --project=chromium-desktop
```

### Mobile Only
```bash
npm run test:e2e -- --project=chromium-mobile
```

### With UI
```bash
npx playwright test --ui
```

### Debug Mode
```bash
npx playwright test --debug
```

## Accessibility Testing

All test suites include accessibility checks using @axe-core/playwright:
- WCAG 2.1 Level AA compliance
- Screen reader compatibility
- Keyboard navigation
- ARIA labels and roles
- Color contrast
- Focus management

## Performance Features

- **Parallel Execution**: Tests run in parallel for speed
- **Fast Authentication**: API-based login bypasses UI for non-auth tests
- **Smart Retries**: Automatic retry on failure in CI
- **Failure Artifacts**: Screenshots, videos, and traces on failure
- **Optimized Waits**: Uses networkidle and smart timeouts

## Coverage Areas

### Security
- ✅ Authentication & Authorization
- ✅ CSRF Protection
- ✅ SQL Injection Prevention
- ✅ XSS Prevention
- ✅ Rate Limiting
- ✅ Session Management
- ✅ Multi-tenant Isolation

### Functionality
- ✅ User Authentication
- ✅ Ticket Management
- ✅ Admin Dashboard
- ✅ Knowledge Base
- ✅ File Uploads
- ✅ Search & Filtering
- ✅ Real-time Updates

### Quality
- ✅ WCAG 2.1 AA Accessibility
- ✅ Responsive Design (Mobile + Desktop)
- ✅ Error Handling
- ✅ Loading States
- ✅ Form Validation
- ✅ Keyboard Navigation

## Test Execution Time

Estimated execution time:

### Component Tests
- **Single Component Test**: ~30-60 seconds
- **All Component Tests (Desktop)**: ~5-7 minutes
- **All Component Tests (Desktop + Mobile)**: ~10-14 minutes

### Journey Tests
- **Single Journey Test**: ~2-4 minutes (comprehensive workflows)
- **All Journey Tests**: ~10-15 minutes
- **Complete Test Suite (Component + Journey)**: ~20-30 minutes

## Continuous Integration

Tests are configured for CI with:
- 2 retries on failure
- Single worker to avoid race conditions
- HTML and JSON reports
- Failure artifacts (screenshots, videos, traces)

## Reporting

After test execution, view reports:
- **HTML Report**: `playwright-report/index.html`
- **JSON Results**: `test-results/results.json`

Open HTML report:
```bash
npx playwright show-report
```

## Best Practices

1. **Always cleanup**: Use `beforeEach` and `afterEach` for auth state
2. **Use helpers**: Leverage auth helpers for consistent login
3. **Wait smartly**: Use `waitForLoadState('networkidle')` after navigation
4. **Test isolation**: Each test should be independent
5. **Meaningful assertions**: Check actual functionality, not just presence
6. **Accessibility**: Include a11y checks in all UI tests

## Troubleshooting

### Server not starting
```bash
# Check if port 4000 is in use
lsof -ti:4000

# Kill existing process
kill -9 $(lsof -ti:4000)

# Start manually
PORT=4000 npm run dev
```

### Database issues
```bash
# Re-initialize database
npm run init-db
```

### Test failures
```bash
# Run with debug
npx playwright test --debug

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test auth/login.spec.ts --debug
```

## Journey Test Quick Reference

| Journey | File | Duration | Key Features |
|---------|------|----------|-------------|
| User | `user-journey.spec.ts` | ~3 min | Create ticket, track, comment, logout |
| Agent | `agent-journey.spec.ts` | ~4 min | Queue management, assign, resolve ticket |
| Admin | `admin-journey.spec.ts` | ~4 min | Dashboard, users, SLA, reports |
| KB | `knowledge-base-journey.spec.ts` | ~3 min | Search, view, rate articles |

### Journey Test Benefits

1. **Real-world scenarios** - Tests complete user workflows, not just isolated features
2. **Integration testing** - Verifies multiple components work together
3. **User experience validation** - Ensures smooth transitions between pages
4. **Business process verification** - Validates critical business workflows
5. **Regression prevention** - Catches issues that affect complete user journeys
6. **Documentation** - Serves as living documentation of user flows

### When to Run Journey Tests

- **Before releases** - Verify complete workflows work end-to-end
- **After major changes** - Ensure changes don't break user journeys
- **In CI/CD** - Run on staging environment before production
- **Weekly** - Regular validation of critical paths
- **After database migrations** - Verify data flow integrity

## Future Enhancements

### Planned Journey Tests
- [ ] Agent collaboration journey (multiple agents on same ticket)
- [ ] Customer satisfaction survey journey
- [ ] Ticket escalation journey
- [ ] Multi-channel support journey (email, WhatsApp)
- [ ] Workflow automation journey
- [ ] Report generation and export journey

### Technical Enhancements
- [ ] Visual regression testing with Percy/Chromatic
- [ ] Performance testing with Lighthouse
- [ ] API testing with REST endpoints
- [ ] WebSocket/Real-time testing
- [ ] Email notification testing
- [ ] Mobile app E2E (if applicable)
- [ ] Cross-browser testing (Firefox, Safari)

## Maintenance

- Review and update test users quarterly
- Keep Playwright updated for latest features
- Monitor test execution time and optimize slow tests
- Add new tests for new features
- Remove obsolete tests for deprecated features
- Update accessibility standards as WCAG evolves
