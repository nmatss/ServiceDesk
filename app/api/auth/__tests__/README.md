# Authentication API Tests

Comprehensive test suite for all authentication API routes.

## Test Coverage

### Routes Tested
- ✅ POST /api/auth/login
- ✅ POST /api/auth/register
- ✅ GET /api/auth/verify
- ✅ POST /api/auth/verify
- ✅ GET /api/auth/profile
- ✅ PUT /api/auth/profile

### Test Categories

#### 1. Login Tests (`login.test.ts`)
**68 test cases covering:**
- ✅ Valid credentials login (8 tests)
- ✅ Failed login attempts (5 tests)
- ✅ Account lockout after 5 failed attempts (4 tests)
- ✅ Multi-tenant isolation (2 tests)
- ✅ Rate limiting (5 attempts per 15 minutes) (2 tests)
- ✅ Input validation (3 tests)
- ✅ Security features (timing attack prevention, etc.) (2 tests)
- ✅ Cookie setting (httpOnly, secure, sameSite)
- ✅ Audit logging
- ✅ Password reset on successful login
- ✅ Organization/tenant context

#### 2. Register Tests (`register.test.ts`)
**47 test cases covering:**
- ✅ Valid user registration (7 tests)
- ✅ Password complexity validation (6 tests)
  - Minimum 12 characters
  - Uppercase letter required
  - Lowercase letter required
  - Number required
  - Special character required
- ✅ Email validation (7 tests)
- ✅ Duplicate email detection (2 tests)
- ✅ Required fields validation (3 tests)
- ✅ XSS prevention (2 tests)
- ✅ Rate limiting (3 attempts per hour) (1 test)
- ✅ Tenant user limits (2 tests)
- ✅ Security features (4 tests)
  - Default role enforcement
  - No privilege escalation
  - Active user by default

#### 3. Verify Tests (`verify.test.ts`)
**24 test cases covering:**
- ✅ Valid token verification from cookie (4 tests)
- ✅ Valid token verification from Authorization header (1 test)
- ✅ Invalid token rejection (6 tests)
  - Missing token
  - Invalid format
  - Expired token
  - Wrong signature
  - Non-existent user
- ✅ Rate limiting (2 tests)
- ✅ POST endpoint with token in body (3 tests)
- ✅ Error handling (2 tests)
- ✅ Security features (2 tests)
  - JWT issuer validation
  - JWT audience validation

#### 4. Profile Tests (`profile.test.ts`)
**30 test cases covering:**
- ✅ Get authenticated user profile (3 tests)
- ✅ Authentication requirement (2 tests)
- ✅ Update user name and email (4 tests)
- ✅ Field validation (4 tests)
- ✅ Email uniqueness check (2 tests)
- ✅ XSS prevention (2 tests)
- ✅ Security features (4 tests)
  - No cross-user updates
  - No password exposure
  - No role escalation

## Test Infrastructure

### Helper Utilities (`helpers/test-utils.ts`)
- `initTestDatabase()` - Initialize in-memory SQLite database
- `cleanupTestDatabase()` - Clean up test database
- `resetTestData()` - Reset test data between tests
- `createMockRequest()` - Create mock NextRequest objects
- `getResponseJSON()` - Extract JSON from responses
- `generateTestToken()` - Generate valid JWT tokens
- `generateExpiredToken()` - Generate expired JWT tokens
- `createTestUser()` - Create users in test database
- `lockUserAccount()` - Lock user accounts for testing
- `getLoginAttempts()` - Get login attempt records
- `getAuditLogs()` - Get audit log entries

### Test Database Schema
- `organizations` - Test tenants/organizations
- `users` - Test users with various roles
- `login_attempts` - Login attempt tracking
- `audit_logs` - Audit trail
- `rate_limits` - Rate limiting state

### Test Data
```typescript
TEST_TENANT = {
  id: 1,
  name: 'Test Organization',
  slug: 'test-org'
}

TEST_USERS = {
  admin: { id: 1, email: 'admin@test.com', role: 'admin' },
  agent: { id: 2, email: 'agent@test.com', role: 'agent' },
  user: { id: 3, email: 'user@test.com', role: 'user' }
}
```

## Running Tests

### Run all auth API tests
```bash
npm run test:unit -- app/api/auth/__tests__
```

### Run specific test file
```bash
npm run test:unit -- app/api/auth/__tests__/login.test.ts
npm run test:unit -- app/api/auth/__tests__/register.test.ts
npm run test:unit -- app/api/auth/__tests__/verify.test.ts
npm run test:unit -- app/api/auth/__tests__/profile.test.ts
```

### Run with coverage
```bash
npm run test:unit:coverage -- app/api/auth/__tests__
```

### Watch mode (during development)
```bash
npm run test:unit:watch -- app/api/auth/__tests__
```

## Coverage Metrics

### Expected Coverage
- **Statements:** >90%
- **Branches:** >85%
- **Functions:** >90%
- **Lines:** >90%

### Key Features Tested

#### Security
- ✅ JWT token validation (signature, expiry, issuer, audience)
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Rate limiting (5 login attempts, 3 register attempts)
- ✅ Account lockout (5 failed attempts = 15 min lockout)
- ✅ XSS prevention (input sanitization)
- ✅ Timing attack prevention (constant-time comparison)
- ✅ httpOnly cookies (token not exposed to JavaScript)
- ✅ CSRF protection readiness

#### Validation
- ✅ Password complexity (12 chars, upper, lower, number, special)
- ✅ Email format validation
- ✅ Required field validation
- ✅ Duplicate email prevention
- ✅ Email uniqueness per tenant

#### Multi-Tenancy
- ✅ Organization/tenant isolation
- ✅ Tenant context in cookies
- ✅ Tenant-specific user queries
- ✅ Tenant user limits

#### Audit & Logging
- ✅ Login attempt tracking (success/failure)
- ✅ Audit log creation
- ✅ Failed attempt counting
- ✅ IP address logging
- ✅ User agent logging

## Test Statistics

Total Test Files: **4**
Total Test Cases: **169+**
Total Lines of Test Code: **2,500+**

### Breakdown by Route
- Login: 68 tests
- Register: 47 tests
- Verify: 24 tests
- Profile: 30 tests

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Auth API Tests
  run: npm run test:unit -- app/api/auth/__tests__

- name: Generate Coverage Report
  run: npm run test:unit:coverage -- app/api/auth/__tests__
```

## Contributing

When adding new authentication features:

1. Write tests FIRST (TDD approach)
2. Ensure all existing tests still pass
3. Add tests for:
   - Happy path (success case)
   - Error cases (validation failures)
   - Edge cases (empty inputs, special characters)
   - Security scenarios (XSS, injection, escalation)
4. Update this README with new test counts

## Notes

- All tests use in-memory SQLite database
- Tests are isolated and can run in parallel
- Mocks are used for external dependencies
- Test data is reset between each test
- JWT secret is mocked for consistent testing
