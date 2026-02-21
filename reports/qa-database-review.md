# QA Database Review Report

**Project:** ServiceDesk
**Date:** 2026-02-21
**Reviewer:** DBA Specialist (qa-database)
**Scope:** Complete database layer review -- schemas, adapter, connections, config, query modules, init/seed, types

---

## Executive Summary

The ServiceDesk database layer is a comprehensive multi-database architecture supporting 110+ tables across SQLite (development) and PostgreSQL (production) backends, unified through a custom adapter pattern. While the overall design is solid and feature-rich, this review identified **18 CRITICAL**, **24 HIGH**, **19 MEDIUM**, and **12 LOW** severity issues that must be addressed before production deployment with PostgreSQL.

The most impactful issues fall into three categories:
1. **Transaction isolation bugs** -- query modules use global `executeRun` inside `executeTransaction` callbacks, bypassing PostgreSQL connection pooling
2. **SQLite-specific SQL** -- `julianday()`, `date()`, `DATETIME()`, `strftime()` used extensively in queries, will fail on PostgreSQL
3. **Schema-type-query misalignment** -- column names, CHECK constraint values, and TypeScript types diverge in multiple places

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `lib/db/schema.sql` | 3,397 | Fully reviewed |
| `lib/db/schema.postgres.sql` | 2,076 | Fully reviewed |
| `lib/db/adapter.ts` | 348 | Fully reviewed |
| `lib/db/connection.ts` | 131 | Fully reviewed |
| `lib/db/connection.postgres.ts` | 255 | Fully reviewed |
| `lib/db/config.ts` | 292 | Fully reviewed |
| `lib/db/queries/problem-queries.ts` | 1,206 | Fully reviewed |
| `lib/db/queries/change-queries.ts` | 1,045 | Fully reviewed |
| `lib/db/queries/cmdb-queries.ts` | 1,190 | Fully reviewed |
| `lib/db/queries/catalog-queries.ts` | 1,286 | Fully reviewed |
| `lib/db/queries/cab-queries.ts` | 915 | Fully reviewed |
| `lib/db/init.ts` | 325 | Fully reviewed |
| `lib/db/seed.postgres.sql` | 203 | Fully reviewed |
| `lib/types/database.ts` | 2,169 | Fully reviewed |
| `lib/types/problem.ts` | 415 | Fully reviewed |

**Total lines reviewed:** ~13,853

---

## CRITICAL Issues (18)

### C-01: Transaction isolation broken in cmdb-queries.ts
**File:** `lib/db/queries/cmdb-queries.ts`
**Impact:** Data corruption / race conditions under PostgreSQL
**Description:** Four functions use `executeTransaction` but call global `executeRun`/`executeQuery` inside the callback instead of the provided `db` parameter. In PostgreSQL with connection pooling, these calls acquire a DIFFERENT connection from the pool, running OUTSIDE the transaction boundary.

**Affected functions:**
- `createConfigurationItem()` -- 3 global calls inside transaction
- `updateConfigurationItem()` -- 2 global calls inside transaction
- `addCIRelationship()` -- 2 global calls inside transaction
- `removeCIRelationship()` -- 1 global call inside transaction

**Fix:** Replace all `executeRun(...)` / `executeQuery(...)` calls inside transaction callbacks with `db.run(...)` / `db.query(...)`.

---

### C-02: Transaction isolation broken in catalog-queries.ts
**File:** `lib/db/queries/catalog-queries.ts`
**Impact:** Data corruption under PostgreSQL
**Description:** `approveServiceRequest()` and `rejectServiceRequest()` use `executeTransaction` with global `executeRun` inside the callback.

**Fix:** Same as C-01 -- use `db.run()` from the callback parameter.

---

### C-03: Problem statistics uses wrong status keys
**File:** `lib/db/queries/problem-queries.ts` (approx. line 900+)
**Impact:** Statistics return zeroes for all status counts
**Description:** `getProblemStatistics()` has a `statusMap` that maps DB column values to result keys. The keys used are `'new'`, `'investigation'`, `'root_cause_identified'` but the DB CHECK constraint and TypeScript `ProblemStatus` type define `'open'`, `'identified'`, `'root_cause_analysis'`. The `by_status` object is initialized with the wrong keys.

**Schema CHECK:** `status IN ('open','identified','root_cause_analysis','known_error','resolved','closed')`
**Code uses:** `'new'`, `'investigation'`, `'root_cause_identified'` (non-existent values)

**Fix:** Align the statusMap to match schema: `{open: 0, identified: 0, root_cause_analysis: 0, known_error: 0, resolved: 0, closed: 0}`.

---

### C-04: SQLite-specific date functions in problem-queries.ts
**File:** `lib/db/queries/problem-queries.ts`
**Impact:** PostgreSQL queries will throw SQL errors
**Description:** Multiple functions use SQLite-only date functions:
- `getProblemStatistics()`: `date('now', 'start of month')`, `date('now', '-7 days')`
- `julianday()` used for time calculations

