# SLA System Migration Guide

## Quick Start

### Step 1: Review the Changes
Before running the migration, review what will be changed:

**Migration File:** `lib/db/migrations/014_sla_columns.sql`

**What it does:**
- Adds 7 new columns to the `tickets` table
- Creates 4 performance indexes
- Creates 5 database triggers for automation
- Migrates existing data from `sla_tracking` table
- Maintains backward compatibility

### Step 2: Backup Your Database (IMPORTANT!)

```bash
# Create a backup of your database
cp servicedesk.db servicedesk.db.backup.$(date +%Y%m%d_%H%M%S)

# Verify backup was created
ls -lh servicedesk.db.backup.*
```

### Step 3: Run the Migration

#### Option A: Using the migration system (Recommended)

```bash
# Check migration status
npm run migrate:status

# Run all pending migrations (including 014_sla_columns.sql)
npm run migrate:run

# Verify migration was applied
npm run migrate:status
```

#### Option B: Manual migration (if Option A fails)

```bash
# Using SQLite CLI (if available)
sqlite3 servicedesk.db < lib/db/migrations/014_sla_columns.sql

# Or using Node.js
node -e "
const db = require('better-sqlite3')('servicedesk.db');
const fs = require('fs');
const sql = fs.readFileSync('lib/db/migrations/014_sla_columns.sql', 'utf8');
db.exec(sql);
console.log('Migration applied successfully!');
"
```

#### Option C: Fresh database initialization

```bash
# This will drop and recreate the entire database
# WARNING: This will delete all existing data!
npm run init-db
```

### Step 4: Verify the Migration

```bash
# Start the development server
npm run dev

# In another terminal, test the new API endpoints
curl http://localhost:3000/api/admin/sla?action=at_risk \
  -H "Authorization: Bearer YOUR_TOKEN"

curl http://localhost:3000/api/admin/sla?action=breached \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 5: Check the Database Schema

Run this query to verify the new columns exist:

```sql
-- Check tickets table schema
PRAGMA table_info(tickets);

-- Should show these new columns:
-- sla_policy_id
-- sla_deadline
-- sla_status
-- sla_first_response_at
-- sla_resolution_at
-- escalation_level
-- escalated_at
```

### Step 6: Verify Triggers

Run this query to verify all triggers were created:

```sql
-- List all triggers
SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='tickets';

-- Should show:
-- set_sla_deadline_on_ticket_insert
-- update_sla_status_on_ticket_update
-- mark_sla_first_response
-- mark_sla_resolution
```

---

## Testing the New Features

### 1. Create a Test Ticket

```bash
curl -X POST http://localhost:3000/api/tickets/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "SLA Test Ticket",
    "description": "Testing SLA auto-assignment",
    "category_id": 1,
    "priority_id": 4
  }'
```

**Expected Result:**
- Ticket is created with auto-assigned `sla_policy_id`
- `sla_deadline` is automatically calculated
- `sla_status` is set to 'on_track'

### 2. Verify Auto-Assignment

Query the database to check the ticket:

```sql
SELECT
  id,
  title,
  sla_policy_id,
  sla_deadline,
  sla_status,
  created_at
FROM tickets
WHERE title = 'SLA Test Ticket';
```

### 3. Test First Response Tracking

Add a comment as an agent:

```bash
curl -X POST http://localhost:3000/api/tickets/{ticket_id}/comments \
  -H "Authorization: Bearer AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "We are working on this issue",
    "is_internal": false
  }'
```

**Expected Result:**
- `sla_first_response_at` is automatically set to current timestamp

### 4. Test SLA Status Updates

Wait or manually update the ticket's deadline to test status transitions:

```sql
-- Simulate a ticket approaching deadline (at_risk)
UPDATE tickets
SET sla_deadline = datetime('now', '+20 minutes')
WHERE id = {ticket_id};

-- Trigger the status update
UPDATE tickets
SET updated_at = CURRENT_TIMESTAMP
WHERE id = {ticket_id};

-- Check the status (should be 'at_risk')
SELECT sla_status FROM tickets WHERE id = {ticket_id};
```

### 5. Test API Endpoints

```bash
# Get tickets at risk
curl http://localhost:3000/api/admin/sla?action=at_risk \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get breached tickets
curl http://localhost:3000/api/admin/sla?action=breached \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get SLA metrics
curl http://localhost:3000/api/admin/sla?action=metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Rollback Procedure (If Needed)

If something goes wrong, you can rollback the changes:

### Option 1: Restore from Backup

