# OWASP Security Tests

These tests validate OWASP Top 10 security vulnerabilities.

## Test Types

### Unit Tests (No Server Required)
- `tests/security/headers.test.ts` - Security headers validation
- `tests/security/jwt.test.ts` - JWT security
- `tests/security/input-validation.test.ts` - Input validation
- `tests/security/rate-limit.test.ts` - Rate limiting

### Integration Tests (Require Running Server)
The tests in this directory (`tests/security/owasp/`) are **integration tests** that require a running server.

To run these tests:
1. Start the development server: `npm run dev`
2. In another terminal, run: `TEST_URL=http://localhost:3000 npx vitest run tests/security/owasp`

These tests are currently **SKIPPED** in CI/CD because they require a running server.
They should be run manually during security audits or converted to unit tests.

## Converting to Unit Tests

To convert these integration tests to unit tests:
1. Test security functions directly (like JWT, validation schemas)
2. Mock database calls
3. Test middleware functions with mock requests/responses
4. Avoid actual HTTP calls

See `tests/security/input-validation.test.ts` for an example of testing validation
functions directly without requiring a running server.