**Fix:** Use adapter-aware date functions or conditional SQL. PostgreSQL equivalents:
- `date('now', 'start of month')` -> `date_trunc('month', CURRENT_DATE)`
- `date('now', '-7 days')` -> `CURRENT_DATE - INTERVAL '7 days'`
- `julianday(a) - julianday(b)` -> `EXTRACT(EPOCH FROM (a - b)) / 86400`

---

### C-05: SQLite-specific date functions in change-queries.ts
**File:** `lib/db/queries/change-queries.ts`
**Impact:** PostgreSQL queries will throw SQL errors
**Description:** `getChangeStatistics()` uses `julianday()` for calculating average implementation duration.

**Fix:** Same approach as C-04.

---

### C-06: SQLite-specific date functions in cmdb-queries.ts
**File:** `lib/db/queries/cmdb-queries.ts`
**Impact:** PostgreSQL queries will throw SQL errors
**Description:** `getCMDBStatistics()` uses:
- `DATE('now')` -- SQLite-specific
- `DATE('now', '+90 days')` -- SQLite-specific
- `DATE('now', '+180 days')` -- SQLite-specific

**Fix:** Use `CURRENT_DATE`, `CURRENT_DATE + INTERVAL '90 days'`, `CURRENT_DATE + INTERVAL '180 days'` for PostgreSQL.

---

### C-07: SQLite-specific date functions in catalog-queries.ts
**File:** `lib/db/queries/catalog-queries.ts`
**Impact:** PostgreSQL queries will throw SQL errors
**Description:** `getCatalogStatistics()` uses `JULIANDAY()` for average fulfillment time calculation.

**Fix:** Same approach as C-04.

---

### C-08: CAB meeting column name mismatch -- updateCABMeeting
**File:** `lib/db/queries/cab-queries.ts`
**Impact:** SQL UPDATE silently fails or errors on PostgreSQL
**Description:** `updateCABMeeting()` references columns `actual_start` and `actual_end` but the PostgreSQL schema (`cab_meetings`) defines them as `actual_start_time` and `actual_end_time`.

**SQLite schema:** `actual_start`, `actual_end`
**PostgreSQL schema (line 1595-1596):** `actual_start_time`, `actual_end_time`

**Fix:** Align column names between schemas, or use adapter-aware column mapping.

---

### C-09: CAB meeting column name mismatch -- startCABMeeting / endCABMeeting
**File:** `lib/db/queries/cab-queries.ts`
**Impact:** SQL UPDATE will fail on PostgreSQL
**Description:** `startCABMeeting()` sets `actual_start` and `endCABMeeting()` sets `actual_end`, but PostgreSQL schema has `actual_start_time` and `actual_end_time`.

**Fix:** Same as C-08.

---

### C-10: createCABMeeting missing required columns
**File:** `lib/db/queries/cab-queries.ts`
**Impact:** INSERT will fail on PostgreSQL (NOT NULL violations)
**Description:** PostgreSQL `cab_meetings` table has `title TEXT NOT NULL` and `scheduled_date TEXT NOT NULL` columns, but `createCABMeeting()` does not include these in the INSERT statement.

**Fix:** Add `title` and `scheduled_date` to the INSERT query and the function's input parameters.

---

### C-11: Placeholder conversion breaks on string literals
**File:** `lib/db/adapter.ts` (line ~230)
**Impact:** SQL injection or query failure
**Description:** The PostgreSQL adapter converts `?` placeholders to `$1, $2, ...` using a simple regex: `sql.replace(/\?/g, ...)`. This will incorrectly convert `?` characters inside string literals (e.g., `WHERE title LIKE '%?%'`), breaking the query or producing unexpected behavior.

**Fix:** Use a proper SQL parser or at minimum skip `?` inside quoted strings. Alternative: use named parameters.

---

### C-12: PostgreSQL SSL rejectUnauthorized: false in production
**File:** `lib/db/connection.postgres.ts`
**Impact:** Man-in-the-middle vulnerability in production
**Description:** SSL configuration sets `rejectUnauthorized: false`, disabling certificate verification. This allows attackers to intercept database traffic using self-signed certificates.

**Fix:** Set `rejectUnauthorized: true` in production. Use the `DATABASE_CA_CERT` env var to provide the CA certificate, or trust the system CA store.

---

### C-13: problems.impact column type mismatch between SQLite and PostgreSQL
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** Query behavior differs between databases
**Description:**
- SQLite schema: `impact TEXT CHECK(impact IN ('low','medium','high','critical'))` -- stored as an enum-like TEXT
- PostgreSQL schema (line 1070): `impact TEXT` -- no CHECK constraint, free-form text
- TypeScript type: `ProblemImpact = 'low' | 'medium' | 'high' | 'critical'`