```bash
# Stop the application
# Restore the backup
cp servicedesk.db.backup.YYYYMMDD_HHMMSS servicedesk.db

# Restart the application
npm run dev
```

### Option 2: Manual Rollback SQL

```sql
-- Drop the triggers
DROP TRIGGER IF EXISTS set_sla_deadline_on_ticket_insert;
DROP TRIGGER IF EXISTS update_sla_status_on_ticket_update;
DROP TRIGGER IF EXISTS mark_sla_first_response;
DROP TRIGGER IF EXISTS mark_sla_resolution;

-- Drop the indexes
DROP INDEX IF EXISTS idx_tickets_sla_status;
DROP INDEX IF EXISTS idx_tickets_sla_deadline;
DROP INDEX IF EXISTS idx_tickets_sla_escalation;
DROP INDEX IF EXISTS idx_tickets_sla_policy;
DROP INDEX IF EXISTS idx_tickets_sla_tracking_dashboard;

-- Note: SQLite doesn't support DROP COLUMN easily
-- You would need to recreate the table without these columns
-- or just leave them (they won't hurt anything)
```

---

## Common Issues and Solutions

### Issue 1: Migration fails with "table already exists"

**Solution:** The migration uses `IF NOT EXISTS` and `IF NOT NULL` checks, so it should be safe to re-run. If it still fails:

```bash
# Check if columns already exist
sqlite3 servicedesk.db "PRAGMA table_info(tickets);"

# If columns exist, the migration was already applied
```

### Issue 2: Triggers not firing

**Solution:** Check that triggers were created:

```sql
SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='tickets';
```

### Issue 3: Data not migrated

**Solution:** Run the data migration part manually:

```sql
UPDATE tickets
SET
  sla_policy_id = (SELECT sla_policy_id FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1),
  sla_deadline = (SELECT resolution_due_at FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1),
  sla_status = CASE
    WHEN datetime('now') > (SELECT resolution_due_at FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1) THEN 'breached'
    WHEN datetime('now') > datetime((SELECT resolution_due_at FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1), '-30 minutes') THEN 'at_risk'
    ELSE 'on_track'
  END
WHERE EXISTS (SELECT 1 FROM sla_tracking WHERE ticket_id = tickets.id);
```

### Issue 4: API returns empty results

**Possible causes:**
1. No tickets have SLA policies assigned
2. All tickets are 'on_track' (none at risk or breached)
3. Database not migrated properly

**Solution:**
```sql
-- Check if any tickets have SLA data
SELECT COUNT(*) FROM tickets WHERE sla_policy_id IS NOT NULL;

-- Check distribution of SLA statuses
SELECT sla_status, COUNT(*) FROM tickets GROUP BY sla_status;
```

---

## Performance Verification

### Before Migration

```sql
-- Query time without indexes (example)
EXPLAIN QUERY PLAN
SELECT t.*, st.*
FROM tickets t
LEFT JOIN sla_tracking st ON t.id = st.ticket_id
WHERE st.response_due_at < datetime('now');
```

### After Migration

```sql
-- Query time with indexes (should be faster)
EXPLAIN QUERY PLAN
SELECT *
FROM tickets
WHERE sla_status = 'breached';
```

---

## Monitoring and Maintenance

### Daily Checks

```sql
-- Count of tickets by SLA status
SELECT sla_status, COUNT(*) as count
FROM tickets
WHERE sla_policy_id IS NOT NULL
GROUP BY sla_status;

-- Tickets near breach
SELECT id, title, sla_deadline, sla_status
FROM tickets
WHERE sla_status = 'at_risk'
ORDER BY sla_deadline ASC;
```

### Weekly Checks

```sql
-- SLA compliance rate
SELECT
  COUNT(CASE WHEN sla_status = 'on_track' OR resolved_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as compliance_percentage
FROM tickets
WHERE sla_policy_id IS NOT NULL;
```

---

## Next Steps After Migration

1. ✅ Update dashboard UI to show SLA status badges
2. ✅ Create scheduled job to check SLA status every 5 minutes
3. ✅ Add email notifications for SLA warnings
4. ✅ Create SLA compliance reports
5. ✅ Add SLA metrics to admin dashboard
6. ✅ Train support team on new SLA features

---

## Support

If you encounter any issues:

1. Check the logs: `tail -f logs/app.log`
2. Review the migration file: `lib/db/migrations/014_sla_columns.sql`
3. Check the summary: `SLA_SYSTEM_FIX_SUMMARY.md`
4. Run database integrity check: `PRAGMA integrity_check;`

---

**Migration Created:** 2025-12-13
**Version:** 014
**Status:** Ready for Production ✅
