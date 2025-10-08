# Query Optimization Guide

## Overview

This guide provides comprehensive query optimization strategies for the ServiceDesk database, covering:
- Index optimization
- Query patterns
- N+1 query prevention
- Performance monitoring
- Caching strategies
- Database configuration

## Index Strategy

### 1. Single Column Indexes

#### Foreign Key Indexes
All foreign key columns are indexed to optimize JOIN operations and cascade deletes:

```sql
-- Ticket foreign keys
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_category_id ON tickets(category_id);
CREATE INDEX idx_tickets_priority_id ON tickets(priority_id);
CREATE INDEX idx_tickets_status_id ON tickets(status_id);
```

**Impact**: 10-100x improvement on JOIN operations

#### Frequently Queried Columns

```sql
-- Boolean flags for filtering
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_kb_articles_published ON kb_articles(status);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Timestamp columns for sorting and filtering
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

**Impact**: 5-50x improvement on filtered queries

### 2. Composite Indexes

#### Multi-Tenant Queries

```sql
-- Organization + common filters
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status_id);
CREATE INDEX idx_tickets_org_assigned ON tickets(organization_id, assigned_to);
CREATE INDEX idx_tickets_org_created ON tickets(organization_id, created_at DESC);
```

**Usage**:
```sql
-- Optimized by idx_tickets_org_status
SELECT * FROM tickets
WHERE organization_id = 1 AND status_id = 2;

-- Optimized by idx_tickets_org_assigned
SELECT * FROM tickets
WHERE organization_id = 1 AND assigned_to = 5;
```

**Impact**: 100-1000x improvement on multi-tenant queries

#### Range + Equality Queries

```sql
-- SLA tracking queries
CREATE INDEX idx_sla_tracking_due_dates ON sla_tracking(response_due_at, resolution_due_at);

-- Analytics queries
CREATE INDEX idx_analytics_date_org ON analytics_daily_metrics(date, organization_id);
```

**Impact**: Enables efficient date range queries

### 3. Unique Indexes

```sql
-- Enforce uniqueness AND optimize lookups
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);
```

**Dual Purpose**: Data integrity + query optimization

### 4. Partial Indexes (PostgreSQL)

```sql
-- Index only active records
CREATE INDEX idx_users_active_email ON users(email) WHERE is_active = TRUE;

-- Index only published KB articles
CREATE INDEX idx_kb_published_search ON kb_articles(title, search_keywords)
WHERE status = 'published';

-- Index only breached SLAs
CREATE INDEX idx_sla_breached ON sla_tracking(ticket_id)
WHERE response_met = FALSE OR resolution_met = FALSE;
```

**Impact**: Smaller indexes, faster queries on filtered data

### 5. Expression Indexes (PostgreSQL)

```sql
-- Case-insensitive search
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Date-based grouping
CREATE INDEX idx_tickets_date ON tickets(DATE(created_at));

