# Database Migration Guide

## Overview

This guide provides comprehensive instructions for managing database migrations in the ServiceDesk application, including:
- SQLite to PostgreSQL migration
- Schema evolution procedures
- Data migration strategies
- Multi-tenant migration considerations
- Rollback procedures

## Current Database State

**Development**: SQLite 3
**Production Ready**: PostgreSQL 14+
**Schema Version**: 1.0
**Migration System**: SQL-based with manual execution

## Migration Files Structure

```
lib/db/migrations/
├── 001_postgresql_schema.sql          # Full PostgreSQL schema
├── 002_add_organization_id_core.sql   # Multi-tenant core tables
├── 003_add_organization_id_sla.sql    # Multi-tenant SLA tables
├── 004_add_organization_id_kb.sql     # Multi-tenant KB tables
├── 005_add_organization_id_auth.sql   # Multi-tenant auth tables
└── 006_add_performance_indexes.sql    # Performance optimization
```

## Migration Strategies

### Strategy 1: SQLite to PostgreSQL (Full Migration)

**When**: Moving from development to production
**Downtime**: 2-4 hours (depending on data size)
**Risk**: Medium
**Recommended For**: Initial production deployment

#### Prerequisites
1. PostgreSQL 14+ installed and configured
2. Backup of SQLite database
3. Database connection configured
4. Test environment ready

#### Migration Steps

**Step 1: Backup Current Database**
```bash
# Create backup
npm run db:backup

# Or manual SQLite backup
sqlite3 data/servicedesk.db ".backup data/servicedesk-backup-$(date +%Y%m%d).db"
```

**Step 2: Export Data from SQLite**
```bash
# Export all tables to JSON
node scripts/export-sqlite-data.js > data/export-$(date +%Y%m%d).json
```

**Step 3: Create PostgreSQL Database**
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE servicedesk_production;

-- Create user
CREATE USER servicedesk WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE servicedesk_production TO servicedesk;
```

**Step 4: Run PostgreSQL Schema**
```bash
# Set environment
export DATABASE_URL="postgresql://servicedesk:password@localhost:5432/servicedesk_production"

# Run migration
psql $DATABASE_URL -f lib/db/migrations/001_postgresql_schema.sql
```

**Step 5: Run Additional Migrations**
```bash
psql $DATABASE_URL -f lib/db/migrations/002_add_organization_id_core.sql
psql $DATABASE_URL -f lib/db/migrations/003_add_organization_id_sla.sql
psql $DATABASE_URL -f lib/db/migrations/004_add_organization_id_kb.sql
psql $DATABASE_URL -f lib/db/migrations/005_add_organization_id_auth.sql
psql $DATABASE_URL -f lib/db/migrations/006_add_performance_indexes.sql
```

**Step 6: Import Data**
```bash
# Import data from JSON export
node scripts/import-to-postgres.js data/export-20251005.json
```

**Step 7: Verify Data Integrity**
```bash
# Run integrity checks
node scripts/verify-migration.js

# Manual verification
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tickets;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM organizations;"
```

**Step 8: Update Application Configuration**
```javascript
// lib/db/connection.ts
// Switch from SQLite to PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default pool;
```

**Step 9: Run Application Tests**
```bash
npm run test
npm run test:integration
```

**Step 10: Deploy**
```bash
# Update environment variables
# DATABASE_URL=postgresql://...

# Deploy application
npm run build
npm run start
```

### Strategy 2: Gradual Migration (Zero-Downtime)

**When**: Large production database with strict uptime requirements
**Downtime**: None
**Risk**: Low
**Recommended For**: Established production systems

#### Phase 1: Dual-Write Setup

**Step 1: Add PostgreSQL Connection**
```typescript
// lib/db/dual-connection.ts
import Database from 'better-sqlite3';
import { Pool } from 'pg';

const sqlite = new Database('data/servicedesk.db');
const pg = new Pool({ connectionString: process.env.DATABASE_URL });

