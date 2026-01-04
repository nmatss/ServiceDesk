#!/usr/bin/env tsx

import db from '../lib/db/connection';

console.log('Database connection info:');
console.log('DB:', db);
console.log('\nDB name:', db.name);
console.log('\nChecking escalation tables:');

const result = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%escalation%'
`).all();

console.log(result);

db.close();
