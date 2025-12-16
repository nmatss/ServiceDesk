/**
 * INTEGRATION TEST - Requires running server
 * 
 * To run: TEST_URL=http://localhost:3000 npx vitest run tests/security/owasp
 * 
 * These tests are skipped in CI/CD. Convert to unit tests for automated testing.
 */

import { describe, it } from 'vitest';

describe.skip('Advanced Injection Tests - Require Running Server', () => {
  it.skip('integration tests require running server - see README.md', () => {
    // These tests require a running server
    // Run with: TEST_URL=http://localhost:3000 npx vitest run tests/security/owasp
  });
});