export const dualWrite = async (sqliteQuery, pgQuery, params) => {
  // Write to both databases
  const sqliteResult = sqliteQuery.run(...params);
  const pgResult = await pg.query(pgQuery, params);
  return { sqlite: sqliteResult, pg: pgResult };
};
```

**Step 2: Update Write Operations**
```typescript
// Example: Create ticket
export const createTicket = async (ticket: CreateTicket) => {
  const sqliteStmt = db.prepare(`INSERT INTO tickets ...`);
  const pgQuery = `INSERT INTO tickets ... RETURNING *`;

  return await dualWrite(sqliteStmt, pgQuery, [
    ticket.title,
    ticket.description,
    // ...
  ]);
};
```

**Step 3: Sync Historical Data**
```bash
# Run data sync in background
node scripts/sync-sqlite-to-postgres.js
```

**Step 4: Verify Data Consistency**
```bash
# Compare row counts
node scripts/compare-databases.js

# Sample data verification
node scripts/verify-random-samples.js
```

#### Phase 2: Gradual Read Migration

**Step 1: Read from Both, Verify**
```typescript
export const getTicketById = async (id: number) => {
  const sqliteTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  const pgTicket = await pg.query('SELECT * FROM tickets WHERE id = $1', [id]);

  // Compare and log differences
  if (JSON.stringify(sqliteTicket) !== JSON.stringify(pgTicket.rows[0])) {
    console.error('Data inconsistency detected', { id, sqliteTicket, pgTicket });
  }

  return sqliteTicket; // Still return SQLite
};
```

**Step 2: Gradual Traffic Shift**
```typescript
const USE_POSTGRES_PERCENTAGE = parseInt(process.env.PG_TRAFFIC_PERCENT || '0');

export const getTicketById = async (id: number) => {
  const usePostgres = Math.random() * 100 < USE_POSTGRES_PERCENTAGE;

  if (usePostgres) {
    const result = await pg.query('SELECT * FROM tickets WHERE id = $1', [id]);
    return result.rows[0];
  } else {
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  }
};
```

**Step 3: Monitor and Increase**
```bash
# Week 1: 10% traffic
export PG_TRAFFIC_PERCENT=10

# Week 2: 25% traffic
export PG_TRAFFIC_PERCENT=25

# Week 3: 50% traffic
export PG_TRAFFIC_PERCENT=50

# Week 4: 75% traffic
export PG_TRAFFIC_PERCENT=75

# Week 5: 100% traffic
export PG_TRAFFIC_PERCENT=100
```

#### Phase 3: Complete Migration

**Step 1: Switch All Reads to PostgreSQL**
```typescript
// Remove SQLite reads
export const getTicketById = async (id: number) => {
  const result = await pg.query('SELECT * FROM tickets WHERE id = $1', [id]);
  return result.rows[0];
};
```

**Step 2: Stop Dual Writes**
```typescript
// Write only to PostgreSQL
export const createTicket = async (ticket: CreateTicket) => {
  const result = await pg.query(
    'INSERT INTO tickets (...) VALUES (...) RETURNING *',
    [ticket.title, ticket.description, ...]
  );
  return result.rows[0];
};
```

**Step 3: Decommission SQLite**
```bash
# Backup final state
cp data/servicedesk.db backups/servicedesk-final-$(date +%Y%m%d).db

# Remove SQLite connection
# Update code to remove SQLite imports
```

## Schema Evolution

### Adding New Column

**Step 1: Create Migration File**
```sql
-- migrations/007_add_ticket_priority_score.sql
ALTER TABLE tickets ADD COLUMN priority_score INTEGER DEFAULT 0;
CREATE INDEX idx_tickets_priority_score ON tickets(priority_score);

-- Backfill existing data
UPDATE tickets
SET priority_score = CASE
    WHEN priority_id = 1 THEN 1
    WHEN priority_id = 2 THEN 5
    WHEN priority_id = 3 THEN 8
    WHEN priority_id = 4 THEN 10
END;
```

**Step 2: Update TypeScript Types**
```typescript
// lib/types/database.ts
export interface Ticket {
  id: number;
  // ... existing fields
  priority_score: number; // NEW
  created_at: string;
  updated_at: string;
}
```

**Step 3: Update Query Functions**
```typescript
// lib/db/queries.ts
export const ticketQueries = {
  getAll: () => {
    return db.prepare('SELECT *, priority_score FROM tickets ...').all();
  }
};
```

### Adding New Table

**Step 1: Create Migration**
```sql
-- migrations/008_add_ticket_tags.sql
CREATE TABLE ticket_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    UNIQUE(ticket_id, tag)
);

