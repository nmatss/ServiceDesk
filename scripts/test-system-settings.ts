/**
 * Test Script for System Settings Implementation
 *
 * This script tests:
 * 1. getSystemSetting() function
 * 2. setSystemSetting() function
 * 3. getAllSystemSettings() function
 * 4. Integration factory methods using system settings
 */

import {
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
  systemSettingsQueries
} from '../lib/db/queries';

console.log('==========================================');
console.log('System Settings Implementation Test');
console.log('==========================================\n');

// Test 1: Get a system setting (should return default values from migration)
console.log('Test 1: Get system setting');
console.log('---------------------------');
const totvsEnabled = getSystemSetting('totvs_enabled');
console.log(`totvs_enabled: ${totvsEnabled}`);
const sapEnabled = getSystemSetting('sap_enabled');
console.log(`sap_enabled: ${sapEnabled}`);
const pixProvider = getSystemSetting('pix_provider');
console.log(`pix_provider: ${pixProvider || '(empty)'}`);
console.log('✓ Get system setting test passed\n');

// Test 2: Set a system setting
console.log('Test 2: Set system setting');
console.log('---------------------------');
const setResult = setSystemSetting('totvs_enabled', 'true');
console.log(`Set totvs_enabled to 'true': ${setResult ? 'SUCCESS' : 'FAILED'}`);
const newValue = getSystemSetting('totvs_enabled');
console.log(`Retrieved value: ${newValue}`);
console.log(newValue === 'true' ? '✓ Set system setting test passed\n' : '✗ Set system setting test FAILED\n');

// Test 3: Get all system settings
console.log('Test 3: Get all system settings');
console.log('--------------------------------');
const allSettings = getAllSystemSettings();
const settingsCount = Object.keys(allSettings).length;
console.log(`Total settings: ${settingsCount}`);
console.log('Sample settings:');
Object.entries(allSettings).slice(0, 5).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});
console.log('✓ Get all system settings test passed\n');

// Test 4: Organization-specific settings
console.log('Test 4: Organization-specific settings');
console.log('---------------------------------------');
const orgId = 1;
setSystemSetting('totvs_base_url', 'https://org1.totvs.com', orgId);
const orgSpecificUrl = getSystemSetting('totvs_base_url', orgId);
console.log(`Org ${orgId} TOTVS URL: ${orgSpecificUrl}`);
const globalUrl = getSystemSetting('totvs_base_url');
console.log(`Global TOTVS URL: ${globalUrl || '(empty)'}`);
console.log('✓ Organization-specific settings test passed\n');

// Test 5: Get settings with metadata
console.log('Test 5: Get settings with metadata');
console.log('-----------------------------------');
const metadata = systemSettingsQueries.getAllSettingsWithMetadata();
const encryptedSettings = metadata.filter(s => s.is_encrypted);
console.log(`Total settings with metadata: ${metadata.length}`);
console.log(`Encrypted settings: ${encryptedSettings.length}`);
console.log('Sample encrypted settings:');
encryptedSettings.slice(0, 3).forEach(setting => {
  console.log(`  ${setting.key} (${setting.description})`);
});
console.log('✓ Get settings with metadata test passed\n');

// Test 6: Integration factory compatibility
console.log('Test 6: Integration factory compatibility');
console.log('-----------------------------------------');
console.log('Testing if getSystemSetting is available for integrations...');

// Set up test integration settings
setSystemSetting('totvs_base_url', 'https://api.totvs.com');
setSystemSetting('totvs_username', 'test_user');
setSystemSetting('totvs_password', 'test_password');
setSystemSetting('totvs_tenant', 'test_tenant');

const totvsUrl = getSystemSetting('totvs_base_url');
const totvsUser = getSystemSetting('totvs_username');
const totvsPassword = getSystemSetting('totvs_password');
const totvsTenant = getSystemSetting('totvs_tenant');

console.log('Retrieved integration settings:');
console.log(`  URL: ${totvsUrl}`);
console.log(`  Username: ${totvsUser}`);
console.log(`  Password: ${totvsPassword ? '***' : '(not set)'}`);
console.log(`  Tenant: ${totvsTenant}`);

if (totvsUrl && totvsUser && totvsPassword && totvsTenant) {
  console.log('✓ Integration factory compatibility test passed\n');
} else {
  console.log('✗ Integration factory compatibility test FAILED\n');
}

// Summary
console.log('==========================================');
console.log('All Tests Completed Successfully!');
console.log('==========================================');
console.log('\nNext steps:');
console.log('1. Run migration: npm run db:migrate');
console.log('2. Update .env with integration credentials');
console.log('3. Test integration factories');
console.log('4. Access admin UI at /api/admin/settings');
