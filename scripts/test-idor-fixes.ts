#!/usr/bin/env tsx
/**
 * Test script for IDOR vulnerability fixes
 *
 * Tests the following critical security fixes:
 * 1. /api/tickets/user/[userId] - Authentication and authorization
 * 2. /api/portal/tickets/[id] - Token-based access control
 * 3. Token generation and validation
 */

import db from '../lib/db/connection';
import {
  generateTicketAccessToken,
  validateTicketAccessToken,
  recordTokenUsage,
  revokeTicketAccessToken,
  getTicketTokens
} from '../lib/db/queries';
import { isAdminRole, canAccessResource, hasOwnershipOrAdmin } from '../lib/auth/permissions';

console.log('🧪 Testing IDOR Vulnerability Fixes\n');
console.log('=' .repeat(60));

// ============================================
// TEST 1: Permission Helper Functions
// ============================================
console.log('\n📋 TEST 1: Permission Helper Functions');
console.log('-'.repeat(60));

const testRoles = [
  { role: 'super_admin', expected: true },
  { role: 'tenant_admin', expected: true },
  { role: 'admin', expected: true },
  { role: 'manager', expected: true },
  { role: 'agent', expected: false },
  { role: 'user', expected: false },
];

let test1Passed = true;
testRoles.forEach(({ role, expected }) => {
  const result = isAdminRole(role);
  const status = result === expected ? '✅' : '❌';
  console.log(`  ${status} isAdminRole('${role}') = ${result} (expected: ${expected})`);
  if (result !== expected) test1Passed = false;
});

// Test canAccessResource
console.log('\n  Testing canAccessResource:');
const accessTests = [
  { role: 'admin', userId: 1, ownerId: 2, expected: true, desc: 'Admin accessing other user' },
  { role: 'user', userId: 1, ownerId: 1, expected: true, desc: 'User accessing own resource' },
  { role: 'user', userId: 1, ownerId: 2, expected: false, desc: 'User accessing other user' },
  { role: 'super_admin', userId: 1, ownerId: 999, expected: true, desc: 'Super admin accessing any resource' },
];

accessTests.forEach(({ role, userId, ownerId, expected, desc }) => {
  const result = canAccessResource(role, userId, ownerId);
  const status = result === expected ? '✅' : '❌';
  console.log(`  ${status} ${desc}: ${result} (expected: ${expected})`);
  if (result !== expected) test1Passed = false;
});

console.log(`\n${test1Passed ? '✅' : '❌'} Test 1: ${test1Passed ? 'PASSED' : 'FAILED'}`);

// ============================================
// TEST 2: Token Generation and Validation
// ============================================
console.log('\n📋 TEST 2: Token Generation and Validation');
console.log('-'.repeat(60));

let test2Passed = true;

// Get a test ticket
const testTicket = db.prepare('SELECT id FROM tickets LIMIT 1').get() as { id: number } | undefined;

