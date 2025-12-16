#!/usr/bin/env node

/**
 * Migration Script: Apply Missing Columns
 *
 * This script adds all missing columns to fix runtime database errors.
 * It safely checks for column existence before adding to avoid SQLite errors.
 *
 * Run with: node scripts/apply-missing-columns.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'servicedesk.db');

console.log('🔧 Starting database migration...');
console.log(`📂 Database: ${DB_PATH}`);

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Check if a column exists in a table
 */
function columnExists(table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some(col => col.name === column);
}

/**
 * Check if a table exists
 */
function tableExists(table) {
  const result = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name=?
  `).get(table);
  return !!result;
}

/**
 * Safely add a column to a table
 */
function addColumn(table, column, type, defaultValue = null) {
  if (!tableExists(table)) {
    console.log(`  ⚠️  Table ${table} does not exist, skipping ${column}`);
    return false;
  }

  if (columnExists(table, column)) {
    console.log(`  ✓ Column ${table}.${column} already exists`);
    return false;
  }

  let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
  if (defaultValue !== null) {
    sql += ` DEFAULT ${defaultValue}`;
  }

  try {
    db.exec(sql);
    console.log(`  ✅ Added column ${table}.${column}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error adding ${table}.${column}: ${error.message}`);
    return false;
  }
}

/**
 * Safely create index
 */
function createIndex(name, table, columns) {
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columns})`);
    console.log(`  ✅ Created index ${name}`);
  } catch (error) {
    console.log(`  ⚠️  Index ${name}: ${error.message}`);
  }
}

// ========================================
// STEP 1: FIX RATE_LIMITS TABLE
// ========================================
console.log('\n📋 Step 1: Fixing rate_limits table...');