CREATE INDEX idx_ticket_tags_ticket ON ticket_tags(ticket_id);
CREATE INDEX idx_ticket_tags_tag ON ticket_tags(tag);
```

**Step 2: Add Types**
```typescript
export interface TicketTag {
  id: number;
  ticket_id: number;
  tag: string;
  created_at: string;
}
```

**Step 3: Add Query Functions**
```typescript
export const ticketTagQueries = {
  getByTicketId: (ticketId: number) => {
    return db.prepare('SELECT * FROM ticket_tags WHERE ticket_id = ?').all(ticketId);
  },
  create: (ticketId: number, tag: string) => {
    return db.prepare('INSERT INTO ticket_tags (ticket_id, tag) VALUES (?, ?)').run(ticketId, tag);
  }
};
```

### Modifying Existing Column

**Step 1: Create Backup**
```sql
-- Always backup before schema changes
CREATE TABLE tickets_backup AS SELECT * FROM tickets;
```

**Step 2: Create Migration**
```sql
-- migrations/009_modify_ticket_title_length.sql

-- For PostgreSQL:
ALTER TABLE tickets ALTER COLUMN title TYPE VARCHAR(1000);

-- For SQLite (requires recreation):
BEGIN TRANSACTION;

-- Create new table
CREATE TABLE tickets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT(1000) NOT NULL,  -- Changed length
    -- ... rest of columns
);

-- Copy data
INSERT INTO tickets_new SELECT * FROM tickets;

-- Drop old table
DROP TABLE tickets;

-- Rename new table
ALTER TABLE tickets_new RENAME TO tickets;

-- Recreate indexes and triggers
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
-- ... all other indexes

COMMIT;
```

## Data Migration Best Practices

### 1. Always Create Backups

```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}"

mkdir -p $BACKUP_DIR

# SQLite backup
if [ -f "data/servicedesk.db" ]; then
  cp data/servicedesk.db $BACKUP_DIR/servicedesk.db
  echo "SQLite backup created: $BACKUP_DIR/servicedesk.db"
fi

# PostgreSQL backup
if [ ! -z "$DATABASE_URL" ]; then
  pg_dump $DATABASE_URL > $BACKUP_DIR/postgres-dump.sql
  echo "PostgreSQL backup created: $BACKUP_DIR/postgres-dump.sql"
fi
```

### 2. Test Migrations

```typescript
// scripts/test-migration.ts
import { runMigration } from './run-migration';
import { verifyDataIntegrity } from './verify-integrity';

async function testMigration(migrationFile: string) {
  // Create test database
  const testDb = createTestDatabase();

  try {
    // Run migration
    await runMigration(testDb, migrationFile);

    // Verify integrity
    const issues = await verifyDataIntegrity(testDb);

    if (issues.length > 0) {
      console.error('Migration issues:', issues);
      process.exit(1);
    }

    console.log('Migration test passed');
  } finally {
    // Cleanup test database
    testDb.close();
  }
}
```

### 3. Use Transactions

```sql
-- All migrations should be wrapped in transactions
BEGIN TRANSACTION;

-- Migration steps here
ALTER TABLE tickets ADD COLUMN new_field TEXT;
UPDATE tickets SET new_field = 'default';

-- Verify changes
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM tickets WHERE new_field IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows with NULL new_field', null_count;
  END IF;
END $$;

COMMIT;
```

### 4. Implement Rollback Plans

```sql
-- migrations/010_add_ticket_workflow.sql

-- UP
BEGIN TRANSACTION;

