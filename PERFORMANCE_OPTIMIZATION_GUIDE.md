# Performance Optimization Quick Reference Guide

## Quick Start: Critical Path Implementation

This guide provides step-by-step instructions for implementing the highest-impact performance optimizations identified in the Performance Report.

---

## Week 1 Critical Path (Estimated: 32 hours)

### 1. Integrate Connection Pooling (4 hours) ⚡

**Impact**: 60-80% query performance improvement

#### Step 1.1: Update Database Connection
Replace the current connection with the pool:

```typescript
// lib/db/connection.ts
import { createConnectionPool } from '../performance/connection-pool';

// Create pool instance
const pool = createConnectionPool({
  maxConnections: 20,
  minConnections: 5,
  acquireTimeout: 30000,
  idleTimeout: 300000,
  enableReadReplicas: false, // Enable when ready
});

// Export pool methods
export const db = {
  prepare: (sql: string) => {
    // Wrapper to use pool
    return {
      get: async (...params: any[]) => {
        return pool.execute(sql, params, true);
      },
      all: async (...params: any[]) => {
        return pool.execute(sql, params, true);
      },
      run: async (...params: any[]) => {
        return pool.execute(sql, params, false);
      },
    };
  },
  transaction: async (fn: any) => {
    return pool.transaction(fn);
  },
  close: async () => {
    return pool.shutdown();
  },
};

export default db;
```

#### Step 1.2: Update Query Functions
Modify all query functions to use async/await:

```typescript
// lib/db/queries.ts
export async function getTicketById(id: number): Promise<Ticket | null> {
  const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
  return await stmt.get(id);
}
```

#### Step 1.3: Update API Routes
Update all API routes to handle async queries:

```typescript
// app/api/tickets/route.ts
export async function GET(request: Request) {
  const tickets = await getTickets(); // Now async
  return NextResponse.json(tickets);
}
```

#### Step 1.4: Test Connection Pool
Create a test file:

```typescript
// tests/unit/connection-pool.test.ts
import { connectionPool } from '@/lib/performance/connection-pool';

test('Pool acquires and releases connections', async () => {
  const conn = await connectionPool.acquire();
  expect(conn).toBeDefined();
  connectionPool.release(conn);

  const stats = connectionPool.getStats();
  expect(stats.totalConnections).toBeGreaterThan(0);
});

test('Pool handles concurrent requests', async () => {
  const promises = Array.from({ length: 10 }, () =>
    connectionPool.execute('SELECT 1', [], true)
  );

  const results = await Promise.all(promises);
  expect(results).toHaveLength(10);
});
```

**Verification**:
```bash
# Check pool statistics
curl http://localhost:3000/api/performance/pool-stats

# Expected response:
{
  "totalConnections": 5,
  "activeConnections": 0,
  "idleConnections": 5,
  "avgResponseTime": "25ms"
}
```

---

### 2. Add Redis to Development Environment (2 hours) 🔧

**Impact**: 40-60% response time improvement for cached requests

#### Step 2.1: Update Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: servicedesk-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis_data:
    driver: local
```

#### Step 2.2: Update Environment Variables

```bash
# .env.local
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

#### Step 2.3: Start Redis

```bash
# Start Redis container
docker-compose up redis -d

# Verify Redis is running
docker ps | grep redis

# Test connection
redis-cli ping
# Expected: PONG
```

#### Step 2.4: Verify Cache Integration

```bash
# Start application
npm run dev

# Check cache stats
curl http://localhost:3000/api/admin/cache

# Expected response:
{
  "l1": { "hits": 0, "misses": 0, "size": 0 },
  "l2": { "hits": 0, "misses": 0, "connected": true },
  "hitRate": 0
}
```

#### Step 2.5: Test Cache Functionality

```typescript
// Test cache in browser console or API
import { cacheStrategy } from '@/lib/cache/strategy';

// Set value
await cacheStrategy.set('test-key', { data: 'test' }, { ttl: 60 });

// Get value
const value = await cacheStrategy.get('test-key');
console.log(value); // { data: 'test' }

// Check stats
const stats = cacheStrategy.getStats();
console.log(stats);
```

