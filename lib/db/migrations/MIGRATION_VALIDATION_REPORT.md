# Database Migration Validation Report
**Generated:** 2025-12-13
**ServiceDesk Project**
**Total Migrations:** 23 files

---

## Executive Summary

This report provides a comprehensive validation of all database migration files in `/lib/db/migrations/`. The analysis identified critical issues with migration numbering, dependencies, and references that need to be addressed before production deployment.

### Overall Status: ⚠️ **REQUIRES ATTENTION**

- ✅ **LGPD tables (013):** Complete and well-structured
- ✅ **Workflow tables (015):** Complete with proper indexes
- ⚠️ **Migration numbering:** Multiple conflicts detected
- ⚠️ **Table dependencies:** Missing prerequisite tables in some migrations
- ⚠️ **Naming conventions:** Inconsistent (dash vs underscore)

---

## Critical Issues Found

### 1. **Duplicate Migration Numbers** ❌

Multiple migrations share the same version numbers, creating ambiguity in execution order:

#### Version 001 Conflicts (5 files):
- `001-add-multi-tenant.sql` - Multi-tenant support (tenants table)
- `001-refresh-tokens.sql` - Refresh tokens table
- `001_add_enterprise_features.sql` - AI/ML and enterprise features
- `001_initial_schema.sql` - PostgreSQL initial schema loader
- `001_postgresql_schema.sql` - PostgreSQL schema conversion

#### Version 002 Conflicts (3 files):
- `002-add-missing-tables.sql` - Missing essential tables
- `002_add_indexes_and_constraints.sql` - Performance indexes
- `002_add_organization_id_core.sql` - Organization ID for core tables

#### Version 010 Conflicts (2 files):
- `010_email_integration.sql` - Email automation system
- `010_kb_collaboration.sql` - Knowledge base collaboration

#### Version 012 Conflicts (2 files):
- `012_add_organization_id.sql` - Organization ID for remaining tables
- `012_system_settings_integrations.sql` - System settings enhancements

### 2. **Missing Table Dependencies** ⚠️

Several migrations reference tables that may not exist yet:

#### Organizations Table Issue:
- **Referenced in:** 9 migrations (002-015)
- **Created in:** `schema.sql` (line 1380) - NOT in any migration
- **Impact:** Migrations 002-015 will fail if `organizations` table doesn't exist

#### Tenants Table Issue:
- **Referenced in:** `001-refresh-tokens.sql`, `010_email_integration.sql`
- **Created in:** `001-add-multi-tenant.sql`
- **Impact:** Depends on which "001" migration runs first

#### Workflow Tables Issue:
- **Referenced in:** `015_workflow_persistence_columns.sql`
- **Created in:** `schema.sql` (line 1093) - NOT in any migration
- **Impact:** Migration 015 assumes workflow_executions already exists

### 3. **Naming Convention Inconsistency** ⚠️

Two different naming patterns are used:
- **Dash format:** `001-add-multi-tenant.sql` (4 files)
- **Underscore format:** `001_initial_schema.sql` (19 files)

**Recommendation:** Standardize on underscore format for consistency.

---

## Migration Analysis by Version

### 001 Series - Initial Schema (5 conflicts)

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `001_initial_schema.sql` | PostgreSQL loader | ✅ Valid | References external schema.postgres.sql |
| `001_postgresql_schema.sql` | Full PostgreSQL schema | ✅ Valid | Standalone PostgreSQL version |
| `001_add_enterprise_features.sql` | AI/ML tables | ✅ Valid | References organizations (missing) |
| `001-add-multi-tenant.sql` | Creates tenants table | ✅ Valid | Core multi-tenant infrastructure |
| `001-refresh-tokens.sql` | Refresh tokens | ⚠️ Issue | References tenants (dependency conflict) |

**Recommendation:** Renumber to sequential 001-005.

