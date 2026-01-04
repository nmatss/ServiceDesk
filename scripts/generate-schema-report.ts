#!/usr/bin/env tsx

import db from '../lib/db/connection';

const tables = ['notification_batches', 'batch_configurations', 'filter_rules', 'escalation_rules', 'escalation_instances'];

console.log('='.repeat(80));
console.log('AGENT 23: NOTIFICATION TABLES - COMPLETE SCHEMA REPORT');
console.log('='.repeat(80));
console.log('');

for (const tableName of tables) {
  const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`).get(tableName) as { sql: string } | undefined;

  if (schema) {
    console.log(`TABLE: ${tableName}`);
    console.log('-'.repeat(80));
    console.log(schema.sql);
    console.log('');

    // Get indexes
    const indexes = db.prepare(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name = ? AND sql IS NOT NULL`).all(tableName) as { sql: string }[];
    if (indexes.length > 0) {
      console.log(`INDEXES FOR ${tableName}:`);
      indexes.forEach(idx => console.log(idx.sql));
      console.log('');
    }

    // Get triggers
    const triggers = db.prepare(`SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name = ?`).all(tableName) as { sql: string }[];
    if (triggers.length > 0) {
      console.log(`TRIGGERS FOR ${tableName}:`);
      triggers.forEach(trg => console.log(trg.sql));
      console.log('');
    }

    console.log('');
  }
}

console.log('='.repeat(80));
console.log('END OF SCHEMA REPORT');
console.log('='.repeat(80));

db.close();