**Production Setup**:
```bash
# Use managed Redis (recommended)
# AWS ElastiCache, Azure Cache, or Upstash

# Set production environment variable
REDIS_URL=redis://:password@production-redis.example.com:6379
```

---

### 3. Implement Real Compression (4 hours) 📦

**Impact**: 50-70% bandwidth savings

#### Step 3.1: Update Compression Manager

```typescript
// lib/performance/response-compression.ts
import { promisify } from 'util';
import { gzip, brotliCompress, deflate } from 'zlib';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const deflateAsync = promisify(deflate);

export class ResponseCompressionManager {
  // ... existing code ...

  private async compressGzip(buffer: Buffer): Promise<Buffer> {
    return gzipAsync(buffer, {
      level: this.config.levels.gzip,
    });
  }

  private async compressBrotli(buffer: Buffer): Promise<Buffer> {
    return brotliAsync(buffer, {
      params: {
        [require('zlib').constants.BROTLI_PARAM_QUALITY]: this.config.levels.brotli,
      },
    });
  }

  private async compressDeflate(buffer: Buffer): Promise<Buffer> {
    return deflateAsync(buffer, {
      level: this.config.levels.deflate,
    });
  }

  // Synchronous versions for analysis
  private compressGzipSync(buffer: Buffer): Buffer {
    return require('zlib').gzipSync(buffer, {
      level: this.config.levels.gzip,
    });
  }

  private compressBrotliSync(buffer: Buffer): Buffer {
    return require('zlib').brotliCompressSync(buffer, {
      params: {
        [require('zlib').constants.BROTLI_PARAM_QUALITY]: this.config.levels.brotli,
      },
    });
  }

  private compressDeflateSync(buffer: Buffer): Buffer {
    return require('zlib').deflateSync(buffer, {
      level: this.config.levels.deflate,
    });
  }
}
```

#### Step 3.2: Add Compression Middleware

```typescript
// middleware.ts
import { createCompressionManager } from './lib/performance/response-compression';

const compressionManager = createCompressionManager();

export async function middleware(request: NextRequest) {
  // ... existing middleware code ...

  // Get response
  const response = NextResponse.next();

  // Apply compression for API responses
  if (pathname.startsWith('/api/') && request.method === 'GET') {
    // Compress response (Next.js handles this automatically, but we can add custom logic)
    response.headers.set('Vary', 'Accept-Encoding');

    // Custom compression for large responses
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    if (contentLength > 1024) { // > 1KB
      // Mark for compression
      response.headers.set('X-Compress', 'true');
    }
  }

  return response;
}
```

#### Step 3.3: Enable Next.js Compression

```javascript
// next.config.js
module.exports = {
  compress: true, // Enable gzip compression

  // Custom compression settings
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },
};
```

#### Step 3.4: Test Compression

```bash
# Test with curl
curl -H "Accept-Encoding: gzip" http://localhost:3000/api/tickets -v | gunzip

# Check response headers
curl -I -H "Accept-Encoding: br,gzip" http://localhost:3000/api/tickets

# Expected headers:
# Content-Encoding: br  (or gzip)
# Vary: Accept-Encoding
```

**Verification**:
```typescript
// Create test endpoint
// app/api/test-compression/route.ts
export async function GET() {
  const largeData = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: 'Lorem ipsum dolor sit amet'.repeat(10),
  }));

  return NextResponse.json(largeData);
}

// Test in browser:
// Uncompressed: ~500KB
// Compressed:   ~50KB (90% reduction)
```

---

### 4. Enable Slow Query Logging (2 hours) 📊

**Impact**: Better visibility into performance bottlenecks

#### Step 4.1: Integrate Query Optimizer

```typescript
// lib/db/connection.ts
import { queryOptimizer } from '../performance/query-optimizer';

export const db = {
  prepare: (sql: string) => {
    return {
      get: async (...params: any[]) => {
        // Analyze query in development
        if (process.env.NODE_ENV !== 'production') {
          const analysis = await queryOptimizer.analyzeQuery(sql, params);
          if (analysis.executionTime > 100) {
            console.warn('Slow query detected:', {
              query: sql.substring(0, 100),
              time: analysis.executionTime,
              suggestions: analysis.suggestions,
            });
          }
        }

        return pool.execute(sql, params, true);
      },
      // ... other methods ...
    };
  },
};
```