CREATE TABLE ticket_workflows (
    id INTEGER PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    workflow_state TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

COMMIT;

-- DOWN (rollback)
BEGIN TRANSACTION;

DROP TABLE IF EXISTS ticket_workflows;

COMMIT;
```

### 5. Monitor Migration Progress

```typescript
// scripts/monitor-migration.ts

async function monitorMigration() {
  const startTime = Date.now();
  let lastRowCount = 0;

  const interval = setInterval(async () => {
    const rowCount = await getRowCount();
    const rowsPerSecond = (rowCount - lastRowCount) / 5;
    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`Progress: ${rowCount} rows migrated (${rowsPerSecond.toFixed(0)} rows/sec, ${elapsed.toFixed(0)}s elapsed)`);

    lastRowCount = rowCount;
  }, 5000);

  // Stop monitoring when migration complete
  return () => clearInterval(interval);
}
```

## Multi-Tenant Migration Considerations

### Adding organization_id to Existing Table

```sql
-- Step 1: Add column (nullable initially)
ALTER TABLE existing_table ADD COLUMN organization_id INTEGER;

-- Step 2: Create default organization if not exists
INSERT INTO organizations (id, name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
VALUES (1, 'Default Organization', 'default', 'enterprise', 'active', 1000, 10000, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Backfill existing data
UPDATE existing_table
SET organization_id = 1
WHERE organization_id IS NULL;

-- Step 4: Make column NOT NULL
ALTER TABLE existing_table ALTER COLUMN organization_id SET NOT NULL;

-- Step 5: Add foreign key
ALTER TABLE existing_table
ADD CONSTRAINT fk_existing_table_organization
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 6: Add index
CREATE INDEX idx_existing_table_organization ON existing_table(organization_id);
```

### Splitting Single-Tenant to Multi-Tenant

```typescript
// scripts/split-to-multi-tenant.ts

async function splitToMultiTenant(oldDb: Database, newDb: Pool) {
  // 1. Create organizations from user domains
  const domains = await oldDb.prepare('SELECT DISTINCT substr(email, instr(email, "@") + 1) as domain FROM users').all();

  const orgMap = new Map<string, number>();
  for (const { domain } of domains) {
    const result = await newDb.query(
      'INSERT INTO organizations (name, slug, domain) VALUES ($1, $2, $3) RETURNING id',
      [`${domain} Organization`, slugify(domain), domain]
    );
    orgMap.set(domain, result.rows[0].id);
  }

  // 2. Migrate users with organization_id
  const users = await oldDb.prepare('SELECT * FROM users').all();
  for (const user of users) {
    const domain = user.email.split('@')[1];
    const organizationId = orgMap.get(domain);

    await newDb.query(
      'INSERT INTO users (id, name, email, role, organization_id) VALUES ($1, $2, $3, $4, $5)',
      [user.id, user.name, user.email, user.role, organizationId]
    );
  }

  // 3. Migrate tickets with organization_id
  // Users now have organization_id, so we can join
  await newDb.query(`
    INSERT INTO tickets (id, title, description, user_id, organization_id, ...)
    SELECT t.id, t.title, t.description, t.user_id, u.organization_id, ...
    FROM old_tickets t
    JOIN users u ON t.user_id = u.id
  `);
}
```

## Rollback Procedures

### Emergency Rollback

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "EMERGENCY ROLLBACK INITIATED"

# 1. Stop application
pm2 stop servicedesk

# 2. Restore from backup
LATEST_BACKUP=$(ls -t backups/ | head -1)
echo "Restoring from: $LATEST_BACKUP"

# For SQLite
cp backups/$LATEST_BACKUP/servicedesk.db data/servicedesk.db

# For PostgreSQL
psql $DATABASE_URL < backups/$LATEST_BACKUP/postgres-dump.sql

# 3. Restart application
pm2 start servicedesk

echo "ROLLBACK COMPLETE"
```

### Planned Rollback

```sql
-- migrations/DOWN/010_rollback_ticket_workflow.sql

BEGIN TRANSACTION;

-- 1. Backup data that will be deleted
CREATE TABLE ticket_workflows_backup AS SELECT * FROM ticket_workflows;

-- 2. Drop foreign key constraints
ALTER TABLE ticket_workflow_logs DROP CONSTRAINT fk_ticket_workflow;

-- 3. Drop table
DROP TABLE ticket_workflows;

-- 4. Restore any dependent data
-- (if needed)

COMMIT;
```

## Migration Checklist

### Pre-Migration
- [ ] Full database backup created
- [ ] Migration tested on copy of production data
- [ ] Rollback procedure documented and tested
- [ ] Downtime window scheduled (if required)
- [ ] Team notified
- [ ] Monitoring alerts configured

### During Migration
- [ ] Application in maintenance mode (if needed)
- [ ] Migration script executed
- [ ] Progress monitored
- [ ] Errors logged
- [ ] Data integrity verified

### Post-Migration
- [ ] Application tests passed
- [ ] Data integrity checks passed
- [ ] Performance benchmarks met
- [ ] User acceptance testing completed
- [ ] Backup of post-migration state created
- [ ] Documentation updated
- [ ] Team notified of completion

## Common Issues and Solutions

### Issue 1: Foreign Key Constraint Violation

**Problem**: Migration fails due to orphaned records
**Solution**:
```sql
-- Identify orphaned records
SELECT t.* FROM tickets t
LEFT JOIN users u ON t.user_id = u.id
WHERE u.id IS NULL;

-- Option 1: Delete orphaned records
DELETE FROM tickets WHERE user_id NOT IN (SELECT id FROM users);

-- Option 2: Assign to default user
UPDATE tickets
SET user_id = 1  -- default admin user
WHERE user_id NOT IN (SELECT id FROM users);
```

### Issue 2: Data Type Mismatch

**Problem**: SQLite TEXT to PostgreSQL JSONB conversion
**Solution**:
```sql
-- Create temporary column
ALTER TABLE users ADD COLUMN metadata_new JSONB;

-- Convert TEXT to JSONB
UPDATE users SET metadata_new = metadata::JSONB WHERE metadata IS NOT NULL;

-- Drop old column and rename
ALTER TABLE users DROP COLUMN metadata;
ALTER TABLE users RENAME COLUMN metadata_new TO metadata;
```

### Issue 3: Large Table Migration Timeout

**Problem**: Migration times out on large tables
**Solution**:
```typescript
// Batch migration
async function migrateLargeTable(source, dest, batchSize = 1000) {
  let offset = 0;
  let migrated = 0;

  while (true) {
    const rows = await source.query(
      'SELECT * FROM large_table ORDER BY id LIMIT $1 OFFSET $2',
      [batchSize, offset]
    );

    if (rows.length === 0) break;

    for (const row of rows) {
      await dest.query('INSERT INTO large_table (...) VALUES (...)', [...]);
    }

    migrated += rows.length;
    offset += batchSize;

    console.log(`Migrated ${migrated} rows...`);
    await sleep(100); // Throttle to avoid overwhelming database
  }
}
```

## Tools and Scripts

### Migration Runner

```typescript
// scripts/run-migration.ts
import { readFileSync } from 'fs';
import db from './connection';

export async function runMigration(file: string) {
  console.log(`Running migration: ${file}`);

  const sql = readFileSync(file, 'utf-8');
  const statements = sql.split(';').filter(s => s.trim());

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (error) {
      console.error(`Migration failed at: ${statement}`);
      throw error;
    }
  }

  console.log('Migration complete');
}
```

### Data Verification

```typescript
// scripts/verify-migration.ts
export async function verifyMigration() {
  const checks = [
    { name: 'Row counts match', fn: verifyRowCounts },
    { name: 'Foreign keys valid', fn: verifyForeignKeys },
    { name: 'No NULL violations', fn: verifyNotNulls },
    { name: 'Unique constraints valid', fn: verifyUnique },
  ];

  for (const check of checks) {
    console.log(`Running: ${check.name}`);
    const result = await check.fn();
    console.log(result ? '✓ PASS' : '✗ FAIL');
  }
}
```

## Support and Resources

- **Migration Support**: See team lead
- **Database Documentation**: `/home/nic20/ProjetosWeb/ServiceDesk/DATABASE_SCHEMA.md`
- **Integrity Report**: `/home/nic20/ProjetosWeb/ServiceDesk/DATA_INTEGRITY_REPORT.md`
- **Emergency Contact**: Database administrator

## Conclusion

Following this guide ensures safe, reliable database migrations with minimal downtime and risk. Always test migrations thoroughly before applying to production.
