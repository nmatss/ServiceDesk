#!/usr/bin/env node

/**
 * SLA Migration Verification Script
 *
 * This script verifies that the SLA migration (014_sla_columns.sql) was applied correctly.
 *
 * Usage:
 *   node scripts/verify-sla-migration.js
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Some checks failed
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`)
};

// Database path
const DB_PATH = path.join(__dirname, '..', 'servicedesk.db');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  log.error(`Database not found at: ${DB_PATH}`);
  log.info('Please run: npm run init-db');
  process.exit(1);
}

// Open database
const db = new Database(DB_PATH);

// Test counters
let passed = 0;
let failed = 0;

// Helper function to run a check
function check(name, testFn) {
  try {
    const result = testFn();
    if (result) {
      log.success(name);
      passed++;
      return true;
    } else {
      log.error(name);
      failed++;
      return false;
    }
  } catch (error) {
    log.error(`${name} - ${error.message}`);
    failed++;
    return false;
  }
}

// Start verification
log.header('SLA Migration Verification');
log.info(`Database: ${DB_PATH}`);
log.info('Starting checks...\n');

// ==========================================
// Check 1: Verify tickets table columns
// ==========================================
log.header('1. Checking tickets table columns...');

const ticketsColumns = db.prepare("PRAGMA table_info(tickets)").all();
const requiredColumns = [
  'sla_policy_id',
  'sla_deadline',
  'sla_status',
  'sla_first_response_at',
  'sla_resolution_at',
  'escalation_level',
  'escalated_at'
];

requiredColumns.forEach(colName => {
  check(`Column '${colName}' exists`, () => {
    return ticketsColumns.some(col => col.name === colName);
  });
});

// ==========================================
// Check 2: Verify indexes
// ==========================================
log.header('2. Checking indexes...');

const indexes = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='index' AND tbl_name='tickets'
`).all().map(row => row.name);

const requiredIndexes = [
  'idx_tickets_sla_status',
  'idx_tickets_sla_deadline',
  'idx_tickets_sla_escalation',
  'idx_tickets_sla_policy',
  'idx_tickets_sla_tracking_dashboard'
];

requiredIndexes.forEach(idxName => {
  check(`Index '${idxName}' exists`, () => {
    return indexes.includes(idxName);
  });
});

// ==========================================
// Check 3: Verify triggers
// ==========================================
log.header('3. Checking triggers...');

const triggers = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='trigger' AND tbl_name='tickets'
`).all().map(row => row.name);

const requiredTriggers = [
  'set_sla_deadline_on_ticket_insert',
  'update_sla_status_on_ticket_update',
  'mark_sla_first_response',
  'mark_sla_resolution'
];

requiredTriggers.forEach(triggerName => {
  check(`Trigger '${triggerName}' exists`, () => {
    return triggers.includes(triggerName);
  });
});

// ==========================================
// Check 4: Verify sla_status constraints
// ==========================================
log.header('4. Checking sla_status constraints...');

check('sla_status has CHECK constraint', () => {
  const tableSQL = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='tickets'
  `).get();

  return tableSQL && tableSQL.sql.includes("CHECK(sla_status IN ('on_track', 'at_risk', 'breached'))");
});

// ==========================================
// Check 5: Test data integrity
// ==========================================
log.header('5. Checking data integrity...');

check('All sla_status values are valid', () => {
  const invalidStatuses = db.prepare(`
    SELECT COUNT(*) as count FROM tickets
    WHERE sla_status IS NOT NULL
    AND sla_status NOT IN ('on_track', 'at_risk', 'breached')
  `).get();

  return invalidStatuses.count === 0;
});

check('sla_policy_id references valid policies', () => {
  const invalidRefs = db.prepare(`
    SELECT COUNT(*) as count FROM tickets
    WHERE sla_policy_id IS NOT NULL
    AND sla_policy_id NOT IN (SELECT id FROM sla_policies)
  `).get();

  return invalidRefs.count === 0;
});

check('escalation_level is non-negative', () => {
  const negativeEscalations = db.prepare(`
    SELECT COUNT(*) as count FROM tickets
    WHERE escalation_level < 0
  `).get();

  return negativeEscalations.count === 0;
});

// ==========================================
// Check 6: Test query performance
// ==========================================
log.header('6. Testing query performance...');

check('Can query tickets by sla_status', () => {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE sla_status = 'on_track'
  `).get();

  return result !== undefined;
});

check('Can query tickets by sla_deadline', () => {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM tickets
    WHERE sla_deadline IS NOT NULL
    ORDER BY sla_deadline ASC
    LIMIT 10
  `).get();

  return result !== undefined;
});

check('Can query tickets with escalation', () => {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE escalation_level > 0
  `).get();

  return result !== undefined;
});

// ==========================================
// Check 7: Verify migration table entry
// ==========================================
log.header('7. Checking migration tracking...');

check('Migration table exists', () => {
  const table = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'
  `).get();

  return table !== undefined;
});

const migrationExists = db.prepare(`
  SELECT COUNT(*) as count FROM migrations WHERE id LIKE '014%'
`).get();

if (migrationExists && migrationExists.count > 0) {
  log.success('Migration 014 is recorded in migrations table');
  passed++;
} else {
  log.warning('Migration 014 not found in migrations table (may not have been run via migrate script)');
}

// ==========================================
// Check 8: Verify backward compatibility
// ==========================================
log.header('8. Checking backward compatibility...');

check('sla_tracking table still exists', () => {
  const table = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='sla_tracking'
  `).get();

  return table !== undefined;
});

check('sla_policies table exists', () => {
  const table = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='sla_policies'
  `).get();

  return table !== undefined;
});

// ==========================================
// Summary Statistics
// ==========================================
log.header('9. Summary Statistics...');

const stats = {
  totalTickets: db.prepare('SELECT COUNT(*) as count FROM tickets').get().count,
  ticketsWithSLA: db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sla_policy_id IS NOT NULL').get().count,
  onTrack: db.prepare("SELECT COUNT(*) as count FROM tickets WHERE sla_status = 'on_track'").get().count,
  atRisk: db.prepare("SELECT COUNT(*) as count FROM tickets WHERE sla_status = 'at_risk'").get().count,
  breached: db.prepare("SELECT COUNT(*) as count FROM tickets WHERE sla_status = 'breached'").get().count,
  escalated: db.prepare('SELECT COUNT(*) as count FROM tickets WHERE escalation_level > 0').get().count
};

console.log(`Total tickets: ${stats.totalTickets}`);
console.log(`Tickets with SLA: ${stats.ticketsWithSLA}`);
console.log(`  - On track: ${stats.onTrack}`);
console.log(`  - At risk: ${stats.atRisk}`);
console.log(`  - Breached: ${stats.breached}`);
console.log(`Escalated tickets: ${stats.escalated}`);

// ==========================================
// Final Results
// ==========================================
log.header('Verification Results');

console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${failed}${colors.reset}`);

if (failed === 0) {
  log.success('All checks passed! SLA migration is complete and working correctly.');
  process.exit(0);
} else {
  log.error(`${failed} check(s) failed. Please review the migration.`);
  log.info('You may need to re-run the migration or fix the issues manually.');
  process.exit(1);
}

// Close database
db.close();