The PostgreSQL schema is missing the CHECK constraint, allowing invalid values.

**Fix:** Add `CHECK(impact IN ('low','medium','high','critical'))` to PostgreSQL `problems.impact` column.

---

### C-14: change_requests.status CHECK constraint mismatch between schemas
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** TypeScript type and SQLite schema reject values that PostgreSQL accepts
**Description:**
- SQLite CHECK: `'draft','submitted','under_review','scheduled','in_progress','completed','failed','cancelled','rolled_back'` (9 values)
- PostgreSQL CHECK: adds `'approved','rejected','pending_assessment','pending_cab'` (13 values)
- TypeScript `ChangeRequestStatus` enum: matches SQLite (9 values)

Code that uses the extra PostgreSQL statuses will fail validation on SQLite, and TypeScript won't catch invalid values.

**Fix:** Align both schemas and TypeScript enum to the same set of valid statuses.

---

### C-15: getProblemIncidents queries non-existent column
**File:** `lib/db/queries/problem-queries.ts`
**Impact:** Query will fail at runtime
**Description:** `getProblemIncidents()` selects `t.ticket_number` but neither the SQLite nor PostgreSQL `tickets` table has a `ticket_number` column. The tickets table only has `id` and `title`.

**Fix:** Either add a `ticket_number` column to the tickets table or remove this field from the SELECT query.

---

### C-16: N+1 query pattern in all list functions
**File:** All query modules (`problem-queries.ts`, `change-queries.ts`, `cmdb-queries.ts`, `catalog-queries.ts`, `cab-queries.ts`)
**Impact:** O(N) database queries per list request; performance degrades linearly with result size
**Description:** Every `list*()` function follows this pattern:
1. Query for paginated list of IDs
2. For each item, call `getById()` which runs 3-7 additional queries for relations

Example: listing 20 problems triggers ~100+ queries (1 list + 20 * ~5 relation queries).

**Affected functions:**
- `getProblems()` -> calls `getProblemById()` per item
- `listChangeRequests()` -> calls `getChangeRequestById()` per item
- `listConfigurationItems()` -> calls `getConfigurationItemById()` per item
- `listServiceCatalogItems()` -> separate queries per item for category/team
- `listCABMeetings()` -> calls `getCABMeetingById()` per item

**Fix:** Use JOINs in the list query itself to fetch relations in a single query. For complex relations, use batch loading (IN clause) instead of per-item queries.

---

### C-17: PostgreSQL schema missing ~40% of SQLite tables
**File:** `lib/db/schema.postgres.sql` (2,076 lines) vs `lib/db/schema.sql` (3,397 lines)
**Impact:** Application features will fail when running on PostgreSQL
**Description:** The PostgreSQL schema is significantly smaller than SQLite. Key differences:

**Tables present in SQLite but missing or significantly simplified in PostgreSQL:**
- `gamification_points`, `gamification_badges`, `gamification_leaderboard` -- completely missing
- `email_templates`, `email_queue` -- missing (SQLite has full implementation)
- `push_subscriptions` -- missing
- `macros` -- missing
- `ticket_custom_fields`, `ticket_custom_field_values` -- missing
- `notification_preferences`, `notification_filters` -- missing
- `approval_chains`, `approval_chain_steps` -- missing
- `api_keys` -- missing
- Several trigger-based features (SLA auto-tracking, updated_at triggers) -- missing

**Tables present but with different column sets:**
- `sla_policies` -- SQLite has `organization_id`, PostgreSQL does not
- `ticket_templates` -- SQLite has `organization_id`, PostgreSQL does not
- `satisfaction_surveys` -- SQLite has `organization_id`, PostgreSQL does not
- `cab_meetings` -- different column names (`actual_start` vs `actual_start_time`)

**Fix:** Systematically compare every table and bring PostgreSQL schema to full parity.

---

### C-18: SLA trigger uses SQLite-specific DATETIME()
**File:** `lib/db/schema.sql` (SLA tracking trigger)
**Impact:** SLA auto-tracking won't work on PostgreSQL
**Description:** The SLA tracking trigger (`trg_sla_tracking_insert`) uses `DATETIME(NEW.created_at, '+' || sp.response_time_minutes || ' minutes')` which is SQLite-specific syntax.

**Fix:** PostgreSQL equivalent: `NEW.created_at + (sp.response_time_minutes || ' minutes')::interval`. Triggers must be rewritten in PL/pgSQL for PostgreSQL.

---

## HIGH Issues (24)

### H-01: sla_policies table missing organization_id in PostgreSQL
**File:** `lib/db/schema.postgres.sql` (line 596-611)
**Impact:** No tenant isolation for SLA policies in PostgreSQL
**Description:** The `sla_policies` table in PostgreSQL has no `organization_id` column, while SQLite does. Multi-tenant queries filtering by `organization_id` will fail.

