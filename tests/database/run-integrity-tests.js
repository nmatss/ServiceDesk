#!/usr/bin/env node

/**
 * Standalone Database Integrity Test Runner
 * Runs without Playwright to avoid worker crashes
 */

const Database = require('better-sqlite3');
const { join } = require('path');
const { mkdirSync, rmSync } = require('fs');

const TEST_DB_PATH = join(process.cwd(), 'data', 'test-db-integrity.db');

let db;
let testsPassed = 0;
let testsFailed = 0;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function test(name, fn) {
  try {
    fn();
    log(`  ✓ ${name}`, 'green');
    testsPassed++;
  } catch (error) {
    log(`  ✗ ${name}`, 'red');
    log(`    ${error.message}`, 'red');
    testsFailed++;
  }
}

function expect(value) {
  return {
    toBeTruthy() {
      if (!value) throw new Error(`Expected truthy but got ${value}`);
    },
    toBeUndefined() {
      if (value !== undefined) throw new Error(`Expected undefined but got ${value}`);
    },
    toBeNull() {
      if (value !== null) throw new Error(`Expected null but got ${value}`);
    },
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${expected} but got ${value}`);
    },
    toBeGreaterThan(expected) {
      if (value <= expected) throw new Error(`Expected > ${expected} but got ${value}`);
    },
    toHaveLength(expected) {
      if (value.length !== expected) throw new Error(`Expected length ${expected} but got ${value.length}`);
    },
    toContain(expected) {
      if (!value.includes(expected)) throw new Error(`Expected to contain ${expected}`);
    },
    toThrow(pattern) {
      try {
        value();
        throw new Error('Expected function to throw but it did not');
      } catch (error) {
        if (pattern && !error.message.match(pattern)) {
          throw new Error(`Expected error matching ${pattern} but got: ${error.message}`);
        }
      }
    }
  };
}

// Setup
log('\n=== Database Integrity Test Suite ===\n', 'blue');

try {
  rmSync(TEST_DB_PATH, { force: true });
} catch {}

mkdirSync(join(process.cwd(), 'data'), { recursive: true });

db = new Database(TEST_DB_PATH);
db.pragma('foreign_keys = ON');

// Load schema
const schema = require('fs').readFileSync(
  join(process.cwd(), 'lib', 'db', 'schema.sql'),
  'utf-8'
);
db.exec(schema);

log('Database initialized\n', 'yellow');

// Tests
log('Foreign Key Constraints:', 'blue');

test('should enforce foreign key on tickets.user_id', () => {
  db.prepare('INSERT INTO categories (name, color, organization_id) VALUES (?, ?, ?)').run('Test', '#FF0000', 1);
  db.prepare('INSERT INTO priorities (name, level, color, organization_id) VALUES (?, ?, ?, ?)').run('High', 3, '#FF0000', 1);
  db.prepare('INSERT INTO statuses (name, color, is_final, organization_id) VALUES (?, ?, ?, ?)').run('Open', '#0000FF', 0, 1);

  expect(() => {
    db.prepare(`
      INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Test', 'Test', 999, 1, 1, 1, 1);
  }).toThrow(/FOREIGN KEY constraint failed/);
});