if (!testTicket) {
  console.log('  ⚠️  No tickets found in database, skipping token tests');
  test2Passed = false;
} else {
  console.log(`  Using ticket ID: ${testTicket.id}`);

  // Test 2.1: Generate token
  console.log('\n  2.1: Generating access token...');
  try {
    const token = generateTicketAccessToken(testTicket.id, 30);
    console.log(`  ✅ Token generated: ${token.substring(0, 8)}...`);

    // Verify UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(token)) {
      console.log('  ✅ Token is valid UUID v4 format');
    } else {
      console.log('  ❌ Token is NOT valid UUID v4 format');
      test2Passed = false;
    }

    // Test 2.2: Validate token
    console.log('\n  2.2: Validating token...');
    const tokenData = validateTicketAccessToken(token, testTicket.id);
    if (tokenData) {
      console.log('  ✅ Token validated successfully');
      console.log(`      - Ticket ID: ${tokenData.ticket_id}`);
      console.log(`      - Expires: ${tokenData.expires_at}`);
      console.log(`      - Active: ${tokenData.is_active}`);
    } else {
      console.log('  ❌ Token validation failed');
      test2Passed = false;
    }

    // Test 2.3: Record usage
    console.log('\n  2.3: Recording token usage...');
    if (tokenData) {
      recordTokenUsage(tokenData.id, { test: true });
      const updatedToken = db.prepare('SELECT usage_count, used_at FROM ticket_access_tokens WHERE id = ?')
        .get(tokenData.id) as { usage_count: number; used_at: string | null } | undefined;

      if (updatedToken && updatedToken.usage_count === 1 && updatedToken.used_at) {
        console.log(`  ✅ Usage recorded (count: ${updatedToken.usage_count})`);
      } else {
        console.log('  ❌ Usage recording failed');
        test2Passed = false;
      }
    }

    // Test 2.4: Validate with wrong ticket ID
    console.log('\n  2.4: Testing validation with wrong ticket ID...');
    const invalidToken = validateTicketAccessToken(token, 99999);
    if (!invalidToken) {
      console.log('  ✅ Correctly rejected token for wrong ticket');
    } else {
      console.log('  ❌ Incorrectly accepted token for wrong ticket');
      test2Passed = false;
    }

    // Test 2.5: Revoke token
    console.log('\n  2.5: Revoking token...');
    const revoked = revokeTicketAccessToken(token);
    if (revoked) {
      console.log('  ✅ Token revoked successfully');

      // Verify revoked token is invalid
      const revokedToken = validateTicketAccessToken(token, testTicket.id);
      if (!revokedToken) {
        console.log('  ✅ Revoked token correctly rejected');
      } else {
        console.log('  ❌ Revoked token still valid');
        test2Passed = false;
      }
    } else {
      console.log('  ❌ Token revocation failed');
      test2Passed = false;
    }

    // Test 2.6: Get ticket tokens
    console.log('\n  2.6: Testing getTicketTokens...');
    const newToken = generateTicketAccessToken(testTicket.id, 30);
    const tickets = getTicketTokens(testTicket.id);
    if (tickets.length > 0) {
      console.log(`  ✅ Found ${tickets.length} active token(s) for ticket`);
    } else {
      console.log('  ⚠️  No active tokens found');
    }

  } catch (error) {
    console.log(`  ❌ Test failed with error: ${error}`);
    test2Passed = false;
  }
}

console.log(`\n${test2Passed ? '✅' : '❌'} Test 2: ${test2Passed ? 'PASSED' : 'FAILED'}`);

// ============================================
// TEST 3: Database Integrity
// ============================================
console.log('\n📋 TEST 3: Database Integrity');
console.log('-'.repeat(60));

let test3Passed = true;

// Check table exists
const tableCheck = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='ticket_access_tokens'
`).get();

if (tableCheck) {
  console.log('  ✅ ticket_access_tokens table exists');
} else {
  console.log('  ❌ ticket_access_tokens table missing');
  test3Passed = false;
}

// Check indexes exist
const expectedIndexes = [
  'idx_ticket_access_tokens_token',
  'idx_ticket_access_tokens_ticket_id',
  'idx_ticket_access_tokens_expires',
  'idx_ticket_access_tokens_active'
];

console.log('\n  Checking indexes:');
expectedIndexes.forEach(indexName => {
  const indexExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name=?
  `).get(indexName);

  if (indexExists) {
    console.log(`  ✅ Index ${indexName} exists`);
  } else {
    console.log(`  ❌ Index ${indexName} missing`);
    test3Passed = false;
  }
});

console.log(`\n${test3Passed ? '✅' : '❌'} Test 3: ${test3Passed ? 'PASSED' : 'FAILED'}`);

// ============================================
// FINAL SUMMARY
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));

const allTestsPassed = test1Passed && test2Passed && test3Passed;

console.log(`  Test 1 (Permissions): ${test1Passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Test 2 (Tokens):      ${test2Passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Test 3 (Database):    ${test3Passed ? '✅ PASSED' : '❌ FAILED'}`);
console.log('');
console.log(`  Overall: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('='.repeat(60));

if (!allTestsPassed) {
  process.exit(1);
}
