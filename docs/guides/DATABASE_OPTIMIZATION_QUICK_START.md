# Database Optimization - Quick Start Guide

## 🚀 Apply Optimizations (5 minutes)

### 1. Add Critical Indexes
```bash
npx tsx lib/db/migrations/add-critical-indexes.ts up
```
**Impact:** 60-95% faster queries immediately
**Safe:** Uses `IF NOT EXISTS` - can run multiple times

### 2. Verify Indexes
```bash
npx tsx -e "
import { db } from './lib/db/connection';
const count = db.prepare(\"SELECT COUNT(*) as c FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'\").get();
console.log('Indexes created:', count);
"
```

---

## 📊 Enable Performance Monitoring

### Development Environment
Add to `.env.local`:
```env
QUERY_MONITORING=true
SLOW_QUERY_THRESHOLD=100
```

### Check Query Performance
```bash
# Start dev server with monitoring
QUERY_MONITORING=true npm run dev

# Open dashboard - check console for:
✅ getRealTimeKPIs: 305ms
🐌 SLOW QUERY: getExpensiveReport (850ms)
```

---

## 🔍 Run Benchmarks

### Test All Critical Queries
```bash
npx tsx scripts/benchmark-queries.ts
```

### Expected Output:
```
========================================================
📊 BENCHMARK RESULTS
========================================================
Query                     Avg (ms)    Min     Max
getRealTimeKPIs          302.5       280     450
getAllTickets            85.3        78      120
========================================================
```

---

## 📈 Setup Analytics Summaries (Optional)

### One-time Setup
```bash
# Create summary tables
npx tsx -e "
import { createAnalyticsSummaryTables } from './lib/db/analytics-summaries';
createAnalyticsSummaryTables();
"

# Populate with yesterday's data
npx tsx lib/db/analytics-summaries.ts
```

### Add Daily Cron Job
```bash
# Edit crontab
crontab -e

# Add this line (runs at midnight)
0 0 * * * cd /path/to/ServiceDesk && npx tsx lib/db/analytics-summaries.ts
```

---

## 🛠️ Troubleshooting

### Indexes Not Working?
```bash
# Force SQLite to analyze tables
npx tsx -e "
import { db } from './lib/db/connection';
db.exec('ANALYZE');
console.log('Database analyzed');
"
```

### Check Database Health
```bash
npx tsx -e "
import { getDatabaseStats } from './lib/db/query-monitor';
getDatabaseStats();
"
```

### Rollback Indexes (if needed)
```bash
npx tsx lib/db/migrations/add-critical-indexes.ts down
```

---

## 📖 Performance Tips

### 1. Cache Expensive Queries
```typescript
import { wrapQuery } from '@/lib/db/query-monitor';

export function getExpensiveData() {
  return wrapQuery('getExpensiveData', () => {
    // Your query here
  });
}
```

### 2. Use Analytics Summaries
```typescript
import { getSummaryData } from '@/lib/db/analytics-summaries';

// Instead of complex aggregation:
const summary = getSummaryData(orgId, '2025-12-01', '2025-12-31');
// 98% faster!
```

### 3. Monitor Slow Queries
```typescript
import { getAllQueryStats } from '@/lib/db/query-monitor';

// In dev console or API endpoint
console.log(getAllQueryStats());
```

---

## 🎯 Key Files

| File | Purpose |
|------|---------|
| `/lib/db/query-monitor.ts` | Performance tracking |
| `/lib/db/analytics-summaries.ts` | Materialized summaries |
| `/scripts/benchmark-queries.ts` | Performance testing |
| `/lib/db/critical-indexes-simple.sql` | Index definitions |

---

**Questions?** See full report: `AGENT_13_DATABASE_OPTIMIZATION_REPORT.md`