### H-02: ticket_templates table missing organization_id in PostgreSQL
**File:** `lib/db/schema.postgres.sql` (line 701-717)
**Impact:** No tenant isolation for ticket templates

### H-03: satisfaction_surveys table missing organization_id in both schemas
**File:** `lib/db/schema.sql`, `lib/db/schema.postgres.sql`
**Impact:** No tenant isolation for survey data
**Description:** Both schemas define `satisfaction_surveys` without `organization_id`. The TypeScript `SatisfactionSurvey` interface in `database.ts` includes `organization_id`, creating a mismatch.

### H-04: knowledge_articles table missing organization_id in SQLite schema
**File:** `lib/db/schema.sql`
**Impact:** No tenant isolation for knowledge articles
**Description:** The `knowledge_articles` table in SQLite schema lacks `organization_id`, while the TypeScript `KnowledgeArticle` type in `database.ts` (line 351) includes it.

### H-05: RootCauseCategory TypeScript type missing fields
**File:** `lib/types/problem.ts` (line 196-201)
**Impact:** Type-unsafe code when accessing DB fields
**Description:** The `RootCauseCategory` interface is missing `parent_id` and `is_active` fields that exist in both SQLite and PostgreSQL schemas.

**Schema:** `parent_id BIGINT`, `is_active BOOLEAN DEFAULT TRUE`
**TypeScript:** Only has `id`, `name`, `description`, `organization_id`

### H-06: ProblemActivity.is_internal typed as number
**File:** `lib/types/problem.ts` (line 180)
**Impact:** Boolean handling breaks on PostgreSQL
**Description:** `is_internal: number` works for SQLite (which stores booleans as 0/1) but PostgreSQL returns native `boolean`. Code doing `if (activity.is_internal === 1)` will fail on PostgreSQL.

**Fix:** Use `is_internal: boolean | number` or handle in the adapter layer.

---

### H-07: CABMeeting TypeScript type vs PostgreSQL schema mismatch
**File:** `lib/types/database.ts` (line 1903-1923) vs `lib/db/schema.postgres.sql` (line 1581-1608)
**Impact:** Runtime field access errors
**Description:** Multiple mismatches:
- TS type has `actual_start`, `actual_end` -- PG schema has `actual_start_time`, `actual_end_time`
- TS type missing PG columns: `title`, `description`, `scheduled_date`, `scheduled_time`, `duration_minutes`, `location`, `meeting_url`, `notes`, `organizer_id`, `organization_id`, `tenant_id`
- TS type has `meeting_type` values `'regular' | 'emergency' | 'virtual'` -- PG adds `'ad_hoc'`

### H-08: PostgreSQL adapter transaction passes `this` instead of scoped adapter
**File:** `lib/db/adapter.ts`
**Impact:** Transaction isolation not guaranteed
**Description:** The PostgreSQL adapter's `transaction()` method creates a `txDb` object for the client but passes `this` (the adapter itself) to the callback. This means any database operations inside the callback use the main pool, not the transaction client.

### H-09: SLAPolicy TypeScript type vs schema mismatch
**File:** `lib/types/database.ts` (line 194-207) vs schemas
**Impact:** Incorrect data access
**Description:** TypeScript `SLAPolicy` has `response_time_hours` and `resolution_time_hours`, but both schemas use `response_time_minutes` and `resolution_time_minutes`. The unit mismatch means the type promises hours but the database stores minutes.

### H-10: SLATracking TypeScript type vs schema mismatch
**File:** `lib/types/database.ts` (line 209-222) vs schemas
**Impact:** Field access errors
**Description:** TypeScript has `policy_id` but schema has `sla_policy_id`. TypeScript has `response_breached`/`resolution_breached` but schema has `response_met`/`resolution_met` (inverted semantics). TypeScript has `first_response_at`/`resolved_at` but schema lacks these columns.

### H-11: Ticket TypeScript type has columns not in schema
**File:** `lib/types/database.ts` (line 118-138) vs schemas
**Impact:** Accessing non-existent columns returns undefined
**Description:** TypeScript `Ticket` includes `sla_deadline`, `sla_status`, `sla_first_response_at`, `sla_resolution_at`, `escalation_level`, `escalated_at` -- none of these exist in either schema.

### H-12: AuditLog TypeScript type field name mismatches
**File:** `lib/types/database.ts` (line 293-305) vs schemas
**Impact:** Queries referencing wrong column names
**Description:** TypeScript has `resource_type`/`resource_id` but schema has `entity_type`/`entity_id`. TypeScript has `action` but schema column is also `action` (matches). Missing `tenant_id` from type.