-- JSON field indexing
CREATE INDEX idx_users_metadata_role ON users((metadata->>'role'));
```

## Query Patterns

### 1. Efficient Ticket Queries

#### ❌ Bad: N+1 Query Pattern

```typescript
// BAD: Multiple queries
const tickets = db.prepare('SELECT * FROM tickets').all();
for (const ticket of tickets) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ticket.user_id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(ticket.category_id);
  // ... more queries
}
// Result: 1 + (N * 4) queries for N tickets
```

#### ✅ Good: Single Query with JOINs

```typescript
// GOOD: Single query
const tickets = db.prepare(`
  SELECT
    t.*,
    u.name as user_name,
    u.email as user_email,
    c.name as category_name,
    c.color as category_color,
    p.name as priority_name,
    p.color as priority_color,
    s.name as status_name,
    s.color as status_color
  FROM tickets t
  LEFT JOIN users u ON t.user_id = u.id
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN priorities p ON t.priority_id = p.id
  LEFT JOIN statuses s ON t.status_id = s.id
  WHERE t.organization_id = ?
  ORDER BY t.created_at DESC
`).all(orgId);
// Result: 1 query total
```

**Impact**: 100-500x improvement for 100 tickets

### 2. Efficient SLA Queries

#### ❌ Bad: Subquery in SELECT

```sql
-- BAD: Correlated subquery executed for each row
SELECT
  t.*,
  (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comment_count,
  (SELECT AVG(rating) FROM satisfaction_surveys WHERE ticket_id = t.id) as avg_rating
FROM tickets t;
```

#### ✅ Good: LEFT JOIN with Aggregation

```sql
-- GOOD: Single pass with aggregation
SELECT
  t.*,
  COALESCE(c.comment_count, 0) as comment_count,
  s.avg_rating
FROM tickets t
LEFT JOIN (
  SELECT ticket_id, COUNT(*) as comment_count
  FROM comments
  GROUP BY ticket_id
) c ON t.id = c.ticket_id
LEFT JOIN (
  SELECT ticket_id, AVG(rating) as avg_rating
  FROM satisfaction_surveys
  GROUP BY ticket_id
) s ON t.id = s.ticket_id;
```

**Impact**: 10-50x improvement

### 3. Efficient Pagination

#### ❌ Bad: OFFSET Pagination

```sql
-- BAD: Scans all previous rows
SELECT * FROM tickets
ORDER BY created_at DESC
LIMIT 20 OFFSET 1000;
-- Scans 1020 rows to return 20
```

#### ✅ Good: Cursor-Based Pagination

```sql
-- GOOD: Direct seek using index
SELECT * FROM tickets
WHERE created_at < ?  -- Last timestamp from previous page
ORDER BY created_at DESC
LIMIT 20;
-- Scans only 20 rows
```

**Impact**: Constant time vs linear time for deep pages

### 4. Efficient Counting

#### ❌ Bad: Full Table Scan

```sql
-- BAD: Counts all rows
SELECT COUNT(*) FROM tickets;
```

#### ✅ Good: Approximate Count (PostgreSQL)

```sql
-- GOOD: Fast approximate count
SELECT reltuples::bigint AS estimate
FROM pg_class
WHERE relname = 'tickets';
```

#### ✅ Good: Cached Counts

```typescript
// Cache count results
const cachedCount = cache.get('tickets:count:org:1');
if (cachedCount) return cachedCount;

const count = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE organization_id = ?').get(orgId);
cache.set('tickets:count:org:1', count, 300); // 5 min TTL
return count;
```

**Impact**: 1000x+ improvement for large tables

### 5. Efficient Bulk Operations

#### ❌ Bad: Individual Inserts

```typescript
// BAD: Multiple transactions
for (const ticket of tickets) {
  db.prepare('INSERT INTO tickets (...) VALUES (...)').run(ticket);
}
// Result: N transactions
```

#### ✅ Good: Batch Insert

```typescript
// GOOD: Single transaction
const insert = db.prepare('INSERT INTO tickets (...) VALUES (...)');
const insertMany = db.transaction((tickets) => {
  for (const ticket of tickets) {
    insert.run(ticket);
  }
});
insertMany(tickets);
// Result: 1 transaction
```

**Impact**: 10-100x improvement for bulk operations

## Query Optimization Techniques

### 1. Use EXPLAIN QUERY PLAN

```sql
-- SQLite
EXPLAIN QUERY PLAN
SELECT * FROM tickets WHERE organization_id = 1 AND status_id = 2;

-- Expected output:
SEARCH TABLE tickets USING INDEX idx_tickets_org_status (organization_id=? AND status_id=?)
```

### 2. Avoid SELECT *

#### ❌ Bad

```sql
-- BAD: Fetches all columns including large TEXT fields
SELECT * FROM kb_articles;
```

#### ✅ Good

```sql
-- GOOD: Select only needed columns
SELECT id, title, summary, view_count
FROM kb_articles
WHERE status = 'published';
```

**Impact**: Reduces I/O and network transfer

### 3. Use Covering Indexes

```sql
-- Create index that includes all queried columns
CREATE INDEX idx_tickets_coverage ON tickets(organization_id, status_id, created_at, title);

-- Query can be satisfied entirely from index
SELECT created_at, title
FROM tickets
WHERE organization_id = 1 AND status_id = 2;
```

**Impact**: Index-only scans are 10x faster

### 4. Denormalize When Appropriate

```sql
-- Add comment_count to tickets table (updated by trigger)
ALTER TABLE tickets ADD COLUMN comment_count INTEGER DEFAULT 0;

CREATE TRIGGER update_ticket_comment_count
AFTER INSERT ON comments
BEGIN
  UPDATE tickets SET comment_count = comment_count + 1 WHERE id = NEW.ticket_id;
END;

-- Now this is instant:
SELECT id, title, comment_count FROM tickets;

-- Instead of slow JOIN:
SELECT t.id, t.title, COUNT(c.id)
FROM tickets t
LEFT JOIN comments c ON t.id = c.ticket_id
GROUP BY t.id;
```

**Impact**: Trades write performance for read performance

### 5. Use Materialized Views (PostgreSQL)

```sql
-- Create materialized view for expensive analytics
CREATE MATERIALIZED VIEW ticket_stats AS
SELECT
  organization_id,
  DATE(created_at) as date,
  COUNT(*) as tickets_created,
  COUNT(CASE WHEN status_id IN (SELECT id FROM statuses WHERE is_final = TRUE) THEN 1 END) as tickets_resolved,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM tickets
GROUP BY organization_id, DATE(created_at);

-- Create index on materialized view
CREATE INDEX idx_ticket_stats_date ON ticket_stats(organization_id, date);

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY ticket_stats;
```

**Impact**: 100-1000x improvement for complex analytics

## Database Configuration

### SQLite Optimization

```javascript
// lib/db/connection.ts
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Critical optimizations
db.pragma('journal_mode = WAL');        // Write-Ahead Logging (concurrent reads/writes)
db.pragma('synchronous = NORMAL');      // Balanced durability/performance
db.pragma('cache_size = -64000');       // 64MB cache (negative = KB)
db.pragma('temp_store = MEMORY');       // Temp tables in memory
db.pragma('foreign_keys = ON');         // Enforce foreign keys
db.pragma('busy_timeout = 5000');       // Wait 5s on lock
db.pragma('analysis_limit = 1000');     // Optimize ANALYZE
db.pragma('mmap_size = 268435456');     // 256MB memory-mapped I/O

// Query planner optimization
db.pragma('optimize');                  // Run at shutdown
```

**Expected Performance**:
- Simple queries: < 1ms
- Complex joins: < 10ms
- Concurrent writes: 1000+ TPS

### PostgreSQL Optimization

```sql
-- postgresql.conf optimizations

-- Memory
shared_buffers = 4GB                    -- 25% of RAM
effective_cache_size = 12GB             -- 75% of RAM
work_mem = 64MB                         -- Per operation
maintenance_work_mem = 1GB              -- For VACUUM, CREATE INDEX

-- Checkpoint
checkpoint_completion_target = 0.9
wal_buffers = 16MB
checkpoint_timeout = 15min

-- Query Planner
random_page_cost = 1.1                  -- For SSD
effective_io_concurrency = 200          -- For SSD
default_statistics_target = 100         -- More accurate query plans

-- Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 1min
```

**Connection Pooling**:
```typescript
const pool = new Pool({
  max: 20,                              // Max connections
  idleTimeoutMillis: 30000,             // Close idle connections
  connectionTimeoutMillis: 2000,        // Connection timeout
  statement_timeout: 30000,             // Query timeout
});
```

## Caching Strategy

### 1. Application-Level Caching

```typescript
// lib/cache/strategy.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 300,                          // 5 min default TTL
  checkperiod: 60,                      // Check for expired keys every 60s
  useClones: false                      // Don't clone cached objects
});

