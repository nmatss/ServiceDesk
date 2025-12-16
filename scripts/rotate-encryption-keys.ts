#!/usr/bin/env node
/**
 * Encryption Key Rotation Utility
 *
 * This script helps administrators rotate encryption keys safely.
 *
 * Usage:
 *   npm run rotate-keys              # Perform key rotation
 *   npm run rotate-keys --info       # Show current key info
 *   npm run rotate-keys --migrate    # Re-encrypt all data with new key
 *   npm run rotate-keys --deprecate  # Deprecate old key versions
 *
 * IMPORTANT:
 * - Always backup your database before running this script
 * - Store the new encryption key in your environment variables
 * - Monitor the migration process for any errors
 * - Keep old keys for at least 90 days for data recovery
 */

import { EncryptionManager, DecryptionInput, EncryptionResult } from '../lib/security/encryption';
import { getDb } from '../lib/db/connection';
import logger from '../lib/monitoring/structured-logger';

interface EncryptedField {
  table: string;
  idColumn: string;
  id: number | string;
  field: string;
  encryptedValue: string;
}

async function showKeyInfo() {
  const manager = EncryptionManager.getInstance();
  const keyInfo = manager.getKeyVersionInfo();
  const currentVersion = manager.getCurrentKeyVersion();
  const shouldRotate = manager.shouldRotateKey();

  console.log('\n=== Encryption Key Information ===\n');
  console.log(`Current Active Version: v${currentVersion}`);
  console.log(`Should Rotate: ${shouldRotate ? 'YES' : 'NO'}\n`);
  console.log('Key Versions:');

  keyInfo.forEach(key => {
    const age = Math.floor((Date.now() - key.createdAt) / (1000 * 60 * 60 * 24));
    console.log(`  v${key.version}: ${key.status.toUpperCase()} (age: ${age} days)`);
    if (key.rotatedAt) {
      const rotatedAge = Math.floor((Date.now() - key.rotatedAt) / (1000 * 60 * 60 * 24));
      console.log(`    Rotated: ${rotatedAge} days ago`);
    }
  });

  console.log('');
}

async function performKeyRotation() {
  console.log('\n=== Starting Encryption Key Rotation ===\n');

  const manager = EncryptionManager.getInstance();
  const result = await manager.rotateKeys();

  if (result.success) {
    console.log('✓ Key rotation successful!');
    console.log(`  New Version: v${result.newVersion}`);
    console.log(`\nIMPORTANT: Add the following to your .env file:`);
    console.log(`ENCRYPTION_KEY_V${result.newVersion}=[NEW_KEY_GENERATED]`);
    console.log('\nThe new key has been logged securely. Check your logs.');
    console.log('\nNext steps:');
    console.log('  1. Save the new encryption key to your environment variables');
    console.log('  2. Run: npm run rotate-keys -- --migrate');
    console.log('  3. Verify all data can be decrypted');
    console.log('  4. After 90 days, deprecate old keys\n');
  } else {
    console.error('✗ Key rotation failed!');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }
}

async function findEncryptedFields(): Promise<EncryptedField[]> {
  const db = getDb();
  const encryptedFields: EncryptedField[] = [];

  // Define tables and fields that contain encrypted data
  const fieldsToCheck = [
    { table: 'users', idColumn: 'id', fields: ['phone', 'address'] },
    // Add more tables and fields as needed
  ];

  for (const { table, idColumn, fields } of fieldsToCheck) {
    for (const field of fields) {
      const rows = db.prepare(`SELECT ${idColumn}, ${field} FROM ${table} WHERE ${field} IS NOT NULL`).all();

      for (const row of rows) {
        const value = (row as any)[field];

        // Check if the value looks like encrypted JSON
        if (typeof value === 'string' && value.startsWith('{') && value.includes('"encrypted"')) {
          encryptedFields.push({
            table,
            idColumn,
            id: (row as any)[idColumn],
            field,
            encryptedValue: value
          });
        }
      }
    }
  }

  return encryptedFields;
}

async function migrateEncryptedData() {
  console.log('\n=== Migrating Encrypted Data to New Key ===\n');

  const manager = EncryptionManager.getInstance();
  const currentVersion = manager.getCurrentKeyVersion();

  console.log(`Target Key Version: v${currentVersion}`);
  console.log('Scanning database for encrypted fields...\n');

  const encryptedFields = await findEncryptedFields();
  console.log(`Found ${encryptedFields.length} encrypted fields to migrate\n`);

  if (encryptedFields.length === 0) {
    console.log('No encrypted data found to migrate.');
    return;
  }

  const db = getDb();
  let migratedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const item of encryptedFields) {
    try {
      // Parse the encrypted data
      const encryptedData: DecryptionInput = JSON.parse(item.encryptedValue);

      // Check if already using current version
      if (encryptedData.version === currentVersion) {
        continue;
      }

      console.log(`Migrating ${item.table}.${item.field} (id: ${item.id}) from v${encryptedData.version || 1} to v${currentVersion}...`);

      // Re-encrypt with current key version
      const reEncrypted = await manager.reEncrypt(encryptedData);
      const newValue = JSON.stringify(reEncrypted);

      // Update database
      db.prepare(`UPDATE ${item.table} SET ${item.field} = ? WHERE ${item.idColumn} = ?`)
        .run(newValue, item.id);

      migratedCount++;
      console.log(`  ✓ Migrated successfully`);
    } catch (error) {
      errorCount++;
      const errorMsg = `Failed to migrate ${item.table}.${item.field} (id: ${item.id}): ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`  ✗ ${errorMsg}`);
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Skipped (already current): ${encryptedFields.length - migratedCount - errorCount}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(error => console.error(`  - ${error}`));
  }
}

async function deprecateOldKeys() {
  console.log('\n=== Deprecating Old Key Versions ===\n');

  const manager = EncryptionManager.getInstance();
  await manager.deprecateOldKeys(3); // Keep last 3 versions

  const keyInfo = manager.getKeyVersionInfo();
  const deprecated = keyInfo.filter(k => k.status === 'deprecated');

  console.log(`Deprecated ${deprecated.length} old key versions:`);
  deprecated.forEach(key => {
    console.log(`  v${key.version}`);
  });

  console.log('\nThese keys will still work for decryption but should not be used for new encryption.');
  console.log('After verifying all data has been migrated, you can remove these from your environment.\n');
}

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--info')) {
      await showKeyInfo();
    } else if (args.includes('--migrate')) {
      await migrateEncryptedData();
    } else if (args.includes('--deprecate')) {
      await deprecateOldKeys();
    } else if (args.length === 0) {
      await performKeyRotation();
    } else {
      console.log('Usage:');
      console.log('  npm run rotate-keys              # Perform key rotation');
      console.log('  npm run rotate-keys -- --info    # Show current key info');
      console.log('  npm run rotate-keys -- --migrate # Re-encrypt all data with new key');
      console.log('  npm run rotate-keys -- --deprecate # Deprecate old key versions');
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { showKeyInfo, performKeyRotation, migrateEncryptedData, deprecateOldKeys };