### 002 Series - Indexes & Organization (3 conflicts)

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `002_add_indexes_and_constraints.sql` | Performance indexes | ✅ Valid | Good index coverage |
| `002_add_organization_id_core.sql` | Org ID for users/tickets | ⚠️ Issue | References organizations (missing) |
| `002-add-missing-tables.sql` | Missing tables | ✅ Valid | Adds essential tables |

**Recommendation:** Renumber to 006-008.

### 003-005 Series - Organization ID Migration

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `003_add_organization_id_sla.sql` | Org ID for SLA tables | ⚠️ Issue | References organizations |
| `004_add_organization_id_kb.sql` | Org ID for KB articles | ⚠️ Issue | References organizations |
| `005_add_organization_id_auth.sql` | Org ID for auth tables | ⚠️ Issue | References organizations |

**Status:** Sequential numbering OK, but depends on organizations table existing.

### 006-007 Series - Performance Indexes

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `006_add_performance_indexes.sql` | Performance optimization | ✅ Valid | Comprehensive indexes |
| `007_critical_performance_indexes.sql` | Critical indexes | ✅ Valid | Good coverage |

**Status:** ✅ Well organized and documented.

### 008-009 Series - Additional Features

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `008_add_holidays_table.sql` | Business hours holidays | ✅ Valid | Clean implementation |
| `009_add_push_subscriptions.sql` | PWA push notifications | ✅ Valid | Good structure |

**Status:** ✅ No issues found.

### 010 Series - Integrations (2 conflicts)

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `010_email_integration.sql` | Email automation | ⚠️ Issue | References tenants (may not exist) |
| `010_kb_collaboration.sql` | KB reviews/versions | ✅ Valid | Good collaboration features |

**Recommendation:** Renumber one to 016.

### 011 Series - Tags & Relationships

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `011_tags_macros_relationships.sql` | Tags, macros, teams, dashboards | ✅ Excellent | Comprehensive feature set with triggers |

**Status:** ✅ One of the best-structured migrations. Includes:
- Tags system with usage tracking
- Macros (quick replies) with actions
- Ticket relationships (parent/child/duplicate)
- Ticket followers
- Custom fields
- Dashboards with widgets
- Teams with members
- Activity timeline
- Useful views (v_tickets_full, v_agent_metrics)
- Smart triggers for automation

### 012 Series - System Settings (2 conflicts)

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `012_add_organization_id.sql` | Org ID for all remaining tables | ⚠️ Issue | References organizations |
| `012_system_settings_integrations.sql` | Integration configs | ⚠️ Issue | Recreates system_settings table (destructive) |

**Recommendation:** Renumber second to 017.

### 013 Series - LGPD Compliance

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `013_lgpd_data_deletion.sql` | LGPD/GDPR compliance | ✅ Excellent | Complete compliance implementation |

**Status:** ✅ Comprehensive LGPD implementation including:
- Data erasure requests tracking
- Data portability requests
- Data retention policies (with Brazilian legal defaults)
- Consent records management
- Data processing audit trail
- Anonymized users table
- Proper indexes and triggers
- Default retention policies for 10 data types

### 014 Series - SLA Enhancement

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `014_sla_columns.sql` | SLA columns in tickets | ✅ Excellent | Well-designed denormalization |

**Status:** ✅ Smart optimization with:
- Denormalized SLA columns in tickets table for faster queries
- Automatic SLA deadline calculation triggers
- SLA status tracking (on_track, at_risk, breached)
- First response and resolution time tracking
- Escalation level tracking
- Proper partial indexes for performance
- Maintains backward compatibility with sla_tracking table

### 015 Series - Workflow Persistence

| File | Purpose | Status | Issues |
|------|---------|--------|--------|
| `015_workflow_persistence_columns.sql` | Workflow metadata columns | ⚠️ Issue | Assumes workflow tables exist (not in migrations) |

**Status:** ⚠️ Migration is valid but depends on tables created in schema.sql:
- Adds `variables` and `metadata` columns
- Creates performance indexes
- Updates existing NULL values to `{}`

---

## Dependency Graph