### H-13: User TypeScript type missing tenant_id
**File:** `lib/types/database.ts` (line 61-86)
**Impact:** Multi-tenant scoping breaks
**Description:** The `User` interface has `organization_id` but is missing `tenant_id` which exists in the schema.

### H-14: Config cache_size inconsistency
**File:** `lib/db/config.ts` vs `lib/db/connection.ts`
**Impact:** Sub-optimal SQLite performance
**Description:** `config.ts` sets `cache_size: 1000` in its pragmas object, but `connection.ts` actually applies `PRAGMA cache_size = -64000` (64MB). The config value is misleading and ignored.

### H-15: ensureColumn uses unparameterized table names
**File:** `lib/db/init.ts` (line 34)
**Impact:** SQL injection risk (low likelihood but poor practice)
**Description:** `db.prepare(\`PRAGMA table_info(${table})\`)` interpolates the table name directly. While `ensureColumn` is only called with hardcoded table names, this is a bad pattern.

### H-16: init.ts only works with SQLite
**File:** `lib/db/init.ts`
**Impact:** PostgreSQL initialization impossible via init.ts
**Description:** `init.ts` imports `db` directly from `./connection` (SQLite) and uses SQLite-specific APIs (`db.exec()`, `db.prepare()`, `sqlite_master`). It cannot initialize PostgreSQL.

**Fix:** The PostgreSQL path should use `seed.postgres.sql` via the adapter, or create a parallel `init.postgres.ts`.

### H-17: Notification TypeScript type missing fields from schema
**File:** `lib/types/database.ts` (line 235-246) vs schemas
**Impact:** Cannot access organization/tenant scoping
**Description:** `Notification` interface is missing `organization_id`, `tenant_id`, `data` (JSONB), and `updated_at` fields that exist in the PostgreSQL schema.

### H-18: duplicate NotificationWithDetails interface
**File:** `lib/types/database.ts` (line 248, 431)
**Impact:** TypeScript compile warning, confusing API
**Description:** `NotificationWithDetails` is defined twice with different shapes. The second definition (line 431) shadows the first.

### H-19: duplicate TemplateWithDetails interface
**File:** `lib/types/database.ts` (line 275, 436)
**Impact:** TypeScript compile warning
**Description:** `TemplateWithDetails` defined twice with incompatible shapes.

### H-20: PostgreSQL notification_events table defined twice
**File:** `lib/db/schema.postgres.sql` (line 950 and line 1738)
**Impact:** Potential CREATE TABLE conflict depending on IF NOT EXISTS behavior
**Description:** The `notification_events` table appears twice in the PostgreSQL schema, with different column definitions. The second definition (line 1738) has additional columns (`entity_type`, `entity_id`) not in the first.

### H-21: change_request_approvals schema differences
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** Queries may reference wrong columns
**Description:** PostgreSQL version adds columns not in SQLite: `approver_id`, `approval_level`, `approver_type`, `status`, `decided_at`. The SQLite version only has `change_request_id`, `cab_member_id`, `vote`, `voted_at`, `comments`, `conditions`.

### H-22: service_catalog_items schema differences
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** Queries for PostgreSQL-only columns fail on SQLite and vice versa
**Description:** PostgreSQL version has simplified column set compared to SQLite. Missing from PostgreSQL: `cost_type`, `base_cost`, `cost_currency`, `is_public`, `is_featured`, `available_from`, `available_until`, `keywords`, `updated_by`. PostgreSQL adds `is_published`, `approval_levels`, `estimated_time_minutes`, `cost` (VARCHAR instead of NUMERIC).

### H-23: cab_meetings.meeting_type CHECK constraint mismatch
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** Data inserted via one DB may be invalid for the other
**Description:**
- SQLite: `CHECK(meeting_type IN ('regular','emergency','virtual'))`
- PostgreSQL: `CHECK(meeting_type IN ('regular','emergency','virtual','ad_hoc'))`
- TypeScript: `'regular' | 'emergency' | 'virtual'` (missing `'ad_hoc'`)

### H-24: Empty IN clause vulnerability in query modules
**File:** All query modules
**Impact:** SQL syntax error at runtime
**Description:** When building dynamic `WHERE x IN (...)` clauses from arrays, no check is done for empty arrays. An empty array produces invalid SQL: `WHERE x IN ()`.

**Fix:** Always guard with `.length > 0` before constructing IN clauses.

---

## MEDIUM Issues (19)

### M-01: connection.ts exports multiple aliases for same function
**File:** `lib/db/connection.ts`
**Impact:** Confusing API, maintenance burden
**Description:** Exports `getDb`, `getDB`, `getConnection`, `getDatabase`, `db`, `default` -- all returning the same SQLite connection. This creates ambiguity.

### M-02: SQLDialectConverter class unused in queries
**File:** `lib/db/adapter.ts`
**Impact:** Dead code, false sense of dialect conversion
**Description:** `SQLDialectConverter` class with `toPostgreSQL()` and `toSQLite()` static methods is defined but never called from any query module.

