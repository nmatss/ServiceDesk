# Performance Optimization - Usage Examples

Complete guide for using the SPRINT 8 performance optimization features.

---

## Table of Contents
1. [Multi-Layer Caching](#multi-layer-caching)
2. [Database Query Optimization](#database-query-optimization)
3. [API Compression](#api-compression)
4. [Performance Monitoring](#performance-monitoring)
5. [Client-Side Optimization](#client-side-optimization)
6. [Production Deployment](#production-deployment)

---

## Multi-Layer Caching

### Basic Usage

```typescript
import { cacheStrategy } from '@/lib/cache/strategy'

// Simple get/set
await cacheStrategy.set('user:123', userData, { ttl: 300 })
const user = await cacheStrategy.get('user:123')

// Delete from cache
await cacheStrategy.delete('user:123')
```

### Cache-Aside Pattern (Recommended)

```typescript
import { cacheStrategy, cacheKeys } from '@/lib/cache/strategy'

// Automatically fetch and cache if not present
const tickets = await cacheStrategy.getOrSet(
  cacheKeys.tickets.list({ status: 'open' }),
  async () => {
    // This function only runs on cache miss
    return await db.getTickets({ status: 'open' })
  },
  {
    ttl: 300,          // 5 minutes
    tags: ['tickets']  // For invalidation
  }
)
```

### Tag-Based Invalidation

```typescript
// Invalidate all ticket-related caches
await cacheStrategy.invalidateByTag('tickets')

// Invalidate multiple tags
await cacheStrategy.invalidateByTag('users')
await cacheStrategy.invalidateByTag('analytics')
```

### Pre-Built Cache Keys

```typescript
import { cacheKeys } from '@/lib/cache/strategy'

// Entity by ID
cacheKeys.tickets.byId(123)  // 'ticket:123'
cacheKeys.users.byId(456)    // 'user:456'

// List with filters
cacheKeys.tickets.list({ status: 'open', priority: 'high' })
// 'ticket:list:priority=high&status=open'

// Search queries
cacheKeys.tickets.search('login issue')
// 'ticket:search:login issue'

// Aggregations
cacheKeys.analytics.aggregate('daily', '2024-01-01')
// 'analytics:agg:daily:2024-01-01'
```

### Custom Cache Keys

```typescript
import { CacheKeyBuilder } from '@/lib/cache/strategy'

const customKeys = new CacheKeyBuilder('custom-entity')

const key1 = customKeys.byId(123)
const key2 = customKeys.list({ type: 'active' })
const key3 = customKeys.search('search term')
```

### Cache Statistics

```typescript
const stats = cacheStrategy.getStats()
console.log({
  l1Hits: stats.l1Hits,
  l2Hits: stats.l2Hits,
  misses: stats.misses,
  hitRate: stats.hitRate,
  avgResponseTime: stats.avgResponseTime
})
```

---

## Database Query Optimization

### Basic Query with Caching

```typescript
import { dbOptimizer } from '@/lib/db/optimizer'

// Execute query with automatic caching
const tickets = await dbOptimizer.executeWithStats(
  'SELECT * FROM tickets WHERE organization_id = ?',
  [orgId],
  {
    ttl: 300,           // Cache for 5 minutes
    tags: ['tickets']   // Tag for invalidation
  }
)
```

### Cache Invalidation After Writes

```typescript
// After creating/updating tickets
async function updateTicket(id: number, data: any) {
  // Update database
  await db.updateTicket(id, data)

  // Invalidate all ticket-related caches
  await dbOptimizer.invalidateCache('tickets')
}
```

### Performance Statistics

```typescript
// Get query performance stats
const perfStats = dbOptimizer.getPerformanceStats()
console.log({
  slowQueries: perfStats.slowQueries,
  averageQueryTime: perfStats.averageQueryTime
})

// Get cache statistics
const cacheStats = dbOptimizer.getQueryCacheStats()
console.log({
  hits: cacheStats.hits,
  misses: cacheStats.misses,
  hitRate: cacheStats.hitRate
})

// Get connection pool stats
const poolStats = dbOptimizer.getConnectionPoolStats()
console.log({
  active: poolStats.active,
  idle: poolStats.idle,
  waiting: poolStats.waitingRequests
})
```

### Database Maintenance

```typescript
// Run database optimization (should be in cron job)
await dbOptimizer.optimizeTables()  // ANALYZE + VACUUM

// Check database integrity
const integrity = await dbOptimizer.checkIntegrity()
if (!integrity.ok) {
  console.error('Database errors:', integrity.errors)
}

// Get database size
const size = dbOptimizer.getDatabaseSize()
console.log(`Database size: ${size.sizeMB} MB`)
```

---

## API Compression

### Automatic Compression

```typescript
// app/api/tickets/route.ts
import { NextRequest } from 'next/server'
import { createCompressedResponse } from '@/lib/api/compression'

export async function GET(request: NextRequest) {
  const tickets = await getTickets()

  // Automatically compress based on Accept-Encoding header
  return createCompressedResponse(
    tickets,
    request.headers.get('accept-encoding')
  )
}
```

### Custom Compression Options

```typescript
import { compressResponse } from '@/lib/api/compression'

export async function GET(request: NextRequest) {
  const data = await getLargeDataset()

  const compressed = await compressResponse(
    data,
    request.headers.get('accept-encoding'),
    'application/json'
  )

  console.log({
    originalSize: compressed.stats.originalSize,
    compressedSize: compressed.stats.compressedSize,
    ratio: compressed.stats.compressionRatio,
    encoding: compressed.stats.encoding
  })

  return new Response(compressed.body, {
    headers: compressed.headers
  })
}
```

### Payload Optimization

```typescript
import {
  optimizePayload,
  paginateResponse,
  selectFields
} from '@/lib/api/compression'

// Remove null/undefined values
const optimized = optimizePayload(data)

// Paginate large datasets
const paginated = paginateResponse(items, page, limit)
console.log({
  data: paginated.data,
  pagination: {
    page: paginated.pagination.page,
    total: paginated.pagination.total,
    hasNext: paginated.pagination.hasNext
  }
})

// Return only requested fields
const fields = ['id', 'title', 'status']
const selected = selectFields(tickets, fields)
```

### Streaming Large Files

```typescript
import { streamCompressedData } from '@/lib/api/compression'
import { createReadStream } from 'fs'

export async function GET(request: NextRequest) {
  const stream = createReadStream('large-export.json')
  const compressed = await streamCompressedData(
    stream,
    request.headers.get('accept-encoding')
  )

  return new Response(compressed, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'br'
    }
  })
}
```

---

## Performance Monitoring

### Server-Side Monitoring

```typescript
import { performanceMonitor } from '@/lib/performance/monitoring'

// Track API response time
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const data = await fetchData()
    const duration = Date.now() - startTime

    // Track successful response
    performanceMonitor.trackApiResponse(
      request.nextUrl.pathname,
      duration,
      200
    )

    return Response.json(data)
  } catch (error) {
    const duration = Date.now() - startTime

    // Track error response
    performanceMonitor.trackApiResponse(
      request.nextUrl.pathname,
      duration,
      500
    )

    throw error
  }
}
```

### Database Query Tracking

```typescript
import { performanceMonitor } from '@/lib/performance/monitoring'

async function runQuery(query: string) {
  const startTime = Date.now()
  const result = await db.execute(query)
  const duration = Date.now() - startTime

  performanceMonitor.trackDbQuery(query, duration)

  return result
}
```

### Get Performance Statistics

```typescript
// Get overall stats
const stats = performanceMonitor.getStats()
console.log({
  totalRequests: stats.totalRequests,
  avgResponseTime: stats.avgResponseTime,
  recentMetrics: stats.recentMetrics
})

// Get Core Web Vitals summary
const webVitals = performanceMonitor.getCoreWebVitalsSummary()
console.log({
  lcp: webVitals.lcp,  // { avg, p75, p95, rating }
  fid: webVitals.fid,
  cls: webVitals.cls
})

// Get percentile values
const p95 = performanceMonitor.getPercentile('apiResponseTime', 95)
console.log(`95th percentile response time: ${p95}ms`)
```

### Custom Performance Budgets

```typescript
import { performanceMonitor } from '@/lib/performance/monitoring'

// Set custom budget
performanceMonitor.setBudget({
  metric: 'apiResponseTime',
  budget: 300,         // 300ms
  alertThreshold: 0.9  // Alert at 90% of budget
})

// Get all budgets
const budgets = performanceMonitor.getBudgets()
```

---

## Client-Side Optimization

### Initialize Web Vitals Tracking

```typescript
// app/layout.tsx or app/providers.tsx
'use client'

import { useEffect } from 'react'
import { initBrowserPerformanceMonitoring } from '@/lib/performance/monitoring'

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize automatic Core Web Vitals tracking
    initBrowserPerformanceMonitoring()
  }, [])

  return <>{children}</>
}
```

### Manual Performance Marks

```typescript
'use client'

import { mark, measure } from '@/lib/performance/monitoring'

function DataFetchingComponent() {
  async function fetchData() {
    mark('data-fetch-start')

    const data = await fetch('/api/data')

    mark('data-fetch-end')
    const duration = measure('data-fetch', 'data-fetch-start', 'data-fetch-end')

    console.log(`Data fetch took ${duration}ms`)

    return data
  }

  // ...
}
```

### Component Render Tracking

```typescript
'use client'

import { measureComponentRender } from '@/lib/performance/monitoring'

function ExpensiveComponent() {
  measureComponentRender('ExpensiveComponent', () => {
    // Component rendering logic
    // Will log warning if render takes >16ms
  })

  return <div>...</div>
}
```

### Send Custom Metrics

```typescript
'use client'

async function reportCustomMetric() {
  await fetch('/api/performance/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'page-performance',
      entry: {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics: {
          pageLoadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          timeToInteractive: performance.timing.domInteractive - performance.timing.navigationStart
        },
        context: {
          sessionId: localStorage.getItem('sessionId')
        }
      }
    })
  })
}
```

---

## Production Deployment

### Environment Variables

```bash
# .env.production

# Redis Configuration (L2 Cache)
REDIS_URL=redis://your-redis-host:6379

# Performance Settings
NODE_ENV=production
ENABLE_COMPRESSION=true

# Monitoring
PERFORMANCE_LOGGING=true
SLOW_QUERY_THRESHOLD=100
```

### Build with Bundle Analysis

```bash
# Generate bundle analysis
ANALYZE=true npm run build

# View reports at:
# - .next/analyze/client.html
# - .next/analyze/server.html
```

### Production Checklist

- [ ] Configure Redis for L2 cache
- [ ] Set up CDN for static assets (Cloudflare, AWS CloudFront)
- [ ] Enable compression in reverse proxy (nginx, Apache)
- [ ] Configure cache headers for your CDN
- [ ] Set up performance monitoring dashboard
- [ ] Configure alerts for performance budgets
- [ ] Run load tests to validate performance
- [ ] Monitor Core Web Vitals in production
- [ ] Set up database connection pooling (when migrating to PostgreSQL)
- [ ] Configure automatic cache warming for critical data

### nginx Configuration Example

```nginx
# Enable Brotli compression
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml;

# Enable Gzip fallback
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

# Cache static assets
location /_next/static/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# Cache images
location ~ \.(jpg|jpeg|png|gif|ico|svg|webp|avif)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

### Monitoring Dashboard

```typescript
// Dashboard component
async function PerformanceDashboard() {
  const response = await fetch('/api/performance/metrics')
  const metrics = await response.json()

  return (
    <div>
      <h1>Performance Metrics</h1>

      <section>
        <h2>Core Web Vitals</h2>
        <MetricCard
          name="LCP"
          value={metrics.webVitals.lcp.p75}
          rating={metrics.webVitals.lcp.rating}
        />
        <MetricCard
          name="FID"
          value={metrics.webVitals.fid.p75}
          rating={metrics.webVitals.fid.rating}
        />
        <MetricCard
          name="CLS"
          value={metrics.webVitals.cls.p75}
          rating={metrics.webVitals.cls.rating}
        />
      </section>

      <section>
        <h2>Cache Performance</h2>
        <div>Hit Rate: {(metrics.cache.strategy.hitRate * 100).toFixed(1)}%</div>
        <div>L1 Hits: {metrics.cache.strategy.l1Hits}</div>
        <div>L2 Hits: {metrics.cache.strategy.l2Hits}</div>
      </section>

      <section>
        <h2>Database Performance</h2>
        <div>Query Cache Hit Rate: {(metrics.database.queryCache.hitRate * 100).toFixed(1)}%</div>
        <div>Active Connections: {metrics.database.connectionPool.active}</div>
      </section>
    </div>
  )
}
```

---

## Performance Testing

### Load Testing Script (k6)

```javascript
// load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 100,        // 100 virtual users
  duration: '30s', // 30 seconds
}

export default function () {
  // Test API endpoint
  const res = http.get('http://localhost:3000/api/tickets')

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  })

  sleep(1)
}
```

Run test:
```bash
k6 run load-test.js
```

### Expected Results

```
✓ status is 200
✓ response time < 200ms

checks.........................: 100.00% ✓ 3000      ✗ 0
data_received..................: 15 MB   500 kB/s
data_sent......................: 1.2 MB  40 kB/s
http_req_blocked...............: avg=1.2ms   min=0.01ms  med=0.05ms  max=50ms   p(95)=5ms
http_req_duration..............: avg=45ms    min=10ms    med=40ms    max=180ms  p(95)=95ms
http_reqs......................: 3000    100/s
iteration_duration.............: avg=1.05s   min=1.01s   med=1.04s   max=1.2s
```

---

## Troubleshooting

### Cache Not Working

```typescript
// Check cache stats
const stats = cacheStrategy.getStats()
console.log('Hit rate:', stats.hitRate)
console.log('Total requests:', stats.totalRequests)

// Clear cache if needed
await cacheStrategy.clear()
```

### Redis Connection Issues

```typescript
// Cache strategy automatically falls back to L1 (memory) if Redis is unavailable
// Check logs for connection errors:
// "L2 Cache (Redis) connection failed, running without Redis"
```

### Slow Queries

```typescript
// Get slow query report
const perfStats = dbOptimizer.getPerformanceStats()
console.log('Slow queries:', perfStats.slowQueries)

// Run database optimization
await dbOptimizer.optimizeTables()
```

### Bundle Size Too Large

```bash
# Analyze bundle
ANALYZE=true npm run build

# Check for:
# - Large dependencies that can be lazy-loaded
# - Duplicate dependencies
# - Unused code
```

---

## Best Practices

1. **Cache Invalidation**: Always invalidate cache after data mutations
2. **TTL Selection**: Use longer TTL for static data, shorter for dynamic data
3. **Tag Everything**: Use cache tags for easy invalidation
4. **Monitor Performance**: Set up dashboards and alerts
5. **Test Under Load**: Run load tests before production
6. **Progressive Enhancement**: Ensure app works even if cache/compression fails
7. **Database Queries**: Use prepared statements and proper indexes
8. **Bundle Size**: Lazy load heavy components and libraries
9. **Images**: Use Next.js Image component for automatic optimization
10. **CDN**: Serve static assets from CDN in production

---

## Additional Resources

- [Next.js Performance Docs](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
- [Bundle Analysis Guide](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)

---

For detailed implementation information, see `/SPRINT8_PERFORMANCE_REPORT.md`