```
REQUIRED FIRST:
├── organizations table (MISSING - only in schema.sql)
├── tenants table (001-add-multi-tenant.sql)
└── workflow_executions table (MISSING - only in schema.sql)

THEN:
├── 002-005: Organization ID migrations (need organizations)
├── 010_email_integration: Needs tenants
└── 015: Workflow persistence (needs workflow tables)
```

---

## Schema.sql vs Migrations Gap

**Critical Finding:** Many tables are defined in `/lib/db/schema.sql` but NOT in any migration:

### Tables Only in schema.sql:
- `organizations` - Referenced by 9 migrations
- `workflows` - Referenced by 015_workflow_persistence_columns.sql
- `workflow_executions` - Modified by migration 015
- `workflow_step_executions` - Modified by migration 015
- `workflow_definitions` - Referenced by migration 012
- `kb_articles` - Modified by multiple migrations
- And many others...

**Root Cause:** The project appears to use `schema.sql` for initial database setup (via `npm run init-db`), while migrations are for incremental changes. This creates a disconnect.

---

## Recommendations

### Immediate Actions Required

#### 1. **Renumber Duplicate Migrations** (Priority: HIGH)

Proposed new numbering:

```
001 → 001_initial_schema.sql (PostgreSQL loader)
002 → 001_postgresql_schema.sql → RENAME to 001_postgresql_full_schema.sql
003 → 001_add_enterprise_features.sql → RENUMBER to 003_enterprise_features.sql
004 → 001-add-multi-tenant.sql → RENUMBER to 002_add_multi_tenant.sql
005 → 001-refresh-tokens.sql → RENUMBER to 004_refresh_tokens.sql

006 → 002_add_indexes_and_constraints.sql
007 → 002_add_organization_id_core.sql → RENUMBER to 005_organization_id_core.sql
008 → 002-add-missing-tables.sql → RENUMBER to 006_add_missing_tables.sql

009-011 → Keep as-is (003-005 series)
012-013 → Keep as-is (006-007 series)
014-015 → Keep as-is (008-009 series)

016 → 010_email_integration.sql
017 → 010_kb_collaboration.sql → RENUMBER to 010_kb_collaboration.sql (keep as-is)

018 → Keep as 011_tags_macros_relationships.sql

019 → 012_add_organization_id.sql
020 → 012_system_settings_integrations.sql → RENUMBER to 013_system_settings_integrations.sql

021 → Keep as 013_lgpd_data_deletion.sql → RENUMBER to 014_lgpd_compliance.sql
022 → Keep as 014_sla_columns.sql → RENUMBER to 015_sla_enhancements.sql
023 → Keep as 015_workflow_persistence_columns.sql → RENUMBER to 016_workflow_persistence.sql
```

#### 2. **Create Missing Base Migration** (Priority: CRITICAL)

Create `000_create_base_tables.sql` that includes:
- `organizations` table
- `workflows` table
- `workflow_executions` table
- `workflow_step_executions` table
- `kb_articles` table (if not in another migration)

This ensures all referenced tables exist before dependent migrations run.

#### 3. **Standardize Naming** (Priority: MEDIUM)

Convert all dash-format files to underscore format:
- `001-add-multi-tenant.sql` → `002_add_multi_tenant.sql`
- `001-refresh-tokens.sql` → `004_refresh_tokens.sql`
- `002-add-missing-tables.sql` → `006_add_missing_tables.sql`

#### 4. **Add Migration Order Documentation** (Priority: MEDIUM)

Create `migrations/README.md` with:
- Numbered execution order
- Dependencies between migrations
- Rollback procedures
- Testing checklist

#### 5. **Fix 012_system_settings_integrations.sql** (Priority: HIGH)

This migration **drops and recreates** the `system_settings` table, which is DESTRUCTIVE.

**Current approach (DANGEROUS):**
```sql
DROP TABLE IF EXISTS system_settings;
CREATE TABLE system_settings (...);
```

**Safer approach:**
```sql
-- Create new table with organization_id
CREATE TABLE system_settings_new (...);
-- Migrate existing data
INSERT INTO system_settings_new SELECT ... FROM system_settings;
-- Swap tables
DROP TABLE system_settings;
ALTER TABLE system_settings_new RENAME TO system_settings;
```