if (!tableExists('rate_limits')) {
  console.log('  Creating rate_limits table...');
  db.exec(`
    CREATE TABLE rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT,
      identifier TEXT,
      identifier_type TEXT,
      endpoint TEXT,
      count INTEGER DEFAULT 1,
      attempts INTEGER DEFAULT 1,
      reset_time DATETIME,
      first_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      blocked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Created rate_limits table');
} else {
  addColumn('rate_limits', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP');
  addColumn('rate_limits', 'key', 'TEXT');
  addColumn('rate_limits', 'count', 'INTEGER', '1');
  addColumn('rate_limits', 'reset_time', 'DATETIME');
  addColumn('rate_limits', 'created_at', 'DATETIME', 'CURRENT_TIMESTAMP');
}

// ========================================
// STEP 2: FIX SLA_TRACKING TABLE
// ========================================
console.log('\n📋 Step 2: Fixing sla_tracking table...');

addColumn('sla_tracking', 'first_response_at', 'DATETIME');
addColumn('sla_tracking', 'resolved_at', 'DATETIME');
addColumn('sla_tracking', 'is_violated', 'BOOLEAN', '0');
addColumn('sla_tracking', 'response_breached', 'BOOLEAN', '0');
addColumn('sla_tracking', 'resolution_breached', 'BOOLEAN', '0');
addColumn('sla_tracking', 'tenant_id', 'INTEGER', '1');

// ========================================
// STEP 3: FIX STATUSES TABLE
// ========================================
console.log('\n📋 Step 3: Fixing statuses table...');

addColumn('statuses', 'is_final', 'BOOLEAN', '0');
addColumn('statuses', 'tenant_id', 'INTEGER', '1');

// Update is_final for closed/resolved statuses
try {
  db.exec(`
    UPDATE statuses SET is_final = 1
    WHERE LOWER(name) IN ('resolved', 'closed', 'cancelled', 'resolvido', 'fechado', 'cancelado')
  `);
  console.log('  ✅ Updated is_final for final statuses');
} catch (error) {
  console.log(`  ⚠️  Could not update is_final: ${error.message}`);
}

// ========================================
// STEP 4: ADD TENANT_ID TO ALL TABLES
// ========================================
console.log('\n📋 Step 4: Adding tenant_id to tables...');

const tablesNeedingTenantId = [
  'users',
  'categories',
  'priorities',
  'tickets',
  'comments',
  'attachments',
  'sla_policies',
  'notifications',
  'kb_articles',
  'kb_categories',
  'audit_logs',
  'user_sessions',
  'analytics_daily_metrics',
  'analytics_agent_metrics'
];

for (const table of tablesNeedingTenantId) {
  addColumn(table, 'tenant_id', 'INTEGER', '1');
}

// Add is_active to users if missing
addColumn('users', 'is_active', 'BOOLEAN', '1');

// ========================================
// STEP 5: CREATE TENANTS TABLE
// ========================================
console.log('\n📋 Step 5: Creating tenants table...');

if (!tableExists('tenants')) {
  db.exec(`
    CREATE TABLE tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      domain TEXT UNIQUE,
      subdomain TEXT UNIQUE,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#3B82F6',
      secondary_color TEXT DEFAULT '#1F2937',
      subscription_plan TEXT NOT NULL DEFAULT 'basic',
      max_users INTEGER DEFAULT 50,
      max_tickets_per_month INTEGER DEFAULT 1000,
      features TEXT,
      settings TEXT,
      billing_email TEXT,
      technical_contact_email TEXT,
      is_active BOOLEAN DEFAULT 1,
      trial_ends_at DATETIME,
      subscription_ends_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Created tenants table');

  // Insert default tenant
  db.exec(`
    INSERT INTO tenants (id, name, slug, subscription_plan, is_active)
    VALUES (1, 'Default Organization', 'default', 'enterprise', 1)
  `);
  console.log('  ✅ Created default tenant');
} else {
  console.log('  ✓ Tenants table already exists');

  // Ensure default tenant exists
  const defaultTenant = db.prepare('SELECT id FROM tenants WHERE id = 1').get();
  if (!defaultTenant) {
    db.exec(`
      INSERT INTO tenants (id, name, slug, subscription_plan, is_active)
      VALUES (1, 'Default Organization', 'default', 'enterprise', 1)
    `);
    console.log('  ✅ Created default tenant');
  }
}

// ========================================
// STEP 6: CREATE SATISFACTION_SURVEYS TABLE
// ========================================
console.log('\n📋 Step 6: Creating satisfaction_surveys table...');

if (!tableExists('satisfaction_surveys')) {
  db.exec(`
    CREATE TABLE satisfaction_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('  ✅ Created satisfaction_surveys table');
} else {
  console.log('  ✓ Satisfaction_surveys table already exists');
}

// ========================================
// STEP 7: CREATE INDEXES
// ========================================
console.log('\n📋 Step 7: Creating indexes...');

createIndex('idx_users_tenant_id', 'users', 'tenant_id');
createIndex('idx_tickets_tenant_id', 'tickets', 'tenant_id');
createIndex('idx_categories_tenant_id', 'categories', 'tenant_id');
createIndex('idx_priorities_tenant_id', 'priorities', 'tenant_id');
createIndex('idx_statuses_tenant_id', 'statuses', 'tenant_id');
createIndex('idx_sla_tracking_tenant_id', 'sla_tracking', 'tenant_id');
createIndex('idx_sla_tracking_first_response', 'sla_tracking', 'first_response_at');
createIndex('idx_statuses_is_final', 'statuses', 'is_final');
createIndex('idx_rate_limits_key', 'rate_limits', 'key');
createIndex('idx_rate_limits_reset', 'rate_limits', 'reset_time');

// ========================================
// STEP 8: UPDATE EXISTING DATA
// ========================================
console.log('\n📋 Step 8: Updating existing data...');

const updateQueries = [
  { table: 'users', msg: 'users' },
  { table: 'tickets', msg: 'tickets' },
  { table: 'categories', msg: 'categories' },
  { table: 'priorities', msg: 'priorities' },
  { table: 'statuses', msg: 'statuses' },
  { table: 'comments', msg: 'comments' },
  { table: 'attachments', msg: 'attachments' },
  { table: 'sla_policies', msg: 'SLA policies' },
  { table: 'sla_tracking', msg: 'SLA tracking' },
  { table: 'notifications', msg: 'notifications' },
  { table: 'kb_articles', msg: 'KB articles' },
  { table: 'kb_categories', msg: 'KB categories' }
];

for (const { table, msg } of updateQueries) {
  if (tableExists(table) && columnExists(table, 'tenant_id')) {
    try {
      const result = db.prepare(`UPDATE ${table} SET tenant_id = 1 WHERE tenant_id IS NULL`).run();
      if (result.changes > 0) {
        console.log(`  ✅ Updated ${result.changes} ${msg} with tenant_id = 1`);
      }
    } catch (error) {
      console.log(`  ⚠️  Could not update ${msg}: ${error.message}`);
    }
  }
}

// Update is_violated based on response_met and resolution_met
if (tableExists('sla_tracking') && columnExists('sla_tracking', 'is_violated')) {
  try {
    db.exec(`
      UPDATE sla_tracking
      SET is_violated = CASE
        WHEN response_met = 0 OR resolution_met = 0 THEN 1
        ELSE 0
      END
      WHERE is_violated IS NULL OR is_violated = 0
    `);
    console.log('  ✅ Updated is_violated values');
  } catch (error) {
    console.log(`  ⚠️  Could not update is_violated: ${error.message}`);
  }
}

// Set first_response_at from comments
if (tableExists('sla_tracking') && columnExists('sla_tracking', 'first_response_at')) {
  try {
    db.exec(`
      UPDATE sla_tracking
      SET first_response_at = (
        SELECT MIN(c.created_at)
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = sla_tracking.ticket_id
        AND u.role IN ('admin', 'agent')
      )
      WHERE first_response_at IS NULL
    `);
    console.log('  ✅ Updated first_response_at from comments');
  } catch (error) {
    console.log(`  ⚠️  Could not update first_response_at: ${error.message}`);
  }
}

// Set resolved_at from tickets
if (tableExists('sla_tracking') && columnExists('sla_tracking', 'resolved_at')) {
  try {
    db.exec(`
      UPDATE sla_tracking
      SET resolved_at = (
        SELECT t.resolved_at
        FROM tickets t
        WHERE t.id = sla_tracking.ticket_id
      )
      WHERE resolved_at IS NULL
    `);
    console.log('  ✅ Updated resolved_at from tickets');
  } catch (error) {
    console.log(`  ⚠️  Could not update resolved_at: ${error.message}`);
  }
}

// ========================================
// COMPLETE
// ========================================
console.log('\n✅ Migration completed successfully!');
console.log('📊 Database schema has been updated with all missing columns.');

db.close();