test('should enforce foreign key on comments.ticket_id', () => {
  expect(() => {
    db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal)
      VALUES (?, ?, ?, ?)
    `).run(999, 1, 'Test', 0);
  }).toThrow(/FOREIGN KEY constraint failed/);
});

log('\nCASCADE DELETE Constraints:', 'blue');

test('should cascade delete tickets when user is deleted', () => {
  const userId = db.prepare(`
    INSERT INTO users (name, email, role, organization_id)
    VALUES (?, ?, ?, ?)
  `).run('Cascade User', 'cascade@test.com', 'user', 1).lastInsertRowid;

  const ticketId = db.prepare(`
    INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Cascade Ticket', 'Test', userId, 1, 1, 1, 1).lastInsertRowid;

  let ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  expect(ticket).toBeTruthy();

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  expect(ticket).toBeUndefined();
});

log('\nUNIQUE Constraints:', 'blue');

test('should enforce unique email on users', () => {
  db.prepare(`
    INSERT INTO users (name, email, role, organization_id)
    VALUES (?, ?, ?, ?)
  `).run('User 1', 'unique@test.com', 'user', 1);

  expect(() => {
    db.prepare(`
      INSERT INTO users (name, email, role, organization_id)
      VALUES (?, ?, ?, ?)
    `).run('User 2', 'unique@test.com', 'user', 1);
  }).toThrow(/UNIQUE constraint failed/);
});

log('\nCHECK Constraints:', 'blue');

test('should enforce role CHECK constraint on users', () => {
  expect(() => {
    db.prepare(`
      INSERT INTO users (name, email, role, organization_id)
      VALUES (?, ?, ?, ?)
    `).run('Bad Role', 'badrole@test.com', 'invalid_role', 1);
  }).toThrow(/CHECK constraint failed/);
});

test('should enforce priority level CHECK constraint', () => {
  expect(() => {
    db.prepare(`
      INSERT INTO priorities (name, level, color, organization_id)
      VALUES (?, ?, ?, ?)
    `).run('Invalid', 5, '#FF0000', 1);
  }).toThrow(/CHECK constraint failed/);
});

log('\nNOT NULL Constraints:', 'blue');

test('should enforce NOT NULL on users.email', () => {
  expect(() => {
    db.prepare(`
      INSERT INTO users (name, email, role, organization_id)
      VALUES (?, ?, ?, ?)
    `).run('No Email', null, 'user', 1);
  }).toThrow(/NOT NULL constraint failed/);
});

log('\nIndex Effectiveness:', 'blue');

test('should have index on tickets.user_id', () => {
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND tbl_name='tickets' AND name LIKE '%user_id%'
  `).all();

  expect(indexes.length).toBeGreaterThan(0);
});

test('should have index on tickets.organization', () => {
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND tbl_name='tickets' AND name LIKE '%organization%'
  `).all();

  expect(indexes.length).toBeGreaterThan(0);
});

log('\nSchema Validation:', 'blue');

test('should have all core tables', () => {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `).all().map(row => row.name);

  const requiredTables = [
    'users', 'tickets', 'categories', 'priorities', 'statuses',
    'organizations', 'kb_articles'
  ];

  requiredTables.forEach(table => {
    expect(tables).toContain(table);
  });
});

test('should have foreign keys enabled', () => {
  const fkStatus = db.pragma('foreign_keys');
  expect(fkStatus).toHaveLength(1);
  expect(fkStatus[0].foreign_keys).toBe(1);
});

log('\nMulti-Tenant Data Isolation:', 'blue');

test('should isolate tickets by organization_id', () => {
  const org1 = db.prepare(`
    INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Org 1', 'org-1', 'basic', 'active', 50, 1000, 1).lastInsertRowid;

  const org2 = db.prepare(`
    INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Org 2', 'org-2', 'basic', 'active', 50, 1000, 1).lastInsertRowid;

  const user1 = db.prepare(`
    INSERT INTO users (name, email, role, organization_id)
    VALUES (?, ?, ?, ?)
  `).run('User Org 1', 'user1@org1.com', 'user', org1).lastInsertRowid;

  const user2 = db.prepare(`
    INSERT INTO users (name, email, role, organization_id)
    VALUES (?, ?, ?, ?)
  `).run('User Org 2', 'user2@org2.com', 'user', org2).lastInsertRowid;

  db.prepare(`
    INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Org 1 Ticket', 'Test', user1, 1, 1, 1, org1);

  db.prepare(`
    INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Org 2 Ticket', 'Test', user2, 1, 1, 1, org2);

  const org1Tickets = db.prepare('SELECT * FROM tickets WHERE organization_id = ?').all(org1);
  expect(org1Tickets).toHaveLength(1);

  const org2Tickets = db.prepare('SELECT * FROM tickets WHERE organization_id = ?').all(org2);
  expect(org2Tickets).toHaveLength(1);
});

// Summary
log('\n=== Test Summary ===\n', 'blue');
log(`Total Tests: ${testsPassed + testsFailed}`, 'yellow');
log(`Passed: ${testsPassed}`, 'green');
log(`Failed: ${testsFailed}`, 'red');

// Cleanup
db.close();
try {
  rmSync(TEST_DB_PATH, { force: true });
} catch {}

process.exit(testsFailed > 0 ? 1 : 0);