---

## Validation Checklist

### LGPD Migration (013) - ✅ VALIDATED

- ✅ All tables created with proper structure
- ✅ Foreign keys correctly reference users, organizations
- ✅ Indexes cover all common query patterns
- ✅ Triggers for automatic timestamp updates
- ✅ Default retention policies for Brazilian law (5-7 years)
- ✅ UUID support for consent records
- ✅ No syntax errors detected
- ✅ Complete implementation of data subject rights

**Tables Created:**
1. `lgpd_data_erasure_requests` - Deletion requests (Art. 18 LGPD)
2. `lgpd_data_portability_requests` - Export requests (Art. 18 LGPD)
3. `lgpd_data_retention_policies` - Retention periods by data type
4. `lgpd_consent_records` - Enhanced consent tracking
5. `lgpd_data_processing_records` - Processing activity audit
6. `lgpd_anonymized_users` - Anonymized records for legal compliance

**Default Policies Created:**
- Tickets: 1825 days (5 years)
- Audit logs: 2555 days (7 years)
- Consent records: 2555 days (7 years)
- Financial records: 1825 days (5 years)
- Analytics: 730 days (2 years)
- Temporary files: 30 days

### Workflow Migration (015) - ✅ VALIDATED

- ✅ Column additions use safe ALTER TABLE syntax
- ✅ Default values prevent NULL issues
- ✅ UPDATE statements set defaults for existing rows
- ✅ Indexes created for query performance
- ⚠️ Assumes workflow_executions table exists (created in schema.sql)
- ⚠️ Assumes workflow_step_executions table exists (created in schema.sql)

**Columns Added:**
- `workflow_executions.variables` (JSON)
- `workflow_executions.metadata` (JSON)
- `workflow_step_executions.metadata` (JSON)

**Indexes Created:**
- `idx_workflow_executions_workflow_id`
- `idx_workflow_executions_status`
- `idx_workflow_executions_started_at`
- `idx_workflow_step_executions_execution_id`
- `idx_workflow_step_executions_status`

---

## Testing Recommendations

### 1. Dependency Testing

```bash
# Test migration order
for migration in migrations/*.sql; do
  echo "Testing $migration..."
  # Check for missing table references
  # Validate foreign keys
  # Check for syntax errors
done
```

### 2. Rollback Testing

Each migration should have a corresponding rollback:
- Document DROP TABLE statements
- Document column removals
- Test data migration reversibility

### 3. Data Integrity Testing

After running migrations:
```sql
-- Check for orphaned foreign keys
-- Validate constraint violations
-- Test multi-tenant isolation
-- Verify index coverage
```

---

## Migration Priority Order

1. **CRITICAL:** Create `000_create_base_tables.sql`
2. **HIGH:** Renumber all duplicate migrations
3. **HIGH:** Fix destructive `012_system_settings_integrations.sql`
4. **MEDIUM:** Standardize naming conventions
5. **MEDIUM:** Create migration documentation
6. **LOW:** Add rollback scripts

---

## Conclusion

The migration files are generally well-structured with good SQL practices, especially migrations 011 (Tags/Macros), 013 (LGPD), and 014 (SLA). However, critical issues exist:

1. **Duplicate numbering** creates execution ambiguity
2. **Missing base tables** (organizations, workflows) cause dependency failures
3. **Destructive table recreation** in migration 012 risks data loss

**Action Required:** Fix duplicate numbering and create missing base table migration BEFORE production deployment.

**Status:** ⚠️ **Not production-ready** without fixes.

---

## Next Steps

1. Review and approve this validation report
2. Create fix plan for duplicate migrations
3. Test migration sequence in clean database
4. Update migration runner to enforce order
5. Add pre-migration validation checks

---

**Report prepared by:** Claude Code Agent
**Validation Date:** 2025-12-13
**Project:** ServiceDesk Multi-Tenant System
