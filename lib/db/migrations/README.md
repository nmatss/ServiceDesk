# Database Migrations

This directory contains SQL migration files for the ServiceDesk database schema.

## Overview

Migrations are numbered sequentially and must be executed in order. Each migration builds upon the previous ones.

## Migration Status

⚠️ **IMPORTANT:** This migrations directory has duplicate numbering issues that MUST be resolved before production use.

See [`MIGRATION_VALIDATION_REPORT.md`](./MIGRATION_VALIDATION_REPORT.md) for detailed analysis.

## Execution Order

### Critical Prerequisites

1. **000_create_base_tables.sql** - MUST run FIRST
   - Creates `organizations` table (required by 9 other migrations)
   - Creates `workflows` tables (required by migration 015)
   - Creates `kb_articles` table
   - Creates analytics tables

### Current Migrations (WITH CONFLICTS)

The following migrations have **numbering conflicts** that need resolution:

#### Version 001 (5 files - CONFLICT):
- `001_initial_schema.sql` - PostgreSQL schema loader
- `001_postgresql_schema.sql` - Full PostgreSQL schema
- `001_add_enterprise_features.sql` - AI/ML features
- `001-add-multi-tenant.sql` - Multi-tenant (tenants table)
- `001-refresh-tokens.sql` - Refresh tokens

#### Version 002 (3 files - CONFLICT):
- `002_add_indexes_and_constraints.sql` - Performance indexes
- `002_add_organization_id_core.sql` - Org ID for core tables
- `002-add-missing-tables.sql` - Missing tables

#### Versions 003-009 (Sequential - OK):
- `003_add_organization_id_sla.sql` - Org ID for SLA tables
- `004_add_organization_id_kb.sql` - Org ID for KB tables
- `005_add_organization_id_auth.sql` - Org ID for auth tables
- `006_add_performance_indexes.sql` - Performance optimization
- `007_critical_performance_indexes.sql` - Critical indexes
- `008_add_holidays_table.sql` - Business hours holidays
- `009_add_push_subscriptions.sql` - PWA push notifications

#### Version 010 (2 files - CONFLICT):
- `010_email_integration.sql` - Email automation
- `010_kb_collaboration.sql` - KB reviews/versions

#### Version 011 (OK):
- `011_tags_macros_relationships.sql` - Tags, macros, teams, dashboards

#### Version 012 (2 files - CONFLICT):
- `012_add_organization_id.sql` - Org ID for remaining tables
- `012_system_settings_integrations.sql` - System settings (UNSAFE)

#### Versions 013-015 (Sequential - OK):
- `013_lgpd_data_deletion.sql` - LGPD compliance
- `014_sla_columns.sql` - SLA tracking enhancements
- `015_workflow_persistence_columns.sql` - Workflow metadata

## Safe Versions

### Fixed Files

- **`012_system_settings_integrations_SAFE.sql`** - Non-destructive version of 012
  - Original version drops `system_settings` table (DATA LOSS RISK)
  - Safe version migrates data without dropping

## Recommended Execution Order (After Fixes)

Once numbering conflicts are resolved, execute in this order:

```bash
000_create_base_tables.sql              # Base tables
001_initial_schema.sql                  # Initial schema
002_add_multi_tenant.sql                # Multi-tenant
003_enterprise_features.sql             # AI/ML
004_refresh_tokens.sql                  # Auth tokens
005_organization_id_core.sql            # Org ID core
006_add_missing_tables.sql              # Missing tables
007_add_indexes_and_constraints.sql     # Indexes
008_organization_id_sla.sql             # Org ID SLA
009_organization_id_kb.sql              # Org ID KB
010_organization_id_auth.sql            # Org ID auth
011_performance_indexes.sql             # Performance
012_critical_performance_indexes.sql    # Critical indexes
013_add_holidays_table.sql              # Holidays
014_add_push_subscriptions.sql          # PWA
015_email_integration.sql               # Email
016_kb_collaboration.sql                # KB collab
017_tags_macros_relationships.sql       # Tags/macros
018_add_organization_id.sql             # Org ID remaining
019_system_settings_integrations.sql    # Settings (USE SAFE VERSION)
020_lgpd_compliance.sql                 # LGPD
021_sla_enhancements.sql                # SLA columns
022_workflow_persistence.sql            # Workflow metadata
```

## Migration Dependencies

### Organizations Table
**Required by:** 003, 005, 008-010, 018-020

Migrations that add `organization_id` columns require the `organizations` table to exist first.

**Solution:** Run `000_create_base_tables.sql` first.

### Tenants Table
**Required by:** 004, 015

Created in `002_add_multi_tenant.sql`.

### Workflow Tables
**Required by:** 022

Created in `000_create_base_tables.sql`.

### KB Articles Table
**Required by:** 009, 016