### M-03: api_usage_tracking uses SQLite-specific defaults
**File:** `lib/db/schema.sql`
**Impact:** Default values won't work on PostgreSQL
**Description:** Uses `DATE('now')` and `strftime('%H', 'now')` for default column values. These are SQLite-specific.

### M-04: Forward reference in SQLite schema
**File:** `lib/db/schema.sql`
**Impact:** Schema may fail on strict FK enforcement
**Description:** `login_attempts` table references `organizations(id)` via FK, but `organizations` table is defined much later in the file. SQLite defers FK checks by default, but this is fragile.

### M-05: Missing indexes on PostgreSQL ITIL tables
**File:** `lib/db/schema.postgres.sql`
**Impact:** Slow queries at scale
**Description:** Several ITIL tables in PostgreSQL lack indexes that exist in SQLite:
- `root_cause_categories` -- no index on `organization_id`
- `problem_attachments` -- no index on `problem_id`
- `change_types` -- no index on `organization_id`
- `cab_configurations` -- no index on `organization_id`

### M-06: Missing updated_at triggers in PostgreSQL
**File:** `lib/db/schema.postgres.sql`
**Impact:** `updated_at` columns won't auto-update
**Description:** SQLite schema has 30+ triggers for auto-updating `updated_at` timestamps. PostgreSQL schema has zero triggers. All `updated_at` columns will remain at their initial value unless explicitly updated in queries.

**Fix:** Create a generic `update_updated_at()` function and attach triggers to all tables with `updated_at`.

### M-07: PostgreSQL schema missing SLA tracking trigger
**File:** `lib/db/schema.postgres.sql`
**Impact:** SLA tracking not automated
**Description:** SQLite has `trg_sla_tracking_insert` trigger that automatically creates SLA tracking records when tickets are inserted. No equivalent exists for PostgreSQL.

### M-08: Seed data for SQLite vs PostgreSQL slightly different
**File:** `lib/db/init.ts` vs `lib/db/seed.postgres.sql`
**Impact:** Inconsistent reference data between environments
**Description:** Both files seed the same reference data, but:
- SQLite seed uses auto-increment IDs (no explicit IDs)
- PostgreSQL seed uses explicit IDs with `ON CONFLICT DO NOTHING`
- PostgreSQL seed includes `setval()` calls to align sequences
This is generally correct but means the IDs could diverge if SQLite seed runs in different order.

### M-09: result.lastInsertRowid non-null assertion overuse
**File:** All query modules
**Impact:** Potential runtime crash if undefined
**Description:** `result.lastInsertRowid!` is used throughout. While the adapter documents that `lastInsertRowid` is optional, the non-null assertion suppresses TypeScript safety. On PostgreSQL with `RETURNING id`, the value comes from a different mechanism.

### M-10: PostgreSQL connection pool sizing
**File:** `lib/db/connection.postgres.ts`
**Impact:** Under/over-provisioned connections
**Description:** Pool is configured with `min: 2, max: 20` hardcoded. For a multi-tenant application, this should be configurable via environment variables.

### M-11: Missing VACUUM / maintenance considerations
**File:** `lib/db/connection.ts`
**Impact:** Database bloat over time (SQLite)
**Description:** No automatic VACUUM scheduling. For an active ServiceDesk with frequent updates/deletes, the database file will grow unbounded.

### M-12: PostgreSQL departments table simplified vs SQLite
**File:** `lib/db/schema.postgres.sql` (line 1627-1637)
**Impact:** Missing features in PostgreSQL
**Description:** PostgreSQL `departments` is missing fields present in SQLite: `email`, `phone`, `cost_center`, `business_hours`, `escalation_rules`, `sla_policy_id`.

### M-13: user_departments simplified in PostgreSQL
**File:** `lib/db/schema.postgres.sql` (line 1639-1646)
**Impact:** Role information lost
**Description:** PostgreSQL `user_departments` lacks the `role` column (`'member' | 'lead' | 'manager' | 'admin'`) that exists in SQLite.

### M-14: WhatsApp tables differ significantly between schemas
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** WhatsApp integration features broken on one platform
**Description:** The WhatsApp tables have significantly different structures:
- SQLite `whatsapp_contacts` has more fields (display_name, is_business, is_verified, last_seen, status_message)
- SQLite `whatsapp_messages` references `contact_id`, PostgreSQL references `session_id`
- Column naming differs between schemas

### M-15: govbr_integrations schema differences
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** Gov.br integration features differ per platform
**Description:** SQLite has `cnpj`, `profile_data`, `verification_level`, `last_sync_at`, `is_active`. PostgreSQL has `govbr_id`, `nivel_confianca` instead. Column sets don't align.