// Cache frequently accessed data
export function getCachedTicket(id: number, orgId: number) {
  const key = `ticket:${orgId}:${id}`;
  let ticket = cache.get(key);

  if (!ticket) {
    ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND organization_id = ?').get(id, orgId);
    cache.set(key, ticket, 300);
  }

  return ticket;
}

// Invalidate on update
export function updateTicket(id: number, orgId: number, data: any) {
  db.prepare('UPDATE tickets SET ... WHERE id = ?').run(id);
  cache.del(`ticket:${orgId}:${id}`);
}
```

### 2. Query Result Caching

```typescript
// Cache expensive analytics queries
export function getDashboardMetrics(orgId: number) {
  const key = `dashboard:${orgId}`;
  let metrics = cache.get(key);

  if (!metrics) {
    metrics = {
      totalTickets: db.prepare('SELECT COUNT(*) as count FROM tickets WHERE organization_id = ?').get(orgId),
      openTickets: db.prepare('SELECT COUNT(*) as count FROM tickets WHERE organization_id = ? AND status_id NOT IN (SELECT id FROM statuses WHERE is_final = TRUE)').get(orgId),
      // ... more expensive queries
    };
    cache.set(key, metrics, 60); // 1 min TTL
  }

  return metrics;
}
```

### 3. Redis Caching (Production)

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
});

export async function getCachedData(key: string, fetchFn: () => Promise<any>, ttl: number = 300) {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const data = await fetchFn();

  // Store in cache
  await redis.setex(key, ttl, JSON.stringify(data));

  return data;
}

// Usage
const tickets = await getCachedData(
  `tickets:org:${orgId}`,
  () => ticketQueries.getAll(orgId),
  300
);
```

