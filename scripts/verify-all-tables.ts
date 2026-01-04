#!/usr/bin/env tsx

import db from '../lib/db/connection';

console.log('Database:', db.name);
console.log('\n=== CHECKING ALL NOTIFICATION TABLES ===\n');

const requiredTables = [
  'notifications',
  'notification_events',
  'notification_batches',
  'batch_configurations',
  'filter_rules',
  'escalation_rules',
  'escalation_instances'
];

let allExist = true;
const missing: string[] = [];

requiredTables.forEach(tableName => {
  const exists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name = ?
  `).get(tableName);

  if (exists) {
    console.log(`✅ ${tableName}`);
  } else {
    console.log(`❌ ${tableName} - MISSING`);
    allExist = false;
    missing.push(tableName);
  }
});

if (allExist) {
  console.log('\n🎉 All required tables exist!');
} else {
  console.log(`\n⚠️  Missing tables: ${missing.join(', ')}`);
  console.log('\nWill create missing tables now...\n');

  // Criar tabelas faltantes
  if (missing.includes('notification_batches')) {
    console.log('Creating notification_batches...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_batches (
        id TEXT PRIMARY KEY,
        batch_key TEXT NOT NULL,
        notifications TEXT NOT NULL,
        target_users TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        scheduled_at DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'processed', 'failed')),
        config TEXT,
        metadata TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notification_batches_batch_key ON notification_batches(batch_key);
      CREATE INDEX IF NOT EXISTS idx_notification_batches_status ON notification_batches(status);
      CREATE INDEX IF NOT EXISTS idx_notification_batches_scheduled ON notification_batches(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_notification_batches_created ON notification_batches(created_at);

      CREATE TRIGGER IF NOT EXISTS update_notification_batches_updated_at
        AFTER UPDATE ON notification_batches
        BEGIN
          UPDATE notification_batches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);
    console.log('✅ notification_batches created');
  }

  if (missing.includes('batch_configurations')) {
    console.log('Creating batch_configurations...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS batch_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_key TEXT UNIQUE NOT NULL,
        max_batch_size INTEGER NOT NULL DEFAULT 10,
        max_wait_time INTEGER NOT NULL DEFAULT 300000,
        group_by TEXT NOT NULL DEFAULT 'user' CHECK (group_by IN ('user', 'ticket', 'type', 'priority', 'custom')),
        custom_grouper TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_batch_configurations_active ON batch_configurations(is_active);

      CREATE TRIGGER IF NOT EXISTS update_batch_configurations_updated_at
        AFTER UPDATE ON batch_configurations
        BEGIN
          UPDATE batch_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);
    console.log('✅ batch_configurations created');
  }

  if (missing.includes('filter_rules')) {
    console.log('Creating filter_rules...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS filter_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        conditions TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('block', 'allow', 'delay', 'modify', 'priority_change')),
        action_params TEXT,
        priority INTEGER NOT NULL DEFAULT 50,
        is_active BOOLEAN DEFAULT TRUE,
        user_id INTEGER,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_filter_rules_user_id ON filter_rules(user_id);
      CREATE INDEX IF NOT EXISTS idx_filter_rules_active ON filter_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_filter_rules_priority ON filter_rules(priority);

      CREATE TRIGGER IF NOT EXISTS update_filter_rules_updated_at
        AFTER UPDATE ON filter_rules
        BEGIN
          UPDATE filter_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `);
    console.log('✅ filter_rules created');
  }
}

console.log('\n=== FINAL VERIFICATION ===\n');

requiredTables.forEach(tableName => {
  const exists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name = ?
  `).get(tableName);

  if (exists) {
    console.log(`✅ ${tableName}`);
  } else {
    console.log(`❌ ${tableName} - STILL MISSING`);
  }
});

db.close();
