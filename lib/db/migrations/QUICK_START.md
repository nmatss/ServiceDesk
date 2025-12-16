# Migration Quick Start Guide

**Read this FIRST before running any migrations!**

---

## ⚠️ CRITICAL: Run Migrations in This Order

```bash
# STEP 1: Base Tables (MUST RUN FIRST!)
sqlite3 servicedesk.db < migrations/000_create_base_tables.sql

# STEP 2: Continue with other migrations
# See full order in README.md
```

---

## 🚨 Known Issues - DO NOT IGNORE

### 1. Duplicate Migration Numbers
- 5 files numbered "001"
- 3 files numbered "002"
- 2 files numbered "010"
- 2 files numbered "012"

**Impact:** Unclear execution order, potential failures

**Solution:** Follow execution order in README.md

### 2. Missing Base Tables
`organizations` table referenced by 9 migrations but not created by any of them.

**Impact:** Migration failures with "table does not exist" errors

**Solution:** ✅ Run `000_create_base_tables.sql` FIRST

### 3. Unsafe Migration
`012_system_settings_integrations.sql` DROPS the system_settings table!

**Impact:** 🔥 DATA LOSS

**Solution:** ✅ Use `012_system_settings_integrations_SAFE.sql` instead

---

## ✅ What's Been Fixed

### New File: `000_create_base_tables.sql`
Creates all tables that other migrations depend on:
- `organizations` - Required by 9 migrations
- `workflows`, `workflow_executions`, `workflow_step_executions`
- `kb_articles`, `templates`, `user_sessions`
- Analytics tables

**Run this FIRST!**

### New File: `012_system_settings_integrations_SAFE.sql`
Safe replacement for original:
- Migrates data without dropping table
- No data loss
- Backward compatible

**Use this instead of original 012!**

---

## 🎯 Quick Migration for Fresh Database

```bash
#!/bin/bash
# Fresh database setup

DB="servicedesk.db"

# Remove old database (CAREFUL!)
# rm $DB

# 1. Base tables (CRITICAL!)
echo "Creating base tables..."
sqlite3 $DB < migrations/000_create_base_tables.sql

# 2. Initial schema
echo "Loading initial schema..."
sqlite3 $DB < migrations/001_initial_schema.sql

# 3. Multi-tenant
echo "Adding multi-tenant support..."
sqlite3 $DB < migrations/001-add-multi-tenant.sql

# 4. Enterprise features
echo "Adding enterprise features..."
sqlite3 $DB < migrations/001_add_enterprise_features.sql

# 5. Refresh tokens
echo "Adding refresh tokens..."
sqlite3 $DB < migrations/001-refresh-tokens.sql

# Continue with others in order...
# See README.md for complete list

echo "Migration complete!"
```

---

## 📋 Pre-Flight Checklist

Before running ANY migration:

- [ ] Database backup created
- [ ] Read MIGRATION_VALIDATION_REPORT.md
- [ ] Understand what each migration does
- [ ] Using SAFE version of 012_system_settings
- [ ] Running 000_create_base_tables.sql FIRST
- [ ] Tested in development database first

---

## 🔍 Validation Commands

### After Each Migration

```sql
-- Check for errors
PRAGMA foreign_key_check;
PRAGMA integrity_check;

-- List all tables
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Verify organizations exists
SELECT COUNT(*) FROM organizations; -- Should be 1
```

---

## 🆘 Emergency Rollback

If migration fails:

```bash
# SQLite
cp servicedesk.db.backup servicedesk.db

# PostgreSQL
pg_restore -d servicedesk_db backup.dump
```

---

## 📊 Migration Status Summary

### ✅ Excellent (Run as-is)
- `011_tags_macros_relationships.sql` - Tags, macros, teams
- `013_lgpd_data_deletion.sql` - LGPD compliance
- `014_sla_columns.sql` - SLA optimization

### ⚠️ Use Modified Version
- ~~`012_system_settings_integrations.sql`~~ **DO NOT USE**
- `012_system_settings_integrations_SAFE.sql` **USE THIS**

### 🔧 Requires Base Tables First
- `002_add_organization_id_core.sql`
- `003_add_organization_id_sla.sql`
- `004_add_organization_id_kb.sql`
- `005_add_organization_id_auth.sql`
- `012_add_organization_id.sql`
- `015_workflow_persistence_columns.sql`

---

## 📚 Documentation Files

1. **QUICK_START.md** (this file) - Read first
2. **README.md** - Complete migration guide
3. **MIGRATION_VALIDATION_REPORT.md** - Full analysis
4. **MIGRATION_FIXES_SUMMARY.md** - What was fixed

---

## ⏱️ Estimated Time

- Single migration: 1-5 seconds
- All migrations: < 1 minute
- Testing/verification: 5-10 minutes
- **Total time: ~15 minutes**

---

## 🎓 Key Learnings

### DO
✅ Run 000_create_base_tables.sql FIRST
✅ Use SAFE version of 012_system_settings
✅ Backup before migrating
✅ Test in development first
✅ Verify after each migration

### DON'T
❌ Skip 000_create_base_tables.sql
❌ Use original 012_system_settings_integrations.sql
❌ Run on production without testing
❌ Ignore errors
❌ Skip foreign key checks

---

## 🔐 Security Notes

### Encrypted Settings

Several migrations add encrypted settings:
- `totvs_password`
- `sap_password`
- `pix_client_secret`
- `boleto_client_secret`
- `govbr_client_secret`
- `whatsapp_access_token`

Ensure your application encrypts these before storing!

---

## 🏆 Success Indicators

Migration successful when:
- ✅ No error messages
- ✅ PRAGMA foreign_key_check returns empty
- ✅ PRAGMA integrity_check returns "ok"
- ✅ SELECT COUNT(*) FROM organizations = 1
- ✅ Application starts without database errors

---

## 📞 Get Help

If you encounter issues:

1. Check error message
2. Review MIGRATION_VALIDATION_REPORT.md
3. Check "Common Issues" in README.md
4. Verify execution order
5. Ensure 000_create_base_tables.sql ran first

---

## 🚀 Production Deployment

### Staging Checklist
- [ ] All migrations tested in development
- [ ] Foreign key checks pass
- [ ] Integrity checks pass
- [ ] Application tested
- [ ] Rollback plan documented

### Production Checklist
- [ ] Database backup created
- [ ] Maintenance window scheduled
- [ ] Team notified
- [ ] Monitoring enabled
- [ ] Rollback plan ready

---

**Last Updated:** 2025-12-13
**Status:** Ready for use
**Priority:** Read before ANY migration!

---

*Don't skip this guide - 5 minutes reading now saves hours of debugging later!*