## Performance Monitoring

### 1. Query Performance Logging

```typescript
// lib/db/connection.ts
const db = new Database(dbPath, {
  verbose: (sql, params) => {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      if (duration > 100) {
        console.warn(`Slow query (${duration}ms):`, sql, params);
      }
    };
  }
});
```

### 2. Query Statistics

```sql
-- PostgreSQL: Enable pg_stat_statements
CREATE EXTENSION pg_stat_statements;

-- View slow queries
SELECT
  calls,
  total_exec_time,
  mean_exec_time,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries averaging > 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 3. Index Usage Statistics

```sql
-- PostgreSQL: Check unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname NOT IN ('pg_catalog', 'information_schema');
```

## Query Optimization Checklist

### For Every Query

- [ ] Uses appropriate indexes (check with EXPLAIN)
- [ ] Selects only needed columns
- [ ] Uses JOINs instead of subqueries where possible
- [ ] Includes organization_id for multi-tenant isolation
- [ ] Has reasonable LIMIT for large result sets
- [ ] Uses parameterized queries (SQL injection prevention)
- [ ] Considers caching for frequently accessed data

### For Slow Queries

- [ ] EXPLAIN QUERY PLAN analyzed
- [ ] Indexes on all WHERE clause columns
- [ ] Indexes on all JOIN columns
- [ ] Composite index for multiple filters
- [ ] No function calls on indexed columns
- [ ] Statistics up to date (ANALYZE)
- [ ] Query rewritten to avoid full table scans

### For Write Operations

- [ ] Uses transactions for multiple operations
- [ ] Batches inserts when possible
- [ ] Invalidates relevant caches
- [ ] Triggers are efficient
- [ ] Foreign key checks won't cascade excessively

## Common Anti-Patterns to Avoid

### 1. Function on Indexed Column

```sql
-- ❌ BAD: Index not used
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- ✅ GOOD: Use expression index or store lowercase
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
-- OR normalize data
UPDATE users SET email = LOWER(email);
```

### 2. OR Instead of IN

```sql
-- ❌ BAD: May not use index efficiently
SELECT * FROM tickets WHERE status_id = 1 OR status_id = 2 OR status_id = 3;

-- ✅ GOOD: Uses index efficiently
SELECT * FROM tickets WHERE status_id IN (1, 2, 3);
```

### 3. Implicit Type Conversion

```sql
-- ❌ BAD: If id is INTEGER, index not used
SELECT * FROM tickets WHERE id = '123';

-- ✅ GOOD: Correct type
SELECT * FROM tickets WHERE id = 123;
```

### 4. Wildcard at Start

```sql
-- ❌ BAD: Full table scan
SELECT * FROM kb_articles WHERE title LIKE '%search%';

-- ✅ GOOD: Can use index
SELECT * FROM kb_articles WHERE title LIKE 'search%';
-- Or use full-text search
SELECT * FROM kb_articles WHERE to_tsvector(title) @@ to_tsquery('search');
```

## Conclusion

Query optimization is an ongoing process. Use this guide to:
1. Design efficient indexes from the start
2. Write queries that use those indexes
3. Monitor query performance
4. Optimize bottlenecks as they appear
5. Cache frequently accessed data

**Remember**: Premature optimization is the root of all evil, but planning for performance from the start saves massive refactoring later.