#### Step 4.2: Create Query Monitoring Endpoint

```typescript
// app/api/performance/queries/route.ts
import { NextResponse } from 'next/server';
import { queryOptimizer } from '@/lib/performance/query-optimizer';

export async function GET() {
  const metrics = queryOptimizer.getQueryMetrics();
  const slowQueries = queryOptimizer.getSlowQueries();

  return NextResponse.json({
    totalQueries: metrics.length,
    slowQueries: slowQueries.length,
    metrics: metrics.slice(0, 20), // Top 20
    slowest: slowQueries.slice(0, 10), // Top 10 slowest
  });
}
```

#### Step 4.3: Add Query Dashboard

```typescript
// app/admin/performance/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function PerformancePage() {
  const [queryMetrics, setQueryMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/performance/queries')
      .then(res => res.json())
      .then(data => setQueryMetrics(data));
  }, []);

  if (!queryMetrics) return <div>Loading...</div>;

  return (
    <div>
      <h1>Query Performance</h1>

      <div>
        <h2>Statistics</h2>
        <p>Total Queries: {queryMetrics.totalQueries}</p>
        <p>Slow Queries: {queryMetrics.slowQueries}</p>
      </div>

      <div>
        <h2>Slowest Queries</h2>
        {queryMetrics.slowest.map((query: any, i: number) => (
          <div key={i}>
            <p>Query: {query.queryHash}</p>
            <p>Avg Time: {query.averageExecutionTime.toFixed(2)}ms</p>
            <p>Count: {query.executionCount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Step 4.4: Configure Logging

```typescript
// lib/monitoring/logger.ts
export const logger = {
  // ... existing methods ...

  slowQuery: (query: string, duration: number, threshold = 100) => {
    if (duration > threshold) {
      console.warn('[SLOW QUERY]', {
        query: query.substring(0, 200),
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  },
};
```

**Verification**:
```bash
# Run application and monitor console
npm run dev

# Visit query dashboard
open http://localhost:3000/admin/performance

# Check slow query logs
tail -f logs/slow-queries.log
```

---

## Performance Testing

### Run Full Load Test Suite

```bash
# Install Playwright if not already installed
npm install -D @playwright/test

# Run all performance tests
npx playwright test tests/performance/load-tests.spec.ts

# Run specific test suites
npx playwright test tests/performance/load-tests.spec.ts -g "Page Load Performance"
npx playwright test tests/performance/load-tests.spec.ts -g "API Performance"
npx playwright test tests/performance/load-tests.spec.ts -g "Concurrent User Load"
npx playwright test tests/performance/load-tests.spec.ts -g "Memory Leak Detection"
npx playwright test tests/performance/load-tests.spec.ts -g "Asset Optimization"
npx playwright test tests/performance/load-tests.spec.ts -g "Cache Effectiveness"

# Generate HTML report
npx playwright test tests/performance/load-tests.spec.ts --reporter=html
npx playwright show-report
```

### Performance Baseline

After implementing the critical path optimizations, establish a baseline:

```bash
# 1. Clear all caches
curl -X DELETE http://localhost:3000/api/admin/cache

# 2. Restart services
docker-compose restart
npm run build
npm run start

# 3. Warm up (10 requests)
for i in {1..10}; do
  curl http://localhost:3000/api/health
done

# 4. Run performance tests
npx playwright test tests/performance/load-tests.spec.ts --reporter=json > baseline.json

# 5. Save baseline
cp baseline.json performance-baselines/$(date +%Y-%m-%d).json
```

### Performance Regression Testing

```bash
# Run before each deployment
npm run test:performance

# Compare with baseline
node scripts/compare-performance.js baseline.json current.json
```

---

## Monitoring Setup

### 1. Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { connectionPool } from '@/lib/performance/connection-pool';
import { cacheStrategy } from '@/lib/cache/strategy';

export async function GET() {
  const dbHealth = await connectionPool.healthCheck();
  const cacheStats = cacheStrategy.getStats();

  const health = {
    status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbHealth.status,
        connections: dbHealth.details.totalConnections,
        avgResponseTime: dbHealth.details.averageResponseTime,
      },
      cache: {
        status: cacheStats.l2Hits > 0 ? 'ok' : 'degraded',
        hitRate: cacheStats.hitRate,
        totalRequests: cacheStats.totalRequests,
      },
    },
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
```

### 2. Metrics Endpoint

```typescript
// app/api/metrics/route.ts
import { NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/performance/monitoring';
import { connectionPool } from '@/lib/performance/connection-pool';
import { cacheStrategy } from '@/lib/cache/strategy';

export async function GET() {
  const perfStats = performanceMonitor.getStats();
  const dbStats = connectionPool.getStats();
  const cacheStats = cacheStrategy.getStats();

  const metrics = {
    performance: {
      totalRequests: perfStats.totalRequests,
      avgResponseTime: perfStats.avgResponseTime,
      errorRate: perfStats.errorRate,
    },
    database: {
      totalConnections: dbStats.totalConnections,
      activeConnections: dbStats.activeConnections,
      avgAcquireTime: dbStats.averageAcquireTime,
      totalAcquired: dbStats.totalAcquired,
    },
    cache: {
      hitRate: cacheStats.hitRate,
      l1Hits: cacheStats.l1Hits,
      l2Hits: cacheStats.l2Hits,
      misses: cacheStats.misses,
    },
  };

  return NextResponse.json(metrics);
}
```

### 3. Grafana Dashboard (Optional)

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## Quick Verification Checklist

After completing the critical path, verify:

### Database Performance
- [ ] Connection pool active: `curl http://localhost:3000/api/performance/pool-stats`
- [ ] Query time < 100ms average
- [ ] Pool utilization < 80%
- [ ] No connection errors in logs

### Cache Performance
- [ ] Redis connected: `docker ps | grep redis`
- [ ] Cache hit rate > 70%
- [ ] L2 cache active: Check cache stats endpoint
- [ ] Cache warming working

### Compression
- [ ] Gzip/Brotli headers present: `curl -I http://localhost:3000/api/tickets`
- [ ] Response size reduced by > 50%
- [ ] Compression time < 10ms

### Monitoring
- [ ] Health check returns 200: `curl http://localhost:3000/api/health`
- [ ] Metrics endpoint working: `curl http://localhost:3000/api/metrics`
- [ ] Slow query logging active
- [ ] Performance dashboard accessible

### Load Testing
- [ ] All load tests passing
- [ ] Page load < 3s
- [ ] API response < 500ms
- [ ] 100 concurrent users supported
- [ ] No memory leaks detected

---

## Troubleshooting Common Issues

### Issue: Connection Pool Errors

```bash
# Symptom: "Connection acquire timeout"
# Solution: Increase pool size or timeout

// lib/performance/connection-pool.ts
const pool = createConnectionPool({
  maxConnections: 30,  // Increased from 20
  acquireTimeout: 45000,  // Increased from 30000
});
```

### Issue: Redis Connection Failed

```bash
# Symptom: "L2 Cache (Redis) connection failed"
# Solution: Verify Redis is running

docker-compose up redis -d
docker logs servicedesk-redis

# Check Redis health
redis-cli ping

# Verify environment variable
echo $REDIS_URL
```

### Issue: Compression Not Working

```bash
# Symptom: No "Content-Encoding" header
# Solution: Check client supports compression

curl -H "Accept-Encoding: gzip" http://localhost:3000/api/tickets -v

# Verify Next.js config
grep "compress" next.config.js
```

### Issue: Slow Query Logging Silent

```bash
# Symptom: No slow query logs appearing
# Solution: Lower threshold or verify integration

// Temporary lower threshold for testing
queryOptimizer.slowQueryThreshold = 10;  // 10ms instead of 100ms
```

---

## Next Steps

After completing the critical path:

1. **Review Performance Report**: See detailed analysis in `PERFORMANCE_REPORT.md`
2. **Run Baseline Tests**: Establish performance baseline
3. **Monitor Production**: Set up monitoring and alerting
4. **Plan Month 1**: Implement short-term optimizations (cache warming, read replicas)
5. **Capacity Planning**: Review and update based on actual load

---

**Quick Reference Created**: 2025-10-05
**Next Review**: After Week 1 implementation
**Estimated Impact**: 60-80% overall performance improvement