Created in `000_create_base_tables.sql`.

## How to Run Migrations

### Using SQLite (Development)

```bash
# Run single migration
sqlite3 servicedesk.db < migrations/000_create_base_tables.sql

# Run all migrations in order (after fixing numbering)
for migration in migrations/*.sql; do
  echo "Running $migration..."
  sqlite3 servicedesk.db < "$migration"
done
```

### Using PostgreSQL (Production)

```bash
# Run single migration
psql -U servicedesk -d servicedesk_db -f migrations/000_create_base_tables.sql

# Run all migrations
for migration in migrations/*.sql; do
  echo "Running $migration..."
  psql -U servicedesk -d servicedesk_db -f "$migration"
done
```

### Using Node.js Migration Runner

```bash
npm run db:migrate
```

## Testing Migrations

### Before Running

1. **Backup database:**
   ```bash
   cp servicedesk.db servicedesk.db.backup
   ```

2. **Test in clean database:**
   ```bash
   rm test.db
   sqlite3 test.db < migrations/000_create_base_tables.sql
   # Continue with other migrations...
   ```

3. **Validate schema:**
   ```bash
   sqlite3 servicedesk.db ".schema" > schema_after_migration.sql
   diff schema_before_migration.sql schema_after_migration.sql
   ```

### After Running

1. **Check for errors:**
   ```bash
   # Look for failed foreign key constraints
   PRAGMA foreign_key_check;

   # Check integrity
   PRAGMA integrity_check;
   ```

2. **Verify tables exist:**
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
   ```

3. **Verify indexes:**
   ```sql
   SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name;
   ```

## Rollback Procedures

### Manual Rollback

For each migration, document the reverse operations:

**Example:**
```sql
-- Migration: 014_sla_columns.sql
-- Rollback:
ALTER TABLE tickets DROP COLUMN sla_policy_id;
ALTER TABLE tickets DROP COLUMN sla_deadline;
ALTER TABLE tickets DROP COLUMN sla_status;
-- ... etc
```

### Database Restore

If migration fails:
```bash
# SQLite
cp servicedesk.db.backup servicedesk.db

# PostgreSQL
pg_restore -d servicedesk_db backup.dump
```

## Common Issues

### Issue: "table organizations does not exist"

**Solution:** Run `000_create_base_tables.sql` first.

### Issue: "UNIQUE constraint failed"

**Solution:** Migration was run multiple times. Check migration tracking table or restore from backup.

### Issue: "no such table: tenants"

**Solution:** Run `002_add_multi_tenant.sql` before migrations that depend on tenants.

### Issue: Data loss in system_settings

**Solution:** Use `012_system_settings_integrations_SAFE.sql` instead of original.

## Migration Tracking

Consider implementing a migration tracking table:

```sql
CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    checksum TEXT
);
```

## Best Practices

1. **Always backup before migrating**
2. **Test in development first**
3. **Run migrations in transaction blocks**
4. **Use IF NOT EXISTS for CREATE TABLE**
5. **Use INSERT OR IGNORE for seed data**
6. **Document rollback procedures**
7. **Track applied migrations**
8. **Never modify executed migrations**
9. **Add new changes as new migrations**

## File Naming Convention

**Format:** `NNN_description.sql`

- `NNN` = 3-digit zero-padded version number
- `description` = lowercase with underscores
- `.sql` = extension

**Examples:**
- ✅ `001_create_users.sql`
- ✅ `015_add_notifications.sql`
- ❌ `1_create_users.sql` (not zero-padded)
- ❌ `001-create-users.sql` (use underscore)
- ❌ `001_Create_Users.sql` (use lowercase)

## Current Action Items

### High Priority

1. **Renumber duplicate migrations** - See MIGRATION_VALIDATION_REPORT.md
2. **Replace 012_system_settings_integrations.sql** with SAFE version
3. **Verify 000_create_base_tables.sql runs first**
4. **Test complete migration sequence in clean database**

### Medium Priority

1. **Standardize naming** (dash → underscore)
2. **Create rollback scripts**
3. **Implement migration tracking table**
4. **Add migration checksum verification**

### Low Priority

1. **Create migration documentation**
2. **Add migration test suite**
3. **Implement automated migration runner**

## Support

For issues or questions:
1. Check MIGRATION_VALIDATION_REPORT.md
2. Review migration file comments
3. Check database logs
4. Consult schema.sql for reference

## Changelog

### 2025-12-13
- Created 000_create_base_tables.sql
- Created MIGRATION_VALIDATION_REPORT.md
- Created 012_system_settings_integrations_SAFE.sql
- Identified duplicate numbering issues
- Documented all migrations

---

**Last Updated:** 2025-12-13
**Status:** ⚠️ Requires numbering fixes before production