### M-16: Missing composite indexes for common query patterns
**File:** `lib/db/schema.postgres.sql`
**Impact:** Suboptimal query performance
**Description:** Common ITIL query patterns lack composite indexes:
- `problems(organization_id, status)` -- missing
- `change_requests(organization_id, status, requested_start_date)` -- missing
- `service_requests(organization_id, status, created_at)` -- missing

### M-17: PostgreSQL AI tables simplified
**File:** `lib/db/schema.postgres.sql` (line 1786-1813)
**Impact:** AI features reduced on PostgreSQL
**Description:** PostgreSQL AI tables (`ai_classifications`, `ai_suggestions`, `ai_training_data`, `vector_embeddings`) are heavily simplified vs SQLite. Missing columns for feedback tracking, model versioning, token counting, etc.

### M-18: tenant_configurations schema differences
**File:** `lib/db/schema.sql` vs `lib/db/schema.postgres.sql`
**Impact:** Config storage approach differs
**Description:** SQLite has `tenant_configurations` with `organization_id`, `feature_flags`, `limits`, `customizations`, `api_settings`, `integrations_config`. PostgreSQL has `tenant_id`, `config_key`, `config_value` (key-value approach). Completely different structure.

### M-19: PostgreSQL workflow tables simplified
**File:** `lib/db/schema.postgres.sql` (line 2011-2061)
**Impact:** Workflow features reduced
**Description:** PostgreSQL `workflow_definitions` uses `steps JSONB` (flat JSON) while SQLite has separate `workflow_steps` table with proper columns. `workflow_step_executions` uses `step_index` (PG) vs `step_id` FK (SQLite).

---

## LOW Issues (12)

### L-01: Inconsistent naming conventions across schemas
**Description:** Column naming is inconsistent:
- `created_by` vs `author_id` vs `uploaded_by` for the same concept
- `is_active` vs `is_published` vs `is_operational` for boolean flags
- `tenant_id` vs `organization_id` used interchangeably in some tables

### L-02: Missing foreign keys on some PostgreSQL tables
**Description:** Some PostgreSQL tables reference other tables without formal FK constraints:
- `batch_configurations.organization_id` -- no FK to `organizations`
- `filter_rules.organization_id` -- no FK to `organizations`
- `analytics_realtime_metrics.organization_id` -- no FK
- `communication_channels.organization_id` -- no FK

### L-03: JSONB vs TEXT inconsistency
**Description:** SQLite stores JSON as TEXT (inherent limitation), PostgreSQL uses JSONB. However, some PostgreSQL tables still use TEXT for JSON fields. TypeScript types consistently use `string` which works for both.

### L-04: Missing COMMENT ON statements in PostgreSQL
**Description:** Only 3 tables have `COMMENT ON TABLE` statements. For a 110+ table schema, documentation should be more comprehensive.

### L-05: config.ts validation not enforced at startup
**Description:** `validateDatabaseConfig()` exists but is not called during application startup. Invalid configurations won't be caught until first query.

### L-06: seed.postgres.sql missing demo users
**Description:** PostgreSQL seed creates reference data (categories, priorities, statuses, roles, permissions) but no demo users. SQLite init creates demo admin/agent/user accounts. Teams will need to manually create users on PostgreSQL.

### L-07: Missing database migration framework
**Description:** No migration system (e.g., `knex migrate`, `prisma migrate`, `drizzle-kit`). Schema changes require manual SQL file editing and re-running init. This is risky for production databases.

### L-08: boolean handling inconsistency
**Description:** SQLite uses INTEGER (0/1) for booleans, PostgreSQL uses native BOOLEAN. TypeScript types sometimes use `boolean`, sometimes `number`. The adapter doesn't normalize this.

### L-09: Missing connection retry logic for PostgreSQL
**File:** `lib/db/connection.postgres.ts`
**Description:** No automatic reconnection or retry logic for transient PostgreSQL connection failures. The pool may exhaust under network instability.

### L-10: config.ts prints sensitive information
**File:** `lib/db/config.ts`
**Description:** `printDatabaseInfo()` logs the `DATABASE_URL` which may contain credentials. Should be masked.

### L-11: PostgreSQL schema uses REAL for monetary values
**File:** `lib/db/schema.postgres.sql`
**Description:** `avg_fulfillment_time REAL` and `satisfaction_rating REAL` use floating-point. For money-related values, NUMERIC should be used to avoid precision issues.

### L-12: Hardcoded organization_id defaults
**File:** Both schemas, init.ts, seed.postgres.sql
**Description:** Default `organization_id = 1` is hardcoded throughout. While correct for single-tenant bootstrap, this should be documented as a constraint.

---

## SQLite vs PostgreSQL Parity Analysis

### Summary Matrix

