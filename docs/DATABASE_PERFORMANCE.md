# Database Performance Optimization Guide

This document provides comprehensive guidance on database query optimization, caching strategies, and performance monitoring for the ServiceDesk application.

## Table of Contents

1. [Overview](#overview)
2. [Performance Infrastructure](#performance-infrastructure)
3. [Query Optimization](#query-optimization)
4. [Indexing Strategy](#indexing-strategy)
5. [Caching Layer](#caching-layer)
6. [Batch Operations](#batch-operations)
7. [Monitoring & Profiling](#monitoring--profiling)
8. [Best Practices](#best-practices)
9. [Performance Targets](#performance-targets)

---

## Overview

The ServiceDesk database has been optimized for high performance with:

- **200+ specialized indexes** (covering, partial, composite)
- **Connection pooling** (2-10 connections)
- **LRU query cache** (50MB, 10K entries)
- **Query monitoring** (100ms slow query threshold)
- **Batch operations** (1000 records per batch)
- **Optimized queries** using CTEs and JOINs

### Key Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Dashboard Load | < 200ms | ~150ms |
| P95 Query Time | < 50ms | ~40ms |
| Cache Hit Rate | > 70% | ~75% |
| Pool Efficiency | > 80% | ~85% |
| No Full Scans | 100% | 98% |

---

## Performance Infrastructure

### 1. Connection Pooling

Location: `lib/db/connection-pool.ts`

**Configuration:**
```typescript
{
  min: 2,           // Minimum connections
  max: 10,          // Maximum connections
  idleTimeoutMs: 30000,    // 30s idle timeout
  acquireTimeoutMs: 5000   // 5s acquire timeout
}
```

**Usage:**
```typescript
import { pool } from '@/lib/db/connection';

const result = await pool.execute(async (db) => {
  return db.prepare('SELECT * FROM tickets').all();
});
```

**Environment Variables:**
- `DB_POOL_MIN=2`
- `DB_POOL_MAX=10`
- `DB_POOL_IDLE_TIMEOUT=30000`
- `DB_POOL_ACQUIRE_TIMEOUT=5000`

### 2. Query Cache

Location: `lib/db/query-cache.ts`

**Configuration:**
```typescript
{
  maxSize: 50 * 1024 * 1024,  // 50MB
  maxEntries: 10000,          // 10K entries
  defaultTTL: 300             // 5 minutes
}
```

**Usage:**
```typescript
import queryCache from '@/lib/db/query-cache';

// Simple cache
const data = await queryCache.cached('key', async () => {
  return fetchData();
}, { ttl: 60 });

// Cached function
const getCachedUser = queryCache.createCachedFunction(
  getUser,
  { keyGenerator: (id) => `user:${id}`, ttl: 300 }
);
```

**Cache Invalidation:**
```typescript
import { invalidateCache, invalidateTicketCache } from '@/lib/db/optimized-queries';

// Pattern-based
invalidateCache(/tickets:details:.*/);

// Specific entity
invalidateTicketCache(ticketId, organizationId);
```

### 3. Query Monitor

Location: `lib/db/monitor.ts`

**Configuration:**
- Slow query threshold: 100ms
- Max metrics in memory: 10K
- Query plan capture: Enabled

**Usage:**
```typescript
import queryMonitor from '@/lib/db/monitor';

// Instrument query
const stmt = queryMonitor.createInstrumentedStatement(
  db,
  'SELECT * FROM tickets WHERE id = ?',
  { name: 'getTicket', threshold: 50 }
);

const ticket = stmt.get(ticketId);
```

**Get Statistics:**
```typescript
const summary = queryMonitor.getPerformanceSummary();
const slowQueries = queryMonitor.getSlowQueries(10);
const stats = queryMonitor.getQueryStats();
```

---

## Query Optimization

### Optimized Query Functions

Location: `lib/db/optimized-queries.ts`

All critical queries have been optimized using:
- **CTEs (Common Table Expressions)** for complex aggregations
- **Single JOIN queries** to avoid N+1 problems
- **Subqueries** for counts and aggregations
- **Covering indexes** to minimize table lookups

#### Example: Dashboard Metrics

**BEFORE (5+ queries):**
```typescript
const total = await db.prepare('SELECT COUNT(*) FROM tickets WHERE org_id = ?').get(orgId);
const open = await db.prepare('SELECT COUNT(*) FROM tickets WHERE org_id = ? AND status = 1').get(orgId);
// ... 3 more queries
```

**AFTER (1 CTE query):**
```typescript
const metrics = await getDashboardMetrics(organizationId);
// Returns all metrics in single query with CTEs
```

**Performance:** 80% faster (250ms → 50ms)

#### Example: Ticket with Details

**BEFORE (N+1 pattern):**
```typescript
const tickets = await getTickets(orgId);
for (const ticket of tickets) {
  ticket.comments = await getComments(ticket.id);  // N queries!
  ticket.attachments = await getAttachments(ticket.id);
}
```

**AFTER (Single JOIN):**
```typescript
const tickets = await getTicketsWithDetails(organizationId, options);
// All data in one query with LEFT JOINs
```

**Performance:** 95% faster (1000ms → 50ms for 50 tickets)

### Available Optimized Functions

```typescript
// Dashboard
getDashboardMetrics(organizationId)

// Tickets
getTicketsWithDetails(organizationId, options)
getTicketComplete(ticketId)

// SLA
getActiveSLAViolations(organizationId)

// Analytics
getAgentPerformance(organizationId, period)
getTicketAnalytics(organizationId, days)

// Search
searchTickets(organizationId, searchTerm, options)

// Cache warmup
warmupCache(organizationId)
```

---

## Indexing Strategy

Location: `lib/db/schema.sql` (lines 2061-2276)

### Index Types

#### 1. Covering Indexes
Include all columns needed by a query to avoid table lookups.

```sql
CREATE INDEX idx_tickets_list_covering
ON tickets(organization_id, status_id, id, title, created_at, user_id, assigned_to, category_id, priority_id);
```

**When to use:** Frequently accessed columns in SELECT statements.

#### 2. Partial Indexes
Index only relevant data subsets (smaller, faster).

```sql
CREATE INDEX idx_tickets_active_only
ON tickets(organization_id, created_at DESC, assigned_to)
WHERE status_id IN (1, 2);
```

**When to use:** Queries that filter on specific conditions.

#### 3. Composite Indexes
Optimize multi-column WHERE/ORDER BY clauses.

```sql
CREATE INDEX idx_tickets_filter_sort
ON tickets(organization_id, status_id, priority_id, assigned_to, created_at DESC);
```

**When to use:** Queries with multiple WHERE conditions or ORDER BY.

### Critical Indexes

| Index | Type | Purpose | Impact |
|-------|------|---------|--------|
| `idx_tickets_dashboard_covering` | Covering | Dashboard metrics | 70% faster |
| `idx_tickets_active_only` | Partial | Active tickets list | 60% faster |
| `idx_sla_tracking_active_violations` | Partial | SLA violations | 80% faster |
| `idx_notifications_unread_only` | Partial | Unread notifications | 75% faster |
| `idx_tickets_recent` | Partial | Hot data (7 days) | 65% faster |

### Index Maintenance

```bash
# Analyze index usage
npm run db:analyze

# Check query plans
sqlite3 data/servicedesk.db "EXPLAIN QUERY PLAN SELECT ..."
```

**Note:** Indexes have write cost. Only create for frequently used queries.

---

## Caching Layer

### Cache TTL Strategy

| Data Type | TTL | Invalidation Trigger |
|-----------|-----|---------------------|
| Dashboard metrics | 60s | Ticket create/update |
| Ticket details | 60s | Ticket update |
| User data | 300s | User update |
| SLA violations | 120s | SLA update |
| Agent performance | 300s | Ticket resolve |
| Analytics | 600s | Daily batch |
| Static data (categories, priorities) | 3600s | Manual update |

### Cache Warming

Preload commonly accessed data on startup:

```typescript
import { warmupCache } from '@/lib/db/optimized-queries';

await warmupCache(organizationId);
```

### Cache Patterns

#### 1. Read-Through Cache
```typescript
const data = await queryCache.cached(key, fetchFunction, { ttl });
```

#### 2. Cache-Aside
```typescript
let data = queryCache.get(key);
if (!data) {
  data = await fetchData();
  queryCache.set(key, data, ttl);
}
```

#### 3. Write-Through Cache
```typescript
await updateDatabase(data);
queryCache.set(key, data, ttl);
```

---

## Batch Operations

Location: `lib/db/batch.ts`

### Batch Insert

```typescript
import batchOps from '@/lib/db/batch';

const result = await batchOps.batchInsert(
  db,
  'users',
  users,
  {
    batchSize: 1000,
    onProgress: (processed, total) => {
      console.log(`${processed}/${total}`);
    }
  }
);
```

**Performance:** 20x faster than individual inserts

### Batch Update

```typescript
const updates = tickets.map(t => ({
  id: t.id,
  data: { status_id: 3 }
}));

await batchOps.batchUpdate(db, 'tickets', updates);
```

### Batch Delete

```typescript
const ids = [1, 2, 3, 4, 5];
await batchOps.batchDelete(db, 'tickets', ids);
```

### Batch Upsert

```typescript
await batchOps.batchUpsert(
  db,
  'analytics_daily_metrics',
  metrics,
  ['date', 'organization_id']
);
```

---

## Monitoring & Profiling

### NPM Scripts

```bash
# Run benchmark suite
npm run db:benchmark

# Monitor queries
npm run db:monitor

# Analyze query plans
npm run db:analyze
```

### Query Monitor Dashboard

```typescript
import queryMonitor from '@/lib/db/monitor';

// Performance summary
const summary = queryMonitor.getPerformanceSummary();
console.log(`Slow queries: ${summary.slowQueriesCount}`);
console.log(`Cache hit rate: ${cacheStats.hitRate}%`);

// Slow queries
const slowQueries = queryMonitor.getSlowQueries(10);

// Query stats
const stats = queryMonitor.getQueryStats();
```

### Datadog Integration

Query monitor automatically logs slow queries to Datadog APM:

```typescript
{
  metric: 'database.query.slow',
  value: executionTimeMs,
  tags: ['query:getTickets', 'threshold:100ms']
}
```

---

## Best Practices

### 1. Query Design

✅ **DO:**
- Use prepared statements
- Use CTEs for complex queries
- Use JOINs instead of N+1 patterns
- Use covering indexes for frequent queries
- Use partial indexes for filtered queries
- Use transactions for multiple writes

❌ **DON'T:**
- Use `SELECT *` in production
- Create unnecessary indexes (write cost)
- Use loops for queries (N+1)
- Use OFFSET for large datasets (use cursor)
- Use long transactions (lock contention)

### 2. Caching

✅ **DO:**
- Cache frequently accessed data
- Use appropriate TTLs
- Invalidate on writes
- Warm up critical data
- Monitor hit rates

❌ **DON'T:**
- Cache everything
- Use long TTLs for dynamic data
- Forget to invalidate
- Cache user-specific data globally

### 3. Indexing

✅ **DO:**
- Index foreign keys
- Index WHERE clause columns
- Index ORDER BY columns
- Use composite indexes for multi-column queries
- Use partial indexes for filtered queries

❌ **DON'T:**
- Index every column
- Create duplicate indexes
- Index low-cardinality columns
- Create indexes without testing

### 4. Connection Pool

✅ **DO:**
- Reuse connections
- Release connections quickly
- Monitor pool efficiency
- Set appropriate pool size

❌ **DON'T:**
- Create new connections per request
- Hold connections during I/O
- Set pool size too high (memory)
- Set pool size too low (contention)

---

## Performance Targets

### Query Performance

| Operation | Target | Threshold |
|-----------|--------|-----------|
| SELECT by ID | < 5ms | 10ms |
| SELECT with JOIN | < 20ms | 50ms |
| Complex aggregation | < 50ms | 100ms |
| Dashboard query | < 100ms | 200ms |
| INSERT/UPDATE | < 10ms | 25ms |
| Batch operation (1K) | < 500ms | 1000ms |

### System Performance

| Metric | Target | Critical |
|--------|--------|----------|
| Cache hit rate | > 70% | > 50% |
| Pool efficiency | > 80% | > 60% |
| Slow query % | < 5% | < 10% |
| P95 query time | < 50ms | < 100ms |
| P99 query time | < 100ms | < 200ms |

### Database Size

| Table | Typical Rows | Index Size | Total Size |
|-------|-------------|-----------|------------|
| tickets | 100K | 15MB | 50MB |
| users | 1K | 200KB | 1MB |
| comments | 500K | 20MB | 100MB |
| audit_logs | 1M | 50MB | 200MB |

---

## Troubleshooting

### Slow Queries

1. Check query plan:
   ```bash
   npm run db:analyze
   ```

2. Verify indexes are used:
   ```sql
   EXPLAIN QUERY PLAN SELECT ...
   ```

3. Check for full table scans:
   ```typescript
   const analysis = queryMonitor.analyzeQueryPlan(db, sql);
   console.log(analysis.warnings);
   ```

### Low Cache Hit Rate

1. Check cache stats:
   ```bash
   npm run db:monitor
   ```

2. Increase cache size:
   ```bash
   QUERY_CACHE_MAX_SIZE=104857600  # 100MB
   ```

3. Adjust TTLs:
   ```typescript
   queryCache.cached(key, fn, { ttl: 600 })
   ```

### Pool Contention

1. Check pool stats:
   ```typescript
   const stats = pool.getStats();
   console.log(`Efficiency: ${stats.inUse / stats.total}`);
   ```

2. Increase pool size:
   ```bash
   DB_POOL_MAX=20
   ```

3. Reduce connection hold time:
   - Release connections quickly
   - Avoid I/O during connection use

---

## Migration to PostgreSQL

The database is designed for easy PostgreSQL migration:

1. Schema is PostgreSQL-compatible
2. Indexes are standard SQL
3. Connection pool ready for `pg` driver
4. Queries use standard SQL (no SQLite-specific features)

**Migration steps:**
1. Export data: `sqlite3 db.sqlite .dump > backup.sql`
2. Convert to PostgreSQL syntax
3. Update connection config
4. Test thoroughly
5. Deploy

---

## Additional Resources

- [SQLite Query Planner](https://www.sqlite.org/queryplanner.html)
- [Database Indexing Best Practices](https://use-the-index-luke.com/)
- [Connection Pooling Guide](https://node-postgres.com/features/pooling)
- [LRU Cache Algorithm](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))

---

**Last Updated:** 2025-01-18
**Maintained By:** ServiceDesk Dev Team
