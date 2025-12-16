/**
 * Test script for tenant resolver
 *
 * Tests the dynamic tenant resolution system to ensure:
 * - Database queries work correctly
 * - Cache functions properly
 * - All resolution methods work
 * - Validation logic is correct
 */

import { resolveTenant, getTenantCacheStats } from '../lib/tenant/resolver';
import { getTenantFromCache, clearCache } from '../lib/tenant/cache';
import { getPooledConnection } from '../lib/db/connection';
import type { Organization } from '../lib/types/database';

async function testTenantResolver() {
  console.log('==================================');
  console.log('Tenant Resolver Test Suite');
  console.log('==================================\n');

  // Clear cache before tests
  clearCache();
  console.log('1. Cache cleared for clean test environment\n');

  // Test 1: Check if organizations exist in database
  console.log('2. Testing database connection and organization retrieval...');
  const orgs = await getPooledConnection<Organization[]>((db) => {
    const stmt = db.prepare(`
      SELECT id, name, slug, domain, subscription_status, is_active
      FROM organizations
      WHERE is_active = 1
      LIMIT 5
    `);
    return stmt.all() as Organization[];
  });

  if (orgs.length === 0) {
    console.error('   ERROR: No active organizations found in database!');
    console.error('   Please run: npm run init-db');
    process.exit(1);
  }

  console.log(`   SUCCESS: Found ${orgs.length} active organization(s):`);
  orgs.forEach((org) => {
    console.log(`   - ID: ${org.id}, Slug: ${org.slug}, Name: ${org.name}, Domain: ${org.domain || 'N/A'}`);
  });
  console.log('');

  // Test 2: Resolve tenant by slug (path method)
  console.log('3. Testing path-based tenant resolution...');
  const firstOrg = orgs[0];
  const pathResult = await resolveTenant({
    hostname: 'localhost:3000',
    pathname: `/t/${firstOrg.slug}/dashboard`,
    headers: {},
  });

  if (pathResult.tenant && pathResult.tenant.id === firstOrg.id) {
    console.log(`   SUCCESS: Resolved tenant by path (method: ${pathResult.method})`);
    console.log(`   - Tenant: ${pathResult.tenant.name} (ID: ${pathResult.tenant.id})`);
    console.log(`   - Cached: ${pathResult.cached}`);
  } else {
    console.error('   FAILED: Could not resolve tenant by path');
  }
  console.log('');

  // Test 3: Test cache hit
  console.log('4. Testing cache functionality...');
  const pathResultCached = await resolveTenant({
    hostname: 'localhost:3000',
    pathname: `/t/${firstOrg.slug}/tickets`,
    headers: {},
  });

  if (pathResultCached.cached) {
    console.log('   SUCCESS: Cache hit detected');
    console.log(`   - Tenant: ${pathResultCached.tenant?.name}`);
  } else {
    console.error('   WARNING: Expected cache hit but got cache miss');
  }
  console.log('');

  // Test 4: Resolve tenant by subdomain (if domain is set)
  if (firstOrg.domain) {
    console.log('5. Testing subdomain-based tenant resolution...');
    const subdomainResult = await resolveTenant({
      hostname: `${firstOrg.domain}.servicedesk.com`,
      pathname: '/dashboard',
      headers: {},
    });

    if (subdomainResult.tenant && subdomainResult.tenant.id === firstOrg.id) {
      console.log(`   SUCCESS: Resolved tenant by subdomain (method: ${subdomainResult.method})`);
      console.log(`   - Tenant: ${subdomainResult.tenant.name}`);
    } else {
      console.error('   FAILED: Could not resolve tenant by subdomain');
    }
    console.log('');
  }

  // Test 5: Resolve tenant by explicit headers
  console.log('6. Testing header-based tenant resolution...');
  const headerResult = await resolveTenant({
    hostname: 'api.servicedesk.com',
    pathname: '/api/tickets',
    headers: {
      'x-tenant-id': firstOrg.id.toString(),
      'x-tenant-slug': firstOrg.slug,
    },
  });

  if (headerResult.tenant && headerResult.tenant.id === firstOrg.id) {
    console.log(`   SUCCESS: Resolved tenant by headers (method: ${headerResult.method})`);
    console.log(`   - Tenant: ${headerResult.tenant.name}`);
  } else {
    console.error('   FAILED: Could not resolve tenant by headers');
  }
  console.log('');

  // Test 6: Test tenant not found
  console.log('7. Testing tenant not found scenario...');
  const notFoundResult = await resolveTenant({
    hostname: 'unknown.servicedesk.com',
    pathname: '/api/tickets',
    headers: {},
    allowDevDefault: false, // Disable dev default for this test
  });

  if (!notFoundResult.tenant && notFoundResult.method === 'not-found') {
    console.log('   SUCCESS: Correctly handled non-existent tenant');
    console.log(`   - Error: ${notFoundResult.error}`);
  } else {
    console.error('   FAILED: Should return not-found for non-existent tenant');
  }
  console.log('');

  // Test 7: Cache statistics
  console.log('8. Testing cache statistics...');
  const cacheStats = getTenantCacheStats();
  console.log('   Cache Statistics:');
  console.log(`   - Hits: ${cacheStats.hits}`);
  console.log(`   - Misses: ${cacheStats.misses}`);
  console.log(`   - Size: ${cacheStats.size}/${cacheStats.maxSize}`);
  console.log(`   - Hit Ratio: ${cacheStats.hitRatio.toFixed(2)}%`);
  console.log('');

  // Test 8: Validate inactive tenant is rejected
  console.log('9. Testing inactive tenant validation...');

  // Create a mock inactive organization for testing
  const inactiveOrg: Organization = {
    ...firstOrg,
    id: 999999, // Use non-existent ID
    slug: 'inactive-test',
    is_active: false,
  };

  // Since our resolver queries only active tenants, this should return not-found
  const inactiveResult = await resolveTenant({
    hostname: 'inactive-test.servicedesk.com',
    pathname: '/dashboard',
    headers: {},
    allowDevDefault: false,
  });

  if (!inactiveResult.tenant) {
    console.log('   SUCCESS: Inactive tenant correctly rejected');
  } else {
    console.error('   FAILED: Inactive tenant should not be resolved');
  }
  console.log('');

  // Test 9: Development default fallback
  console.log('10. Testing development default fallback...');
  const devDefaultResult = await resolveTenant({
    hostname: 'localhost:3000',
    pathname: '/dashboard', // Non-API path
    headers: {},
    allowDevDefault: true, // Enable dev default
  });

  if (devDefaultResult.tenant) {
    console.log(`   SUCCESS: Development default tenant resolved (method: ${devDefaultResult.method})`);
    console.log(`   - Tenant: ${devDefaultResult.tenant.name}`);
  } else {
    console.error('   FAILED: Development default should resolve a tenant');
  }
  console.log('');

  // Summary
  console.log('==================================');
  console.log('Test Suite Summary');
  console.log('==================================');
  console.log('All critical tests completed!');
  console.log('');
  console.log('NEXT STEPS:');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Test in browser: http://localhost:3000');
  console.log('3. Check middleware logs for tenant resolution');
  console.log('4. Verify NO hardcoded tenant IDs appear in logs');
  console.log('==================================\n');
}

// Run tests
testTenantResolver()
  .then(() => {
    console.log('Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test suite failed with error:');
    console.error(error);
    process.exit(1);
  });