| Category | SQLite Tables | PostgreSQL Tables | Gap |
|----------|--------------|-------------------|-----|
| Auth & Security | 12 | 12 | Parity |
| Core ServiceDesk | 15 | 15 | Parity (with column diffs) |
| SLA | 3 | 3 | Missing org_id in PG |
| Notifications | 6 | 5 | Simplified in PG |
| Templates/Automations | 3 | 3 | Missing org_id in PG |
| Knowledge Base | 6 | 6 | Parity |
| Analytics | 5 | 5 | Simplified in PG |
| Workflows | 6 | 4 | Simplified in PG |
| Approvals | 3 | 0 | Missing in PG |
| Integrations | 4 | 4 | Simplified in PG |
| AI/ML | 4 | 4 | Simplified in PG |
| Organizations | 5 | 4 | Simplified in PG |
| Communication | 3 | 3 | Different structure |
| WhatsApp | 5 | 3 | Simplified in PG |
| Gov.br/LGPD | 3 | 3 | Different columns |
| ITIL Problem | 5 | 5 | Parity |
| ITIL Change | 5 | 5 | Column diffs |
| ITIL CMDB | 6 | 6 | Parity |
| Service Catalog | 5 | 5 | Column diffs |
| CAB | 3 | 3 | Column name diffs |
| Gamification | 3 | 0 | Missing in PG |
| Email | 2 | 0 | Missing in PG |
| Custom Fields | 2 | 0 | Missing in PG |
| Macros | 1 | 0 | Missing in PG |
| Push/PWA | 1 | 0 | Missing in PG |
| Triggers | 30+ | 0 | All missing in PG |

### Key Parity Gaps

1. **Triggers**: SQLite has 30+ triggers (updated_at, SLA tracking, audit logging, view counts). PostgreSQL has zero. This is the single largest gap.
2. **Gamification system**: 3 tables completely missing from PostgreSQL
3. **Email system**: `email_templates`, `email_queue` missing from PostgreSQL
4. **Custom fields**: `ticket_custom_fields`, `ticket_custom_field_values` missing
5. **Column-level differences**: ~20 tables have different column sets between schemas

---

## Improvement Recommendations

### Priority 1 (Block Production)

1. **Fix transaction isolation** in cmdb-queries.ts and catalog-queries.ts (C-01, C-02)
2. **Replace SQLite-specific SQL** in all 5 query modules (C-04 through C-07)
3. **Fix column name mismatches** in cab-queries.ts (C-08, C-09, C-10)
4. **Fix problem statistics** status key mismatch (C-03)
5. **Fix getProblemIncidents** ticket_number reference (C-15)
6. **Fix placeholder conversion** to handle string literals (C-11)
7. **Fix SSL verification** in production PostgreSQL (C-12)

### Priority 2 (Before GA)

1. **Add PostgreSQL triggers** for updated_at columns (M-06)
2. **Add missing CHECK constraints** to PostgreSQL schema (C-13, C-14)
3. **Bring PostgreSQL schema to parity** -- add missing tables and columns (C-17)
4. **Fix N+1 queries** in list functions with JOINs (C-16)
5. **Align TypeScript types** with actual schema columns (H-05 through H-13)
6. **Add empty array guards** for IN clauses (H-24)
7. **Add database migration framework** (L-07)

### Priority 3 (Ongoing)

1. Add composite indexes for common query patterns (M-16)
2. Normalize boolean handling between SQLite and PostgreSQL (L-08)
3. Add connection retry logic for PostgreSQL (L-09)
4. Make connection pool size configurable (M-10)
5. Add COMMENT ON TABLE/COLUMN for documentation (L-04)
6. Clean up unused SQLDialectConverter (M-02)
7. Clean up connection.ts export aliases (M-01)

---

## Issue Count Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 18 | Will cause data corruption, query failures, or security vulnerabilities |
| HIGH | 24 | Will cause incorrect behavior, data loss, or feature breakage |
| MEDIUM | 19 | Performance issues, maintenance concerns, schema inconsistencies |
| LOW | 12 | Code quality, documentation, minor inconsistencies |
| **Total** | **73** | |

### By Component

| Component | CRITICAL | HIGH | MEDIUM | LOW |
|-----------|----------|------|--------|-----|
| Schema (SQLite) | 1 | 1 | 2 | 2 |
| Schema (PostgreSQL) | 2 | 7 | 9 | 4 |
| Schema Parity | 2 | 4 | 6 | 1 |
| Adapter | 2 | 1 | 1 | 0 |
| Connections | 1 | 1 | 1 | 2 |
| Config | 0 | 1 | 0 | 2 |
| Init/Seed | 0 | 1 | 1 | 1 |
| Query Modules | 8 | 2 | 1 | 0 |
| Types | 2 | 6 | 0 | 0 |
| Cross-cutting | 0 | 0 | 0 | 0 |

---

*Report generated by qa-database specialist on 2026-02-21*
